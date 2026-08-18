"""
Legacy CSV Inventory Migration Script
Imports categories and products from legacy MDB CSV files (/home/amar-salim/Downloads/2026_mdb_csv).
Filters only products with positive stock (SysBal > 0 or StockQnty > 0).
Auto-detects roll products (e.g. cables, flex, wires, units='ROLL') and sets meters_per_roll = 100.
"""

import os
import csv
from decimal import Decimal
from typing import Dict, Optional
from sqlalchemy.orm import Session
from backend.app.core.database import SessionLocal
from backend.app.models.product import Category, Product
from backend.app.models.inventory import Inventory, StockMovement
from backend.app.models.store import Store
from backend.app.models.user import User


def migrate_legacy_data(csv_dir: str = "/home/amar-salim/Downloads/2026_mdb_csv", store_id: Optional[int] = None):
    db: Session = SessionLocal()
    try:
        # 1. Resolve Store and Owner
        store = db.query(Store).filter(Store.id == store_id).first() if store_id else db.query(Store).first()
        if not store:
            print("❌ No store found. Please initialize the system first.")
            return

        owner = db.query(User).filter(User.role == "owner").first()
        user_id = owner.id if owner else 1

        print(f"📦 Starting migration for Store: '{store.name}' (ID: {store.id})")

        # 2. Migrate Categories from GroupsT.csv
        groups_path = os.path.join(csv_dir, "GroupsT.csv")
        category_map: Dict[str, Category] = {} # GrpNo -> Category
        
        if os.path.exists(groups_path):
            with open(groups_path, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    grp_no = (row.get("GrpNo") or "").strip()
                    grp_name = (row.get("GrpName") or "").strip()
                    if not grp_name:
                        continue
                    
                    # Avoid duplicate categories
                    cat = db.query(Category).filter(Category.store_id == store.id, Category.name == grp_name).first()
                    if not cat:
                        cat = Category(name=grp_name, store_id=store.id)
                        db.add(cat)
                        db.flush()
                    category_map[grp_no] = cat
            db.commit()
            print(f"✅ Categories imported/verified: {len(category_map)}")
        else:
            print(f"⚠️ GroupsT.csv not found at {groups_path}")

        # 3. Migrate Products with Stock from ITEMS.csv
        items_path = os.path.join(csv_dir, "ITEMS.csv")
        if not os.path.exists(items_path):
            print(f"❌ ITEMS.csv not found at {items_path}")
            return

        imported_count = 0
        skipped_zero_stock = 0

        with open(items_path, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.DictReader(f)
            for row in reader:
                item_code = (row.get("ItemCode") or "").strip()
                item_desc = (row.get("ItemDesc") or "").strip()
                if not item_code or not item_desc:
                    continue

                # Stock check: SysBal or StockQnty
                try:
                    sys_bal = Decimal(str(row.get("SysBal") or "0"))
                except Exception:
                    sys_bal = Decimal("0")

                try:
                    stock_qnty = Decimal(str(row.get("StockQnty") or "0"))
                except Exception:
                    stock_qnty = Decimal("0")

                stock_to_use = sys_bal if sys_bal > 0 else stock_qnty
                if stock_to_use <= 0:
                    skipped_zero_stock += 1
                    continue

                # Prices
                try:
                    sp = Decimal(str(row.get("SellingPrice01") or row.get("SellingPrice") or "0"))
                except Exception:
                    sp = Decimal("0")

                try:
                    bp = Decimal(str(row.get("OPPrice01") or row.get("OPPrice") or "0"))
                except Exception:
                    bp = Decimal("0")

                try:
                    reorder = Decimal(str(row.get("ReOrderLevel") or "5"))
                except Exception:
                    reorder = Decimal("5")

                units = (row.get("Units") or "pcs").strip()
                group_code = (row.get("GroupCode") or "").strip()
                category = category_map.get(group_code)

                # Detect Roll product
                is_roll = False
                upper_desc = item_desc.upper()
                upper_unit = units.upper()
                if upper_unit == "ROLL" or any(kw in upper_desc for kw in ["CABLE", "WIRE", "CONDUIT", "FLEX"]):
                    is_roll = True

                unit_type = "roll" if is_roll else "piece"
                meters_per_roll = Decimal("100.00") if is_roll else None
                price_per_meter = (sp / Decimal("100.00")) if is_roll and sp > 0 else None
                cost_per_meter = (bp / Decimal("100.00")) if is_roll and bp > 0 else None

                # Check if product already exists
                prod = db.query(Product).filter(Product.store_id == store.id, Product.sku == item_code).first()
                if not prod:
                    prod = Product(
                        name=item_desc,
                        sku=item_code,
                        category_id=category.id if category else None,
                        store_id=store.id,
                        unit="meters" if is_roll else (units or "pcs"),
                        unit_type=unit_type,
                        meters_per_roll=meters_per_roll,
                        cost_price=bp,
                        selling_price=sp,
                        price_per_meter=price_per_meter,
                        cost_per_meter=cost_per_meter,
                        reorder_level=reorder,
                        is_taxable=True,
                        is_active=True
                    )
                    db.add(prod)
                    db.flush()

                # Upsert Inventory
                inv = db.query(Inventory).filter(Inventory.product_id == prod.id, Inventory.store_id == store.id).first()
                if not inv:
                    inv = Inventory(
                        product_id=prod.id,
                        store_id=store.id,
                        quantity=stock_to_use
                    )
                    db.add(inv)
                else:
                    inv.quantity = stock_to_use

                # Log Migration Movement
                mov = StockMovement(
                    product_id=prod.id,
                    store_id=store.id,
                    type="in",
                    quantity=stock_to_use,
                    unit_sold="meter" if is_roll else "piece",
                    previous_quantity=Decimal("0.00"),
                    new_quantity=stock_to_use,
                    reference_id="LEGACY_MDB_MIGRATION",
                    note=f"Imported from legacy MDB (ItemCode: {item_code})",
                    user_id=user_id
                )
                db.add(mov)
                imported_count += 1

            db.commit()
            print(f"🎉 Legacy migration finished successfully!")
            print(f"   • Products with active stock imported: {imported_count}")
            print(f"   • Zero stock items skipped: {skipped_zero_stock}")

    except Exception as e:
        db.rollback()
        print(f"❌ Migration failed with error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_legacy_data()
