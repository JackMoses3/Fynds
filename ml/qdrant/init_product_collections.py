#!/usr/bin/env python3
"""
Script to create required Qdrant collections for the Fynds application.
Run this once to set up the vector database collections.
"""

import requests
import json

def create_qdrant_collections():
    """Create the required Qdrant collections"""
    qdrant_url = "http://54.79.38.226:6333"
    
    # Collection configurations
    collections = [
        {
            "name": "TEXT_EMBEDDINGS",
            "vector_size": 512,
            "distance": "Cosine"
        },
        {
            "name": "IMAGE_FRONT_EMBEDDINGS", 
            "vector_size": 512,
            "distance": "Cosine"
        },
        {
            "name": "IMAGE_BACK_EMBEDDINGS",
            "vector_size": 512, 
            "distance": "Cosine"
        }
    ]
    
    print("🔧 Setting up Qdrant collections...")
    
    for collection in collections:
        collection_name = collection["name"]
        
        # Check if collection exists
        try:
            response = requests.get(f"{qdrant_url}/collections/{collection_name}")
            if response.status_code == 200:
                print(f"✅ Collection {collection_name} already exists")
                continue
        except requests.exceptions.RequestException:
            pass
        
        # Create collection
        try:
            payload = {
                "name": collection_name,
                "vectors": {
                    "size": collection["vector_size"],
                    "distance": collection["distance"]
                }
            }
            
            response = requests.put(
                f"{qdrant_url}/collections/{collection_name}",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code in [200, 201]:
                print(f"✅ Created collection: {collection_name}")
            else:
                print(f"❌ Failed to create {collection_name}: {response.status_code} - {response.text}")
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Error creating {collection_name}: {str(e)}")
    
    print("\n🏁 Qdrant setup complete!")

if __name__ == "__main__":
    create_qdrant_collections() 