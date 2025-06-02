# ml/embedding/embedding_server.py

"""
Embedding micro‐service (FastAPI) that:
1. Receives one product (ID, metaData, list of image URLs) → /product-embed.
2. Receives free text → /text-embed.
3. Receives one image via multipart/form-data → /image-embed.
All endpoints generate Fashion‐CLIP embeddings (and, in the case of /product-embed, update the DB).
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
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from PIL import Image
from transformers import AutoModel, AutoProcessor
from torchvision.models import convnext_tiny
from torchvision import transforms
import torch.nn as nn
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
DIM = 512  # Fashion‐CLIP output dimensionality

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
    Expects the .pth file at model_files/best_front_back_model_convnext_82.3_88.19.pth
    """
    current_dir = os.path.dirname(__file__)
    model_path = os.path.abspath(
        os.path.join(
            current_dir,
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

# – Fashion‐CLIP
clip_model = AutoModel.from_pretrained("Marqo/marqo-fashionCLIP").to(device)
clip_proc = AutoProcessor.from_pretrained("Marqo/marqo-fashionCLIP")

# --------------------------------------------------
# Pydantic schemas for request/response
# --------------------------------------------------
class EmbedRequest(BaseModel):
    id: int
    metaData: str            # description text
    imageUrls: List[str]

class EmbedResponse(BaseModel):
    frontEmbedding: Optional[List[float]] = None
    backEmbedding: Optional[List[float]] = None
    textEmbedding: Optional[List[float]] = None
    frontFacingImages: Optional[List[bool]] = None  # URLs of images classified as front

class TextEmbedRequest(BaseModel):
    text: str

class TextEmbedResponse(BaseModel):
    embedding: List[float]    # length == 512

class ImageEmbedResponse(BaseModel):
    label: str                # “front” or “back”
    embedding: List[float]    # length == 512

# --------------------------------------------------
# Helper functions
# --------------------------------------------------
async def fetch_image(session: aiohttp.ClientSession, url: str) -> Optional[Image.Image]:
    """
    Download an image from `url` asynchronously. Return a PIL.Image or None on failure.
    """
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

def classify_image(pil: Image.Image) -> List[bool]:
    """
    Classify a PIL image as 'front' or 'back'.
    Returns (label, probability_of_back). Lower probability_of_back = more front-like.
    """
    with torch.no_grad():
        x = classifier_tf(pil).unsqueeze(0).to(device)
        logits = front_back_model(x)
        probs = F.softmax(logits, dim=1)[0]  # [prob_front, prob_back]
        label = True if probs[0] > probs[1] else False
        return label

def embed_images_and_text(images: List[Image.Image], texts: List[str]):
    """
    Given lists of PIL images and corresponding text strings,
    return (img_embs: np.ndarray[NxDIM], txt_embs: np.ndarray[NxDIM]).
    Handles the case where texts may be empty.
    """
    # Case A: no text replicas → only embed images
    if len(texts) == 0:
        inputs = clip_proc(
            images=images,
            return_tensors="pt"
        ).to(device)
        img_inputs = {k: v for k, v in inputs.items() if k.startswith("pixel_values")}
        with torch.no_grad():
            img_emb = clip_model.get_image_features(**img_inputs)
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
router = APIRouter()

@router.post("/product-embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    """
    1) Download all images for req.imageUrls.
    2) Classify each as front/back, record label per URL.
    3) Pick the single best front and single best back (if any).
    4) Generate Fashion‐CLIP embeddings for chosen front/back images (and text from req.metaData).
       - If req.metaData is empty or whitespace-only, skip text embedding.
    5) Update PostgreSQL:
       - Set ProductItem.frontEmbeddingId, backEmbeddingId, textEmbeddingId.
       - Mark ProductImage.frontFacing=True for images classified “front”, False otherwise.
    6) Return JSON { productId, frontEmbedding?, backEmbedding?, textEmbedding? }.
    """
    # 0) image front facing list
    front_facing_images: List[bool] = []
    # 1) Download images concurrently
    async with aiohttp.ClientSession() as session:
        fetch_coros = [fetch_image(session, url) for url in req.imageUrls]
        pil_images = await asyncio.gather(*fetch_coros)


    # 2) Classify and collect candidates
    back_candidates:  List[tuple[Image.Image, float, str]] = []
    url_to_label: dict[str, str] = {}

    for url, pil in url_and_images:
        if pil is None:
            continue
        label, back_prob = classify_image(pil)
        front_facing_images.append(label)  # True for front, False for back
        url_to_label[url] = label
        if label == True:
            # Lower back_prob → more confident front
            front_candidates.append((pil, 1.0 - back_prob, url))
        else:
            back_candidates.append((pil, back_prob, url))

    # 3) Pick best front/back if available
    best_front_pil: Optional[Image.Image] = None
    if front_candidates:
        best_front_pil, _, _ = min(front_candidates, key=lambda x: x[1])

    best_back_pil: Optional[Image.Image] = None
    if back_candidates:
        best_back_pil, _, _ = max(back_candidates, key=lambda x: x[1])

    # 4) Prepare for embeddings
    images_to_embed: List[Image.Image] = []
    text_replicas:   List[str]       = []
    if best_front_pil:
        images_to_embed.append(best_front_pil)
        if req.metaData.strip():
            text_replicas.append(req.metaData)
    if best_back_pil:
        images_to_embed.append(best_back_pil)
        if req.metaData.strip():
            text_replicas.append(req.metaData)

    # 5) Generate embeddings
    if images_to_embed:
        img_embs, txt_embs = embed_images_and_text(images_to_embed, text_replicas)
    else:
        img_embs = np.zeros((0, DIM), dtype=np.float32)
        txt_embs = np.zeros((0, DIM), dtype=np.float32)

    # Map to vectors
    front_vec: Optional[List[float]] = None
    back_vec:  Optional[List[float]] = None
    text_vec:  Optional[List[float]] = None

    if best_front_pil and not best_back_pil:
        front_vec = img_embs[0].tolist()
        if txt_embs.shape[0] > 0:
            text_vec = txt_embs[0].tolist()

    elif best_front_pil and best_back_pil:
        front_vec = img_embs[0].tolist()
        back_vec  = img_embs[1].tolist()
        if txt_embs.shape[0] > 0:
            text_vec = txt_embs[0].tolist()

    elif best_back_pil and not best_front_pil:
        back_vec = img_embs[0].tolist()
        if txt_embs.shape[0] > 0:
            text_vec = txt_embs[0].tolist()

    
    # 7) Return the embeddings JSON
    return EmbedResponse(
        frontEmbedding=front_vec,
        backEmbedding=back_vec,
        textEmbedding=text_vec,
        frontFacingImages=front_facing_images
    )


@router.post("/text-embed", response_model=TextEmbedResponse)
async def text_embed(req: TextEmbedRequest):
    """
    Return a single 512-D Fashion-CLIP embedding for arbitrary free text.
    No DB writes - pure inference.
    """
    cleaned = req.text.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="text must be non-empty")

    inputs = clip_proc(
        text=[cleaned],
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=77
    ).to(device)

    with torch.no_grad():
        txt_emb = clip_model.get_text_features(**inputs)
        txt_emb = txt_emb / txt_emb.norm(p=2, dim=-1, keepdim=True)

    vec = txt_emb[0].cpu().tolist()
    return TextEmbedResponse(embedding=vec)

@router.post("/image-embed", response_model=ImageEmbedResponse)
async def image_embed(file: UploadFile = File(...)):
    """
    Accepts one uploaded picture (JPEG/PNG/etc., field name `file`).

    1. Attempt to open it with PIL (even if content_type is missing or not image/).
    2. If PIL can’t open, raise 400.
    3. Classify as 'front' or 'back'.
    4. Produce exactly one 512-D embedding for that image.
    5. Return JSON: { "label": "front"|"back", "embedding": [ …512 floats… ] }.
    """

    # 1) Read raw bytes
    raw = await file.read()
    try:
        pil = Image.open(BytesIO(raw)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Uploaded file is not a valid image: {e}")

    # 2) Classify front/back
    label, _ = classify_image(pil)  # "front" or "back"

    # 3) Embed this single image (no text reps)
    img_vecs, _ = embed_images_and_text([pil], [])
    embedding_vector = img_vecs[0].tolist()

    return ImageEmbedResponse(label=label, embedding=img_vec[0].tolist())
# --------------------------------------------------
