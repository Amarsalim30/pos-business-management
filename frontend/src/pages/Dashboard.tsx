import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import type { Store, User, RecurringExpense } from '../types';
import { 
  Users, 
  Receipt, 
  DollarSign, 
  Plus, 
  CheckCircle2,
  Store as StoreIcon,
  Percent,
  Trash2,
  Edit3,
  UserPlus,
  Settings
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  
  // Expense Form
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState<'rent' | 'payroll' | 'other'>('payroll');
  
  // User Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFullName, setUserFullName] = useState('');
  const [userUsername, setUserUsername] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<'owner' | 'staff'>('staff');
  const [userError, setUserError] = useState<string | null>(null);

  // Store Settings Modal State
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeTaxId, setStoreTaxId] = useState('');
  const [storeVatRate, setStoreVatRate] = useState('0.16');
  const [storeError, setStoreError] = useState<string | null>(null);

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
      setStoreName(data.name);
      setStoreAddress(data.address || '');
      setStorePhone(data.phone || '');
      setStoreTaxId(data.tax_id || '');
      setStoreVatRate(String(data.vat_rate));
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

  const handleDeleteExpense = async (id: number, name: string) => {
    if (!window.confirm(`Delete recurring expense "${name}"?`)) return;
    try {
      await apiFetch(`/api/v1/stores/recurring-expenses/${id}`, { method: 'DELETE' });
      loadExpenses();
      setMessage('Recurring expense removed');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense');
    }
  };

  const handleOpenUserModal = (u?: User) => {
    if (u) {
      setEditingUser(u);
      setUserFullName(u.full_name);
      setUserUsername(u.username);
      setUserPassword('');
      setUserRole(u.role);
    } else {
      setEditingUser(null);
      setUserFullName('');
      setUserUsername('');
      setUserPassword('');
      setUserRole('staff');
    }
    setUserError(null);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    try {
      if (editingUser) {
        await apiFetch(`/api/v1/users/${editingUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            full_name: userFullName,
            role: userRole,
            ...(userPassword ? { password: userPassword } : {}),
          }),
        });
      } else {
        await apiFetch('/api/v1/users/', {
          method: 'POST',
          body: JSON.stringify({
            username: userUsername,
            full_name: userFullName,
            password: userPassword,
            role: userRole,
          }),
        });
      }
      setIsUserModalOpen(false);
      loadUsers();
      setMessage(editingUser ? 'User updated' : 'New user created');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setUserError(err.message || 'Failed to save user');
    }
  };

  const handleDeactivateUser = async (u: User) => {
    if (!window.confirm(`Deactivate user "${u.username}"?`)) return;
    try {
      await apiFetch(`/api/v1/users/${u.id}`, { method: 'DELETE' });
      loadUsers();
      setMessage('User deactivated');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate user');
    }
  };

  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setStoreError(null);
    try {
      const updated = await apiFetch<Store>('/api/v1/stores/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          name: storeName,
          address: storeAddress || null,
          phone: storePhone || null,
          tax_id: storeTaxId || null,
          vat_rate: parseFloat(storeVatRate),
        }),
      });
      setStore(updated);
      setIsStoreModalOpen(false);
      setMessage('Store settings updated');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setStoreError(err.message || 'Failed to update store settings');
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

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-2 text-slate-500 mb-1">
              <StoreIcon className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-bold uppercase tracking-wider">Store Profile</span>
            </div>
            <div className="text-lg font-bold text-slate-900">{store?.name || '---'}</div>
            <div className="text-xs text-slate-500 mt-0.5">{store?.address || 'Nairobi, Kenya'} • {store?.phone || '+254...'}</div>
          </div>
          {user?.role === 'owner' && (
            <button
              onClick={() => setIsStoreModalOpen(true)}
              className="rounded border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-50 cursor-pointer shadow-2xs"
              title="Edit Store Settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-2 text-slate-500 mb-1">
              <Percent className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-bold uppercase tracking-wider">Tax & VAT Config</span>
            </div>
            <div className="text-lg font-bold text-slate-900 font-mono">
              {store?.vat_rate ? `${(Number(store.vat_rate) * 100).toFixed(0)}% Standard` : '16%'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">PIN: {store?.tax_id || 'P000000000X'}</div>
          </div>
          {user?.role === 'owner' && (
            <button
              onClick={() => setIsStoreModalOpen(true)}
              className="rounded border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-50 cursor-pointer shadow-2xs"
              title="Edit VAT Rate"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-500 mb-1">
            <Users className="h-4 w-4 text-amber-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Session & Auth</span>
          </div>
          <div className="text-lg font-bold text-slate-900 capitalize">{user?.role} Mode</div>
          <div className="text-xs text-slate-500 mt-0.5">Logged in as {user?.full_name}</div>
        </div>
      </div>

      {/* Owner Admin Panels */}
      {user?.role === 'owner' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Management */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">Store Users & Roles</h3>
              </div>
              <button
                onClick={() => handleOpenUserModal()}
                className="flex items-center space-x-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500 shadow-xs cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>New User</span>
              </button>
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
                    <button
                      onClick={() => handleOpenUserModal(u)}
                      className="text-slate-600 hover:text-slate-900 p-1 rounded border border-slate-200 hover:bg-slate-100"
                      title="Edit User"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                    {u.id !== user.id && (
                      <button
                        onClick={() => handleDeactivateUser(u)}
                        className="text-rose-600 hover:text-rose-800 p-1 rounded border border-rose-200 hover:bg-rose-50"
                        title="Deactivate User"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
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
                  <div className="flex items-center space-x-3">
                    <div className="text-sm font-bold text-slate-900 font-mono">
                      KES {Number(e.amount).toLocaleString()}
                    </div>
                    <button
                      onClick={() => handleDeleteExpense(e.id, e.name)}
                      className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 cursor-pointer"
                      title="Delete Expense"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
                className="rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 font-mono"
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
          <h3 className="text-base font-bold text-slate-900">Staff Operational Workspace</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Use the top navigation to access Products Catalog, Inventory tracking, Roll conversions, and Stock Take counts.
          </p>
        </div>
      )}

      {/* User Create / Edit Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {editingUser ? `Edit User: @${editingUser.username}` : 'Create New User'}
            </h3>

            {userError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                {userError}
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={userFullName}
                  onChange={(e) => setUserFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. jdoe"
                    value={userUsername}
                    onChange={(e) => setUserUsername(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                  {editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  placeholder="••••••••"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Role</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-amber-600"
                >
                  <option value="staff">Staff (Sales & Inventory)</option>
                  <option value="owner">Owner (Full Admin Access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-500 shadow-xs cursor-pointer"
                >
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Store Settings Modal */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Edit Store Profile & Tax Settings</h3>

            {storeError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                {storeError}
              </div>
            )}

            <form onSubmit={handleSaveStoreSettings} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Store Business Name</label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Store Address</label>
                <input
                  type="text"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Store Phone</label>
                  <input
                    type="text"
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">KRA PIN / Tax ID</label>
                  <input
                    type="text"
                    value={storeTaxId}
                    onChange={(e) => setStoreTaxId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">VAT Rate (Decimal, e.g. 0.16 for 16%)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={storeVatRate}
                  onChange={(e) => setStoreVatRate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600 font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsStoreModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-500 shadow-xs cursor-pointer"
                >
                  Update Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
