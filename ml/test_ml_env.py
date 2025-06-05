#!/usr/bin/env python3
"""
Test ML service environment and connection
"""

import os
from qdrant_client import QdrantClient

def test_ml_environment():
    print("🔍 Testing ML Service Environment\n")
    print("=" * 50)
    
    # Check environment variables
    print("1️⃣ Environment Variables:")
    qdrant_url = os.getenv("QDRANT_URL")
    database_url = os.getenv("DATABASE_URL")
    
    print(f"QDRANT_URL: {qdrant_url}")
    print(f"DATABASE_URL: {'SET' if database_url else 'NOT SET'}")
    
    # Use default if not set
    if not qdrant_url:
        qdrant_url = "http://localhost:6333"
        print(f"Using default QDRANT_URL: {qdrant_url}")
    
    print()
    
    # Test Qdrant connection
    print("2️⃣ Testing Qdrant Connection:")
    try:
        client = QdrantClient(url=qdrant_url)
        collections = client.get_collections()
        
        print(f"✅ Connected to Qdrant at {qdrant_url}")
        print(f"Found {len(collections.collections)} collections:")
        
        for collection in collections.collections:
            print(f"  - {collection.name}")
            
        # Check for required collections
        required = ["TEXT_EMBEDDINGS", "IMAGE_FRONT_EMBEDDINGS", "IMAGE_BACK_EMBEDDINGS"]
        existing = [c.name for c in collections.collections]
        
        print("\n3️⃣ Required Collections Check:")
        all_exist = True
        for req in required:
            if req in existing:
                print(f"✅ {req}")
            else:
                print(f"❌ {req} - MISSING!")
                all_exist = False
        
        if all_exist:
            print("\n🎉 All required collections exist!")
        else:
            print("\n⚠️ Some collections are missing. Run setup_qdrant_collections.py")
            
    except Exception as e:
        print(f"❌ Qdrant connection failed: {e}")
        
    print("\n" + "=" * 50)

if __name__ == "__main__":
    test_ml_environment() 