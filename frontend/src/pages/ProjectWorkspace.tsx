import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import type { ProjectDetail, Product, Category, Customer } from '../types';
import { MaterialAllocationModal } from '../components/MaterialAllocationModal';
import {
  ArrowLeft,
  Sun,
  Package,
  Banknote,
  Plus,
  Trash2,
  Search,
  Printer,
  Phone,
  MessageSquare,
  Wrench,
  Loader2,
  X,
  Edit,
  User,
  UserPlus,
  ExternalLink
} from 'lucide-react';

export const ProjectWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'bom' | 'expenses' | 'incomes'>('bom');
  const [bomSearch, setBomSearch] = useState('');

  // Delete Project State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  // Product Catalog & Allocation State (for Modal)
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);

  // Edit Project Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCustomerId, setEditCustomerId] = useState<number | ''>('');
  const [editClientName, setEditClientName] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [editQuotedAmount, setEditQuotedAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<string>('active');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Quick Customer Creation State
  const [isQuickCustOpen, setIsQuickCustOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickAddress, setQuickAddress] = useState('');
  const [savingQuickCust, setSavingQuickCust] = useState(false);
  const [quickCustError, setQuickCustError] = useState<string | null>(null);

  // External Expense Form State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expCategory, setExpCategory] = useState('labor');
  const [expAmount, setExpAmount] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [expVendor, setExpVendor] = useState('');
  const [expReceiptNo, setExpReceiptNo] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);
  const [expError, setExpError] = useState<string | null>(null);

  // Client Payment Form State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payDescription, setPayDescription] = useState('Payment installment');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('bank');
  const [payRef, setPayRef] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const [deletingExpenseId, setDeletingExpenseId] = useState<number | null>(null);
  const [deletingIncomeId, setDeletingIncomeId] = useState<number | null>(null);

  const loadProject = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiFetch<ProjectDetail>(`/api/v1/projects/${id}`);
      setProject(data);
      if (data) {
        setEditName(data.name || '');
        setEditCustomerId(data.customer_id || '');
        setEditClientName(data.client_name || '');
        setEditClientPhone(data.client_phone || '');
        setEditQuotedAmount(String(data.quoted_amount ?? '0'));
        setEditDescription(data.description || '');
        setEditStatus(data.status || 'active');
      }
    } catch (e: any) {
      console.error('Failed to load project detail', e);
      setLoadError(e.message || 'Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  const loadProductsAndCategories = async () => {
    try {
      const [prodData, catData] = await Promise.all([
        apiFetch<Product[]>('/api/v1/products/'),
        apiFetch<Category[]>('/api/v1/categories/')
      ]);
      setProducts(prodData || []);
      setCategories(catData || []);
    } catch (e) {
      console.error('Failed to load products/categories', e);
    }
  };

  const loadCustomers = async () => {
    try {
      const custData = await apiFetch<Customer[]>('/api/v1/customers/');
      setCustomers(custData || []);
    } catch (e) {
      console.error('Failed to load customers', e);
    }
  };

  useEffect(() => {
    if (id) {
      loadProject();
      loadProductsAndCategories();
      loadCustomers();
    }
  }, [id]);

  // ALL HOOKS UNCONDITIONALLY DECLARED AT TOP LEVEL
  const bomItems = useMemo(() => {
    return (project?.expenses || []).filter(e => e.source === 'inventory');
  }, [project?.expenses]);

  const filteredBomItems = useMemo(() => {
    const q = bomSearch.toLowerCase().trim();
    if (!q) return bomItems;
    return bomItems.filter(item =>
      (item.product_name && item.product_name.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  }, [bomItems, bomSearch]);

  const externalExpenses = useMemo(() => {
    return (project?.expenses || []).filter(e => e.source === 'external');
  }, [project?.expenses]);

  const clientPayments = useMemo(() => {
    return (project?.incomes || []).filter(i => i.source === 'client_payment');
  }, [project?.incomes]);

  const quotedVal = Number(project?.quoted_amount) || 0;
  const collectedVal = Number(project?.client_payments_total) || 0;
  const balanceRemaining = Math.max(0, quotedVal - collectedVal);
  const paymentProgressPct = quotedVal > 0 ? Math.min(100, Math.round((collectedVal / quotedVal) * 100)) : 0;

  const linkedCustomer = useMemo(() => {
    return customers.find(c => c.id === project?.customer_id);
  }, [customers, project?.customer_id]);

  const handleSelectCustomerInEdit = (custId: number | '') => {
    setEditCustomerId(custId);
    if (!custId) return;
    const c = customers.find(x => x.id === custId);
    if (c) {
      setEditClientName(c.name);
      setEditClientPhone(c.phone || '');
    }
  };

  const handleQuickCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) return;

    setSavingQuickCust(true);
    setQuickCustError(null);
    try {
      const created = await apiFetch<Customer>('/api/v1/customers/', {
        method: 'POST',
        body: JSON.stringify({
          name: quickName.trim(),
          phone: quickPhone.trim() || undefined,
          email: quickEmail.trim() || undefined,
          address: quickAddress.trim() || undefined,
        })
      });
      setCustomers(prev => [created, ...prev]);
      setEditCustomerId(created.id);
      setEditClientName(created.name);
      setEditClientPhone(created.phone || '');
      setIsQuickCustOpen(false);
      setQuickName('');
      setQuickPhone('');
      setQuickEmail('');
      setQuickAddress('');
    } catch (err: any) {
      setQuickCustError(err.message || 'Failed to create customer');
    } finally {
      setSavingQuickCust(false);
    }
  };

  const handleSaveEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await apiFetch<ProjectDetail>(`/api/v1/projects/${project.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editName.trim(),
          customer_id: editCustomerId ? Number(editCustomerId) : null,
          client_name: editClientName.trim(),
          client_phone: editClientPhone.trim() || null,
          description: editDescription.trim() || null,
          quoted_amount: parseFloat(editQuotedAmount) || 0,
          status: editStatus
        })
      });
      setProject(updated);
      setIsEditModalOpen(false);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update project details');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    const amountVal = parseFloat(expAmount);
    if (!amountVal || amountVal <= 0) {
      setExpError('Please enter a valid expense amount');
      return;
    }

    setSavingExpense(true);
    setExpError(null);
    try {
      await apiFetch(`/api/v1/projects/${project.id}/expenses`, {
        method: 'POST',
        body: JSON.stringify({
          category: expCategory,
          amount: amountVal,
          description: expDescription.trim() || undefined,
          vendor: expVendor.trim() || undefined,
          receipt_no: expReceiptNo.trim() || undefined,
        })
      });
      setIsExpenseModalOpen(false);
      setExpAmount('');
      setExpDescription('');
      setExpVendor('');
      setExpReceiptNo('');
      loadProject();
    } catch (err: any) {
      setExpError(err.message || 'Failed to add expense');
    } finally {
      setSavingExpense(false);
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    const amountVal = parseFloat(payAmount);
    if (!amountVal || amountVal <= 0) {
      setPayError('Please enter a valid payment amount');
      return;
    }

    setSavingPayment(true);
    setPayError(null);
    try {
      await apiFetch(`/api/v1/projects/${project.id}/incomes`, {
        method: 'POST',
        body: JSON.stringify({
          description: payDescription.trim() || 'Client Payment',
          amount: amountVal,
          source: 'client_payment',
          payment_method: payMethod,
          reference: payRef.trim() || undefined,
        })
      });
      setIsPaymentModalOpen(false);
      setPayAmount('');
      setPayRef('');
      loadProject();
    } catch (err: any) {
      setPayError(err.message || 'Failed to record payment');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeleteExpense = async (expenseId: number, isInventory: boolean) => {
    if (!project) return;
    const confirmMsg = isInventory
      ? 'Return this allocated material to store stock and remove from project cost?'
      : 'Delete this project expense record?';

    if (!window.confirm(confirmMsg)) return;

    setDeletingExpenseId(expenseId);
    try {
      await apiFetch(`/api/v1/projects/${project.id}/expenses/${expenseId}`, {
        method: 'DELETE'
      });
      loadProject();
      if (isInventory) {
        loadProductsAndCategories();
      }
    } catch (e: any) {
      alert(e.message || 'Failed to delete expense');
    } finally {
      setDeletingExpenseId(null);
    }
  };

  const handleDeleteIncome = async (incomeId: number) => {
    if (!project) return;
    if (!window.confirm('Delete this client payment record?')) return;

    setDeletingIncomeId(incomeId);
    try {
      await apiFetch(`/api/v1/projects/${project.id}/incomes/${incomeId}`, {
        method: 'DELETE'
      });
      loadProject();
    } catch (e: any) {
      alert(e.message || 'Failed to delete payment');
    } finally {
      setDeletingIncomeId(null);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    setIsDeletingProject(true);
    try {
      await apiFetch(`/api/v1/projects/${project.id}`, {
        method: 'DELETE'
      });
      setIsDeleteModalOpen(false);
      navigate('/projects');
    } catch (e: any) {
      alert(e.message || 'Failed to delete project');
    } finally {
      setIsDeletingProject(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-20 rounded-3xl border border-slate-200 text-center text-slate-400 space-y-3">
        <Loader2 className="h-10 w-10 mx-auto text-amber-600 animate-spin" />
        <div className="text-sm font-bold text-slate-700">Loading Solar & Electrical Project...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-4 max-w-md mx-auto my-12 shadow-sm">
        <div className="p-3 bg-amber-50 text-amber-600 w-12 h-12 rounded-2xl mx-auto flex items-center justify-center">
          <Package className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">Project Not Found</h2>
          <p className="text-xs text-slate-500 mt-1">
            {loadError || 'The requested project could not be found or has been removed.'}
          </p>
        </div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to All Projects</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/projects"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider font-mono">
                Project #{project.id}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                project.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                project.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                project.status === 'commissioning' ? 'bg-purple-100 text-purple-800' :
                project.status === 'cancelled' ? 'bg-rose-100 text-rose-800' :
                'bg-slate-100 text-slate-700'
              }`}>
                {project.status}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>{project.name}</span>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                title="Edit Project Details"
              >
                <Edit className="h-4 w-4" />
              </button>
            </h1>
          </div>
        </div>

        {/* Global Print & Quick Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all shadow-xs cursor-pointer"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Print Project Summary</span>
          </button>

          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Banknote className="h-4 w-4" />
            <span>+ Record Client Payment</span>
          </button>

          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Delete Project"
          >
            <Trash2 className="h-4 w-4 text-rose-600" />
            <span>Delete Project</span>
          </button>
        </div>
      </div>

      {/* Project Meta Card & Financial Health Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Client Details</span>
            {project.customer_id && (
              <Link
                to={`/customers?id=${project.customer_id}`}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
              >
                <span>View Full Client Account</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-800">
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4 text-slate-400" />
              <span>{project.client_name}</span>
            </div>

            {project.client_phone && (
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${project.client_phone}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium font-mono"
                >
                  <Phone className="h-3 w-3 text-slate-400" />
                  {project.client_phone}
                </a>
                <a
                  href={`https://wa.me/${String(project.client_phone).replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium"
                >
                  <MessageSquare className="h-3 w-3 text-emerald-600" />
                  WhatsApp
                </a>
              </div>
            )}

            {linkedCustomer && Number(linkedCustomer.balance) > 0 && (
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200 font-mono">
                Outstanding Store Debt: KES {Number(linkedCustomer.balance).toLocaleString()}
              </span>
            )}
          </div>

          {project.description && (
            <p className="text-xs text-slate-600 max-w-3xl leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">
              {project.description}
            </p>
          )}
        </div>

        {/* Milestone Payment Progress Indicator */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 min-w-[280px] space-y-2">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-slate-500">Contract Payments</span>
            <span className="text-emerald-700 font-mono">{paymentProgressPct}%</span>
          </div>
          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${paymentProgressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>Collected: KES {collectedVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <span>Due: KES {balanceRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Financial Overview Command Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Quoted Contract</div>
          <div className="text-lg font-black text-slate-900 font-mono mt-1">
            KES {quotedVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Billed Materials</div>
          <div className="text-lg font-black text-indigo-700 font-mono mt-1">
            KES {Number(project.materials_billed).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Store Cost: KES {Number(project.materials_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Labor & Expenses</div>
          <div className="text-lg font-black text-rose-600 font-mono mt-1">
            KES {Number(project.external_expenses_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Client Collected</div>
          <div className="text-lg font-black text-blue-600 font-mono mt-1">
            KES {collectedVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Net Project Profit</div>
          <div className="text-lg font-black text-emerald-700 font-mono mt-1">
            KES {Number(project.net_profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Main Workspace Tabs Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('bom')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'bom'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Package className="h-4 w-4" />
          <span>Materials & Equipment ({bomItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'expenses'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Wrench className="h-4 w-4" />
          <span>Labor & Expenses ({externalExpenses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('incomes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'incomes'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Banknote className="h-4 w-4 text-emerald-500" />
          <span>Client Payments ({clientPayments.length})</span>
        </button>
      </div>

      {/* Tab 1: Materials & Equipment (BOM) */}
      {activeTab === 'bom' && (
        <div className="space-y-4">
          {/* Action Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Installed Materials & Bill of Materials (BOM)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Physical materials issued from store inventory with tracked Buying Price (BP) and project profit margins
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {bomItems.length > 3 && (
                <div className="relative min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter installed BOM..."
                    value={bomSearch}
                    onChange={(e) => setBomSearch(e.target.value)}
                    className="w-full pl-8.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsMaterialModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Add Materials from Store Stock</span>
              </button>

              <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-2xl font-mono">
                Materials Margin: +KES {Number(project.materials_profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Full-Width BOM Items Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-4">Item / Material Specification</th>
                    <th className="p-4 text-right">Quantity</th>
                    <th className="p-4 text-right">Unit Store Cost</th>
                    <th className="p-4 text-right">Unit Client Price</th>
                    <th className="p-4 text-right">Total Store Cost</th>
                    <th className="p-4 text-right">Total Billed</th>
                    <th className="p-4 text-right">Gross Margin</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {bomItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-16 text-center text-slate-400 space-y-3">
                        <Package className="h-10 w-10 mx-auto text-slate-300" />
                        <div className="text-sm font-bold text-slate-700">No materials issued to this project yet</div>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                          Click below to browse store stock and stage inverters, solar panels, cables, and fittings in batch.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsMaterialModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Add Materials from Store Stock</span>
                        </button>
                      </td>
                    </tr>
                  ) : filteredBomItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-400 space-y-1">
                        <p className="text-xs font-semibold">No installed materials match "{bomSearch}"</p>
                      </td>
                    </tr>
                  ) : (
                    filteredBomItems.map((m) => {
                      const lineCost = Number(m.cost_amount) || 0;
                      const lineBilled = Number(m.amount) || 0;
                      const lineProfit = lineBilled - lineCost;
                      const qty = Number(m.quantity) || 0;
                      const unitCost = qty > 0 ? lineCost / qty : 0;
                      const unitPrice = qty > 0 ? lineBilled / qty : 0;
                      const marginPct = lineBilled > 0 ? Math.round((lineProfit / lineBilled) * 100) : 0;

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 font-bold text-slate-900">
                            <div>{m.product_name || m.description}</div>
                            {m.description && m.description !== `Material: ${m.product_name}` && (
                              <div className="text-[11px] text-slate-400 font-normal mt-0.5">{m.description}</div>
                            )}
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {qty} <span className="text-[11px] text-slate-500 font-medium">{m.unit_sold}</span>
                          </td>
                          <td className="p-4 text-right font-mono text-slate-500 whitespace-nowrap">
                            KES {unitCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            KES {unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-4 text-right font-mono text-slate-500 whitespace-nowrap">
                            KES {lineCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            KES {lineBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-4 text-right font-mono whitespace-nowrap">
                            <span className="font-bold text-emerald-700">
                              +KES {lineProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-emerald-600 block font-sans">
                              ({marginPct}% margin)
                            </span>
                          </td>
                          <td className="p-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleDeleteExpense(m.id, true)}
                              disabled={deletingExpenseId === m.id}
                              title="Return to store inventory & remove from project"
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {deletingExpenseId === m.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-rose-500" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {bomItems.length > 0 && (
                  <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200 text-xs">
                    <tr>
                      <td className="p-4 uppercase tracking-wider text-slate-700">Total Materials ({bomItems.length} items)</td>
                      <td colSpan={3}></td>
                      <td className="p-4 text-right font-mono text-slate-600">
                        KES {Number(project.materials_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right font-mono text-slate-900">
                        KES {Number(project.materials_billed).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right font-mono text-emerald-700">
                        +KES {Number(project.materials_profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Labor & External Expenses */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Project Labor & External Expenses
            </h3>
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ Add Labor / Expense</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-4">Category</th>
                  <th className="p-4">Description</th>
                  <th className="p-4">Vendor / Payee</th>
                  <th className="p-4">Receipt / Voucher</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-right">Amount (KES)</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {externalExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No labor, transport, or subcontractor expenses logged yet.
                    </td>
                  </tr>
                ) : (
                  externalExpenses.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-bold capitalize text-slate-700">
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md">{e.category}</span>
                      </td>
                      <td className="p-4 text-slate-800 font-semibold">{e.description || '-'}</td>
                      <td className="p-4 text-slate-600">{e.vendor || '-'}</td>
                      <td className="p-4 font-mono text-slate-500">{e.receipt_no || '-'}</td>
                      <td className="p-4 text-slate-400">{new Date(e.date).toLocaleDateString()}</td>
                      <td className="p-4 text-right font-mono font-bold text-rose-600">
                        KES {Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleDeleteExpense(e.id, false)}
                          disabled={deletingExpenseId === e.id}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {externalExpenses.length > 0 && (
                <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                  <tr>
                    <td colSpan={5} className="p-4 uppercase text-slate-600">Total External Expenses</td>
                    <td className="p-4 text-right font-mono text-rose-600">
                      KES {Number(project.external_expenses_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Client Payments */}
      {activeTab === 'incomes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Client Payments & Project Incomes
            </h3>
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ Record Payment</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-4">Payment Description</th>
                  <th className="p-4">Method</th>
                  <th className="p-4">Reference / Txn #</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-right">Amount (KES)</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {clientPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No client deposit or stage payments recorded yet.
                    </td>
                  </tr>
                ) : (
                  clientPayments.map((i) => (
                    <tr key={i.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-bold text-slate-900">{i.description}</td>
                      <td className="p-4 font-semibold uppercase text-slate-600">{i.payment_method || 'other'}</td>
                      <td className="p-4 font-mono text-slate-500">{i.reference || '-'}</td>
                      <td className="p-4 text-slate-400">{new Date(i.date).toLocaleDateString()}</td>
                      <td className="p-4 text-right font-mono font-bold text-emerald-700">
                        KES {Number(i.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleDeleteIncome(i.id)}
                          disabled={deletingIncomeId === i.id}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {clientPayments.length > 0 && (
                <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                  <tr>
                    <td colSpan={4} className="p-4 uppercase text-slate-600">Total Client Payments Collected</td>
                    <td className="p-4 text-right font-mono text-emerald-700">
                      KES {Number(project.client_payments_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sun className="h-5 w-5 text-amber-600" />
                <span>Edit Project Details</span>
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditProject} className="mt-4 space-y-3">
              {editError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              {/* Linked Customer Selection & On-The-Spot Creation */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 uppercase">Customer Account</label>
                  <button
                    type="button"
                    onClick={() => setIsQuickCustOpen(true)}
                    className="flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
                  >
                    <UserPlus className="h-3 w-3" />
                    <span>+ Register New Client</span>
                  </button>
                </div>

                <select
                  value={editCustomerId}
                  onChange={(e) => handleSelectCustomerInEdit(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                >
                  <option value="">-- Choose from existing customers (or enter below) --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Client Name *</label>
                  <input
                    type="text"
                    required
                    value={editClientName}
                    onChange={(e) => setEditClientName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Client Phone</label>
                  <input
                    type="text"
                    value={editClientPhone}
                    onChange={(e) => setEditClientPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Quoted Contract Amount (KES)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editQuotedAmount}
                    onChange={(e) => setEditQuotedAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Stage</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none"
                  >
                    <option value="draft">Draft Proposal</option>
                    <option value="active">Active (In Progress)</option>
                    <option value="commissioning">Testing & Handover</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Scope / System Specifications</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingEdit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* On-The-Spot Quick Customer Creation Modal */}
      {isQuickCustOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-amber-600" />
                <span>Register New Customer</span>
              </h3>
              <button onClick={() => setIsQuickCustOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateCustomer} className="mt-4 space-y-3">
              {quickCustError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {quickCustError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Customer / Client Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Captain Salim"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +254 711 223344"
                  value={quickPhone}
                  onChange={(e) => setQuickPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. client@example.com"
                  value={quickEmail}
                  onChange={(e) => setQuickEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Location / Site Address</label>
                <input
                  type="text"
                  placeholder="e.g. Nyali Links Road, Mombasa"
                  value={quickAddress}
                  onChange={(e) => setQuickAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsQuickCustOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingQuickCust}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingQuickCust && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save & Select Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* External Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add Labor / Site Expense</h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="mt-4 space-y-3">
              {expError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {expError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                >
                  <option value="labor">Technician & Labor</option>
                  <option value="transport">Transport & Logistics</option>
                  <option value="subcontract">Subcontracting</option>
                  <option value="materials">Local Hardware & Consumables</option>
                  <option value="other">Other Expenses</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Amount (KES) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 25000"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Solar panel roof mounting labour"
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Payee / Vendor</label>
                  <input
                    type="text"
                    placeholder="e.g. Technician Ali"
                    value={expVendor}
                    onChange={(e) => setExpVendor(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Receipt / Voucher #</label>
                  <input
                    type="text"
                    placeholder="e.g. REC-9922"
                    value={expReceiptNo}
                    onChange={(e) => setExpReceiptNo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingExpense}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingExpense && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Record Client Payment</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="mt-4 space-y-3">
              {payError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {payError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Payment Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 50% Initial Deposit"
                  value={payDescription}
                  onChange={(e) => setPayDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Amount (KES) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 225000"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Payment Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                  >
                    <option value="bank">Bank Transfer</option>
                    <option value="mpesa">M-Pesa</option>
                    <option value="cash">Cash</option>
                    <option value="other">Cheque / Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Txn / Bank Ref</label>
                  <input
                    type="text"
                    placeholder="e.g. NCBA-998822"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingPayment && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {isDeleteModalOpen && project && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Project #{project.id}</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-1.5 text-slate-600">
              <div className="font-bold text-slate-900 text-sm">{project.name}</div>
              <div>Client: <span className="font-semibold text-slate-800">{project.client_name}</span></div>
              <div>Quoted Value: <span className="font-mono font-bold text-slate-800">KES {Number(project.quoted_amount).toLocaleString()}</span></div>
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200 mt-2 font-medium">
                Note: All allocated inventory materials will automatically be returned to store stock.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingProject}
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingProject}
                onClick={handleDeleteProject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isDeletingProject && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Delete Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* High-Speed Material Picker & Batch Allocator Modal */}
      {project && (
        <MaterialAllocationModal
          isOpen={isMaterialModalOpen}
          onClose={() => setIsMaterialModalOpen(false)}
          projectId={project.id}
          projectName={project.name}
          products={products}
          categories={categories}
          onMaterialsAllocated={() => {
            loadProject();
            loadProductsAndCategories();
          }}
        />
      )}
    </div>
  );
};
