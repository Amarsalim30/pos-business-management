import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import type { Product, Category } from '../types';
import { 
  Package, 
  Search, 
  Plus, 
  AlertTriangle, 
  Check, 
  RefreshCw,
  Layers
} from 'lucide-react';

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [unitType, setUnitType] = useState<'piece' | 'roll'>('piece');
  const [metersPerRoll, setMetersPerRoll] = useState('100');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [pricePerMeter, setPricePerMeter] = useState('');
  const [initialStock, setInitialStock] = useState('0');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
    loadProducts();
  }, [searchQuery, selectedCategory, lowStockOnly]);

  const loadCategories = async () => {
    try {
      const data = await apiFetch<Category[]>('/api/v1/categories/');
      setCategories(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      let url = `/api/v1/products/?low_stock_only=${lowStockOnly}`;
      if (searchQuery) url += `&q=${encodeURIComponent(searchQuery)}`;
      if (selectedCategory !== 'all') url += `&category_id=${selectedCategory}`;
      const data = await apiFetch<Product[]>(url);
      setProducts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      await apiFetch('/api/v1/products/', {
        method: 'POST',
        body: JSON.stringify({
          name,
          sku: sku.trim() || null,
          category_id: categoryId === '' ? null : Number(categoryId),
          unit: unitType === 'roll' ? 'meters' : 'pcs',
          unit_type: unitType,
          meters_per_roll: unitType === 'roll' ? parseFloat(metersPerRoll) : null,
          cost_price: parseFloat(costPrice),
          selling_price: parseFloat(sellingPrice),
          price_per_meter: unitType === 'roll' && pricePerMeter ? parseFloat(pricePerMeter) : null,
          initial_stock: parseFloat(initialStock || '0'),
          reorder_level: parseFloat(reorderLevel || '5'),
          is_taxable: true,
        }),
      });
      setIsModalOpen(false);
      resetForm();
      loadProducts();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create product');
    }
  };

  const resetForm = () => {
    setName('');
    setSku('');
    setCategoryId('');
    setUnitType('piece');
    setMetersPerRoll('100');
    setCostPrice('');
    setSellingPrice('');
    setPricePerMeter('');
    setInitialStock('0');
    setReorderLevel('5');
    setFormError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Package className="h-5 w-5 text-amber-600" />
            <span>Product Catalog</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage inventory items, whole rolls, and meter pricing
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-500 transition-all shadow-xs active:scale-[0.98] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Product</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg bg-white border border-slate-300 pl-9 pr-4 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
          />
          <Search className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-amber-600"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`flex items-center space-x-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              lowStockOnly 
                ? 'bg-rose-50 border-rose-300 text-rose-700' 
                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Low Stock</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
            <tr>
              <th className="p-3.5">Product & SKU</th>
              <th className="p-3.5">Type & Unit</th>
              <th className="p-3.5 text-right">Buying Price (BP)</th>
              <th className="p-3.5 text-right">Selling Price (SP)</th>
              <th className="p-3.5 text-right">Current Stock</th>
              <th className="p-3.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-amber-600" />
                  Loading product catalog...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  No products found matching criteria.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5">
                    <div className="font-bold text-slate-900">{p.name}</div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">{p.sku || '---'}</div>
                  </td>
                  <td className="p-3.5">
                    {p.unit_type === 'roll' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                        <Layers className="h-3 w-3 mr-1" />
                        Roll ({p.meters_per_roll}m)
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                        {p.unit}
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-right font-mono text-slate-600">
                    KES {Number(p.cost_price).toLocaleString()}
                    {p.unit_type === 'roll' && p.cost_per_meter && (
                      <div className="text-[10px] text-slate-400">({Number(p.cost_per_meter).toFixed(0)}/m)</div>
                    )}
                  </td>
                  <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                    KES {Number(p.selling_price).toLocaleString()}
                    {p.unit_type === 'roll' && p.price_per_meter && (
                      <div className="text-[10px] text-amber-700">({Number(p.price_per_meter).toFixed(0)}/m)</div>
                    )}
                  </td>
                  <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                    <div>{p.formatted_stock || Number(p.current_stock).toLocaleString()}</div>
                    {p.unit_type === 'roll' && (
                      <div className="text-[10px] text-slate-400">{Number(p.current_stock).toFixed(1)}m total</div>
                    )}
                  </td>
                  <td className="p-3.5 text-center">
                    {p.is_low_stock ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Low Stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        In Stock
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Create New Inventory Product</h3>

            {formError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateProduct} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Product Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Solar Cable 4mm Black"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    SKU / Code <span className="text-slate-400 font-normal text-[10px] lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CBL-4MM-BLK (leave blank if none)"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-amber-600"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Unit Type Selector */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900">Unit Type</label>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setUnitType('piece')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        unitType === 'piece' 
                          ? 'bg-amber-600 text-white shadow-xs' 
                          : 'bg-white border border-slate-200 text-slate-700'
                      }`}
                    >
                      Piece / Fixed Item
                    </button>
                    <button
                      type="button"
                      onClick={() => setUnitType('roll')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        unitType === 'roll' 
                          ? 'bg-sky-600 text-white shadow-xs' 
                          : 'bg-white border border-slate-200 text-slate-700'
                      }`}
                    >
                      Roll / Wire Product
                    </button>
                  </div>
                </div>

                {unitType === 'roll' && (
                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Meters per Roll</label>
                      <input
                        type="number"
                        placeholder="100"
                        value={metersPerRoll}
                        onChange={(e) => setMetersPerRoll(e.target.value)}
                        className="w-full rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Price per Loose Meter (SP)</label>
                      <input
                        type="number"
                        placeholder="e.g. 100"
                        value={pricePerMeter}
                        onChange={(e) => setPricePerMeter(e.target.value)}
                        className="w-full rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-600"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Pricing & Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    {unitType === 'roll' ? 'Buying Price per Roll (BP)' : 'Buying Price (BP)'}
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    {unitType === 'roll' ? 'Selling Price per Roll (SP)' : 'Selling Price (SP)'}
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    {unitType === 'roll' ? 'Initial Stock (Total Meters)' : 'Initial Quantity'}
                  </label>
                  <input
                    type="number"
                    value={initialStock}
                    onChange={(e) => setInitialStock(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Reorder Alert Level</label>
                  <input
                    type="number"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center space-x-1.5 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-500 shadow-xs cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>Save Product</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
