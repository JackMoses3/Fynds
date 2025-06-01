# ml/embedding/dto/search_dto.py

from pydantic import BaseModel

class SearchRequest(BaseModel):
    query: str

class SearchMatch(BaseModel):
    productId: int
    distance: float
