import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import type { Store, RecurringExpense } from '../types';
import {
  Settings as SettingsIcon,
  Store as StoreIcon,
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Database,
  Building2,
  Phone,
  MapPin,
  Percent,
  X,
  Receipt,
  Download,
  HardDrive,
  ShieldCheck
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingStore, setSavingStore] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Store form state
  const [storeForm, setStoreForm] = useState({
    name: '',
    address: '',
    phone: '',
    tax_id: '',
    vat_rate: 0.16
  });

  // Expense modal state
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    name: '',
    amount: '' as string | number,
    category: 'rent' as 'rent' | 'payroll' | 'utilities' | 'other',
    is_active: true
  });
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const [storeData, expenseData] = await Promise.all([
        apiFetch<Store>('/api/v1/stores/settings'),
        apiFetch<RecurringExpense[]>('/api/v1/stores/recurring-expenses?include_inactive=true')
      ]);
      setStoreForm({
        name: storeData.name || '',
        address: storeData.address || '',
        phone: storeData.phone || '',
        tax_id: storeData.tax_id || '',
        vat_rate: storeData.vat_rate !== undefined ? Number(storeData.vat_rate) : 0.16
      });
      setExpenses(expenseData);
    } catch (err: any) {
      setError(err.message || 'Failed to load store settings');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackup = async () => {
    setDownloadingBackup(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/stores/backup/export', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download database backup. Please ensure you are logged in as Owner.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `pos_db_backup_${timestamp}.sql`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSuccessMessage('Database backup snapshot downloaded successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Error exporting database backup');
    } finally {
      setDownloadingBackup(false);
    }
  };

  const handleSaveStoreProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStore(true);
    setError(null);
    try {
      await apiFetch<Store>('/api/v1/stores/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          name: storeForm.name,
          address: storeForm.address,
          phone: storeForm.phone,
          tax_id: storeForm.tax_id,
          vat_rate: Number(storeForm.vat_rate)
        })
      });
      setSuccessMessage('Store profile and tax settings saved successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update store settings');
    } finally {
      setSavingStore(false);
    }
  };

  const handleOpenAddExpense = () => {
    setEditingExpense(null);
    setExpenseForm({
      name: '',
      amount: '',
      category: 'rent',
      is_active: true
    });
    setExpenseError(null);
    setExpenseModalOpen(true);
  };

  const handleOpenEditExpense = (expense: RecurringExpense) => {
    setEditingExpense(expense);
    setExpenseForm({
      name: expense.name,
      amount: expense.amount,
      category: (expense.category as any) || 'rent',
      is_active: expense.is_active
    });
    setExpenseError(null);
    setExpenseModalOpen(true);
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseSubmitting(true);
    setExpenseError(null);

    const amountNum = parseFloat(String(expenseForm.amount));
    if (isNaN(amountNum) || amountNum <= 0) {
      setExpenseError('Monthly amount must be greater than zero');
      setExpenseSubmitting(false);
      return;
    }

    try {
      if (editingExpense) {
        await apiFetch(`/api/v1/stores/recurring-expenses/${editingExpense.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: expenseForm.name,
            amount: amountNum,
            category: expenseForm.category,
            is_active: expenseForm.is_active
          })
        });
        setSuccessMessage(`Recurring overhead "${expenseForm.name}" updated.`);
      } else {
        await apiFetch('/api/v1/stores/recurring-expenses', {
          method: 'POST',
          body: JSON.stringify({
            name: expenseForm.name,
            amount: amountNum,
            category: expenseForm.category,
            is_active: expenseForm.is_active
          })
        });
        setSuccessMessage(`New recurring overhead "${expenseForm.name}" added.`);
      }

      setExpenseModalOpen(false);
      loadSettings();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setExpenseError(err.message || 'Failed to save recurring expense');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expense: RecurringExpense) => {
    if (!confirm(`Are you sure you want to delete "${expense.name}"?`)) {
      return;
    }

    try {
      await apiFetch(`/api/v1/stores/recurring-expenses/${expense.id}`, {
        method: 'DELETE'
      });
      setSuccessMessage(`Overhead "${expense.name}" removed.`);
      loadSettings();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete recurring expense');
    }
  };

  const activeMonthlyOverhead = expenses
    .filter((e) => e.is_active)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'rent':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">Rent</span>;
      case 'payroll':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200">Payroll / Salaries</span>;
      case 'utilities':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Utilities / Power</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">{category}</span>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
            <SettingsIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Store Settings & Overheads</h1>
            <p className="text-sm text-slate-700">Configure business identity, default VAT rates, and recurring expenses</p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-amber-600" />
          <p className="text-sm font-medium">Loading settings...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: STORE PROFILE & VAT SETTINGS */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <StoreIcon className="w-5 h-5 text-amber-600" />
                <h2 className="text-base font-bold text-slate-900">Store Profile</h2>
              </div>

              <form onSubmit={handleSaveStoreProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Business / Store Name</label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme Solar & Electricals"
                      value={storeForm.name}
                      onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Telephone / Mobile</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="e.g. +254 712 345 678"
                      value={storeForm.phone}
                      onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Physical Address</label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="e.g. Commercial Street, Shop #4"
                      value={storeForm.address}
                      onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">KRA PIN / Tax ID</label>
                  <div className="relative">
                    <Receipt className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="e.g. P051234567Z"
                      value={storeForm.tax_id}
                      onChange={(e) => setStoreForm({ ...storeForm, tax_id: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Default Standard VAT Rate</label>
                  <div className="relative">
                    <Percent className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      placeholder="0.16"
                      value={storeForm.vat_rate}
                      onChange={(e) => setStoreForm({ ...storeForm, vat_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <span className="text-[11px] text-slate-700 mt-1 block">
                    16% standard VAT = 0.16. Applied to taxable products on invoice.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={savingStore}
                  className="w-full mt-3 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-xl shadow-sm transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingStore && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Store Settings
                </button>
              </form>
            </div>

            {/* INTERACTIVE BACKUP & RESTORE CENTER */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Database className="w-4 h-4 text-amber-600" />
                  <span>Database Backup Center</span>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> Local-First Safe
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                Download an immediate full SQL snapshot of your database (sales, products, inventory, customers, and ledger balances) directly to your machine.
              </p>

              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={downloadingBackup}
                className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl shadow-sm transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {downloadingBackup ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                    <span>Exporting Snapshot...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-amber-400" />
                    <span>Download Database Snapshot (.sql)</span>
                  </>
                )}
              </button>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
                  <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                  <span>Scheduled Automated Backups</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-tight">
                  Automated nightly cron script configured in <code className="text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">scripts/backup.sh</code> with 30-day archive rotation and USB mirroring.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT: RECURRING EXPENSES REGISTER */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-amber-600" />
                    <h2 className="text-lg font-bold text-slate-900">Recurring Monthly Overheads</h2>
                  </div>
                  <p className="text-xs text-slate-700 mt-0.5">
                    Fixed operational overheads automatically deducted in monthly Net Profit statements
                  </p>
                </div>

                <button
                  onClick={handleOpenAddExpense}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Overhead
                </button>
              </div>

              {/* Overhead Summary Card */}
              <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/60 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-900">
                    Total Active Monthly Overhead
                  </span>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-0.5">
                    KES {activeMonthlyOverhead.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    <span className="text-xs text-slate-700 font-normal ml-1.5">/ month</span>
                  </div>
                </div>
                <div className="text-xs text-slate-700 text-right hidden sm:block">
                  <span className="font-semibold">{expenses.filter((e) => e.is_active).length}</span> active items
                </div>
              </div>

              {/* Overheads Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Expense Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Monthly Amount (KES)</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                          No recurring expenses configured. Click "Add Overhead" to add rent or payroll deductions.
                        </td>
                      </tr>
                    ) : (
                      expenses.map((expense) => (
                        <tr key={expense.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {expense.name}
                          </td>
                          <td className="px-4 py-3">
                            {getCategoryBadge(expense.category)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            {Number(expense.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {expense.is_active ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditExpense(expense)}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Edit Overhead"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteExpense(expense)}
                                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete Overhead"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECURRING EXPENSE MODAL */}
      {expenseModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-600" />
                {editingExpense ? 'Edit Recurring Overhead' : 'Add Recurring Overhead'}
              </h2>
              <button
                onClick={() => setExpenseModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {expenseError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{expenseError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shop Rent or Technician Salaries"
                  value={expenseForm.name}
                  onChange={(e) => setExpenseForm({ ...expenseForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                >
                  <option value="rent">Rent</option>
                  <option value="payroll">Payroll / Salaries</option>
                  <option value="utilities">Utilities & Electricity</option>
                  <option value="other">Other Overhead</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Amount (KES)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  placeholder="e.g. 50000"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="expense_active"
                  checked={expenseForm.is_active}
                  onChange={(e) => setExpenseForm({ ...expenseForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                />
                <label htmlFor="expense_active" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Active (include in monthly profit deductions)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expenseSubmitting}
                  className="px-5 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {expenseSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingExpense ? 'Save Changes' : 'Add Overhead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
