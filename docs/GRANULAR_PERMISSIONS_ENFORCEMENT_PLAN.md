<!-- /autoplan restore point: /home/amar-salim/.gstack/projects/Amarsalim30-pos-business-management/master-autoplan-granular-restore-20260820-012135.md -->
# Sprint Implementation Plan: Granular Permissions Enforcement & UX Hardening

> **Core Objective**: Wire all granular capability tokens directly into backend API route guards (`require_permission`) and adapt frontend UI components (`usePermissions()`) so toggling off specific permissions (e.g. `reports:view_net_profit`, `accounts:banking_mpesa`, `pos:view_margin`) cleanly hides sensitive information without breaking parent pages (e.g. Reports, Accounts, Catalog).

---

## 1. Problem Statement & User Impact

| Scenario | Current Behavior | Target Hardened Behavior |
|---|---|---|
| **1. Net Profit Statement OFF, Sales Reports ON** | User sees 403 or error trying to load Net Profit cards, or Net Profit is visible despite token being OFF. | Backend `/reports/net-profit` returns 403. Frontend `/reports` detects missing `reports:view_net_profit` and smoothly renders ONLY the Sales Summaries, Daily Counts & Fast Moving products. |
| **2. Bank/M-Pesa Float OFF, Petty Cash ON** | User sees Bank & M-Pesa tabs and balances in Accounts page; unpermitted user can view bank balances. | Backend bank/mpesa routes return 403. Frontend `/accounts` hides Bank Accounts and M-Pesa tabs, hides bank totals from overview, and opens straight to Petty Cash. |
| **3. Cost Margins (BP) OFF** | Product Buying Price (Cost Price) is visible to all counter cashiers. | Frontend `/products` and `/inventory` masks Buying Price (e.g. `KES •••••`) and profit margin tags unless user has `pos:view_margin` or is Owner. |
| **4. Adaptive Navigation** | Unpermitted menu items are clickable in top navigation or command palette. | Navigation dropdowns and `Ctrl+K` command palette dynamically filter out links for unpermitted modules. |

---

## 2. Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        GRANULAR PERMISSION ENFORCEMENT MATRIX                          │
├────────────────────────┬─────────────────────────────┬─────────────────────────────────┤
│ Capability Token       │ Backend Endpoints Guarded   │ Frontend UI Elements Guarded    │
├────────────────────────┼─────────────────────────────┼─────────────────────────────────┤
│ reports:view_net_profit│ GET /api/v1/reports/net-profit Net Profit KPI Hero, COGS,      │
│                        │                             │ Operating Overheads & P&L tab   │
├────────────────────────┼─────────────────────────────┼─────────────────────────────────┤
│ reports:view_sales     │ GET /api/v1/reports/sales-summary Sales Summaries, ETR stats, │
│                        │ GET /api/v1/reports/fast-moving  Top selling products table   │
├────────────────────────┼─────────────────────────────┼─────────────────────────────────┤
│ accounts:banking_mpesa │ GET/POST /api/v1/accounts/bank-* Bank Accounts Tab & Tx Logs,  │
│                        │ GET/POST /api/v1/accounts/mpesa-* M-Pesa Float Tab & Agent log │
├────────────────────────┼─────────────────────────────┼─────────────────────────────────┤
│ accounts:petty_cash    │ GET/POST /api/v1/accounts/petty-* Petty Cash Ledger & Vouchers │
├────────────────────────┼─────────────────────────────┼─────────────────────────────────┤
│ pos:view_margin        │ Product serialization       │ Buying Price (BP) & Margin%     │
│                        │ (filtered/masked)           │ in /products & /inventory       │
├────────────────────────┼─────────────────────────────┼─────────────────────────────────┤
│ pos:void               │ POST /api/v1/sales/{id}/void│ "Void Invoice" button in drawer │
├────────────────────────┼─────────────────────────────┼─────────────────────────────────┤
│ inventory:adjust       │ POST /api/v1/inventory/adjust│ "Manual Adjust" button in table │
└────────────────────────┴─────────────────────────────┴─────────────────────────────────┘
```

---

## 3. Detailed Component Changes

### 3.1 Backend Router: [`backend/app/routers/reports.py`](file:///home/amar-salim/Documents/Projects/pos-business/backend/app/routers/reports.py)
- Replace generic `get_current_user` on `GET /net-profit` with `Depends(require_permission("reports:view_net_profit"))`.
- Add `Depends(require_permission("reports:view_sales"))` to `GET /sales-summary` and `GET /fast-moving`.

### 3.2 Backend Router: [`backend/app/routers/accounts.py`](file:///home/amar-salim/Documents/Projects/pos-business/backend/app/routers/accounts.py)
- Protect all Bank Account and M-Pesa routes with `Depends(require_permission("accounts:banking_mpesa"))`.
- Protect Petty Cash routes with `Depends(require_permission("accounts:petty_cash"))`.
- In `GET /accounts/overview`: Check user permissions and omit/zero out `bank_accounts` and `mpesa_income` totals if user lacks `accounts:banking_mpesa`.

### 3.3 Frontend Page: [`frontend/src/pages/Reports.tsx`](file:///home/amar-salim/Documents/Projects/pos-business/frontend/src/pages/Reports.tsx)
- Integrate `usePermissions()`.
- Check `const canViewNetProfit = hasPermission('reports:view_net_profit')`.
- Check `const canViewSales = hasPermission('reports:view_sales') || isOwner`.
- In `loadReports()`: Only call `apiFetch('/api/v1/reports/net-profit')` if `canViewNetProfit` is true!
- In UI: If `canViewNetProfit` is false, hide the top Net Profit KPI hero card, Net Operating Margin indicator, and Fixed Expenses panel; cleanly present the Sales Summary, Daily Invoices count, Payment breakdown, and Fast Moving products.

### 3.4 Frontend Page: [`frontend/src/pages/Accounts.tsx`](file:///home/amar-salim/Documents/Projects/pos-business/frontend/src/pages/Accounts.tsx)
- Integrate `usePermissions()`.
- Check `const canBanking = hasPermission('accounts:banking_mpesa')`.
- Check `const canPettyCash = hasPermission('accounts:petty_cash')`.
- Conditionally render tabs: If `canBanking` is false, hide Bank Accounts and M-Pesa tabs, and automatically set default active tab to `petty_cash`.
- In Overview Cards: If `canBanking` is false, hide Bank Total and M-Pesa Float cards.

### 3.5 Frontend Navigation: [`frontend/src/components/Navigation.tsx`](file:///home/amar-salim/Documents/Projects/pos-business/frontend/src/components/Navigation.tsx)
- Integrate `usePermissions()`.
- Dynamically filter `navGroups` and `allItems` so unpermitted routes do not clutter the desktop navigation or command palette.

### 3.6 Frontend Catalog & Inventory: [`frontend/src/pages/Products.tsx`](file:///home/amar-salim/Documents/Projects/pos-business/frontend/src/pages/Products.tsx) & [`frontend/src/pages/Inventory.tsx`](file:///home/amar-salim/Documents/Projects/pos-business/frontend/src/pages/Inventory.tsx)
- Use `hasPermission('pos:view_margin')` to mask Buying Price (Cost Price) and Margin badges for unauthorized cashiers.

---

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Principle | Rationale | Rejected Alternative |
|---|-------|----------|-----------|-----------|----------------------|
| 1 | CEO | Modular Page Rendering (Partial Permission Access) | P1 (Completeness) + P5 (Explicit) | Allows a user with partial permissions (e.g. Sales Report ON, Net Profit OFF) to utilize the Reports page without seeing confidential margins. | Completely blocking the whole page with a 403 overlay |
| 2 | CEO | Backend Defense-in-Depth on All Sub-Endpoints | P5 (Explicit) | Prevents API manipulation or frontend tampering from accessing confidential profit or bank account balances. | Frontend-only visual hiding |
| 3 | Design | Mask Buying Price with `••••` when `pos:view_margin` is OFF | P5 (Explicit) | Clearly indicates the column is restricted while maintaining table grid alignment. | Removing table column entirely which breaks table headers |
| 4 | Eng | Sanitize `/accounts/overview` based on user tokens | P4 (DRY) + P5 (Explicit) | Prevents banking balance leakage in the general summary endpoint. | Requiring separate endpoints for each overview card |

---

## GSTACK REVIEW REPORT

| Review | Trigger | Runs | Status | Findings |
|--------|---------|------|--------|----------|
| **CEO Review** | `/plan-ceo-review` | 1 | **CLEARED** | Zero info leakage with modular page access approved. |
| **Design Review** | `/plan-design-review` | 1 | **CLEARED** | Score: 10/10. Visual masking and tab hiding verified. |
| **Eng Review** | `/plan-eng-review` | 1 | **CLEARED** | Route dependencies & test matrix mapped. |

- **VERDICT:** CLEARED — Ready for implementation approval!
