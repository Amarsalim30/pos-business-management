# Legacy MDB CSV → POS Business Migration

## Overview

Migrates data from legacy MDB CSV exports (`/home/amar-salim/Downloads/2026_mdb_csv`) into the modern POS Business Postgres database. Two scripts handle the full migration:

- **`migrate_legacy_csv.py`** — Products, categories, inventory (run first)
- **`migrate_legacy_data.py`** — Users, customers, suppliers, GRNs, sales, payments, stock movements

Both scripts are idempotent (safe to re-run).

```bash
cd backend
.venv/bin/python -m app.scripts.migrate_legacy_csv       # products first
.venv/bin/python -m app.scripts.migrate_legacy_data      # everything else
```

---

## Legacy System: TASLAM ENERGY SOLUTIONS LTD

- Company code: `01`, Bin: `Z001`
- Users: ABDUL, RAYYAN, SAID, SUPPORT
- Currency: KES
- VAT: 0% (all items zero-rated)
- 1,901 products, 38 categories, 152 contacts (67 clients + 85 suppliers)
- Date range in data: 2025-09 to 2026-08

---

## CSV File Inventory

### Transactional Core

| File | Rows | Purpose |
|---|---|---|
| `GRNs.csv` | 1,436 | Goods Received Notes (purchases) |
| `MINs.csv` | 2,903 | Sales invoices |
| `Movements.csv` | 691 | Stock ledger (older format) |
| `Movements2.csv` | 9,728 | Stock ledger (newer format, largest table) |
| `BatchPayments.csv` | 377 | Customer payment receipts |
| `BatchPaymentsGRNs.csv` | 274 | Supplier payment receipts |
| `STADT.csv` | 3,896 | Audit trail |

### Master Data

| File | Rows | Purpose |
|---|---|---|
| `ITEMS.csv` | 1,901 | Item master (141 columns) |
| `Suppliers.csv` | 152 | **Combined** Customers + Suppliers master |
| `GroupsT.csv` | 38 | Product categories |
| `ItemBins.csv` | 1,779 | Item → warehouse bin mapping |
| `STPS.csv` | 8 | User accounts (plaintext passwords) |
| `PayModes.csv` | 10 | Payment modes |
| `Companies.csv` | 1 | Company info |
| `CompanyDetails.csv` | 1 | System config/counters |

### Reports / Reference

| File | Rows | Purpose |
|---|---|---|
| `Statement.csv` | 55 | Client statements |
| `SalesStatus.csv` | 2 | Sales status summary |
| `StockBalances.csv` | 2 | Closing stock (only 1 item) |
| `OffInvoices.csv` | 32 | Opening/official invoices |
| `Profoma.csv` | 2 | Proforma invoices |
| `Disposals.csv` | 8 | Stock disposals |
| `GRNCosts.csv` | 5 | Additional GRN costs (transport) |
| `MINCosts.csv` | 2 | Additional invoice costs (installation) |
| `DailySumm.csv` | 24 | Daily summary |
| `rptCashPos.csv` | 10 | Cash position report |
| `rptReceipt.csv` | 22 | Receipts (91% blank) |
| `rptVAT.csv` | 2 | VAT report |
| `rptProfoma.csv` | 1 | Proforma report |
| `SalesAssts.csv` | 2 | Sales assistants |
| `AutoBackUps.csv` | 5 | Backup file list |
| `DbObjcts.csv` | 462 | Access object list |
| `Licids.csv` | 2 | License info |

---

## Key Findings

### 1. Suppliers.csv is a Combined Master File

The `Suppliers.csv` file contains **both customers and suppliers**:
- `Client=True` → 67 entries → `Customer` table
- `Supplier=True` → 85 entries → `Supplier` table
- Columns: CodeNo, Name, CPerson, Tel, PIN, EMail, Address, OPBal, TotalDue, Age30/60/90/Over

### 2. All OPPrice Columns Are Zero

Every `OPPrice01` through `OPPrice10`, `OPPrice`, and `LastPrice` in `ITEMS.csv` is `0.0` for all 1,901 items. The legacy system does NOT store cost prices in the item master.

### 3. Cost Prices Come from GRNs

Cost prices (BP) are derived from:
- **`GRNs.csv`** `CostPrice` column (primary, 592 items)
- **`Movements2.csv`** `Price` column on GRN rows (supplement, 188 additional items)
- **`Movements.csv`** `TransPrice` column on GRN rows (fallback, 52 items)

Combined: **780 items** have cost data. 38 items with stock have GRN rows but `Price=0.0` (opening stock with no cost recorded).

### 4. StockBalances.csv Has Only 1 Item

`StockBalances.csv` only contains data for item `6063` (2 duplicate rows). The migration falls back to `SysBal` from `ITEMS.csv` for all other items.

### 5. Roll Products Use Pricing-Based Detection

Roll products are detected by:
- `Units == 'ROLL'` in `ITEMS.csv`, OR
- `SellingPriceLoose01 > 0` AND `SellingPriceLoose01 != SellingPrice01` (distinct per-meter pricing)

Meters per roll is derived: `SellingPrice01 / SellingPriceLoose01`
- PVC Coast cables: 90m rolls (9000/100)
- TWE products: 80m rolls (14400/180)
- Other products: varies (65m, 50m, etc.)

### 6. VAT is Zero for All Legacy Items

All items have `VAT=0.0` in `ITEMS.csv`. Migration sets `is_taxable=False`, `tax_rate=0.0` for all legacy products.

### 7. Movements.csv vs Movements2.csv

- `Movements.csv`: 691 rows, older format, has `TransPrice` (cost at time of transaction)
- `Movements2.csv`: 9,728 rows, newer format, has `Price` and `AvgPrice`
- Both have `GRN=True/False` and `MINTrans=True/False` flags to identify transaction type
- `Movements2.csv` `Price` column contains the cost for GRN rows (not `AvgPrice` which can be 0)

### 8. MINs.csv Groups by MINNo

Each row in `MINs.csv` is a line item. Rows with the same `MINNo` belong to the same invoice. The first row typically has `AmtRecvd` (amount received) and customer info.

### 9. Disposals.csv Exists

8 disposal transactions exist in `Disposals.csv`. These could be migrated as `StockMovement` type="adjust" with negative quantity if needed.

### 10. System Config Not Needed

`CompanyDetails.csv` contains system counters (GRNNo=344, MINNo=421) and config (VATRate, AutoBackUp, etc.). The POS system generates its own counters and has its own config.

---

## Migration Mapping

### Products (migrate_legacy_csv.py)

| Source | Field | POS Model | Field |
|---|---|---|---|
| `ITEMS.csv` | ItemCode | Product | sku |
| `ITEMS.csv` | ItemDesc | Product | name |
| `ITEMS.csv` | GroupCode | Product | category_id (via GroupsT.csv) |
| `ITEMS.csv` | SellingPrice01 | Product | selling_price |
| `ITEMS.csv` | OPPrice01 | Product | cost_price (fallback: GRNs.csv) |
| `ITEMS.csv` | Units | Product | unit, unit_type |
| `ITEMS.csv` | SysBal | Inventory | quantity |
| `ITEMS.csv` | VAT | Product | is_taxable, tax_rate |
| `ITEMS.csv` | ReOrderLevel | Product | reorder_level |
| `ITEMS.csv` | SellingPriceLoose01 | Product | price_per_meter |
| Derived | SP01/Loose01 | Product | meters_per_roll |
| `GRNs.csv` | CostPrice | Product | cost_price (when OPPrice01=0) |
| `Movements2.csv` | Price (GRN) | Product | cost_price (when OPPrice01=0) |

### Users (migrate_legacy_data.py)

| Source | Field | POS Model | Field |
|---|---|---|---|
| `STPS.csv` | UserName | User | username |
| `STPS.csv` | UserPassword | User | password_hash (bcrypt) |
| — | — | User | full_name (title case of username) |
| — | — | User | role ("owner" for SUPPORT, "staff" for others) |

### Customers (migrate_legacy_data.py)

| Source | Field | POS Model | Field |
|---|---|---|---|
| `Suppliers.csv` | CodeNo | Customer | (matched by name+phone) |
| `Suppliers.csv` | Name | Customer | name |
| `Suppliers.csv` | Tel | Customer | phone |
| `Suppliers.csv` | EMail | Customer | email |
| `Suppliers.csv` | Address | Customer | address |
| `Suppliers.csv` | OPBal | Customer | balance |

### Suppliers (migrate_legacy_data.py)

| Source | Field | POS Model | Field |
|---|---|---|---|
| `Suppliers.csv` | CodeNo | Supplier | (matched by store_id+name) |
| `Suppliers.csv` | Name | Supplier | name |
| `Suppliers.csv` | CPerson | Supplier | contact_person |
| `Suppliers.csv` | Tel | Supplier | phone |
| `Suppliers.csv` | PIN | Supplier | tax_pin |
| `Suppliers.csv` | EMail | Supplier | email |
| `Suppliers.csv` | Address | Supplier | address |
| `Suppliers.csv` | TotalDue | Supplier | balance |

### GRNs (migrate_legacy_data.py)

| Source | Field | POS Model | Field |
|---|---|---|---|
| `GRNs.csv` | GRNNo | GoodsReceivedNote | grn_no |
| `GRNs.csv` | TDate | GoodsReceivedNote | delivery_date |
| `GRNs.csv` | Supplier | GoodsReceivedNote | supplier_id (via Suppliers.csv) |
| `GRNs.csv` | UserName | GoodsReceivedNote | user_id (via STPS.csv) |
| `GRNs.csv` | Amount (sum) | GoodsReceivedNote | total_amount |
| `GRNs.csv` | Item | GoodsReceivedItem | product_id |
| `GRNs.csv` | Quantity | GoodsReceivedItem | quantity_received |
| `GRNs.csv` | CostPrice | GoodsReceivedItem | unit_cost |
| `GRNs.csv` | NetAmount | GoodsReceivedItem | total_cost |

### Sales (migrate_legacy_data.py)

| Source | Field | POS Model | Field |
|---|---|---|---|
| `MINs.csv` | MINNo | Sale | invoice_no |
| `MINs.csv` | TDate | Sale | created_at |
| `MINs.csv` | Customer | Sale | customer_id (via Suppliers.csv) |
| `MINs.csv` | UserName | Sale | user_id (via STPS.csv) |
| `MINs.csv` | Discount (first row) | Sale | discount_amount |
| `MINs.csv` | AmtRecvd (first row) | Sale | status (paid/unpaid/partial) |
| `MINs.csv` | Item | SaleItem | product_id |
| `MINs.csv` | Qnty | SaleItem | quantity |
| `MINs.csv` | Price | SaleItem | unit_price |
| `MINs.csv` | NetPrice | SaleItem | total |
| — | — | SaleItem | cost_price (snapshot from Product) |

### Payments (migrate_legacy_data.py)

| Source | Field | POS Model | Field |
|---|---|---|---|
| `BatchPayments.csv` | Amount | Payment | amount |
| `BatchPayments.csv` | Customer | Payment | customer_id (via Suppliers.csv) |
| `BatchPayments.csv` | MINNo | Payment | sale_id (via MINs.csv) |
| `BatchPayments.csv` | TDate | Payment | created_at |
| `BatchPayments.csv` | RefNo | Payment | reference |
| `BatchPayments.csv` | Remark | Payment | payment_method (detected: cash/mpesa/cheque/bank) |
| `BatchPayments.csv` | UserName | Payment | user_id |

### Supplier Payments (migrate_legacy_data.py)

| Source | Field | POS Model | Field |
|---|---|---|---|
| `BatchPaymentsGRNs.csv` | Amount | SupplierPayment | amount |
| `BatchPaymentsGRNs.csv` | Supplier | SupplierPayment | supplier_id (via Suppliers.csv) |
| `BatchPaymentsGRNs.csv` | GRNNo | SupplierPayment | reference |
| `BatchPaymentsGRNs.csv` | TDate | SupplierPayment | created_at |
| `BatchPaymentsGRNs.csv` | UserName | SupplierPayment | user_id |

### Stock Movements (migrate_legacy_data.py)

| Source | Field | POS Model | Field |
|---|---|---|---|
| `Movements.csv` | Item | StockMovement | product_id |
| `Movements.csv` | QntyIn | StockMovement | type="in", quantity=+QntyIn |
| `Movements.csv` | QntyOut | StockMovement | type="sale", quantity=-QntyOut |
| `Movements.csv` | TransRefNo | StockMovement | reference_id |
| `Movements.csv` | TransDate | StockMovement | created_at |

---

## Migration Results

| Entity | Count | Notes |
|---|---|---|
| Products | 1,701 | From ITEMS.csv |
| Categories | 38 | From GroupsT.csv |
| Users | 6 | From STPS.csv + existing owner |
| Customers | 54 | From Suppliers.csv (Client=True) + existing |
| Suppliers | 87 | From Suppliers.csv (Supplier=True) + existing |
| GRNs | 231 | From GRNs.csv, 1,439 line items |
| Sales | 350 | From MINs.csv, 2,937 line items |
| Customer Payments | 385 | From BatchPayments.csv |
| Supplier Payments | 276 | From BatchPaymentsGRNs.csv |
| Stock Movements | 11,426 | From Movements.csv |
| Items with BP | 776 | 925 items have no cost in legacy data |

---

## Data Quality Flags

- **StockBalances.csv**: Only 1 item (6063), duplicate rows
- **rptReceipt.csv**: 91% blank (20 of 22 rows)
- **SalesStatus.csv**: TDate column never populated
- **STPS.csv**: Plaintext passwords (migrated with bcrypt hashing)
- **ITEMS.csv**: All OPPrice/LastPrice columns are zero
- **4 files** have exact duplicate rows: StockBalances, rptVAT, Licids, Profoma
- **38 items** with stock have GRN rows in Movements2.csv but Price=0 (opening stock, no cost recorded)
- **1 item** in GRNs.csv has Supplier="0" (cash purchase or internal transfer)
