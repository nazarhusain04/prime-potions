"""
Read-only look at what products and packaging BOMs exist in production.

Writes nothing - it only reads and prints. Safe to run any time.

Run this locally - your production connection string never leaves your machine.

Usage:
    python check_production.py
"""
from pymongo import MongoClient


def report(db, label):
    products = list(db.products.find({}, {"_id": 0}))
    packaging = {m["id"]: m for m in db.packaging_materials.find({}, {"_id": 0})}
    print(f"\n{'=' * 68}\n{label}: {len(products)} products\n{'=' * 68}")
    if not products:
        print("  (none)")
        return
    for p in sorted(products, key=lambda x: x.get("sku", "")):
        recipe = db.recipes.find_one({"product_id": p["id"], "is_active": True}, {"_id": 0})
        lines = recipe.get("filling_components", []) if recipe else []
        fw = p.get("fill_weight_grams")
        print(f"\n  {p.get('sku', '?'):12} {p.get('name', '?')}")
        print(f"       fill weight: {str(fw) + ' g' if fw else 'not set (estimated from name)'}")
        if not recipe:
            print("       BOM: NONE")
            continue
        print(f"       BOM: {len(lines)} lines")
        for fc in lines:
            mat = packaging.get(fc.get("material_id"))
            qty = fc.get("quantity")
            each = f"1 per {round(1 / qty):g} units" if qty and qty < 1 else f"{qty:g} per unit"
            if mat:
                print(f"         {mat.get('sku', '?'):24} {mat.get('name', '?')[:36]:38} {each}")
            else:
                print(f"         MISSING MATERIAL {fc.get('material_id')} - broken BOM line")


def main():
    print(__doc__)
    dest_url = input("Production MONGO_URL (blank to check local only): ").strip()

    if dest_url:
        db_name = input("DB_NAME [prime_potions]: ").strip() or "prime_potions"
        client = MongoClient(dest_url, serverSelectionTimeoutMS=10000)
        try:
            client.admin.command("ping")
        except Exception as e:
            print(f"\nCould not reach production database: {e}")
            return
        report(client[db_name], "PRODUCTION")

    local = MongoClient("mongodb://localhost:27017")["prime_potions"]
    report(local, "LOCAL (your machine)")

    print("\nCompare the two lists above to see what is missing from production.")


if __name__ == "__main__":
    main()
