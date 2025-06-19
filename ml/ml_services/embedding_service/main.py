"""
FastAPI Fashion-CLIP embedding micro-service
-------------------------------------------
Optimisations added:
  • One global aiohttp session (no new TCP/SSL handshake per image)
  • torch.cuda.empty_cache() after every request – prevents fragmentation
"""

import os, re, asyncio, logging, atexit, time
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
    text = " ".join(tokens)
    return text

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
clip_model = AutoModel.from_pretrained("Marqo/marqo-fashionCLIP", trust_remote_code=True)
clip_proc  = AutoProcessor.from_pretrained("Marqo/marqo-fashionCLIP", trust_remote_code=True)

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
    # Shopify CDN resize for PNGs
    if url.startswith("//"):
        url = "https:" + url

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
    }

    try:
        async with get_session().get(url, timeout=15, headers=headers) as resp:
            if resp.status != 200:
                logger.warning(f"❌ Failed to fetch {url}: HTTP {resp.status}")
                return None
            if not resp.headers.get("Content-Type", "").startswith("image"):
                logger.warning(f"❌ Not an image {url}: {resp.headers.get('Content-Type')}")
                return None
            data = await resp.read()
        return Image.open(BytesIO(data)).convert("RGB")
    except Exception as e:
        logger.warning(f"❌ Exception fetching {url}: {type(e).__name__}: {str(e)}")
        return None

def embed_images_and_text(image: Image.Image, text: str, have_text: bool):
    if not image:
        return np.zeros((0,DIM), np.float32), np.zeros((0,DIM), np.float32)
    
    if not have_text and len(text) > 0: 
        inputs = clip_proc(images=image,
                        text=text,
                        return_tensors="pt",
                        padding='max_length',
                        )
        with torch.no_grad():
            img_emb = clip_model.get_image_features(inputs["pixel_values"], normalize=True)
            txt_emb = clip_model.get_text_features(inputs["input_ids"], normalize=True)
        return img_emb, txt_emb
    else:
        inputs = clip_proc(images=image, return_tensors="pt", padding='max_length')

        with torch.no_grad():
            img_emb = clip_model.get_image_features(inputs["pixel_values"], normalize=True)

        return img_emb, None

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
    logger.info(f"🔍 Processing product {req.id} with {len(req.imageUrls)} images")
    
    cleaned_meta = clean_meta_data(req.metaData)

    front_flags: List[bool] = []
    front_cand, back_cand = [], []

    # Parallel image fetching
    image_tasks = [fetch_image(url) for url in req.imageUrls]
    images = await asyncio.gather(*image_tasks, return_exceptions=True)

    for img in images:
        if isinstance(img, Exception) or img is None:
            front_flags.append(False)
            continue

        is_front, p_back = classify_image(img)
        front_flags.append(is_front)

        if is_front:
            front_cand.append((img, p_back))
        else:
            back_cand.append((img, p_back))

    # 3. Pick best front/back candidates
    best_front = min(front_cand, key=lambda x: x[1])[0] if front_cand else None
    best_back  = max(back_cand , key=lambda x: x[1])[0] if back_cand  else None

    # 5. Run through CLIP
    front_vec = back_vec = text_vec = None
    if best_front and not best_back:
        front_vec, text_vec = embed_images_and_text(best_front, cleaned_meta, have_text=False)

    elif best_front and best_back:
        front_vec, text_vec = embed_images_and_text(best_front, cleaned_meta, have_text=False) 
        back_vec, _ = embed_images_and_text(best_back, cleaned_meta, have_text=True)

    elif best_back and not best_front:
        back_vec, text_vec = embed_images_and_text(best_back, cleaned_meta, have_text=False)

    # ✅ CONVERT TENSORS TO LISTS
    front_vec = front_vec.cpu().flatten().tolist() if front_vec is not None else None
    back_vec = back_vec.cpu().flatten().tolist() if back_vec is not None else None
    text_vec = text_vec.cpu().flatten().tolist() if text_vec is not None else None

    # 6. Clear GPU memory
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    # 7. Return
    embeddings_generated = []
    if front_vec: embeddings_generated.append("front")
    if back_vec: embeddings_generated.append("back") 
    if text_vec: embeddings_generated.append("text")
    
    logger.info(f"✅ Product {req.id} generated: {', '.join(embeddings_generated) if embeddings_generated else 'NONE'}")
    
    return EmbedResponse(
        productId=req.id,
        frontEmbedding=front_vec,
        backEmbedding=back_vec,
        textEmbedding=text_vec,
        frontFacingImages=front_flags,
    )


@router.post("/products-embed-batch", response_model=BatchEmbedResponse)
async def products_embed_batch(req: BatchEmbedRequest):
    batch_start = time.time()
    # Create a task for each product embed so that they're processed concurrently.
    tasks = [asyncio.create_task(product_embed(prod)) for prod in req.products]
    # Wait for all tasks to complete; gather any exceptions.
    results_raw = await asyncio.gather(*tasks, return_exceptions=True)
    results = []
    for prod, res in zip(req.products, results_raw):
        if isinstance(res, Exception):
            results.append(EmbedResponse(productId=prod.id))
        else:
            results.append(res)
    batch_end = time.time()
    logger.info(f"⏱️ Batch of {len(req.products)} products embedded in {batch_end - batch_start:.2f}s")
    return BatchEmbedResponse(results=results)

@router.post("/text-embed", response_model=TextEmbedResponse)
async def text_embed(req: TextEmbedRequest):
    cleaned = clean_meta_data(req.text)
    if not cleaned: 
        raise HTTPException(status_code=400, detail="text must be non-empty")
    
    processed_text = clip_proc(text=cleaned, return_tensors="pt", padding='max_length')

    with torch.no_grad():
        text_features = clip_model.get_text_features(processed_text['input_ids'], normalize=True)
        vec = text_features[0]
    
    if torch.cuda.is_available(): 
        torch.cuda.empty_cache()
    
    return TextEmbedResponse(embedding=(vec/vec.norm()).cpu().tolist())

@router.post("/image-embed", response_model=ImageEmbedResponse)
async def image_embed(file: UploadFile = File(...)):
    pil = Image.open(BytesIO(await file.read())).convert("RGB")
    label, _ = classify_image(pil)
<<<<<<< HEAD
    vec, _ = embed_images_and_text([pil], [])
    if torch.cuda.is_available(): torch.cuda.empty_cache()
    return ImageEmbedResponse(label="front" if label else "back", embedding=vec[0].tolist())
=======
    
    # Fix: Use correct embedding function
    inputs = clip_proc(images=pil, return_tensors="pt", padding='max_length').to(device)
    with torch.no_grad():
        img_features = clip_model.get_image_features(inputs["pixel_values"], normalize=True)
        vec = (img_features[0] / img_features[0].norm()).cpu().tolist()
    
    if torch.cuda.is_available(): 
        torch.cuda.empty_cache()
        
    return ImageEmbedResponse(
        label="front" if label else "back", 
        embedding=vec
    )
>>>>>>> ad6aa61 (created logic to allow users to do photo to product similarity from explore screen)

app.include_router(router, prefix="/api/v1/embedding")
