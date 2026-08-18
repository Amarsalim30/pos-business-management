import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import type { Store, User, RecurringExpense } from '../types';
import { 
  Users, 
  Receipt, 
  LogOut, 
  Shield, 
  DollarSign, 
  Plus, 
  CheckCircle2
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black text-xl shadow-md shadow-amber-500/20">
            POS
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">
              {store?.name || 'Loading Store...'}
            </h1>
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>Online • Local DB</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-sm font-semibold text-white flex items-center justify-end space-x-1.5">
              <span>{user?.full_name}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
                {user?.role}
              </span>
            </div>
            <div className="text-xs text-slate-400">@{user?.username}</div>
          </div>

          <button
            onClick={() => logout()}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4 text-slate-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {message && (
          <div className="flex items-center space-x-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-400">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {/* Foundation Sprint Overview Banner */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
                <Shield className="h-4 w-4" />
                <span>Sprint 1: Foundation Completed</span>
              </div>
              <h2 className="text-xl font-bold text-white">System Status & Environment</h2>
              <p className="text-sm text-slate-400 mt-1">
                FastAPI backend, PostgreSQL data store, Cookie JWT Auth, and multi-user RBAC active.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-xl border border-slate-800 bg-slate-800/50 px-4 py-2.5">
                <div className="text-[11px] font-medium text-slate-400">Standard VAT Rate</div>
                <div className="text-base font-bold text-amber-400">
                  {store?.vat_rate ? `${(Number(store.vat_rate) * 100).toFixed(0)}%` : '16%'}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-800/50 px-4 py-2.5">
                <div className="text-[11px] font-medium text-slate-400">Active Role Access</div>
                <div className="text-base font-bold text-white capitalize">{user?.role}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Owner Views vs Staff View */}
        {user?.role === 'owner' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* User Management Overview */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <Users className="h-5 w-5 text-amber-500" />
                  <h3 className="font-bold text-white">Staff & User Management</h3>
                </div>
                <span className="text-xs bg-slate-800 px-2.5 py-1 rounded-full text-slate-300 font-medium">
                  {users.length} Users
                </span>
              </div>

              <div className="divide-y divide-slate-800/80 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3.5">
                    <div>
                      <div className="font-medium text-sm text-white">{u.full_name}</div>
                      <div className="text-xs text-slate-400">@{u.username}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        u.role === 'owner' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
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
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <DollarSign className="h-5 w-5 text-amber-500" />
                  <h3 className="font-bold text-white">Monthly Fixed Expenses</h3>
                </div>
                <span className="text-xs bg-slate-800 px-2.5 py-1 rounded-full text-slate-300 font-medium">
                  {expenses.length} Items
                </span>
              </div>

              <div className="divide-y divide-slate-800/80 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50">
                {expenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between p-3.5">
                    <div>
                      <div className="font-medium text-sm text-white">{e.name}</div>
                      <div className="text-xs text-slate-400 capitalize">{e.category}</div>
                    </div>
                    <div className="text-sm font-bold text-white">
                      KES {Number(e.amount).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Expense Mini Form */}
              <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2">
                <input
                  type="text"
                  placeholder="Expense name (e.g. Mary Salary)"
                  value={newExpenseName}
                  onChange={(e) => setNewExpenseName(e.target.value)}
                  className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <select
                  value={newExpenseCategory}
                  onChange={(e) => setNewExpenseCategory(e.target.value as any)}
                  className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
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
                  className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="flex items-center justify-center space-x-1 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center space-y-3">
            <Receipt className="h-10 w-10 text-amber-500 mx-auto" />
            <h3 className="text-lg font-bold text-white">Register Ready for Phase 2 & 3</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Staff cashier session active. Inventory catalog, quick POS search, and invoice issuance will be loaded in the next sprints.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};
