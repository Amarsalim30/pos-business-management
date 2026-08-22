import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import type { Project, ProjectSummary, Customer } from '../types';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import {
  Sun,
  Plus,
  Search,
  User,
  UserPlus,
  X,
  Loader2,
  ArrowRight,
  Trash2,
  Edit
} from 'lucide-react';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Deletion State
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  // Edit Project State
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editCustomerId, setEditCustomerId] = useState<number | ''>('');
  const [editClientName, setEditClientName] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editQuotedAmount, setEditQuotedAmount] = useState('');
  const [editStatus, setEditStatus] = useState<string>('active');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // New Project Modal State
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [description, setDescription] = useState('');
  const [quotedAmount, setQuotedAmount] = useState('');
  const [initialStatus, setInitialStatus] = useState<'draft' | 'active'>('active');
  const [savingProject, setSavingProject] = useState(false);
  const [projectFormError, setProjectFormError] = useState<string | null>(null);


  // Quick Customer Creation State
  const [isQuickCustOpen, setIsQuickCustOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickAddress, setQuickAddress] = useState('');
  const [savingQuickCust, setSavingQuickCust] = useState(false);
  const [quickCustError, setQuickCustError] = useState<string | null>(null);

  // Infinite Scroll Projects State
  const {
    items: projects,
    loading: projectsLoading,
    loadingMore: projectsLoadingMore,
    hasMore: projectsHasMore,
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

  const loadCustomers = async () => {
    try {
      const data = await apiFetch<Customer[]>('/api/v1/customers/');
      setCustomers(data);
    } catch (e) {
      console.error('Failed to load customers', e);
    }
  };

  useEffect(() => {
    loadSummary();
    loadCustomers();
  }, []);

  const handleSelectCustomer = (custId: number | '') => {
    setSelectedCustomerId(custId);
    if (!custId) return;
    const c = customers.find(x => x.id === custId);
    if (c) {
      setClientName(c.name);
      setClientPhone(c.phone || '');
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
      setSelectedCustomerId(created.id);
      setClientName(created.name);
      setClientPhone(created.phone || '');

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

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !clientName.trim()) return;

    setSavingProject(true);
    setProjectFormError(null);
    try {
      const created = await apiFetch<Project>('/api/v1/projects/', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          client_name: clientName.trim(),
          client_phone: clientPhone.trim() || null,
          customer_id: selectedCustomerId ? Number(selectedCustomerId) : null,
          description: description.trim() || null,
          quoted_amount: parseFloat(quotedAmount) || 0,
          status: initialStatus
        })
      });
      setIsNewProjectModalOpen(false);
      setName('');
      setSelectedCustomerId('');
      setClientName('');
      setClientPhone('');
      setDescription('');
      setQuotedAmount('');
      navigate(`/projects/${created.id}`);
    } catch (err: any) {
      setProjectFormError(err.message || 'Failed to create project');
    } finally {
      setSavingProject(false);
    }
  };

  const handleOpenEditProject = (p: Project) => {
    setEditingProject(p);
    setEditName(p.name);
    setEditCustomerId(p.customer_id || '');
    setEditClientName(p.client_name);
    setEditClientPhone(p.client_phone || '');
    setEditDescription(p.description || '');
    setEditQuotedAmount(String(p.quoted_amount ?? '0'));
    setEditStatus(p.status || 'active');
    setEditError(null);
  };

  const handleSaveEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    if (!editName.trim() || !editClientName.trim()) return;

    setSavingEdit(true);
    setEditError(null);
    try {
      await apiFetch(`/api/v1/projects/${editingProject.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editName.trim(),
          client_name: editClientName.trim(),
          client_phone: editClientPhone.trim() || null,
          customer_id: editCustomerId ? Number(editCustomerId) : null,
          description: editDescription.trim() || null,
          quoted_amount: parseFloat(editQuotedAmount) || 0,
          status: editStatus
        })
      });
      setEditingProject(null);
      await Promise.all([reloadProjects(), loadSummary()]);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update project');
    } finally {
      setSavingEdit(false);
    }
  };


  const handleDeleteProject = async () => {
    if (!deletingProject) return;
    setIsDeletingProject(true);
    try {
      await apiFetch(`/api/v1/projects/${deletingProject.id}`, {
        method: 'DELETE'
      });
      setDeletingProject(null);
      await Promise.all([reloadProjects(), loadSummary()]);
    } catch (err: any) {
      alert(err.message || 'Failed to delete project');
    } finally {
      setIsDeletingProject(false);
    }
  };

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
            Track custom solar installations, assign store materials, record labor/expenses, and monitor project profit margins.
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
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Completed Projects</div>
          <div className="text-2xl font-black text-emerald-600 mt-2 font-mono">
            {summary ? summary.completed_projects : 0}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Quoted Value</div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            KES {summary ? Number(summary.total_quoted_value).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Realized Profit</div>
          <div className="text-2xl font-black text-emerald-600 mt-2 font-mono">
            KES {summary ? Number(summary.total_net_profit).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by project name or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'all', label: 'All' },
            { id: 'draft', label: 'Draft' },
            { id: 'active', label: 'Active' },
            { id: 'commissioning', label: 'Testing' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' }
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === st.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {st.label}
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
                onClick={() => navigate(`/projects/${p.id}`)}
                className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-amber-600 transition-colors leading-snug">
                      {p.name}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider shrink-0 ${
                        p.status === 'active'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : p.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : p.status === 'draft'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : p.status === 'commissioning'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {p.status === 'active'
                        ? 'In Progress'
                        : p.status === 'commissioning'
                        ? 'Testing'
                        : p.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-2 font-medium">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-700">{p.client_name}</span>
                    {p.client_phone && <span>• {p.client_phone}</span>}
                  </div>

                  {p.description && (
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2 bg-slate-50 p-2.5 rounded-xl">
                      {p.description}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-3">
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

                  <div className="pt-1 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditProject(p);
                        }}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit Project Details"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingProject(p);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Project"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-amber-600 group-hover:translate-x-0.5 transition-transform">
                      <span>Open Workspace</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}

        {projectsHasMore && (
          <div ref={projectsSentinelRef} className="py-4 text-center">
            {projectsLoadingMore && (
              <div className="inline-flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                <span>Loading more projects...</span>
              </div>
            )}
          </div>
        )}

        {!projectsHasMore && projects.length > 0 && (
          <div className="text-center py-4 text-[11px] text-slate-400 font-medium">
            Showing all {projects.length} solar projects
          </div>
        )}
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

              {/* Linked Customer Selection & On-The-Spot Creation */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase">Customer Account</label>
                  <button
                    type="button"
                    onClick={() => setIsQuickCustOpen(true)}
                    className="flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>+ Register New Client</span>
                  </button>
                </div>

                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleSelectCustomer(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                >
                  <option value="">-- Choose from existing customers (or fill below) --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''} {Number(c.balance) > 0 ? `• Debt: KES ${Number(c.balance).toLocaleString()}` : ''}
                    </option>
                  ))}
                </select>
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

              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Initial Status</label>
                  <select
                    value={initialStatus}
                    onChange={(e) => setInitialStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    <option value="active">Active (In Progress)</option>
                    <option value="draft">Draft Proposal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Scope / System Specifications</label>
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
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {savingProject && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create & Open Workspace
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

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Edit className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Edit Solar Project</h3>
                  <p className="text-xs text-slate-500">Update project details, client, or quoted amount.</p>
                </div>
              </div>
              <button
                onClick={() => setEditingProject(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditProject} className="mt-4 space-y-4">
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
                  placeholder="e.g. Nyali 10kW Hybrid Solar Installation"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              {/* Linked Customer Selection */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase">Customer Account</label>
                  <button
                    type="button"
                    onClick={() => setIsQuickCustOpen(true)}
                    className="flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>+ Register New Client</span>
                  </button>
                </div>

                <select
                  value={editCustomerId}
                  onChange={(e) => {
                    const custId = e.target.value ? Number(e.target.value) : '';
                    setEditCustomerId(custId);
                    if (custId) {
                      const c = customers.find(x => x.id === custId);
                      if (c) {
                        setEditClientName(c.name);
                        setEditClientPhone(c.phone || '');
                      }
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
                >
                  <option value="">-- Choose from existing customers (or fill below) --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Client Contact Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Captain Salim"
                    value={editClientName}
                    onChange={(e) => setEditClientName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Client Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +254 711 223344"
                    value={editClientPhone}
                    onChange={(e) => setEditClientPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Quoted Contract (KES)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 450000"
                    value={editQuotedAmount}
                    onChange={(e) => setEditQuotedAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Project Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    <option value="draft">Draft / Scoping</option>
                    <option value="active">Active Installation</option>
                    <option value="commissioning">Testing & Commissioning</option>
                    <option value="completed">Completed & Handed Over</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Project Scope / Technical Notes</label>
                <textarea
                  rows={3}
                  placeholder="e.g. 10kW Deye Inverter, 16x 550W Jinko Tier-1 Mono Panels, 15kWh LiFePO4 battery bank."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingEdit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Project Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {deletingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Solar Project</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-1.5 text-slate-600">
              <div className="font-bold text-slate-900 text-sm">{deletingProject.name}</div>
              <div>Client: <span className="font-semibold text-slate-800">{deletingProject.client_name}</span></div>
              <div>Contract: <span className="font-mono font-bold text-slate-800">KES {Number(deletingProject.quoted_amount).toLocaleString()}</span></div>
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200 mt-2 font-medium">
                Note: Any allocated inventory materials will be returned to store stock automatically.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingProject}
                onClick={() => setDeletingProject(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingProject}
                onClick={handleDeleteProject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeletingProject && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
