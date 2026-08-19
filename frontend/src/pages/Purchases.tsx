import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import type { PurchaseOrder, GoodsReceivedNote, Supplier, Product } from '../types';
import {
  ShoppingBag,
  Plus,
  Search,
  PackageCheck,
  DollarSign,
  Calendar,
  X,
  Trash2,
  CheckCircle2,
  Clock,
  Ban
} from 'lucide-react';

export const PurchasesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'grn'>('orders');
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [grns, setGrns] = useState<GoodsReceivedNote[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create PO Modal
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [poSupplierId, setPOSupplierId] = useState<number | ''>('');
  const [poExpectedDate, setPOExpectedDate] = useState('');
  const [poIsEtr, setPOIsEtr] = useState(false);
  const [poNotes, setPONotes] = useState('');
  const [poItems, setPOItems] = useState<Array<{ product_id: number; unit_type: 'piece' | 'roll'; ordered_qty: number; unit_cost: number }>>([]);
  const [savingPO, setSavingPO] = useState(false);
  const [poError, setPOError] = useState<string | null>(null);

  // Receive Goods (GRN) Modal
  const [isGRNModalOpen, setIsGRNModalOpen] = useState(false);
  const [selectedPOForGRN, setSelectedPOForGRN] = useState<PurchaseOrder | null>(null);
  const [grnSupplierId, setGRNSupplierId] = useState<number | ''>('');
  const [grnInvoiceNo, setGRNInvoiceNo] = useState('');
  const [grnNotes, setGRNNotes] = useState('');
  const [grnItems, setGRNItems] = useState<Array<{
    product_id: number;
    unit_type: 'piece' | 'roll';
    quantity_received: number;
    rolls_received: number;
    loose_meters_received: number;
    unit_cost: number;
  }>>([]);
  const [savingGRN, setSavingGRN] = useState(false);
  const [grnError, setGRNError] = useState<string | null>(null);

  // Add Expense Modal
  const [expensePO, setExpensePO] = useState<PurchaseOrder | null>(null);
  const [expCategory, setExpCategory] = useState('transport');
  const [expDescription, setExpDescription] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPaymentMethod, setExpPaymentMethod] = useState('cash');
  const [expReference, setExpReference] = useState('');
  const [savingExp, setSavingExp] = useState(false);
  const [expError, setExpError] = useState<string | null>(null);

  useEffect(() => {
    loadPrerequisites();
  }, []);

  useEffect(() => {
    if (activeTab === 'orders') {
      loadOrders();
    } else {
      loadGRNs();
    }
  }, [activeTab, statusFilter, supplierFilter]);

  const loadPrerequisites = async () => {
    try {
      const [suppData, prodData] = await Promise.all([
        apiFetch<Supplier[]>('/api/v1/suppliers/'),
        apiFetch<Product[]>('/api/v1/products/')
      ]);
      setSuppliers(suppData);
      setProducts(prodData);
    } catch (e) {
      console.error(e);
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      let url = '/api/v1/purchases/orders?limit=100';
      if (statusFilter !== 'all') url += `&status_filter=${statusFilter}`;
      if (supplierFilter !== 'all') url += `&supplier_id=${supplierFilter}`;
      const data = await apiFetch<PurchaseOrder[]>(url);
      setOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadGRNs = async () => {
    setLoading(true);
    try {
      let url = '/api/v1/purchases/grn?limit=100';
      if (supplierFilter !== 'all') url += `&supplier_id=${supplierFilter}`;
      const data = await apiFetch<GoodsReceivedNote[]>(url);
      setGrns(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPOItem = () => {
    if (products.length === 0) return;
    const firstProd = products[0];
    setPOItems([
      ...poItems,
      {
        product_id: firstProd.id,
        unit_type: firstProd.unit_type,
        ordered_qty: 1,
        unit_cost: firstProd.cost_price
      }
    ]);
  };

  const handleRemovePOItem = (index: number) => {
    setPOItems(poItems.filter((_, i) => i !== index));
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poSupplierId) {
      setPOError('Please select a supplier');
      return;
    }
    if (poItems.length === 0) {
      setPOError('Please add at least one line item');
      return;
    }

    setSavingPO(true);
    setPOError(null);
    try {
      await apiFetch('/api/v1/purchases/orders', {
        method: 'POST',
        body: JSON.stringify({
          supplier_id: Number(poSupplierId),
          expected_delivery_date: poExpectedDate || null,
          is_etr: poIsEtr,
          notes: poNotes.trim() || null,
          items: poItems.map(it => ({
            product_id: it.product_id,
            unit_type: it.unit_type,
            ordered_qty: Number(it.ordered_qty),
            unit_cost: Number(it.unit_cost)
          }))
        })
      });
      setIsPOModalOpen(false);
      setPOSupplierId('');
      setPOExpectedDate('');
      setPOIsEtr(false);
      setPONotes('');
      setPOItems([]);
      loadOrders();
    } catch (err: any) {
      setPOError(err.message || 'Failed to create purchase order');
    } finally {
      setSavingPO(false);
    }
  };

  const openReceiveModal = (po: PurchaseOrder) => {
    setSelectedPOForGRN(po);
    setGRNSupplierId(po.supplier_id);
    setGRNInvoiceNo('');
    setGRNNotes('');

    // Pre-populate with pending unreceived quantities
    const items = po.items.map(it => {
      const pendingQty = Math.max(0, Number(it.ordered_qty) - Number(it.received_qty));
      const prod = products.find(p => p.id === it.product_id);
      const isRoll = it.unit_type === 'roll' && prod?.meters_per_roll;
      const rolls = isRoll ? Math.floor(pendingQty / (prod?.meters_per_roll || 100)) : 0;
      const loose = isRoll ? pendingQty % (prod?.meters_per_roll || 100) : 0;

      return {
        product_id: it.product_id,
        unit_type: it.unit_type,
        quantity_received: pendingQty,
        rolls_received: rolls,
        loose_meters_received: loose,
        unit_cost: Number(it.unit_cost)
      };
    });

    setGRNItems(items);
    setIsGRNModalOpen(true);
  };

  const handleReceiveGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (grnItems.length === 0) {
      setGRNError('No items to receive');
      return;
    }

    setSavingGRN(true);
    setGRNError(null);
    try {
      await apiFetch('/api/v1/purchases/grn', {
        method: 'POST',
        body: JSON.stringify({
          po_id: selectedPOForGRN ? selectedPOForGRN.id : null,
          supplier_id: grnSupplierId ? Number(grnSupplierId) : null,
          invoice_number: grnInvoiceNo.trim() || null,
          notes: grnNotes.trim() || null,
          items: grnItems.map(it => ({
            product_id: it.product_id,
            unit_type: it.unit_type,
            quantity_received: Number(it.quantity_received),
            rolls_received: Number(it.rolls_received || 0),
            loose_meters_received: Number(it.loose_meters_received || 0),
            unit_cost: Number(it.unit_cost)
          }))
        })
      });
      setIsGRNModalOpen(false);
      setSelectedPOForGRN(null);
      setGRNItems([]);
      if (activeTab === 'orders') loadOrders();
      else loadGRNs();
      loadPrerequisites();
    } catch (err: any) {
      setGRNError(err.message || 'Failed to process goods receipt');
    } finally {
      setSavingGRN(false);
    }
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
      loadOrders();
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsPOModalOpen(true);
              if (poItems.length === 0 && products.length > 0) {
                setPOItems([{
                  product_id: products[0].id,
                  unit_type: products[0].unit_type,
                  ordered_qty: 1,
                  unit_cost: products[0].cost_price
                }]);
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow-sm transition-all duration-150 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Create Purchase Order
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
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
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
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
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
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
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-normal">
                      Loading purchase orders...
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
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                            >
                              <PackageCheck className="h-3.5 w-3.5" />
                              Receive
                            </button>
                          )}
                          <button
                            onClick={() => setExpensePO(po)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                            title="Add Freight / Labour Expense"
                          >
                            <DollarSign className="h-3.5 w-3.5" />
                            Expense
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
      )}

      {/* GRN View */}
      {activeTab === 'grn' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">GRN Number</th>
                  <th className="py-3.5 px-4">Supplier / PO</th>
                  <th className="py-3.5 px-4">Delivery Note / Inv</th>
                  <th className="py-3.5 px-4">Items Received</th>
                  <th className="py-3.5 px-4 text-right">Value (KES)</th>
                  <th className="py-3.5 px-4">Received By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-normal">
                      Loading goods received notes...
                    </td>
                  </tr>
                ) : grns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-normal">
                      No Goods Received Notes on record.
                    </td>
                  </tr>
                ) : (
                  grns.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {g.grn_no}
                        <div className="text-xs text-slate-400 font-normal mt-0.5">
                          {new Date(g.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{g.supplier_name || 'Direct Receive'}</div>
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
                            • {it.product_name} ({it.quantity_received} {it.unit_type === 'roll' ? 'm' : 'units'})
                          </div>
                        ))}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        KES {Number(g.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {g.receiver_name || 'Staff'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create PO Modal */}
      {isPOModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-indigo-600" />
                Create Purchase Order
              </h3>
              <button onClick={() => setIsPOModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            {poError && (
              <div className="my-3 p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 font-medium">
                {poError}
              </div>
            )}

            <form onSubmit={handleCreatePO} className="flex-1 overflow-y-auto py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Supplier *
                  </label>
                  <select
                    required
                    value={poSupplierId}
                    onChange={(e) => setPOSupplierId(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={poExpectedDate}
                    onChange={(e) => setPOExpectedDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="flex items-end pb-1.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={poIsEtr}
                      onChange={(e) => setPOIsEtr(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="text-xs font-bold uppercase text-slate-700">ETR Purchase Order</span>
                  </label>
                </div>
              </div>

              {/* Items Section */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Line Items</span>
                  <button
                    type="button"
                    onClick={handleAddPOItem}
                    className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Item
                  </button>
                </div>

                {poItems.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-3 rounded-xl border border-slate-200">
                    <div className="col-span-5">
                      <select
                        value={it.product_id}
                        onChange={(e) => {
                          const pId = Number(e.target.value);
                          const prod = products.find(p => p.id === pId);
                          const updated = [...poItems];
                          updated[idx].product_id = pId;
                          if (prod) {
                            updated[idx].unit_type = prod.unit_type;
                            updated[idx].unit_cost = prod.cost_price;
                          }
                          setPOItems(updated);
                        }}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.unit_type === 'roll' ? 'Roll' : 'Piece'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        placeholder="Quantity"
                        value={it.ordered_qty}
                        onChange={(e) => {
                          const updated = [...poItems];
                          updated[idx].ordered_qty = parseFloat(e.target.value) || 0;
                          setPOItems(updated);
                        }}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                      />
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Unit Cost"
                        value={it.unit_cost}
                        onChange={(e) => {
                          const updated = [...poItems];
                          updated[idx].unit_cost = parseFloat(e.target.value) || 0;
                          setPOItems(updated);
                        }}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                      />
                    </div>

                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemovePOItem(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Procurement Notes / Instructions
                </label>
                <textarea
                  rows={2}
                  value={poNotes}
                  onChange={(e) => setPONotes(e.target.value)}
                  placeholder="e.g. Free delivery to Industrial Area warehouse"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <div className="text-sm font-bold text-slate-700">
                  Total PO: <span className="font-mono text-indigo-700">KES {poItems.reduce((s, i) => s + (i.ordered_qty * i.unit_cost), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPOModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPO}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                  >
                    {savingPO ? 'Creating...' : 'Create Purchase Order'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Goods (GRN) Modal */}
      {isGRNModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-emerald-600" />
                Receive Goods into Inventory (GRN)
              </h3>
              <button onClick={() => setIsGRNModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            {grnError && (
              <div className="my-3 p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 font-medium">
                {grnError}
              </div>
            )}

            <form onSubmit={handleReceiveGRN} className="flex-1 overflow-y-auto py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Supplier Delivery Note / Invoice #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DN-99120 or INV-4412"
                    value={grnInvoiceNo}
                    onChange={(e) => setGRNInvoiceNo(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Receiving Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Inspected and verified in good condition"
                    value={grnNotes}
                    onChange={(e) => setGRNNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Items to Receive</span>

                {grnItems.map((it, idx) => {
                  const prod = products.find(p => p.id === it.product_id);
                  const isRoll = it.unit_type === 'roll';

                  return (
                    <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                      <div className="font-bold text-slate-900 text-sm">{prod?.name || 'Product'}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                            {isRoll ? 'Total Meters Received' : 'Pieces Received'}
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={it.quantity_received}
                            onChange={(e) => {
                              const updated = [...grnItems];
                              const val = parseFloat(e.target.value) || 0;
                              updated[idx].quantity_received = val;
                              if (isRoll && prod?.meters_per_roll) {
                                updated[idx].rolls_received = Math.floor(val / prod.meters_per_roll);
                                updated[idx].loose_meters_received = val % prod.meters_per_roll;
                              }
                              setGRNItems(updated);
                            }}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                            Cost per Unit (KES)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={it.unit_cost}
                            onChange={(e) => {
                              const updated = [...grnItems];
                              updated[idx].unit_cost = parseFloat(e.target.value) || 0;
                              setGRNItems(updated);
                            }}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                          />
                        </div>
                        <div className="flex items-end justify-end font-mono font-bold text-sm text-slate-900 pb-1.5">
                          KES {(it.quantity_received * it.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <div className="text-sm font-bold text-slate-700">
                  Total Inbound Stock: <span className="font-mono text-emerald-700">KES {grnItems.reduce((s, i) => s + (i.quantity_received * i.unit_cost), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsGRNModalOpen(false)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingGRN}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                  >
                    {savingGRN ? 'Processing GRN...' : 'Accept & Add to Inventory'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {expensePO && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-amber-600" />
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
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingExp}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {savingExp ? 'Saving...' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
