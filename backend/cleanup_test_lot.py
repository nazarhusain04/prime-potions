"""
One-time script to remove a stray test lot (RM-260828-0001) that leaked
into production during earlier testing. Run this locally.

Usage:
    python cleanup_test_lot.py
"""
from pymongo import MongoClient

LOT_NUMBER = "RM-260828-0001"


def main():
    dest_url = input("Production MONGO_URL: ").strip()
    dest_db_name = input("DB_NAME [prime_potions]: ").strip() or "prime_potions"

    client = MongoClient(dest_url, serverSelectionTimeoutMS=10000)
    try:
        client.admin.command("ping")
    except Exception as e:
        print(f"\nCould not reach database: {e}")
        return

    db = client[dest_db_name]
    snap_deleted = db.stock_snapshots.delete_many({"lot_number": LOT_NUMBER}).deleted_count
    txn_deleted = db.inventory_transactions.delete_many({"lot_number": LOT_NUMBER}).deleted_count
    print(f"Deleted {snap_deleted} stock snapshot(s), {txn_deleted} transaction(s) for lot {LOT_NUMBER}")


if __name__ == "__main__":
    main()
