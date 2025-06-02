# ml/ml_services/qdrant_client/Dockerfile

FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py ./

ENV QDRANT_URL="http://qdrant:6333"  

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]