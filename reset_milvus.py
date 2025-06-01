# reset_milvus.py
import os
from pymilvus import connections, utility

# 1) Read host & port from env (falling back to host.docker.internal if inside Docker)
MILVUS_HOST = os.getenv("MILVUS_HOST", "localhost")
MILVUS_PORT = os.getenv("MILVUS_PORT", "19530")

print(f"Connecting to Milvus at {MILVUS_HOST}:{MILVUS_PORT} …")
connections.connect(host=MILVUS_HOST, port=MILVUS_PORT)

for name in ("fashion_front","fashion_back","fashion_text"):
    if utility.has_collection(name):
        utility.drop_collection(name)
        print(f"Dropped {name}")
    else:
        print(f"No existing collection {name}")

# Optionally recreate empty collections:
from pymilvus import Collection, CollectionSchema, FieldSchema, DataType
DIM = 512
schema = CollectionSchema([
    FieldSchema("id", DataType.INT64, is_primary=True, auto_id=False),
    FieldSchema("embedding", DataType.FLOAT_VECTOR, dim=DIM)
])
for name in ("fashion_front","fashion_back","fashion_text"):
    coll = Collection(name=name, schema=schema)
    coll.create_index("embedding", {
        "index_type":"IVF_FLAT","metric_type":"COSINE","params":{"nlist":128}
    })
    coll.load()
    print(f"Recreated empty {name}")
