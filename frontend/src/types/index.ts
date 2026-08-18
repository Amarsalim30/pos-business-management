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
