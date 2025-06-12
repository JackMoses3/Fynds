# Fynds Services Startup Guide

This guide will help you start all the services needed for the Fynds application to run successfully.

## Prerequisites

- Node.js and npm installed
- Python 3.10+ installed
- Qdrant vector database (already downloaded)

## Step 1: Start ML Service

Open a new PowerShell terminal and navigate to the ML directory:

```powershell
cd ml
```

Set environment variables and start the ML service:

```powershell
$env:QDRANT_URL="http://54.79.38.226:6333"
$env:DATABASE_URL="postgresql://postgres:L%3B0q%25CUXb223%28%21J%60%3E9JNX6%7E@fynds.crq8ooq0qrgr.ap-southeast-2.rds.amazonaws.com:5432/fynds"
python app.py



$env:DATABASE_URL="postgresql://postgres:L%3B0q%25CUXb223%28%21J%60%3E9JNX6%7E@fynds.crq8ooq0qrgr.ap-southeast-2.rds.amazonaws.com:5432/fynds" $env:ML_URL="http://localhost:8000" $env:AUTH_SECRET="test-secret-key" $env:REFRESH_SECRET="test-refresh-key" $env:GOOGLE_CLIENT_ID="test" $env:GOOGLE_CLIENT_SECRET="test" $env:GOOGLE_CALLBACK_URL="test" $env:GOOGLE_CLIENT_ID_ANDROID="test" $env:GOOGLE_CLIENT_ID_IOS="test" $env:MAIL_USER="test@test.com" $env:MAIL_PASS="test" npm run start:dev
```

**Note**: If you see warnings about missing model files, that's normal. The ML service will use fallback models for testing.

The ML service should start on port 8000. You can verify it's running by visiting: http://localhost:8000/docs

## Step 2: Start backend, embed_all_retailer.py through monitor_all_retailer.sh

Open another new PowerShell terminal and navigate to the backend directory:

Set environment variables and start the backend service:

```bash
   ./monitor_all_retailers.sh
   ./monitor_all_products.sh
```

The backend service should start on port 3000.

## Step 3: open backend logs

```bash
   tail -f backend.log
```
