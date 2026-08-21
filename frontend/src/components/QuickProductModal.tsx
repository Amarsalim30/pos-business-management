import React, { useState } from 'react';
import { apiFetch } from '../services/api';
import type { Product, Category } from '../types';
import { Package, X, Loader2 } from 'lucide-react';

interface QuickProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onProductCreated: (product: Product) => void;
  initialName?: string;
}

export const QuickProductModal: React.FC<QuickProductModalProps> = ({
  isOpen,
  onClose,
  categories,
  onProductCreated,
  initialName = ''
}) => {
  const [name, setName] = useState(initialName);
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [unitType, setUnitType] = useState<'piece' | 'roll'>('piece');
  const [metersPerRoll, setMetersPerRoll] = useState<number>(100);
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [isTaxable, setIsTaxable] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required');
      return;
    }
    const cp = parseFloat(costPrice);
    const sp = parseFloat(sellingPrice);
    if (isNaN(cp) || cp <= 0) {
      setError('Please enter a valid buying cost price');
      return;
    }
    if (isNaN(sp) || sp <= 0) {
      setError('Please enter a valid selling price');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const created = await apiFetch<Product>('/api/v1/products/', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          sku: sku.trim() || null,
          category_id: categoryId ? Number(categoryId) : null,
          unit_type: unitType,
          meters_per_roll: unitType === 'roll' ? Number(metersPerRoll) : null,
          unit: unitType === 'roll' ? 'meter' : 'pcs',
          cost_price: cp,
          selling_price: sp,
          reorder_level: parseInt(reorderLevel) || 5,
          is_taxable: isTaxable
        })
      });

      onProductCreated(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Package className="h-5 w-5 text-indigo-600" />
            Quick Add New Catalog Product
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="my-3 p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Product Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Must Inverter 3.2kW 24V"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                SKU / Barcode
              </label>
              <input
                type="text"
                placeholder="e.g. INV-MUST-3KW"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">No Category (General)</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Product Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUnitType('piece')}
                  className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                    unitType === 'piece'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Piece / Item
                </button>
                <button
                  type="button"
                  onClick={() => setUnitType('roll')}
                  className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                    unitType === 'roll'
                      ? 'bg-sky-50 text-sky-700 border-sky-300 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Cable Roll
                </button>
              </div>
            </div>

            {unitType === 'roll' ? (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Meters Per Roll
                </label>
                <input
                  type="number"
                  min="1"
                  value={metersPerRoll}
                  onChange={(e) => setMetersPerRoll(parseInt(e.target.value) || 100)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Reorder Level
                </label>
                <input
                  type="number"
                  min="0"
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Buying Price (Cost) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Selling Price (Retail) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="taxableCheck"
              checked={isTaxable}
              onChange={(e) => setIsTaxable(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            <label htmlFor="taxableCheck" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
              Standard VAT Taxable Item
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Creating Product...</span>
                </>
              ) : (
                <span>Create & Add to Grid</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
