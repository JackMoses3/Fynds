#!/usr/bin/env python3
"""
Script to create the STYLE_EMBEDDINGS collection for fashion styles.
This will store embeddings for different fashion styles that can be used
to automatically classify products.
"""

import requests

def create_style_collection():
    """Create the STYLE_EMBEDDINGS collection in Qdrant"""
    qdrant_url = "http://54.79.38.226:6333"
    
    collection_name = "STYLE_EMBEDDINGS"
    
    print("🎨 Setting up STYLE_EMBEDDINGS collection...")
    
    # Check if collection already exists
    try:
        response = requests.get(f"{qdrant_url}/collections/{collection_name}")
        if response.status_code == 200:
            print(f"✅ Collection {collection_name} already exists")
            
            # Get collection info
            collection_info = response.json()
            vectors_count = collection_info.get("result", {}).get("vectors_count", 0)
            print(f"   📊 Current vectors: {vectors_count}")
            return True
            
    except requests.exceptions.RequestException:
        print(f"🔍 Collection {collection_name} doesn't exist, creating...")
    
    # Create the collection
    try:
        payload = {
            "vectors": {
                "size": 512,  # Match your text embedding size
                "distance": "Cosine"  
            },
        }
        
        response = requests.put(
            f"{qdrant_url}/collections/{collection_name}",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code in [200, 201]:
            print(f"✅ Successfully created collection: {collection_name}")
            print(f"   🔧 Vector size: 512")
            print(f"   📏 Distance metric: Cosine")
            print(f"   ⚡ Optimized for semantic similarity")
            return True
        else:
            print(f"❌ Failed to create {collection_name}")
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Error creating {collection_name}: {str(e)}")
        return False

def verify_collection():
    """Verify the collection was created successfully"""
    qdrant_url = "http://54.79.38.226:6333"
    
    try:
        response = requests.get(f"{qdrant_url}/collections/STYLE_EMBEDDINGS")
        if response.status_code == 200:
            collection_info = response.json()["result"]
            
            print(f"\n✅ Collection verification:")
            print(f"   📛 Name: {collection_info.get('name', 'STYLE_EMBEDDINGS')}")
            print(f"   📊 Vectors: {collection_info.get('vectors_count', 0)}")
            print(f"   🟢 Status: {collection_info.get('status', 'unknown')}")
            print(f"   🔧 Vector size: {collection_info.get('config', {}).get('params', {}).get('vectors', {}).get('size', 'unknown')}")
            print(f"   📏 Distance: {collection_info.get('config', {}).get('params', {}).get('vectors', {}).get('distance', 'unknown')}")
            
            return True
        else:
            print(f"❌ Verification failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Verification error: {str(e)}")
        return False

def main():
    """Main function to create and verify the style collection"""
    print("🚀 Starting STYLE_EMBEDDINGS collection setup...\n")
    
    # Create the collection
    if create_style_collection():
        print(f"\n🔍 Verifying collection...")
        if verify_collection():
            print(f"\n🎉 STYLE_EMBEDDINGS collection is ready!")
            print(f"\n📝 Next steps:")
            print(f"   1. Run the style embedding setup script")
            print(f"   2. Populate the collection with fashion style embeddings")
            print(f"   3. Use the classification endpoints to match products to styles")
        else:
            print(f"\n⚠️  Collection created but verification failed")
    else:
        print(f"\n💥 Failed to create STYLE_EMBEDDINGS collection")
        
    print(f"\n{'='*60}")

if __name__ == "__main__":
    main()