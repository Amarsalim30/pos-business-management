import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, Category } from '../types';
import { apiFetch } from '../services/api';
import {
  Search,
  X,
  Package,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Layers,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export interface StagedMaterial {
  product: Product;
  unit_sold: 'piece' | 'roll' | 'meter';
  quantity: string;
  unit_price: string;
  description: string;
}

export interface MaterialAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  projectName: string;
  products?: Product[];
  categories?: Category[];
  onMaterialsAllocated: () => void;
}

export const MaterialAllocationModal: React.FC<MaterialAllocationModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  products = [],
  categories = [],
  onMaterialsAllocated
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [inStockOnly, setInStockOnly] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(40);

  // Staging Tray
  const [stagedItems, setStagedItems] = useState<StagedMaterial[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setDisplayLimit(40);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fast Memoized Product Filtering (< 5ms for 1,700+ items)
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (products || []).filter((p) => {
      if (inStockOnly && Number(p.current_stock ?? 0) <= 0) {
        return false;
      }
      if (selectedCategory !== 'all' && p.category_id !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      const matchName = p.name ? p.name.toLowerCase().includes(q) : false;
      const matchSku = p.sku ? p.sku.toLowerCase().includes(q) : false;
      return matchName || matchSku;
    });
  }, [products, searchQuery, selectedCategory, inStockOnly]);

  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, displayLimit);
  }, [filteredProducts, displayLimit]);

  // Stage an item
  const handleStageProduct = (p: Product) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // Check if already in staging
    const existingIndex = stagedItems.findIndex((item) => item.product.id === p.id);
    if (existingIndex >= 0) {
      // Increment existing qty by 1
      setStagedItems((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantity: String((parseFloat(item.quantity) || 0) + 1) }
            : item
        )
      );
      return;
    }

    // Default unit and client selling price
    let defaultUnit: 'piece' | 'roll' | 'meter' = 'piece';
    let defaultPrice = String(p.selling_price || '0');

    if (p.unit_type === 'roll') {
      defaultUnit = 'roll';
      defaultPrice = String(p.price_per_roll || p.selling_price || '0');
    }

    setStagedItems((prev) => [
      ...prev,
      {
        product: p,
        unit_sold: defaultUnit,
        quantity: '1',
        unit_price: defaultPrice,
        description: `Material: ${p.name}`
      }
    ]);
  };

  // Remove staged item
  const handleRemoveStaged = (index: number) => {
    setStagedItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Update staged item field
  const handleUpdateStaged = (
    index: number,
    field: keyof StagedMaterial,
    value: any
  ) => {
    setStagedItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };

        // If unit_sold changed on roll product, update unit price default
        if (field === 'unit_sold') {
          const p = item.product;
          if (value === 'roll') {
            updated.unit_price = String(p.price_per_roll || p.selling_price || '0');
          } else if (value === 'meter') {
            updated.unit_price = String(p.price_per_meter || '0');
          }
        }
        return updated;
      })
    );
  };

  // Calculations for Staging Summary
  const traySummary = useMemo(() => {
    let totalCost = 0;
    let totalBilled = 0;

    stagedItems.forEach((item) => {
      const p = item.product;
      const qty = parseFloat(item.quantity) || 0;
      const unitBilled = parseFloat(item.unit_price) || 0;
      let unitCost = 0;

      if (p.unit_type === 'roll') {
        const metersPerRoll = Number(p.meters_per_roll) || 100;
        if (item.unit_sold === 'roll') {
          unitCost = Number(p.cost_price) || (Number(p.cost_per_meter) * metersPerRoll) || 0;
        } else {
          unitCost = Number(p.cost_per_meter) || (Number(p.cost_price) / metersPerRoll) || 0;
        }
      } else {
        unitCost = Number(p.cost_price) || 0;
      }

      totalCost += unitCost * qty;
      totalBilled += unitBilled * qty;
    });

    const grossMargin = totalBilled - totalCost;
    const marginPct = totalBilled > 0 ? Math.round((grossMargin / totalBilled) * 100) : 0;

    return { totalCost, totalBilled, grossMargin, marginPct };
  }, [stagedItems]);

  // Submit Batch Allocation
  const handleBatchSubmit = async () => {
    if (stagedItems.length === 0) return;

    // Validate quantities & prices
    for (const item of stagedItems) {
      const q = parseFloat(item.quantity);
      const price = parseFloat(item.unit_price);
      if (isNaN(q) || q <= 0) {
        setErrorMessage(`Please enter a valid positive quantity for "${item.product.name}"`);
        return;
      }
      if (isNaN(price) || price < 0) {
        setErrorMessage(`Please enter a valid price for "${item.product.name}"`);
        return;
      }
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        items: stagedItems.map((item) => ({
          product_id: item.product.id,
          unit_sold: item.unit_sold,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
          description: item.description.trim() || `Material: ${item.product.name}`
        }))
      };

      await apiFetch(`/api/v1/projects/${projectId}/materials/batch`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setSuccessMessage(`Successfully allocated ${stagedItems.length} materials to ${projectName}!`);
      setStagedItems([]);
      onMaterialsAllocated();

      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to allocate materials to project');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-6xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 z-10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-white">
                  Add Materials from Store Stock
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  {projectName}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Fast multi-material allocation with instant stock verification and profit margin calculations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400 font-bold bg-slate-800 px-3 py-1 rounded-xl">
              {filteredProducts.length} items in store
            </span>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-700 flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Body Split View */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 overflow-hidden">
          {/* Left Column: Product Browser (7 cols) */}
          <div className="lg:col-span-7 flex flex-col min-h-0 bg-slate-50/50">
            {/* Filter Bar */}
            <div className="p-4 border-b border-slate-200 bg-white space-y-3 shrink-0">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search 1,700+ store items by name or SKU... (e.g. 550W, inverter, 6mm cable)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9.5 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors select-none">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
                  />
                  <span className="whitespace-nowrap">In Stock Only</span>
                </label>
              </div>

              {/* Category Pills */}
              {categories.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
                      selectedCategory === 'all'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Categories
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCategory(c.id)}
                      className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
                        selectedCategory === c.id
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Scrollable Product List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredProducts.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <Package className="h-8 w-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">No matching store items found</p>
                  <p className="text-[11px] text-slate-400">
                    Try adjusting your search keywords or toggle off "In Stock Only".
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {visibleProducts.map((p) => {
                      const stock = Number(p.current_stock ?? 0);
                      const isStaged = stagedItems.some((item) => item.product.id === p.id);
                      const isOutOfStock = stock <= 0;

                      return (
                        <div
                          key={p.id}
                          onClick={() => !isOutOfStock && handleStageProduct(p)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                            isStaged
                              ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/30'
                              : isOutOfStock
                              ? 'bg-slate-100/60 border-slate-200 opacity-60 cursor-not-allowed'
                              : 'bg-white border-slate-200 hover:border-amber-400 hover:shadow-sm'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-bold text-slate-900 text-xs line-clamp-2 leading-tight">
                                {p.name}
                              </div>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 font-mono ${
                                  isOutOfStock
                                    ? 'bg-rose-100 text-rose-700'
                                    : stock <= 5
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {stock} {p.unit || 'pcs'}
                              </span>
                            </div>

                            {p.category_id && categories.length > 0 && (
                              <div className="text-[10px] text-slate-400 font-medium mt-1">
                                {categories.find(c => c.id === p.category_id)?.name}
                              </div>
                            )}
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <div className="text-[11px] font-mono">
                              <span className="text-slate-400">Cost: </span>
                              <span className="font-medium text-slate-600">
                                KES {Number(p.cost_price || 0).toLocaleString()}
                              </span>
                            </div>

                            <button
                              type="button"
                              disabled={isOutOfStock}
                              className={`p-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-[11px] font-bold ${
                                isStaged
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-slate-900 text-white hover:bg-amber-600'
                              }`}
                            >
                              <Plus className="h-3 w-3" />
                              <span>{isStaged ? 'Add More' : 'Stage'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {filteredProducts.length > displayLimit && (
                    <div className="pt-2 text-center">
                      <button
                        onClick={() => setDisplayLimit((prev) => prev + 40)}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                      >
                        Load More Products ({filteredProducts.length - displayLimit} remaining)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right Column: Staging Cart & Allocation Hub (5 cols) */}
          <div className="lg:col-span-5 flex flex-col min-h-0 bg-white">
            {/* Cart Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Staging Tray ({stagedItems.length} items)
                </span>
              </div>
              {stagedItems.length > 0 && (
                <button
                  onClick={() => setStagedItems([])}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Staged Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px]">
              {stagedItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
                  <Package className="h-10 w-10 text-slate-200" />
                  <p className="text-xs font-bold text-slate-600">Staging tray is empty</p>
                  <p className="text-[11px] text-slate-400 max-w-xs">
                    Click products on the left to add inverters, solar panels, cables, and hardware in batch.
                  </p>
                </div>
              ) : (
                stagedItems.map((item, index) => {
                  const p = item.product;
                  const qty = parseFloat(item.quantity) || 0;
                  const unitBilled = parseFloat(item.unit_price) || 0;
                  let unitCost = 0;

                  if (p.unit_type === 'roll') {
                    const metersPerRoll = Number(p.meters_per_roll) || 100;
                    if (item.unit_sold === 'roll') {
                      unitCost = Number(p.cost_price) || (Number(p.cost_per_meter) * metersPerRoll) || 0;
                    } else {
                      unitCost = Number(p.cost_per_meter) || (Number(p.cost_price) / metersPerRoll) || 0;
                    }
                  } else {
                    unitCost = Number(p.cost_price) || 0;
                  }

                  const lineCost = unitCost * qty;
                  const lineBilled = unitBilled * qty;
                  const lineProfit = lineBilled - lineCost;
                  const marginPct = lineBilled > 0 ? Math.round((lineProfit / lineBilled) * 100) : 0;

                  return (
                    <div
                      key={item.product.id}
                      className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2.5 transition-all hover:border-amber-300"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-slate-900 line-clamp-1">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Stock: {p.current_stock ?? 0} • Buying Price: KES {unitCost.toLocaleString()}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveStaged(index)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Inputs Row */}
                      <div className="grid grid-cols-12 gap-2">
                        {p.unit_type === 'roll' ? (
                          <div className="col-span-4">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Unit</label>
                            <select
                              value={item.unit_sold}
                              onChange={(e) => handleUpdateStaged(index, 'unit_sold', e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none"
                            >
                              <option value="roll">Rolls</option>
                              <option value="meter">Meters</option>
                            </select>
                          </div>
                        ) : null}

                        <div className={p.unit_type === 'roll' ? 'col-span-4' : 'col-span-5'}>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Qty</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => handleUpdateStaged(index, 'quantity', e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold font-mono focus:outline-none"
                          />
                        </div>

                        <div className={p.unit_type === 'roll' ? 'col-span-4' : 'col-span-7'}>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                            Client Price (KES)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => handleUpdateStaged(index, 'unit_price', e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold font-mono focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Note / Tag */}
                      <div>
                        <input
                          type="text"
                          placeholder="Usage note (e.g. Inverter coupling, roof mount)"
                          value={item.description}
                          onChange={(e) => handleUpdateStaged(index, 'description', e.target.value)}
                          className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-medium placeholder-slate-400 focus:outline-none"
                        />
                      </div>

                      {/* Line Margin Bar */}
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 font-mono">
                        <span className="text-slate-500">
                          Billed: <strong className="text-slate-900">KES {lineBilled.toLocaleString()}</strong>
                        </span>
                        <span className={`font-bold ${lineProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          Profit: {lineProfit >= 0 ? '+' : ''}KES {lineProfit.toLocaleString()} ({marginPct}%)
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Tray Footer & Batch Submit */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/80 space-y-3 shrink-0">
              <div className="p-3 bg-white rounded-2xl border border-slate-200/80 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-500">
                  <span>Total Store Cost:</span>
                  <span>KES {traySummary.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold">
                  <span>Total Client Billed:</span>
                  <span>KES {traySummary.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold border-t border-slate-100 pt-1.5">
                  <span>Project Profit Margin ({traySummary.marginPct}%):</span>
                  <span>+KES {traySummary.grossMargin.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={stagedItems.length === 0 || submitting}
                onClick={handleBatchSubmit}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Allocating {stagedItems.length} Materials...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Allocate {stagedItems.length} Materials to Project</span>
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
