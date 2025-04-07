#from embedding.embedding_model import EmbeddingInput;
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
clip_model = AutoModel.from_pretrained('Marqo/marqo-fashionCLIP', trust_remote_code=True)
clip_processor = AutoProcessor.from_pretrained('Marqo/marqo-fashionCLIP', trust_remote_code=True)

# --- Setup ---
# Point to the Docker-specific env file
dotenv_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=dotenv_path)

DATABASE_URL = os.getenv("DATABASE_URL")
device = 'cpu'
Base = declarative_base()

# --- Marqo client (ensure Marqo is running locally or hosted)
mq = Client(url="http://localhost:8882")  # Update if using hosted Marqo

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
    # Get absolute path relative to this file
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

# --- Utility Functions ---
def classify_front_or_back(image_url):
    try:
        resp = requests.get(image_url, timeout=10)
        resp.raise_for_status()
        img = Image.open(BytesIO(resp.content)).convert('RGB')
        tensor_img = classifier_transform(img).unsqueeze(0).to(device)
        with torch.no_grad():
            outputs = front_back_model(tensor_img)
            _, predicted = torch.max(outputs, 1)
        return ['front', 'back'][predicted.item()]  # 0 = front, 1 = back
    except Exception as e:
        print(f"Failed to classify image {image_url}: {e}")
        return 'front'

def create_clip_embedding(image_url):
    try:
        if image_url.startswith('//'):
            image_url = 'https:' + image_url

        response = requests.get(image_url, timeout=10)
        response.raise_for_status()

        img = Image.open(BytesIO(response.content)).convert("RGB")
        inputs = clip_processor(images=img, return_tensors="pt")
        pixel_values = inputs['pixel_values'].to(device)

        with torch.no_grad():
            image_emb = clip_model.get_image_features(pixel_values)

        return image_emb.cpu().numpy().flatten().astype("float32")

    except Exception as e:
        print(f"❌ Error generating FashionCLIP embedding: {e}")
        return None




def generate_faiss_id():
    return uuid.uuid4().int >> 65

# --- Main Pipeline ---
def process():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    items = session.query(ProductItem).all()

    for item in items:
        print(f"🔍 Processing item {item.id} - {item.name}")

        for img in item.productImages:
            label = classify_front_or_back(img.imageUrl)

            is_front = label == "front"
            img.frontFacing = is_front
            session.add(img)

            # FRONT embedding
            if is_front and item.frontEmbeddingId is None:
                emb = create_clip_embedding(img.imageUrl)
                if emb is not None:
                    vector_id = generate_faiss_id()
                    front_index.add_with_ids(np.array([emb]), np.array([vector_id], dtype="int64"))
                    item.frontEmbeddingId = vector_id

            # BACK embedding
            if not is_front and item.backEmbeddingId is None:
                emb = create_clip_embedding(img.imageUrl)
                if emb is not None:
                    vector_id = generate_faiss_id()
                    back_index.add_with_ids(np.array([emb]), np.array([vector_id], dtype="int64"))
                    item.backEmbeddingId = vector_id

        session.add(item)
        session.commit()
        print(f"✅ Updated embeddings for item {item.id}")

    # Save the FAISS indexes to disk
    faiss.write_index(front_index, "faiss_front.index")
    faiss.write_index(back_index, "faiss_back.index")

    session.close()

# --- Entry Point ---
if __name__ == "__main__":
    process()





#def generate_embeddings(data: EmbeddingInput):
   # """
   # Generate embeddings for the given input data.
   # """
    # Here you would call your embedding generation logic
    # For example:
    # embedding = generate_embedding_logic(data)
    
    # For now, let's just return the input data as a placeholder
  #  return data