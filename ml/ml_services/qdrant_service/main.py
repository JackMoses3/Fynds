# ml/ml_services/qdrant_client/main.py
import os
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.http.models import PointStruct, Filter, FieldCondition, MatchAny, Range

router = APIRouter()

# Initialize Qdrant client (assuming local; override via ENV for prod)
QDRANT_URL = os.getenv("QDRANT_URL")
client = QdrantClient(url=QDRANT_URL)

# -------------- Data Models --------------

class InsertVector(BaseModel):
    collection: str
    product_id: int
    price: float
    style: Optional[List[str]] = None
    category: Optional[List[str]] = None
    gender: Optional[List[str]] = None
    brand: Optional[List[str]] = None
    retailer: Optional[List[str]] = None
    vector: List[float] = Field(..., min_items=512, max_items=512)

class SearchRequest(BaseModel):
    collection: str
    vector: List[float] = Field(..., min_items=512, max_items=512)
    top_k: int = 10
    style: Optional[List[str]] = None
    price_lte: Optional[float] = None # Price less than or equal to
    category: Optional[List[str]] = None
    gender: Optional[List[str]] = None
    brand: Optional[List[str]] = None
    retailer: Optional[List[str]] = None

class SearchProduct(BaseModel):
    collection: str
    product_id: int
    top_k: int
    style: Optional[List[str]] = None
    price_lte: Optional[float] = None # Price less than or equal to
    category: Optional[List[str]] = None
    gender: Optional[List[str]] = None
    brand: Optional[List[str]] = None
    retailer: Optional[List[str]] = None


class DeleteRequest(BaseModel):
    collection: str
    product_id: int

# -------------- Helper Functions --------------

def build_filter(style: Optional[List[str]], price_lte: Optional[float], 
                category: Optional[List[str]], gender: Optional[List[str]], 
                brand: Optional[List[str]], retailer: Optional[List[str]]):
    """
    Build a Qdrant payload Filter object based on provided fields.
    """
    must_clauses = []

    if style:
        must_clauses.append(
            FieldCondition(key="style", match=MatchAny(value=style))  # Use first value for now
        )
    if price_lte:
        must_clauses.append(
            FieldCondition(key="price", range=Range(lte=price_lte))
        )
    if category:
        must_clauses.append(
            FieldCondition(key="category", match=MatchAny(value=category))
        )
    if gender:
        must_clauses.append(
            FieldCondition(key="gender", match=MatchAny(value=gender))
        )
    if brand:
        must_clauses.append(
            FieldCondition(key="brand", match=MatchAny(value=brand))
        )

    if retailer:
        must_clauses.append(
            FieldCondition(key="retailer", match=MatchAny(value=retailer))
        )
    return Filter(must=must_clauses) if must_clauses else None

# -------------- API Endpoints --------------

@router.post("/insert")
async def insert_vector(data: InsertVector):
    """
    Upsert a single vector with metadata into the specified collection.
    """
    # Validate collection exists
    if data.collection not in client.get_collections().collections:
        raise HTTPException(status_code=404, detail="Collection not found")

    point = PointStruct(
        id=data.product_id,
        vector=np.array(data.vector, dtype="float32").tolist(),
        payload={
            "product_id": data.product_id,
            "style": data.style,
            "price": data.price,
            "category": data.category,
            "gender": data.gender,
            "brand": data.brand,
            "retailer": data.retailer
        }
    )
    client.upsert(
        collection_name=data.collection,
        points=[point]
    )
    return {"status": "upserted", "id": data.product_id}

@router.post("/search")
async def search(req: SearchRequest):
    """
    Search for nearest neighbors, applying optional filters.
    """
    if req.collection not in client.get_collections().collections:
        raise HTTPException(status_code=404, detail="Collection not found")

    vect = np.array(req.vector, dtype="float32").tolist()
    filter_obj = build_filter(req.style, req.price_lte, req.category, req.gender, req.brand, req.retailer)
    
    results = client.search(
        collection_name=req.collection,
        query_vector=vect,
        limit=req.top_k,
        with_payload=True,
        with_vectors=False,
        query_filter=filter_obj
    )
    # Format results
    output = []
    for res in results:
        output.append({
            "id": res.id,
            "score": res.score, # Similarity score
        })
    return {"results": output}

# Alternative approach using search (if you want similarity-based results)
@router.post("/search_product")
async def search_product(req: SearchProduct):
    """
    Find a product and return similar items.
    """
    if req.collection not in client.get_collections().collections:
        raise HTTPException(status_code=404, detail="Collection not found")

    # First, get the target product's vector
    target_points = client.scroll(
        collection_name=req.collection,
        scroll_filter=Filter(must=[
            FieldCondition(key="product_id", match=MatchAny(any=[req.product_id]))
        ]),
        limit=1,
        with_vectors=True
    )[0]
    
    if not target_points:
        raise HTTPException(status_code=404, detail="Product not found")
    
    target_vector = target_points[0].vector
    filter_obj = build_filter(req.style, req.price_lte, req.category, req.gender, req.brand, req.retailer)
    
    # Now search for similar products
    results = client.search(
        collection_name=req.collection,
        query_vector=target_vector,
        limit=req.top_k,
        with_payload=True,
        with_vectors=False,
        query_filter=filter_obj
    )
    
    output = []
    for res in results:
        output.append({
            "id": res.id,
            "score": res.score,
        })
    return {"results": output}
    



@router.delete("/delete")
async def delete(req: DeleteRequest):
    """
    Delete a vector (by product_id) from the specified collection.
    """
    if req.collection not in client.get_collections().collections:
        raise HTTPException(status_code=404, detail="Collection not found")

    client.delete(
        collection_name=req.collection,
        points=[req.product_id]
    )
    return {"status": "deleted", "id": req.product_id}