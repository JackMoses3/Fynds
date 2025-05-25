# vector_store.py
import os
from pymilvus import connections, utility, FieldSchema, CollectionSchema, DataType, Collection

# connect using your env vars
MILVUS_HOST = os.getenv("MILVUS_HOST", "localhost")
MILVUS_PORT = os.getenv("MILVUS_PORT", "19530")
connections.connect(alias="default", host=MILVUS_HOST, port=MILVUS_PORT)

# define the schema
dim = 512
fields = [
    FieldSchema(name="id", dtype=DataType.INT64, is_primary=True),
    FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=dim),
    FieldSchema(name="name", dtype=DataType.VARCHAR, max_length=256),
    FieldSchema(name="frontFacing", dtype=DataType.BOOL),
]
schema = CollectionSchema(fields, description="Product vectors")
COLLECTION_NAME = "product_vectors"

def init_collection():
    if not utility.has_collection(COLLECTION_NAME):
        coll = Collection(name=COLLECTION_NAME, schema=schema)
        coll.create_index("embedding", {
            "index_type": "IVF_FLAT",
            "params": {"nlist": 128},
            "metric_type": "L2"
        })
        coll.load()
    else:
        coll = Collection(COLLECTION_NAME)
    return coll

# expose a singleton
collection = init_collection()
