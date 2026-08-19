import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import type { Project, ProjectDetail, ProjectSummary, Product } from '../types';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import {
  Sun,
  Plus,
  Search,
  Package,
  Banknote,
  Receipt,
  User,
  X,
  Loader2
} from 'lucide-react';


export const ProjectsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [summary, setSummary] = useState<ProjectSummary | null>(null);

  // New Project Modal State
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [description, setDescription] = useState('');
  const [quotedAmount, setQuotedAmount] = useState('');
  const [savingProject, setSavingProject] = useState(false);
  const [projectFormError, setProjectFormError] = useState<string | null>(null);

  // Selected Project Detail Drawer State
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'materials' | 'expenses' | 'incomes'>('materials');

  // Material Allocation Modal State
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [matUnitSold, setMatUnitSold] = useState<'piece' | 'roll' | 'meter'>('piece');
  const [matQuantity, setMatQuantity] = useState('');
  const [matUnitPrice, setMatUnitPrice] = useState('');
  const [matDescription, setMatDescription] = useState('');
  const [allocatingMaterial, setAllocatingMaterial] = useState(false);
  const [materialError, setMaterialError] = useState<string | null>(null);

  // External Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expCategory, setExpCategory] = useState('labor');
  const [expAmount, setExpAmount] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [expVendor, setExpVendor] = useState('');
  const [expReceiptNo, setExpReceiptNo] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);

  // Client Payment Modal State
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [incDescription, setIncDescription] = useState('Project Milestone Payment');
  const [incAmount, setIncAmount] = useState('');
  const [incMethod, setIncMethod] = useState('bank');
  const [incReference, setIncReference] = useState('');
  const [savingIncome, setSavingIncome] = useState(false);
  const [incomeError, setIncomeError] = useState<string | null>(null);

  // Infinite Scroll Projects State
  const {
    items: projects,
    loading: projectsLoading,
    loadingMore: projectsLoadingMore,
    sentinelRef: projectsSentinelRef,
    reload: reloadProjects
  } = useInfiniteScroll<Project>({

    fetchFn: async (offset, limit) => {
      let url = `/api/v1/projects/?limit=${limit}&offset=${offset}`;
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;
      if (searchQuery.trim()) url += `&q=${encodeURIComponent(searchQuery.trim())}`;
      return await apiFetch<Project[]>(url);
    },
    limit: 20,
    dependencies: [statusFilter, searchQuery]
  });

  const loadSummary = async () => {
    try {
      const data = await apiFetch<ProjectSummary>('/api/v1/projects/summary');
      setSummary(data);
    } catch (e) {
      console.error('Failed to load project summary', e);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await apiFetch<Product[]>('/api/v1/products/');
      setAvailableProducts(data);
    } catch (e) {
      console.error('Failed to load products for allocation', e);
    }
  };

  useEffect(() => {
    loadSummary();
    loadProducts();
  }, []);

  const openProjectDetail = async (id: number) => {
    setSelectedProjectId(id);
    setLoadingDetail(true);
    try {
      const data = await apiFetch<ProjectDetail>(`/api/v1/projects/${id}`);
      setProjectDetail(data);
    } catch (e) {
      console.error('Failed to load project details', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const refreshProjectDetail = async () => {
    if (!selectedProjectId) return;
    try {
      const data = await apiFetch<ProjectDetail>(`/api/v1/projects/${selectedProjectId}`);
      setProjectDetail(data);
      loadSummary();
      reloadProjects();
    } catch (e) {
      console.error('Failed to refresh project', e);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !clientName.trim()) return;

    setSavingProject(true);
    setProjectFormError(null);
    try {
      await apiFetch('/api/v1/projects/', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          client_name: clientName.trim(),
          client_phone: clientPhone.trim() || null,
          description: description.trim() || null,
          quoted_amount: parseFloat(quotedAmount) || 0,
          status: 'active'
        })
      });
      setIsNewProjectModalOpen(false);
      setName('');
      setClientName('');
      setClientPhone('');
      setDescription('');
      setQuotedAmount('');
      reloadProjects();
      loadSummary();
    } catch (err: any) {
      setProjectFormError(err.message || 'Failed to create project');
    } finally {
      setSavingProject(false);
    }
  };

  const handleStatusChange = async (newStatus: 'active' | 'completed' | 'cancelled') => {
    if (!projectDetail) return;
    try {
      await apiFetch(`/api/v1/projects/${projectDetail.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      refreshProjectDetail();
    } catch (err: any) {
      alert(err.message || 'Failed to update project status');
    }
  };

  const handleAllocateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !selectedProductId) return;

    const qty = parseFloat(matQuantity);
    const price = parseFloat(matUnitPrice);
    if (!qty || qty <= 0 || isNaN(price)) {
      setMaterialError('Please enter a valid quantity and selling unit price');
      return;
    }

    setAllocatingMaterial(true);
    setMaterialError(null);
    try {
      await apiFetch(`/api/v1/projects/${selectedProjectId}/materials`, {
        method: 'POST',
        body: JSON.stringify({
          product_id: Number(selectedProductId),
          unit_sold: matUnitSold,
          quantity: qty,
          unit_price: price,
          description: matDescription.trim() || null
        })
      });
      setIsMaterialModalOpen(false);
      setSelectedProductId('');
      setMatQuantity('');
      setMatUnitPrice('');
      setMatDescription('');
      refreshProjectDetail();
    } catch (err: any) {
      setMaterialError(err.message || 'Failed to allocate material from inventory');
    } finally {
      setAllocatingMaterial(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;

    const amt = parseFloat(expAmount);
    if (!amt || amt <= 0) {
      setExpenseError('Please enter a valid expense amount');
      return;
    }

    setSavingExpense(true);
    setExpenseError(null);
    try {
      await apiFetch(`/api/v1/projects/${selectedProjectId}/expenses`, {
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
      refreshProjectDetail();
    } catch (err: any) {
      setExpenseError(err.message || 'Failed to add project expense');
    } finally {
      setSavingExpense(false);
    }
  };

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;

    const amt = parseFloat(incAmount);
    if (!amt || amt <= 0) {
      setIncomeError('Please enter a valid client payment amount');
      return;
    }

    setSavingIncome(true);
    setIncomeError(null);
    try {
      await apiFetch(`/api/v1/projects/${selectedProjectId}/incomes`, {
        method: 'POST',
        body: JSON.stringify({
          description: incDescription.trim() || 'Client payment',
          amount: amt,
          source: 'client_payment',
          payment_method: incMethod,
          reference: incReference.trim() || null
        })
      });
      setIsIncomeModalOpen(false);
      setIncAmount('');
      setIncReference('');
      refreshProjectDetail();
    } catch (err: any) {
      setIncomeError(err.message || 'Failed to record client payment');
    } finally {
      setSavingIncome(false);
    }
  };

  const selectedProduct = availableProducts.find(p => p.id === Number(selectedProductId));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
              <Sun className="h-6 w-6" />
            </div>
            Solar Projects & Installations
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Manage custom solar projects, allocate inventory materials, log labor/transport costs, and track project net profit
          </p>
        </div>
        <button
          onClick={() => setIsNewProjectModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow-sm transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          New Solar Project
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Projects</div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {summary ? summary.active_projects : 0}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {summary ? `${summary.total_projects} total solar projects` : 'Total registered'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Total Quoted Value</div>
          <div className="text-2xl font-black text-indigo-700 mt-2 font-mono">
            KES {Number(summary ? summary.total_quoted_value : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-1">Total contract quotation value</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">Project Incomes</div>
          <div className="text-2xl font-black text-blue-700 mt-2 font-mono">
            KES {Number(summary ? summary.total_project_income : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-1">Client payments + materials billed</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Total Net Profit</div>
          <div className="text-2xl font-black text-emerald-600 mt-2 font-mono">
            KES {Number(summary ? summary.total_net_profit : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-1">Income minus store material & labor cost</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search project, client, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-stretch sm:self-auto overflow-x-auto">
          {['all', 'active', 'completed', 'cancelled'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Project Cards Grid */}
      <div className="max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
        {projectsLoading && projects.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2">
            <Loader2 className="h-8 w-8 mx-auto text-amber-600 animate-spin" />
            <p className="text-xs">Loading solar projects directory...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2">
            <Sun className="h-8 w-8 mx-auto text-slate-300" />
            <p className="text-xs">No solar projects found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => openProjectDetail(p.id)}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-900 leading-snug">{p.name}</h3>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                        p.status === 'active'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : p.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-2 font-medium">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>{p.client_name}</span>
                    {p.client_phone && <span>• {p.client_phone}</span>}
                  </div>

                  {p.description && (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2 bg-slate-50 p-2 rounded-xl">
                      {p.description}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Quoted Contract:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      KES {Number(p.quoted_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Net Profit:</span>
                    <span className="font-bold text-emerald-600 font-mono">
                      KES {Number(p.net_profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div ref={projectsSentinelRef} className="py-4 text-center">
          {projectsLoadingMore && (
            <div className="inline-flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
              <span>Loading more projects...</span>
            </div>
          )}
        </div>
      </div>

      {/* New Project Modal */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Sun className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Create Solar Installation Project</h3>
              </div>
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="mt-4 space-y-4">
              {projectFormError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {projectFormError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nyali 10kW Hybrid Solar Installation"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Client Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Captain Salim"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Client Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. +254 711 223344"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Quoted Contract Amount (KES)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 450000"
                  value={quotedAmount}
                  onChange={(e) => setQuotedAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Project Scope / Details</label>
                <textarea
                  rows={3}
                  placeholder="Panels, inverters, cabling requirements, mounting setup..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProject}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {savingProject && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Detail Management Drawer / Modal */}
      {selectedProjectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
            {loadingDetail || !projectDetail ? (
              <div className="p-16 text-center text-slate-400 space-y-2">
                <Loader2 className="h-8 w-8 mx-auto text-amber-600 animate-spin" />
                <p className="text-xs">Loading project details...</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="p-6 bg-slate-900 text-white flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold">{projectDetail.name}</h2>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 text-amber-300 border border-white/10">
                        {projectDetail.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Client: <span className="font-bold text-white">{projectDetail.client_name}</span> {projectDetail.client_phone && `(${projectDetail.client_phone})`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={projectDetail.status}
                      onChange={(e) => handleStatusChange(e.target.value as any)}
                      className="bg-slate-800 border border-slate-700 text-xs text-white px-3 py-1.5 rounded-xl font-bold focus:outline-none"
                    >
                      <option value="active">Status: Active</option>
                      <option value="completed">Status: Completed</option>
                      <option value="cancelled">Status: Cancelled</option>
                    </select>

                    <button
                      onClick={() => setSelectedProjectId(null)}
                      className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-all"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Financial Overview Cards */}
                <div className="p-6 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">Quoted Contract</div>
                    <div className="text-lg font-black text-slate-900 font-mono mt-1">
                      KES {Number(projectDetail.quoted_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">Materials Margin</div>
                    <div className="text-lg font-black text-indigo-600 font-mono mt-1">
                      KES {Number(projectDetail.materials_profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">Client Payments</div>
                    <div className="text-lg font-black text-blue-600 font-mono mt-1">
                      KES {Number(projectDetail.client_payments_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">Net Project Profit</div>
                    <div className="text-lg font-black text-emerald-600 font-mono mt-1">
                      KES {Number(projectDetail.net_profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Sub-Tabs */}
                <div className="px-6 pt-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setActiveDetailTab('materials')}
                      className={`pb-3 text-xs font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
                        activeDetailTab === 'materials'
                          ? 'border-amber-600 text-amber-600'
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <Package className="h-4 w-4" />
                      <span>Allocated Materials ({projectDetail.expenses.filter(e => e.source === 'inventory').length})</span>
                    </button>

                    <button
                      onClick={() => setActiveDetailTab('expenses')}
                      className={`pb-3 text-xs font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
                        activeDetailTab === 'expenses'
                          ? 'border-amber-600 text-amber-600'
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <Receipt className="h-4 w-4" />
                      <span>Labor & External Expenses ({projectDetail.expenses.filter(e => e.source === 'external').length})</span>
                    </button>

                    <button
                      onClick={() => setActiveDetailTab('incomes')}
                      className={`pb-3 text-xs font-bold flex items-center gap-1.5 border-b-2 cursor-pointer transition-all ${
                        activeDetailTab === 'incomes'
                          ? 'border-amber-600 text-amber-600'
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <Banknote className="h-4 w-4" />
                      <span>Client Deposits & Payments ({projectDetail.incomes.filter(i => i.source === 'client_payment').length})</span>
                    </button>
                  </div>

                  <div>
                    {activeDetailTab === 'materials' && (
                      <button
                        onClick={() => setIsMaterialModalOpen(true)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Allocate Inventory
                      </button>
                    )}
                    {activeDetailTab === 'expenses' && (
                      <button
                        onClick={() => setIsExpenseModalOpen(true)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Expense
                      </button>
                    )}
                    {activeDetailTab === 'incomes' && (
                      <button
                        onClick={() => setIsIncomeModalOpen(true)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Record Payment
                      </button>
                    )}
                  </div>
                </div>

                {/* Tab Content Container */}
                <div className="p-6 overflow-y-auto max-h-[380px]">
                  {activeDetailTab === 'materials' && (
                    <div className="space-y-3">
                      {projectDetail.expenses.filter(e => e.source === 'inventory').length === 0 ? (
                        <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                          <Package className="h-6 w-6 mx-auto text-slate-300 mb-1" />
                          <p className="text-xs">No inventory materials allocated yet.</p>
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-2xl overflow-hidden">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                              <tr>
                                <th className="p-3">Product Material</th>
                                <th className="p-3 text-right">Quantity</th>
                                <th className="p-3 text-right">Store Cost (BP)</th>
                                <th className="p-3 text-right">Client Billed (SP)</th>
                                <th className="p-3 text-right">Material Profit</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {projectDetail.expenses.filter(e => e.source === 'inventory').map(m => {
                                const profit = (Number(m.amount) || 0) - (Number(m.cost_amount) || 0);
                                return (
                                  <tr key={m.id} className="hover:bg-slate-50/80">
                                    <td className="p-3 font-semibold text-slate-900">{m.product_name || m.description}</td>
                                    <td className="p-3 text-right font-mono font-medium">{Number(m.quantity)} {m.unit_sold}</td>
                                    <td className="p-3 text-right font-mono text-slate-500">
                                      KES {Number(m.cost_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                                      KES {Number(m.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-emerald-600">
                                      +KES {profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {activeDetailTab === 'expenses' && (
                    <div className="space-y-3">
                      {projectDetail.expenses.filter(e => e.source === 'external').length === 0 ? (
                        <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                          <Receipt className="h-6 w-6 mx-auto text-slate-300 mb-1" />
                          <p className="text-xs">No external labor or transport expenses logged.</p>
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-2xl overflow-hidden">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                              <tr>
                                <th className="p-3">Category</th>
                                <th className="p-3">Description</th>
                                <th className="p-3">Vendor / Receipt</th>
                                <th className="p-3 text-right">Amount (KES)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {projectDetail.expenses.filter(e => e.source === 'external').map(exp => (
                                <tr key={exp.id} className="hover:bg-slate-50/80">
                                  <td className="p-3 font-bold capitalize text-slate-900">{exp.category}</td>
                                  <td className="p-3 text-slate-600">{exp.description || '—'}</td>
                                  <td className="p-3 text-slate-500">{exp.vendor || ''} {exp.receipt_no ? `(#${exp.receipt_no})` : ''}</td>
                                  <td className="p-3 text-right font-mono font-bold text-rose-600">
                                    KES {Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {activeDetailTab === 'incomes' && (
                    <div className="space-y-3">
                      {projectDetail.incomes.filter(i => i.source === 'client_payment').length === 0 ? (
                        <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                          <Banknote className="h-6 w-6 mx-auto text-slate-300 mb-1" />
                          <p className="text-xs">No client payments recorded yet.</p>
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-2xl overflow-hidden">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                              <tr>
                                <th className="p-3">Date</th>
                                <th className="p-3">Description</th>
                                <th className="p-3">Method & Ref</th>
                                <th className="p-3 text-right">Amount (KES)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {projectDetail.incomes.filter(i => i.source === 'client_payment').map(inc => (
                                <tr key={inc.id} className="hover:bg-slate-50/80">
                                  <td className="p-3 text-slate-500">{new Date(inc.date).toLocaleDateString()}</td>
                                  <td className="p-3 font-semibold text-slate-900">{inc.description}</td>
                                  <td className="p-3 uppercase font-medium text-slate-600">{inc.payment_method} {inc.reference ? `(${inc.reference})` : ''}</td>
                                  <td className="p-3 text-right font-mono font-bold text-blue-600">
                                    KES {Number(inc.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Material Allocation Sub-Modal */}
      {isMaterialModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Allocate Material from Inventory</h3>
              <button onClick={() => setIsMaterialModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAllocateMaterial} className="mt-4 space-y-3">
              {materialError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {materialError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Select Product *</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => {
                    const pid = Number(e.target.value);
                    setSelectedProductId(pid);
                    const p = availableProducts.find(x => x.id === pid);
                    if (p) {
                      setMatUnitPrice(String(p.selling_price || ''));
                      setMatUnitSold(p.unit_type === 'roll' ? 'meter' : 'piece');
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                >
                  <option value="">-- Choose product --</option>
                  {availableProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ''}
                    </option>
                  ))}

                </select>
              </div>

              {selectedProduct && selectedProduct.unit_type === 'roll' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Allocation Unit Type</label>
                  <select
                    value={matUnitSold}
                    onChange={(e) => setMatUnitSold(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                  >
                    <option value="meter">Meters</option>
                    <option value="roll">Whole Rolls ({selectedProduct.meters_per_roll || 100}m/roll)</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Quantity *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 4"
                    value={matQuantity}
                    onChange={(e) => setMatQuantity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Client Billed Price (SP)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 16500"
                    value={matUnitPrice}
                    onChange={(e) => setMatUnitPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {selectedProduct && matQuantity && matUnitPrice && (
                <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/80 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Store Buying Cost (BP):</span>
                    <span className="font-mono font-medium">KES {(Number(selectedProduct.cost_price || 0) * parseFloat(matQuantity || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Client Charge (SP):</span>
                    <span className="font-mono font-bold text-slate-900">KES {(parseFloat(matUnitPrice || '0') * parseFloat(matQuantity || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between border-t border-amber-200 pt-1 font-bold text-emerald-700">
                    <span>Expected Margin:</span>
                    <span className="font-mono">+KES {((parseFloat(matUnitPrice || '0') - Number(selectedProduct.cost_price || 0)) * parseFloat(matQuantity || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsMaterialModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={allocatingMaterial}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {allocatingMaterial && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Deduct & Allocate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* External Expense Sub-Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add Labor / External Expense</h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="mt-4 space-y-3">
              {expenseError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {expenseError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Expense Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                >
                  <option value="labor">Technician & Labor</option>
                  <option value="transport">Transport & Logistics</option>
                  <option value="subcontract">Subcontracting</option>
                  <option value="materials">Local Hardware Materials</option>
                  <option value="other">Other Incidentals</option>
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
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Description / Scope</label>
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
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Vendor / Payee</label>
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
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingExpense && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client Payment Sub-Modal */}
      {isIncomeModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Record Client Payment / Deposit</h3>
              <button onClick={() => setIsIncomeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddIncome} className="mt-4 space-y-3">
              {incomeError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {incomeError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Payment Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 50% Advance Project Deposit"
                  value={incDescription}
                  onChange={(e) => setIncDescription(e.target.value)}
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
                  value={incAmount}
                  onChange={(e) => setIncAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Payment Method</label>
                  <select
                    value={incMethod}
                    onChange={(e) => setIncMethod(e.target.value)}
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
                    value={incReference}
                    onChange={(e) => setIncReference(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsIncomeModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingIncome}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingIncome && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
