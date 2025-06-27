from qdrant_client import QdrantClient
import os
import psycopg2

QDRANT_URL = "http://54.79.38.226:6333"
client = QdrantClient(url=QDRANT_URL)
collections = ["IMAGE_FRONT_EMBEDDINGS", "IMAGE_BACK_EMBEDDINGS", "TEXT_EMBEDDINGS"]
primary_collection = "IMAGE_FRONT_EMBEDDINGS"
BATCH_SIZE = 100  # Tune this for your environment

def get_metadata_batch(product_ids):
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
                WHERE id = ANY(%s)
            """, (product_ids,))
            rows = cur.fetchall()
            product_map = {row[0]: row[1:] for row in rows}

            # Fetch styles for all product_ids in batch
            cur.execute("""
                SELECT ps."productItemId", s.name
                FROM "ProductStyle" ps
                JOIN "Style" s ON ps."styleId" = s.id
                WHERE ps."productItemId" = ANY(%s)
            """, (product_ids,))
            style_map = {}
            for pid, style_name in cur.fetchall():
                style_map.setdefault(pid, []).append(style_name)

            # Compose payloads
            payloads = {}
            for pid in product_ids:
                if pid not in product_map:
                    continue
                price, category, sex, brand, retailer = product_map[pid]
                styles = style_map.get(pid, [])
                payloads[pid] = {
                    "product_id": pid,
                    "style": styles,
                    "price": price,
                    "category": [category] if category else [],
                    "gender": [sex] if sex else [],
                    "brand": [brand] if brand else [],
                    "retailer": [retailer] if retailer else [],
                }
            return payloads
    finally:
        conn.close()

def process_collection(collection, processed_ids=None):
    print(f"Scanning {collection} for points with missing payloads...")
    offset = None
    batch_ids = []
    total_processed = 0
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
            if not point.payload and (processed_ids is None or product_id not in processed_ids):
                batch_ids.append(product_id)
                if len(batch_ids) >= BATCH_SIZE:
                    payloads = get_metadata_batch(batch_ids)
                    for pid, meta in payloads.items():
                        client.set_payload(
                            collection_name=collection,
                            payload=meta,
                            points=[pid]
                        )
                        print(f"Added payload for id={pid} in {collection}")
                    total_processed += len(payloads)
                    batch_ids = []
        if not next_offset:
            break
        offset = next_offset
    # Process any remaining in the last batch
    if batch_ids:
        payloads = get_metadata_batch(batch_ids)
        for pid, meta in payloads.items():
            client.set_payload(
                collection_name=collection,
                payload=meta,
                points=[pid]
            )
            print(f"Added payload for id={pid} in {collection}")
        total_processed += len(payloads)
    print(f"Done updating empty payloads for {total_processed} products in {collection}.")
    return total_processed

# Step 1: Process primary collection and track processed IDs
processed_ids = set()
offset = None
batch_ids = []
print(f"Scanning {primary_collection} for points with missing payloads...")
while True:
    points, next_offset = client.scroll(
        collection_name=primary_collection,
        with_payload=True,
        with_vectors=False,
        offset=offset,
        limit=1000
    )
    for point in points:
        product_id = point.id
        if not point.payload:
            batch_ids.append(product_id)
            processed_ids.add(product_id)
            if len(batch_ids) >= BATCH_SIZE:
                payloads = get_metadata_batch(batch_ids)
                for pid, meta in payloads.items():
                    for collection in collections:
                        # Only set payload if point exists in this collection
                        points_found = client.retrieve(
                            collection_name=collection,
                            ids=[pid],
                            with_payload=False,
                            with_vectors=False
                        )
                        if points_found:
                            client.set_payload(
                                collection_name=collection,
                                payload=meta,
                                points=[pid]
                            )
                            print(f"Added payload for id={pid} in {collection}")
                batch_ids = []
    if not next_offset:
        break
    offset = next_offset
# Process any remaining in the last batch
if batch_ids:
    payloads = get_metadata_batch(batch_ids)
    for pid, meta in payloads.items():
        for collection in collections:
            points_found = client.retrieve(
                collection_name=collection,
                ids=[pid],
                with_payload=False,
                with_vectors=False
            )
            if points_found:
                client.set_payload(
                    collection_name=collection,
                    payload=meta,
                    points=[pid]
                )
                print(f"Added payload for id={pid} in {collection}")

# Step 2: Process other collections for IDs not already processed
for collection in collections:
    if collection == primary_collection:
        continue
    process_collection(collection, processed_ids)