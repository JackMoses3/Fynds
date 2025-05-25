# ml/front_back_text_similarity/text_to_image.py

import os
import faiss
import numpy as np
import torch
from transformers import AutoModel, AutoProcessor
from typing import List, Tuple

# ── CONFIG: file paths live in the ml/ folder ──
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
front_index = faiss.read_index("faiss_front.index")
back_index  = faiss.read_index("faiss_back.index")
text_index  = faiss.read_index("faiss_text.index")

FRONT_VECS_PATH = np.load("faiss_front_vectors.npy", allow_pickle=True).item()
BACK_VECS_PATH  = np.load("faiss_back_vectors.npy", allow_pickle=True).item()
TEXT_VECS_PATH  = np.load("faiss_text_vectors.npy", allow_pickle=True).item()

# ── 1) Load model & processor ──
model = AutoModel.from_pretrained(
    "Marqo/marqo-fashionCLIP", trust_remote_code=True
)
processor = AutoProcessor.from_pretrained(
    "Marqo/marqo-fashionCLIP", trust_remote_code=True
)
device = "cpu"  # switch to "cuda" if you have a GPU
model.to(device)

# ── (Optional) load raw vector dicts if needed ──
# faiss_front_vectors = np.load(FRONT_VECS_PATH, allow_pickle=True).item()
# faiss_back_vectors  = np.load(BACK_VECS_PATH, allow_pickle=True).item()
# faiss_text_vectors  = np.load(TEXT_VECS_PATH, allow_pickle=True).item()

# ── Helper: map FAISS IDs back to your product IDs ──
def get_product_id_from_embedding_id(idx: int, label: str) -> int:
    if label == "text":
        return idx
    elif label == "front":
        return (idx + 1) // 2
    elif label == "back":
        return idx // 2
    else:
        raise ValueError(f"Unknown label: {label}")

# ── Core query function ──
def run_query(query_text: str, k: int = 50) -> List[Tuple[int, float]]:
    # 1) Tokenize & encode
    inputs = processor(
        text=[query_text],
        return_tensors="pt",
        padding="max_length",
        truncation=True,
        max_length=77,
    )
    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        text_emb = model.get_text_features(**inputs)
        text_emb = text_emb / text_emb.norm(p=2, dim=-1, keepdim=True)

    # 2) to numpy
    query_vector = text_emb.cpu().numpy().astype("float32")

    # 3) search both indexes
    Df, If = front_index.search(query_vector, k)
    Db, Ib = back_index.search(query_vector, k)

    # 4) map to product IDs
    front_matches = [
        (get_product_id_from_embedding_id(idx, "front"), float(dist))
        for idx, dist in zip(If[0], Df[0])
    ]
    back_matches = [
        (get_product_id_from_embedding_id(idx, "back"), float(dist))
        for idx, dist in zip(Ib[0], Db[0])
    ]

    # 5) Combine, sort, and dedupe
    combined = front_matches + back_matches
    # Sort in ascending distance
    combined.sort(key=lambda x: x[1])

    seen = set()
    unique_matches: List[Tuple[int, float]] = []
    for pid, dist in combined:
        if pid not in seen:
            seen.add(pid)
            unique_matches.append((pid, dist))

    return unique_matches #product id, distance


# ── CLI entrypoint for quick local testing ──
if __name__ == "__main__":
    q = input("Please enter your query: ")
    results = run_query(q, k=50)
    print(f"\n🔍 Top text-to-image matches for: '{q}'\n")
    for pid, dist in results:
        print(f"Product ID: {pid}, Similarity Distance: {dist:.4f}")
