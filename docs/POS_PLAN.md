# Modern POS & Business Management System — Plan (Revised)

> Revised after grilling session on 2026-08-18. See `docs/adr/` for architectural decision records.
> See `CONTEXT.md` for domain glossary.

## Architecture Overview (V1 — Single Store)

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                      │
│  React + TypeScript + TailwindCSS                        │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │  Sales  │ │ Inventory│ │ Projects │ │  Dashboard │  │
│  │ Module  │ │  Module  │ │  Module  │ │  (Owner)   │  │
│  └─────────┘ └──────────┘ └──────────┘ └────────────┘  │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │Purchasng│ │Reporting │ │ Accounts │ │   Mpesa    │  │
│  │ Module  │ │  Module  │ │(Simplified)│ │  (Manual) │  │
│  └─────────┘ └──────────┘ └──────────┘ └────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ REST API (http://localhost:8000)
┌────────────────────────┴────────────────────────────────┐
│                   SERVER (FastAPI)                        │
│  Python 3.13+ / FastAPI / SQLAlchemy / Alembic           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Auth     │ │ Business │ │ Financial│ │ Reporting │  │
│  │ Service  │ │ Logic    │ │ Service  │ │ Service   │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│              PostgreSQL 15+ (local, single store)        │
│  Local-first: runs on the store machine                  │
│  store_id FK preserved for future multi-store            │
└─────────────────────────────────────────────────────────┘

Deployment: systemd service, staff accesses via browser bookmark
Printing: Browser print (Ctrl+P), receipt layout sized for 80mm
```

---

## Database Schema (Core Entities — Revised)

### 1. Users & Auth
```sql
-- users: id, username, password_hash, full_name, role('owner'|'staff'),
--        store_id, is_active
-- sessions: id, user_id, token, expires_at
-- audit_log: id, user_id, action, table_name, record_id, changes, timestamp
```

### 2. Store & Settings
```sql
-- stores: id, name, address, phone, tax_id, vat_rate(default 0.16), is_active
-- recurring_expenses: id, store_id, name, amount, category('rent'|'payroll'|'other')
--   (e.g., "Rent: 50,000", "John: 40,000", "Mary: 35,000")
```

### 3. Products & Inventory
```sql
-- categories: id, name, parent_id (hierarchical)
-- products: id, name, sku, category_id, unit, cost_price(BP), selling_price(SP),
--           reorder_level, is_taxable(default true), is_active, created_at,
--           unit_type('piece'|'roll', default 'piece'),
--           meters_per_roll(nullable, decimal — e.g., 100.0),
--           price_per_roll(nullable), price_per_meter(nullable)
-- inventory: id, product_id, store_id, quantity(decimal — meters for rolls, units for pieces),
--            last_updated
--   Display for rolls: "X rolls + Y meters" where X=floor(qty/meters_per_roll), Y=remainder
-- stock_movements: id, product_id, store_id,
--                  type('in'|'sale'|'adjust'|'project_allocation'|'void_return'),
--                  quantity(decimal), unit_sold('piece'|'roll'|'meter'),
--                  reference_id, timestamp, user_id
-- stock_takes: id, store_id, user_id, status, created_at
-- stock_take_items: id, stock_take_id, product_id, expected_qty, actual_qty, variance
--   Roll products: staff enters count as "X rolls + Y meters", system converts to total meters
```

### 4. Sales & Invoicing
```sql
-- customers: id, name, phone, email, address, balance, is_active
-- sales: id, invoice_no, customer_id, store_id, user_id, subtotal, tax_amount,
--        discount(per-sale), total, payment_method, status('paid'|'unpaid'|'partial'|'voided'),
--        is_etr(boolean), date, created_at
-- sale_items: id, sale_id, product_id, quantity, unit_price(editable SP),
--             cost_price(BP snapshot), total
-- customer_payments: id, customer_id, amount, method('cash'|'mpesa'|'card'|'bank'),
--                    reference, date, user_id
--   (account-level: reduces overall customer balance, not tied to specific sale)
--
-- Tax: prices are tax-inclusive. VAT extracted for reporting:
--   vat = price × vat_rate / (1 + vat_rate) for taxable items
--   Zero-rated items: is_taxable = false, no VAT extracted
```

### 5. Pre-Sale Documents (Quotations + Proformas unified)
```sql
-- pre_sale_documents: id, document_no, type('quotation'|'proforma'),
--                     customer_id, store_id, user_id, subtotal, tax_amount,
--                     total, status('draft'|'accepted'|'converted'), valid_until, date
-- pre_sale_items: id, document_id, product_id, quantity, unit_price, total
--
-- Conversion paths: quotation→sale, proforma→sale, quotation→proforma, direct sale
```

### 6. Purchasing
```sql
-- suppliers: id, name, phone, email, address, balance, is_active
-- purchase_orders: id, po_no, supplier_id, store_id, user_id, subtotal, tax_amount,
--                  total, status('ordered'|'received'|'cancelled'), is_etr, date
-- purchase_items: id, po_id, product_id, quantity, unit_cost, total
-- purchase_expenses: id, po_id, description, amount, category('fare'|'labour'|'other')
--   (separate tracking, does NOT affect product cost_price)
-- goods_received: id, grn_no, po_id, store_id, user_id, date
-- goods_received_items: id, grn_id, product_id, quantity, unit_cost
-- supplier_payments: id, supplier_id, amount, method, reference, date, user_id
--   (account-level: reduces overall supplier balance)
```

### 7. Projects (Solar Installations)
```sql
-- projects: id, name, client_name, client_phone, description, store_id,
--           start_date, end_date, status('active'|'completed'|'cancelled'),
--           quoted_amount, created_by
--
-- project_expenses: id, project_id, source('inventory'|'external'),
--                    category('labor'|'materials'|'transport'|'other'),
--                    product_id(nullable, for inventory-linked),
--                    quantity(nullable),
--                    unit_price(editable SP — what client is charged per unit),
--                    amount(computed: unit_price × quantity),
--                    cost_price(BP snapshot — system-calculated, not user-entered),
--                    cost_amount(system-calculated: cost_price × quantity),
--                    description, vendor, date, receipt_no, created_by
--   inventory-linked: auto-deducts stock via stock_movement(type='project_allocation')
--                     snapshots BP from product at allocation time
--                     auto-creates project_income at unit_price × quantity
--   external: manual entry, no inventory impact, no auto-income
--
-- project_income: id, project_id, description, amount,
--                  source('client_payment'|'materials'), date, created_by
--   source='client_payment': manual entry (cash/Mpesa from client)
--   source='materials': auto-created from inventory allocation
--
-- project_net_profit: (computed) SUM(income) - SUM(expenses)
--   Materials margin captured automatically:
--     income from materials = unit_price × qty (what client pays)
--     expense from materials = cost_price × qty (what store paid)
--     profit on materials = (unit_price - cost_price) × qty
```

### 8. Financial (Simplified — no double-entry)
```sql
-- petty_cash: id, store_id, date, description, amount, type('in'|'out'), user_id
-- bank_accounts: id, name, account_number, bank_name, balance, store_id
-- bank_transactions: id, bank_account_id, date, description, amount,
--                    type('deposit'|'withdrawal')
-- mpesa_income: id, store_id, date, description, amount, user_id
--   (manual entry for Mpesa agent commissions — Floatbook manages the actual agent ops)
```

### 9. ETR (unchanged — filter, not a system)
```sql
-- ETR is a boolean flag (is_etr) on sales and purchase_orders
-- Reports filter by: All | ETR Only | Non-ETR Only
-- No fiscal device integration — internal bookkeeping label only
```

### 10. Reporting (computed views)
```sql
-- daily_sales: (computed view by store, date range)
-- fast_moving: (computed view) products ranked by sales velocity
-- net_profit: revenue - COGS - purchase_expenses - petty_cash_out - recurring_expenses
-- owner_dashboard: single-store summary with profit breakdown
```

---

## DROPPED from V1 (with rationale)

| Item | Rationale |
|------|-----------|
| Multi-store sync | Single store first; schema is multi-store-ready (store_id FK) |
| Cloud/central server | Owner dashboard runs locally on store machine |
| Mpesa Agent backend | Floatbook app handles this; POS has manual income entry only |
| Double-entry accounting | Over-engineered for 2-3 store business; simplified tracking suffices |
| Separate quotation + proforma tables | Merged into single `pre_sale_documents` with type field |
| Partial refunds | Void-only for v1 (full cancellation, owner-only) |
| Custom RBAC | Two hardcoded roles (owner/staff); customizable permissions deferred |
| Direct thermal printing | Browser print for v1; receipt layout designed for 80mm |
| Landed cost accounting | Purchase expenses tracked separately, not folded into product cost |
| KRA/TIMS fiscal device integration | ETR is internal label only |
| WebSocket real-time updates | REST API sufficient for v1 |

---

## API Structure (FastAPI — Revised)

```
/api/v1/
├── auth/           POST /login, POST /logout, POST /refresh
├── users/          CRUD (owner only)
├── stores/         settings, recurring expenses (owner only)
├── products/       CRUD + Stock Balances + search + /{id}/purchase-history
├── inventory/      stock adjustments, stock-takes
├── sales/          create, list, void + /etr-filter
├── pre-sales/      CRUD (quotation/proforma) + convert-to-sale
├── customers/      CRUD + balances + payments
├── purchases/      create PO, receive goods (GRN), list + expenses + /etr-filter
├── suppliers/      CRUD + balances + payments
├── projects/       CRUD + expenses (inventory-linked + external) + income
├── mpesa/          manual income entry
├── accounts/       petty cash, bank accounts + transactions
├── reports/        sales, inventory, purchases, profit, fast-moving
├── dashboard/      owner summary (profit breakdown, recurring deductions)
├── printing/       receipt HTML generation (80mm layout, browser print)
└── health/         system status
```

---

## Frontend Pages (React — Revised)

| Page | Route | Description |
|---|---|---|
| **Login** | `/login` | Auth screen |
| **Dashboard** | `/` | Owner: net profit breakdown, recurring expense deductions, revenue sources. Staff: daily summary |
| **POS / Sales** | `/sales/new` | Type-ahead search, editable SP, BP visible, per-sale discount, ETR toggle, roll products: unit selector (Roll/Meter) with auto conversion |
| **Sales List** | `/sales` | Searchable sales history with ETR filter toggle |
| **Pre-Sales** | `/pre-sales` | Quotations & proformas (unified), convert to sale |
| **Purchases** | `/purchases` | PO creation, GRN, purchase expenses (fare/labour), ETR toggle |
| **Suppliers** | `/suppliers` | Supplier management + balances + payments |
| **Inventory** | `/inventory` | Stock Balances, adjustments |
| **Stock Take** | `/stock-take` | Physical count entry with variance |
| **Products** | `/products` | Product catalog, categories, pricing, taxable toggle |
| **Product Detail** | `/products/:id` | Purchase history — who bought it, quantities, dates |
| **Customers** | `/customers` | Customer management + balances + payments |
| **Projects** | `/projects` | Solar projects: income, expenses (inventory + external), net profit |
| **Mpesa** | `/mpesa` | Manual income entry for Mpesa agent commissions |
| **Reports** | `/reports` | Sales, purchases, inventory, profit, ETR reports |
| **Accounts** | `/accounts` | Petty cash log + bank account balances |
| **Fast Moving** | `/fast-moving` | Top selling products with velocity metrics |
| **User Management** | `/users` | Owner-only user admin |
| **Settings** | `/settings` | Store config, VAT rate, recurring expenses, backup/restore |

---

## Implementation Phases (Revised — Scope-Reduced)

### Phase 1: Foundation (Weeks 1-2)
- Project scaffolding (FastAPI + React + PostgreSQL)
- Auth system (login, JWT, roles: owner/staff)
- User management CRUD
- Store settings (including VAT rate, recurring expenses)
- Database migrations (Alembic)

### Phase 2: Core Inventory (Weeks 3-4)
- Product catalog + categories + taxable flag
- Inventory tracking
- Stock movements (adjustments)
- Stock take with variance reporting
- Re-order alerts

### Phase 3: Sales & Invoicing (Weeks 5-7)
- POS screen (type-ahead search, editable SP, BP visible, per-sale discount)
- Invoice generation
- Payment recording (cash, Mpesa, card, bank) — account-level
- ETR toggle
- Browser-print receipt (80mm layout)
- Customer management + balances
- Pre-sale documents (quotations + proformas + conversion)
- Void sales (owner-only)

### Phase 4: Purchasing (Weeks 8-9)
- Purchase order creation + purchase expenses (fare/labour)
- Goods received note (GRN)
- Supplier management + balances + payments
- ETR toggle for purchases

### Phase 5: Projects (Weeks 10-11)
- Solar project CRUD
- Project expenses (inventory-linked + external)
- Project income tracking
- Net profit per project

### Phase 6: Reporting & Dashboard (Weeks 12-13)
- Owner dashboard: net profit breakdown, recurring expense deductions, revenue sources
- Sales reports (daily, weekly, monthly)
- Fast-moving goods report
- Inventory valuation reports
- Purchasing reports + expense tracking
- ETR-specific reports
- Mpesa income page (manual entry)
- PDF export

### Phase 7: Accounts & Polish (Weeks 14-15)
- Petty cash tracking
- Bank account + transaction tracking
- Backup/restore system
- Final testing + deployment as systemd service
