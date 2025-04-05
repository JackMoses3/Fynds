from pydantic import BaseModel
from typing import List

class EmbeddingInput(BaseModel):
    """
    Input model for embedding generation.
    """
    description: str
    image_urls: List[str]