# ml/qdrant/init_collections.py
from qdrant_client import QdrantClient
from qdrant_client.http import models

def create_collections():
    client = QdrantClient(url="http://localhost:6333")

    # Common HNSW index parameters
    hnsw_config = models.HnswConfigDiff(
        m=16,
        ef_construct=200,
        full_scan_threshold=10000
    )

    # 1. text_embeddings
    client.recreate_collection(
        collection_name="text_embeddings",
        vectors_config=models.VectorParams(
            size=512,
            distance=models.Distance.COSINE,
            hnsw_config=hnsw_config,
        ),
    )

    # 2. image_front_embeddings
    client.recreate_collection(
        collection_name="image_front_embeddings",
        vectors_config=models.VectorParams(
            size=512,
            distance=models.Distance.COSINE,
            hnsw_config=hnsw_config,
        ),
    )

    # 3. image_back_embeddings
    client.recreate_collection(
        collection_name="image_back_embeddings",
        vectors_config=models.VectorParams(
            size=512,
            distance=models.Distance.COSINE,
            hnsw_config=hnsw_config,
        ),
    )


    print("✅ Collections created successfully.")

if __name__ == "__main__":
    create_collections()