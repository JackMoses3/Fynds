# ml/embedding/text_to_image_service.py

from typing import List, Tuple
from ...front_back_text_simiilarity.text_to_image import (run_query)

class TextToImageService:
    """
    Wrapper around the core run_query function
    so we can swap implementations or add caching later.
    """

    def __init__(self, k: int = 50):
        self.k = k

    def search(self, query: str) -> List[Tuple[int, float]]:
        return run_query(query, k=self.k)
