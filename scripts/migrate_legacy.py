#!/usr/bin/env python3
"""
Legacy StockManager.exe → Modern POS Migration Script
Reads CSVs from /home/amar-salim/Downloads/2026_mdb_csv/ and inserts into pos_db.
"""

import csv
import os
import sys
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

import psycopg2

LEGACY_DIR = Path("/home/amar-salim/Downloads/2026_mdb_csv")
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "pos_db",
    "user": "postgres",
    "password": "SOHCAHTOA1967",
}

# Store ID to use for all migrated data (single-store v1)
STORE_ID = 1
# Default user ID for migrated data (the owner user seeded earlier)
DEFAULT_USER_ID = 1


def connect():
    return psycopg2.connect(**DB_CONFIG)


def safe_decimal(val, default=Decimal("0")):
    if val is None or val == "" or val == "(Empty)":
        return default
    try:
        return Decimal(str(val).strip().replace(",", ""))
    except (InvalidOperation, ValueError):
        return default


def safe_int(val, default=0):
    if val is None or val == "" or val == "(Empty)":
        return default
    try:
        return int(float(str(val).strip().replace(",", "")))
    except (ValueError, TypeError):
        return default


def safe_str(val, default=None):
    if val is None or val == "" or val == "(Empty)":
        return default
    return str(val).strip()


def parse_date(val):
    if val is None or val == "" or val == "(Empty)" or val == "(Empty Date)":
        return None
    try:
        val = str(val).strip()
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%m/%d/%Y"):
            try:
                return datetime.strptime(val, fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        return None
    except Exception:
        return None


def read_csv(filename):
    path = LEGACY_DIR / filename
    if not path.exists():
        print(f"  [SKIP] {filename} not found")
        return []
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    print(f"  [OK] {filename}: {len(rows)} rows")
    return rows


# ─────────────────────────────────────────────────────────────
# Phase 1: Categories
# ─────────────────────────────────────────────────────────────
def migrate_categories(conn):
    print("\n=== Phase 1: Categories ===")
    rows = read_csv("GroupsT.csv")
    if not rows:
        return {}

    cur = conn.cursor()
    grp_map = {}  # GrpNo → new category.id

    for row in rows:
        grp_type = safe_int(row.get("GrpType"), 0)
        if grp_type != 0:
            continue  # skip zones (GrpType=3)

        grp_no = safe_str(row.get("GrpNo"))
        grp_name = safe_str(row.get("GrpName"))
        if not grp_no or not grp_name:
            continue

        cur.execute(
            """INSERT INTO categories (name, parent_id, store_id, created_at)
               VALUES (%s, NULL, %s, %s)
               ON CONFLICT DO NOTHING
               RETURNING id""",
            (grp_name, STORE_ID, datetime.now(timezone.utc)),
        )
        result = cur.fetchone()
        cat_id = result[0] if result else None

        if cat_id is None:
            # Already exists, fetch it
            cur.execute(
                "SELECT id FROM categories WHERE name = %s AND store_id = %s",
                (grp_name, STORE_ID),
            )
            cat_id = cur.fetchone()[0]

        grp_map[grp_no] = cat_id

    conn.commit()
    print(f"  Migrated {len(grp_map)} categories")
    return grp_map


# ─────────────────────────────────────────────────────────────
# Phase 2: Products + Inventory
# ─────────────────────────────────────────────────────────────
def migrate_products(conn, grp_map):
    print("\n=== Phase 2: Products + Inventory ===")
    rows = read_csv("ITEMS.csv")
    if not rows:
        return {}

    cur = conn.cursor()
    prod_map = {}  # ItemCode → new product.id
    count = 0

    for row in rows:
        item_code = safe_str(row.get("ItemCode"))
        item_desc = safe_str(row.get("ItemDesc"))
        if not item_code or not item_desc:
            continue

        group_code = safe_str(row.get("GroupCode"))
        category_id = grp_map.get(group_code)

        # Determine unit type
        units = safe_str(row.get("Units"), "PCS")
        if units.upper() in ("ROLL", "ROLLS", "METER", "METERS", "M"):
            unit_type = "roll"
            unit = "meters"
        else:
            unit_type = "piece"
            unit = "pcs"

        cost_price = safe_decimal(row.get("OPPrice"))
        selling_price = safe_decimal(row.get("SellingPrice01"))
        reorder = safe_decimal(row.get("ReOrderLevel"))
        brand = safe_str(row.get("Brand"))
        location = safe_str(row.get("Location"))

        # Use selling price from first tier, fallback to cost
        if selling_price <= 0 and cost_price > 0:
            selling_price = cost_price

        cur.execute(
            """INSERT INTO products
               (name, sku, category_id, store_id, unit, unit_type,
                cost_price, selling_price, reorder_level,
                is_taxable, tax_rate, is_active, created_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (store_id, sku) DO UPDATE
               SET name = EXCLUDED.name, cost_price = EXCLUDED.cost_price,
                   selling_price = EXCLUDED.selling_price
               RETURNING id""",
            (
                item_desc,
                item_code,
                category_id,
                STORE_ID,
                unit,
                unit_type,
                cost_price,
                selling_price,
                reorder,
                True,  # is_taxable
                Decimal("0.1600"),  # tax_rate
                True,  # is_active
                datetime.now(timezone.utc),
                datetime.now(timezone.utc),
            ),
        )
        result = cur.fetchone()
        prod_id = result[0] if result else None

        if prod_id is None:
            cur.execute(
                "SELECT id FROM products WHERE sku = %s AND store_id = %s",
                (item_code, STORE_ID),
            )
            prod_id = cur.fetchone()[0]

        prod_map[item_code] = prod_id

        # Create inventory record
        stock_qty = safe_decimal(row.get("StockQnty"))
        cur.execute(
            """INSERT INTO inventory (product_id, store_id, quantity, last_updated)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (product_id, store_id)
               DO UPDATE SET quantity = EXCLUDED.quantity, last_updated = EXCLUDED.last_updated""",
            (prod_id, STORE_ID, stock_qty, datetime.now(timezone.utc)),
        )
        count += 1

    conn.commit()
    print(f"  Migrated {count} products with inventory")
    return prod_map


# ─────────────────────────────────────────────────────────────
# Phase 3: Suppliers + Customers
# ─────────────────────────────────────────────────────────────
def migrate_suppliers_customers(conn):
    print("\n=== Phase 3: Suppliers + Customers ===")
    rows = read_csv("Suppliers.csv")
    if not rows:
        return {}, {}

    cur = conn.cursor()
    supplier_map = {}  # CodeNo → supplier.id
    customer_map = {}  # CodeNo → customer.id
    s_count = 0
    c_count = 0

    for row in rows:
        code_no = safe_str(row.get("CodeNo"))
        name = safe_str(row.get("Name"))
        if not code_no or not name:
            continue

        is_supplier = row.get("Supplier", "").strip() == "True"
        is_client = row.get("Client", "").strip() == "True"
        address = safe_str(row.get("Address"))
        phone = safe_str(row.get("Tel"))
        pin = safe_str(row.get("PIN"))
        vat = safe_str(row.get("VAT"))
        contact = safe_str(row.get("CPerson"))
        email = safe_str(row.get("EMail"))
        balance = safe_decimal(row.get("TotalDue"))

        if is_supplier and not is_client:
            # Supplier
            cur.execute(
                """INSERT INTO suppliers
                   (store_id, name, contact_person, phone, email, address,
                    tax_pin, balance, is_active, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT DO NOTHING
                   RETURNING id""",
                (
                    STORE_ID, name, contact, phone, email, address,
                    pin, balance, True, datetime.now(timezone.utc),
                ),
            )
            result = cur.fetchone()
            sup_id = result[0] if result else None
            if sup_id is None:
                cur.execute(
                    "SELECT id FROM suppliers WHERE name = %s AND store_id = %s",
                    (name, STORE_ID),
                )
                sup_id = cur.fetchone()[0]
            supplier_map[code_no] = sup_id
            s_count += 1

        elif is_client and not is_supplier:
            # Customer
            cur.execute(
                """INSERT INTO customers
                   (name, phone, email, address, balance, is_active, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT DO NOTHING
                   RETURNING id""",
                (name, phone, email, address, balance, True, datetime.now(timezone.utc)),
            )
            result = cur.fetchone()
            cust_id = result[0] if result else None
            if cust_id is None:
                cur.execute(
                    "SELECT id FROM customers WHERE name = %s", (name,)
                )
                cust_id = cur.fetchone()[0]
            customer_map[code_no] = cust_id
            c_count += 1

        elif is_supplier and is_client:
            # Both — create as supplier AND customer
            cur.execute(
                """INSERT INTO suppliers
                   (store_id, name, contact_person, phone, email, address,
                    tax_pin, balance, is_active, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT DO NOTHING
                   RETURNING id""",
                (
                    STORE_ID, name, contact, phone, email, address,
                    pin, balance, True, datetime.now(timezone.utc),
                ),
            )
            result = cur.fetchone()
            sup_id = result[0] if result else None
            if sup_id is None:
                cur.execute(
                    "SELECT id FROM suppliers WHERE name = %s AND store_id = %s",
                    (name, STORE_ID),
                )
                sup_id = cur.fetchone()[0]
            supplier_map[code_no] = sup_id
            s_count += 1

            cur.execute(
                """INSERT INTO customers
                   (name, phone, email, address, balance, is_active, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT DO NOTHING
                   RETURNING id""",
                (name, phone, email, address, balance, True, datetime.now(timezone.utc)),
            )
            result = cur.fetchone()
            cust_id = result[0] if result else None
            if cust_id is None:
                cur.execute(
                    "SELECT id FROM customers WHERE name = %s", (name,)
                )
                cust_id = cur.fetchone()[0]
            customer_map[code_no] = cust_id
            c_count += 1

        else:
            # Neither supplier nor client — create as customer (internal/other)
            cur.execute(
                """INSERT INTO customers
                   (name, phone, email, address, balance, is_active, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT DO NOTHING
                   RETURNING id""",
                (name, phone, email, address, balance, True, datetime.now(timezone.utc)),
            )
            result = cur.fetchone()
            cust_id = result[0] if result else None
            if cust_id is None:
                cur.execute(
                    "SELECT id FROM customers WHERE name = %s", (name,)
                )
                cust_id = cur.fetchone()[0]
            customer_map[code_no] = cust_id
            c_count += 1

    conn.commit()
    print(f"  Migrated {s_count} suppliers, {c_count} customers")
    return supplier_map, customer_map


# ─────────────────────────────────────────────────────────────
# Phase 4: Stock Movements (Movements.csv + Movements2.csv)
# ─────────────────────────────────────────────────────────────
def migrate_movements(conn, prod_map):
    print("\n=== Phase 4: Stock Movements ===")
    count = 0

    # Movements.csv (691 rows)
    for filename in ("Movements.csv", "Movements2.csv"):
        rows = read_csv(filename)
        if not rows:
            continue

        cur = conn.cursor()
        for row in rows:
            item_code = safe_str(row.get("Item"))
            if item_code not in prod_map:
                continue

            prod_id = prod_map[item_code]
            trans_date = parse_date(row.get("TransDate") or row.get("TDate"))
            if trans_date is None:
                trans_date = datetime.now(timezone.utc)

            qnty_in = safe_decimal(row.get("QntyIn"))
            qnty_out = safe_decimal(row.get("QntyOut"))
            is_grn = row.get("GRN", "").strip() == "True"
            is_min = row.get("MINTrans", "").strip() == "True"
            is_disposal = row.get("Disposal", "").strip() == "True"
            remarks = safe_str(row.get("Remarks"))
            trans_ref = safe_str(row.get("TransRefNo"))
            profit = safe_decimal(row.get("Profit"))
            avg_price = safe_decimal(row.get("AvgPrice"))
            trans_price = safe_decimal(row.get("TransPrice") or row.get("Price") or row.get("ActPrice"))
            balance_val = safe_decimal(row.get("Balance"))

            # Determine movement type
            if is_grn:
                movement_type = "in"
                quantity = qnty_in if qnty_in > 0 else qnty_out
            elif is_min:
                movement_type = "sale"
                quantity = qnty_out if qnty_out > 0 else qnty_in
            elif is_disposal:
                movement_type = "adjust"
                quantity = qnty_out if qnty_out > 0 else qnty_in
            elif qnty_in > 0:
                movement_type = "in"
                quantity = qnty_in
            elif qnty_out > 0:
                movement_type = "sale"
                quantity = qnty_out
            else:
                continue

            # Get current inventory for prev/new calculation
            cur.execute(
                "SELECT quantity FROM inventory WHERE product_id = %s AND store_id = %s",
                (prod_id, STORE_ID),
            )
            inv_row = cur.fetchone()
            current_qty = inv_row[0] if inv_row else Decimal("0")

            # Compute prev/new based on direction
            if movement_type == "in":
                prev_qty = current_qty - quantity
                new_qty = current_qty
            else:
                prev_qty = current_qty + quantity
                new_qty = current_qty

            note_parts = []
            if remarks:
                note_parts.append(remarks)
            if profit > 0:
                note_parts.append(f"Profit: {profit}")
            if avg_price > 0:
                note_parts.append(f"Avg: {avg_price}")
            note = "; ".join(note_parts) if note_parts else None

            cur.execute(
                """INSERT INTO stock_movements
                   (product_id, store_id, type, quantity, unit_sold,
                    previous_quantity, new_quantity, reference_id, note,
                    user_id, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    prod_id, STORE_ID, movement_type, quantity, None,
                    prev_qty, new_qty, trans_ref, note,
                    DEFAULT_USER_ID, trans_date,
                ),
            )
            count += 1

        conn.commit()

    print(f"  Migrated {count} stock movements")
    return count


# ─────────────────────────────────────────────────────────────
# Phase 5: GRNs → goods_received_notes + goods_received_items
# ─────────────────────────────────────────────────────────────
def migrate_grns(conn, prod_map, supplier_map):
    print("\n=== Phase 5: GRNs ===")
    rows = read_csv("GRNs.csv")
    if not rows:
        return 0

    # Group by GRNNo
    grn_groups = {}
    for row in rows:
        grn_no = safe_str(row.get("GRNNo"))
        if not grn_no:
            continue
        if grn_no not in grn_groups:
            grn_groups[grn_no] = {
                "date": parse_date(row.get("TDate")),
                "supplier": safe_str(row.get("Supplier")),
                "username": safe_str(row.get("UserName")),
                "items": [],
                "cancelled": row.get("Cancelled", "").strip() == "True",
            }
        grn_groups[grn_no]["items"].append(row)

    cur = conn.cursor()
    count = 0
    for grn_no, header in grn_groups.items():
        if header["cancelled"]:
            continue

        sup_id = supplier_map.get(header["supplier"])
        total = Decimal("0")
        for item_row in header["items"]:
            qty = safe_decimal(item_row.get("Quantity"))
            price = safe_decimal(item_row.get("Price"))
            total += qty * price

        cur.execute(
            """INSERT INTO goods_received_notes
               (store_id, grn_no, supplier_id, user_id, delivery_date,
                total_amount, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (grn_no) DO NOTHING
               RETURNING id""",
            (
                STORE_ID, grn_no, sup_id, DEFAULT_USER_ID,
                header["date"] or datetime.now(timezone.utc),
                total, datetime.now(timezone.utc),
            ),
        )
        result = cur.fetchone()
        grn_id = result[0] if result else None
        if grn_id is None:
            cur.execute(
                "SELECT id FROM goods_received_notes WHERE grn_no = %s", (grn_no,)
            )
            grn_id = cur.fetchone()[0]

        for item_row in header["items"]:
            item_code = safe_str(item_row.get("Item"))
            if item_code not in prod_map:
                continue
            prod_id = prod_map[item_code]
            qty = safe_decimal(item_row.get("Quantity"))
            price = safe_decimal(item_row.get("Price"))
            cost_price = safe_decimal(item_row.get("CostPrice"))
            if cost_price <= 0:
                cost_price = price

            cur.execute(
                """INSERT INTO goods_received_items
                   (grn_id, product_id, unit_type, quantity_received,
                    rolls_received, loose_meters_received,
                    unit_cost, total_cost)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT DO NOTHING""",
                (
                    grn_id, prod_id, "piece", qty,
                    0, Decimal("0.00"),
                    cost_price, qty * cost_price,
                ),
            )
            count += 1

        conn.commit()

    print(f"  Migrated {len(grn_groups)} GRN headers, {count} GRN line items")
    return count


# ─────────────────────────────────────────────────────────────
# Phase 6: Sales → sales + sale_items
# ─────────────────────────────────────────────────────────────
def migrate_sales(conn, prod_map, customer_map):
    print("\n=== Phase 6: Sales (MINs) ===")
    rows = read_csv("MINs.csv")
    if not rows:
        return 0

    # Group by MINNo (RefNo = document number)
    sale_groups = {}
    for row in rows:
        ref_no = safe_str(row.get("RefNo")) or safe_str(row.get("MINNo"))
        if not ref_no:
            continue
        if ref_no not in sale_groups:
            sale_groups[ref_no] = {
                "date": parse_date(row.get("TDate")),
                "customer": safe_str(row.get("Customer")),
                "client_name": safe_str(row.get("ClientName")),
                "username": safe_str(row.get("UserName")),
                "cancelled": row.get("Cancelled", "").strip() == "True",
                "credit": row.get("Credit", "").strip() == "True",
                "unpaid": row.get("UnPaid", "").strip() == "True",
                "amt_received": safe_decimal(row.get("AmtRecvd")),
                "items": [],
            }
        sale_groups[ref_no]["items"].append(row)

    cur = conn.cursor()
    count = 0
    for ref_no, header in sale_groups.items():
        if header["cancelled"]:
            continue

        cust_id = customer_map.get(header["customer"])

        # Compute totals
        subtotal = Decimal("0")
        total_tax = Decimal("0")
        for item_row in header["items"]:
            qty = safe_decimal(item_row.get("Qnty"))
            price = safe_decimal(item_row.get("Price"))
            qty2 = safe_decimal(item_row.get("Qnty2"))
            price2 = safe_decimal(item_row.get("Price2"))
            line_total = qty * price
            if qty2 > 0 and price2 > 0:
                line_total = qty2 * price2
            subtotal += line_total

        # Determine payment status
        if header["unpaid"] or (header["credit"] and header["amt_received"] <= 0):
            status = "unpaid"
        elif header["amt_received"] >= subtotal and subtotal > 0:
            status = "paid"
        elif header["amt_received"] > 0:
            status = "partial"
        else:
            status = "paid"  # default for legacy data

        cur.execute(
            """INSERT INTO sales
               (invoice_no, customer_id, store_id, user_id,
                subtotal, tax_amount, discount_amount, total_amount,
                payment_method, status, is_etr, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (invoice_no) DO NOTHING
               RETURNING id""",
            (
                ref_no, cust_id, STORE_ID, DEFAULT_USER_ID,
                subtotal, total_tax, Decimal("0"), subtotal,
                "cash" if status == "paid" else "credit",
                status, False,
                header["date"] or datetime.now(timezone.utc),
            ),
        )
        result = cur.fetchone()
        sale_id = result[0] if result else None
        if sale_id is None:
            cur.execute(
                "SELECT id FROM sales WHERE invoice_no = %s", (ref_no,)
            )
            sale_id = cur.fetchone()[0]

        for item_row in header["items"]:
            item_code = safe_str(item_row.get("Item"))
            if item_code not in prod_map:
                continue
            prod_id = prod_map[item_code]

            qty = safe_decimal(item_row.get("Qnty"))
            price = safe_decimal(item_row.get("Price"))
            qty2 = safe_decimal(item_row.get("Qnty2"))
            price2 = safe_decimal(item_row.get("Price2"))
            profit = safe_decimal(item_row.get("Profit"))

            # Determine unit_sold and quantity
            if qty2 > 0 and price2 > 0:
                unit_sold = "meter"
                quantity = qty2
                unit_price = price2
            elif qty > 0:
                unit_sold = "piece"
                quantity = qty
                unit_price = price
            else:
                continue

            # Derive cost_price from profit: cost = price - profit
            cost_price = unit_price - profit if profit > 0 else unit_price
            if cost_price < 0:
                cost_price = unit_price

            line_total = quantity * unit_price

            cur.execute(
                """INSERT INTO sale_items
                   (sale_id, product_id, unit_type, unit_sold, quantity,
                    rolls_qty, loose_meters, unit_price, cost_price,
                    tax_rate, total)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT DO NOTHING""",
                (
                    sale_id, prod_id, "piece", unit_sold, quantity,
                    None, None, unit_price, cost_price,
                    Decimal("0.0000"), line_total,
                ),
            )
            count += 1

        conn.commit()

    print(f"  Migrated {len(sale_groups)} sales, {count} sale items")
    return count


# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("Legacy StockManager.exe → Modern POS Migration")
    print("=" * 60)

    conn = connect()
    try:
        # Phase 1: Categories
        grp_map = migrate_categories(conn)

        # Phase 2: Products + Inventory
        prod_map = migrate_products(conn, grp_map)

        # Phase 3: Suppliers + Customers
        supplier_map, customer_map = migrate_suppliers_customers(conn)

        # Phase 4: Stock Movements
        migrate_movements(conn, prod_map)

        # Phase 5: GRNs
        migrate_grns(conn, prod_map, supplier_map)

        # Phase 6: Sales
        migrate_sales(conn, prod_map, customer_map)

        # Final counts
        print("\n" + "=" * 60)
        print("Migration Complete — Final Counts:")
        print("=" * 60)
        cur = conn.cursor()
        tables = [
            "categories", "products", "inventory", "stock_movements",
            "suppliers", "customers", "goods_received_notes",
            "goods_received_items", "sales", "sale_items",
        ]
        for tbl in tables:
            cur.execute(f"SELECT count(*) FROM {tbl}")
            print(f"  {tbl}: {cur.fetchone()[0]}")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
