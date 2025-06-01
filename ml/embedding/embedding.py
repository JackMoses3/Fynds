import os
from pathlib import Path
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
from pymilvus import connections, Collection, CollectionSchema, FieldSchema, DataType, utility

# ─── TUNE THESE ────────────────────────────────────────────────────────────────
BATCH_SIZE  = int(os.getenv("BATCH_SIZE", 20))    # try 40 instead of 20
MAX_WORKERS = int(os.getenv("MAX_WORKERS", 4))    # more threads
# ────────────────────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Paths + model
MODEL_DIR  = os.getenv("MODEL_DIR", "/app/models")
MODEL_NAME = "best_front_back_model_convnext_82.3_88.19.pth"
model_path = Path(MODEL_DIR)/MODEL_NAME

load_dotenv()
DATABASE_URL = "postgresql://postgres:L;0q%CUXb223(!J`>9JNX6~@fynds.crq8ooq0qrgr.ap-southeast-2.rds.amazonaws.com:5432/fynds"
engine        = create_engine(DATABASE_URL)
Session       = sessionmaker(bind=engine)
Base          = declarative_base()

# Load models once
device = "cuda" if torch.cuda.is_available() else "cpu"
classifier_transform = transforms.Compose([
    transforms.Resize((224,224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225])
])
def load_front_back_model(path):
    m = convnext_tiny(weights=None)
    m.classifier[2] = nn.Linear(m.classifier[2].in_features,2)
    m.load_state_dict(torch.load(str(path), map_location=device))
    return m.to(device).eval()
front_back_model = load_front_back_model(model_path)

clip_model     = AutoModel.from_pretrained('Marqo/marqo-fashionCLIP').to(device)
clip_processor = AutoProcessor.from_pretrained('Marqo/marqo-fashionCLIP')
DIM            = 512

# Milvus setup once
MILVUS_HOST = os.getenv("MILVUS_HOST","localhost")
MILVUS_PORT = os.getenv("MILVUS_PORT","19530")
connections.connect(host=MILVUS_HOST, port=MILVUS_PORT)

COL_F = Collection("fashion_front")
COL_B = Collection("fashion_back")
COL_T = Collection("fashion_text")

for coll in (COL_F, COL_B, COL_T):
    if not utility.has_collection(coll.name):
        # create schema+index
        schema = CollectionSchema([
            FieldSchema("id", DataType.INT64, is_primary=True, auto_id=False),
            FieldSchema("embedding", DataType.FLOAT_VECTOR, dim=DIM)
        ])
        coll = Collection(name=coll.name, schema=schema)
        coll.create_index("embedding",
            {"index_type":"IVF_FLAT","metric_type":"COSINE","params":{"nlist":128}})
    coll.load()
    logger.info(f"Collection '{coll.name}' loaded, {coll.num_entities} existing vectors")

# SQLAlchemy models
class ProductItem(Base):
    __tablename__="ProductItem"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    frontEmbeddingId = Column(Integer, nullable=True)
    backEmbeddingId  = Column(Integer, nullable=True)
    textEmbeddingId  = Column(Integer, nullable=True)
    productImages = relationship("ProductImage", back_populates="clothingItem", lazy="selectin")

class ProductImage(Base):
    __tablename__="ProductImage"
    id = Column(Integer, primary_key=True)
    productItemId = Column(Integer,ForeignKey("ProductItem.id"))
    imageUrl = Column(String)
    frontFacing = Column(Boolean,nullable=True)
    clothingItem = relationship("ProductItem", back_populates="productImages")

# Async fetch
async def fetch_image(session, url: str):
    if url.startswith("//"):
        url = "https:" + url

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/114.0.0.0 Safari/537.36"
        )
    }

    try:
        async with session.get(url, headers=headers, timeout=10) as resp:
            ctype = resp.headers.get("Content-Type", "")
            if not ctype.startswith("image/"):
                # not an image, bail early
                raise ValueError(f"Not an image: {ctype}")

            data = await resp.read()
            return Image.open(BytesIO(data)).convert("RGB")

    except Exception as e:
        logger.warning(f"Fetch error {url}: {e}")
        return None


async def fetch_images(session, urls):
    return await asyncio.gather(*(fetch_image(session,u) for u in urls))

# Classify + embed
def classify_front_back(img):
    t=classifier_transform(img).unsqueeze(0).to(device)
    with torch.no_grad(): out=front_back_model(t)
    p=torch.nn.functional.softmax(out,1)[0]
    return ("front",float(p[0])) if p[0]>p[1] else ("back",float(p[1]))

def batch_embed(images, texts):
    img_in=clip_processor(images=images,return_tensors="pt",padding=True).to(device)
    txt_in=clip_processor(text=texts,return_tensors="pt",padding=True).to(device)
    with torch.no_grad():
        ie=clip_model.get_image_features(**img_in)
        te=clip_model.get_text_features(**txt_in)
    ie=(ie/ie.norm(-1,keepdim=True)).cpu().numpy()
    te=(te/te.norm(-1,keepdim=True)).cpu().numpy()
    return ie, te

# Process one batch
def process_batch(ids, idx):
    session=Session()
    loop=asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    async def runner():
        front_ids,front_vecs=[],[]
        back_ids, back_vecs=[],[]
        text_ids, text_vecs=[],[]

        async with aiohttp.ClientSession() as http_sess:
            for item_id in ids:
                item=session.get(ProductItem,item_id,options=[selectinload(ProductItem.productImages)])
                if not item: continue

                imgs=await fetch_images(http_sess,[img.imageUrl for img in item.productImages])
                buckets={"front":[],"back":[]}
                for rec,img in zip(item.productImages,imgs):
                    if not img: continue
                    lbl,_=classify_front_back(img)
                    rec.frontFacing=(lbl=="front")
                    session.add(rec)
                    buckets[lbl].append(img)

                vids=[]; chosen=[]
                if buckets["front"]:
                    vids.append(item.id*2-1)
                    chosen.append(buckets["front"][0])
                    item.frontEmbeddingId=vids[-1]
                if buckets["back"]:
                    vids.append(item.id*2)
                    chosen.append(buckets["back"][0])
                    item.backEmbeddingId=vids[-1]

                if chosen:
                    texts=[item.name]*len(chosen)
                    ie,te=batch_embed(chosen,texts)
                    for emb,vid in zip(ie,vids):
                        if vid%2: front_ids.append(vid); front_vecs.append(emb.tolist())
                        else:       back_ids.append(vid);  back_vecs.append(emb.tolist())
                    if te.shape[0]:
                        text_ids.append(item.id); text_vecs.append(te[0].tolist())
                        item.textEmbeddingId=item.id

                session.add(item)

            # bulk inserts
            if front_ids: COL_F.insert([front_ids, front_vecs]); COL_F.flush()
            if back_ids:  COL_B.insert([back_ids, back_vecs]);  COL_B.flush()
            if text_ids:  COL_T.insert([text_ids, text_vecs]);  COL_T.flush()

            session.commit()

    try:
        loop.run_until_complete(runner())
        logger.info(f"Batch {idx} done ({len(ids)} items)")
    except Exception as e:
        session.rollback(); logger.error(f"Batch {idx} error: {e}")
    finally:
        loop.close(); session.close()
        if torch.cuda.is_available(): torch.cuda.empty_cache()

# Main
def main():
    session=Session()
    ids=[r[0] for r in session.query(ProductItem.id).filter(
        ProductItem.frontEmbeddingId==None,
        ProductItem.backEmbeddingId==None,
        ProductItem.textEmbeddingId==None
    ).all()]
    session.close()

    batches=[ids[i:i+BATCH_SIZE] for i in range(0,len(ids),BATCH_SIZE)]
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as exe:
        for idx, b in enumerate(batches, start=1):
            exe.submit(process_batch, b, idx)

if __name__=="__main__":
    main()
