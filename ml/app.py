from fastapi import FastAPI
from ml.src.text_to_image.text_to_image_router import router as search_router

app = FastAPI()
app.include_router(search_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ml.main:app", host="0.0.0.0", port=8000, reload=True)
