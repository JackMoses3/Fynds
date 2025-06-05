# ml/app.py

from fastapi import FastAPI
from ml_services.embedding_service.main import router as embedding_router
from ml_services.qdrant_service.main import router as qdrant_router

app = FastAPI(
    title="Fynds ML Services",
    description="Centralized ML API for embeddings, vector search, and recommendations",
    version="1.0.0"
)

# Include the embedding router
app.include_router(embedding_router, prefix="/api/v1/embedding", tags=["embeddings"])

# Include the Qdrant client router
app.include_router(qdrant_router, prefix="/api/v1/vector", tags=["vector-search"])



if __name__ == "__main__":
    import uvicorn

    # Since this file is ml/app.py, the correct import string is “ml.app:app”
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
