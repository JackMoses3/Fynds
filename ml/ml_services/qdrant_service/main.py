import os
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.http.models import PointStruct, Filter, FieldCondition, MatchAny, Range, PointIdsList

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
            FieldCondition(key="style", match=MatchAny(any=style))  # Use first value for now
        )
    if price_lte:
        must_clauses.append(
            FieldCondition(key="price", range=Range(lte=price_lte))
        )
    if category:
        must_clauses.append(
            FieldCondition(key="category", match=MatchAny(any=category))
        )
    if gender:
        must_clauses.append(
            FieldCondition(key="gender", match=MatchAny(any=gender))
        )
    if brand:
        must_clauses.append(
            FieldCondition(key="brand", match=MatchAny(any=brand))
        )

    if retailer:
        must_clauses.append(
            FieldCondition(key="retailer", match=MatchAny(any=retailer))
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
    returning the top styles for each modality without averaging.
    """
    
    # Check if STYLE_EMBEDDINGS collection exists
    collections = client.get_collections()
    collection_names = [col.name for col in collections.collections]
    if "STYLE_EMBEDDINGS" not in collection_names:
        raise HTTPException(status_code=404, detail="STYLE_EMBEDDINGS collection not found")
    
    # Collections to check for product vectors
    embedding_collections = ["TEXT_EMBEDDINGS", "IMAGE_FRONT_EMBEDDINGS", "IMAGE_BACK_EMBEDDINGS"]
    modality_results = {}  # Dictionary to store results by collection type
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
                    limit=req.top_k,  # Use the requested top_k for each modality
                    with_payload=True,
                    with_vectors=False,
                    score_threshold=req.min_confidence
                )
                
                # Format results for this modality
                modality_styles = []
                for result in style_results:
                    style_id = result.payload.get("style_id")
                    style_name = result.payload.get("style_name")
                    if style_id is not None and result.score >= req.min_confidence:
                        modality_styles.append({
                            "style_id": style_id,
                            "style_name": style_name,
                            "similarity_score": round(result.score, 4)
                        })
                
                # Determine modality type for cleaner naming
                modality_type = collection_name.replace("_EMBEDDINGS", "").replace("IMAGE_", "").lower()
                if modality_type == "text":
                    modality_key = "text_styles"
                elif modality_type == "front":
                    modality_key = "image_front_styles"
                elif modality_type == "back":
                    modality_key = "image_back_styles"
                else:
                    modality_key = f"{modality_type}_styles"
                
                modality_results[modality_key] = {
                    "collection": collection_name,
                    "styles": modality_styles,
                    "count": len(modality_styles)
                }
                        
            except Exception as e:
                # Continue with other collections if one fails
                continue
        
        # Check if we found any vectors
        if not found_collections:
            raise HTTPException(
                status_code=404, 
                detail=f"Product {req.product_id} not found in any embedding collections"
            )
        
        # Calculate total unique styles found across all modalities
        all_style_ids = set()
        for modality_data in modality_results.values():
            for style in modality_data["styles"]:
                all_style_ids.add(style["style_id"])
        
        return {
            "product_id": req.product_id,
            "found_in_collections": found_collections,
            "total_modalities": len(modality_results),
            "total_unique_styles": len(all_style_ids),
            "top_k_per_modality": req.top_k,
            "min_confidence": req.min_confidence,
            "results": modality_results
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

    try:
        client.delete(
            collection_name=req.collection,
            points_selector=PointIdsList(
                points=[req.product_id]
            )
        )
        return {"status": "deleted", "id": req.product_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete product {req.product_id}: {str(e)}")
    return {"status": "deleted", "id": req.product_id}