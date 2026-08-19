import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import type { Product, Category } from '../types';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { 
  Package, 
  Search, 
  Plus, 
  AlertTriangle, 
  Check, 
  RefreshCw,
  Layers,
  Edit3,
  Trash2,
  FolderPlus,
  History
} from 'lucide-react';
import { ProductHistoryDrawer } from '../components/ProductHistoryDrawer';

export const ProductsPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [historyDrawerProductId, setHistoryDrawerProductId] = useState<number | null>(null);

  // Infinite Scroll Products State
  const {
    items: products,
    loading: productsLoading,
    loadingMore: productsLoadingMore,
    hasMore: productsHasMore,
    sentinelRef: productsSentinelRef,
    reload: reloadProducts
  } = useInfiniteScroll<Product>({
    fetchFn: async (offset, limit) => {
      let url = `/api/v1/products/?low_stock_only=${lowStockOnly}&limit=${limit}&offset=${offset}`;
      if (searchQuery.trim()) url += `&q=${encodeURIComponent(searchQuery.trim())}`;
      if (selectedCategory !== 'all') url += `&category_id=${selectedCategory}`;
      return await apiFetch<Product[]>(url);
    },
    limit: 25,
    dependencies: [searchQuery, selectedCategory, lowStockOnly]
  });

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
  const [taxPercent, setTaxPercent] = useState('0'); // percentage number e.g. 0, 16, 8 (defaults to 0)
  const [formError, setFormError] = useState<string | null>(null);

  // Quick Inline Category State
  const [isCreatingInlineCat, setIsCreatingInlineCat] = useState(false);
  const [inlineCategoryName, setInlineCategoryName] = useState('');
  const [inlineCatLoading, setInlineCatLoading] = useState(false);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await apiFetch<Category[]>('/api/v1/categories/');
      setCategories(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setCategoryError(null);
    try {
      await apiFetch('/api/v1/categories/', {
        method: 'POST',
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      setNewCategoryName('');
      loadCategories();
    } catch (err: any) {
      setCategoryError(err.message || 'Failed to create category');
    }
  };

  const handleDeleteCategory = async (catId: number, catName: string) => {
    if (!window.confirm(`Delete category "${catName}"?`)) return;
    try {
      await apiFetch(`/api/v1/categories/${catId}`, { method: 'DELETE' });
      if (selectedCategory === catId) setSelectedCategory('all');
      loadCategories();
      reloadProducts();
    } catch (err: any) {
      alert(err.message || 'Failed to delete category');
    }
  };

  const handleCreateInlineCategory = async () => {
    if (!inlineCategoryName.trim()) return;
    setInlineCatLoading(true);
    try {
      const newCat = await apiFetch<Category>('/api/v1/categories/', {
        method: 'POST',
        body: JSON.stringify({ name: inlineCategoryName.trim() }),
      });
      await loadCategories();
      setCategoryId(newCat.id);
      setInlineCategoryName('');
      setIsCreatingInlineCat(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create category');
    } finally {
      setInlineCatLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setSku(p.sku || '');
    setCategoryId(p.category_id !== null ? p.category_id : '');
    setUnitType(p.unit_type);
    setMetersPerRoll(p.meters_per_roll ? String(p.meters_per_roll) : '100');
    setCostPrice(String(p.cost_price));
    setSellingPrice(String(p.selling_price));
    setPricePerMeter(p.price_per_meter ? String(p.price_per_meter) : '');
    setReorderLevel(String(p.reorder_level || '5'));
    
    // Set percentage number (e.g. 0.16 -> 16, 0.08 -> 8, 0 -> 0)
    const rate = p.tax_rate !== undefined ? Number(p.tax_rate) : 0.0;
    setTaxPercent(String(rate * 100));
    
    setFormError(null);
    setIsCreatingInlineCat(false);
    setIsModalOpen(true);
  };

  const handleDeleteProduct = async (p: Product) => {
    if (!window.confirm(`Are you sure you want to deactivate "${p.name}"?`)) {
      return;
    }
    try {
      await apiFetch(`/api/v1/products/${p.id}`, { method: 'DELETE' });
      reloadProducts();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate product');
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedPercent = parseFloat(taxPercent || '0');
    const decimalTaxRate = Math.max(0, parsedPercent) / 100;
    const isTaxableItem = decimalTaxRate > 0;

    try {
      if (editingProduct) {
        // Update existing product
        await apiFetch(`/api/v1/products/${editingProduct.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name,
            sku: sku.trim() || null,
            category_id: categoryId === '' ? null : Number(categoryId),
            unit: unitType === 'roll' ? 'meters' : 'pcs',
            unit_type: unitType,
            meters_per_roll: unitType === 'roll' ? parseFloat(metersPerRoll) : null,
            cost_price: parseFloat(costPrice),
            selling_price: parseFloat(sellingPrice),
            price_per_roll: unitType === 'roll' ? parseFloat(sellingPrice) : null,
            price_per_meter: unitType === 'roll' && pricePerMeter ? parseFloat(pricePerMeter) : null,
            reorder_level: parseFloat(reorderLevel || '5'),
            is_taxable: isTaxableItem,
            tax_rate: decimalTaxRate,
          }),
        });
      } else {
        // Create new product
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
            price_per_roll: unitType === 'roll' ? parseFloat(sellingPrice) : null,
            price_per_meter: unitType === 'roll' && pricePerMeter ? parseFloat(pricePerMeter) : null,
            initial_stock: parseFloat(initialStock || '0'),
            reorder_level: parseFloat(reorderLevel || '5'),
            is_taxable: isTaxableItem,
            tax_rate: decimalTaxRate,
          }),
        });
      }
      setIsModalOpen(false);
      resetForm();
      reloadProducts();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save product');
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
    setTaxPercent('0');
    setIsCreatingInlineCat(false);
    setInlineCategoryName('');
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

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-xs cursor-pointer active:scale-[0.98]"
          >
            <FolderPlus className="h-4 w-4 text-slate-500" />
            <span>Manage Categories</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center space-x-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-500 transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Product</span>
          </button>
        </div>
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
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs max-h-[calc(100vh-275px)] flex flex-col overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider shadow-2xs">
              <tr>
                <th className="p-3.5">Product & SKU</th>
                <th className="p-3.5">Type & Unit</th>
                <th className="p-3.5 text-right">Buying Price (BP)</th>
                <th className="p-3.5 text-right">Selling Price (SP)</th>
                <th className="p-3.5 text-right">Current Stock</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {productsLoading && products.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-amber-600" />
                  Loading product catalog...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  No products found matching criteria.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5">
                    <button
                      onClick={() => setHistoryDrawerProductId(p.id)}
                      className="text-left group cursor-pointer"
                      title="Click to view purchase & sales telemetry"
                    >
                      <div className="font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                        {p.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">{p.sku || '---'}</div>
                    </button>
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
                    <div className="flex flex-col items-center gap-1">
                      {p.is_low_stock ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          In Stock
                        </span>
                      )}
                      {p.is_taxable ? (
                        <span className="text-[9px] font-bold text-slate-500 font-mono">
                          {p.tax_rate !== undefined ? `${(Number(p.tax_rate) * 100).toFixed(0)}% VAT` : '16% VAT'}
                        </span>
                      ) : (
                        <span className="text-[9px] font-medium text-slate-400">Exempt</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => setHistoryDrawerProductId(p.id)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-all cursor-pointer shadow-2xs"
                        title="View Sales, Purchase & Movement History"
                      >
                        <History className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(p)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-amber-700 transition-all cursor-pointer shadow-2xs"
                        title="Edit Product Details & Pricing"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p)}
                        className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-all cursor-pointer shadow-2xs"
                        title="Deactivate Product"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}

            {/* Loading More Rows Indicator */}
            {productsLoadingMore && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-amber-600 bg-amber-50/40 text-xs font-bold">
                  <div className="flex items-center justify-center space-x-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-amber-600" />
                    <span>Loading more products...</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Intersection Observer Sentinel */}
        <div ref={productsSentinelRef} className="h-4 w-full" />

        {!productsHasMore && products.length > 0 && (
          <div className="text-center py-2.5 text-[11px] text-slate-400 font-medium border-t border-slate-100 bg-slate-50/50">
            Showing all {products.length} products
          </div>
        )}
      </div>
    </div>

      {/* Product Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              {editingProduct ? `Edit Product: ${editingProduct.name}` : 'Create New Inventory Product'}
            </h3>

            {formError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-3.5">
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold uppercase text-slate-700">Category</label>
                    <button
                      type="button"
                      onClick={() => setIsCreatingInlineCat(!isCreatingInlineCat)}
                      className="text-[11px] font-bold text-amber-600 hover:text-amber-700 cursor-pointer flex items-center space-x-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>{isCreatingInlineCat ? 'Select Existing' : 'New Category'}</span>
                    </button>
                  </div>

                  {isCreatingInlineCat ? (
                    <div className="flex space-x-1.5">
                      <input
                        type="text"
                        autoFocus
                        placeholder="New category name..."
                        value={inlineCategoryName}
                        onChange={(e) => setInlineCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateInlineCategory();
                          }
                        }}
                        className="w-full rounded-lg border border-amber-400 bg-amber-50/40 px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleCreateInlineCategory}
                        disabled={inlineCatLoading || !inlineCategoryName.trim()}
                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        {inlineCatLoading ? '...' : 'Add'}
                      </button>
                    </div>
                  ) : (
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
                  )}
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600 font-mono"
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600 font-mono"
                  />
                </div>

                {!editingProduct && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                      {unitType === 'roll' ? 'Initial Stock (Total Meters)' : 'Initial Quantity'}
                    </label>
                    <input
                      type="number"
                      value={initialStock}
                      onChange={(e) => setInitialStock(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600 font-mono"
                    />
                  </div>
                )}

                <div className={editingProduct ? 'col-span-2' : ''}>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Reorder Alert Level</label>
                  <input
                    type="number"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600 font-mono"
                  />
                </div>

                {/* VAT Rate Input */}
                <div className="col-span-2 pt-1">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-bold text-slate-900">
                        VAT / Tax Rate (%)
                      </label>
                      <span className="text-[11px] text-slate-500">
                        Enter tax percentage (e.g. 16 for 16% VAT, 8 for 8% VAT, or 0 for Zero/Exempt)
                      </span>
                    </div>
                    <div className="relative w-28 shrink-0">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="0"
                        value={taxPercent}
                        onChange={(e) => setTaxPercent(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 pr-7 text-right text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-600 font-mono"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                        %
                      </span>
                    </div>
                  </div>
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
                  <span>{editingProduct ? 'Save Changes' : 'Create Product'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <FolderPlus className="h-4 w-4 text-amber-600" />
                <span>Manage Product Categories</span>
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {categoryError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
                {categoryError}
              </div>
            )}

            {/* Add Category Form */}
            <form onSubmit={handleCreateCategory} className="flex space-x-2">
              <input
                type="text"
                placeholder="New Category Name (e.g. Solar Cables)"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
              />
              <button
                type="submit"
                className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-500 transition-all shadow-xs cursor-pointer"
              >
                Add
              </button>
            </form>

            {/* Category List */}
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {categories.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">No categories created yet.</div>
              ) : (
                categories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-white hover:bg-slate-50 transition-colors">
                    <span className="text-xs font-bold text-slate-800">{c.name}</span>
                    <button
                      onClick={() => handleDeleteCategory(c.id, c.name)}
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded transition-colors cursor-pointer"
                      title="Delete Category"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product History & Telemetry Drawer */}
      <ProductHistoryDrawer
        productId={historyDrawerProductId}
        isOpen={!!historyDrawerProductId}
        onClose={() => setHistoryDrawerProductId(null)}
      />
    </div>
  );
};
