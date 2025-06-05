"""
FastAPI Fashion-CLIP embedding micro-service
-------------------------------------------
Optimisations added:
  • One global aiohttp session (no new TCP/SSL handshake per image)
  • torch.cuda.empty_cache() after every request – prevents fragmentation
"""

import os, re, asyncio, logging, atexit
from io import BytesIO
from typing import List, Optional

import aiohttp, numpy as np, torch, torch.nn.functional as F
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from PIL import Image
from transformers import AutoModel, AutoProcessor
from torchvision.models import convnext_tiny
from torchvision import transforms
import torch.nn as nn
from dotenv import load_dotenv

# ─────────── env / logging ───────────
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger("embedding_service")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
DIM    = 512

# ─────────── simple stop-word cleaner ───────────
_STOPWORDS = {"a","an","the","and","or","but","if","else","on","in","with","of","for","to","from"}
def clean_meta_data(raw: str) -> str:
    txt = re.sub(r"[^a-z0-9\s]", " ", raw.lower().strip())
    tokens = [t for t in re.sub(r"\s+", " ", txt).split() if t not in _STOPWORDS]
    return " ".join(tokens[:77])

# ─────────── front/back classifier ───────────
classifier_tf = transforms.Compose([
    transforms.Resize((224,224)), transforms.ToTensor(),
    transforms.Normalize([0.485,0.456,0.406], [0.229,0.224,0.225])
])

def load_front_back_model():
    path = os.path.join(os.path.dirname(__file__), "model_files", "best_front_back_model_convnext_82.3_88.19.pth")
    mdl  = convnext_tiny(weights=None)
    mdl.classifier[2] = nn.Linear(mdl.classifier[2].in_features, 2)
    if os.path.isfile(path):
        mdl.load_state_dict(torch.load(path, map_location=device))
    else:
        logger.warning("⚠️ front/back .pth not found – using random weights")
    return mdl.to(device).eval()

front_back_model = load_front_back_model()

def classify_image(pil: Image.Image) -> tuple[bool, float]:
    x = classifier_tf(pil).unsqueeze(0).to(device)
    with torch.no_grad():
        probs = F.softmax(front_back_model(x), dim=1)[0]
    label = probs[0] > probs[1]
    return bool(label), float(probs[1])  # back-prob

# ─────────── Fashion-CLIP ───────────
clip_model = AutoModel.from_pretrained("Marqo/marqo-fashionCLIP").to(device)
clip_proc  = AutoProcessor.from_pretrained("Marqo/marqo-fashionCLIP")

# ─────────── global aiohttp session ───────────
_session: aiohttp.ClientSession | None = None
def get_session() -> aiohttp.ClientSession:
    global _session
    if _session is None or _session.closed:
        _session = aiohttp.ClientSession()
    return _session
@atexit.register
def _close_session():
    if _session and not _session.closed:
        asyncio.get_event_loop().run_until_complete(_session.close())

async def fetch_image(url: str) -> Optional[Image.Image]:
    if url.startswith("//"):
        url = "https:" + url
    try:
        async with get_session().get(url, timeout=15) as resp:
            if resp.status != 200 or not resp.headers.get("Content-Type","").startswith("image"):
                return None
            data = await resp.read()
        return Image.open(BytesIO(data)).convert("RGB")
    except Exception:
        return None

def embed_images_and_text(images: List[Image.Image], texts: List[str]):
    if not images:
        return np.zeros((0,DIM), np.float32), np.zeros((0,DIM), np.float32)

    inputs = clip_proc(images=images,
                       text=texts if texts else None,
                       return_tensors="pt",
                       padding=True,
                       truncation=True).to(device)

    with torch.no_grad():
        img_emb = clip_model.get_image_features(pixel_values=inputs["pixel_values"])
        txt_emb = (clip_model.get_text_features(**{k:v for k,v in inputs.items() if k.startswith("input_ids")})
                   if texts else torch.zeros((0,DIM), device=device))

    img_emb = (img_emb / img_emb.norm(p=2, dim=-1, keepdim=True)).cpu().numpy()
    txt_emb = (txt_emb / txt_emb.norm(p=2, dim=-1, keepdim=True)).cpu().numpy()
    return img_emb, txt_emb

# ─────────── Pydantic IO models ───────────
class EmbedRequest(BaseModel):
    id: int
    metaData: str
    imageUrls: List[str]

class EmbedResponse(BaseModel):
    productId: int
    frontEmbedding: Optional[List[float]] = None
    backEmbedding : Optional[List[float]] = None
    textEmbedding : Optional[List[float]] = None
    frontFacingImages: Optional[List[bool]] = None

class BatchEmbedRequest(BaseModel):
    products: List[EmbedRequest]
class BatchEmbedResponse(BaseModel):
    results: List[EmbedResponse]

class TextEmbedRequest(BaseModel):
    text: str
class TextEmbedResponse(BaseModel):
    embedding: List[float]

class ImageEmbedResponse(BaseModel):
    label: str
    embedding: List[float]

# ─────────── FastAPI routes ───────────
app = FastAPI()
router = APIRouter()

@router.post("/product-embed", response_model=EmbedResponse)
async def product_embed(req: EmbedRequest):
    cleaned_meta = clean_meta_data(req.metaData)
    imgs: List[Image.Image] = await asyncio.gather(*(fetch_image(u) for u in req.imageUrls))

    front_flags: List[bool] = []
    front_cand, back_cand = [], []
    for img in imgs:
        if img is None:
            front_flags.append(False); continue
        is_front, p_back = classify_image(img)
        front_flags.append(is_front)
        (front_cand if is_front else back_cand).append((img, p_back))

    best_front = min(front_cand, key=lambda x: x[1])[0] if front_cand else None
    best_back  = max(back_cand , key=lambda x: x[1])[0] if back_cand  else None

    images_to_embed, text_reps = [], []
    if best_front:
        images_to_embed.append(best_front)
        if cleaned_meta: text_reps.append(cleaned_meta)
    if best_back:
        images_to_embed.append(best_back)
        if cleaned_meta: text_reps.append(cleaned_meta)

    img_embs, txt_embs = embed_images_and_text(images_to_embed, text_reps)
    front_vec = back_vec = text_vec = None
    if best_front and not best_back:
        front_vec = img_embs[0].tolist(); text_vec = txt_embs[0].tolist() if txt_embs.size else None
    elif best_front and best_back:
        front_vec = img_embs[0].tolist(); back_vec = img_embs[1].tolist()
        if txt_embs.size: text_vec = txt_embs[0].tolist()
    elif best_back and not best_front:
        back_vec = img_embs[0].tolist(); text_vec = txt_embs[0].tolist() if txt_embs.size else None

    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    return EmbedResponse(
        productId=req.id,
        frontEmbedding=front_vec,
        backEmbedding =back_vec,
        textEmbedding =text_vec,
        frontFacingImages=front_flags,
    )

@router.post("/products-embed-batch", response_model=BatchEmbedResponse)
async def products_embed_batch(req: BatchEmbedRequest):
    results = []
    for prod in req.products:
        try:  results.append(await product_embed(prod))
        except Exception:
            results.append(EmbedResponse(productId=prod.id))
    return BatchEmbedResponse(results=results)

@router.post("/text-embed", response_model=TextEmbedResponse)
async def text_embed(req: TextEmbedRequest):
    cleaned = clean_meta_data(req.text)
    if not cleaned: raise HTTPException(status_code=400, detail="text must be non-empty")
    inputs = clip_proc(text=[cleaned], return_tensors="pt", padding=True, truncation=True).to(device)
    with torch.no_grad():
        vec = clip_model.get_text_features(**inputs)[0]
    if torch.cuda.is_available(): torch.cuda.empty_cache()
    return TextEmbedResponse(embedding=(vec/vec.norm()).cpu().tolist())

@router.post("/image-embed", response_model=ImageEmbedResponse)
async def image_embed(file: UploadFile = File(...)):
    pil = Image.open(BytesIO(await file.read())).convert("RGB")
    label, _ = classify_image(pil)
    vec, _ = embed_images_and_text([pil], [])
    if torch.cuda.is_available(): torch.cuda.empty_cache()
    return ImageEmbedResponse(label="front" if label else "back", embedding=vec[0].tolist())

app.include_router(router, prefix="/api/v1/embedding")
