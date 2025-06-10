FROM python:3.10-slim
WORKDIR /app

# 1) Install Python deps
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 2) Copy env for load_dotenv()
COPY .env ./

# 3) Copy pipeline code & model
COPY ml_services/ ./ml_services/
RUN mkdir -p /app/models
COPY ml_services/embedding_service/model_files/best_front_back_model_convnext_82.3_88.19.pth /app/models/

# 4) Make sure imports work
ENV PYTHONPATH=/app

# 5) Run your embedding service
CMD ["python", "ml_services/qdrant_service/main.py"]