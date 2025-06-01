#!/usr/bin/env python
# file: build_faiss_embeddings.py
"""
Pipeline to
  • mark ProductImage.frontFacing (True = front, False = back)
  • add ONE front + ONE back image embedding per ProductItem
  • add ONE text embedding per ProductItem (from metaData)
  • write / update three FAISS indices on disk:
        faiss_front.index   – id = item_id*2-1
        faiss_back.index    – id = item_id*2
        faiss_text.index    – id = item_id       (same as DB PK)
The script is safe to resume – it skips items that are already complete.
"""
import os, re, io, time, json, math, logging, contextlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests, torch, faiss, numpy as np
from PIL import Image
from sqlalchemy import create_engine, select, update, func
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from transformers import AutoModel, AutoProcessor
from torchvision import transforms
from torchvision.models import convnext_tiny, ConvNeXt_Tiny_Weights
import torch.nn as nn

# -----------------------------------------------------------------------------
# configuration
# -----------------------------------------------------------------------------
load_dotenv()
DATABASE_URL = "postgresql://postgres:H98bbv%3A6ABsk.V92hrppK%3F26Wh@jrt-shopping.cfooe6oceksm.ap-southeast-2.rds.amazonaws.com:5432/JRT_Shopping"
DEVICE        = "cuda" if torch.cuda.is_available() else "cpu"
BATCH_SIZE    =  64                  # images / texts per model forward pass
SAVE_EVERY_N  = 200                  # DB rows before saving FAISS to disk
DIM           = 512                  # CLIP embedding size

PATH_ROOT     = Path(__file__).with_suffix("")           # same folder as script
PATH_FRONT    = PATH_ROOT.parent / "faiss_front.index"
PATH_BACK     = PATH_ROOT.parent / "faiss_back.index"
PATH_TEXT     = PATH_ROOT.parent / "faiss_text.index"

# -----------------------------------------------------------------------------
# logging
# -----------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-8s │ %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("faiss-builder")

# -----------------------------------------------------------------------------
# SQLAlchemy models (minimal – import only the columns we touch)
# -----------------------------------------------------------------------------
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

Base = declarative_base()


class ProductItem(Base):
    __tablename__ = "ProductItem"
    id               = Column(Integer, primary_key=True)
    name             = Column(String)
    metaData         = Column(String)
    frontEmbeddingId = Column(Integer, nullable=True)
    backEmbeddingId  = Column(Integer, nullable=True)
    textEmbeddingId  = Column(Integer, nullable=True)
    productImages    = relationship("ProductImage", back_populates="clothingItem")


class ProductImage(Base):
    __tablename__ = "ProductImage"
    id            = Column(Integer, primary_key=True)
    productItemId = Column(Integer, ForeignKey("ProductItem.id"))
    imageUrl      = Column(String)
    frontFacing   = Column(Boolean, nullable=True)
    clothingItem  = relationship("ProductItem", back_populates="productImages")


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
log.info("Loading CLIP (image+text) …")
clip_model     = AutoModel.from_pretrained("Marqo/marqo-fashionCLIP", trust_remote_code=True).to(DEVICE).eval()
clip_processor = AutoProcessor.from_pretrained("Marqo/marqo-fashionCLIP", trust_remote_code=True)

log.info("Loading ConvNeXt tiny front/back classifier …")
fb_model = convnext_tiny(weights=None)
fb_model.classifier[2] = nn.Linear(fb_model.classifier[2].in_features, 2)
fb_weights = PATH_ROOT.parent / "best_front_back_model_convnext_82.3_88.19.pth"
fb_model.load_state_dict(torch.load(fb_weights, map_location=DEVICE))
fb_model.to(DEVICE).eval()

tfm_classify = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

# -----------------------------------------------------------------------------
# FAISS helpers
# -----------------------------------------------------------------------------
def _new_index():
    return faiss.IndexIDMap(faiss.IndexFlatL2(DIM))

def _load_or_new(path):
    if path.exists():
        log.info(f"Loading index {path.name} …")
        return faiss.read_index(str(path))
    return _new_index()

faiss_front = _load_or_new(PATH_FRONT)
faiss_back  = _load_or_new(PATH_BACK)
faiss_text  = _load_or_new(PATH_TEXT)

# -----------------------------------------------------------------------------
# HTTP helpers
# -----------------------------------------------------------------------------
REQ_TIMEOUT = 8
http = requests.Session()
http.headers.update({
    "User-Agent": "fashion-clip-builder/1.0"
})

def fetch_image(url: str) -> Image.Image | None:
    if url.startswith("//"):
        url = "https:" + url
    try:
        r = http.get(url, timeout=REQ_TIMEOUT)
        r.raise_for_status()
        return Image.open(io.BytesIO(r.content)).convert("RGB")
    except Exception as e:
        log.warning(f"IMG-ERR {url[:60]} – {e}")
        return None

# -----------------------------------------------------------------------------
# Embedding helpers
# -----------------------------------------------------------------------------
@torch.no_grad()
def embed_images(images: list[Image.Image]) -> np.ndarray:
    """Return L2-normalised CLIP embeddings for a batch of PIL images."""
    inputs = clip_processor(images=images, return_tensors="pt")
    inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
    feats  = clip_model.get_image_features(**inputs)
    feats  = torch.nn.functional.normalize(feats, dim=-1)
    return feats.cpu().numpy().astype("float32")

@torch.no_grad()
def embed_texts(texts: list[str]) -> np.ndarray:
    """Return CLIP text embeddings (77 token limit handled by processor)."""
    inputs = clip_processor(text=texts, truncation=True,
                            padding="max_length", max_length=77, return_tensors="pt")
    inputs = {k: v.to(DEVICE) for k, v in inputs.items()}
    feats  = clip_model.get_text_features(**inputs)
    feats  = torch.nn.functional.normalize(feats, dim=-1)
    return feats.cpu().numpy().astype("float32")

@torch.no_grad()
def classify_batch(imgs: list[Image.Image]) -> np.ndarray:
    """Return probabilities that each image is BACK-facing (shape: [N])"""
    tensors = torch.stack([tfm_classify(im) for im in imgs]).to(DEVICE)
    out     = torch.nn.functional.softmax(fb_model(tensors), dim=1)[:, 1]  # prob(back)
    return out.cpu().numpy()

# -----------------------------------------------------------------------------
# text preprocessing (stop-word removal keeps tokens ≤77 more often)
# -----------------------------------------------------------------------------
STOPWORDS = set("""
a an the and or with to for of on in it this that from as its is are be by at
your into their was has have will
""".split())

def clean_text(t: str) -> str:
    t = re.sub(r"[^\w\s]", " ", t)
    return " ".join(w for w in t.split() if w.lower() not in STOPWORDS).lower()

# -----------------------------------------------------------------------------
# FAISS id helpers
# front id = 2*item_id-1 , back id = 2*item_id
# -----------------------------------------------------------------------------
def _fid(item_id):  return item_id*2 - 1
def _bid(item_id):  return item_id*2

# -----------------------------------------------------------------------------
# Main driver
# -----------------------------------------------------------------------------
# -----------------------------------------------------------------------------
def main():
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    done   = 0
    with Session(engine) as db:
        q = (db.query(ProductItem)
                .filter(ProductItem.frontEmbeddingId.is_(None) |
                        ProductItem.backEmbeddingId.is_(None) |
                        ProductItem.textEmbeddingId.is_(None))
                .yield_per(64)
         )
        for item in q:
            changed = process_item(db, item)
            if not changed:
                continue

            done += 1

            # ──► progress ping every 10 items
            if done % 10 == 0:
                log.info("✅ %d items processed so far", done)

            # keep the 200-item FAISS checkpoint
            if done % SAVE_EVERY_N == 0:
                save_indices()

        db.commit()

    save_indices()
    log.info("All done – %d items updated ✔︎", done)


# -----------------------------------------------------------------------------
# Per-item processing
# -----------------------------------------------------------------------------
def process_item(db: Session, item: ProductItem) -> bool:
    """
    Returns True if DB or FAISS were updated.
    """
    imgs = item.productImages
    if not imgs:
        return False

    # --- 1) classify every image - batch for speed
    pil_list, img_objs = [], []
    for im in imgs:
        pil = fetch_image(im.imageUrl)
        if pil is not None:
            pil_list.append(pil);  img_objs.append(im)

    if not pil_list:
        return False

    back_probs = classify_batch(pil_list)
    for im, p_back in zip(img_objs, back_probs):
        im.frontFacing = bool(p_back < 0.5)   # <.5 = front
    db.flush()                                # mark in-memory change only

    # --- 2) choose best front/back by confidence
    front_cands = [(abs(p-0.0), i) for i, p in enumerate(back_probs) if p < 0.5]
    back_cands  = [(abs(p-1.0), i) for i, p in enumerate(back_probs) if p >= 0.5]

    front_idx = min(front_cands, default=(None, None))[1]
    back_idx  = min(back_cands,  default=(None, None))[1]

    changed = False

    # --- 3) image embeddings
    if front_idx is not None and item.frontEmbeddingId is None:
        vec = embed_images([pil_list[front_idx]])[0]
        fid = _fid(item.id)
        faiss_front.add_with_ids(vec.reshape(1,-1), np.array([fid], dtype="int64"))
        item.frontEmbeddingId = fid
        changed = True

    if back_idx is not None and item.backEmbeddingId is None:
        vec = embed_images([pil_list[back_idx]])[0]
        bid = _bid(item.id)
        faiss_back.add_with_ids(vec.reshape(1,-1), np.array([bid], dtype="int64"))
        item.backEmbeddingId = bid
        changed = True

    # --- 4) text embedding
    if (md := (item.metaData or "").strip()) and item.textEmbeddingId is None:
        txt_vec = embed_texts([clean_text(md)])[0]
        tid = item.id        # text id == PK – keeps mapping simple
        faiss_text.add_with_ids(txt_vec.reshape(1,-1), np.array([tid], dtype="int64"))
        item.textEmbeddingId = tid
        changed = True

    if changed:
        db.add(item)
        db.commit()
    return changed

# -----------------------------------------------------------------------------
def save_indices():
    log.info("Writing FAISS indices to disk …")
    faiss.write_index(faiss_front, str(PATH_FRONT))
    faiss.write_index(faiss_back,  str(PATH_BACK))
    faiss.write_index(faiss_text,  str(PATH_TEXT))

# -----------------------------------------------------------------------------
if __name__ == "__main__":
    t0 = time.time()
    main()
    log.info("Runtime %.1f s", time.time() - t0)
