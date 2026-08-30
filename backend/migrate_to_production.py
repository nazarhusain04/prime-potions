"""
One-time script to copy real business data from your local MongoDB into
production (MongoDB Atlas). Run this locally - your production connection
string never leaves your machine except to go straight to MongoDB.

Deliberately excludes:
  - users            (production already has your real admin account;
                       local only has demo/placeholder accounts)
  - audit_logs        (local dev history, not meaningful in production)
  - batching_workspace, batching_consumptions, products, recipes
                       (empty locally - nothing to copy)

Usage:
    python migrate_to_production.py
"""
from pymongo import MongoClient
from pymongo.errors import BulkWriteError

COLLECTIONS_TO_MIGRATE = [
    "units_of_measure",
    "locations",
    "items",
    "packaging_materials",
    "formulas",
    "formula_lines",
    "inventory_transactions",
    "stock_snapshots",
    "lot_sequences",
    "company_settings",
]


def migrate_collection(source_db, dest_db, name):
    source_count = source_db[name].count_documents({})
    dest_count = dest_db[name].count_documents({})

    if source_count == 0:
        print(f"  {name}: nothing to copy (empty locally)")
        return

    if dest_count > 0:
        print(f"  {name}: SKIPPED - destination already has {dest_count} documents (avoiding duplicates)")
        return

    docs = list(source_db[name].find({}))
    try:
        dest_db[name].insert_many(docs, ordered=False)
        print(f"  {name}: copied {len(docs)} documents")
    except BulkWriteError as e:
        inserted = len(docs) - len(e.details.get("writeErrors", []))
        print(f"  {name}: copied {inserted}/{len(docs)} documents ({len(e.details.get('writeErrors', []))} errors)")


def main():
    print("Source: local MongoDB (mongodb://localhost:27017)")
    dest_url = input("Destination MONGO_URL (production, from Railway): ").strip()
    dest_db_name = input("Destination DB_NAME [prime_potions]: ").strip() or "prime_potions"

    source_client = MongoClient("mongodb://localhost:27017")
    source_db = source_client["prime_potions"]

    print("Connecting to production...")
    dest_client = MongoClient(dest_url, serverSelectionTimeoutMS=10000)
    try:
        dest_client.admin.command("ping")
    except Exception as e:
        print(f"\nCould not reach production database: {e}")
        return
    dest_db = dest_client[dest_db_name]

    print(f"\nMigrating into database '{dest_db_name}':")
    for name in COLLECTIONS_TO_MIGRATE:
        migrate_collection(source_db, dest_db, name)

    print("\nDone.")


if __name__ == "__main__":
    main()
