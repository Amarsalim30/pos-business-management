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
  price_per_meter: number | null;
  cost_per_meter: number | null;
  reorder_level: number;
  is_taxable: boolean;
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
