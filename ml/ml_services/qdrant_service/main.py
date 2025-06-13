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

class InsertStyleVector(BaseModel):
    style_id: int
    style_name: str
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

class MultiModalStyleClassification(BaseModel):
    product_id: int
    top_k: Optional[int] = 5
    min_confidence: Optional[float] = 0.0

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
    collections = client.get_collections()
    collection_names = [col.name for col in collections.collections]
    if data.collection not in collection_names:
        raise HTTPException(status_code=404, detail=f"Collection '{data.collection}' not found. Available: {collection_names}")

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

@router.post("/insert_style")
async def insert_style_vector(data: InsertStyleVector):
    """
    Upsert a style vector into the STYLE_EMBEDDINGS collection.
    """

    point = PointStruct(
        id=data.style_id,
        vector=np.array(data.vector, dtype="float32").tolist(),
        payload={
            "style_id": data.style_id,
            "style_name": data.style_name
        }
    )
    client.upsert(
        collection_name="STYLE_EMBEDDINGS",
        points=[point]
    )
    return {"status": "upserted", "id": data.style_id}

@router.post("/search")
async def search(req: SearchRequest):
    """
    Search for nearest neighbors, applying optional filters.
    """
    collections = client.get_collections()
    collection_names = [col.name for col in collections.collections]
    if req.collection not in collection_names:
        raise HTTPException(status_code=404, detail=f"Collection '{req.collection}' not found. Available: {collection_names}")

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
    collections = client.get_collections()
    collection_names = [col.name for col in collections.collections]
    if req.collection not in collection_names:
        raise HTTPException(status_code=404, detail=f"Collection '{req.collection}' not found. Available: {collection_names}")

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
    

@router.post("/classify_multimodal_style")
async def classify_multimodal_style(req: MultiModalStyleClassification):
    """
    Get style classification for a product by running similarity searches on 
    TEXT_EMBEDDINGS, IMAGE_FRONT_EMBEDDINGS, and IMAGE_BACK_EMBEDDINGS separately,
    then averaging the similarity scores for each style.
    """
    
    # Check if STYLE_EMBEDDINGS collection exists
    collections = client.get_collections()
    collection_names = [col.name for col in collections.collections]
    if "STYLE_EMBEDDINGS" not in collection_names:
        raise HTTPException(status_code=404, detail="STYLE_EMBEDDINGS collection not found")
    
    # Collections to check for product vectors
    embedding_collections = ["TEXT_EMBEDDINGS", "IMAGE_FRONT_EMBEDDINGS", "IMAGE_BACK_EMBEDDINGS"]
    all_style_scores = {}  # Dictionary to store scores by style_id
    found_collections = []
    
    try:
        # Process each collection separately
        for collection_name in embedding_collections:
            if collection_name not in collection_names:
                continue
                
            try:
                # Get the product vector from this collection
                points = client.retrieve(
                    collection_name=collection_name,
                    ids=[req.product_id],
                    with_vectors=True,
                    with_payload=False
                )
                
                if not points or not points[0].vector:
                    continue
                
                product_vector = points[0].vector
                found_collections.append(collection_name)
                
                # Search for similar styles using this vector
                style_results = client.search(
                    collection_name="STYLE_EMBEDDINGS",
                    query_vector=product_vector,
                    limit=20,  # Get more results to ensure we capture all relevant styles
                    with_payload=True,
                    with_vectors=False,
                    score_threshold=0.0  # Don't filter here, we'll filter after averaging
                )
                
                # Store scores for each style
                for result in style_results:
                    style_id = result.payload.get("style_id")
                    if style_id is not None:
                        if style_id not in all_style_scores:
                            all_style_scores[style_id] = {
                                "style_name": result.payload.get("style_name"),
                                "scores": [],
                                "total_score": 0.0
                            }
                        all_style_scores[style_id]["scores"].append(result.score)
                        
            except Exception as e:
                # Continue with other collections if one fails
                continue
        
        # Check if we found any vectors
        if not found_collections:
            raise HTTPException(
                status_code=404, 
                detail=f"Product {req.product_id} not found in any embedding collections"
            )
        
        # Calculate average scores for each style
        averaged_styles = []
        for style_id, data in all_style_scores.items():
            if data["scores"]:  # Only process styles that have scores
                avg_score = sum(data["scores"]) / len(data["scores"])
                if avg_score >= req.min_confidence:  # Apply confidence filter
                    averaged_styles.append({
                        "style_id": style_id,
                        "similarity_score": round(avg_score, 4),
                        "collections_count": len(data["scores"])  # How many collections contributed
                    })
        
        # Sort by similarity score (highest first) and limit results
        averaged_styles.sort(key=lambda x: x["similarity_score"], reverse=True)
        final_styles = averaged_styles[:req.top_k]
        
        if not final_styles:
            return {
                "product_id": req.product_id,
                "found_in_collections": found_collections,
                "styles": [],
                "message": f"No styles found above confidence threshold of {req.min_confidence}"
            }
        
        return {
            "product_id": req.product_id,
            "found_in_collections": found_collections,
            "collections_used": len(found_collections),
            "styles": final_styles
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Multimodal classification failed: {str(e)}")

@router.post("/delete")
async def delete(req: DeleteRequest):
    """
    Delete a vector (by product_id) from the specified collection.
    """
    collections = client.get_collections()
    collection_names = [col.name for col in collections.collections]
    if req.collection not in collection_names:
        raise HTTPException(status_code=404, detail=f"Collection '{req.collection}' not found. Available: {collection_names}")

    client.delete(
        collection_name=req.collection,
        points=[req.product_id]
    )
    return {"status": "deleted", "id": req.product_id}