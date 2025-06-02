"""
Embedding micro-service (FastAPI) that:
1. Receives one product (ID, metaData, list of image URLs).
2. Downloads images, classifies each as front/back, generates Fashion-CLIP embeddings.
3. Updates the PostgreSQL database:
   - Sets ProductItem.frontEmbeddingId, backEmbeddingId, textEmbeddingId (BigInt),
     using the same ID scheme as the old pipeline: frontId = id*2 - 1, backId = id*2, textId = id.
   - Marks ProductImage.frontFacing=True for every image that the classifier labeled “front”, False otherwise.
4. Returns JSON with productId and the three optional embeddings (front, back, text).
"""

import os
import asyncio
import logging
from io import BytesIO
from typing import List, Optional

import aiohttp
import numpy as np
import torch
import torch.nn.functional as F
from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from PIL import Image
from transformers import AutoModel, AutoProcessor
from torchvision.models import convnext_tiny
from torchvision import transforms
import torch.nn as nn

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Boolean,
    BigInteger,
    ForeignKey,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, selectinload

from dotenv import load_dotenv

# --------------------------------------------------
# Load environment & configure logging
# --------------------------------------------------
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s: %(message)s"
)
logger = logging.getLogger("embedding_service")

# --------------------------------------------------
# SQLAlchemy setup (ProductItem + ProductImage)
# --------------------------------------------------
Base = declarative_base()
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

class ProductItem(Base):
    __tablename__ = "ProductItem"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    frontEmbeddingId = Column(BigInteger, nullable=True)
    backEmbeddingId = Column(BigInteger, nullable=True)
    textEmbeddingId = Column(BigInteger, nullable=True)
    productImages = relationship(
        "ProductImage",
        back_populates="productItem",
        lazy="selectin",
        cascade="all, delete-orphan"
    )

class ProductImage(Base):
    __tablename__ = "ProductImage"
    id = Column(Integer, primary_key=True, index=True)
    productItemId = Column(Integer, ForeignKey("ProductItem.id"), nullable=False)
    imageUrl = Column(String, nullable=False)
    frontFacing = Column(Boolean, nullable=True)
    productItem = relationship("ProductItem", back_populates="productImages")

class TextEmbedRequest(BaseModel):
    text: str

class TextEmbedResponse(BaseModel):
    embedding: List[float]          # always length-512

class ImageEmbedResponse(BaseModel):
    label: str              # 'front' | 'back'
    embedding: List[float]  # 512-dim

# --------------------------------------------------
# Device & model setup
# --------------------------------------------------
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
DIM = 512  # Fashion-CLIP output dimensionality

# – Front/Back Classifier Transform
classifier_tf = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

def load_front_back_model():
    """
    ConvNeXt-Tiny binary classifier (front vs back).
    Expects the .pth file at ../embedding/model_files/best_front_back_model_convnext_82.3_88.19.pth
    """
    current_dir = os.path.dirname(__file__)
    model_path = os.path.abspath(
        os.path.join(
            current_dir,
            "..",
            "embedding",
            "model_files",
            "best_front_back_model_convnext_82.3_88.19.pth"
        )
    )
    if not os.path.isfile(model_path):
        raise FileNotFoundError(f"Front/Back model not found at {model_path}")

    model = convnext_tiny(weights=None)
    model.classifier[2] = nn.Linear(model.classifier[2].in_features, 2)
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.eval()
    return model.to(device)

front_back_model = load_front_back_model()

# – Fashion-CLIP
clip_model = AutoModel.from_pretrained("Marqo/marqo-fashionCLIP").to(device)
clip_proc = AutoProcessor.from_pretrained("Marqo/marqo-fashionCLIP")

# --------------------------------------------------
# Pydantic schemas for request/response
# --------------------------------------------------
class EmbedRequest(BaseModel):
    id: int
    metaData: str            # ← replaced `name: str` with `metaData: str`
    imageUrls: List[str]

class EmbedResponse(BaseModel):
    productId: int
    frontEmbedding: Optional[List[float]] = None
    backEmbedding: Optional[List[float]] = None
    textEmbedding: Optional[List[float]] = None

# --------------------------------------------------
# Helper functions
# --------------------------------------------------
async def fetch_image(session: aiohttp.ClientSession, url: str) -> Optional[Image.Image]:
    if url.startswith("//"):
        url = "https:" + url

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/114.0 Safari/537.36"
    }

    try:
        async with session.get(url, headers=headers, timeout=15) as resp:
            if resp.status != 200:
                raise ValueError(f"HTTP {resp.status}")
            content_type = resp.headers.get("Content-Type", "")
            if not content_type.startswith("image"):
                raise ValueError(f"Not an image (Content-Type: {content_type})")
            data = await resp.read()
        return Image.open(BytesIO(data)).convert("RGB")
    except Exception as e:
        logger.warning(f"🖼️ Could not fetch {url}: {e}")
        return None

def classify_image(pil: Image.Image) -> tuple[str, float]:
    """
    Classify a PIL image as 'front' or 'back'.
    Returns (label, probability_of_back). Lower probability_of_back = more front-like.
    """
    with torch.no_grad():
        x = classifier_tf(pil).unsqueeze(0).to(device)
        logits = front_back_model(x)
        probs = F.softmax(logits, dim=1)[0]  # [prob_front, prob_back]
        label = "front" if probs[0] > probs[1] else "back"
        return label, float(probs[1])

def embed_images_and_text(images: List[Image.Image], texts: List[str]):
    """
    Given lists of PIL images and corresponding text strings,
    return (img_embs: np.ndarray[N×DIM], txt_embs: np.ndarray[N×DIM]).
    Handles the case where texts may be empty.
    """
    # Case A: no text replicas → only embed images
    if len(texts) == 0:
        # Process only images
        inputs = clip_proc(
            images=images,
            return_tensors="pt"
        ).to(device)

        # Separate out just the image inputs
        img_inputs = {k: v for k, v in inputs.items() if k.startswith("pixel_values")}

        with torch.no_grad():
            img_emb = clip_model.get_image_features(**img_inputs)

        # Normalize and return img embeddings; text embeddings is an empty array
        img_emb = (img_emb / img_emb.norm(p=2, dim=-1, keepdim=True)).cpu().numpy()
        txt_emb = np.zeros((0, DIM), dtype=np.float32)
        return img_emb, txt_emb

    # Case B: we have at least one text replica → do both image+text
    inputs = clip_proc(
        images=images,
        text=texts,
        padding=True,
        truncation=True,
        return_tensors="pt",
    ).to(device)

    img_inputs = {k: v for k, v in inputs.items() if k.startswith("pixel_values")}
    txt_inputs = {k: v for k, v in inputs.items() if k.startswith("input_ids")}

    with torch.no_grad():
        img_emb = clip_model.get_image_features(**img_inputs)
        text_emb = clip_model.get_text_features(**txt_inputs)

    img_emb = (img_emb / img_emb.norm(p=2, dim=-1, keepdim=True)).cpu().numpy()
    text_emb = (text_emb / text_emb.norm(p=2, dim=-1, keepdim=True)).cpu().numpy()

    return img_emb, text_emb


# --------------------------------------------------
# FastAPI application
# --------------------------------------------------
app = FastAPI(title="Embedding micro-service", version="0.2.0")

@app.post("/product-embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    """
    1) Download all images for req.imageUrls.
    2) Classify each as front/back, record label per URL.
    3) Pick the single best front and single best back (if any).
    4) Generate CLIP embeddings for chosen front/back images (and text from req.metaData).
       - If req.metaData is empty or whitespace-only, skip text embedding.
    5) Update PostgreSQL:
       - Set ProductItem.frontEmbeddingId, backEmbeddingId, textEmbeddingId.
       - Mark ProductImage.frontFacing=True for every image that was classified “front”, False otherwise.
    6) Return JSON { productId, frontEmbedding?, backEmbedding?, textEmbedding? }.
    """

    # 1) Download images concurrently
    async with aiohttp.ClientSession() as session:
        fetch_coros = [fetch_image(session, url) for url in req.imageUrls]
        pil_images = await asyncio.gather(*fetch_coros)

    # Pair each URL with its PIL image (None if download failed)
    url_and_images = [(url, img) for url, img in zip(req.imageUrls, pil_images)]

    # 2) Classify each valid image, collect candidates and record label-per-URL
    front_candidates: List[tuple[Image.Image, float, str]] = []
    back_candidates: List[tuple[Image.Image, float, str]] = []
    url_to_label: dict[str, str] = {}  # map URL -> "front" or "back"

    for url, pil in url_and_images:
        if pil is None:
            continue
        label, back_prob = classify_image(pil)
        url_to_label[url] = label
        if label == "front":
            # Lower back_prob → more confident front
            front_candidates.append((pil, 1.0 - back_prob, url))
        else:
            back_candidates.append((pil, back_prob, url))

    # 3) Pick the single best front and best back (if any)
    best_front_pil = None
    best_front_url = None
    if front_candidates:
        best_front_pil, _, best_front_url = min(front_candidates, key=lambda x: x[1])

    best_back_pil = None
    best_back_url = None
    if back_candidates:
        best_back_pil, _, best_back_url = max(back_candidates, key=lambda x: x[1])

    # 4) Prepare lists for embedding, using req.metaData only if it's non-empty
    images_to_embed: List[Image.Image] = []
    text_replicas: List[str] = []

    if best_front_pil:
        images_to_embed.append(best_front_pil)
        if req.metaData.strip():
            text_replicas.append(req.metaData)

    if best_back_pil:
        images_to_embed.append(best_back_pil)
        if req.metaData.strip():
            text_replicas.append(req.metaData)

    # 5) Generate embeddings (or zeros if no images/text chosen)
    if images_to_embed:
        img_embs, txt_embs = embed_images_and_text(images_to_embed, text_replicas)
    else:
        img_embs = np.zeros((0, DIM), dtype=np.float32)
        txt_embs = np.zeros((0, DIM), dtype=np.float32)

    # Map embeddings back to front_vec, back_vec, text_vec
    front_vec: Optional[List[float]] = None
    back_vec: Optional[List[float]] = None
    text_vec: Optional[List[float]] = None

    if best_front_pil and not best_back_pil:
        front_vec = img_embs[0].tolist()
        if txt_embs.shape[0] > 0:
            text_vec = txt_embs[0].tolist()

    elif best_front_pil and best_back_pil:
        front_vec = img_embs[0].tolist()
        back_vec = img_embs[1].tolist()
        if txt_embs.shape[0] > 0:
            text_vec = txt_embs[0].tolist()

    elif best_back_pil and not best_front_pil:
        back_vec = img_embs[0].tolist()
        if txt_embs.shape[0] > 0:
            text_vec = txt_embs[0].tolist()

    # 6) Update PostgreSQL via SQLAlchemy
    db = SessionLocal()
    try:
        item = (
            db.query(ProductItem)
            .filter(ProductItem.id == req.id)
            .options(selectinload(ProductItem.productImages))
            .one_or_none()
        )
        if not item:
            raise HTTPException(
                status_code=404, detail=f"ProductItem id={req.id} not found"
            )

        # a) Assign embedding IDs using old scheme:
        #    frontId = id*2 - 1, backId = id*2, textId = id
        if front_vec is not None:
            item.frontEmbeddingId = int(item.id) * 2 - 1
        else:
            item.frontEmbeddingId = None

        if back_vec is not None:
            item.backEmbeddingId = int(item.id) * 2
        else:
            item.backEmbeddingId = None

        if text_vec is not None:
            item.textEmbeddingId = int(item.id)
        else:
            item.textEmbeddingId = None

        # b) Mark frontFacing=True for every image that classifier labeled “front”,
        #    False otherwise.
        for img_row in item.productImages:
            label = url_to_label.get(img_row.imageUrl)
            img_row.frontFacing = (label == "front")

        db.commit()
        logger.info(f"✅ Updated DB for product {req.id}")
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating DB for product {req.id}: {e}")
        # We still return embeddings, but DB update failed.
    finally:
        db.close()

    # 7) Return the embeddings JSON
    return EmbedResponse(
        productId=req.id,
        frontEmbedding=front_vec,
        backEmbedding=back_vec,
        textEmbedding=text_vec,
    )


@app.post("/text-embed", response_model=TextEmbedResponse)
async def text_embed(req: TextEmbedRequest):
    """
    Return a single 512-D Fashion-CLIP embedding for arbitrary free text.
    No DB writes – pure inference.
    """

    cleaned = req.text.strip()
    if not cleaned:
        # empty / whitespace-only → reject
        raise HTTPException(status_code=400, detail="text must be non-empty")

    # Tokenise + encode
    inputs = clip_proc(text=[cleaned], return_tensors="pt",
                       padding=True, truncation=True, max_length=77).to(device)

    with torch.no_grad():
        txt_emb = clip_model.get_text_features(**inputs)
        txt_emb = txt_emb / txt_emb.norm(p=2, dim=-1, keepdim=True)

    # to Python list so it’s JSON-serialisable
    vec = txt_emb[0].cpu().tolist()

    return TextEmbedResponse(embedding=vec)

@app.post("/image-embed", response_model=ImageEmbedResponse)
async def image_embed(file: UploadFile = File(...)):
    """
    Accepts one uploaded picture (JPEG/PNG, field name `file`).

    1. Classify as 'front' or 'back'.
    2. Produce exactly **one** 512-D embedding for that same image.
    3. *No* database writes.
    """
    # 1) basic guards
    if not file.content_type or not file.content_type.startswith("image"):
        raise HTTPException(status_code=415, detail="file must be an image")

    # 2) read into PIL
    try:
        raw = await file.read()
        pil = Image.open(BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="invalid image file")

    # 3) front / back classification
    label, _ = classify_image(pil)  # label ∈ {'front','back'}

    # 4) embed (image only → no text replicas)
    img_vec, _ = embed_images_and_text([pil], [])

    return ImageEmbedResponse(label=label, embedding=img_vec[0].tolist())

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "ml.embedding.embedding_server:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=True,
        reload=False,
    )
