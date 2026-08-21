"""Recompute exact product stock from legacy data.

Formula (verified against ledger):
    current = ITEMS.SysBal (opening whole units)
            + ITEMS.SysBal2 (opening loose meters)
            + net(Movements2 rows EXCLUDING the year-start restatement batch ref '0101261')

Items whose computed stock is negative have unrecorded purchases in the legacy
data (sales exceed recorded supply); they are floored at 0 and flagged for
physical stock take.
"""

import csv
from decimal import Decimal
from typing import Dict, Tuple

from app.core.database import SessionLocal
from app.models.inventory import Inventory, StockMovement
from app.models.product import Product
from app.models.store import Store
from app.models.user import User

CSV_DIR = "/home/amar-salim/Documents/Projects/pos-business/docs/data/2026_3_csv"
OPENING_REF = "0101261"


def _d(value) -> Decimal:
    try:
        return Decimal(str(value or "0"))
    except Exception:
        return Decimal("0")


def compute_legacy_stock() -> Dict[str, Tuple[Decimal, Decimal]]:
    """Return {item_code: (computed_stock, raw_computed)} from legacy CSVs."""
    with open(f"{CSV_DIR}/ITEMS.csv", encoding="utf-8", errors="ignore") as f:
        items = {
            (r["ItemCode"] or "").strip(): (_d(r.get("SysBal")), _d(r.get("SysBal2")))
            for r in csv.DictReader(f)
            if (r.get("ItemCode") or "").strip()
        }

    net: Dict[str, Decimal] = {}
    with open(f"{CSV_DIR}/Movements2.csv", encoding="utf-8", errors="ignore") as f:
        for r in csv.DictReader(f):
            if (r.get("TransRefNo") or "").strip() == OPENING_REF:
                continue  # year-start opening restatement, already in SysBal/SysBal2
            item = (r.get("Item") or "").strip()
            if not item:
                continue
            net[item] = net.get(item, Decimal("0")) + _d(r.get("QntyIn")) - _d(r.get("QntyOut"))

    result: Dict[str, Tuple[Decimal, Decimal]] = {}
    for code, (sys_bal, sys_bal2) in items.items():
        raw = sys_bal + sys_bal2 + net.get(code, Decimal("0"))
        result[code] = (raw if raw > 0 else Decimal("0"), raw)
    return result


def apply_to_db() -> None:
    db = SessionLocal()
    try:
        store = db.query(Store).first()
        owner = db.query(User).filter(User.role == "owner").first()
        user_id = owner.id if owner else 1

        stocks = compute_legacy_stock()
        products = db.query(Product).filter(Product.store_id == store.id).all()

        updated = unchanged = missing_inv = 0
        negative_flagged = []
        big_changes = []

        for prod in products:
            computed, raw = stocks.get((prod.sku or "").strip(), (None, None))
            if computed is None:
                continue
            inv = db.query(Inventory).filter(
                Inventory.product_id == prod.id, Inventory.store_id == store.id
            ).first()
            if not inv:
                missing_inv += 1
                continue
            old_qty = inv.quantity
            if old_qty == computed:
                unchanged += 1
                continue
            inv.quantity = computed
            updated += 1
            db.add(StockMovement(
                product_id=prod.id,
                store_id=store.id,
                type="adjust",
                quantity=computed - old_qty,
                unit_sold="meter" if prod.unit_type == "roll" else "piece",
                previous_quantity=old_qty,
                new_quantity=computed,
                reference_id="LEGACY_STOCK_RECOMPUTE",
                note=f"Exact stock from legacy ledger (ItemCode: {prod.sku})",
                user_id=user_id,
            ))
            if raw < 0:
                negative_flagged.append((prod.sku, prod.name[:35], str(old_qty), str(computed), str(raw)))
            elif abs(computed - old_qty) >= 10:
                big_changes.append((prod.sku, prod.name[:35], str(old_qty), str(computed)))

        db.commit()
        print(f"Stock recomputed for {len(products)} products:")
        print(f"   • updated: {updated} | unchanged: {unchanged} | no inventory row: {missing_inv}")
        print(f"\n⚠️  Negative in legacy ledger (floored to 0, need physical count): {len(negative_flagged)}")
        for s in negative_flagged[:15]:
            print(f"   {s[0]:<8}{s[1]:<36} was {s[2]:>10} -> {s[3]:>8} (raw {s[4]})")
        print(f"\nBig changes (>=10 units): {len(big_changes)}")
        for s in big_changes[:15]:
            print(f"   {s[0]:<8}{s[1]:<36} {s[2]:>10} -> {s[3]}")
    finally:
        db.close()


if __name__ == "__main__":
    apply_to_db()
