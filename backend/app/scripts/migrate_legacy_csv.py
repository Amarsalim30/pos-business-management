"""
Legacy CSV Inventory Migration Script
Imports categories and products from legacy MDB CSV files (/home/amar-salim/Downloads/2026_mdb_csv).

Fixes over original version:
- Uses StockBalances.csv (ClBalWhole) as authoritative stock source instead of SysBal
- Derives meters_per_roll from SellingPrice01 / SellingPriceLoose01 instead of hardcoding 100
- Uses SellingPriceLoose01 / OPPriceLse01 directly for per-meter prices
- Roll detection uses Units='ROLL' or distinct loose pricing, not keyword matching
- Respects legacy VAT=0 (is_taxable=False, tax_rate=0) instead of defaulting to 16%
- Supports idempotent re-runs: updates existing products and inventory
"""

import os
import csv
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Optional
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.product import Category, Product
from app.models.inventory import Inventory, StockMovement
from app.models.store import Store
from app.models.user import User


def _safe_decimal(value: Optional[str], default: str = "0") -> Decimal:
    """Safely parse a string to Decimal, returning default on failure."""
    try:
        return Decimal(str(value or default))
    except Exception:
        return Decimal(default)


def _is_roll_product(units: str, sp01: Decimal, sploose01: Decimal) -> bool:
    """
    Determine if a product is a roll product.
    A product is a roll if:
    - Units field == 'ROLL', OR
    - It has distinct per-meter pricing (SellingPriceLoose01 > 0 and != SellingPrice01)
    """
    if units.upper() == "ROLL":
        return True
    if sploose01 > 0 and sp01 > 0 and sploose01 != sp01:
        return True
    return False


def _derive_meters_per_roll(sp01: Decimal, sploose01: Decimal) -> Decimal:
    """
    Derive meters_per_roll from the legacy price relationship:
    meters_per_roll = SellingPrice01 / SellingPriceLoose01
    Falls back to 100 if derivation isn't possible.
    """
    if sp01 > 0 and sploose01 > 0 and sploose01 != sp01:
        mpr = (sp01 / sploose01).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        if mpr > 0:
            return mpr
    return Decimal("100.00")


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
        category_map: Dict[str, Category] = {}  # GrpNo -> Category

        if os.path.exists(groups_path):
            with open(groups_path, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    grp_no = (row.get("GrpNo") or "").strip()
                    grp_name = (row.get("GrpName") or "").strip()
                    if not grp_name:
                        continue

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

        # 3. Stock source: ITEMS.SysBal only (legacy ledger data is unreliable)
        print("ℹ️ Using ITEMS.SysBal as the sole stock source (per user decision)")

        # 4. Build cost price map from GRNs.csv + Movements2.csv (latest GRN cost per item)
        grn_costs: Dict[str, Decimal] = {}

        # Source 1: GRNs.csv CostPrice (primary) — LATEST GRN per item wins.
        # The CSV is NOT sorted chronologically, so rank rows by (TDate, GRNNo, file order).
        # Rows with zero/blank cost are skipped (legacy blanks = not recorded, not free).
        grn_costs: Dict[str, Decimal] = {}

        # Source 1: GRNs.csv CostPrice (primary)
        grns_path = os.path.join(csv_dir, "GRNs.csv")
        if os.path.exists(grns_path):
            best: Dict[str, tuple] = {}  # item -> ((tdate, grn_no, seq), cost)
            with open(grns_path, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.DictReader(f)
                for seq, row in enumerate(reader):
                    item_code = (row.get("Item") or "").strip()
                    cost_price = _safe_decimal(row.get("CostPrice"))
                    if not item_code or cost_price <= 0:
                        continue
                    try:
                        tdate = datetime.strptime((row.get("TDate") or "").strip()[:8], "%m/%d/%y")
                    except Exception:
                        tdate = datetime.min
                    try:
                        grn_no = int((row.get("GRNNo") or "0").strip() or 0)
                    except Exception:
                        grn_no = 0
                    key = (tdate, grn_no, seq)
                    if item_code not in best or key >= best[item_code][0]:
                        best[item_code] = (key, cost_price)
            grn_costs = {item: cost for item, (_, cost) in best.items()}
            print(f"✅ GRNs.csv costs loaded: {len(grn_costs)} items (latest GRN by date wins)")

        # Source 2: Movements2.csv Price column for GRN rows (补充)
        mov2_path = os.path.join(csv_dir, "Movements2.csv")
        if os.path.exists(mov2_path):
            mov2_count = 0
            with open(mov2_path, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get("GRN") == "True":
                        item_code = (row.get("Item") or "").strip()
                        cost_price = _safe_decimal(row.get("Price"))
                        if item_code and cost_price > 0 and item_code not in grn_costs:
                            grn_costs[item_code] = cost_price
                            mov2_count += 1
            print(f"✅ Movements2.csv补充: {mov2_count} additional items (total: {len(grn_costs)})")

        # 5. Migrate Products from ITEMS.csv
        items_path = os.path.join(csv_dir, "ITEMS.csv")
        if not os.path.exists(items_path):
            print(f"❌ ITEMS.csv not found at {items_path}")
            return

        created_count = 0
        updated_count = 0
        skipped_zero_stock = 0
        roll_count = 0

        with open(items_path, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.DictReader(f)
            for row in reader:
                item_code = (row.get("ItemCode") or "").strip()
                item_desc = (row.get("ItemDesc") or "").strip()
                if not item_code or not item_desc:
                    continue

                # --- Stock: ITEMS.SysBal only ---
                stock_to_use = _safe_decimal(row.get("SysBal"))
                if stock_to_use < 0:
                    stock_to_use = Decimal("0")

                # Check if product already exists in DB (from previous migration run)
                existing_prod = db.query(Product).filter(Product.store_id == store.id, Product.sku == item_code).first()

                # --- Prices ---
                sp = _safe_decimal(row.get("SellingPrice01"))
                bp = _safe_decimal(row.get("OPPrice01"))
                if bp <= 0:
                    bp = grn_costs.get(item_code, Decimal("0"))
                sp_loose = _safe_decimal(row.get("SellingPriceLoose01"))
                bp_loose = _safe_decimal(row.get("OPPriceLse01"))
                reorder = _safe_decimal(row.get("ReOrderLevel"), "5")
                if reorder <= 0:
                    reorder = Decimal("5")

                units = (row.get("Units") or "pcs").strip()
                group_code = (row.get("GroupCode") or "").strip()
                category = category_map.get(group_code)

                # --- Roll detection (pricing-based, not keyword-based) ---
                is_roll = _is_roll_product(units, sp, sp_loose)
                unit_type = "roll" if is_roll else "piece"

                if is_roll:
                    meters_per_roll = _derive_meters_per_roll(sp, sp_loose)
                    price_per_meter = sp_loose if sp_loose > 0 else None
                    cost_per_meter = bp_loose if bp_loose > 0 else None
                else:
                    meters_per_roll = None
                    price_per_meter = None
                    cost_per_meter = None

                # --- VAT from legacy (all items have VAT=0.0 in this dataset) ---
                vat_val = _safe_decimal(row.get("VAT"))
                is_taxable = vat_val > 0
                tax_rate = vat_val if vat_val > 0 else Decimal("0.0000")

                # --- Upsert Product ---
                prod = existing_prod
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
                        price_per_roll=sp if is_roll else None,
                        price_per_meter=price_per_meter,
                        cost_per_meter=cost_per_meter,
                        reorder_level=reorder,
                        is_taxable=is_taxable,
                        tax_rate=tax_rate,
                        is_active=True
                    )
                    db.add(prod)
                    db.flush()
                    created_count += 1
                else:
                    prod.name = item_desc
                    prod.category_id = category.id if category else prod.category_id
                    prod.unit = "meters" if is_roll else (units or "pcs")
                    prod.unit_type = unit_type
                    prod.meters_per_roll = meters_per_roll
                    prod.cost_price = bp
                    prod.selling_price = sp
                    prod.price_per_roll = sp if is_roll else None
                    prod.price_per_meter = price_per_meter
                    prod.cost_per_meter = cost_per_meter
                    prod.reorder_level = reorder
                    prod.is_taxable = is_taxable
                    prod.tax_rate = tax_rate
                    updated_count += 1

                if is_roll:
                    roll_count += 1

                # --- Upsert Inventory ---
                inv = db.query(Inventory).filter(Inventory.product_id == prod.id, Inventory.store_id == store.id).first()
                if not inv:
                    inv = Inventory(
                        product_id=prod.id,
                        store_id=store.id,
                        quantity=stock_to_use
                    )
                    db.add(inv)
                    if stock_to_use > 0:
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
                else:
                    old_qty = inv.quantity
                    inv.quantity = stock_to_use
                    if old_qty != stock_to_use:
                        mov = StockMovement(
                            product_id=prod.id,
                            store_id=store.id,
                            type="adjust",
                            quantity=stock_to_use - old_qty,
                            unit_sold="meter" if is_roll else "piece",
                            previous_quantity=old_qty,
                            new_quantity=stock_to_use,
                            reference_id="LEGACY_MDB_MIGRATION",
                            note=f"Stock corrected from legacy MDB (ItemCode: {item_code}): {old_qty} -> {stock_to_use}",
                            user_id=user_id
                        )
                        db.add(mov)

            db.commit()
            total = created_count + updated_count
            print(f"\n🎉 Legacy migration finished!")
            print(f"   • Products created: {created_count}")
            print(f"   • Products updated: {updated_count}")
            print(f"   • Total imported: {total}")
            print(f"   • Roll products: {roll_count}")
            print(f"   • Zero stock skipped: {skipped_zero_stock}")

    except Exception as e:
        db.rollback()
        print(f"❌ Migration failed with error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_legacy_data()
