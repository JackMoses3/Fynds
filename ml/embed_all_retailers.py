import requests
import psycopg2

# --- CONFIG ---
BACKEND_URL = "http://localhost:3000/api/embedding-qdrant/batch-embed-retailer"
DB_CONFIG = {
    'host': 'fynds.crq8ooq0qrgr.ap-southeast-2.rds.amazonaws.com',
    'port': 5432,
    'dbname': 'fynds',
    'user': 'postgres',
    'password': 'L;0q%CUXb223(!J`>9JNX6~'
}
BATCH_SIZE = 8
CONCURRENCY = 8

# Retailers to skip
SKIP_RETAILERS = {"Mango", "H&M", "Urban Outfitters"}

# --- GET ALL RETAILERS ---
def get_all_retailers():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute('SELECT DISTINCT retailer FROM "ProductItem" WHERE retailer IS NOT NULL')
    retailers = [row[0] for row in cur.fetchall()]
    cur.close()
    conn.close()
    return retailers

# --- PROCESS EACH RETAILER ---
def process_all_retailers():
    retailers = get_all_retailers()
    # Filter out the unwanted retailers
    retailers_to_process = [r for r in retailers if r not in SKIP_RETAILERS]

    print(f"Found {len(retailers)} total retailers, processing {len(retailers_to_process)} (excluding {', '.join(SKIP_RETAILERS)}).")
    for retailer in retailers_to_process:
        print(f"\n🚀 Processing retailer: {retailer}")
        resp = requests.post(
            BACKEND_URL,
            json={"retailer": retailer, "batchSize": BATCH_SIZE, "concurrency": CONCURRENCY},
        )
        if resp.status_code in [200, 201]:
            print(f"✅ {retailer}: {resp.json()}")
        else:
            print(f"❌ {retailer}: {resp.status_code} - {resp.text}")

if __name__ == "__main__":
    process_all_retailers()
