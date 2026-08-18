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
  notes?: string | null;
  debit?: number | null;
  credit?: number | null;
  running_balance: number;
}

export interface CustomerLedgerResponse {
  customer_id: number;
  customer_name: string;
  phone?: string | null;
  total_debt: number;
  entries: CustomerLedgerEntry[];
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
  valid_until: string | null;
  notes: string | null;
  converted_sale_id: number | null;
  created_at: string;
  items: PreSaleItem[];
}
