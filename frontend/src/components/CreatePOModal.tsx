import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import type { Product, Supplier, Category, PurchaseOrder } from '../types';
import { RapidItemGrid, type GridItem } from './RapidItemGrid';
import { QuickProductModal } from './QuickProductModal';
import { QuickSupplierModal } from './QuickSupplierModal';
import { ShoppingBag, X, Plus, Loader2, Calendar } from 'lucide-react';

interface CreatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  suppliers: Supplier[];
  categories: Category[];
  onPOCreated: (po: PurchaseOrder) => void;
  onRefreshData: () => void;
}

export const CreatePOModal: React.FC<CreatePOModalProps> = ({
  isOpen,
  onClose,
  products,
  suppliers,
  categories,
  onPOCreated,
  onRefreshData
}) => {
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [expectedDate, setExpectedDate] = useState('');
  const [isEtr, setIsEtr] = useState(false);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<GridItem[]>([]);

  // Sub-Modals
  const [isQuickProductOpen, setIsQuickProductOpen] = useState(false);
  const [isQuickSupplierOpen, setIsQuickSupplierOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSupplierId('');
      setExpectedDate('');
      setIsEtr(false);
      setNotes('');
      setItems([]);
      setError(null);
    }
  }, [isOpen]);

  // Global Ctrl+Enter shortcut to create PO
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, supplierId, expectedDate, isEtr, notes, items]);

  if (!isOpen) return null;

  const handleProductCreated = (newProd: Product) => {
    onRefreshData();
    const mpr = newProd.meters_per_roll || 100;
    const isRoll = newProd.unit_type === 'roll';
    const newGridItem: GridItem = {
      id: `row_${Date.now()}`,
      product_id: newProd.id,
      product_name: newProd.name,
      product_sku: newProd.sku || '',
      unit_type: newProd.unit_type,
      meters_per_roll: mpr,
      quantity: isRoll ? mpr : 1,
      rolls: isRoll ? 1 : 0,
      loose_meters: 0,
      roll_mode: 'rolls',
      unit_cost: Number(newProd.cost_price),
      cost_per_meter: isRoll && mpr > 0 ? Number(newProd.cost_price) / mpr : 0,
      total_cost: Number(newProd.cost_price),
      current_stock: newProd.current_stock,
      formatted_stock: newProd.formatted_stock,
      current_bp: newProd.cost_price
    };

    setItems([...items, newGridItem]);
  };

  const handleSupplierCreated = (newSupplier: Supplier) => {
    onRefreshData();
    setSupplierId(newSupplier.id);
  };

  const handleImportLowStock = () => {
    const lowStockProds = products.filter(p => p.current_stock <= p.reorder_level);
    if (lowStockProds.length === 0) {
      setError('No products are currently at or below their reorder level.');
      return;
    }

    const lowStockGridItems: GridItem[] = lowStockProds.map(p => {
      const isRoll = p.unit_type === 'roll';
      const mpr = p.meters_per_roll || 100;
      const suggestedQty = Math.max(1, (p.reorder_level * 2) - p.current_stock);
      const totalCost = isRoll && mpr > 0
        ? (suggestedQty / mpr) * Number(p.cost_price)
        : suggestedQty * Number(p.cost_price);

      return {
        id: `row_lowstock_${p.id}_${Date.now()}`,
        product_id: p.id,
        product_name: p.name,
        product_sku: p.sku || '',
        unit_type: p.unit_type,
        meters_per_roll: mpr,
        quantity: suggestedQty,
        rolls: isRoll && mpr > 0 ? Math.floor(suggestedQty / mpr) : 0,
        loose_meters: isRoll && mpr > 0 ? suggestedQty % mpr : 0,
        roll_mode: 'rolls',
        unit_cost: Number(p.cost_price),
        cost_per_meter: isRoll && mpr > 0 ? Number(p.cost_price) / mpr : 0,
        total_cost: totalCost,
        current_stock: p.current_stock,
        formatted_stock: p.formatted_stock,
        current_bp: p.cost_price
      };
    });

    const existingIds = new Set(items.map(it => it.product_id));
    const toAdd = lowStockGridItems.filter(it => !existingIds.has(it.product_id));
    setItems([...items, ...toAdd]);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!supplierId) {
      setError('Please select a supplier / vendor for this purchase order');
      return;
    }

    const validItems = items.filter(it => it.product_id !== null && it.quantity > 0);
    if (validItems.length === 0) {
      setError('Please add at least one valid product line with quantity greater than 0');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        supplier_id: Number(supplierId),
        expected_delivery_date: expectedDate || null,
        is_etr: isEtr,
        notes: notes.trim() || null,
        items: validItems.map(it => ({
          product_id: it.product_id,
          unit_type: it.unit_type,
          ordered_qty: Number(it.quantity),
          unit_cost: Number(it.unit_cost)
        }))
      };

      const result = await apiFetch<PurchaseOrder>('/api/v1/purchases/orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      onPOCreated(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create Purchase Order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 flex items-center justify-center p-3 sm:p-6">
        <div className="bg-white rounded-2xl max-w-5xl w-full p-6 max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                Create Vendor Purchase Order (PO)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Draft a formal procurement order for suppliers with expected deliveries and agreed pricing
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && (
            <div className="my-3 p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 font-medium">
              {error}
            </div>
          )}

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            {/* Header Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-slate-50/60 p-4 rounded-2xl border border-slate-200/80">
              {/* Supplier Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Vendor / Supplier *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickSupplierOpen(true)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    New
                  </button>
                </div>
                <select
                  required
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs"
                >
                  <option value="">Select Supplier *</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.balance > 0 ? `(Bal: KES ${s.balance.toLocaleString()})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Expected Delivery Date */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Expected Delivery Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs"
                  />
                </div>
              </div>

              {/* Fiscal ETR Checkbox */}
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer select-none bg-white px-3.5 py-2 rounded-xl border border-slate-200 w-full hover:bg-slate-50 transition-colors shadow-2xs">
                  <input
                    type="checkbox"
                    checked={isEtr}
                    onChange={(e) => setIsEtr(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span className="text-xs font-bold uppercase text-slate-700">Official ETR Order</span>
                </label>
              </div>
            </div>

            {/* Procurement Notes */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Procurement Notes / Instructions
              </label>
              <input
                type="text"
                placeholder="e.g. Include 1-year manufacturer warranty certificate, delivery to Industrial Area warehouse"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs"
              />
            </div>

            {/* Rapid Item Grid */}
            <RapidItemGrid
              mode="po"
              products={products}
              items={items}
              onChange={setItems}
              onAddNewProduct={() => setIsQuickProductOpen(true)}
              onImportLowStock={handleImportLowStock}
            />
          </div>

          {/* Modal Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-500 font-medium">
              Shortcut: Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[10px] text-slate-800">Ctrl + Enter</kbd> to submit
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={saving || items.length === 0}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving Order...</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4" />
                    <span>Create Purchase Order [Ctrl+Enter]</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Modals */}
      <QuickProductModal
        isOpen={isQuickProductOpen}
        onClose={() => setIsQuickProductOpen(false)}
        categories={categories}
        onProductCreated={handleProductCreated}
      />

      <QuickSupplierModal
        isOpen={isQuickSupplierOpen}
        onClose={() => setIsQuickSupplierOpen(false)}
        onSupplierCreated={handleSupplierCreated}
      />
    </>
  );
};
