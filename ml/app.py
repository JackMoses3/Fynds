# ml/app.py

from fastapi import FastAPI

# 1) your existing text-to-image router:
from ml.src.text_to_image.text_to_image_router import router as search_router

# 2) your new “embed” router (make sure this file exists at ml/src/generate_product_embeddings/router.py)
from ml.src.generate_product_embeddings.router import router as embed_router

app = FastAPI(
    title="My ML Service",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── Include your existing text-to-image endpoints ────────────────────────────
# If your search_router already defines its own path prefixes, you can pass no prefix.
# Otherwise you might do something like prefix="/text2image" or "/search".
app.include_router(search_router)           

# ─── Include the new “/embed” endpoint ────────────────────────────────────────
# Every POST to /embed/ will be handled by generate_product_embeddings.router.create_embeddings
app.include_router(embed_router, prefix="/embed", tags=["embeddings"])


if __name__ == "__main__":
    import uvicorn

    # Since this file is ml/app.py, the correct import string is “ml.app:app”
    uvicorn.run("ml.app:app", host="0.0.0.0", port=8000, reload=True)
