import os
import uuid
import requests
import torch
import faiss
import numpy as np
from PIL import Image
from io import BytesIO
from datetime import datetime
from torchvision import models, transforms
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from marqo import Client
from dotenv import load_dotenv
from pathlib import Path
from transformers import AutoModel, AutoProcessor

# --- Load Model ---
clip_model = AutoModel.from_pretrained('Marqo/marqo-fashionCLIP', trust_remote_code=True)
clip_processor = AutoProcessor.from_pretrained('Marqo/marqo-fashionCLIP', trust_remote_code=True)

# --- Setup ---
dotenv_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=dotenv_path)
DATABASE_URL = os.getenv("DATABASE_URL")
device = 'cpu'
Base = declarative_base()
mq = Client(url="http://localhost:8882")

# --- SQLAlchemy Models ---
class ProductItem(Base):
    __tablename__ = "ProductItem"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    url = Column(String)
    metaData = Column(String)
    sex = Column(String)
    brand = Column(String)
    retailer = Column(String)
    price = Column(Float)
    frontEmbeddingId = Column(Integer, nullable=True)
    backEmbeddingId = Column(Integer, nullable=True)
    frontTextEmbeddingId = Column(Integer, nullable=True)
    backTextEmbeddingId = Column(Integer, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    productImages = relationship("ProductImage", back_populates="clothingItem")

class ProductImage(Base):
    __tablename__ = "ProductImage"
    id = Column(Integer, primary_key=True)
    productItemId = Column(Integer, ForeignKey("ProductItem.id"))
    imageUrl = Column(String)
    frontFacing = Column(Boolean, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    clothingItem = relationship("ProductItem", back_populates="productImages")

# --- Front/Back Classifier ---
classifier_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

def load_front_back_model(model_path="front_back_model.pth"):
    abs_path = os.path.join(os.path.dirname(__file__), model_path)
    model = models.resnet18(pretrained=False)
    model.fc = torch.nn.Linear(512, 2)
    model.load_state_dict(torch.load(abs_path, map_location=device))
    model.to(device)
    model.eval()
    return model

front_back_model = load_front_back_model()

# --- FAISS Setup ---
DIM = 512
front_index = faiss.IndexIDMap(faiss.IndexFlatL2(DIM))
back_index = faiss.IndexIDMap(faiss.IndexFlatL2(DIM))
text_index = faiss.IndexIDMap(faiss.IndexFlatL2(DIM))

# --- Helper Functions ---
def classify_front_or_back_with_score(image_url):
    try:
        if not image_url.startswith("http"):
            image_url = "https:" + image_url
        resp = requests.get(image_url, timeout=10)
        resp.raise_for_status()
        img = Image.open(BytesIO(resp.content)).convert('RGB')
        tensor_img = classifier_transform(img).unsqueeze(0).to(device)
        with torch.no_grad():
            outputs = front_back_model(tensor_img)
            probs = torch.nn.functional.softmax(outputs, dim=1)
            confidence, predicted = torch.max(probs, 1)
        return ['front', 'back'][predicted.item()], probs[0, 1].item()
    except Exception as e:
        print(f"Failed to classify image {image_url}: {e}")
        return 'front', 0.0

def generate_text_prompt(item):
    parts = [item.name or "", item.brand or "", item.metaData or ""]
    return ". ".join([p.strip() for p in parts if p.strip()])

def create_combined_clip_embedding_debug(image_url, text_description):
    try:
        if image_url.startswith('//'):
            image_url = 'https:' + image_url

        response = requests.get(image_url, timeout=10)
        response.raise_for_status()
        img = Image.open(BytesIO(response.content)).convert("RGB")

        # --- TEXT EMBEDDING ---
        text_inputs = clip_processor(
            text=[text_description],
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=77
        )
        text_inputs = {k: v.to(device) for k, v in text_inputs.items()}
        with torch.no_grad():
            text_emb_tensor = clip_model.get_text_features(**text_inputs)
            text_emb_tensor = text_emb_tensor / text_emb_tensor.norm(p=2, dim=-1, keepdim=True)
        text_emb = text_emb_tensor.cpu().numpy().flatten().astype("float32")

        # --- IMAGE EMBEDDING ---
        image_inputs = clip_processor(images=[img], return_tensors="pt")
        image_inputs = {k: v.to(device) for k, v in image_inputs.items()}
        with torch.no_grad():
            image_emb_tensor = clip_model.get_image_features(**image_inputs)
            image_emb_tensor = image_emb_tensor / image_emb_tensor.norm(p=2, dim=-1, keepdim=True)
        image_emb = image_emb_tensor.cpu().numpy().flatten().astype("float32")

        return text_emb, image_emb

    except Exception as e:
        print(f"❌ Error generating embeddings: {e}")
        return None, None

def generate_faiss_id(id, label):
    return id + id - 1 if label == 'front' else 2 * id

# --- Main Pipeline ---
def process():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    items = session.query(ProductItem).all()

    for item in items:
        print(f"🔍 Processing item {item.id} - {item.name}")
        text_prompt = generate_text_prompt(item)

        for img in item.productImages:
            label, back_conf = classify_front_or_back_with_score(img.imageUrl)
            is_front = label == "front"
            img.frontFacing = is_front
            session.add(img)

            if (is_front and item.frontEmbeddingId is None and back_conf <= .05) or (not is_front and item.backEmbeddingId is None):
                text_emb, image_emb = create_combined_clip_embedding_debug(img.imageUrl, text_prompt)
                if image_emb is not None and text_emb is not None:
                    vector_id = generate_faiss_id(item.id, label)
                    text_id = item.id

                    # Add image embedding to front/back index
                    index = front_index if is_front else back_index
                    index.add_with_ids(np.array([image_emb]), np.array([vector_id], dtype="int64"))

                    # Add text embedding to text index
                    text_index.add_with_ids(np.array([text_emb]), np.array([text_id], dtype="int64"))

                    # Save vector IDs to DB
                    if is_front:
                        item.frontEmbeddingId = vector_id
                        item.frontTextEmbeddingId = vector_id
                    else:
                        item.backEmbeddingId = vector_id
                        item.backTextEmbeddingId = vector_id

        session.add(item)
        session.commit()
        print(f"✅ Updated embeddings for item {item.id}")

    faiss.write_index(front_index, "faiss_front.index")
    faiss.write_index(back_index, "faiss_back.index")
    faiss.write_index(text_index, "faiss_text.index")
    session.close()

if __name__ == "__main__":
    process()
