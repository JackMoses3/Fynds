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
from torchvision.models import resnet34
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from marqo import Client
from dotenv import load_dotenv
from pathlib import Path
from transformers import AutoModel, AutoProcessor
import re

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
    textEmbeddingId = Column(Integer, nullable=True)
    category = Column(String, nullable=True)
    subCategory = Column(String, nullable=True)
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

def load_front_back_model(model_path="best_front_back_model_50.pth"):
    abs_path = os.path.join(os.path.dirname(__file__), model_path)
    model = resnet34(pretrained=False)
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

#gets rid of these words from product description, as can only query 77 tokens.  
STOPWORDS = {
    'a', 'an', 'the', 'and', 'or', 'with', 'to', 'for', 'of', 'on', 'in', 'it', 'this', 'that', 'from', 'as',
    'its', 'is', 'are', 'be', 'by', 'at', 'your', 'into', 'their', 'was', 'has', 'have', 'will'
}

def clean_text(text):
    text = re.sub(r"[^\w\s]", "", text)
    filtered = [word for word in text.split() if word.lower() not in STOPWORDS]
    return " ".join(filtered).lower()

def generate_text_prompt(item):
    """generates string used to categorise the product"""
    name = item.name or ""
    brand = item.brand or ""
    meta = item.metaData or ""
    combined = f"{name}. {brand}. {meta}"
    cleaned = clean_text(combined)
    return cleaned

def generate_text_emb_info(item):
    """generates string used to create text embedding"""
    meta = item.metaData or ""
    cleaned = clean_text(meta)
    return cleaned

def match_keywords(text, keywords):
    return any(kw in text for kw in keywords)

def categorize(name, text):
    """Categorizes items. Uses name then text prompt. If name not found then lokos through text prompt"""
    name = name.lower()
    text = text.lower()

    def try_match(source):
        # --- T-Shirts ---
        if match_keywords(source, ["t-shirts", "tshirt", "tee", "tees"]):
            if match_keywords(text, ["long sleeve", "long"]):
                return "T-Shirts", "Long Sleeve T-Shirts"
            if match_keywords(text, ["graphic", "graphics", "print", "prints"]):
                return "T-Shirts", "Graphic T-Shirts"
            if match_keywords(text, ["basic", "basics", "plain", "plains"]):
                return "T-Shirts", "Basic T-Shirts"
            if match_keywords(text, ["logo", "logos"]):
                return "T-Shirts", "Logo T-Shirts"
            return "T-Shirts", "Uncategorized"

        # --- Shirts ---
        if match_keywords(source, ["shirt", "shirts"]):
            if match_keywords(text, ["long sleeve", "long"]):
                return "Shirts", "Long Sleeve Shirts"
            if match_keywords(text, ["short sleeve", "short"]):
                return "Shirts", "Short Sleeve Shirts"
            if match_keywords(text, ["polo", "polo shirts"]):
                return "Shirts", "Polo Shirts"
            return "Shirts", "Uncategorized"

        # --- Shorts ---
        if match_keywords(source, ["shorts"]):
            if match_keywords(text, ["denim", "jorts"]):
                return "Shorts", "Jorts & Denim Shorts"
            if match_keywords(text, ["cargo"]):
                return "Shorts", "Cargo Shorts"
            if match_keywords(text, ["linen"]):
                return "Shorts", "Linen"
            if match_keywords(text, ["high waisted"]):
                return "Shorts", "High Waisted Shorts"
            if match_keywords(text, ["tailored"]):
                return "Shorts", "Tailored Shorts"
            if match_keywords(text, ["skort", "skorts"]):
                return "Shorts", "Skorts"
            return "Shorts", "Uncategorized"

        # --- Pants ---
        if match_keywords(source, ["pants"]):
            if match_keywords(text, ["cargo"]):
                return "Pants", "Cargo Pants"
            if match_keywords(text, ["track", "trackpants", "sweatpants"]):
                return "Pants", "Track Pants"
            if match_keywords(text, ["tailored"]):
                return "Pants", "Tailored Pants"
            return "Pants", "Uncategorized"

        # --- Chinos ---
        if match_keywords(source, ["chino", "chinos"]):
            return "Chinos", "Chinos"

        # --- Jeans ---
        if match_keywords(source, ["jeans"]):
            if match_keywords(text, ["baggy", "loose"]):
                return "Jeans", "Baggy & Loose Jeans"
            if match_keywords(text, ["straight"]):
                return "Jeans", "Straight Jeans"
            if match_keywords(text, ["skinny"]):
                return "Jeans", "Skinny Jeans"
            if match_keywords(text, ["wide leg"]):
                return "Jeans", "Wide Leg Jeans"
            if match_keywords(text, ["utility"]):
                return "Jeans", "Utility Jeans"
            if match_keywords(text, ["slim"]):
                return "Jeans", "Slim Jeans"
            if match_keywords(text, ["low rise"]):
                return "Jeans", "Low Rise Jeans"
            if match_keywords(text, ["high rise"]):
                return "Jeans", "High Rise Jeans"
            return "Jeans", "Uncategorized"

        # --- Hoodies, Sweats & Jumpers ---
        if match_keywords(source, ["hoodie", "hoodies", "jumper", "jumpers", "zip", "knit", "cardigan", "jersey", "hood", "sweat", "sweater"]):
            if match_keywords(text, ["hoodie"]):
                return "Hoodies, Sweats & Jumpers", "Hoodies"
            if match_keywords(text, ["jumper"]):
                return "Hoodies, Sweats & Jumpers", "Jumpers"
            if match_keywords(text, ["zip"]):
                return "Hoodies, Sweats & Jumpers", "Zip Ups"
            if match_keywords(text, ["knit"]):
                return "Hoodies, Sweats & Jumpers", "Knit Jumpers"
            if match_keywords(text, ["cardigan"]):
                return "Hoodies, Sweats & Jumpers", "Cardigans"
            return "Hoodies, Sweats & Jumpers", "Uncategorized"

        # --- Jackets & Coats ---
        if match_keywords(source, ["jacket", "jackets", "coat", "coats"]):
            return "Jackets & Coats", "Jackets & Coats"

        # --- Dresses ---
        if match_keywords(source, ["dress", "dresses"]):
            if match_keywords(text, ["maxi"]):
                return "Dresses", "Maxi Dresses"
            if match_keywords(text, ["midi"]):
                return "Dresses", "Midi Dresses"
            if match_keywords(text, ["mini"]):
                return "Dresses", "Mini Dresses"
            if match_keywords(text, ["formal", "party", "event"]):
                return "Dresses", "Party, Event & Formal Dresses"
            return "Dresses", "Uncategorized"

        # --- Tops ---
        if match_keywords(source, ["top", "tops"]):
            return "Tops", "Tops"

        # --- Skirts ---
        if match_keywords(source, ["skirt", "skirts"]):
            if match_keywords(text, ["mini"]):
                return "Skirts", "Mini Skirts"
            if match_keywords(text, ["midi"]):
                return "Skirts", "Midi Skirts"
            if match_keywords(text, ["maxi"]):
                return "Skirts", "Maxi Skirts"
            if match_keywords(text, ["cargo"]):
                return "Skirts", "Cargo Skirts"
            if match_keywords(text, ["denim"]):
                return "Skirts", "Denim Skirts"
            if match_keywords(text, ["skort"]):
                return "Skirts", "Skort"
            return "Skirts", "Uncategorized"

        return None

    # First try with item.name
    result = try_match(name)
    if result:
        return result

    # Fallback: try full text instead
    result = try_match(text)
    if result:
        return result

    return "Uncategorized", "Uncategorized"



# --- Embedding Function ---
def create_combined_clip_embedding_debug(image_url, text_description):
    try:
        if image_url.startswith('//'):
            image_url = 'https:' + image_url

        response = requests.get(image_url, timeout=10)
        response.raise_for_status()
        img = Image.open(BytesIO(response.content)).convert("RGB")

        # --- TEXT EMBEDDING ---
        text_emb = None
        if text_description and text_description.strip():  # Check if not empty or just whitespace
            text_inputs = clip_processor(
                text=[text_description],
                return_tensors="pt",
                padding="max_length",
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


def classify_front_or_back_with_score(image_url):
    """classifies an image as front or back facing. Returns label and confidence its back
    .99 indicates high likely hood it is back, .01 indicates low likely hood it is back (99% likely front), hence here label
    will be front"""
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

def generate_faiss_id(id, label):
    return id + id - 1 if label == 'front' else 2 * id

# --- Main Pipeline ---
# This is a revised process function that:
# 1. Builds FAISS indexes
# 2. Stores all embeddings (front, back, text) in a dictionary for later querying
# 3. Saves those vectors to .npy files so they can be reloaded in future scripts

# Global in-memory vector stores
faiss_front_vectors = {}
faiss_back_vectors = {}
faiss_text_vectors = {}


def process():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    #filter for item where front emb, back emb and text emb is none (i.e not yet processed)
    items = session.query(ProductItem)\
        .filter(
            ProductItem.frontEmbeddingId == None,
            ProductItem.backEmbeddingId == None,
            ProductItem.textEmbeddingId == None
        )\
        .order_by(ProductItem.id.asc())\
        .all()


    for item in items:
        print(f"🔍 Processing item {item.id} - {item.name}")
        text_prompt = generate_text_prompt(item) #used for categorising
        text_emb_info = generate_text_emb_info(item) #used for text embedding (name and retailer not included, as if no metadata should have no text emb)
        category, subcategory = categorize(item.name, text_prompt)
        item.category = category
        item.subCategory = subcategory

        text_emb_added = False
        assigned_front = False
        assigned_back = False
        fallback_front_image = None
        fallback_back_image = None
        highest_back_conf = 0.0
        lowest_back_conf = float('inf')

        for img in item.productImages:
            label, back_conf = classify_front_or_back_with_score(img.imageUrl)
            is_front = label == "front"
            if back_conf <= 0.1 or back_conf >= 0.9: #sets to true or false if front or back and 95% sure
                img.frontFacing = is_front
            session.add(img)

            if is_front and back_conf < lowest_back_conf: 
                lowest_back_conf = back_conf
                fallback_front_image = img

            if not is_front and back_conf > highest_back_conf:
                fallback_back_image = img
                highest_back_conf = back_conf

            needs_embedding = (
                (is_front and item.frontEmbeddingId is None and back_conf <= 0.1) or
                (not is_front and item.backEmbeddingId is None and back_conf >= 0.9)
            )

            if needs_embedding:
                text_emb, image_emb = create_combined_clip_embedding_debug(img.imageUrl, text_emb_info)
                if image_emb is not None:
                    vector_id = generate_faiss_id(item.id, label)
                    text_id = item.id

                    index = front_index if is_front else back_index
                    index.add_with_ids(np.array([image_emb]), np.array([vector_id], dtype="int64"))

                    if is_front:
                        item.frontEmbeddingId = vector_id
                        faiss_front_vectors[item.id] = image_emb
                        assigned_front = True
                    else:
                        item.backEmbeddingId = vector_id
                        faiss_back_vectors[item.id] = image_emb
                        assigned_back = True

                    if not text_emb_added and text_emb is not None:
                        text_index.add_with_ids(np.array([text_emb]), np.array([text_id], dtype="int64"))
                        item.textEmbeddingId = text_id
                        faiss_text_vectors[item.id] = text_emb
                        text_emb_added = True

        # Fallback for front
        if not assigned_front and fallback_front_image:
            print(f"⚠️ Using fallback front image for item {item.id}")
            fallback_front_image.frontFacing = True
            text_emb, image_emb = create_combined_clip_embedding_debug(fallback_front_image.imageUrl, text_emb_info)
            if image_emb is not None:
                vector_id = generate_faiss_id(item.id, 'front')
                front_index.add_with_ids(np.array([image_emb]), np.array([vector_id], dtype="int64"))
                item.frontEmbeddingId = vector_id
                faiss_front_vectors[item.id] = image_emb
                if not text_emb_added and text_emb is not None:
                    text_index.add_with_ids(np.array([text_emb]), np.array([item.id], dtype="int64"))
                    item.textEmbeddingId = item.id
                    faiss_text_vectors[item.id] = text_emb

        # Fallback for back
        if not assigned_back and fallback_back_image:
            fallback_back_image.frontFacing = False
            print(f"⚠️ Using fallback back image for item {item.id}")
            text_emb, image_emb = create_combined_clip_embedding_debug(fallback_back_image.imageUrl, text_emb_info)
            if image_emb is not None:
                vector_id = generate_faiss_id(item.id, 'back')
                back_index.add_with_ids(np.array([image_emb]), np.array([vector_id], dtype="int64"))
                item.backEmbeddingId = vector_id
                faiss_back_vectors[item.id] = image_emb
                if not text_emb_added and text_emb is not None:
                    text_index.add_with_ids(np.array([text_emb]), np.array([item.id], dtype="int64"))
                    item.textEmbeddingId = item.id
                    faiss_text_vectors[item.id] = text_emb

        session.add(item)
        session.commit()

        if item.id % 500 == 0: #save every 500 incase of crash
            print("📏 Saving FAISS indexes after 500 items...")
            faiss.write_index(front_index, "faiss_front.index")
            faiss.write_index(back_index, "faiss_back.index")
            faiss.write_index(text_index, "faiss_text.index")
            np.save("faiss_front_vectors.npy", faiss_front_vectors)
            np.save("faiss_back_vectors.npy", faiss_back_vectors)
            np.save("faiss_text_vectors.npy", faiss_text_vectors)

        print(f"✅ Updated embeddings for item {item.id}")

    faiss.write_index(front_index, "faiss_front.index")
    faiss.write_index(back_index, "faiss_back.index")
    faiss.write_index(text_index, "faiss_text.index")
    np.save("faiss_front_vectors.npy", faiss_front_vectors)
    np.save("faiss_back_vectors.npy", faiss_back_vectors)
    np.save("faiss_text_vectors.npy", faiss_text_vectors)
    session.close()


if __name__ == "__main__":
    process()

