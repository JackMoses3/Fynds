#!/usr/bin/env python3
"""
Test script to verify the entire ML + Backend + Qdrant pipeline is working correctly.
This script tests:
1. Embedding generation
2. Database population (ProductItem and ProductImage)
3. Qdrant vector storage
4. Search functionality
"""

import requests
import json
import time
from typing import Dict, List, Any
import psycopg2
from psycopg2.extras import RealDictCursor


class FyndsAPITester:
    def __init__(self):
        self.backend_url = "http://localhost:3000/api"
        self.ml_url = "http://localhost:8000"
        self.qdrant_url = "http://54.79.38.226:6333"
        
        # Database connection (adjust credentials as needed)
        self.db_config = {
            'host': 'fynds.crq8ooq0qrgr.ap-southeast-2.rds.amazonaws.com',
            'port': 5432,
            'dbname': 'fynds',
            'user': 'postgres',
            'password': 'L;0q%CUXb223(!J`>9JNX6~'  # Raw password for direct connection
        }

    def test_services_health(self):
        """Check if all services are running"""
        print("🔍 Testing service health...")
        
        services = {
            "Backend": f"{self.backend_url}/health",
            "ML Service": f"{self.ml_url}/docs",
            "Qdrant": f"{self.qdrant_url}/health"
        }
        
        for service, url in services.items():
            try:
                response = requests.get(url, timeout=5)
                if response.status_code in [200, 404]:  # 404 is OK for some health endpoints
                    print(f"✅ {service}: Running")
                else:
                    print(f"❌ {service}: Error {response.status_code}")
            except Exception as e:
                print(f"❌ {service}: Connection failed - {str(e)}")

    def test_ml_text_embedding(self):
        """Test ML text embedding generation"""
        print("\n🧠 Testing ML text embedding...")
        
        payload = {"text": "casual blue jeans for men"}
        
        try:
            response = requests.post(
                f"{self.ml_url}/api/v1/embedding/text-embed",
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Text embedding generated: {len(data['embedding'])} dimensions")
                return data['embedding']
            else:
                print(f"❌ Text embedding failed: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"❌ Text embedding error: {str(e)}")
            return None

    def test_ml_image_embedding(self):
        """Test ML image embedding with a sample image"""
        print("\n📸 Testing ML image embedding...")
        
        # You'll need to provide an actual image file
        sample_image_path = r"C:\Users\ryanh\OneDrive\Pictures\photos_of_clothing\back_tee_1.jpg"
        # Replace with actual image path
        
        try:
            with open(sample_image_path, 'rb') as f:
                files = {'file': ('sample.jpg', f, 'image/jpeg')}
                response = requests.post(
                    f"{self.ml_url}/api/v1/embedding/image-embed",
                    files=files,
                    timeout=30
                )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Image embedding generated: {data['label']}, {len(data['embedding'])} dimensions")
                return data
            else:
                print(f"❌ Image embedding failed: {response.status_code} - {response.text}")
                return None
        except FileNotFoundError:
            print(f"❌ Sample image not found: {sample_image_path}")
            print("   Please provide a sample product image to test image embedding")
            return None
        except Exception as e:
            print(f"❌ Image embedding error: {str(e)}")
            return None

    def test_ml_product_embedding(self, product_id: int = 1):
        """Test ML product embedding generation"""
        print(f"\n🛍️ Testing ML product embedding for product ID {product_id}...")
        
        # First, check if product exists in DB
        product_data = self.get_product_from_db(product_id)
        if not product_data:
            print(f"❌ Product {product_id} not found in database")
            return None
        
        payload = {
            "id": product_id,
            "metaData": product_data.get('metaData', ''),
            "imageUrls": product_data.get('imageUrls', [])
        }
        
        try:
            response = requests.post(
                f"{self.ml_url}/api/v1/embedding/product-embed",
                json=payload,
                timeout=60
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Product embedding generated:")
                print(f"   - Front embedding: {'✅' if data.get('frontEmbedding') else '❌'}")
                print(f"   - Back embedding: {'✅' if data.get('backEmbedding') else '❌'}")
                print(f"   - Text embedding: {'✅' if data.get('textEmbedding') else '❌'}")
                print(f"   - Front facing images: {data.get('frontFacingImages', [])}")
                return data
            else:
                print(f"❌ Product embedding failed: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"❌ Product embedding error: {str(e)}")
            return None

    def test_backend_text_search(self):
        """Test backend text search"""
        print("\n🔍 Testing backend text search...")
        
        payload = {
            "text": "blue jeans",
            "top_k": 5
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/embedding-qdrant/search-text",
                json=payload,
                timeout=30
            )
            
            if response.status_code in [200, 201]:  # Accept both 200 OK and 201 Created
                data = response.json()
                print(f"✅ Text search successful: Found {len(data)} products")
                for i, product in enumerate(data[:3]):  # Show first 3
                    print(f"   {i+1}. {product['name']} - {product['brand']} (${product['price']})")
                return data
            else:
                print(f"❌ Text search failed: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"❌ Text search error: {str(e)}")
            return None

    def test_backend_similar_products(self, product_id: int = 1):
        """Test backend similar products"""
        print(f"\n🔗 Testing similar products for product ID {product_id}...")
        
        payload = {
            "productId": product_id,
            "top_k": 5
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/embedding-qdrant/similar-product",
                json=payload,
                timeout=30
            )
            
            if response.status_code in [200, 201]:  # Accept both 200 OK and 201 Created
                data = response.json()
                print(f"✅ Similar products found: {len(data)} products")
                for i, product in enumerate(data[:3]):  # Show first 3
                    print(f"   {i+1}. {product['name']} - {product['brand']} (${product['price']})")
                return data
            else:
                print(f"❌ Similar products failed: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"❌ Similar products error: {str(e)}")
            return None

    def test_backend_process_product(self, product_id: int = 1):
        """Test backend product processing - generate embeddings and store in DB + Qdrant"""
        print(f"\n⚙️ Testing backend product processing for product ID {product_id}...")
        
        payload = {
            "productId": product_id
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/embedding-qdrant/process-product",
                json=payload,
                timeout=60  # Longer timeout for processing
            )
            
            if response.status_code in [200, 201]:  # Accept both 200 OK and 201 Created
                data = response.json()
                if data.get('success'):
                    print(f"✅ Product processing successful: {data['message']}")
                    return data
                else:
                    print(f"❌ Product processing failed: {data['message']}")
                    return None
            else:
                print(f"❌ Product processing failed: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"❌ Product processing error: {str(e)}")
            return None

    def test_database_population(self):
        """Check database for embedding data"""
        print("\n💾 Testing database population...")
        
        try:
            conn = psycopg2.connect(**self.db_config)
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Check ProductItem embedding field
            cursor.execute("""
                SELECT id, name, embedding, price, retailer 
                FROM "ProductItem" 
                WHERE embedding IS NOT NULL 
                LIMIT 5
            """)
            
            products_with_embeddings = cursor.fetchall()
            print(f"✅ Products with embeddings: {len(products_with_embeddings)}")
            
            for product in products_with_embeddings:
                print(f"   ID {product['id']}: {product['name']} (embedding: {product['embedding']})")
            
            # Check ProductImage frontFacing field
            cursor.execute("""
                SELECT 
                  pi.id, 
                  pi."imageUrl", 
                  pi."frontFacing", 
                  p.name
                FROM "ProductImage" pi
                JOIN "ProductItem" p 
                  ON pi."productItemId" = p.id
                WHERE pi."frontFacing" IS NOT NULL
                LIMIT 5
            """)
            
            images_with_labels = cursor.fetchall()
            print(f"✅ Product images with front/back labels: {len(images_with_labels)}")
            
            cursor.close()
            conn.close()
            
            return len(products_with_embeddings) > 0 and len(images_with_labels) > 0
            
        except Exception as e:
            print(f"❌ Database check error: {str(e)}")
            print("   Make sure to update database credentials in the script")
            return False

    def test_qdrant_collections(self):
        """Check Qdrant collections and vectors"""
        print("\n🔗 Testing Qdrant collections...")
        
        collections = [
            "TEXT_EMBEDDINGS",
            "IMAGE_FRONT_EMBEDDINGS", 
            "IMAGE_BACK_EMBEDDINGS"
        ]
        
        for collection in collections:
            try:
                # Get collection info
                response = requests.get(f"{self.qdrant_url}/collections/{collection}")
                
                if response.status_code == 200:
                    data = response.json()
                    vector_count = data['result']['points_count']
                    print(f"✅ {collection}: {vector_count} vectors")
                else:
                    print(f"❌ {collection}: Not found or error")
                    
            except Exception as e:
                print(f"❌ {collection}: Error - {str(e)}")

    def get_product_from_db(self, product_id: int):
        """Helper to get product data from database"""
        try:
            conn = psycopg2.connect(**self.db_config)
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cursor.execute("""
                SELECT 
                  p.id, 
                  p."metaData", 
                  array_agg(pi."imageUrl") AS "imageUrls"
                FROM "ProductItem" p
                LEFT JOIN "ProductImage" pi 
                  ON p.id = pi."productItemId"
                WHERE p.id = %s
                GROUP BY p.id, p."metaData"
            """, (product_id,))
            
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if result:
                return dict(result)
            return None
            
        except Exception as e:
            print(f"Database error: {str(e)}")
            return None

    def run_full_test(self):
        """Run all tests"""
        print("🚀 Starting Fynds API Full Test Suite\n")
        print("=" * 50)
        
        # Test 1: Service Health
        self.test_services_health()
        
        # Test 2: ML Services
        self.test_ml_text_embedding()
        self.test_ml_image_embedding()
        self.test_ml_product_embedding()
        
        # Test 3: Backend Product Processing (NEW - Generate and Store)
        self.test_backend_process_product()
        
        # Test 4: Backend Search Services
        self.test_backend_text_search()
        self.test_backend_similar_products()
        
        # Test 5: Database (Should now have data)
        self.test_database_population()
        
        # Test 6: Qdrant (Should now have vectors)
        self.test_qdrant_collections()
        
        print("\n" + "=" * 50)
        print("🏁 Test suite completed!")


if __name__ == "__main__":
    print("Fynds API Testing Script")
    print("Make sure to:")
    print("1. Update database credentials in the script")
    print("2. Have a sample product image ready for testing")
    print("3. Ensure all services are running\n")
    
    tester = FyndsAPITester()
    tester.run_full_test()
