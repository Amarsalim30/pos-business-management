import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import type { PurchaseOrder, GoodsReceivedNote, Supplier, Product, Category } from '../types';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { GRNDocumentDrawer } from '../components/GRNDocumentDrawer';
import { CreatePOModal } from '../components/CreatePOModal';
import { DirectGRNModal } from '../components/DirectGRNModal';
import { ReceivePOModal } from '../components/ReceivePOModal';
import {
  ShoppingBag,
  Plus,
  Search,
  PackageCheck,
  Banknote,
  Calendar,
  X,
  CheckCircle2,
  Clock,
  Ban,
  Loader2,
  Eye,
  Truck
} from 'lucide-react';

export const PurchasesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'grn'>('orders');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Infinite Scroll Orders State
  const {
    items: orders,
    loading: ordersLoading,
    loadingMore: ordersLoadingMore,
    hasMore: ordersHasMore,
    sentinelRef: ordersSentinelRef,
    reload: reloadOrders
  } = useInfiniteScroll<PurchaseOrder>({
    fetchFn: async (offset, limit) => {
      let url = `/api/v1/purchases/orders?limit=${limit}&offset=${offset}`;
      if (statusFilter !== 'all') url += `&status_filter=${statusFilter}`;
      if (supplierFilter !== 'all') url += `&supplier_id=${supplierFilter}`;
      return await apiFetch<PurchaseOrder[]>(url);
    },
    limit: 25,
    dependencies: [activeTab, statusFilter, supplierFilter]
  });

  // Infinite Scroll GRNs State
  const {
    items: grns,
    loading: grnsLoading,
    loadingMore: grnsLoadingMore,
    hasMore: grnsHasMore,
    sentinelRef: grnsSentinelRef,
    reload: reloadGRNs
  } = useInfiniteScroll<GoodsReceivedNote>({
    fetchFn: async (offset, limit) => {
      let url = `/api/v1/purchases/grn?limit=${limit}&offset=${offset}`;
      if (supplierFilter !== 'all') url += `&supplier_id=${supplierFilter}`;
      return await apiFetch<GoodsReceivedNote[]>(url);
    },
    limit: 25,
    dependencies: [activeTab, supplierFilter]
  });

  // Modals State
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [isDirectGRNModalOpen, setIsDirectGRNModalOpen] = useState(false);
  const [isReceivePOModalOpen, setIsReceivePOModalOpen] = useState(false);
  const [selectedPOForReceive, setSelectedPOForReceive] = useState<PurchaseOrder | null>(null);

  // Add Expense Modal
  const [expensePO, setExpensePO] = useState<PurchaseOrder | null>(null);
  const [expCategory, setExpCategory] = useState('transport');
  const [expDescription, setExpDescription] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPaymentMethod, setExpPaymentMethod] = useState('cash');
  const [expReference, setExpReference] = useState('');
  const [savingExp, setSavingExp] = useState(false);
  const [expError, setExpError] = useState<string | null>(null);

  // Universal GRN Document Drawer State
  const [selectedGRNForDrawer, setSelectedGRNForDrawer] = useState<GoodsReceivedNote | null>(null);
  const [isGRNDrawerOpen, setIsGRNDrawerOpen] = useState(false);
  const [loadingGRNId, setLoadingGRNId] = useState<string | null>(null);

  const handleViewGRNDocument = async (grnIdOrNo: number | string) => {
    setLoadingGRNId(String(grnIdOrNo));
    try {
      const data = await apiFetch<GoodsReceivedNote>(`/api/v1/purchases/grn/${grnIdOrNo}`);
      setSelectedGRNForDrawer(data);
      setIsGRNDrawerOpen(true);
    } catch (e) {
      console.error('Failed to load GRN document details', e);
    } finally {
      setLoadingGRNId(null);
    }
  };

  const loadPrerequisites = async () => {
    try {
      const [suppData, prodData, catData] = await Promise.all([
        apiFetch<Supplier[]>('/api/v1/suppliers/'),
        apiFetch<Product[]>('/api/v1/products/'),
        apiFetch<Category[]>('/api/v1/categories/')
      ]);
      setSuppliers(suppData || []);
      setProducts(prodData || []);
      setCategories(catData || []);
    } catch (e) {
      console.error('Failed to load purchase prerequisites', e);
    }
  };

  useEffect(() => {
    loadPrerequisites();
  }, []);

  // Global Keyboard Shortcuts (F2 -> Create PO, F3 -> Direct GRN)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setIsPOModalOpen(true);
      } else if (e.key === 'F3') {
        e.preventDefault();
        setIsDirectGRNModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const openReceiveModal = (po: PurchaseOrder) => {
    setSelectedPOForReceive(po);
    setIsReceivePOModalOpen(true);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expensePO) return;
    const amt = parseFloat(expAmount);
    if (!amt || amt <= 0) {
      setExpError('Please enter a valid expense amount');
      return;
    }

    setSavingExp(true);
    setExpError(null);
    try {
      await apiFetch(`/api/v1/purchases/orders/${expensePO.id}/expenses`, {
        method: 'POST',
        body: JSON.stringify({
          category: expCategory,
          description: expDescription.trim(),
          amount: amt,
          payment_method: expPaymentMethod,
          reference: expReference.trim() || null
        })
      });
      setExpensePO(null);
      setExpDescription('');
      setExpAmount('');
      setExpReference('');
      reloadOrders();
    } catch (err: any) {
      setExpError(err.message || 'Failed to add expense');
    } finally {
      setSavingExp(false);
    }
  };

  const filteredOrders = orders.filter(po => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      po.po_no.toLowerCase().includes(q) ||
      (po.supplier_name && po.supplier_name.toLowerCase().includes(q))
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="h-3 w-3" /> Received</span>;
      case 'partial':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200"><Clock className="h-3 w-3" /> Partial</span>;
      case 'ordered':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><Clock className="h-3 w-3" /> Ordered</span>;
      case 'cancelled':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"><Ban className="h-3 w-3" /> Cancelled</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
              <ShoppingBag className="h-6 w-6" />
            </div>
            Purchases & Inbound GRN
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Create vendor purchase orders, receive shipments into inventory, and log procurement expenses
          </p>
        </div>

        {/* Dual Primary Actions: Create PO + Direct GRN Receipt */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDirectGRNModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl font-bold shadow-sm transition-all cursor-pointer"
            title="Post incoming vendor goods straight into inventory without a PO (F3)"
          >
            <PackageCheck className="h-4 w-4" />
            <span>Direct GRN Receipt</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 bg-emerald-700/60 rounded font-mono text-[10px] text-emerald-100">
              F3
            </kbd>
          </button>

          <button
            onClick={() => setIsPOModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-xl font-bold shadow-sm transition-all cursor-pointer"
            title="Create a formal vendor Purchase Order (F2)"
          >
            <Plus className="h-4 w-4" />
            <span>Create PO</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 bg-slate-800 rounded font-mono text-[10px] text-slate-300">
              F2
            </kbd>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'orders'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          Purchase Orders
        </button>
        <button
          onClick={() => setActiveTab('grn')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'grn'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <PackageCheck className="h-4 w-4" />
          Goods Received (GRN)
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by PO #, GRN #, or Supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">All Suppliers</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {activeTab === 'orders' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Statuses</option>
              <option value="ordered">Ordered</option>
              <option value="partial">Partial</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          )}
        </div>
      </div>

      {/* Orders View */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden max-h-[calc(100vh-285px)] flex flex-col">
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 shadow-2xs">
                <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">PO Number</th>
                  <th className="py-3.5 px-4">Supplier</th>
                  <th className="py-3.5 px-4">Items / Progress</th>
                  <th className="py-3.5 px-4 text-right">Total Amount</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">ETR</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {ordersLoading && orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-normal">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                        <span>Loading purchase orders...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-normal">
                      No purchase orders found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((po) => {
                    const totalOrdered = po.items.reduce((s, i) => s + Number(i.ordered_qty), 0);
                    const totalRecv = po.items.reduce((s, i) => s + Number(i.received_qty), 0);
                    const expTotal = po.expenses.reduce((s, e) => s + Number(e.amount), 0);

                    return (
                      <tr key={po.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900">{po.po_no}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {new Date(po.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{po.supplier_name || 'Unknown'}</div>
                          {po.expected_delivery_date && (
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              Exp: {po.expected_delivery_date}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-xs text-slate-700">
                            {po.items.length} product lines ({totalRecv}/{totalOrdered} received)
                          </div>
                          {expTotal > 0 && (
                            <div className="text-xs text-amber-700 font-semibold mt-0.5">
                              + KES {expTotal.toLocaleString()} expenses
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                          KES {Number(po.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {getStatusBadge(po.status)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {po.is_etr ? (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-bold font-mono">ETR</span>
                          ) : (
                            <span className="text-slate-400 text-xs">No</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          {po.status !== 'received' && po.status !== 'cancelled' && (
                            <button
                              onClick={() => openReceiveModal(po)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                            >
                              <PackageCheck className="h-3.5 w-3.5" />
                              Receive
                            </button>
                          )}
                          <button
                            onClick={() => setExpensePO(po)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            title="Add Freight / Labour Expense"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            Expense
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}

                {/* Loading More Orders */}
                {ordersLoadingMore && (
                  <tr>
                    <td colSpan={7} className="px-4 py-3 text-center text-indigo-600 bg-indigo-50/40 text-xs font-bold">
                      <div className="flex items-center justify-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                        <span>Loading more purchase orders...</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Sentinel */}
            <div ref={ordersSentinelRef} className="h-4 w-full" />
          </div>

          {!ordersHasMore && orders.length > 0 && (
            <div className="text-center py-2.5 text-[11px] text-slate-400 font-medium border-t border-slate-100 bg-slate-50/50">
              Showing all {orders.length} purchase orders
            </div>
          )}
        </div>
      )}

      {/* GRN View */}
      {activeTab === 'grn' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden max-h-[calc(100vh-285px)] flex flex-col">
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 shadow-2xs">
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">GRN Number</th>
                  <th className="py-3.5 px-4">Supplier / PO</th>
                  <th className="py-3.5 px-4">Delivery Note / Inv</th>
                  <th className="py-3.5 px-4">Items Received</th>
                  <th className="py-3.5 px-4 text-right">Value (KES)</th>
                  <th className="py-3.5 px-4">Received By</th>
                  <th className="py-3.5 px-4 text-center">Document</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {grnsLoading && grns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-normal">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                        <span>Loading goods received notes...</span>
                      </div>
                    </td>
                  </tr>
                ) : grns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-normal">
                      No Goods Received Notes on record.
                    </td>
                  </tr>
                ) : (
                  grns.map((g) => (
                    <tr
                      key={g.id}
                      onClick={() => handleViewGRNDocument(g.id)}
                      className="hover:bg-amber-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-1.5 text-slate-900 group-hover:text-amber-700 underline decoration-transparent group-hover:decoration-amber-400 underline-offset-2 transition-colors">
                          <Truck className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-600" />
                          <span>{g.grn_no}</span>
                        </div>
                        <div className="text-xs text-slate-400 font-normal mt-0.5">
                          {new Date(g.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{g.supplier_name || 'Direct / Cash Vendor'}</div>
                        {g.po_no && (
                          <div className="text-xs text-indigo-600 font-mono mt-0.5">
                            Ref: {g.po_no}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                        {g.invoice_number || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-700">
                        {g.items.map(it => (
                          <div key={it.id} className="truncate max-w-xs">
                            • {it.product_name} ({it.quantity_received} {it.unit_type === 'roll' ? 'm' : (it.unit || 'pcs')})
                          </div>
                        ))}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        KES {Number(g.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {g.receiver_name || 'Staff'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewGRNDocument(g.id);
                          }}
                          disabled={loadingGRNId === String(g.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                          title="View Delivery GRN Slip"
                        >
                          {loadingGRNId === String(g.id) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-700" />
                          ) : (
                            <Eye className="h-3.5 w-3.5 text-amber-700" />
                          )}
                          <span>View Doc</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}

                {/* Loading More GRNs */}
                {grnsLoadingMore && (
                  <tr>
                    <td colSpan={7} className="px-4 py-3 text-center text-indigo-600 bg-indigo-50/40 text-xs font-bold">
                      <div className="flex items-center justify-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                        <span>Loading more GRNs...</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Sentinel */}
            <div ref={grnsSentinelRef} className="h-4 w-full" />

            {!grnsHasMore && grns.length > 0 && (
              <div className="text-center py-2.5 text-[11px] text-slate-400 font-medium border-t border-slate-100 bg-slate-50/50">
                Showing all {grns.length} Goods Received Notes
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upgraded Create PO Modal with RapidItemGrid */}
      <CreatePOModal
        isOpen={isPOModalOpen}
        onClose={() => setIsPOModalOpen(false)}
        products={products}
        suppliers={suppliers}
        categories={categories}
        onPOCreated={() => {
          reloadOrders();
          loadPrerequisites();
        }}
        onRefreshData={loadPrerequisites}
      />

      {/* Dedicated Direct GRN Receipt Modal ("Straight into posting GRN") */}
      <DirectGRNModal
        isOpen={isDirectGRNModalOpen}
        onClose={() => setIsDirectGRNModalOpen(false)}
        products={products}
        suppliers={suppliers}
        categories={categories}
        onGRNPosted={(newGRN) => {
          reloadGRNs();
          reloadOrders();
          loadPrerequisites();
          handleViewGRNDocument(newGRN.id);
        }}
        onRefreshData={loadPrerequisites}
      />

      {/* Streamlined Receive Goods Against Existing PO Modal */}
      <ReceivePOModal
        isOpen={isReceivePOModalOpen}
        onClose={() => {
          setIsReceivePOModalOpen(false);
          setSelectedPOForReceive(null);
        }}
        purchaseOrder={selectedPOForReceive}
        products={products}
        onGRNPosted={(newGRN) => {
          reloadGRNs();
          reloadOrders();
          loadPrerequisites();
          handleViewGRNDocument(newGRN.id);
        }}
      />

      {/* Add Expense Modal */}
      {expensePO && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Banknote className="h-5 w-5 text-amber-600" />
                Add Purchase Expense
              </h3>
              <button onClick={() => setExpensePO(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-xs">
              <div className="text-slate-500">PO Reference:</div>
              <div className="font-bold text-slate-900 font-mono">{expensePO.po_no}</div>
            </div>

            {expError && (
              <div className="mb-4 p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 font-medium">
                {expError}
              </div>
            )}

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Expense Category
                </label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="transport">Transport / Freight</option>
                  <option value="labour">Offloading Labour</option>
                  <option value="customs">Customs / Border Clearance</option>
                  <option value="loading">Loading / Handling</option>
                  <option value="other">Other Incidental</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lorry freight from Mombasa depot"
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Amount (KES) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Paid Via
                  </label>
                  <select
                    value={expPaymentMethod}
                    onChange={(e) => setExpPaymentMethod(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="cash">Cash Tender</option>
                    <option value="mpesa">M-Pesa</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Reference / Receipt #
                  </label>
                  <input
                    type="text"
                    placeholder="Ref #"
                    value={expReference}
                    onChange={(e) => setExpReference(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setExpensePO(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingExp}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {savingExp ? 'Saving...' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Universal Goods Received Note (GRN) Document Viewer Drawer */}
      <GRNDocumentDrawer
        grn={selectedGRNForDrawer}
        isOpen={isGRNDrawerOpen}
        onClose={() => {
          setIsGRNDrawerOpen(false);
          setSelectedGRNForDrawer(null);
        }}
      />
    </div>
  );
};
