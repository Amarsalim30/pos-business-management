# POS Business Management — Domain Glossary

> Ubiquitous language for the POS & Business Management system. No implementation details — terms only.

## Business Entities

- **Store**: A physical retail location selling solar equipment and supplies. Each store operates independently with its own database. V1 targets a single store.

- **Owner**: The business proprietor who oversees all stores. Has full system access including profit data, settings, and user management. May also operate as a cashier.

- **Staff**: An employee at a store who can make sales, view inventory, manage customers/suppliers, and record payments. Cannot access profit data, settings, or user management.

- **Customer**: A person or business that buys goods or services. Maintains a running account balance (what they owe the store). Payments reduce the overall balance, not tied to specific invoices.

- **Supplier**: A vendor that provides goods to the store. Maintains a running account balance (what the store owes them). Payments reduce the overall balance, not tied to specific purchase orders.

## Sales & Documents

- **Sale (Invoice)**: A completed transaction where goods leave the store. May be fully paid, partially paid, or unpaid (credit). The selling price per line item is editable at point of sale (negotiation). Discount applies per sale (whole invoice), not per item.

- **Pre-Sale Document**: A document created before a sale is finalized. Has a `type` field: either **Quotation** (price estimate) or **Proforma Invoice** (formal pre-payment document). Any pre-sale document can be converted to a sale. A quotation can also be converted to a proforma.

- **Void**: Full cancellation of a completed sale. Stock returns to inventory, customer balance adjusts. Owner-only action. The voided record is preserved for audit. No partial refunds in v1.

- **ETR (Electronic Tax Register)**: An internal bookkeeping label — NOT a fiscal device integration. A boolean flag (`is_etr`) on sales and purchases that marks whether the transaction appears on tax reports. Used to separate "on-the-books" from "off-the-books" transactions for reporting.

## Inventory

- **Product**: An item in the store's catalog. Has a selling price (tax-inclusive, editable at point of sale), cost/buying price (BP), SKU, category, and reorder level. Has an `is_taxable` flag for VAT calculation. Has a `unit_type`: either `piece` (standard) or `roll` (sold by roll or by meter).

- **BP (Buying Price)**: The cost price of a product — what the store paid the supplier. Visible on the POS screen so staff knows the margin floor when negotiating prices.

- **Roll Product**: A product with `unit_type = 'roll'` — items like cables, wires, and conduit that come in rolls of a fixed length. Has `meters_per_roll` (configurable per product, e.g., 100m), `price_per_roll`, and `price_per_meter` (all editable at point of sale). Inventory is stored in meters (decimal, supports partial meters like 2.5m). Displayed as "X rolls + Y meters" (e.g., "4 rolls + 85m").

- **Auto Stock Conversion**: When a roll product is sold, the system automatically handles unit conversion. Selling 1 roll deducts `meters_per_roll` from inventory. Selling 15 meters deducts 15m. No manual "break a roll" step — the system tracks total meters and the roll/meter display updates automatically.

- **Stock Movement**: A record of inventory change. Types: `in` (goods received), `sale` (goods sold), `adjust` (manual correction), `project_allocation` (materials used in a project).

- **Stock Take**: A physical count of inventory. Staff counts actual quantities; the system calculates variance against expected quantities. Roll products show "X rolls + Y meters" format for easy physical counting.

## Purchasing

- **Purchase Order (PO)**: An order placed with a supplier for goods. When goods arrive, a Goods Received Note (GRN) is created and inventory is updated.

- **Purchase Expense**: An additional cost associated with a purchase order (transport/fare, labour, handling). Tracked separately — does NOT affect product cost prices. For record-keeping and expense reporting only.

- **Goods Received Note (GRN)**: Confirmation that goods from a purchase order have arrived. Triggers inventory increase.

## Projects (Solar Installations)

- **Project**: A solar installation job for a client. Tracks income received and expenses incurred. Net profit is computed per project.

- **Inventory-Linked Expense**: Project materials pulled from store stock. Auto-deducts inventory via a `project_allocation` stock movement. Cost calculated from product cost price.

- **External Expense**: Project costs not from store inventory — labour, transport, externally sourced materials, subcontractor fees. Manually entered, no inventory impact.

## Financial

- **Petty Cash**: Small cash expenses (tea, transport, supplies). Simple in/out log.

- **Bank Account**: A tracked bank account with deposit/withdrawal records for balance tracking.

- **Recurring Expense**: A fixed monthly cost entered in store settings (rent, individual payroll amounts, other overheads). Deducted from monthly revenue in the owner dashboard.

- **Account-Level Payment**: Payments from customers or to suppliers that reduce the overall account balance. Not tied to specific invoices or purchase orders.

## Tax

- **VAT (Value Added Tax)**: Kenyan VAT at a configurable rate (default 16%). Prices are **tax-inclusive** — the displayed price includes VAT. For taxable products, VAT is extracted for reporting: `vat = price × rate / (1 + rate)`. Zero-rated products have `is_taxable = false`.

## Mpesa

- **Mpesa Agent Business**: A separate revenue stream where the store operates as a Safaricom M-Pesa agent (cash-in/cash-out for walk-in customers). Managed entirely by the Floatbook application — NOT part of this POS system. The POS has a simple Mpesa page for recording commission income that feeds into the owner dashboard.

- **Mpesa as Payment Method**: A payment method option when recording customer payments. Unrelated to the Mpesa Agent business.
