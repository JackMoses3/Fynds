import os
print('starting this embedding file')
import asyncio
import logging
import torch
import numpy as np
import aiohttp
from PIL import Image
from io import BytesIO
from sqlalchemy import create_engine, Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, selectinload
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor
from transformers import AutoModel, AutoProcessor
from torchvision.models import convnext_tiny
import torch.nn as nn
from torchvision import transforms

from vector_store import collection

# --- Configure logging ---
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# --- Setup Environment and DB ---
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
Base = declarative_base()

# --- SQLAlchemy Models ---
class ProductItem(Base):
    __tablename__ = "ProductItem"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    frontEmbeddingId = Column(Integer, nullable=True)
    backEmbeddingId = Column(Integer, nullable=True)
    textEmbeddingId = Column(Integer, nullable=True)
    productImages = relationship(
        "ProductImage",
        back_populates="clothingItem",
        lazy="selectin"
    )

class ProductImage(Base):
    __tablename__ = "ProductImage"
    id = Column(Integer, primary_key=True)
    productItemId = Column(Integer, ForeignKey("ProductItem.id"))
    imageUrl = Column(String)
    frontFacing = Column(Boolean, nullable=True)
    clothingItem = relationship("ProductItem", back_populates="productImages")

# --- Load Front/Back Classifier ---
device = "cuda" if torch.cuda.is_available() else "cpu"
classifier_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

def load_front_back_model(path="best_front_back_model_convnext_82.3_88.19.pth"):
    model = convnext_tiny(weights=None)
    model.classifier[2] = nn.Linear(model.classifier[2].in_features, 2)
    model.load_state_dict(torch.load(path, map_location=device))
    return model.to(device).eval()

front_back_model = load_front_back_model()

# --- Load CLIP Model ---
clip_model = AutoModel.from_pretrained('Marqo/marqo-fashionCLIP').to(device)
clip_processor = AutoProcessor.from_pretrained('Marqo/marqo-fashionCLIP')
DIM = 512

# --- Async Image Fetching ---
async def fetch_image(session, url: str):
    try:
        if url.startswith('//'):
            url = 'https:' + url
        async with session.get(url, timeout=10) as resp:
            if resp.status != 200 or not resp.headers.get('Content-Type', '').startswith('image'):
                raise ValueError(f"Bad response {resp.status}")
            data = await resp.read()
        return Image.open(BytesIO(data)).convert('RGB')
    except Exception as e:
        logger.warning(f"Failed to fetch {url}: {e}")
        return None

async def fetch_images(session, urls):
    return await asyncio.gather(*[fetch_image(session, u) for u in urls])

# --- Classification ---
def classify_front_back(pil_img: Image.Image):
    try:
        t = classifier_transform(pil_img).unsqueeze(0).to(device)
        with torch.no_grad():
            out = front_back_model(t)
            probs = torch.nn.functional.softmax(out, dim=1)[0]
        label = 'front' if probs[0] > probs[1] else 'back'
        return label, float(probs[1])  # back confidence
    except Exception as e:
        logger.warning(f"Classification error: {e}")
        return 'front', 0.0

# --- Embedding ---
def batch_embed(images, texts):
    try:
        img_inputs = clip_processor(images=images, return_tensors='pt', padding=True).to(device)
        txt_inputs = clip_processor(text=texts, return_tensors='pt', padding=True, truncation=True, max_length=77).to(device)
        with torch.no_grad():
            img_emb = clip_model.get_image_features(**img_inputs)
            txt_emb = clip_model.get_text_features(**txt_inputs)
        img_emb = (img_emb / img_emb.norm(p=2, dim=-1, keepdim=True)).cpu().numpy()
        txt_emb = (txt_emb / txt_emb.norm(p=2, dim=-1, keepdim=True)).cpu().numpy()
        return img_emb, txt_emb
    except Exception as e:
        logger.error(f"Embedding error: {e}")
        return np.zeros((0, DIM), dtype=np.float32), np.zeros((0, DIM), dtype=np.float32)

# --- Process Batch ---
def process_batch(item_ids, batch_index):
    session = Session()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    async def runner():
        async with aiohttp.ClientSession() as http_sess:
            upsert_ids, upsert_vecs, upsert_names, upsert_fronts = [], [], [], []

            for item_id in item_ids:
                item = session.get(ProductItem, item_id, options=[selectinload(ProductItem.productImages)])
                if not item:
                    continue
                urls = [img.imageUrl for img in item.productImages]
                images = await fetch_images(http_sess, urls)

                # classify
                front_cands, back_cands = [], []
                for img_rec, pil in zip(item.productImages, images):
                    if pil is None:
                        continue
                    label, conf = classify_front_back(pil)
                    img_rec.frontFacing = (label == 'front')
                    session.add(img_rec)
                    (front_cands if label=='front' else back_cands).append((pil, conf))

                # select best
                best_front = min(front_cands, key=lambda x: x[1])[0] if front_cands else None
                best_back  = max(back_cands,  key=lambda x: x[1])[0] if back_cands else None
                chosen, vids, fronts = [], [], []
                if best_front is not None:
                    vids.append(item.id*2-1)
                    chosen.append(best_front)
                    fronts.append(True)
                    item.frontEmbeddingId = vids[-1]
                if best_back is not None:
                    vids.append(item.id*2)
                    chosen.append(best_back)
                    fronts.append(False)
                    item.backEmbeddingId = vids[-1]

                # embed and collect
                if chosen:
                    texts = [item.name] * len(chosen)
                    img_embs, txt_embs = batch_embed(chosen, texts)

                    # prepare upsert
                    for emb, vid, front_flag in zip(img_embs, vids, fronts):
                        upsert_ids.append(vid)
                        upsert_vecs.append(emb)
                        upsert_names.append(item.name)
                        upsert_fronts.append(front_flag)

                    # text embedding
                    if txt_embs.shape[0] > 0:
                        upsert_ids.append(item.id)
                        upsert_vecs.append(txt_embs[0])
                        upsert_names.append(item.name)
                        upsert_fronts.append(False)
                        item.textEmbeddingId = item.id

                session.add(item)

            # flush DB changes
            session.commit()

            # upsert vectors to Milvus
            if upsert_ids:
                collection.insert([
                    upsert_ids,
                    np.vstack(upsert_vecs).tolist(),
                    upsert_names,
                    upsert_fronts,
                ])
                collection.flush()

    try:
        loop.run_until_complete(runner())
        logger.info(f"✅ Batch {batch_index} committed ({len(item_ids)} items) and upserted {len(upsert_ids)} vectors")
    except Exception as e:
        session.rollback()
        logger.error(f"Error in batch {batch_index}: {e}")
    finally:
        loop.close()
        session.close()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

# --- Main ---
def main(batch_size=20):
    session = Session()
    all_ids = [i[0] for i in session.query(ProductItem.id).filter(
        ProductItem.frontEmbeddingId==None,
        ProductItem.backEmbeddingId==None,
        ProductItem.textEmbeddingId==None
    ).all()]
    session.close()

    batches = [all_ids[i:i+batch_size] for i in range(0, len(all_ids), batch_size)]
    with ThreadPoolExecutor(max_workers=2) as executor:
        for idx, b in enumerate(batches, 1):
            executor.submit(process_batch, b, idx)

if __name__ == '__main__':
    main()