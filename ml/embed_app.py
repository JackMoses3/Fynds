# ml/embed_app.py

from fastapi import FastAPI
from ml.src.generate_product_embeddings.router import router as embed_router

app = FastAPI(
    title="Embedding‐only Service",
    version="0.1.0",
    docs_url="/docs",
    redoc_url=None,  # or keep redoc if you like
)

# Mount only the /embed routes here
app.include_router(embed_router, prefix="/embed", tags=["embeddings"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ml.embed_app:app", host="0.0.0.0", port=8000, reload=True)
