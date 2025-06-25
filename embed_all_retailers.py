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
SKIP_RETAILERS = {"Mango", "H&M", "Urban Outfitters", "Adidas", "AJE", "Meski"}

#Todo for retailers: go over beginning boutique skips and Zanerobe

# --- GET ALL RETAILERS ---
def get_all_retailers():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    # Fetch both id and retailer name from SiteDataConfig
    cur.execute('''
        SELECT DISTINCT s.id, s."retailerName"
        FROM "SiteDataConfig" s
        JOIN "ProductItem" p ON s.id = p."siteDataConfigId"
        WHERE s."retailerName" IS NOT NULL
    ''')
    retailers = [{"id": row[0], "name": row[1]} for row in cur.fetchall()]
    cur.close()
    conn.close()
    return retailers

# --- PROCESS EACH RETAILER ---
def process_all_retailers():
    retailers = get_all_retailers()
    # Filter out unwanted retailers by name and only process those with id > 30
    retailers_to_process = [
        r for r in retailers
        if r["name"]
           and r["name"] not in SKIP_RETAILERS
           and r["id"] > 119   # only process IDs above 30
    ]

    print(
        f"Found {len(retailers)} total retailers, "
        f"processing {len(retailers_to_process)} "
        f"(excluding {', '.join(SKIP_RETAILERS)} and id <= 30)."
    )

    for retailer in retailers_to_process:
        print(f"\n🚀 Processing retailer: {retailer['name']} (ID: {retailer['id']})")
        resp = requests.post(
            BACKEND_URL,
            json={"retailer": retailer['name'], "batchSize": BATCH_SIZE, "concurrency": CONCURRENCY},
        )
        if resp.status_code in [200, 201]:
            print(f"✅ {retailer['name']}: {resp.json()}")
        else:
            print(f"❌ {retailer['name']}: {resp.status_code} - {resp.text}")

if __name__ == "__main__":
    process_all_retailers()
