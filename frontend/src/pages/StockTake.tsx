import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import type { 
  StockTakeSummary, 
  StockTakeItemDetail, 
  StockTakeItemsPaginated, 
  Category 
} from '../types';
import { 
  ClipboardCheck, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  History,
  Download,
  Search,
  Check,
  X,
  Loader2,
  Package,
  Layers,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Eye
} from 'lucide-react';

export const StockTakePage: React.FC = () => {
  // Navigation & Sessions State
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [activeSession, setActiveSession] = useState<StockTakeSummary | null>(null);
  const [pastSessions, setPastSessions] = useState<StockTakeSummary[]>([]);
  const [viewingHistorySession, setViewingHistorySession] = useState<StockTakeSummary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState<boolean>(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'discrepancy' | 'uncounted' | 'matched'>('all');

  // Start Session Modal State
  const [isStartModalOpen, setIsStartModalOpen] = useState<boolean>(false);
  const [startScope, setStartScope] = useState<'all' | 'category'>('all');
  const [startCategoryId, setStartCategoryId] = useState<string>('');
  const [startNotes, setStartNotes] = useState<string>('');
  const [startingSession, setStartingSession] = useState<boolean>(false);

  // Reconcile & Action States
  const [reconciling, setReconciling] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [exportingCsv, setExportingCsv] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [savingItemIds, setSavingItemIds] = useState<{ [itemId: number]: boolean }>({});
  const [savedSuccessIds, setSavedSuccessIds] = useState<{ [itemId: number]: boolean }>({});

  // Local Counts editing buffer: itemId -> { rolls, loose, qty }
  const [editBuffer, setEditBuffer] = useState<{ [itemId: number]: { rolls: string; loose: string; qty: string } }>({});

  // Fetch initial session lists and categories
  useEffect(() => {
    loadSessions();
    loadCategories();
  }, []);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const data = await apiFetch<StockTakeSummary[]>('/api/v1/stock-takes/');
      setPastSessions(data);
      // ONLY set activeSession if there is a session strictly in 'in_progress' state
      const inProgress = data.find(s => s.status === 'in_progress');
      setActiveSession(inProgress || null);
    } catch (e) {
      console.error('Failed to load stock take sessions', e);
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const cats = await apiFetch<Category[]>('/api/v1/categories/');
      setCategories(cats);
    } catch (e) {
      console.error('Failed to load categories', e);
    }
  };

  // Determine current displayed session (active in_progress session, or inspected history session)
  const currentTargetSession = activeTab === 'current' ? activeSession : viewingHistorySession;

  // Contained Infinite Scroll for Items
  const {
    items,
    setItems,
    loading: itemsLoading,
    loadingMore,
    sentinelRef,
    reload: reloadItems
  } = useInfiniteScroll<StockTakeItemDetail>({
    fetchFn: async (offset, limit) => {
      if (!currentTargetSession) return [];
      let url = `/api/v1/stock-takes/${currentTargetSession.id}/items?limit=${limit}&offset=${offset}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      if (selectedCategory !== 'all') url += `&category_id=${selectedCategory}`;
      if (statusFilter !== 'all') url += `&status_filter=${statusFilter}`;
      
      const res = await apiFetch<StockTakeItemsPaginated>(url);
      
      // Live sync stats when on active session
      if (activeTab === 'current' && activeSession) {
        setActiveSession(prev => prev ? ({
          ...prev,
          total_items: res.total_items,
          counted_items: res.counted_items,
          discrepancy_count: res.discrepancy_count,
          total_variance_value: res.total_variance_value
        }) : null);
      }

      return res.items;
    },
    limit: 50,
    dependencies: [currentTargetSession?.id, activeTab, searchQuery, selectedCategory, statusFilter]
  });

  // Start new stock take session
  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setStartingSession(true);
    try {
      const payload: { notes: string; category_id?: number | null } = {
        notes: startNotes.trim() || (startScope === 'category' ? 'Category Cycle Count' : 'Full Store Physical Audit')
      };
      if (startScope === 'category' && startCategoryId) {
        payload.category_id = parseInt(startCategoryId, 10);
      }

      const newSession = await apiFetch<StockTakeSummary>('/api/v1/stock-takes/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setActiveSession(newSession);
      setViewingHistorySession(null);
      setIsStartModalOpen(false);
      setStartNotes('');
      setStartCategoryId('');
      setStartScope('all');
      setActiveTab('current');
      setEditBuffer({});
      setSuccessMessage('New stock take session started successfully!');
      await loadSessions();
      reloadItems();
    } catch (err: any) {
      alert(err.message || 'Failed to start stock take session');
    } finally {
      setStartingSession(false);
    }
  };

  // Save physical count for an item
  const handleSaveCount = async (item: StockTakeItemDetail) => {
    if (!activeSession || activeSession.status !== 'in_progress') return;

    const buf = editBuffer[item.id];
    let countedQty: number | null = null;
    let rollsCounted: number | null = null;
    let looseCounted: number | null = null;

    if (item.unit_type === 'roll') {
      rollsCounted = buf?.rolls !== undefined ? parseFloat(buf.rolls) : item.rolls_counted || 0;
      looseCounted = buf?.loose !== undefined ? parseFloat(buf.loose) : item.loose_meters_counted || 0;
      const mpr = item.meters_per_roll || 100;
      countedQty = ((rollsCounted || 0) * mpr) + (looseCounted || 0);
    } else {
      countedQty = buf?.qty !== undefined ? parseFloat(buf.qty) : item.counted_quantity;
    }

    if (isNaN(countedQty)) return;

    setSavingItemIds(prev => ({ ...prev, [item.id]: true }));

    try {
      const updatedItem = await apiFetch<StockTakeItemDetail>(`/api/v1/stock-takes/${activeSession.id}/items`, {
        method: 'POST',
        body: JSON.stringify({
          product_id: item.product_id,
          counted_quantity: countedQty,
          rolls_counted: rollsCounted,
          loose_meters_counted: looseCounted,
        }),
      });

      // Update item in local infinite scroll list
      setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
      
      // Flash success checkmark
      setSavedSuccessIds(prev => ({ ...prev, [item.id]: true }));
      setTimeout(() => {
        setSavedSuccessIds(prev => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      }, 2000);

      // Refresh session statistics
      const summary = await apiFetch<StockTakeSummary>(`/api/v1/stock-takes/${activeSession.id}`);
      setActiveSession(summary);
    } catch (err: any) {
      alert(err.message || 'Failed to save count');
    } finally {
      setSavingItemIds(prev => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
  };

  // Reconcile Session
  const handleReconcile = async () => {
    if (!activeSession || activeSession.status !== 'in_progress') return;
    const confirmMsg = activeSession.discrepancy_count > 0
      ? `Reconcile inventory? This will automatically update active balances for ${activeSession.discrepancy_count} discrepant item(s) and create audit logs.`
      : 'Reconcile and close this stock take session?';

    if (!window.confirm(confirmMsg)) return;

    setReconciling(true);
    try {
      await apiFetch<StockTakeSummary>(`/api/v1/stock-takes/${activeSession.id}/reconcile`, {
        method: 'POST',
      });
      setActiveSession(null);
      setEditBuffer({});
      setSuccessMessage('Inventory balances successfully reconciled and updated!');
      await loadSessions();
      setActiveTab('history');
    } catch (err: any) {
      alert(err.message || 'Failed to reconcile stock take');
    } finally {
      setReconciling(false);
    }
  };

  // Cancel Session
  const handleCancelSession = async () => {
    if (!activeSession || activeSession.status !== 'in_progress') return;
    if (!window.confirm('Are you sure you want to cancel this stock take session? All recorded counts for this session will be discarded.')) {
      return;
    }

    setCancelling(true);
    try {
      await apiFetch<StockTakeSummary>(`/api/v1/stock-takes/${activeSession.id}/cancel`, {
        method: 'POST',
      });
      setActiveSession(null);
      setEditBuffer({});
      setSuccessMessage('Stock take session was cancelled.');
      await loadSessions();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel stock take');
    } finally {
      setCancelling(false);
    }
  };

  // Export full CSV for a session
  const handleExportCSV = async (session: StockTakeSummary) => {
    setExportingCsv(true);
    try {
      const data = await apiFetch<StockTakeItemsPaginated>(`/api/v1/stock-takes/${session.id}/items?limit=100000`);
      
      const headers = ['Product Name', 'SKU', 'Category', 'Unit', 'Expected Qty', 'Counted Qty', 'Variance', 'Cost Price', 'Variance Value (KES)', 'Status'];
      const rows = data.items.map(i => [
        `"${(i.product_name || '').replace(/"/g, '""')}"`,
        `"${(i.product_sku || '').replace(/"/g, '""')}"`,
        `"${(i.category_name || '').replace(/"/g, '""')}"`,
        `"${i.unit || 'pcs'}"`,
        i.expected_quantity,
        i.is_counted ? i.counted_quantity : 'Uncounted',
        i.variance,
        i.cost_price,
        i.variance_value,
        !i.is_counted ? 'Uncounted' : i.variance === 0 ? 'Matched' : 'Discrepancy'
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `stock_take_session_${session.id}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.message || 'Failed to export CSV');
    } finally {
      setExportingCsv(false);
    }
  };

  // Calculate Progress Percent for active session
  const progressPercent = activeSession && activeSession.total_items > 0
    ? Math.min(100, Math.round((activeSession.counted_items / activeSession.total_items) * 100))
    : 0;

  return (
    <div className="space-y-4">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100 shadow-2xs">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Stock Take & Physical Audit
                </h1>
                {activeSession && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Session #{activeSession.id} In Progress
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                High-performance physical store audit scaled for 10,000+ products with live variance calculation.
              </p>
            </div>
          </div>
        </div>

        {/* Action Header Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {activeSession && activeSession.status === 'in_progress' && (
            <>
              <button
                onClick={handleReconcile}
                disabled={reconciling}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                title="Post inventory reconciliation adjustments"
              >
                {reconciling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                <span>Reconcile Inventory</span>
              </button>

              <button
                onClick={handleCancelSession}
                disabled={cancelling}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
                title="Cancel and drop active audit session"
              >
                <X className="h-4 w-4" />
                <span>Cancel Session</span>
              </button>
            </>
          )}

          <button
            onClick={() => setIsStartModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Stock Take</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => {
            setActiveTab('current');
            setViewingHistorySession(null);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'current'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ClipboardCheck className="h-4 w-4" />
          <span>Active Count Session {activeSession ? `(#${activeSession.id})` : ''}</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('history');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Audit History ({pastSessions.length})</span>
        </button>
      </div>

      {activeTab === 'current' ? (
        activeSession ? (
          <div className="space-y-4">
            {/* Top KPI Cards Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Total Products in Audit */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Items in Scope</span>
                  <div className="text-2xl font-black text-slate-900 mt-0.5">
                    {activeSession.total_items.toLocaleString()}
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                    {activeSession.category_name ? `Category: ${activeSession.category_name}` : 'Whole Store Audit'}
                  </div>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Package className="h-5 w-5" />
                </div>
              </div>

              {/* Counted Progress */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Count Progress</span>
                  <span className="text-xs font-extrabold text-indigo-600">{progressPercent}%</span>
                </div>
                <div className="text-2xl font-black text-slate-900 mt-0.5">
                  {activeSession.counted_items.toLocaleString()} <span className="text-xs font-semibold text-slate-400">/ {activeSession.total_items.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Discrepancies Count */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Discrepant Items</span>
                  <div className="text-2xl font-black text-amber-600 mt-0.5">
                    {activeSession.discrepancy_count.toLocaleString()}
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                    {activeSession.discrepancy_count === 0 ? 'All counts match stock' : 'Requires adjustment'}
                  </div>
                </div>
                <div className={`p-3 rounded-xl ${activeSession.discrepancy_count > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </div>

              {/* Net Variance Value (KES) */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Net Variance Value</span>
                  <div className={`text-2xl font-black mt-0.5 ${
                    activeSession.total_variance_value >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    KES {Number(activeSession.total_variance_value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                    {activeSession.total_variance_value >= 0 ? 'Net Surplus' : 'Net Shortage'}
                  </div>
                </div>
                <div className={`p-3 rounded-xl ${activeSession.total_variance_value >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {activeSession.total_variance_value >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-3 flex-1 flex-wrap">
                {/* Search input */}
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search product name or SKU..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="discrepancy">Discrepancies Only</option>
                  <option value="uncounted">Uncounted Only</option>
                  <option value="matched">Counted & Matched</option>
                </select>
              </div>

              {/* Export CSV */}
              <button
                onClick={() => handleExportCSV(activeSession)}
                disabled={exportingCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                {exportingCsv ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                <span>Export CSV</span>
              </button>
            </div>

            {/* Contained Infinite Scroll Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden max-h-[calc(100vh-285px)] flex flex-col">
              <div className="overflow-x-auto overflow-y-auto flex-1">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 shadow-2xs">
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">Product Details</th>
                      <th className="py-3 px-3 text-center">Type</th>
                      <th className="py-3 px-4 text-right">System Stock</th>
                      <th className="py-3 px-4 text-center min-w-[220px]">Physical Count Entry</th>
                      <th className="py-3 px-4 text-right">Variance</th>
                      <th className="py-3 px-4 text-right">Impact (KES)</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {itemsLoading && items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center text-slate-400 font-normal">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
                            <span className="text-xs font-semibold text-slate-600">Loading stock audit items...</span>
                          </div>
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center text-slate-400 font-normal">
                          <div className="flex flex-col items-center justify-center space-y-1">
                            <Package className="h-8 w-8 text-slate-300 stroke-1" />
                            <span className="text-sm font-bold text-slate-700">No products match filter criteria</span>
                            <span className="text-xs text-slate-400">Try adjusting your search query or status filter.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      items.map((item, index) => {
                        const isRoll = item.unit_type === 'roll';
                        const buf = editBuffer[item.id];
                        const isSaving = savingItemIds[item.id];
                        const isSaved = savedSuccessIds[item.id];
                        const isDiscrepancy = item.variance !== 0;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                            {/* Row number */}
                            <td className="py-3 px-4 text-center text-xs text-slate-400 font-bold">
                              {index + 1}
                            </td>

                            {/* Product Name, SKU, Category */}
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 text-xs">
                                {item.product_name}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {item.product_sku && (
                                  <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                                    {item.product_sku}
                                  </span>
                                )}
                                {item.category_name && (
                                  <span className="text-[10px] text-slate-400 font-semibold">
                                    • {item.category_name}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Unit Type */}
                            <td className="py-3 px-3 text-center">
                              {isRoll ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md text-[10px] font-bold border border-amber-200">
                                  <Layers className="h-2.5 w-2.5" />
                                  Roll ({item.meters_per_roll || 100}m)
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold">
                                  {item.unit || 'Piece'}
                                </span>
                              )}
                            </td>

                            {/* System Expected Qty */}
                            <td className="py-3 px-4 text-right">
                              <div className="font-mono font-bold text-xs text-slate-800">
                                {Number(item.expected_quantity).toLocaleString()} {item.unit || 'pcs'}
                              </div>
                            </td>

                            {/* Physical Count Input */}
                            <td className="py-2.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {isRoll ? (
                                  // Roll & Loose helper
                                  <div className="flex items-center gap-1">
                                    <div className="relative">
                                      <input
                                        type="number"
                                        min="0"
                                        placeholder="Rolls"
                                        value={buf?.rolls !== undefined ? buf.rolls : (item.rolls_counted !== null ? item.rolls_counted : '')}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setEditBuffer(prev => ({
                                            ...prev,
                                            [item.id]: {
                                              rolls: val,
                                              loose: prev[item.id]?.loose !== undefined ? prev[item.id].loose : (item.loose_meters_counted?.toString() || '0'),
                                              qty: ''
                                            }
                                          }));
                                        }}
                                        onBlur={() => handleSaveCount(item)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCount(item); }}
                                        className="w-16 px-2 py-1.5 text-center text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                      />
                                      <span className="text-[9px] text-slate-400 font-bold block text-center mt-0.5">Rolls</span>
                                    </div>
                                    <span className="text-slate-400 font-bold text-xs pb-3">+</span>
                                    <div className="relative">
                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        placeholder="Meters"
                                        value={buf?.loose !== undefined ? buf.loose : (item.loose_meters_counted !== null ? item.loose_meters_counted : '')}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setEditBuffer(prev => ({
                                            ...prev,
                                            [item.id]: {
                                              rolls: prev[item.id]?.rolls !== undefined ? prev[item.id].rolls : (item.rolls_counted?.toString() || '0'),
                                              loose: val,
                                              qty: ''
                                            }
                                          }));
                                        }}
                                        onBlur={() => handleSaveCount(item)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCount(item); }}
                                        className="w-20 px-2 py-1.5 text-center text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                      />
                                      <span className="text-[9px] text-slate-400 font-bold block text-center mt-0.5">Loose (m)</span>
                                    </div>
                                  </div>
                                ) : (
                                  // Standard Piece Count Input
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    placeholder="Counted qty..."
                                    value={buf?.qty !== undefined ? buf.qty : (item.is_counted ? item.counted_quantity : '')}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditBuffer(prev => ({
                                        ...prev,
                                        [item.id]: { rolls: '', loose: '', qty: val }
                                      }));
                                    }}
                                    onBlur={() => handleSaveCount(item)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCount(item); }}
                                    className="w-28 px-3 py-1.5 text-center text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                  />
                                )}

                                {/* Auto-save status feedback */}
                                <div className="w-5 flex items-center justify-center">
                                  {isSaving ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                                  ) : isSaved ? (
                                    <Check className="h-4 w-4 text-emerald-600 animate-bounce" />
                                  ) : null}
                                </div>
                              </div>
                            </td>

                            {/* Variance Quantity */}
                            <td className="py-3 px-4 text-right">
                              <span className={`font-mono font-extrabold text-xs ${
                                !item.is_counted 
                                  ? 'text-slate-400' 
                                  : item.variance > 0 
                                  ? 'text-emerald-700' 
                                  : item.variance < 0 
                                  ? 'text-rose-700' 
                                  : 'text-slate-700'
                              }`}>
                                {!item.is_counted ? '—' : `${item.variance > 0 ? '+' : ''}${Number(item.variance).toLocaleString()}`}
                              </span>
                            </td>

                            {/* Variance Value (KES) */}
                            <td className="py-3 px-4 text-right">
                              <span className={`font-mono font-bold text-xs ${
                                !item.is_counted
                                  ? 'text-slate-400'
                                  : item.variance_value > 0
                                  ? 'text-emerald-700'
                                  : item.variance_value < 0
                                  ? 'text-rose-700'
                                  : 'text-slate-600'
                              }`}>
                                {!item.is_counted ? '—' : `KES ${Number(item.variance_value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                              </span>
                            </td>

                            {/* Status Badge */}
                            <td className="py-3 px-3 text-center">
                              {!item.is_counted ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                                  Uncounted
                                </span>
                              ) : isDiscrepancy ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  Mismatch
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <Check className="h-2.5 w-2.5" />
                                  Matched
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}

                    {/* Infinite Scroll Sentinel Element */}
                    <tr ref={sentinelRef}>
                      <td colSpan={8} className="p-0 border-0">
                        {loadingMore && (
                          <div className="py-4 text-center text-xs text-indigo-600 font-bold flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Loading more products...</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* Empty Active Session State */
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
            <div className="max-w-md mx-auto flex flex-col items-center">
              <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl mb-3">
                <ClipboardCheck className="h-10 w-10" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No Active Stock Take Session</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Start a new whole-store count or category cycle count to audit physical inventory and reconcile discrepancies.
              </p>
              <button
                onClick={() => setIsStartModalOpen(true)}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Start Stock Take</span>
              </button>
            </div>
          </div>
        )
      ) : (
        /* Audit History Tab */
        viewingHistorySession ? (
          /* Detailed Historical Session Inspection View */
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setViewingHistorySession(null)}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors cursor-pointer"
                  title="Back to History List"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Audit #{viewingHistorySession.id} — {viewingHistorySession.notes || 'Physical Count'}
                    </h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      viewingHistorySession.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {viewingHistorySession.status === 'completed' ? 'Reconciled Audit' : 'Cancelled Audit'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Started: {new Date(viewingHistorySession.created_at).toLocaleString()} • Scope: {viewingHistorySession.category_name ? `Category ${viewingHistorySession.category_name}` : 'Whole Store'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportCSV(viewingHistorySession)}
                  disabled={exportingCsv}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
                >
                  {exportingCsv ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => setViewingHistorySession(null)}
                  className="px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Back to Audits List
                </button>
              </div>
            </div>

            {/* Read-Only Items Contained Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden max-h-[calc(100vh-285px)] flex flex-col">
              <div className="overflow-x-auto overflow-y-auto flex-1">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 shadow-2xs">
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">Product Details</th>
                      <th className="py-3 px-3 text-center">Type</th>
                      <th className="py-3 px-4 text-right">System Stock</th>
                      <th className="py-3 px-4 text-center">Recorded Physical Count</th>
                      <th className="py-3 px-4 text-right">Variance</th>
                      <th className="py-3 px-4 text-right">Impact (KES)</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {itemsLoading && items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center text-slate-400 font-normal">
                          <Loader2 className="h-7 w-7 animate-spin text-indigo-600 mx-auto" />
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center text-slate-400 font-normal">
                          No items found for this audit session.
                        </td>
                      </tr>
                    ) : (
                      items.map((item, index) => {
                        const isDiscrepancy = item.variance !== 0;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 text-center text-xs text-slate-400 font-bold">
                              {index + 1}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 text-xs">{item.product_name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{item.product_sku || '—'}</div>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="text-[10px] font-bold text-slate-600 uppercase">
                                {item.unit_type === 'roll' ? `Roll (${item.meters_per_roll || 100}m)` : item.unit || 'Piece'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-xs text-slate-700">
                              {Number(item.expected_quantity).toLocaleString()} {item.unit || 'pcs'}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-xs text-indigo-700">
                              {item.is_counted ? `${Number(item.counted_quantity).toLocaleString()} ${item.unit || 'pcs'}` : '—'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className={`font-mono font-extrabold text-xs ${
                                !item.is_counted ? 'text-slate-400' : item.variance > 0 ? 'text-emerald-700' : item.variance < 0 ? 'text-rose-700' : 'text-slate-700'
                              }`}>
                                {!item.is_counted ? '—' : `${item.variance > 0 ? '+' : ''}${Number(item.variance).toLocaleString()}`}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-xs">
                              {!item.is_counted ? '—' : `KES ${Number(item.variance_value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {!item.is_counted ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                                  Uncounted
                                </span>
                              ) : isDiscrepancy ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                  Mismatch
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Matched
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}

                    <tr ref={sentinelRef}>
                      <td colSpan={8} className="p-0 border-0">
                        {loadingMore && (
                          <div className="py-4 text-center text-xs text-indigo-600 font-bold flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Loading more products...</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* Past Sessions Summary List */
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden max-h-[calc(100vh-285px)] flex flex-col">
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 shadow-2xs">
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Session #</th>
                    <th className="py-3 px-4">Scope / Scope Category</th>
                    <th className="py-3 px-4">Started At</th>
                    <th className="py-3 px-4">Completed / Cancelled At</th>
                    <th className="py-3 px-4 text-center">Items Counted</th>
                    <th className="py-3 px-4 text-center">Discrepancies</th>
                    <th className="py-3 px-4 text-right">Variance Impact</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {sessionsLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600" />
                      </td>
                    </tr>
                  ) : pastSessions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                        No past stock take sessions found.
                      </td>
                    </tr>
                  ) : (
                    pastSessions.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-xs text-indigo-600">
                          #{session.id}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-xs text-slate-900">
                            {session.notes || 'Stock Take Audit'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {session.category_name ? `Category: ${session.category_name}` : 'Whole Store (All Items)'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600">
                          {new Date(session.created_at).toLocaleDateString()} {new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600">
                          {session.completed_at 
                            ? `${new Date(session.completed_at).toLocaleDateString()} ${new Date(session.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : '—'
                          }
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-700">
                          {session.counted_items} / {session.total_items}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-bold text-xs text-amber-600">
                          {session.discrepancy_count}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-xs">
                          KES {Number(session.total_variance_value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            session.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : session.status === 'in_progress'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {session.status === 'completed' ? 'Reconciled' : session.status === 'in_progress' ? 'In Progress' : 'Cancelled'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                if (session.status === 'in_progress') {
                                  setActiveSession(session);
                                  setActiveTab('current');
                                } else {
                                  setViewingHistorySession(session);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                              title="Inspect Session"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>View</span>
                            </button>
                            <button
                              onClick={() => handleExportCSV(session)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                              title="Export CSV"
                            >
                              <Download className="h-4 w-4" />
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
        )
      )}

      {/* Start Stock Take Modal */}
      {isStartModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Start New Stock Take</h3>
                  <p className="text-xs text-slate-500">Initiate physical store audit session</p>
                </div>
              </div>
              <button
                onClick={() => setIsStartModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleStartSession} className="space-y-4">
              {/* Audit Scope Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Audit Scope
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStartScope('all')}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                      startScope === 'all'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs">Whole Store</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">All active products</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStartScope('category')}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                      startScope === 'category'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs">Category Cycle Count</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Select specific department</div>
                  </button>
                </div>
              </div>

              {/* Category Select if Cycle Count */}
              {startScope === 'category' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Target Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={startCategoryId}
                    onChange={(e) => setStartCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="">Select Category...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Audit Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Session Notes (Optional)
                </label>
                <input
                  type="text"
                  value={startNotes}
                  onChange={(e) => setStartNotes(e.target.value)}
                  placeholder="e.g. End of Month Physical Audit, Q3 Cycle Count..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsStartModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={startingSession || (startScope === 'category' && !startCategoryId)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {startingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  <span>Start Audit Session</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
