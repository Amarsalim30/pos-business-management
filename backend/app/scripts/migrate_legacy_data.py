"""
Full Legacy Data Migration Script
Migrates all data from legacy MDB CSV files into the modern POS Business database.

Migration order (respects FK dependencies):
1. Users (STPS.csv)
2. Customers + Suppliers (Suppliers.csv — combined master file)
3. GRNs → GoodsReceivedNote + GoodsReceivedItem (GRNs.csv)
4. Sales → Sale + SaleItem (MINs.csv)
5. Payments → Payment (BatchPayments.csv)
6. Supplier Payments → SupplierPayment (BatchPaymentsGRNs.csv)
7. Stock Movements → StockMovement (Movements.csv / Movements2.csv)

Run: cd backend && .venv/bin/python -m app.scripts.migrate_legacy_data
"""

import os
import csv
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Optional, Tuple
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.models.store import Store
from app.models.product import Product
from app.models.supplier import Supplier, SupplierPayment
from app.models.sale import Customer, Sale, SaleItem, Payment
from app.models.purchase import (
    PurchaseOrder, PurchaseItem, GoodsReceivedNote, GoodsReceivedItem,
)
from app.models.inventory import Inventory, StockMovement


CSV_DIR = "/home/amar-salim/Documents/Projects/pos-business/docs/data/2026_3_csv"

# Legacy internal accounts that must not become customers
SKIP_CUSTOMER_NAMES = {"CASH AC", "TASLAM ENERGY SOLUTIONS LTD", "TASLAM"}


def _sd(value, default="0") -> Decimal:
    """Safe decimal parse."""
    try:
        return Decimal(str(value or default))
    except Exception:
        return Decimal(default)


def _flag(value) -> bool:
    """Legacy boolean: mdb-tools exports True/False as 1/0."""
    return str(value or "").strip() in ("True", "1", "1.0")


def _si(value, default=0) -> int:
    """Safe int parse."""
    try:
        return int(float(str(value or default)))
    except Exception:
        return default


def _parse_date(value: str) -> Optional[datetime]:
    """Parse legacy date string to datetime."""
    if not value or not value.strip():
        return None
    v = value.strip()
    # mdb-tools exports MM/DD/YY HH:MM:SS — take the date part
    if len(v) > 8 and v[2] == "/" == v[5]:
        v = v[:8]
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(v, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


# ─── 1. USERS ────────────────────────────────────────────────────────────────

def migrate_users(db: Session, store: Store, csv_dir: str) -> Dict[str, User]:
    """Migrate users from STPS.csv. Returns username -> User map."""
    print("\n👤 Migrating Users...")
    user_map: Dict[str, User] = {}

    # Get existing owner
    owner = db.query(User).filter(User.role == "owner").first()
    if owner:
        user_map[owner.username.upper()] = owner

    stps_path = os.path.join(csv_dir, "STPS.csv")
    if os.path.exists(stps_path):
        seen = set()
        with open(stps_path, "r", encoding="utf-8", errors="ignore") as f:
            for row in csv.DictReader(f):
                username = (row.get("UserName") or "").strip().upper()
                password = (row.get("UserPassword") or "1234").strip()
                if not username or username in seen:
                    continue
                seen.add(username)

                existing = db.query(User).filter(User.username == username).first()
                if existing:
                    user_map[username] = existing
                    continue

                user = User(
                    username=username,
                    password_hash=get_password_hash(password),
                    full_name=username.title(),
                    role="owner" if username == "SUPPORT" else "staff",
                    store_id=store.id,
                    is_active=True,
                )
                db.add(user)
                db.flush()
                user_map[username] = user
                print(f"   + User: {username}")

    db.commit()
    print(f"   ✅ Users: {len(user_map)}")
    return user_map


# ─── 2. CUSTOMERS + SUPPLIERS ────────────────────────────────────────────────

def migrate_customers_suppliers(db: Session, store: Store, csv_dir: str) -> Tuple[Dict[str, Customer], Dict[str, Supplier]]:
    """Migrate customers and suppliers from Suppliers.csv (combined master file)."""
    print("\n👥 Migrating Customers & Suppliers...")

    customer_map: Dict[str, Customer] = {}  # CodeNo -> Customer
    supplier_map: Dict[str, Supplier] = {}  # CodeNo -> Supplier

    suppliers_path = os.path.join(csv_dir, "Suppliers.csv")
    if not os.path.exists(suppliers_path):
        print("   ⚠️ Suppliers.csv not found")
        return customer_map, supplier_map

    with open(suppliers_path, "r", encoding="utf-8", errors="ignore") as f:
        for row in csv.DictReader(f):
            code = (row.get("CodeNo") or "").strip()
            name = (row.get("Name") or "").strip()
            if not code or not name:
                continue

            is_client = _flag(row.get("Client"))
            is_supplier = _flag(row.get("Supplier"))
            tel = (row.get("Tel") or "").strip() or None
            pin = (row.get("PIN") or "").strip() or None
            email = (row.get("EMail") or "").strip() or None
            address = (row.get("Address") or "").strip() or None
            cperson = (row.get("CPerson") or "").strip() or None
            totaldue = _sd(row.get("TotalDue"))

            if is_client:
                if name.upper() in SKIP_CUSTOMER_NAMES:
                    continue
                existing = db.query(Customer).filter(
                    Customer.name == name, Customer.phone == tel
                ).first()
                if existing:
                    customer_map[code] = existing
                    continue

                customer = Customer(
                    name=name,
                    phone=tel,
                    email=email,
                    address=address,
                    balance=totaldue,
                    is_active=True,
                )
                db.add(customer)
                db.flush()
                customer_map[code] = customer
                print(f"   + Customer: {code} = {name}")

            if is_supplier:
                existing = db.query(Supplier).filter(
                    Supplier.store_id == store.id, Supplier.name == name
                ).first()
                if existing:
                    supplier_map[code] = existing
                    continue

                supplier = Supplier(
                    store_id=store.id,
                    name=name,
                    contact_person=cperson,
                    phone=tel,
                    email=email,
                    address=address,
                    tax_pin=pin,
                    balance=totaldue,
                    is_active=True,
                )
                db.add(supplier)
                db.flush()
                supplier_map[code] = supplier
                print(f"   + Supplier: {code} = {name}")

    db.commit()
    print(f"   ✅ Customers: {len(customer_map)}, Suppliers: {len(supplier_map)}")
    return customer_map, supplier_map


# ─── 3. GRNs → GoodsReceivedNote + GoodsReceivedItem ─────────────────────────

def migrate_grns(
    db: Session, store: Store, csv_dir: str,
    supplier_map: Dict[str, Supplier], user_map: Dict[str, User],
    product_map: Dict[str, Product],
) -> Dict[str, GoodsReceivedNote]:
    """Migrate GRNs from GRNs.csv. Groups by GRNNo. Returns grn_no -> GRN map."""
    print("\n📦 Migrating GRNs...")
    grn_path = os.path.join(csv_dir, "GRNs.csv")
    if not os.path.exists(grn_path):
        print("   ⚠️ GRNs.csv not found")
        return {}

    # Group rows by GRNNo
    grn_groups: Dict[str, list] = defaultdict(list)
    with open(grn_path, "r", encoding="utf-8", errors="ignore") as f:
        for row in csv.DictReader(f):
            grn_no = (row.get("GRNNo") or "").strip()
            if grn_no:
                grn_groups[grn_no].append(row)

    grn_map: Dict[str, GoodsReceivedNote] = {}
    created = 0

    for grn_no, rows in grn_groups.items():
        existing = db.query(GoodsReceivedNote).filter(
            GoodsReceivedNote.store_id == store.id,
            GoodsReceivedNote.grn_no == grn_no
        ).first()
        if existing:
            grn_map[grn_no] = existing
            continue

        first = rows[0]
        supplier_code = (first.get("Supplier") or "").strip()
        supplier = supplier_map.get(supplier_code)
        user_name = (first.get("UserName") or "SUPPORT").strip().upper()
        user = user_map.get(user_name) or next(iter(user_map.values()), None)
        tdate = _parse_date(first.get("TDate"))
        total_amount = sum(_sd(r.get("Amount")) for r in rows)

        grn = GoodsReceivedNote(
            store_id=store.id,
            grn_no=grn_no,
            supplier_id=supplier.id if supplier else None,
            user_id=user.id if user else 1,
            delivery_date=tdate or datetime.now(timezone.utc),
            total_amount=total_amount,
            notes=f"Imported from legacy MDB (GRNNo: {grn_no})",
        )
        db.add(grn)
        db.flush()

        for row in rows:
            item_code = (row.get("Item") or "").strip()
            product = product_map.get(item_code)
            if not product:
                continue

            qty = _sd(row.get("Quantity"))
            cost = _sd(row.get("CostPrice"))
            if cost <= 0:
                cost = _sd(row.get("Price"))
            net = _sd(row.get("NetAmount"))

            gri = GoodsReceivedItem(
                grn_id=grn.id,
                product_id=product.id,
                unit_type=product.unit_type,
                quantity_received=qty,
                rolls_received=0,
                loose_meters_received=Decimal("0"),
                unit_cost=cost,
                total_cost=net if net > 0 else qty * cost,
            )
            db.add(gri)

        grn_map[grn_no] = grn
        created += 1

    db.commit()
    print(f"   ✅ GRNs: {created} created, {len(grn_map) - created} existing")
    return grn_map


# ─── 4. SALES → Sale + SaleItem ──────────────────────────────────────────────

def migrate_sales(
    db: Session, store: Store, csv_dir: str,
    customer_map: Dict[str, Customer], user_map: Dict[str, User],
    product_map: Dict[str, Product],
) -> Dict[str, Sale]:
    """Migrate sales from MINs.csv. Groups by MINNo. Returns invoice_no -> Sale map."""
    print("\n🧾 Migrating Sales...")
    min_path = os.path.join(csv_dir, "MINs.csv")
    if not os.path.exists(min_path):
        print("   ⚠️ MINs.csv not found")
        return {}

    # Group rows by MINNo
    sale_groups: Dict[str, list] = defaultdict(list)
    with open(min_path, "r", encoding="utf-8", errors="ignore") as f:
        for row in csv.DictReader(f):
            min_no = (row.get("MINNo") or "").strip()
            if min_no:
                sale_groups[min_no].append(row)

    sale_map: Dict[str, Sale] = {}
    created = 0

    # Ledger rows (MINTrans) keyed by (ref, item) — restores exact meter
    # quantities for roll-product lines whose MINs Qnty is 0.
    meters_by_ref_item: Dict[Tuple[str, str], Decimal] = defaultdict(Decimal)
    mov2_path = os.path.join(csv_dir, "Movements2.csv")
    if os.path.exists(mov2_path):
        with open(mov2_path, "r", encoding="utf-8", errors="ignore") as f:
            for row in csv.DictReader(f):
                if not _flag(row.get("MINTrans")):
                    continue
                ref = (row.get("TransRefNo") or "").strip()
                item = (row.get("Item") or "").strip()
                qout = _sd(row.get("QntyOut"))
                if ref and item and qout > 0:
                    meters_by_ref_item[(ref, item)] += qout

    skipped_items = 0

    for min_no, rows in sale_groups.items():
        existing = db.query(Sale).filter(Sale.invoice_no == min_no).first()
        if existing:
            sale_map[min_no] = existing
            continue

        first = rows[0]
        customer_code = (first.get("Customer") or "").strip()
        customer = customer_map.get(customer_code)
        user_name = (first.get("UserName") or "SUPPORT").strip().upper()
        user = user_map.get(user_name) or next(iter(user_map.values()), None)
        tdate = _parse_date(first.get("TDate"))
        discount = _sd(first.get("Discount"))
        is_cancelled = _flag(first.get("Cancelled"))

        # Calculate totals from line items
        subtotal = Decimal("0")
        tax_total = Decimal("0")
        for row in rows:
            qty = _sd(row.get("Qnty"))
            price = _sd(row.get("Price"))
            vat = _sd(row.get("VAT"))
            net_price = _sd(row.get("NetPrice"))
            line_total = net_price if net_price > 0 else qty * price
            subtotal += line_total
            tax_total += vat

        total = subtotal + tax_total - discount

        # Determine status
        amt_received = _sd(first.get("AmtRecvd"))
        if is_cancelled:
            status = "voided"
        elif amt_received >= total and total > 0:
            status = "paid"
        elif amt_received > 0:
            status = "partial"
        elif customer:
            status = "unpaid"
        else:
            status = "paid"

        sale = Sale(
            invoice_no=min_no,
            customer_id=customer.id if customer else None,
            store_id=store.id,
            user_id=user.id if user else 1,
            subtotal=subtotal,
            tax_amount=tax_total,
            discount_amount=discount,
            total_amount=total,
            payment_method="cash",
            status=status,
            is_etr=_flag(first.get("Pos")),
            site_name=None,
            notes=f"Imported from legacy MDB (MINNo: {min_no})",
            created_at=tdate or datetime.now(timezone.utc),
        )
        db.add(sale)
        db.flush()

        # Add line items
        for row in rows:
            item_code = (row.get("Item") or "").strip()
            product = product_map.get(item_code)
            if not product:
                skipped_items += 1
                continue

            qty = _sd(row.get("Qnty"))
            if qty <= 0 and product.unit_type == "roll":
                qty = meters_by_ref_item.get((min_no, item_code), Decimal("0"))
            price = _sd(row.get("Price"))
            vat = _sd(row.get("VAT"))
            net_price = _sd(row.get("NetPrice"))
            line_total = net_price if net_price > 0 else qty * price

            # Determine unit_sold based on product type
            if product.unit_type == "roll":
                unit_sold = "roll" if qty == product.meters_per_roll else "meter"
            else:
                unit_sold = "piece"

            si = SaleItem(
                sale_id=sale.id,
                product_id=product.id,
                unit_type=product.unit_type,
                unit_sold=unit_sold,
                quantity=qty,
                rolls_qty=None,
                loose_meters=None,
                unit_price=price,
                cost_price=product.cost_price,
                tax_rate=product.tax_rate,
                total=line_total,
            )
            db.add(si)

        sale_map[min_no] = sale
        created += 1

    db.commit()
    print(f"   ✅ Sales: {created} created, {len(sale_map) - created} existing | unmatched line items: {skipped_items}")
    return sale_map


# ─── 5. PAYMENTS → Payment ───────────────────────────────────────────────────

def migrate_payments(
    db: Session, store: Store, csv_dir: str,
    customer_map: Dict[str, Customer], sale_map: Dict[str, Sale],
    user_map: Dict[str, User],
) -> int:
    """Migrate customer payments from BatchPayments.csv."""
    print("\n💰 Migrating Customer Payments...")
    bp_path = os.path.join(csv_dir, "BatchPayments.csv")
    if not os.path.exists(bp_path):
        print("   ⚠️ BatchPayments.csv not found")
        return 0

    created = 0
    with open(bp_path, "r", encoding="utf-8", errors="ignore") as f:
        for row in csv.DictReader(f):
            customer_code = (row.get("Customer") or "").strip()
            min_no = (row.get("MINNo") or "").strip()
            amount = _sd(row.get("Amount"))
            if amount <= 0:
                continue

            customer = customer_map.get(customer_code)
            sale = sale_map.get(min_no) if min_no else None

            # Check for duplicate (idempotent re-runs)
            tdate = _parse_date(row.get("TDate"))
            dup_q = db.query(Payment).filter(
                Payment.store_id == store.id,
                Payment.amount == amount,
                Payment.created_at == (tdate or datetime.now(timezone.utc)),
            )
            if customer:
                dup_q = dup_q.filter(Payment.customer_id == customer.id)
            if dup_q.first():
                continue

            user_name = (row.get("UserName") or "SUPPORT").strip().upper()
            user = user_map.get(user_name) or next(iter(user_map.values()), None)
            remark = (row.get("Remark") or "").strip()
            ref = (row.get("RefNo") or "").strip()

            # Detect payment method from remark
            method = "cash"
            if remark and "mpesa" in remark.lower():
                method = "mpesa"
            elif remark and "cheque" in remark.lower():
                method = "cheque"
            elif remark and "bank" in remark.lower():
                method = "bank"

            payment = Payment(
                sale_id=sale.id if sale else None,
                customer_id=customer.id if customer else None,
                store_id=store.id,
                amount=amount,
                payment_method=method,
                reference=ref or None,
                notes=remark or None,
                user_id=user.id if user else 1,
                created_at=tdate or datetime.now(timezone.utc),
            )
            db.add(payment)
            created += 1

    db.commit()
    print(f"   ✅ Payments: {created} created")
    return created


# ─── 6. SUPPLIER PAYMENTS → SupplierPayment ──────────────────────────────────

def migrate_supplier_payments(
    db: Session, store: Store, csv_dir: str,
    supplier_map: Dict[str, Supplier], grn_map: Dict[str, GoodsReceivedNote],
    user_map: Dict[str, User],
) -> int:
    """Migrate supplier payments from BatchPaymentsGRNs.csv."""
    print("\n💸 Migrating Supplier Payments...")
    bpgrn_path = os.path.join(csv_dir, "BatchPaymentsGRNs.csv")
    if not os.path.exists(bpgrn_path):
        print("   ⚠️ BatchPaymentsGRNs.csv not found")
        return 0

    created = 0
    with open(bpgrn_path, "r", encoding="utf-8", errors="ignore") as f:
        for row in csv.DictReader(f):
            supplier_code = (row.get("Supplier") or "").strip()
            grn_no = (row.get("GRNNo") or "").strip()
            amount = _sd(row.get("Amount"))
            if amount <= 0:
                continue

            supplier = supplier_map.get(supplier_code)
            grn = grn_map.get(grn_no) if grn_no else None

            # Check for duplicate (idempotent re-runs)
            tdate = _parse_date(row.get("TDate"))
            dup_q = db.query(SupplierPayment).filter(
                SupplierPayment.store_id == store.id,
                SupplierPayment.amount == amount,
                SupplierPayment.created_at == (tdate or datetime.now(timezone.utc)),
            )
            if supplier:
                dup_q = dup_q.filter(SupplierPayment.supplier_id == supplier.id)
            if dup_q.first():
                continue

            user_name = (row.get("UserName") or "SUPPORT").strip().upper()
            user = user_map.get(user_name) or next(iter(user_map.values()), None)
            remark = (row.get("Remark") or "").strip()
            ref = (row.get("RefNo") or "").strip()

            sp = SupplierPayment(
                store_id=store.id,
                supplier_id=supplier.id if supplier else None,
                po_id=None,  # Legacy has no PO concept
                user_id=user.id if user else 1,
                amount=amount,
                payment_method="bank",
                reference=ref or grn_no or None,
                notes=remark or None,
                created_at=tdate or datetime.now(timezone.utc),
            )
            db.add(sp)
            created += 1

    db.commit()
    print(f"   ✅ Supplier Payments: {created} created")
    return created


# ─── 7. STOCK MOVEMENTS → StockMovement ──────────────────────────────────────

def migrate_stock_movements(
    db: Session, store: Store, csv_dir: str,
    product_map: Dict[str, Product], user_map: Dict[str, User],
) -> int:
    """Migrate stock movements from Movements.csv (cleaner data)."""
    print("\n📊 Migrating Stock Movements...")
    mov_path = os.path.join(csv_dir, "Movements.csv")
    if not os.path.exists(mov_path):
        print("   ⚠️ Movements.csv not found")
        return 0

    created = 0
    with open(mov_path, "r", encoding="utf-8", errors="ignore") as f:
        for row in csv.DictReader(f):
            item_code = (row.get("Item") or "").strip()
            product = product_map.get(item_code)
            if not product:
                continue

            qty_in = _sd(row.get("QntyIn"))
            qty_out = _sd(row.get("QntyOut"))
            is_grn = _flag(row.get("GRN"))
            is_min = _flag(row.get("MINTrans"))
            is_return = _flag(row.get("Returned"))
            trans_ref = (row.get("TransRefNo") or "").strip()
            tdate = _parse_date(row.get("TransDate"))
            user_name = (row.get("Remarks") or "SYSTEM").strip().upper()
            user = user_map.get(user_name) or next(iter(user_map.values()), None)

            if qty_in > 0:
                mtype = "in"
                delta = qty_in
            elif qty_out > 0:
                mtype = "sale"
                delta = -qty_out
            else:
                continue

            inv = db.query(Inventory).filter(
                Inventory.product_id == product.id,
                Inventory.store_id == store.id,
            ).first()
            prev_qty = inv.quantity if inv else Decimal("0")
            new_qty = prev_qty + delta

            sm = StockMovement(
                product_id=product.id,
                store_id=store.id,
                type=mtype,
                quantity=delta,
                unit_sold="piece",
                previous_quantity=prev_qty,
                new_quantity=new_qty,
                reference_id=trans_ref or None,
                note=f"Legacy MDB {'GRN' if is_grn else 'Sale' if is_min else 'Movement'} (Item: {item_code})",
                user_id=user.id if user else 1,
                created_at=tdate or datetime.now(timezone.utc),
            )
            db.add(sm)
            created += 1

    db.commit()
    print(f"   ✅ Stock Movements: {created} created")
    return created


# ─── MAIN ────────────────────────────────────────────────────────────────────

def run_full_migration(csv_dir: str = CSV_DIR, store_id: Optional[int] = None):
    """Run all migrations in dependency order."""
    db = SessionLocal()
    try:
        store = db.query(Store).filter(Store.id == store_id).first() if store_id else db.query(Store).first()
        if not store:
            print("❌ No store found. Please initialize the system first.")
            return

        print(f"{'='*60}")
        print(f"  FULL LEGACY DATA MIGRATION")
        print(f"  Store: {store.name} (ID: {store.id})")
        print(f"  Source: {csv_dir}")
        print(f"{'='*60}")

        # Build product SKU -> Product map (products already migrated)
        product_map: Dict[str, Product] = {}
        for p in db.query(Product).filter(Product.store_id == store.id).all():
            if p.sku:
                product_map[p.sku] = p
        print(f"\n📋 Products already in DB: {len(product_map)}")

        # Run migrations in order
        user_map = migrate_users(db, store, csv_dir)
        customer_map, supplier_map = migrate_customers_suppliers(db, store, csv_dir)
        grn_map = migrate_grns(db, store, csv_dir, supplier_map, user_map, product_map)
        sale_map = migrate_sales(db, store, csv_dir, customer_map, user_map, product_map)
        migrate_payments(db, store, csv_dir, customer_map, sale_map, user_map)
        migrate_supplier_payments(db, store, csv_dir, supplier_map, grn_map, user_map)
        migrate_stock_movements(db, store, csv_dir, product_map, user_map)

        print(f"\n{'='*60}")
        print(f"  ✅ FULL MIGRATION COMPLETE")
        print(f"{'='*60}")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_full_migration()
