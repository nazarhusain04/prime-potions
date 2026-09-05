"""
Sync ONLY products, their packaging BOMs (recipes), and the packaging materials those
BOMs reference, from local into production.

Deliberately narrow. It does NOT touch inventory_transactions or stock_snapshots, so
local test batches, filling orders and finished-goods lots stay local where they belong.
Use sync_to_production.py only when you actually intend to move inventory history.

Runs a dry run first and prints exactly what would change. Nothing is written until you
type "yes" at the confirmation prompt.

Run this locally - your production connection string never leaves your machine.

Usage:
    python sync_products_and_boms.py
"""
from pymongo import MongoClient, UpdateOne

# Only these products get synced. Add a SKU here once its BOM has been checked against
# the real packaging - pack ratios and packaging SKUs both.
SKUS_TO_SYNC = [
    "HBG-1OZ",  # Paume Hand Balm 1oz - tube + 9x8x8 box of 100, confirmed
    "HBG-2OZ",  # Paume Hand Balm 2oz - tube + 6x6x6 of 12 + 24x18x14 master of 24, confirmed
]

# Left out on purpose. Their BOMs were filled in with assumed pack ratios and, in places,
# assumed packaging materials. On live they would drive Feasibility and deduct real
# packaging stock from numbers nobody confirmed. Move a SKU up once it is checked.
SKUS_PENDING_VERIFICATION = [
    "HBG-10OZ",    # Paume - jar/lid/label split and 1/12, 1/48 assumed
    "PFS101-2OZ",  # Plantd Facial Scrub  - jar, metal lid, 2 labels, 1/24, 1/96 assumed
    "FCS101-1OZ",  # Plantd Facial Serum  - dropper bottle, cap, label, 1/24, 1/96 assumed
    "PFN101-2OZ",  # Plantd Night Cream   - jar, metal lid, 2 labels, 1/24, 1/96 assumed
    "PFD101-2OZ",  # Plantd Day Cream     - jar, metal lid, 2 labels, 1/24, 1/96 assumed
]


def describe(local_db, skus):
    """Show what will be pushed, so it can be checked before anything is written."""
    products = list(local_db.products.find({"sku": {"$in": skus}}, {"_id": 0}))
    found = {p["sku"] for p in products}
    for missing in set(skus) - found:
        print(f"  WARNING: no local product with SKU {missing} - skipping")

    pack_by_id = {m["id"]: m for m in local_db.packaging_materials.find({}, {"_id": 0})}
    recipes, needed_materials = [], {}

    for p in sorted(products, key=lambda x: x["sku"]):
        recipe = local_db.recipes.find_one(
            {"product_id": p["id"], "is_active": True}, {"_id": 0}
        )
        fw = p.get("fill_weight_grams")
        print(f"\n  {p['sku']:12} {p['name']}")
        print(f"       fill weight: {str(fw) + ' g' if fw else 'not set (estimated from name)'}")
        if not recipe:
            print("       NO BOM - product will sync, but nothing to fill it with")
            continue
        recipes.append(recipe)
        for fc in recipe.get("filling_components", []):
            mat = pack_by_id.get(fc.get("material_id"))
            if mat:
                needed_materials[mat["id"]] = mat
                per_unit = fc.get("quantity")
                each = f"1 per {round(1 / per_unit):g} units" if per_unit and per_unit < 1 else f"{per_unit:g} per unit"
                print(f"       {mat['sku']:24} {mat['name'][:38]:40} {each}")
            else:
                print(f"       MISSING packaging material {fc.get('material_id')} - BOM line will be broken")

    return products, recipes, list(needed_materials.values())


def main():
    print(__doc__)
    local_client = MongoClient("mongodb://localhost:27017")
    local_db = local_client["prime_potions"]

    print("=" * 70)
    print("DRY RUN - what would be pushed to production")
    print("=" * 70)
    products, recipes, materials = describe(local_db, SKUS_TO_SYNC)
    print("\n" + "=" * 70)
    print(f"  {len(products)} products, {len(recipes)} BOMs, {len(materials)} packaging materials")
    print("  NOT included: inventory, transactions, stock, batches, filling orders")
    if SKUS_PENDING_VERIFICATION:
        print(f"\n  Held back until their BOMs are checked ({len(SKUS_PENDING_VERIFICATION)}):")
        for sku in SKUS_PENDING_VERIFICATION:
            print(f"    {sku}")
    print("=" * 70)

    if not products:
        print("\nNothing to sync.")
        return

    dest_url = input("\nProduction MONGO_URL (blank to stop here): ").strip()
    if not dest_url:
        print("Stopped - nothing was written.")
        return
    dest_db_name = input("DB_NAME [prime_potions]: ").strip() or "prime_potions"

    print("\nConnecting to production...")
    dest_client = MongoClient(dest_url, serverSelectionTimeoutMS=10000)
    try:
        dest_client.admin.command("ping")
    except Exception as e:
        print(f"Could not reach production database: {e}")
        return
    dest_db = dest_client[dest_db_name]
    print("Connected.")

    # Show whether each product is new or an overwrite before committing to anything.
    print("\nAgainst production right now:")
    for p in sorted(products, key=lambda x: x["sku"]):
        existing = dest_db.products.find_one({"sku": p["sku"]}, {"_id": 0})
        if not existing:
            print(f"  {p['sku']:12} NEW")
        else:
            existing_bom = dest_db.recipes.find_one(
                {"product_id": existing["id"], "is_active": True}, {"_id": 0}
            )
            lines = len(existing_bom.get("filling_components", [])) if existing_bom else 0
            print(f"  {p['sku']:12} EXISTS - will be overwritten (its BOM today has {lines} lines)")

    if input('\nType "yes" to write these to production: ').strip().lower() != "yes":
        print("Stopped - nothing was written.")
        return

    for name, docs, key in (
        ("packaging_materials", materials, "id"),
        ("products", products, "id"),
        ("recipes", recipes, "id"),
    ):
        if not docs:
            continue
        result = dest_db[name].bulk_write(
            [UpdateOne({key: d[key]}, {"$set": d}, upsert=True) for d in docs]
        )
        print(f"  {name}: {result.upserted_count} inserted, {result.modified_count} updated")

    print("\nDone. Check the Products and Recipes/BOM pages on the live site.")


if __name__ == "__main__":
    main()
