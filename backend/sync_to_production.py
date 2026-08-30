"""
Incrementally sync local changes into production - unlike migrate_to_production.py
(which only does a one-time full copy into empty collections), this upserts:
  - locations: matched by code
  - items: matched by id (updates location fields, inserts any new ones)
  - inventory_transactions: matched by id (inserts new ones only - transactions
    are never modified after creation)
  - stock_snapshots: matched by (item_id, item_type, lot_number, location_id),
    replaced with the latest computed values

Run this locally - your production connection string never leaves your machine.

Usage:
    python sync_to_production.py
"""
from pymongo import MongoClient, UpdateOne


def main():
    dest_url = input("Production MONGO_URL: ").strip()
    dest_db_name = input("DB_NAME [prime_potions]: ").strip() or "prime_potions"

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
    print("Connected.\n")

    # --- locations: upsert by code ---
    ops = []
    for doc in source_db.locations.find({}, {"_id": 0}):
        ops.append(UpdateOne({"code": doc["code"]}, {"$set": doc}, upsert=True))
    if ops:
        result = dest_db.locations.bulk_write(ops)
        print(f"locations: {result.upserted_count} inserted, {result.modified_count} updated")

    # --- items: upsert by id ---
    ops = []
    for doc in source_db.items.find({}, {"_id": 0}):
        ops.append(UpdateOne({"id": doc["id"]}, {"$set": doc}, upsert=True))
    if ops:
        result = dest_db.items.bulk_write(ops)
        print(f"items: {result.upserted_count} inserted, {result.modified_count} updated")

    # --- packaging_materials: upsert by id ---
    ops = []
    for doc in source_db.packaging_materials.find({}, {"_id": 0}):
        ops.append(UpdateOne({"id": doc["id"]}, {"$set": doc}, upsert=True))
    if ops:
        result = dest_db.packaging_materials.bulk_write(ops)
        print(f"packaging_materials: {result.upserted_count} inserted, {result.modified_count} updated")

    # --- formulas / formula_lines: upsert by id ---
    for coll_name in ["formulas", "formula_lines"]:
        ops = []
        for doc in source_db[coll_name].find({}, {"_id": 0}):
            ops.append(UpdateOne({"id": doc["id"]}, {"$set": doc}, upsert=True))
        if ops:
            result = dest_db[coll_name].bulk_write(ops)
            print(f"{coll_name}: {result.upserted_count} inserted, {result.modified_count} updated")

    # --- inventory_transactions: insert new ones only (never modified) ---
    existing_ids = set(dest_db.inventory_transactions.distinct("id"))
    new_txns = [
        doc for doc in source_db.inventory_transactions.find({}, {"_id": 0})
        if doc["id"] not in existing_ids
    ]
    if new_txns:
        dest_db.inventory_transactions.insert_many(new_txns)
    print(f"inventory_transactions: {len(new_txns)} new transactions inserted")

    # --- stock_snapshots: replace with latest computed values ---
    ops = []
    for doc in source_db.stock_snapshots.find({}, {"_id": 0}):
        key = {
            "item_id": doc["item_id"],
            "item_type": doc["item_type"],
            "lot_number": doc["lot_number"],
            "location_id": doc["location_id"],
        }
        ops.append(UpdateOne(key, {"$set": doc}, upsert=True))
    if ops:
        result = dest_db.stock_snapshots.bulk_write(ops)
        print(f"stock_snapshots: {result.upserted_count} inserted, {result.modified_count} updated")

    print("\nDone.")


if __name__ == "__main__":
    main()
