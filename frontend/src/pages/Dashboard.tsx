import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import type { Store, User, RecurringExpense } from '../types';
import { 
  Users, 
  Receipt, 
  Shield, 
  DollarSign, 
  Plus, 
  CheckCircle2,
  Store as StoreIcon,
  Percent
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState<'rent' | 'payroll' | 'other'>('payroll');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadStoreDetails();
    if (user?.role === 'owner') {
      loadUsers();
      loadExpenses();
    }
  }, [user]);

  const loadStoreDetails = async () => {
    try {
      const data = await apiFetch<Store>('/api/v1/stores/settings');
      setStore(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await apiFetch<User[]>('/api/v1/users/');
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadExpenses = async () => {
    try {
      const data = await apiFetch<RecurringExpense[]>('/api/v1/stores/recurring-expenses');
      setExpenses(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseName || !newExpenseAmount) return;

    try {
      await apiFetch('/api/v1/stores/recurring-expenses', {
        method: 'POST',
        body: JSON.stringify({
          name: newExpenseName,
          amount: parseFloat(newExpenseAmount),
          category: newExpenseCategory,
        }),
      });
      setNewExpenseName('');
      setNewExpenseAmount('');
      loadExpenses();
      setMessage('Recurring expense added');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to add recurring expense');
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="flex items-center space-x-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 shadow-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="font-semibold">{message}</span>
        </div>
      )}

      {/* Foundation Summary Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Store Status</span>
              <StoreIcon className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-lg font-bold text-slate-900">{store?.name || '---'}</div>
            <div className="text-xs text-slate-500 mt-1">{store?.address || 'Nairobi, Kenya'} • {store?.phone || '+254...'}</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Tax & VAT Config</span>
              <Percent className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-lg font-bold text-slate-900 font-mono">
              {store?.vat_rate ? `${(Number(store.vat_rate) * 100).toFixed(0)}% Standard` : '16%'}
            </div>
            <div className="text-xs text-slate-500 mt-1">Tax-inclusive pricing extraction active</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">System Sprint</span>
              <Shield className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-lg font-bold text-emerald-700">Sprint 1 Ready</div>
            <div className="text-xs text-slate-500 mt-1">FastAPI Backend • RBAC • Clean White Tokens</div>
          </div>
        </div>

        {/* Owner View vs Staff View */}
        {user?.role === 'owner' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Management */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-amber-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Store Users & Roles</h3>
                </div>
                <span className="text-xs bg-slate-100 px-2.5 py-0.5 rounded-full text-slate-600 font-bold">
                  {users.length} Users
                </span>
              </div>

              <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 bg-white hover:bg-slate-50/70 transition-colors">
                    <div>
                      <div className="font-semibold text-sm text-slate-900">{u.full_name}</div>
                      <div className="text-xs text-slate-500">@{u.username}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        u.role === 'owner' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {u.role}
                      </span>
                      <span className={`h-2 w-2 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recurring Expenses (Rent & Payroll) */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-amber-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Monthly Fixed Deductions</h3>
                </div>
                <span className="text-xs bg-slate-100 px-2.5 py-0.5 rounded-full text-slate-600 font-bold">
                  {expenses.length} Fixed Overheads
                </span>
              </div>

              <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
                {expenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between p-3 bg-white hover:bg-slate-50/70 transition-colors">
                    <div>
                      <div className="font-semibold text-sm text-slate-900">{e.name}</div>
                      <div className="text-xs text-slate-500 capitalize">{e.category}</div>
                    </div>
                    <div className="text-sm font-bold text-slate-900 font-mono">
                      KES {Number(e.amount).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Expense Form */}
              <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Expense name"
                  value={newExpenseName}
                  onChange={(e) => setNewExpenseName(e.target.value)}
                  className="rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                />
                <select
                  value={newExpenseCategory}
                  onChange={(e) => setNewExpenseCategory(e.target.value as any)}
                  className="rounded-lg bg-white border border-slate-300 px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-amber-600"
                >
                  <option value="payroll">Payroll</option>
                  <option value="rent">Rent</option>
                  <option value="other">Other</option>
                </select>
                <input
                  type="number"
                  placeholder="Amount (KES)"
                  value={newExpenseAmount}
                  onChange={(e) => setNewExpenseAmount(e.target.value)}
                  className="rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                />
                <button
                  type="submit"
                  className="flex items-center justify-center space-x-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Fixed</span>
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-3 shadow-xs">
            <Receipt className="h-10 w-10 text-amber-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">Cashier Register Workspace</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Staff session active. Product lookup, roll unit conversions, and sales invoicing will open in Sprints 2 & 3.
            </p>
          </div>
        )}
    </div>
  );
};
