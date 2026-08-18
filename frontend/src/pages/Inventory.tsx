import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import type { InventoryItem, StockMovement } from '../types';
import { 
  Boxes, 
  Search, 
  AlertTriangle, 
  ArrowDownUp, 
  History, 
  Layers, 
  RefreshCw,
  PlusCircle,
  MinusCircle
} from 'lucide-react';

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

  useEffect(() => {
    loadInventory();
    if (activeTab === 'history') {
      loadMovements();
    }
  }, [lowStockOnly, activeTab]);

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
      const data = await apiFetch<StockMovement[]>('/api/v1/inventory/movements?limit=100');
      setMovements(data);
    } catch (e) {
      console.error(e);
    }
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

        {/* Tab Toggle */}
        <div className="flex space-x-1.5 rounded-lg bg-slate-200/70 p-1">
          <button
            onClick={() => setActiveTab('levels')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'levels'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
            <span>Stock Levels</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Movement Audit</span>
          </button>
        </div>
      </div>

      {activeTab === 'levels' ? (
        <div className="space-y-4">
          {/* Search & Filter */}
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-96">
              <input
                type="text"
                placeholder="Search inventory by product name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-white border border-slate-300 pl-9 pr-4 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
              />
              <Search className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
            </div>

            <button
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={`flex items-center space-x-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                lowStockOnly 
                  ? 'bg-rose-50 border-rose-300 text-rose-700' 
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Low Stock Alerts</span>
            </button>
          </div>

          {/* Inventory Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Product</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5 text-right">Available Stock</th>
                  <th className="p-3.5 text-right">Reorder Threshold</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-amber-600" />
                      Loading inventory levels...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No inventory records found.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.product_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{item.product_name}</div>
                        <div className="text-[11px] font-mono text-slate-400">{item.sku || '---'}</div>
                      </td>
                      <td className="p-3.5">
                        {item.unit_type === 'roll' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                            <Layers className="h-3 w-3 mr-1" />
                            Roll ({item.meters_per_roll}m)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                            {item.unit}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                        <div className="text-sm">{item.formatted_stock}</div>
                      </td>
                      <td className="p-3.5 text-right font-mono text-slate-500">
                        {item.unit_type === 'roll' ? `${Number(item.reorder_level).toFixed(0)}m` : Number(item.reorder_level).toFixed(0)}
                      </td>
                      <td className="p-3.5 text-center">
                        {item.is_low_stock ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Reorder Alert
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Healthy Stock
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => setAdjustModalItem(item)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                        >
                          Quick Adjust
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Movement Audit Log */
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5">Reference</th>
                <th className="p-3.5 text-right">Quantity Delta</th>
                <th className="p-3.5 text-right">New Balance</th>
                <th className="p-3.5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No stock movements recorded yet.
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5 font-mono text-slate-500">
                      {new Date(m.created_at).toLocaleString()}
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        m.type === 'in' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        m.type === 'sale' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        m.type === 'adjust' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}>
                        {m.type}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">{m.reference_id || '---'}</td>
                    <td className={`p-3.5 text-right font-mono font-bold ${
                      Number(m.quantity) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {Number(m.quantity) > 0 ? `+${Number(m.quantity)}` : Number(m.quantity)}
                    </td>
                    <td className="p-3.5 text-right font-mono text-slate-900 font-bold">
                      {Number(m.new_quantity)}
                    </td>
                    <td className="p-3.5 text-slate-500 max-w-xs truncate">{m.note || '---'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick Adjust Modal */}
      {adjustModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Manual Stock Adjustment</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-semibold">
                {adjustModalItem.product_name} {adjustModalItem.sku ? `(${adjustModalItem.sku})` : ''}
              </p>
            </div>

            {adjustError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                {adjustError}
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setAdjustType('add')}
                  className={`flex-1 flex items-center justify-center space-x-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    adjustType === 'add'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Add Stock (+)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('subtract')}
                  className={`flex-1 flex items-center justify-center space-x-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    adjustType === 'subtract'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <MinusCircle className="h-4 w-4" />
                  <span>Reduce Stock (-)</span>
                </button>
              </div>

              {adjustModalItem.unit_type === 'roll' ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-sky-800 flex items-center justify-between">
                      <span>Roll Quantity Breakdown</span>
                      <span className="font-mono text-[10px] font-normal text-sky-600">({adjustModalItem.meters_per_roll}m / roll)</span>
                    </div>
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
                  Reason Note
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Broken packaging, Found inventory, Physical count correction"
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
    </div>
  );
};
