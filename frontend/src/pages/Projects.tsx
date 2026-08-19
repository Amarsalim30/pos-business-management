import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/api';
import type { Project, ProjectSummary } from '../types';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import {
  Sun,
  Plus,
  Search,
  User,
  X,
  Loader2,
  ArrowRight
} from 'lucide-react';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
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

  // Infinite Scroll Projects State
  const {
    items: projects,
    loading: projectsLoading,
    loadingMore: projectsLoadingMore,
    sentinelRef: projectsSentinelRef
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

  useEffect(() => {
    loadSummary();
  }, []);

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
      // Navigate directly to the new project workspace
      navigate(`/projects/${created.id}`);
    } catch (err: any) {
      setProjectFormError(err.message || 'Failed to create project');
    } finally {
      setSavingProject(false);
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

                  <div className="pt-1 flex items-center justify-end">
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
    </div>
  );
};
