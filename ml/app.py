# main.py
from fastapi import FastAPI
from embedding.embedding_router import embedding_router


app = FastAPI()

app.include_router(embedding_router, prefix="/embedding")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)