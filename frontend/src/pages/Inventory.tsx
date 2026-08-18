import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import type { InventoryItem, StockMovement } from '../types';
import { 
  Boxes, 
  Search, 
  AlertTriangle, 
  ArrowDownUp, 
  History, 
  RefreshCw,
  Download,
  Truck,
  Check
} from 'lucide-react';

interface GRNLineItem {
  product_id: number;
  product_name: string;
  sku: string | null;
  unit: string;
  unit_type: 'piece' | 'roll';
  meters_per_roll: number | null;
  rolls: string;
  loose: string;
  qty: string;
  unit_cost: string;
  note: string;
}

export const InventoryPage: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'levels' | 'history'>('levels');

  // Adjustment Modal
  const [adjustModalItem, setAdjustModalItem] = useState<InventoryItem | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Multi-Product GRN Batch Modal State
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [grnReferenceId, setGrnReferenceId] = useState('');
  const [grnSupplierName, setGrnSupplierName] = useState('');
  const [grnGeneralNote, setGrnGeneralNote] = useState('');
  const [grnLines, setGrnLines] = useState<GRNLineItem[]>([]);
  const [productSearchToAdd, setProductSearchToAdd] = useState('');
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [submittingGRN, setSubmittingGRN] = useState(false);

  const [movementProductFilter, setMovementProductFilter] = useState<number | 'all'>('all');

  useEffect(() => {
    loadInventory();
    if (activeTab === 'history') {
      loadMovements();
    }
  }, [lowStockOnly, activeTab, movementProductFilter]);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<InventoryItem[]>(`/api/v1/inventory/?low_stock_only=${lowStockOnly}`);
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadMovements = async () => {
    try {
      let url = '/api/v1/inventory/movements?limit=200';
      if (movementProductFilter !== 'all') {
        url += `&product_id=${movementProductFilter}`;
      }
      const data = await apiFetch<StockMovement[]>(url);
      setMovements(data);
    } catch (e) {
      console.error(e);
    }
  };

  const exportMovementsCSV = () => {
    if (movements.length === 0) return;
    const headers = ['ID', 'Date', 'Product ID', 'Type', 'Quantity', 'Unit', 'Prev Balance', 'New Balance', 'Reference', 'Note'];
    const rows = movements.map(m => [
      m.id,
      new Date(m.created_at).toLocaleString(),
      m.product_id,
      m.type,
      m.quantity,
      m.unit_sold || 'pcs',
      m.previous_quantity,
      m.new_quantity,
      `"${(m.reference_id || '').replace(/"/g, '""')}"`,
      `"${(m.note || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `stock_movements_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalItem) return;
    setAdjustError(null);

    const qty = parseFloat(adjustQuantity);
    if (isNaN(qty) || qty <= 0) {
      setAdjustError('Please enter a valid positive quantity');
      return;
    }

    const delta = adjustType === 'subtract' ? -qty : qty;

    try {
      await apiFetch('/api/v1/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          product_id: adjustModalItem.product_id,
          adjusted_quantity: delta,
          note: adjustNote || (adjustType === 'add' ? 'Manual stock count add' : 'Manual stock reduction'),
        }),
      });
      setAdjustModalItem(null);
      setAdjustQuantity('');
      setAdjustNote('');
      loadInventory();
    } catch (err: any) {
      setAdjustError(err.message || 'Failed to adjust stock');
    }
  };

  const handleOpenGRNModal = (initialProdId?: number) => {
    setGrnReferenceId('');
    setGrnSupplierName('');
    setGrnGeneralNote('');
    setReceiveError(null);
    setProductSearchToAdd('');

    if (initialProdId) {
      const p = items.find(i => i.product_id === initialProdId);
      if (p) {
        setGrnLines([{
          product_id: p.product_id,
          product_name: p.product_name,
          sku: p.sku,
          unit: p.unit,
          unit_type: p.unit_type,
          meters_per_roll: p.meters_per_roll,
          rolls: '',
          loose: '',
          qty: '',
          unit_cost: String(p.cost_price || ''),
          note: ''
        }]);
      } else {
        setGrnLines([]);
      }
    } else {
      setGrnLines([]);
    }
    setIsReceiveModalOpen(true);
  };

  const handleAddProductToGRN = (productId: number) => {
    const p = items.find(i => i.product_id === productId);
    if (!p) return;

    if (grnLines.some(l => l.product_id === productId)) {
      setReceiveError(`Product '${p.product_name}' is already in this GRN.`);
      return;
    }
    setReceiveError(null);

    setGrnLines(prev => [
      ...prev,
      {
        product_id: p.product_id,
        product_name: p.product_name,
        sku: p.sku,
        unit: p.unit,
        unit_type: p.unit_type,
        meters_per_roll: p.meters_per_roll,
        rolls: '',
        loose: '',
        qty: '',
        unit_cost: String(p.cost_price || ''),
        note: ''
      }
    ]);
    setProductSearchToAdd('');
  };

  const handleRemoveGRNLine = (productId: number) => {
    setGrnLines(prev => prev.filter(l => l.product_id !== productId));
  };

  const handleUpdateGRNLine = (productId: number, field: keyof GRNLineItem, val: string) => {
    setGrnLines(prev => prev.map(l => l.product_id === productId ? { ...l, [field]: val } : l));
  };

  const calculateLineQuantity = (line: GRNLineItem): number => {
    if (line.unit_type === 'roll') {
      const rolls = parseInt(line.rolls || '0', 10) || 0;
      const loose = parseFloat(line.loose || '0') || 0;
      const mpr = Number(line.meters_per_roll) || 100;
      return (rolls * mpr) + loose;
    }
    return parseFloat(line.qty || '0') || 0;
  };

  const calculateTotalGRNValue = (): number => {
    return grnLines.reduce((acc, line) => {
      const q = calculateLineQuantity(line);
      const cost = parseFloat(line.unit_cost || '0') || 0;
      if (line.unit_type === 'roll') {
        const mpr = Number(line.meters_per_roll) || 100;
        const rollFrac = q / mpr;
        return acc + (rollFrac * cost);
      }
      return acc + (q * cost);
    }, 0);
  };

  const handleBatchGRNSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (grnLines.length === 0) {
      setReceiveError('Please add at least one product to the Goods Received Note');
      return;
    }

    setReceiveError(null);
    setSubmittingGRN(true);

    const payloadItems = [];
    for (const line of grnLines) {
      const q = calculateLineQuantity(line);
      if (q <= 0) {
        setReceiveError(`Please specify a valid quantity received for '${line.product_name}'`);
        setSubmittingGRN(false);
        return;
      }

      const itemPayload: any = {
        product_id: line.product_id,
        note: line.note.trim() || undefined,
        unit_cost: line.unit_cost ? parseFloat(line.unit_cost) : undefined,
      };

      if (line.unit_type === 'roll') {
        itemPayload.rolls_received = line.rolls ? parseInt(line.rolls, 10) : 0;
        itemPayload.loose_meters_received = line.loose ? parseFloat(line.loose) : 0;
      } else {
        itemPayload.quantity = parseFloat(line.qty);
      }

      payloadItems.push(itemPayload);
    }

    try {
      await apiFetch('/api/v1/inventory/receive-batch', {
        method: 'POST',
        body: JSON.stringify({
          reference_id: grnReferenceId.trim() || undefined,
          supplier_name: grnSupplierName.trim() || undefined,
          note: grnGeneralNote.trim() || undefined,
          items: payloadItems,
        }),
      });

      setIsReceiveModalOpen(false);
      loadInventory();
      if (activeTab === 'history') loadMovements();
    } catch (err: any) {
      setReceiveError(err.message || 'Failed to post Goods Received Note');
    } finally {
      setSubmittingGRN(false);
    }
  };

  const filteredItems = items.filter(i => 
    i.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.sku && i.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Boxes className="h-5 w-5 text-amber-600" />
            <span>Inventory Tracking & Roll Balances</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor real-time physical quantities, roll breakdowns, and audit movements
          </p>
        </div>

        {/* Actions & Tab Toggle */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => handleOpenGRNModal()}
            className="flex items-center space-x-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-600 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <Truck className="h-4 w-4" />
            <span>Post Goods Received Note (GRN)</span>
          </button>

          <div className="flex space-x-1 rounded-lg bg-slate-200/70 p-1">
            <button
              onClick={() => setActiveTab('levels')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'levels'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownUp className="h-3.5 w-3.5" />
              <span>Levels</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Audit</span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'levels' ? (
        <>
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by product name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600 bg-slate-50/50"
              />
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setLowStockOnly(!lowStockOnly)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  lowStockOnly
                    ? 'bg-rose-50 border-rose-200 text-rose-700 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                <span>Low Stock Only</span>
              </button>

              <button
                onClick={loadInventory}
                disabled={loading}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
                title="Refresh Inventory"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Stock Table */}
          <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Current Physical Stock</th>
                    <th className="px-4 py-3">Cost (BP)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-amber-600" />
                        Loading stock levels...
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No inventory records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item.product_id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {item.product_name}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                          {item.sku || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              item.unit_type === 'roll'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {item.unit_type === 'roll' ? `Roll (${item.meters_per_roll}m)` : 'Piece'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {item.unit_type === 'roll' ? (
                            <div>
                              <span className="font-bold text-slate-900 font-mono">
                                {item.formatted_stock}
                              </span>
                            </div>
                          ) : (
                            <span className="font-bold text-slate-900 font-mono">
                              {item.quantity} {item.unit}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          KES {Number(item.cost_price).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          {item.is_low_stock ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle className="h-3 w-3 text-rose-600" />
                              <span>Low Stock (≤{item.reorder_level})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Adequate
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleOpenGRNModal(item.product_id)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold text-[11px] cursor-pointer"
                              title="Receive stock delivery for this product"
                            >
                              <Truck className="h-3 w-3" />
                              <span>Receive</span>
                            </button>
                            <button
                              onClick={() => {
                                setAdjustModalItem(item);
                                setAdjustQuantity('');
                                setAdjustType('add');
                                setAdjustNote('');
                                setAdjustError(null);
                              }}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer"
                            >
                              <ArrowDownUp className="h-3 w-3" />
                              <span>Adjust</span>
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
        </>
      ) : (
        /* Movement Audit View */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-3">
              <label className="text-xs font-bold text-slate-700">Filter by Product:</label>
              <select
                value={movementProductFilter}
                onChange={(e) => setMovementProductFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600 bg-slate-50/50"
              >
                <option value="all">All Products</option>
                {items.map((i) => (
                  <option key={i.product_id} value={i.product_id}>
                    {i.product_name} {i.sku ? `(${i.sku})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={exportMovementsCSV}
                disabled={movements.length === 0}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={loadMovements}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
                title="Refresh Movements"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Product ID</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Delta / Quantity</th>
                    <th className="px-4 py-3">Previous Balance</th>
                    <th className="px-4 py-3">New Balance</th>
                    <th className="px-4 py-3">Reference / Order</th>
                    <th className="px-4 py-3">Audit Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        No audit movements recorded.
                      </td>
                    </tr>
                  ) : (
                    movements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                          {new Date(m.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          #{m.product_id}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              m.type === 'in'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : m.type === 'sale'
                                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                : m.type === 'adjust'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : m.type === 'stock_take'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {m.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold">
                          {Number(m.quantity) > 0 ? `+${m.quantity}` : m.quantity} {m.unit_sold}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">
                          {m.previous_quantity}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {m.new_quantity}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                          {m.reference_id || '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {m.note || '—'}
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

      {/* Manual Stock Adjustment Modal */}
      {adjustModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <ArrowDownUp className="h-5 w-5 text-amber-600" />
                <span>Adjust Stock: {adjustModalItem.product_name}</span>
              </h3>
              <button
                onClick={() => setAdjustModalItem(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1 text-slate-600 border border-slate-100">
              <p>Current Balance: <span className="font-mono font-bold text-slate-900">{adjustModalItem.formatted_stock}</span></p>
              <p>Unit Type: <span className="font-semibold capitalize">{adjustModalItem.unit_type}</span></p>
            </div>

            {adjustError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                {adjustError}
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-3.5">
              <div className="flex rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setAdjustType('add')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    adjustType === 'add' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  + Add Stock
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('subtract')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    adjustType === 'subtract' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  - Subtract Stock
                </button>
              </div>

              {adjustModalItem.unit_type === 'roll' ? (
                <div className="space-y-2">
                  <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-2.5 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-sky-900">
                      Roll Calculator ({adjustModalItem.meters_per_roll}m per roll)
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Full Rolls</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          id="calc-rolls"
                          onChange={(e) => {
                            const rolls = parseFloat(e.target.value) || 0;
                            const looseInput = document.getElementById('calc-loose') as HTMLInputElement;
                            const loose = parseFloat(looseInput?.value) || 0;
                            const mpr = Number(adjustModalItem.meters_per_roll) || 100;
                            setAdjustQuantity(String((rolls * mpr) + loose));
                          }}
                          className="w-full rounded-lg bg-white border border-sky-300 px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-sky-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Loose Meters</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="0.0"
                          id="calc-loose"
                          onChange={(e) => {
                            const loose = parseFloat(e.target.value) || 0;
                            const rollsInput = document.getElementById('calc-rolls') as HTMLInputElement;
                            const rolls = parseFloat(rollsInput?.value) || 0;
                            const mpr = Number(adjustModalItem.meters_per_roll) || 100;
                            setAdjustQuantity(String((rolls * mpr) + loose));
                          }}
                          className="w-full rounded-lg bg-white border border-sky-300 px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-sky-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                      Total Meters to Adjust
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 150.0"
                      value={adjustQuantity}
                      onChange={(e) => setAdjustQuantity(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-600 font-mono font-bold"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Quantity ({adjustModalItem.unit})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 5"
                    value={adjustQuantity}
                    onChange={(e) => setAdjustQuantity(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-600 font-mono font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                  Reason Note <span className="text-slate-400 font-normal text-[10px] lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Broken packaging, Found inventory (optional)"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustModalItem(null)}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-500 shadow-xs cursor-pointer"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Multi-Product Goods Received Note (GRN) Batch Modal */}
      {isReceiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Truck className="h-5 w-5 text-emerald-600" />
                  <span>Goods Received Note (GRN) — Multi-Product Delivery</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Receive full supplier consignments, enter delivery notes, and post multi-item stock in one batch.
                </p>
              </div>
              <button
                onClick={() => setIsReceiveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {receiveError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 font-medium">
                {receiveError}
              </div>
            )}

            <form onSubmit={handleBatchGRNSubmit} className="space-y-4">
              {/* Header Details (Supplier & Reference) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Supplier / Vendor Name <span className="text-slate-400 font-normal text-[10px] lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SolarMax Kenya Ltd"
                    value={grnSupplierName}
                    onChange={(e) => setGrnSupplierName(e.target.value)}
                    className="w-full rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Delivery Note / Invoice / PO # <span className="text-slate-400 font-normal text-[10px] lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DN-2026-8819"
                    value={grnReferenceId}
                    onChange={(e) => setGrnReferenceId(e.target.value)}
                    className="w-full rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Delivery Remarks <span className="text-slate-400 font-normal text-[10px] lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Morning truck, Batch #3"
                    value={grnGeneralNote}
                    onChange={(e) => setGrnGeneralNote(e.target.value)}
                    className="w-full rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Add Product Search Bar */}
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3">
                <label className="block text-xs font-bold text-emerald-950 mb-1.5">
                  + Add Products to Delivery Consignment
                </label>
                <div className="flex gap-2">
                  <select
                    value={productSearchToAdd}
                    onChange={(e) => {
                      const pid = Number(e.target.value);
                      if (pid) handleAddProductToGRN(pid);
                    }}
                    className="flex-1 rounded-lg bg-white border border-emerald-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="">-- Search and Select Product to Add --</option>
                    {items.map((i) => (
                      <option key={i.product_id} value={i.product_id}>
                        {i.product_name} {i.sku ? `(${i.sku})` : ''} — Current Stock: {i.formatted_stock}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Multi-Line Items Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="px-3 py-2.5">Delivered Product</th>
                        <th className="px-3 py-2.5 w-60">Received Quantity</th>
                        <th className="px-3 py-2.5 w-32">Unit Cost (BP)</th>
                        <th className="px-3 py-2.5 w-28 text-right">Line Total</th>
                        <th className="px-3 py-2.5 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {grnLines.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                            No products added to this delivery note yet. Use the dropdown above to add products.
                          </td>
                        </tr>
                      ) : (
                        grnLines.map((line) => {
                          const totalQty = calculateLineQuantity(line);
                          const cost = parseFloat(line.unit_cost || '0') || 0;
                          let lineTotal = 0;
                          if (line.unit_type === 'roll') {
                            const mpr = Number(line.meters_per_roll) || 100;
                            lineTotal = (totalQty / mpr) * cost;
                          } else {
                            lineTotal = totalQty * cost;
                          }

                          return (
                            <tr key={line.product_id} className="hover:bg-slate-50/40">
                              <td className="px-3 py-2.5">
                                <div className="font-bold text-slate-900">{line.product_name}</div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {line.sku ? `SKU: ${line.sku} | ` : ''}
                                  {line.unit_type === 'roll' ? `Roll (${line.meters_per_roll}m)` : `Piece (${line.unit})`}
                                </div>
                              </td>

                              <td className="px-3 py-2.5">
                                {line.unit_type === 'roll' ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center space-x-1.5">
                                      <input
                                        type="number"
                                        min="0"
                                        placeholder="Rolls"
                                        value={line.rolls}
                                        onChange={(e) => handleUpdateGRNLine(line.product_id, 'rolls', e.target.value)}
                                        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-600 text-center"
                                        title="Number of full rolls"
                                      />
                                      <span className="text-[11px] text-slate-400 font-bold">+</span>
                                      <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        placeholder="Loose m"
                                        value={line.loose}
                                        onChange={(e) => handleUpdateGRNLine(line.product_id, 'loose', e.target.value)}
                                        className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-600 text-center"
                                        title="Loose meters"
                                      />
                                    </div>
                                    <div className="text-[10px] text-sky-700 font-bold font-mono">
                                      = {totalQty.toFixed(1)}m total
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-1.5">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      placeholder="Qty"
                                      value={line.qty}
                                      onChange={(e) => handleUpdateGRNLine(line.product_id, 'qty', e.target.value)}
                                      className="w-28 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-600 font-bold"
                                    />
                                    <span className="text-[11px] text-slate-500 font-medium">{line.unit}</span>
                                  </div>
                                )}
                              </td>

                              <td className="px-3 py-2.5">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="Buying BP"
                                  value={line.unit_cost}
                                  onChange={(e) => handleUpdateGRNLine(line.product_id, 'unit_cost', e.target.value)}
                                  className="w-28 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-600"
                                />
                              </td>

                              <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                                KES {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>

                              <td className="px-3 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveGRNLine(line.product_id)}
                                  className="text-slate-400 hover:text-rose-600 font-bold text-xs cursor-pointer p-1"
                                  title="Remove item from GRN"
                                >
                                  ✕
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

              {/* Total Summary Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-900 text-white p-3.5 rounded-xl gap-3">
                <div className="flex items-center space-x-6 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Lines</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">{grnLines.length} products</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Delivery Value</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      KES {calculateTotalGRNValue().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setIsReceiveModalOpen(false)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingGRN || grnLines.length === 0}
                    className="flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-md cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                  >
                    <Check className="h-4 w-4" />
                    <span>{submittingGRN ? 'Posting GRN...' : 'Post Goods Received Note (GRN)'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
