import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../services/api';
import type { ProjectDetail, Product, Category, Customer } from '../types';
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
  ExternalLink,
  CheckCircle2
} from 'lucide-react';

export const ProjectWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bom' | 'expenses' | 'incomes'>('bom');

  // Product Catalog & Allocation State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Allocation Form State
  const [allocUnitSold, setAllocUnitSold] = useState<'piece' | 'roll' | 'meter'>('piece');
  const [allocQuantity, setAllocQuantity] = useState('1');
  const [allocUnitPrice, setAllocUnitPrice] = useState('');
  const [allocDescription, setAllocDescription] = useState('');
  const [allocating, setAllocating] = useState(false);
  const [allocError, setAllocError] = useState<string | null>(null);
  const [allocSuccess, setAllocSuccess] = useState<string | null>(null);

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

  // Quick Customer Creation State in Edit Modal
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
  const [payDescription, setPayDescription] = useState('Initial Project Deposit');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('bank');
  const [payRef, setPayRef] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadProject();
      loadProductsAndCategories();
      loadCustomers();
    }
  }, [id]);

  const loadProject = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ProjectDetail>(`/api/v1/projects/${id}`);
      setProject(data);
      setEditName(data.name);
      setEditCustomerId(data.customer_id || '');
      setEditClientName(data.client_name);
      setEditClientPhone(data.client_phone || '');
      setEditQuotedAmount(String(data.quoted_amount || '0'));
      setEditDescription(data.description || '');
      setEditStatus(data.status);
    } catch (e) {
      console.error('Failed to load project detail', e);
    } finally {
      setLoading(false);
    }
  };

  const loadProductsAndCategories = async () => {
    try {
      const [prodsData, catsData] = await Promise.all([
        apiFetch<Product[]>('/api/v1/products/'),
        apiFetch<Category[]>('/api/v1/categories/')
      ]);
      setProducts(prodsData || []);
      setCategories(catsData || []);
    } catch (e) {
      console.error('Failed to load products/categories', e);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await apiFetch<Customer[]>('/api/v1/customers/');
      setCustomers(data);
    } catch (e) {
      console.error('Failed to load customers', e);
    }
  };

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
          phone: quickPhone.trim() || null,
          email: quickEmail.trim() || null,
          address: quickAddress.trim() || null
        })
      });

      await loadCustomers();
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
    if (!project || !editName.trim() || !editClientName.trim()) return;

    setSavingEdit(true);
    setEditError(null);
    try {
      await apiFetch(`/api/v1/projects/${project.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editName.trim(),
          client_name: editClientName.trim(),
          client_phone: editClientPhone.trim() || null,
          customer_id: editCustomerId ? Number(editCustomerId) : null,
          quoted_amount: parseFloat(editQuotedAmount) || 0,
          description: editDescription.trim() || null,
          status: editStatus
        })
      });
      setIsEditModalOpen(false);
      loadProject();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update project details');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!project) return;
    try {
      await apiFetch(`/api/v1/projects/${project.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      loadProject();
    } catch (e: any) {
      alert(e.message || 'Failed to update status');
    }
  };

  const handleSelectProduct = (p: Product) => {
    setSelectedProduct(p);
    const initialUnit = p.unit_type === 'roll' ? 'meter' : 'piece';
    setAllocUnitSold(initialUnit);
    if (p.unit_type === 'roll') {
      setAllocUnitPrice(String(p.price_per_meter || p.selling_price || ''));
    } else {
      setAllocUnitPrice(String(p.selling_price || ''));
    }
    setAllocQuantity('1');
    setAllocDescription('');
    setAllocError(null);
    setAllocSuccess(null);
  };

  const handleAllocateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !selectedProduct) return;

    const qty = parseFloat(allocQuantity);
    const price = parseFloat(allocUnitPrice);
    if (!qty || qty <= 0 || isNaN(price)) {
      setAllocError('Please enter a valid quantity and client unit price');
      return;
    }

    setAllocating(true);
    setAllocError(null);
    setAllocSuccess(null);
    try {
      await apiFetch(`/api/v1/projects/${project.id}/materials`, {
        method: 'POST',
        body: JSON.stringify({
          product_id: selectedProduct.id,
          unit_sold: allocUnitSold,
          quantity: qty,
          unit_price: price,
          description: allocDescription.trim() || null
        })
      });
      setAllocSuccess(`Added ${qty} ${allocUnitSold} of ${selectedProduct.name} to project materials.`);
      setSelectedProduct(null);
      setAllocQuantity('1');
      setAllocUnitPrice('');
      setAllocDescription('');
      loadProject();
      loadProductsAndCategories();
    } catch (err: any) {
      setAllocError(err.message || 'Failed to add material');
    } finally {
      setAllocating(false);
    }
  };

  const handleDeleteExpense = async (expenseId: number, isInventory: boolean) => {
    if (!project) return;
    const confirmMsg = isInventory
      ? 'Remove this item from the project? The physical quantity will be restored back to store inventory.'
      : 'Delete this expense record?';

    if (!window.confirm(confirmMsg)) return;

    try {
      await apiFetch(`/api/v1/projects/${project.id}/expenses/${expenseId}`, {
        method: 'DELETE'
      });
      loadProject();
      loadProductsAndCategories();
    } catch (e: any) {
      alert(e.message || 'Failed to delete record');
    }
  };

  const handleDeleteIncome = async (incomeId: number) => {
    if (!project) return;
    if (!window.confirm('Delete this client payment record?')) return;

    try {
      await apiFetch(`/api/v1/projects/${project.id}/incomes/${incomeId}`, {
        method: 'DELETE'
      });
      loadProject();
    } catch (e: any) {
      alert(e.message || 'Failed to delete payment');
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    const amt = parseFloat(expAmount);
    if (!amt || amt <= 0) {
      setExpError('Please enter a valid expense amount');
      return;
    }

    setSavingExpense(true);
    setExpError(null);
    try {
      await apiFetch(`/api/v1/projects/${project.id}/expenses`, {
        method: 'POST',
        body: JSON.stringify({
          source: 'external',
          category: expCategory,
          amount: amt,
          description: expDescription.trim() || null,
          vendor: expVendor.trim() || null,
          receipt_no: expReceiptNo.trim() || null
        })
      });
      setIsExpenseModalOpen(false);
      setExpAmount('');
      setExpDescription('');
      setExpVendor('');
      setExpReceiptNo('');
      loadProject();
    } catch (err: any) {
      setExpError(err.message || 'Failed to save expense');
    } finally {
      setSavingExpense(false);
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) {
      setPayError('Please enter a valid payment amount');
      return;
    }

    setSavingPayment(true);
    setPayError(null);
    try {
      await apiFetch(`/api/v1/projects/${project.id}/incomes`, {
        method: 'POST',
        body: JSON.stringify({
          description: payDescription.trim() || 'Client payment',
          amount: amt,
          source: 'client_payment',
          payment_method: payMethod,
          reference: payRef.trim() || null
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

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'all' || p.category_id === selectedCategory;
    const q = productSearch.toLowerCase().trim();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  if (loading || !project) {
    return (
      <div className="bg-white p-20 rounded-3xl border border-slate-200 text-center text-slate-400 space-y-3">
        <Loader2 className="h-10 w-10 mx-auto text-amber-600 animate-spin" />
        <p className="text-sm font-semibold">Opening Project Details...</p>
      </div>
    );
  }

  const bomItems = project.expenses.filter(e => e.source === 'inventory');
  const externalExpenses = project.expenses.filter(e => e.source === 'external');
  const clientPayments = project.incomes.filter(i => i.source === 'client_payment');

  const quotedVal = Number(project.quoted_amount) || 0;
  const collectedVal = Number(project.client_payments_total) || 0;
  const balanceRemaining = Math.max(0, quotedVal - collectedVal);
  const paymentProgressPct = quotedVal > 0 ? Math.min(100, Math.round((collectedVal / quotedVal) * 100)) : 0;

  // Margin preview calculation for currently selected product
  const allocQtyNum = parseFloat(allocQuantity) || 0;
  const allocPriceNum = parseFloat(allocUnitPrice) || 0;
  let allocCostUnit = 0;
  if (selectedProduct) {
    if (selectedProduct.unit_type === 'roll') {
      const rollMeters = Number(selectedProduct.meters_per_roll) || 100;
      if (allocUnitSold === 'roll') {
        allocCostUnit = Number(selectedProduct.cost_price) || (Number(selectedProduct.cost_per_meter || 0) * rollMeters);
      } else {
        allocCostUnit = Number(selectedProduct.cost_per_meter) || (Number(selectedProduct.cost_price || 0) / rollMeters);
      }
    } else {
      allocCostUnit = Number(selectedProduct.cost_price || 0);
    }
  }
  const allocTotalCost = allocCostUnit * allocQtyNum;
  const allocTotalBilled = allocPriceNum * allocQtyNum;
  const allocGrossMargin = allocTotalBilled - allocTotalCost;
  const allocMarginPct = allocTotalBilled > 0 ? Math.round((allocGrossMargin / allocTotalBilled) * 100) : 0;

  const linkedCustomer = customers.find(c => c.id === project.customer_id);

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Status Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/projects"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-all shadow-xs cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>All Projects</span>
          </Link>
          <span className="text-slate-300">/</span>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{project.name}</h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                project.status === 'active'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : project.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : project.status === 'draft'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : project.status === 'commissioning'
                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {project.status === 'active'
                ? 'In Progress'
                : project.status === 'commissioning'
                ? 'Testing & Handover'
                : project.status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all shadow-xs cursor-pointer"
          >
            <Edit className="h-3.5 w-3.5 text-slate-500" />
            <span>Edit Project</span>
          </button>

          <select
            value={project.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="bg-white border border-slate-200 text-xs text-slate-800 px-3 py-2 rounded-xl font-bold focus:outline-none shadow-xs"
          >
            <option value="draft">Stage: Draft Proposal</option>
            <option value="active">Stage: Active (In Progress)</option>
            <option value="commissioning">Stage: Testing & Commissioning</option>
            <option value="completed">Stage: Completed & Handed Over</option>
            <option value="cancelled">Stage: Cancelled</option>
          </select>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Printer className="h-4 w-4 text-slate-300" />
            <span>Print Job Card</span>
          </button>
        </div>
      </div>

      {/* Client Information Header Card with Direct Link */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Client Details</span>
            {project.customer_id && (
              <Link
                to="/customers"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100"
              >
                <span>View Customer Profile</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-900">
            <span className="text-base font-bold text-slate-900 flex items-center gap-1.5">
              <User className="h-4 w-4 text-slate-400" />
              {project.client_name}
            </span>

            {project.client_phone && (
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${project.client_phone}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium"
                >
                  <Phone className="h-3 w-3" />
                  {project.client_phone}
                </a>
                <a
                  href={`https://wa.me/${project.client_phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium"
                >
                  <MessageSquare className="h-3 w-3" />
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

      {/* Tab 1: Materials & Store Catalog */}
      {activeTab === 'bom' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left / Main Table: Current Project BOM Items (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Installed Materials (BOM)</h3>
                <p className="text-xs text-slate-500">Items issued from store inventory with tracked cost (Buying Price)</p>
              </div>

              <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-mono">
                Materials Margin: +KES {Number(project.materials_profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
              <div className="max-h-[560px] overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-3.5">Item / Material</th>
                      <th className="p-3.5 text-right">Quantity</th>
                      <th className="p-3.5 text-right">Store Cost</th>
                      <th className="p-3.5 text-right">Client Price</th>
                      <th className="p-3.5 text-right">Margin</th>
                      <th className="p-3.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {bomItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-slate-400 space-y-2">
                          <Package className="h-8 w-8 mx-auto text-slate-300" />
                          <p className="text-xs">No materials added yet. Select items from store stock on the right.</p>
                        </td>
                      </tr>
                    ) : (
                      bomItems.map((m) => {
                        const lineCost = Number(m.cost_amount) || 0;
                        const lineBilled = Number(m.amount) || 0;
                        const lineProfit = lineBilled - lineCost;
                        return (
                          <tr key={m.id} className="hover:bg-slate-50/80">
                            <td className="p-3.5 font-bold text-slate-900">
                              <div>{m.product_name || m.description}</div>
                              {m.description && m.description !== `Material: ${m.product_name}` && (
                                <div className="text-[10px] text-slate-400 font-normal">{m.description}</div>
                              )}
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                              {Number(m.quantity)} {m.unit_sold}
                            </td>
                            <td className="p-3.5 text-right font-mono text-slate-500">
                              KES {lineCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                              KES {lineBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-emerald-600">
                              +KES {lineProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3.5 text-center">
                              <button
                                onClick={() => handleDeleteExpense(m.id, true)}
                                title="Return to store inventory & remove"
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right / Visual Inventory Allocator Panel (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-50 text-amber-600 rounded-xl">
                    <Sun className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Add Materials from Store Stock</h3>
                </div>
                <span className="text-xs text-slate-400 font-semibold">{filteredProducts.length} items</span>
              </div>

              {allocSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-2xl border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{allocSuccess}</span>
                </div>
              )}

              {/* Product Search & Category Filter */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search panels, inverters, cables, batteries..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                  />
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                      selectedCategory === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCategory(c.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                        selectedCategory === c.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Selection List */}
              <div className="max-h-[240px] overflow-y-auto space-y-1.5 pr-1">
                {filteredProducts.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    No matching products found in store inventory.
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const isSelected = selectedProduct?.id === p.id;
                    const stockQty = Number(p.current_stock ?? 0);
                    const isOutOfStock = stockQty <= 0;
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-500/20 shadow-xs'
                            : 'bg-slate-50/60 border-slate-200/70 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 leading-snug truncate">{p.name}</div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                            {p.sku && <span>SKU: {p.sku}</span>}
                            <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              isOutOfStock
                                ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {p.formatted_stock || `${stockQty} in stock`}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold text-slate-900 font-mono">
                            KES {Number(p.selling_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Cost: KES {Number(p.cost_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </button>
                    );

                  })
                )}
              </div>

              {/* Allocation Calculator & Action Box */}
              {selectedProduct ? (
                <form onSubmit={handleAllocateMaterial} className="pt-3 border-t border-slate-100 space-y-3">
                  {allocError && (
                    <div className="p-2.5 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                      {allocError}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900">Issue Item: {selectedProduct.name}</span>
                      <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                        Stock Available: {selectedProduct.formatted_stock || `${selectedProduct.current_stock || 0} ${selectedProduct.unit}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(null)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {selectedProduct.unit_type === 'roll' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Issue Unit</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAllocUnitSold('meter');
                            setAllocUnitPrice(String(selectedProduct.price_per_meter || ''));
                          }}
                          className={`py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            allocUnitSold === 'meter'
                              ? 'bg-amber-100 border-amber-400 text-amber-900'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          Cut Meters
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAllocUnitSold('roll');
                            setAllocUnitPrice(String(selectedProduct.price_per_roll || selectedProduct.selling_price || ''));
                          }}
                          className={`py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            allocUnitSold === 'roll'
                              ? 'bg-amber-100 border-amber-400 text-amber-900'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          Whole Rolls ({selectedProduct.meters_per_roll || 100}m)
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Quantity</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={allocQuantity}
                        onChange={(e) => setAllocQuantity(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Client Billed Price (KES)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={allocUnitPrice}
                        onChange={(e) => setAllocUnitPrice(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Usage / Site Location Note</label>
                    <input
                      type="text"
                      placeholder="e.g. Inverter AC coupling, roof array mount"
                      value={allocDescription}
                      onChange={(e) => setAllocDescription(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                    />
                  </div>

                  {/* Margin & Profit Preview Box */}
                  <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/80 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Store Cost (Buying Price):</span>
                      <span className="font-mono font-medium">KES {allocTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Client Price (Selling Price):</span>
                      <span className="font-mono font-bold text-slate-900">KES {allocTotalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between border-t border-amber-200 pt-1 font-bold text-emerald-700">
                      <span>Gross Margin ({allocMarginPct}%):</span>
                      <span className="font-mono">+KES {allocGrossMargin.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={allocating}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {allocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Issue from Stock to Project
                  </button>
                </form>
              ) : (
                <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                  Select an item from store stock above to set quantity and pricing.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Labor & External Expenses */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Labor & Site Expenses</h3>
              <p className="text-xs text-slate-500">Technician installation fees, transportation, subcontracting, and local hardware</p>
            </div>
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Log Expense
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Description</th>
                    <th className="p-3.5">Vendor / Payee</th>
                    <th className="p-3.5">Receipt #</th>
                    <th className="p-3.5 text-right">Amount (KES)</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {externalExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400 space-y-2">
                        <Wrench className="h-8 w-8 mx-auto text-slate-300" />
                        <p className="text-xs">No external labor or transport expenses logged.</p>
                      </td>
                    </tr>
                  ) : (
                    externalExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/80">
                        <td className="p-3.5 font-bold capitalize text-slate-900">{exp.category}</td>
                        <td className="p-3.5 text-slate-700">{exp.description || '—'}</td>
                        <td className="p-3.5 text-slate-600">{exp.vendor || '—'}</td>
                        <td className="p-3.5 text-slate-500 font-mono">{exp.receipt_no || '—'}</td>
                        <td className="p-3.5 text-right font-mono font-bold text-rose-600">
                          KES {Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => handleDeleteExpense(exp.id, false)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Client Payments & Milestones */}
      {activeTab === 'incomes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Client Payment Records</h3>
              <p className="text-xs text-slate-500">Track client deposits, progress payments, and final handover settlements</p>
            </div>
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Record Client Payment
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Description</th>
                    <th className="p-3.5">Payment Method</th>
                    <th className="p-3.5">Reference / Txn #</th>
                    <th className="p-3.5 text-right">Amount (KES)</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {clientPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400 space-y-2">
                        <Banknote className="h-8 w-8 mx-auto text-slate-300" />
                        <p className="text-xs">No client payments recorded yet.</p>
                      </td>
                    </tr>
                  ) : (
                    clientPayments.map((inc) => (
                      <tr key={inc.id} className="hover:bg-slate-50/80">
                        <td className="p-3.5 text-slate-500 font-mono">{new Date(inc.date).toLocaleDateString()}</td>
                        <td className="p-3.5 font-bold text-slate-900">{inc.description}</td>
                        <td className="p-3.5 uppercase font-semibold text-slate-700">{inc.payment_method}</td>
                        <td className="p-3.5 text-slate-500 font-mono">{inc.reference || '—'}</td>
                        <td className="p-3.5 text-right font-mono font-bold text-emerald-600">
                          +KES {Number(inc.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => handleDeleteIncome(inc.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit className="h-4 w-4 text-amber-600" />
                <span>Edit Project Details & Scope</span>
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
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
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
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingQuickCust}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
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
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
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
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Payment Description</label>
                <input
                  type="text"
                  required
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
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
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
    </div>
  );
};
