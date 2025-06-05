# Fynds Services Startup Guide

This guide will help you start all the services needed for the Fynds application to run successfully.

## Prerequisites

- Node.js and npm installed
- Python 3.10+ installed
- Qdrant vector database (already downloaded)

## Step 1: Start Qdrant Vector Database

Since you already have Qdrant downloaded, start it with:

```powershell
# Navigate to where your Qdrant executable is located
# Then run:
.\qdrant.exe

# Or if you have Docker (alternative):
# docker run -d --name qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant:latest
```

Qdrant should start on port 6333. You can verify it's running by visiting: http://localhost:6333

## Step 2: Set up Qdrant Collections

Run the setup script to create the required collections:

```powershell
python setup_qdrant.py
```

This will create the collections: `TEXT_EMBEDDINGS`, `IMAGE_FRONT_EMBEDDINGS`, and `IMAGE_BACK_EMBEDDINGS`.

## Step 3: Start ML Service

Open a new PowerShell terminal and navigate to the ML directory:

```powershell
cd ml
```

Set environment variables and start the ML service:

```powershell
$env:QDRANT_URL="http://54.79.38.226:6333"
$env:DATABASE_URL="postgresql://postgres:L%3B0q%25CUXb223%28%21J%60%3E9JNX6%7E@fynds.crq8ooq0qrgr.ap-southeast-2.rds.amazonaws.com:5432/fynds"
python app.py
```

**Note**: If you see warnings about missing model files, that's normal. The ML service will use fallback models for testing.

The ML service should start on port 8000. You can verify it's running by visiting: http://localhost:8000/docs

## Step 4: Start Backend Service

Open another new PowerShell terminal and navigate to the backend directory:

```powershell
cd backend
```

Set environment variables and start the backend service:

```powershell
$env:DATABASE_URL="postgresql://postgres:L%3B0q%25CUXb223%28%21J%60%3E9JNX6%7E@fynds.crq8ooq0qrgr.ap-southeast-2.rds.amazonaws.com:5432/fynds"
$env:ML_URL="http://localhost:8000"
$env:AUTH_SECRET="test-secret-key"
$env:REFRESH_SECRET="test-refresh-key"
$env:GOOGLE_CLIENT_ID="test"
$env:GOOGLE_CLIENT_SECRET="test"
$env:GOOGLE_CALLBACK_URL="test"
$env:GOOGLE_CLIENT_ID_ANDROID="test"
$env:GOOGLE_CLIENT_ID_IOS="test"
$env:MAIL_USER="test@test.com"
$env:MAIL_PASS="test"
npm run start:dev
```

The backend service should start on port 3000.

## Step 5: Test the Pipeline

Once all services are running, test the complete pipeline:

```powershell
python test_api.py
```

## Expected Results

When all services are running correctly, you should see:

- ✅ Service health checks passing
- ✅ ML text embedding generation working
- ✅ ML image embedding generation working
- ✅ ML product embedding generation working
- ✅ Backend product processing working
- ✅ Backend text search working
- ✅ Backend similar products working
- ✅ Database populated with embeddings
- ✅ Qdrant collections created and populated

## Troubleshooting

### Common Issues:

1. **Qdrant connection failed**: Make sure Qdrant is running on port 6333
2. **ML service fails to start**: Check if all Python dependencies are installed with `pip install -r requirements.txt`
3. **Backend fails to start**: Check if all environment variables are set correctly
4. **Model files missing**: The ML service will use fallback models for testing if the trained models aren't available
5. **"Cannot find module" errors in backend**: These have been fixed by updating import paths to use relative imports
6. **"No module named 'ml'" error**: This has been fixed by updating the ML service startup configuration
7. **Database authentication failed**: The password contains special characters that must be URL encoded in the connection string

### Service URLs:

- **Qdrant**: http://localhost:6333
- **ML Service**: http://localhost:8000 (docs at /docs)
- **Backend**: http://localhost:3000

### Logs:

Check the terminal windows for each service to see detailed logs and error messages.

## What the Test Pipeline Does

The `test_api.py` script tests the complete workflow:

1. **Get Product from DB**: Fetches a product that hasn't been embedded yet
2. **Send to ML Service**: Sends product data (images + metadata) to ML service
3. **ML Processing**:
   - Downloads and classifies images as front/back
   - Generates embeddings for front image, back image, and text
   - Returns embeddings + frontFacing labels
4. **Backend Processing**:
   - Updates `ProductItem.embedding` field in database
   - Updates `ProductImage.frontFacing` field for each image
   - Stores embeddings in Qdrant vector database
5. **Search Testing**:
   - Tests text search (user types "blue oversized tee")
   - Tests image search (user uploads image from camera)
   - Tests similar product search (finds products similar to a given product)

This creates a complete AI-powered product discovery system!

## Password URL Encoding Reference

If you need to change the database password, remember to URL encode special characters:

- `;` → `%3B`
- `%` → `%25`
- `(` → `%28`
- `)` → `%29`
- `!` → `%21`
- `>` → `%3E`
- `~` → `%7E`
- `` ` `` → `%60`

## ✅ Recent Critical Fixes Applied

The following major issues have been resolved:

### Backend Module Registration

- **Fixed 404 errors**: Added `EmbeddingQdrantModule` to `AppModule` imports
- **Fixed routing**: All `/api/embedding-qdrant/*` endpoints now work correctly

### Data Format Compatibility

- **Fixed field naming**: Backend now sends `product_id` instead of `productId` to ML service
- **Fixed collection names**: Updated enum to use uppercase names (`TEXT_EMBEDDINGS`, etc.)
- **Fixed endpoint URLs**: Corrected ML service API paths

### Embedding Storage Logic

- **Fixed partial storage**: Now stores ALL embeddings (front, back, text) instead of just the first one
- **Fixed Qdrant integration**: Properly inserts vectors into all relevant collections
- **Fixed response handling**: Correctly processes ML service responses

### Search Functionality

- **Fixed searchProduct method**: Properly implemented search across multiple collections
- **Fixed embedding parsing**: Correctly interprets embedding strings (e.g., "fbt" = front+back+text)
- **Fixed result deduplication**: Handles overlapping results from multiple collections

### Error Handling & Debugging

- **Added comprehensive logging**: Detailed logs for debugging embedding insertion
- **Improved error messages**: Better error reporting for ML service communication
- **Added connection validation**: Validates service connectivity before operations

These fixes ensure that:

1. ✅ Products get processed and embeddings stored in Qdrant
2. ✅ Text search finds similar products via vector similarity
3. ✅ Image search works with front/back classification
4. ✅ Similar product search returns relevant recommendations
5. ✅ All Qdrant collections get populated with embeddings
