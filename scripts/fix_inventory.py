#!/usr/bin/env python3
"""
Recompute inventory quantities from stock movements.
The legacy StockQnty field was never maintained — real stock is SUM(QntyIn) - SUM(QntyOut).
"""

import csv
from pathlib import Path
from decimal import Decimal
import psycopg2

LEGACY_DIR = Path("/home/amar-salim/Downloads/2026_mdb_csv")
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "pos_db",
    "user": "postgres",
    "password": "SOHCAHTOA1967",
}
STORE_ID = 1


def compute_stock_from_movements():
    """Compute net stock per item from both movement CSVs."""
    stock = {}
    for filename in ("Movements.csv", "Movements2.csv"):
        path = LEGACY_DIR / filename
        if not path.exists():
            continue
        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                item = row.get("Item", "").strip()
                if not item:
                    continue
                qin = Decimal(row.get("QntyIn", "0") or "0")
                qout = Decimal(row.get("QntyOut", "0") or "0")
                if item not in stock:
                    stock[item] = {"in": Decimal("0"), "out": Decimal("0")}
                stock[item]["in"] += qin
                stock[item]["out"] += qout

    # Compute net stock
    net_stock = {}
    for item, data in stock.items():
        net = data["in"] - data["out"]
        if net > 0:
            net_stock[item] = net
    return net_stock


def main():
    print("Computing stock from movements...")
    net_stock = compute_stock_from_movements()
    print(f"Found {len(net_stock)} items with positive stock")

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()

    updated = 0
    not_found = 0
    for sku, qty in net_stock.items():
        # Find product by SKU (ItemCode)
        cur.execute(
            "SELECT id FROM products WHERE sku = %s AND store_id = %s",
            (sku, STORE_ID),
        )
        row = cur.fetchone()
        if not row:
            not_found += 1
            continue

        prod_id = row[0]
        cur.execute(
            """UPDATE inventory
               SET quantity = %s, last_updated = NOW()
               WHERE product_id = %s AND store_id = %s""",
            (qty, prod_id, STORE_ID),
        )
        updated += 1

    conn.commit()
    print(f"Updated: {updated} products")
    print(f"Not found in products table: {not_found}")

    # Show summary
    cur.execute("SELECT count(*) FROM inventory WHERE quantity > 0")
    print(f"\nProducts with stock > 0: {cur.fetchone()[0]}")
    cur.execute("SELECT count(*) FROM inventory WHERE quantity = 0")
    print(f"Products with stock = 0: {cur.fetchone()[0]}")

    conn.close()


if __name__ == "__main__":
    main()
