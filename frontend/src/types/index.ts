export interface User {
  id: number;
  username: string;
  full_name: string;
  role: 'owner' | 'staff';
  store_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  tax_id: string | null;
  vat_rate: number;
  is_active: boolean;
  created_at: string;
}

export interface RecurringExpense {
  id: number;
  store_id: number;
  name: string;
  amount: number;
  category: 'rent' | 'payroll' | 'other';
  is_active: boolean;
}

export interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  store_id: number;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string | null;
  category_id: number | null;
  store_id: number;
  unit: string;
  unit_type: 'piece' | 'roll';
  meters_per_roll: number | null;
  cost_price: number;
  selling_price: number;
  price_per_roll?: number | null;
  price_per_meter: number | null;
  cost_per_meter: number | null;
  reorder_level: number;
  is_taxable: boolean;
  tax_rate?: number;
  is_active: boolean;
  current_stock: number;
  formatted_stock?: string;
  is_low_stock?: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  product_id: number;
  product_name: string;
  sku: string | null;
  unit: string;
  unit_type: 'piece' | 'roll';
  meters_per_roll: number | null;
  cost_price: number;
  selling_price: number;
  reorder_level: number;
  quantity: number;
  formatted_stock: string;
  is_low_stock: boolean;
  last_updated: string;
}

export interface StockMovement {
  id: number;
  product_id: number;
  product_name?: string | null;
  sku?: string | null;
  store_id: number;
  type: string;
  quantity: number;
  unit_sold: string | null;
  previous_quantity: number;
  new_quantity: number;
  reference_id: string | null;
  note: string | null;
  user_id: number;
  created_at: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  balance: number;
  is_active: boolean;
  created_at: string;
}

export interface Payment {
  id: number;
  sale_id?: number | null;
  customer_id?: number | null;
  amount: number;
  payment_method: string;
  reference?: string | null;
  notes?: string | null;
  user_id: number;
  created_at: string;
}

export interface CustomerPayment extends Payment {}

export interface CustomerLedgerEntry {
  id: string;
  date: string;
  entry_type: 'sale' | 'payment' | 'void';
  reference: string;
  site_name?: string | null;
  notes?: string | null;
  debit?: number | null;
  credit?: number | null;
  running_balance: number;
  sale_id?: number | null;
  items_count?: number | null;
  items_summary?: string | null;
  payment_method?: string | null;
}

export interface CustomerLedgerResponse {
  customer_id: number;
  customer_name: string;
  phone?: string | null;
  total_debt: number;
  entries: CustomerLedgerEntry[];
}

export interface CustomerSummaryResponse {
  total_customers: number;
  active_customers: number;
  total_receivables_debt: number;
  customers_with_debt: number;
}


export interface SaleItem {
  id: number;
  product_id: number;
  product_name: string;
  sku: string | null;
  unit_type: 'piece' | 'roll';
  unit_sold: string;
  quantity: number;
  rolls_qty?: number | null;
  loose_meters?: number | null;
  unit_price: number;
  cost_price: number;
  tax_rate: number;
  total: number;
}

export interface Sale {
  id: number;
  invoice_no: string;
  customer_id: number | null;
  customer_name: string | null;
  store_id: number;
  user_id: number;
  cashier_name: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  total_paid?: number;
  balance_due?: number;
  payment_method: string;
  payment_reference: string | null;
  status: 'paid' | 'unpaid' | 'partial' | 'voided';
  is_etr: boolean;
  site_name?: string | null;
  notes: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  created_at: string;
  items: SaleItem[];
  payments?: Payment[];
}

export interface PreSaleItem {
  id: number;
  product_id: number;
  product_name: string;
  sku: string | null;
  unit_type: 'piece' | 'roll';
  unit_sold: string;
  quantity: number;
  rolls_qty?: number | null;
  loose_meters?: number | null;
  unit_price: number;
  tax_rate: number;
  total: number;
}

export interface PreSaleDocument {
  id: number;
  document_no: string;
  type: 'quotation' | 'proforma';
  customer_id: number | null;
  customer_name: string | null;
  store_id: number;
  user_id: number;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  status: 'draft' | 'accepted' | 'converted' | 'expired';
  site_name?: string | null;
  valid_until: string | null;
  notes: string | null;
  converted_sale_id: number | null;
  created_at: string;
  items: PreSaleItem[];
}

export interface Supplier {
  id: number;
  store_id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_pin: string | null;
  balance: number;
  is_active: boolean;
  created_at: string;
}

export interface SupplierPayment {
  id: number;
  store_id: number;
  supplier_id: number;
  supplier_name?: string | null;
  po_id: number | null;
  user_id: number;
  authorizer_name?: string | null;
  amount: number;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface SupplierLedgerEntry {
  id: string;
  date: string;
  type: string;
  reference: string;
  debit: number;
  credit: number;
  running_balance: number;
  notes?: string | null;
  grn_id?: number | null;
  grn_no?: string | null;
  payment_id?: number | null;
  payment_method?: string | null;
  po_id?: number | null;
  po_no?: string | null;
  items_count?: number | null;
  items_summary?: string | null;
}

export interface SupplierLedgerResponse {
  supplier_id: number;
  supplier_name: string;
  contact_person: string | null;
  phone: string | null;
  email?: string | null;
  tax_pin?: string | null;
  current_balance: number;
  total_invoiced?: number;
  total_paid?: number;
  entries: SupplierLedgerEntry[];
}

export interface SupplierSummaryResponse {
  total_suppliers: number;
  active_suppliers: number;
  total_payables_debt: number;
  suppliers_with_balance: number;
}


export interface PurchaseItem {
  id: number;
  po_id: number;
  product_id: number;
  product_name: string | null;
  product_sku: string | null;
  unit_type: 'piece' | 'roll';
  ordered_qty: number;
  received_qty: number;
  unit_cost: number;
  total_cost: number;
}

export interface PurchaseExpense {
  id: number;
  po_id: number;
  store_id: number;
  user_id: number;
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  reference: string | null;
  created_at: string;
}

export interface PurchaseOrder {
  id: number;
  store_id: number;
  po_no: string;
  supplier_id: number;
  supplier_name: string | null;
  user_id: number;
  authorizer_name: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled';
  is_etr: boolean;
  notes: string | null;
  expected_delivery_date: string | null;
  created_at: string;
  cancelled_at: string | null;
  items: PurchaseItem[];
  expenses: PurchaseExpense[];
}

export interface GRNItem {
  id: number;
  grn_id: number;
  product_id: number;
  product_name: string | null;
  product_sku?: string | null;
  unit?: string | null;
  meters_per_roll?: number | null;
  unit_type: 'piece' | 'roll';
  quantity_received: number;
  rolls_received: number;
  loose_meters_received: number;
  unit_cost: number;
  total_cost: number;
}

export interface GoodsReceivedNote {
  id: number;
  store_id: number;
  grn_no: string;
  po_id: number | null;
  po_no: string | null;
  supplier_id: number | null;
  supplier_name: string | null;
  user_id: number;
  receiver_name: string | null;
  invoice_number: string | null;
  delivery_date: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
  items: GRNItem[];
}

// =========================================================================
// Projects Interfaces (Phase 5)
// =========================================================================

export interface ProjectExpense {
  id: number;
  project_id: number;
  source: 'inventory' | 'external';
  category: string;
  product_id?: number | null;
  product_name?: string | null;
  quantity?: number | null;
  unit_sold?: string | null;
  unit_price?: number | null;
  amount: number;
  cost_price?: number | null;
  cost_amount?: number | null;
  description?: string | null;
  vendor?: string | null;
  receipt_no?: string | null;
  date: string;
  created_by: number;
  creator_name?: string | null;
  created_at: string;
}

export interface ProjectIncome {
  id: number;
  project_id: number;
  description: string;
  amount: number;
  source: 'client_payment' | 'materials';
  payment_method?: string | null;
  reference?: string | null;
  date: string;
  created_by: number;
  creator_name?: string | null;
  created_at: string;
}

export interface Project {
  id: number;
  store_id: number;
  name: string;
  client_name: string;
  client_phone?: string | null;
  customer_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  description?: string | null;
  quoted_amount: number;
  start_date?: string | null;
  end_date?: string | null;
  status: 'draft' | 'active' | 'commissioning' | 'completed' | 'cancelled';
  created_by: number;
  creator_name?: string | null;
  created_at: string;
  updated_at: string;
  total_income: number;
  total_expenses: number;
  net_profit: number;
}


export interface ProjectDetail extends Project {
  expenses: ProjectExpense[];
  incomes: ProjectIncome[];
  materials_cost: number;
  materials_billed: number;
  materials_profit: number;
  external_expenses_total: number;
  client_payments_total: number;
}

export interface ProjectSummary {
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  total_quoted_value: number;
  total_project_income: number;
  total_project_cost: number;
  total_net_profit: number;
}

// =========================================================================
// Accounts & Petty Cash Interfaces (Phase 7 & 8)
// =========================================================================

export interface PettyCashEntry {
  id: number;
  store_id: number;
  date: string;
  description: string;
  amount: number;
  type: 'in' | 'out';
  category?: string | null;
  receipt_no?: string | null;
  user_id: number;
  user_name?: string | null;
  created_at: string;
}

export interface PettyCashSummary {
  total_in: number;
  total_out: number;
  balance: number;
  entries_count: number;
}

export interface BankTransaction {
  id: number;
  bank_account_id: number;
  date: string;
  description: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  reference?: string | null;
  user_id: number;
  user_name?: string | null;
  created_at: string;
}

export interface BankAccount {
  id: number;
  store_id: number;
  name: string;
  bank_name: string;
  account_number: string;
  balance: number;
  is_active: boolean;
  created_at: string;
  transactions?: BankTransaction[];
}

export interface BankAccountDetail extends BankAccount {
  transactions: BankTransaction[];
}


export interface MpesaIncome {
  id: number;
  store_id: number;
  date: string;
  description: string;
  amount: number;
  reference?: string | null;
  user_id: number;
  user_name?: string | null;
  created_at: string;
}

export interface AccountsOverview {
  petty_cash_balance: number;
  total_bank_balances: number;
  total_mpesa_commission: number;
  active_bank_accounts: number;
}

// =========================================================================
// Reports Interfaces (Phase 6 & 10)
// =========================================================================

export interface PaymentMethodSummaryItem {
  method: string;
  total_amount: number;
  count: number;
  percentage: number;
}

export interface FastMovingProductItem {
  product_id: number;
  product_name: string;
  sku?: string | null;
  category_name?: string | null;
  total_units_sold: number;
  total_revenue: number;
  total_profit: number;
  stock_on_hand: number;
}

export interface NetProfitStatement {
  period_start?: string | null;
  period_end?: string | null;
  gross_sales_revenue: number;
  tax_amount: number;
  discount_amount: number;
  net_sales_revenue: number;
  cost_of_goods_sold: number;
  gross_profit: number;
  gross_margin_percentage: number;
  purchase_expenses: number;
  recurring_expenses: number;
  petty_cash_expenses: number;
  total_operating_expenses: number;
  mpesa_commission_income: number;
  project_net_profit: number;
  net_profit: number;
}

export interface SalesReportSummary {
  period_start?: string | null;
  period_end?: string | null;
  total_transactions: number;
  total_subtotal: number;
  total_tax: number;
  total_discount: number;
  total_revenue: number;
  total_collected: number;
  total_outstanding_credit: number;
  etr_revenue: number;
  non_etr_revenue: number;
  payment_methods: PaymentMethodSummaryItem[];
}


