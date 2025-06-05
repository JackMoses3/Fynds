#!/usr/bin/env python3
"""
Set up Qdrant collections for the Fynds application
"""

import requests
import json

def setup_qdrant_collections():
    print("🔧 Setting up Qdrant collections...")
    
    #qdrant_url = "http://localhost:6333"
    qdrant_url = "http://54.79.38.226:6333"
    
    # Test connection first
    try:
        response = requests.get(f"{qdrant_url}/")
        if response.status_code != 200:
            print("❌ Qdrant is not running. Please start Qdrant first.")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to Qdrant: {e}")
        print("Please start Qdrant first with: qdrant.exe")
        return False
    
    print("✅ Qdrant is running")
    
    # Collections to create
    collections = [
        "TEXT_EMBEDDINGS",
        "IMAGE_FRONT_EMBEDDINGS", 
        "IMAGE_BACK_EMBEDDINGS"
    ]
    
    for collection_name in collections:
        print(f"Creating collection: {collection_name}")
        
        # Collection configuration
        collection_config = {
            "vectors": {
                "size": 512,
                "distance": "Cosine"
            }
        }
        
        try:
            # Create collection
            response = requests.put(
                f"{qdrant_url}/collections/{collection_name}",
                json=collection_config
            )
            
            if response.status_code in [200, 201]:
                print(f"✅ Created {collection_name}")
            elif response.status_code == 409:
                print(f"✅ {collection_name} already exists")
            else:
                print(f"❌ Failed to create {collection_name}: {response.status_code}")
                print(f"Response: {response.text}")
                
        except Exception as e:
            print(f"❌ Error creating {collection_name}: {e}")
    
    print("\n🎉 Qdrant setup complete!")
    return True

if __name__ == "__main__":
    setup_qdrant_collections() 