import faiss
import numpy as np
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

# --- FAISS Constants ---
DIM = 512
TOP_K = 50
SIMILARITY_THRESHOLD = 0.75

# --- Load FAISS Indexes ---
front_index = faiss.read_index("faiss_front.index")
back_index = faiss.read_index("faiss_back.index")
text_index = faiss.read_index("faiss_text.index")

# --- Load Saved Embeddings ---
front_vectors = np.load("faiss_front_vectors.npy", allow_pickle=True).item()
back_vectors = np.load("faiss_back_vectors.npy", allow_pickle=True).item()
text_vectors = np.load("faiss_text_vectors.npy", allow_pickle=True).item()

# --- SQLAlchemy Setup ---
DATABASE_URL = "postgresql://postgres:L;0q%CUXb223(!J`>9JNX6~@fynds.crq8ooq0qrgr.ap-southeast-2.rds.amazonaws.com:5432/fynds"
Base = declarative_base()

class ProductItem(Base):
    __tablename__ = "ProductItem"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    url = Column(String)
    frontEmbeddingId = Column(Integer)
    backEmbeddingId = Column(Integer)
    textEmbeddingId = Column(Integer)

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

# --- Similarity Function ---
def cosine_similarity(v1, v2):
    return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))

# --- Main Similarity Search ---
def search_similar(product_id):
    item = session.get(ProductItem, product_id)
    if not item:
        print(f"❌ Product ID {product_id} not found.")
        return []

    front_vec = front_vectors.get(product_id)
    back_vec = back_vectors.get(product_id)
    text_vec = text_vectors.get(product_id)

    similarities = {}

    def query(label, query_vec, index, vector_store, is_text=False):
        if query_vec is None:
            return
        query_vec = np.array(query_vec).reshape(1, DIM).astype('float32')
        D, I = index.search(query_vec, TOP_K)
        for dist, idx in zip(D[0], I[0]):
            if idx == -1:
                continue
            sim = 1 - dist / 2
            similar_id = idx if is_text else (idx + 1) // 2
            if similar_id == product_id:
                continue
            if similar_id not in similarities:
                similarities[similar_id] = {"include": False}
            similarities[similar_id][label] = sim
            if sim >= SIMILARITY_THRESHOLD:
                similarities[similar_id]["include"] = True

    # --- Run queries
    query("front", front_vec, front_index, front_vectors)
    query("back", back_vec, back_index, back_vectors)
    query("text", text_vec, text_index, text_vectors, is_text=True)

    # --- Fill missing scores manually if item is already included (testing purposes to see front, back and text similarity)
    for sid in similarities:
        if not similarities[sid].get("include"):
            continue
        q_front = front_vectors.get(product_id)
        q_back = back_vectors.get(product_id)
        q_text = text_vectors.get(product_id)

        t_front = front_vectors.get(sid)
        t_back = back_vectors.get(sid)
        t_text = text_vectors.get(sid)

        if "front" not in similarities[sid] and q_front is not None and t_front is not None:
            similarities[sid]["front"] = cosine_similarity(q_front, t_front)
        if "back" not in similarities[sid] and q_back is not None and t_back is not None:
            similarities[sid]["back"] = cosine_similarity(q_back, t_back)
        if "text" not in similarities[sid] and q_text is not None and t_text is not None:
            similarities[sid]["text"] = cosine_similarity(q_text, t_text)

    # --- Print results
    print(f"\n✅ Found {len([sid for sid in similarities if similarities[sid].get('include')])} similar products (similarity ≥ {SIMILARITY_THRESHOLD}):")
    for sid, sim_dict in similarities.items():
        if not sim_dict.get("include"):
            continue
        prod = session.get(ProductItem, int(sid))
        print(f"\nID: {sid} | Link: {prod.url if prod and prod.url else '—'}")
        print(f"  → Front Similarity: {sim_dict.get('front', '—')}")
        print(f"  → Back  Similarity: {sim_dict.get('back', '—')}")
        print(f"  → Text  Similarity: {sim_dict.get('text', '—')}")

    return [sid for sid in similarities if similarities[sid].get("include")]



# --- CLI ---
if __name__ == "__main__":
    pid = int(input("🔍 Enter Product ID to find similar: "))
    similar = search_similar(pid)
    print(f"\n✅ Found {len(similar)} similar products (similarity ≥ {SIMILARITY_THRESHOLD}):")
    print([int(x) for x in similar])
