## Key UX Improvements Over Legacy System

### 1. One Invoice = One Row (Always)

The legacy system stores each line item as a separate row with the invoice number repeated. When payments are made, duplicate rows appear with different `AmtRecvd` values — users see the same invoice twice (e.g., "INV-9826: unpaid" AND "INV-9826: paid").

**Modern fix**: Invoice is a header record. Line items are children. Payments are a separate table. Status is **computed**, never stored. One invoice always shows as one row.

### 2. Status is Computed, Not Stored

The legacy stores `Cash`, `Credit`, `UnPaid` as booleans on each line item — and they can become inconsistent.

**Modern fix**: `Sale.status` is derived from `SUM(Payment.amount)` vs `Sale.total`:
- `paid` → total_paid >= total
- `partial` → 0 < total_paid < total
- `unpaid` → total_paid = 0
- `voided` → voided_at IS NOT NULL

No status field is ever written. No status can ever be wrong.

### 3. Payments are Per-Invoice, Not Per-Customer

The legacy `CustomerPayment` is linked to `customer_id` only — you can't tell which invoice a payment was for.

**Modern fix**: `Payment` links to `sale_id`. Each payment is traceable to a specific invoice. Customer balance is computed from all their unpaid invoices, not a cached number.

### 4. Split Payments Supported

The legacy forces one payment method per invoice (`Cash=True` or `Credit=True`).

**Modern fix**: Each `Payment` record has its own `payment_method`. A customer can pay KES 5,000 via M-Pesa + KES 2,000 cash on the same invoice. The invoice shows a payment history list.

### 5. Customer Ledger is Transparent

The legacy shows a single `Balance` number with aging buckets (30/60/90/90+). Users can't see what makes up that balance.

**Modern fix**: Customer page shows a full ledger — each sale and each payment as its own line, with a running balance. Aging is computed from the oldest unpaid invoice date, not from a blurred aggregate.

### 6. Walk-in vs Customer is a Toggle, Not a Requirement

The legacy requires a customer code for every sale (even cash walk-ins go to "CASH AC").

**Modern fix**: Default is "Walk-in" — no customer needed for cash sales. Credit sales require customer selection (greyed out otherwise). Customer can be attached after the fact if needed.

### 7. Credit Sales Require Customer Selection

The legacy allows `Credit=True` without a customer link — creates orphan debts.

**Modern fix**: Credit payment method is disabled/greyed out until a customer is selected. This enforces data integrity at the UI level.

### 8. Receipt Shows What Was Sold, Not Stock Value

The legacy receipt shows raw data. The modern receipt is optimized for 80mm thermal printers:
- Store name and details at top
- Invoice number and date
- Item names with quantities and line totals
- Subtotal, VAT, discount, total
- Payment method and change
- "Asante" footer

No stock value, no cost price, no margin — customer doesn't see internal data.

### 9. Void is a First-Class Action

The legacy has no clear void mechanism — cancelled transactions just have `Cancelled=True` flag.

**Modern fix**: Void is an explicit action with:
- Confirmation dialog requiring reason
- Inventory restored via `void_return` stock movement
- Customer balance adjusted if credit sale
- `user_id` of who voided is recorded
- Original invoice preserved — never deleted

### 10. Real-Time Stock Warnings at Point of Sale

The legacy shows no stock information on the sales screen.

**Modern fix**: Each product in search results shows:
- Current stock quantity (pieces or rolls+meters)
- Color-coded badge: Green (healthy), Yellow (at reorder), Red (below reorder), Gray (out of stock)
- BP (cost price) shown subtly so cashier knows the floor when negotiating
- Oversell prevention — blocks checkout if stock insufficient

### 14. Sales List Has Smart Filters

The legacy has no searchable sales history.

**Modern fix**: Sales list supports:
- Text search (invoice number, customer name)
- Date range filter
- Status filter (paid/unpaid/partial/voided)
- ETR filter
- Customer filter
- Sortable columns

### 15. Invoice Numbering is Human-Readable

The legacy uses plain sequential numbers (40326, 40826) — no date context.

**Modern fix**: Format `INV-YYYYMMDD-NNNN` (e.g., `INV-20260819-0042`). Date-scoped, per-store, sequential within the day. Easy to reference verbally ("invoice from today, number 42").
