"""Repair customer links on migrated sales & payments.

The original 2026 import built its customer map with a broken inline
expression (SQL comparison `or None`), so nearly all 2026 invoices ended up
walk-in. This script rebuilds the CodeNo -> Customer map correctly from
Suppliers.csv and updates existing rows in place. Idempotent.
"""

import csv
from datetime import date
from typing import Dict, Optional

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.sale import Customer, Payment, Sale
from app.models.store import Store

DOCS = "/home/amar-salim/Documents/Projects/pos-business/docs/data"
CSV_DIRS = [f"{DOCS}/2026_3_csv", f"{DOCS}/2025_1_csv"]
SKIP_CUSTOMER_NAMES = {"CASH AC", "TASLAM ENERGY SOLUTIONS LTD", "TASLAM"}


def _clean(s: Optional[str]) -> Optional[str]:
    s = (s or "").strip()
    return s or None


def build_customer_maps(db: Session) -> Dict[str, Dict[str, Customer]]:
    """Return {csv_dir: {CodeNo: Customer}} for all export dirs."""
    maps: Dict[str, Dict[str, Customer]] = {}
    all_customers = db.query(Customer).all()
    for csv_dir in CSV_DIRS:
        m: Dict[str, Customer] = {}
        with open(f"{csv_dir}/Suppliers.csv", encoding="utf-8", errors="ignore") as f:
            for row in csv.DictReader(f):
                code = (row.get("CodeNo") or "").strip()
                name = " ".join((row.get("Name") or "").split())
                if not code or not name or str(row.get("Client") or "").strip() not in ("1", "True", "1.0"):
                    continue
                if name.upper() in SKIP_CUSTOMER_NAMES:
                    continue
                tel = _clean(row.get("Tel"))
                # exact name+phone first, then name only
                cust = next(
                    (c for c in all_customers if c.name == name and (_clean(c.phone) == tel)),
                    None,
                ) or next((c for c in all_customers if c.name == name), None)
                if cust:
                    m[code] = cust
        maps[csv_dir] = m
    return maps


def repair(db: Session, store: Store) -> None:
    maps = build_customer_maps(db)

    # --- Sales: relink by invoice_no ---
    sales_fixed = sales_already = sales_unlinked = 0
    for csv_dir in CSV_DIRS:
        cmap = maps[csv_dir]
        with open(f"{csv_dir}/MINs.csv", encoding="utf-8", errors="ignore") as f:
            seen = set()
            for row in csv.DictReader(f):
                inv = (row.get("MINNo") or "").strip()
                if not inv or inv in seen:
                    continue
                seen.add(inv)
                sale = db.query(Sale).filter(Sale.invoice_no == inv, Sale.store_id == store.id).first()
                if not sale:
                    continue
                cust = cmap.get((row.get("Customer") or "").strip())
                if cust is None:
                    continue
                if sale.customer_id == cust.id:
                    sales_already += 1
                else:
                    sale.customer_id = cust.id
                    sales_fixed += 1

    # --- Payments: relink by (date, amount, customer-code) ---
    pay_fixed = pay_ambiguous = 0
    for csv_dir in CSV_DIRS:
        cmap = maps[csv_dir]
        with open(f"{csv_dir}/BatchPayments.csv", encoding="utf-8", errors="ignore") as f:
            for row in csv.DictReader(f):
                amt_raw = (row.get("Amount") or "").strip()
                if not amt_raw:
                    continue
                try:
                    amount = float(amt_raw)
                except ValueError:
                    continue
                cust = cmap.get((row.get("Customer") or "").strip())
                if cust is None:
                    continue
                tdate = (row.get("TDate") or "").strip()[:8]
                try:
                    d = date(2000 + int(tdate[6:8]), int(tdate[:2]), int(tdate[3:5]))
                except Exception:
                    continue
                candidates = (
                    db.query(Payment)
                    .filter(Payment.store_id == store.id)
                    .filter(Payment.amount == amount)
                    .filter(Payment.created_at >= d, Payment.created_at < d.fromordinal(d.toordinal() + 1))
                    .filter(Payment.customer_id.is_(None))
                    .all()
                )
                if len(candidates) == 1:
                    candidates[0].customer_id = cust.id
                    pay_fixed += 1
                elif candidates:
                    pay_ambiguous += len(candidates)

    db.commit()
    print(f"Sales relinked: {sales_fixed} | already correct: {sales_already}")
    print(f"Payments relinked: {pay_fixed} | ambiguous skipped: {pay_ambiguous}")

    remaining = db.query(Sale).filter(Sale.store_id == store.id, Sale.customer_id.is_(None)).count()
    print(f"Sales still walk-in: {remaining} (expected: CASH AC + TASLAM internal accounts)")


if __name__ == "__main__":
    session = SessionLocal()
    try:
        store = session.query(Store).first()
        repair(session, store)
    finally:
        session.close()
