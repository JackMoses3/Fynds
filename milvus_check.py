# milvus_check.py

from pymilvus import connections, Collection

# 1. Connect
connections.connect(host="localhost", port="19530")

# 2. Loop over your collections
for name in ["fashion_front", "fashion_back", "fashion_text"]:
    coll = Collection(name)
    # 3. num_entities tells you how many vectors
    print(f"{name}: {coll.num_entities} vectors")
