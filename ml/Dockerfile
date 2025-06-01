# ml/Dockerfile

FROM python:3.10-slim
WORKDIR /app

# 1) Install Python deps
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 2) Copy env for load_dotenv()
COPY .env ./

# 3) Copy pipeline code & model
COPY embedding/ ./embedding/
RUN mkdir -p /app/models
COPY embedding/best_front_back_model_convnext_82.3_88.19.pth /app/models/

# 4) Make sure imports work
ENV PYTHONPATH=/app

# 5) Run your script
CMD ["python", "embedding/embedding.py"]
