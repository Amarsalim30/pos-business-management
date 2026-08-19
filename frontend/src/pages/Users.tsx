import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { User, RoleType, PermissionRegistry, RolePresets } from '../types';
import {
  Users as UsersIcon,
  UserPlus,
  Shield,
  ShieldCheck,
  KeyRound,
  Edit2,
  CheckCircle2,
  XCircle,
  Search,
  Loader2,
  AlertCircle,
  UserCheck,
  UserX,
  X,
  Eye,
  EyeOff,
  ShoppingCart,
  Boxes,
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  SlidersHorizontal,
  FolderKanban
} from 'lucide-react';

// Fallback registry in case backend is loading
const DEFAULT_REGISTRY: PermissionRegistry = {
  pos: {
    title: 'POS & Counter Sales',
    icon: 'ShoppingCart',
    permissions: [
      { id: 'pos:sell', label: 'Process Counter Sales', description: 'Scan barcodes, ring up sales, take payments, and issue receipts' },
      { id: 'pos:discount', label: 'Apply Custom Discounts', description: 'Apply discretionary discounts or negotiate below standard selling price' },
      { id: 'pos:quotes', label: 'Create Quotes & Proformas', description: 'Draft customer quotations and proforma pre-sale documents' },
      { id: 'pos:void', label: 'Void Invoices & Sales', description: 'Cancel completed sales transactions and return items to inventory' },
      { id: 'pos:view_margin', label: 'View Cost Margins (BP)', description: 'Display product buying price and profit margin in POS counter and drawers' }
    ]
  },
  catalog_inventory: {
    title: 'Catalog & Stock Balances',
    icon: 'Boxes',
    permissions: [
      { id: 'catalog:manage', label: 'Manage Catalog & Pricing', description: 'Add, edit, or deactivate products, categories, roll metrics, and tax rates' },
      { id: 'inventory:view', label: 'View Stock Balances', description: 'Check current on-hand quantities, roll lengths, and reorder levels' },
      { id: 'inventory:adjust', label: 'Manual Stock Adjustments', description: 'Manually add, subtract, or reconcile damaged/found physical inventory' },
      { id: 'inventory:stock_take', label: 'Execute Stock Take', description: 'Initiate, record physical counts, and reconcile inventory variances' }
    ]
  },
  purchases: {
    title: 'Purchases & Suppliers',
    icon: 'Truck',
    permissions: [
      { id: 'purchases:orders', label: 'Create Purchase Orders', description: 'Draft and submit POs to suppliers for inventory restocking' },
      { id: 'purchases:receive_grn', label: 'Receive Goods (GRN)', description: 'Log Goods Received Notes and accept physical delivery into stock' },
      { id: 'suppliers:manage', label: 'Manage Supplier Accounts', description: 'Create suppliers, record payment vouchers, and track payables' }
    ]
  },
  financials_reports: {
    title: 'Financials & Reports',
    icon: 'BarChart3',
    permissions: [
      { id: 'reports:view_net_profit', label: 'View Net Profit Statements', description: 'Access full management P&L statements, COGS, and operating margins' },
      { id: 'reports:view_sales', label: 'View Sales & ETR Reports', description: 'Access daily sales summaries, payment method breakdowns, and tax stats' },
      { id: 'accounts:petty_cash', label: 'Petty Cash & Expenses', description: 'Disburse and log petty cash vouchers and operational store expenses' },
      { id: 'accounts:banking_mpesa', label: 'Bank & M-Pesa Accounts', description: 'Manage store bank accounts and log M-Pesa agent commission floats' },
      { id: 'customers:credit_ledger', label: 'Customer Credit Ledgers', description: 'View customer debt balances, issue store credit, and record debt payments' },
      { id: 'projects:manage', label: 'Solar Installation Projects', description: 'Manage project workspaces, material BOM allocations, and external labor' }
    ]
  },
  admin: {
    title: 'Administration & System',
    icon: 'Shield',
    permissions: [
      { id: 'admin:settings', label: 'Manage Store Settings', description: 'Update store profile details, physical address, and default VAT rates' },
      { id: 'admin:expenses', label: 'Manage Recurring Overheads', description: 'Configure fixed monthly rent, payroll, and utility deductions' },
      { id: 'admin:users', label: 'User Management & RBAC', description: 'Create, edit, reset passwords, and configure access permissions for staff' }
    ]
  }
};

const DEFAULT_PRESETS: RolePresets = {
  owner: ['*'],
  accountant: [
    'pos:quotes',
    'catalog:manage',
    'inventory:view',
    'purchases:orders',
    'purchases:receive_grn',
    'suppliers:manage',
    'reports:view_net_profit',
    'reports:view_sales',
    'accounts:petty_cash',
    'accounts:banking_mpesa',
    'customers:credit_ledger',
    'projects:manage'
  ],
  staff: [
    'pos:sell',
    'pos:quotes',
    'inventory:view',
    'purchases:receive_grn',
    'customers:credit_ledger'
  ],
  storekeeper: [
    'inventory:view',
    'inventory:adjust',
    'inventory:stock_take',
    'catalog:manage',
    'purchases:receive_grn'
  ],
  project_manager: [
    'pos:quotes',
    'inventory:view',
    'projects:manage',
    'purchases:receive_grn',
    'customers:credit_ledger'
  ]
};

const ROLE_PRESET_METADATA: Record<string, { title: string; subtitle: string; icon: React.ElementType; color: string; badge: string }> = {
  owner: {
    title: 'Store Owner / Admin',
    subtitle: 'Full Unrestricted System Authority (Wildcard *)',
    icon: Shield,
    color: 'amber',
    badge: 'bg-amber-100 text-amber-900 border-amber-300'
  },
  accountant: {
    title: 'Accountant / Finance',
    subtitle: 'Auditing, Net Profit, Invoices & Ledgers',
    icon: BarChart3,
    color: 'sky',
    badge: 'bg-sky-100 text-sky-900 border-sky-300'
  },
  staff: {
    title: 'Cashier / Front Desk',
    subtitle: 'POS Checkout, Quotations & Customer Debt',
    icon: ShoppingCart,
    color: 'emerald',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300'
  },
  storekeeper: {
    title: 'Storekeeper / Inventory Clerk',
    subtitle: 'Stock Balances, Adjustments, Stock Take & GRN',
    icon: Boxes,
    color: 'indigo',
    badge: 'bg-indigo-100 text-indigo-900 border-indigo-300'
  },
  project_manager: {
    title: 'Solar Project Manager',
    subtitle: 'Project Workspaces, Material Allocations & Quotes',
    icon: FolderKanban,
    color: 'purple',
    badge: 'bg-purple-100 text-purple-900 border-purple-300'
  }
};

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Permission Registry & Presets State
  const [registry, setRegistry] = useState<PermissionRegistry>(DEFAULT_REGISTRY);
  const [presets, setPresets] = useState<RolePresets>(DEFAULT_PRESETS);

  // User Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formFullName, setFormFullName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<RoleType>('staff');
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Accordion open states
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    pos: true,
    catalog_inventory: false,
    purchases: false,
    financials_reports: false,
    admin: false
  });

  // Password Reset Modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
    loadPermissionsRegistry();
  }, []);

  const loadPermissionsRegistry = async () => {
    try {
      const data = await apiFetch<{ registry: PermissionRegistry; presets: RolePresets }>('/api/v1/users/permissions');
      if (data?.registry) setRegistry(data.registry);
      if (data?.presets) setPresets(data.presets);
    } catch {
      // Fallback to default presets
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<User[]>('/api/v1/users/');
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFormFullName('');
    setFormUsername('');
    setFormPassword('');
    setFormRole('staff');
    setFormPermissions(presets['staff'] || DEFAULT_PRESETS['staff']);
    setShowPassword(false);
    setModalError(null);
    setOpenAccordions({ pos: true, catalog_inventory: false, purchases: false, financials_reports: false, admin: false });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (u: User) => {
    setEditingUser(u);
    setFormFullName(u.full_name);
    setFormUsername(u.username);
    setFormPassword('');
    setFormRole(u.role);
    // If user has custom permissions saved, use them; otherwise use effective permissions or preset
    const initialPerms = u.permissions || u.effective_permissions || presets[u.role] || DEFAULT_PRESETS[u.role] || [];
    setFormPermissions(initialPerms);
    setShowPassword(false);
    setModalError(null);
    setOpenAccordions({ pos: true, catalog_inventory: false, purchases: false, financials_reports: false, admin: false });
    setIsModalOpen(true);
  };

  const handleRolePresetChange = (newRole: RoleType) => {
    setFormRole(newRole);
    if (newRole === 'owner' || newRole === 'admin') {
      setFormPermissions(['*']);
    } else {
      const defaultPerms = presets[newRole] || DEFAULT_PRESETS[newRole] || [];
      setFormPermissions(defaultPerms);
    }
  };

  const handleTogglePermission = (permId: string) => {
    if (formRole === 'owner' || formRole === 'admin') return; // Owner always has wildcard
    setFormPermissions((prev) => {
      if (prev.includes(permId)) {
        return prev.filter((p) => p !== permId);
      } else {
        return [...prev, permId];
      }
    });
  };

  const handleToggleGroup = (categoryKey: string, selectAll: boolean) => {
    if (formRole === 'owner' || formRole === 'admin') return;
    const cat = registry[categoryKey];
    if (!cat) return;
    const groupPermIds = cat.permissions.map((p) => p.id);

    setFormPermissions((prev) => {
      if (selectAll) {
        return Array.from(new Set([...prev, ...groupPermIds]));
      } else {
        return prev.filter((p) => !groupPermIds.includes(p));
      }
    });
  };

  const handleResetToPresetDefaults = () => {
    const defaultPerms = presets[formRole] || DEFAULT_PRESETS[formRole] || [];
    setFormPermissions(defaultPerms);
  };

  // Check if current formPermissions differs from standard preset
  const isCustomized = useMemo(() => {
    if (formRole === 'owner' || formRole === 'admin') return false;
    const defaultPerms = presets[formRole] || DEFAULT_PRESETS[formRole] || [];
    if (formPermissions.length !== defaultPerms.length) return true;
    const defaultSet = new Set(defaultPerms);
    return !formPermissions.every((p) => defaultSet.has(p));
  }, [formRole, formPermissions, presets]);

  const customOverrideStats = useMemo(() => {
    if (!isCustomized) return null;
    const defaultPerms = new Set(presets[formRole] || DEFAULT_PRESETS[formRole] || []);
    const granted = formPermissions.filter((p) => !defaultPerms.has(p)).length;
    const revoked = Array.from(defaultPerms).filter((p) => !formPermissions.includes(p)).length;
    return { granted, revoked };
  }, [isCustomized, formRole, formPermissions, presets]);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalSubmitting(true);
    setModalError(null);

    try {
      if (editingUser) {
        // Update user
        const payload: any = {
          full_name: formFullName.trim(),
          role: formRole,
          permissions: (formRole === 'owner' || formRole === 'admin') ? null : (isCustomized ? formPermissions : null)
        };
        if (formPassword.trim()) {
          payload.password = formPassword.trim();
        }
        await apiFetch(`/api/v1/users/${editingUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        setSuccessMessage(`User "${formFullName}" updated successfully.`);
      } else {
        // Create user
        if (!formPassword.trim()) {
          throw new Error('Password is required for new accounts');
        }
        const payload: any = {
          username: formUsername.trim().toLowerCase(),
          password: formPassword.trim(),
          full_name: formFullName.trim(),
          role: formRole,
          permissions: (formRole === 'owner' || formRole === 'admin') ? null : (isCustomized ? formPermissions : null)
        };
        await apiFetch('/api/v1/users/', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setSuccessMessage(`User "${formFullName}" created with ${formRole} privileges.`);
      }
      setIsModalOpen(false);
      loadUsers();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setModalError(err.message || 'Failed to save user');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleToggleActive = async (u: User) => {
    if (u.id === currentUser?.id) {
      alert('You cannot deactivate your own active session account.');
      return;
    }
    const nextState = !u.is_active;
    const confirmText = nextState
      ? `Activate user "${u.full_name}"?`
      : `Deactivate user "${u.full_name}"? They will be immediately blocked from signing in.`;

    if (!window.confirm(confirmText)) return;

    try {
      await apiFetch(`/api/v1/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: nextState })
      });
      loadUsers();
      setSuccessMessage(`User "${u.full_name}" is now ${nextState ? 'active' : 'deactivated'}.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  const handleOpenResetModal = (u: User) => {
    setResettingUser(u);
    setNewPassword('');
    setResetError(null);
    setResetModalOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser) return;
    setResetSubmitting(true);
    setResetError(null);

    try {
      await apiFetch(`/api/v1/users/${resettingUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword.trim() })
      });
      setResetModalOpen(false);
      setSuccessMessage(`Password for "${resettingUser.full_name}" was reset successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset password');
    } finally {
      setResetSubmitting(false);
    }
  };

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRole = roleFilter === 'all' || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, searchQuery, roleFilter]);

  const activeCount = users.filter((u) => u.is_active).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-700 rounded-2xl border border-amber-200">
              <UsersIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Staff & Access Control (RBAC)</h1>
              <p className="text-sm font-medium text-slate-500">
                Manage operator accounts, preset role profiles, and customizable capability permissions
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-sm shadow-md shadow-amber-600/20 transition-all active:scale-[0.98] cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          <span>Add New User</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase text-slate-600 tracking-wider">Total Operators</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{users.length}</div>
          </div>
          <div className="p-3 bg-slate-100 rounded-xl text-slate-600">
            <UsersIcon className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase text-emerald-600 tracking-wider">Active Staff</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">{activeCount}</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <UserCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase text-amber-600 tracking-wider">Owners / Superusers</div>
            <div className="text-2xl font-black text-amber-700 mt-1">
              {users.filter((u) => u.role === 'owner' || u.role === 'admin').length}
            </div>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase text-sky-600 tracking-wider">Custom Overrides</div>
            <div className="text-2xl font-black text-sky-700 mt-1">
              {users.filter((u) => u.permissions && u.permissions.length > 0 && u.role !== 'owner').length}
            </div>
          </div>
          <div className="p-3 bg-sky-50 rounded-xl text-sky-600">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-semibold animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center space-x-2 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-sm font-semibold">
          <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Directory Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Filters */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search user by name or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <label htmlFor="users-role-filter" className="text-xs font-bold text-slate-600">Role Filter:</label>
            <select
              id="users-role-filter"
              aria-label="Filter users by role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              <option value="all">All Roles</option>
              <option value="owner">Owner</option>
              <option value="accountant">Accountant</option>
              <option value="staff">Staff / Cashier</option>
              <option value="storekeeper">Storekeeper</option>
              <option value="project_manager">Solar Project Manager</option>
            </select>
          </div>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-100/70 text-slate-600 uppercase font-black tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Operator Name</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Assigned Role & Overrides</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-600 mb-2" />
                    <span className="text-slate-500 text-xs font-semibold">Loading operator directory...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    No users match the search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const roleMeta = ROLE_PRESET_METADATA[u.role] || ROLE_PRESET_METADATA['staff'];
                  const RoleIcon = roleMeta.icon;
                  const hasCustomOverrides = u.permissions && u.permissions.length > 0 && u.role !== 'owner';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-black text-xs">
                            {u.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{u.full_name}</div>
                            {u.id === currentUser?.id && (
                              <span className="inline-block text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                (You - Current Session)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-mono text-slate-700">
                        @{u.username}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${roleMeta.badge}`}
                          >
                            <RoleIcon className="h-3 w-3" />
                            <span>{roleMeta.title.split('/')[0]}</span>
                          </span>

                          {hasCustomOverrides && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold" title="Has customized granular permission overrides">
                              <SlidersHorizontal className="h-2.5 w-2.5" />
                              <span>{u.permissions?.length} Overrides</span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {u.is_active ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            <XCircle className="h-3 w-3" />
                            <span>Deactivated</span>
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                            title="Edit User Profile & Granular Permissions"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenResetModal(u)}
                            className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-colors cursor-pointer"
                            title="Reset User Password"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>

                          {u.id !== currentUser?.id && (
                            <button
                              onClick={() => handleToggleActive(u)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer border ${u.is_active
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                }`}
                              title={u.is_active ? 'Deactivate User Account' : 'Reactivate User Account'}
                            >
                              {u.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT USER MODAL WITH ACCORDION RBAC MATRIX */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden my-6">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-500/10 text-amber-700 rounded-xl border border-amber-200">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingUser ? `Edit User: ${editingUser.full_name}` : 'Create New User Account'}
                  </h3>
                  <p className="text-xs font-medium text-slate-500">
                    Set user profile credentials and customize granular capability permissions
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveUser} className="flex-1 overflow-y-auto p-6 space-y-6">
              {modalError && (
                <div className="flex items-center space-x-2 bg-rose-50 border border-rose-200 text-rose-800 px-3.5 py-2.5 rounded-xl text-xs font-semibold">
                  <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Basic Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="user-form-full-name" className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="user-form-full-name"
                    type="text"
                    required
                    placeholder="e.g. Mary Wanjiku"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label htmlFor="user-form-username" className="block text-xs font-bold text-slate-700 mb-1">
                    Login Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="user-form-username"
                    type="text"
                    required
                    disabled={!!editingUser}
                    placeholder="e.g. mary"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                  />
                  {editingUser && (
                    <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
                      Username cannot be modified after creation
                    </span>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="user-form-password" className="block text-xs font-bold text-slate-700 mb-1">
                    {editingUser ? 'New Password (Leave blank to keep existing)' : 'Login Password *'}
                  </label>
                  <div className="relative">
                    <input
                      id="user-form-password"
                      type={showPassword ? 'text' : 'password'}
                      required={!editingUser}
                      placeholder={editingUser ? '••••••••' : 'Minimum 6 characters'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Role Preset Selector */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label htmlFor="user-form-role" className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Role Profile Preset
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Selects standard recommended baseline permissions
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(['staff', 'accountant', 'storekeeper', 'project_manager', 'owner'] as RoleType[]).map((r) => {
                    const meta = ROLE_PRESET_METADATA[r];
                    if (!meta) return null;
                    const isSelected = formRole === r;
                    const Icon = meta.icon;

                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleRolePresetChange(r)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${isSelected
                          ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/50 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                      >
                        <div className="flex items-center space-x-2">
                          <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-bold text-slate-900">{meta.title.split('/')[0]}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                          {meta.subtitle}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Override Status Banner */}
              <div className="pt-2">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-100/80 border border-slate-200">
                  <div className="flex items-center space-x-2">
                    <SlidersHorizontal className="h-4 w-4 text-slate-600" />
                    <div>
                      <span className="text-xs font-bold text-slate-900">
                        {formRole === 'owner' ? (
                          'Store Owner: Unrestricted Wildcard Access (*)'
                        ) : isCustomized ? (
                          `Customized Permissions (${formPermissions.length} active • ${customOverrideStats?.granted || 0} granted, ${customOverrideStats?.revoked || 0} revoked)`
                        ) : (
                          `Default Preset Active (${formPermissions.length} standard permissions enabled)`
                        )}
                      </span>
                    </div>
                  </div>

                  {isCustomized && formRole !== 'owner' && (
                    <button
                      type="button"
                      onClick={handleResetToPresetDefaults}
                      className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Reset to Preset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* CATEGORIZED ACCORDION PERMISSION MATRIX */}
              <div className="space-y-3 pt-1">
                <div className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Granular Module Permissions
                </div>

                {formRole === 'owner' ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-medium">
                    <p className="font-bold flex items-center space-x-1.5 mb-1">
                      <ShieldCheck className="h-4 w-4 text-amber-700" />
                      <span>Full Superuser Privileges</span>
                    </p>
                    Store Owners possess unrestricted wildcard authority over all current and future system modules, void actions, profit reports, and configurations.
                  </div>
                ) : (
                  Object.entries(registry).map(([catKey, category]) => {
                    const isOpen = !!openAccordions[catKey];
                    const groupPermIds = category.permissions.map((p) => p.id);
                    const activeInGroup = groupPermIds.filter((id) => formPermissions.includes(id)).length;
                    const allActive = activeInGroup === groupPermIds.length;

                    return (
                      <div key={catKey} className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                        {/* Accordion Header */}
                        <div
                          className="px-4 py-3 bg-slate-50/80 hover:bg-slate-100/60 flex items-center justify-between cursor-pointer select-none transition-colors"
                          onClick={() => toggleAccordion(catKey)}
                        >
                          <div className="flex items-center space-x-2.5">
                            <span className="font-bold text-xs text-slate-900">{category.title}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activeInGroup > 0
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-200 text-slate-600'
                                }`}
                            >
                              {activeInGroup}/{groupPermIds.length} Active
                            </span>
                          </div>

                          <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleToggleGroup(catKey, !allActive)}
                              className="text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-md hover:bg-slate-50 cursor-pointer"
                            >
                              {allActive ? 'Clear Group' : 'Select All'}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleAccordion(catKey)}
                              className="text-slate-400 hover:text-slate-600 p-0.5"
                            >
                              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Accordion Content */}
                        {isOpen && (
                          <div className="p-4 divide-y divide-slate-100 bg-white">
                            {category.permissions.map((perm) => {
                              const isChecked = formPermissions.includes(perm.id);

                              return (
                                <div
                                  key={perm.id}
                                  className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-4 group"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                                        {perm.label}
                                      </span>
                                      <span className="font-mono text-[9px] text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                                        {perm.id}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                      {perm.description}
                                    </p>
                                  </div>

                                  {/* Modern iOS/Linear Style Switch */}
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isChecked}
                                    onClick={() => handleTogglePermission(perm.id)}
                                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none mt-1 ${isChecked ? 'bg-amber-600' : 'bg-slate-300'
                                      }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${isChecked ? 'translate-x-4' : 'translate-x-0'
                                        }`}
                                    />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  {modalSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  <span>{editingUser ? 'Save Changes' : 'Create User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PASSWORD RESET MODAL */}
      {resetModalOpen && resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 text-sky-700">
                <KeyRound className="h-5 w-5" />
                <h3 className="text-base font-black text-slate-900">Reset User Password</h3>
              </div>
              <button
                onClick={() => setResetModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Enter a new secure password for <strong className="text-slate-900">{resettingUser.full_name}</strong> (@{resettingUser.username}).
            </p>

            {resetError && (
              <div className="flex items-center space-x-2 bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 rounded-xl text-xs font-semibold mb-4">
                <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="user-new-password" className="block text-xs font-bold text-slate-700 mb-1">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <input
                  id="user-new-password"
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting || newPassword.length < 6}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/20 cursor-pointer disabled:opacity-50"
                >
                  {resetSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  <span>Save Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
