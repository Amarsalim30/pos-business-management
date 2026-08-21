"""Sync product stock from docs/migratestock.csv (fresher legacy stock report).

Matching: normalized name, with 'PC'/'ROLL'/'PCS' suffix variants and unique
substring fallback. Duplicate report rows for one product are summed when the
normalized names are identical; conflicting distinct names are flagged & skipped.

BP is intentionally NOT touched (latest-GRN rule). Every quantity change is
logged as an 'adjust' StockMovement.
"""

import csv
from collections import defaultdict
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from app.core.database import SessionLocal
from app.models.inventory import Inventory, StockMovement
from app.models.product import Product
from app.models.store import Store
from app.models.user import User

REPORT_PATH = "/home/amar-salim/Documents/Projects/pos-business/docs/migratestock.csv"
SUFFIXES = [" PC", " ROLL", " PCS", " ROLLS"]


def norm(s: str) -> str:
    return " ".join(s.upper().split())


def keys_for(name: str) -> set:
    base = norm(name)
    out = {base}
    for suf in SUFFIXES:
        if base.endswith(suf):
            out.add(norm(base[: -len(suf)]))
    return out


def _d(value) -> Decimal:
    try:
        return Decimal(str(value or "0"))
    except Exception:
        return Decimal("0")


def parse_report() -> List[Tuple[str, str, Decimal]]:
    """Return [(group, normalized_name, stock)]."""
    with open(REPORT_PATH, encoding="utf-8", errors="ignore") as f:
        rows = list(csv.reader(f))
    items = []
    for r in rows:
        if len(r) != 8:
            continue
        raw = (r[0] or "").replace("\n", "|").strip()
        if not raw or raw == "Item Description":
            continue
        try:
            stock = Decimal((r[1] or "0").strip())
        except Exception:
            continue
        group = raw.split("|")[0] if "|" in raw else ""
        items.append((group, norm(raw.split("|")[-1]), stock))
    return items


def sync() -> None:
    db = SessionLocal()
    try:
        store = db.query(Store).first()
        owner = db.query(User).filter(User.role == "owner").first()
        user_id = owner.id if owner else 1

        products = db.query(Product).filter(Product.store_id == store.id).all()
        by_key: Dict[str, Product] = {}
        name_of: Dict[str, str] = {}
        for p in products:
            for k in keys_for(p.name):
                by_key[k] = p
                name_of[k] = p.name

        report = parse_report()

        # resolve each report row to a product
        resolved: Dict[int, Product] = {}
        unresolved: List[Tuple[str, str]] = []
        for idx, (group, rname, stock) in enumerate(report):
            prod = by_key.get(rname)
            if prod is None:
                cands = {k: v for k, v in by_key.items() if k and (k in rname or rname in k)}
                if len(cands) == 1:
                    prod = next(iter(cands.values()))
            if prod is None:
                unresolved.append((group, rname))
            else:
                resolved[idx] = prod

        # group report rows per product; identical duplicate names sum, else skip conflicts
        per_prod: Dict[int, List[int]] = defaultdict(list)
        for idx, prod in resolved.items():
            per_prod[prod.id].append(idx)

        targets: Dict[int, Tuple[Decimal, List[str]]] = {}
        skipped_conflicts = []
        prod_by_id = {p.id: p for p in products}
        for pid, idxs in per_prod.items():
            names = {report[i][1] for i in idxs}
            if len(names) == 1:
                targets[pid] = (
                    sum((report[i][2] for i in idxs), Decimal("0")),
                    [report[i][0] for i in idxs],
                )
                continue
            # conflict: prefer the row whose name exactly equals the product's own key
            prod_name = norm(prod_by_id[pid].name)
            exact = [i for i in idxs if report[i][1] == prod_name]
            if len(exact) == 1:
                targets[pid] = (report[exact[0]][2], [report[exact[0]][0]])
            else:
                skipped_conflicts.append((prod_by_id[pid].sku, prod_by_id[pid].name, sorted(names)))

        updated = unchanged = 0
        for prod in products:
            if prod.id not in targets:
                continue
            new_qty, _groups = targets[prod.id]
            inv = db.query(Inventory).filter(
                Inventory.product_id == prod.id, Inventory.store_id == store.id
            ).first()
            if not inv:
                continue
            old_qty = inv.quantity
            if old_qty == new_qty:
                unchanged += 1
                continue
            inv.quantity = new_qty
            updated += 1
            db.add(StockMovement(
                product_id=prod.id,
                store_id=store.id,
                type="adjust",
                quantity=new_qty - old_qty,
                unit_sold="meter" if prod.unit_type == "roll" else "piece",
                previous_quantity=old_qty,
                new_quantity=new_qty,
                reference_id="STOCK_REPORT_SYNC",
                note=f"Stock synced from migratestock.csv ({_groups[0]})",
                user_id=user_id,
            ))

        # products with stock in DB but absent from the report stay untouched
        db.commit()
        print(f"Report items: {len(report)} | matched: {len(resolved)} | unresolved: {len(unresolved)}")
        print(f"Products targeted: {len(targets)} | updated: {updated} | unchanged: {unchanged}")
        print(f"Conflicting-name groups skipped: {len(skipped_conflicts)}")
        if unresolved:
            print("\nUnresolved report items:")
            for g, n in unresolved[:20]:
                print(f"   [{g}] {n}")
    finally:
        db.close()


if __name__ == "__main__":
    sync()
