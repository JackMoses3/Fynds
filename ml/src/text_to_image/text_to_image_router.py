from fastapi import APIRouter, HTTPException
from typing import List

from ...src.dto.search_dto import SearchRequest, SearchMatch
from .text_to_image_service import TextToImageService

router = APIRouter(
    prefix="/product-item",
    tags=["product-item"],
)

_search_service = TextToImageService(k=50)

@router.post(
    "/search",
    response_model=List[SearchMatch],
    summary="Search products by text→image similarity",
)
async def search_products(payload: SearchRequest):
    try:
        results = _search_service.search(payload.query)
        return [SearchMatch(productId=pid, distance=dist) for pid, dist in results]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
