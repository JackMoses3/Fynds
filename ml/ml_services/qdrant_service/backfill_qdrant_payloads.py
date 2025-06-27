from qdrant_client import QdrantClient
from qdrant_client.http.models import PointStruct
import os
import psycopg2

QDRANT_URL = "http://54.79.38.226:6333"
client = QdrantClient(url=QDRANT_URL)
collections = ["IMAGE_FRONT_EMBEDDINGS", "IMAGE_BACK_EMBEDDINGS", "TEXT_EMBEDDINGS"]
primary_collection = "IMAGE_FRONT_EMBEDDINGS"  # Only scroll this one

def get_metadata_from_db(product_id):
    import psycopg2
    import os 

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL environment variable not set")

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            # Fetch main product fields
            cur.execute("""
                SELECT
                    id,
                    price,
                    category,
                    sex,
                    brand,
                    retailer
                FROM "ProductItem"
                WHERE id = %s
            """, (product_id,))
            row = cur.fetchone()
            if not row:
                print(f"ProductItem {product_id} not found in DB")
                return None

            pid, price, category, sex, brand, retailer = row

            # Fetch style names (can be empty)
            cur.execute("""
                SELECT s.name
                FROM "ProductStyle" ps
                JOIN "Style" s ON ps."styleId" = s.id
                WHERE ps."productItemId" = %s
            """, (product_id,))
            styles = [r[0] for r in cur.fetchall()]

            payload = {
                "product_id": pid,
                "style": styles,
                "price": price,
                "category": [category] if category else [],
                "gender": [sex] if sex else [],
                "brand": [brand] if brand else [],
                "retailer": [retailer] if retailer else [],
            }
            return payload
    finally:
        conn.close()

processed_ids = set()

# Step 1: Process primary collection
print(f"Scanning {primary_collection} for points with missing payloads...")
offset = None
while True:
    points, next_offset = client.scroll(
        collection_name=primary_collection,
        with_payload=True,
        with_vectors=False,
        offset=offset,
        limit=1000
    )
    for point in points:
        if not point.payload:
            product_id = point.id
            meta = get_metadata_from_db(product_id)
            if meta:
                for collection in collections:
                    points_found = client.retrieve(
                        collection_name=collection,
                        ids=[product_id],
                        with_payload=False,
                        with_vectors=False
                    )
                    if points_found:
                        client.set_payload(
                            collection_name=collection,
                            payload=meta,
                            points=[product_id]
                        )
                        print(f"Added payload for id={product_id} in {collection}")
            processed_ids.add(product_id)
    if not next_offset:
        break
    offset = next_offset

# Step 2: Process other collections for IDs not already processed
for collection in collections:
    if collection == primary_collection:
        continue
    print(f"Scanning {collection} for unique points with missing payloads...")
    offset = None
    while True:
        points, next_offset = client.scroll(
            collection_name=collection,
            with_payload=True,
            with_vectors=False,
            offset=offset,
            limit=1000
        )
        for point in points:
            product_id = point.id
            if not point.payload and product_id not in processed_ids:
                meta = get_metadata_from_db(product_id)
                if meta:
                    client.set_payload(
                        collection_name=collection,
                        payload=meta,
                        points=[product_id]
                    )
                    print(f"Added payload for id={product_id} in {collection}")
        if not next_offset:
            break
        offset = next_offset