import React, { useState, useRef } from 'react';
import type { Product } from '../types';
import {
  Search,
  Plus,
  Trash2,
  FileSpreadsheet,
  Layers,
  Package
} from 'lucide-react';

export interface GridItem {
  id: string; // unique row tracking key
  product_id: number | null;
  product_name: string;
  product_sku: string;
  unit_type: 'piece' | 'roll';
  meters_per_roll: number;
  // Quantity fields
  quantity: number; // Base units (meters for rolls, pcs for pieces)
  rolls: number; // User-entered roll count for roll items
  loose_meters: number; // User-entered loose meters for roll items
  // Pricing fields
  unit_cost: number; // Cost per unit (per piece, or per roll if roll item)
  cost_per_meter: number; // Cost per meter for roll products
  total_cost: number;
  // Metadata for validation
  current_stock?: number;
  formatted_stock?: string;
  current_bp?: number;
  is_new?: boolean;
}

interface RapidItemGridProps {
  mode: 'po' | 'grn' | 'receive_po';
  products: Product[];
  items: GridItem[];
  onChange: (items: GridItem[]) => void;
  onAddNewProduct?: () => void;
  onOpenExcelPaste?: () => void;
  onImportLowStock?: () => void;
  currency?: string;
  readOnlyProducts?: boolean;
}

export const RapidItemGrid: React.FC<RapidItemGridProps> = ({
  mode,
  products,
  items,
  onChange,
  onAddNewProduct,
  onOpenExcelPaste,
  onImportLowStock,
  currency = 'KES',
  readOnlyProducts = false
}) => {
  const [activeSearchRowIndex, setActiveSearchRowIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [highlightedSearchIndex, setHighlightedSearchIndex] = useState<number>(0);

  // References for inputs to manage auto-focusing and navigation
  const searchInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const qtyInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const rollsInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const looseInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const costInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  // Filtered products for active row search
  const filteredProducts = React.useMemo(() => {
    if (!searchQuery.trim()) return products.slice(0, 15);
    const q = searchQuery.toLowerCase().trim();
    return products
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [products, searchQuery]);

  const calculateRowTotal = (item: Partial<GridItem>): number => {
    const unitCost = Number(item.unit_cost) || 0;
    if (item.unit_type === 'roll') {
      const mpr = Number(item.meters_per_roll) || 100;
      const rolls = Number(item.rolls) || 0;
      const loose = Number(item.loose_meters) || 0;
      const totalMeters = (rolls * mpr) + loose;
      const rollFraction = mpr > 0 ? (totalMeters / mpr) : rolls;
      return rollFraction * unitCost;
    } else {
      const qty = Number(item.quantity) || 0;
      return qty * unitCost;
    }
  };

  const handleAddBlankRow = () => {
    const newRow: GridItem = {
      id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      product_id: null,
      product_name: '',
      product_sku: '',
      unit_type: 'piece',
      meters_per_roll: 100,
      quantity: 1,
      rolls: 1,
      loose_meters: 0,
      unit_cost: 0,
      cost_per_meter: 0,
      total_cost: 0,
      is_new: true
    };
    const newItems = [...items, newRow];
    onChange(newItems);
    setTimeout(() => {
      const nextIdx = newItems.length - 1;
      searchInputRefs.current[nextIdx]?.focus();
      setActiveSearchRowIndex(nextIdx);
      setSearchQuery('');
    }, 50);
  };

  const handleRemoveRow = (index: number) => {
    if (items.length <= 1 && !readOnlyProducts) {
      const resetRow: GridItem = {
        id: `row_${Date.now()}`,
        product_id: null,
        product_name: '',
        product_sku: '',
        unit_type: 'piece',
        meters_per_roll: 100,
        quantity: 1,
        rolls: 1,
        loose_meters: 0,
        unit_cost: 0,
        cost_per_meter: 0,
        total_cost: 0
      };
      onChange([resetRow]);
      return;
    }
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleSelectProduct = (index: number, product: Product) => {
    const isRoll = product.unit_type === 'roll';
    const mpr = product.meters_per_roll || 100;
    const defaultQty = isRoll ? mpr : 1;
    const defaultRolls = isRoll ? 1 : 0;
    const defaultLoose = 0;
    const unitCost = Number(product.cost_price) || 0;

    const updated = [...items];
    const total = isRoll ? (1 * unitCost) : (defaultQty * unitCost);

    updated[index] = {
      ...updated[index],
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku || '',
      unit_type: product.unit_type,
      meters_per_roll: mpr,
      quantity: defaultQty,
      rolls: defaultRolls,
      loose_meters: defaultLoose,
      unit_cost: unitCost,
      cost_per_meter: isRoll && mpr > 0 ? (unitCost / mpr) : 0,
      total_cost: total,
      current_stock: product.current_stock,
      formatted_stock: product.formatted_stock,
      current_bp: product.cost_price,
      is_new: false
    };

    onChange(updated);
    setActiveSearchRowIndex(null);
    setSearchQuery('');

    // Auto-focus next logical cell
    setTimeout(() => {
      if (isRoll) {
        rollsInputRefs.current[index]?.focus();
        rollsInputRefs.current[index]?.select();
      } else {
        qtyInputRefs.current[index]?.focus();
        qtyInputRefs.current[index]?.select();
      }
    }, 50);
  };

  const handleQuantityChange = (index: number, val: number) => {
    const updated = [...items];
    const item = { ...updated[index] };
    item.quantity = Math.max(0, val);
    if (item.unit_type === 'roll' && item.meters_per_roll) {
      item.rolls = Math.floor(item.quantity / item.meters_per_roll);
      item.loose_meters = item.quantity % item.meters_per_roll;
    }
    item.total_cost = calculateRowTotal(item);
    updated[index] = item;
    onChange(updated);
  };

  const handleRollsChange = (index: number, rolls: number, loose: number) => {
    const updated = [...items];
    const item = { ...updated[index] };
    const mpr = item.meters_per_roll || 100;
    item.rolls = Math.max(0, rolls);
    item.loose_meters = Math.max(0, loose);
    item.quantity = (item.rolls * mpr) + item.loose_meters;
    item.total_cost = calculateRowTotal(item);
    updated[index] = item;
    onChange(updated);
  };

  const handleUnitCostChange = (index: number, cost: number) => {
    const updated = [...items];
    const item = { ...updated[index] };
    item.unit_cost = Math.max(0, cost);
    if (item.unit_type === 'roll' && item.meters_per_roll > 0) {
      item.cost_per_meter = item.unit_cost / item.meters_per_roll;
    }
    item.total_cost = calculateRowTotal(item);
    updated[index] = item;
    onChange(updated);
  };

  // Keyboard navigation within the product search popup
  const handleSearchKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedSearchIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedSearchIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProducts.length > 0 && highlightedSearchIndex >= 0) {
        handleSelectProduct(index, filteredProducts[highlightedSearchIndex]);
      } else if (onAddNewProduct && searchQuery.trim()) {
        onAddNewProduct();
      }
    } else if (e.key === 'Escape') {
      setActiveSearchRowIndex(null);
    } else if (e.key === 'Tab' && !e.shiftKey) {
      if (filteredProducts.length > 0) {
        e.preventDefault();
        handleSelectProduct(index, filteredProducts[0]);
      }
    }
  };

  // Global calculations
  const grandTotal = items.reduce((sum, item) => sum + (Number(item.total_cost) || 0), 0);
  const totalItemCount = items.filter(it => it.product_id !== null).length;
  const totalUnits = items.reduce((sum, item) => {
    if (item.unit_type === 'roll') {
      const mpr = item.meters_per_roll || 100;
      return sum + (item.quantity / mpr);
    }
    return sum + (Number(item.quantity) || 0);
  }, 0);

  return (
    <div className="space-y-3">
      {/* Action Sub-Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Package className="h-4 w-4 text-indigo-600" />
            Line Items ({totalItemCount} {totalItemCount === 1 ? 'product' : 'products'})
          </span>
          <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono font-semibold">
            {mode === 'po' ? 'Procurement Order' : 'Physical Stock Inward'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onImportLowStock && mode === 'po' && (
            <button
              type="button"
              onClick={onImportLowStock}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
              title="Auto-fill items currently below reorder level"
            >
              <Layers className="h-3.5 w-3.5" />
              Import Low Stock
            </button>
          )}

          {onOpenExcelPaste && (
            <button
              type="button"
              onClick={onOpenExcelPaste}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Paste tab-separated rows from Excel or Google Sheets (Ctrl+V)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Paste from Excel
            </button>
          )}

          {onAddNewProduct && (
            <button
              type="button"
              onClick={onAddNewProduct}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
              title="Create a new catalog product on the fly"
            >
              <Plus className="h-3.5 w-3.5" />
              New Product
            </button>
          )}
        </div>
      </div>

      {/* High-Speed Spreadsheet Grid Container */}
      <div className="border border-slate-200 rounded-2xl bg-white shadow-2xs overflow-visible">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-2.5 px-3 w-10 text-center text-slate-400">#</th>
                <th className="py-2.5 px-3 min-w-[280px]">Product / Item Details</th>
                <th className="py-2.5 px-3 w-28 text-center">Unit Type</th>
                <th className="py-2.5 px-3 min-w-[180px]">
                  {mode === 'po' ? 'Ordered Qty' : 'Received Qty'}
                </th>
                <th className="py-2.5 px-3 w-36 text-right">Unit Cost ({currency})</th>
                <th className="py-2.5 px-3 w-36 text-right">Line Total ({currency})</th>
                <th className="py-2.5 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {items.map((item, idx) => {
                const isRoll = item.unit_type === 'roll';
                const isSearchActive = activeSearchRowIndex === idx;

                return (
                  <tr
                    key={item.id || idx}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      !item.product_id ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {/* Index */}
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    {/* Product Search / Selector */}
                    <td className="py-2 px-3 relative">
                      {readOnlyProducts ? (
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{item.product_name}</div>
                          {item.product_sku && (
                            <span className="font-mono text-[11px] text-slate-400">{item.product_sku}</span>
                          )}
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="relative flex items-center">
                            <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                            <input
                              ref={el => { searchInputRefs.current[idx] = el; }}
                              type="text"
                              placeholder={item.product_id ? item.product_name : 'Search product name, SKU or scan barcode...'}
                              value={isSearchActive ? searchQuery : item.product_name || ''}
                              onFocus={() => {
                                setActiveSearchRowIndex(idx);
                                setSearchQuery('');
                                setHighlightedSearchIndex(0);
                              }}
                              onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setHighlightedSearchIndex(0);
                              }}
                              onKeyDown={(e) => handleSearchKeyDown(e, idx)}
                              className={`w-full pl-8 pr-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                                !item.product_id
                                  ? 'border-amber-300 bg-amber-50/40 text-amber-900 placeholder:text-amber-600/70 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20'
                                  : 'border-slate-200 bg-white text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20'
                              }`}
                            />
                          </div>

                          {/* Autocomplete Dropdown Popover */}
                          {isSearchActive && (
                            <div className="absolute left-0 top-full mt-1.5 w-full min-w-[340px] max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                              <div className="p-2 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 flex justify-between items-center">
                                <span>SELECT PRODUCT (↑↓ to navigate, [Enter] to select)</span>
                                <span>{filteredProducts.length} results</span>
                              </div>

                              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                                {filteredProducts.length === 0 ? (
                                  <div className="p-4 text-center text-slate-500">
                                    <div className="text-xs font-medium mb-1">No products found matching "{searchQuery}"</div>
                                    {onAddNewProduct && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveSearchRowIndex(null);
                                          onAddNewProduct();
                                        }}
                                        className="mt-1 inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                        Create New Product "{searchQuery}"
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  filteredProducts.map((p, pIdx) => {
                                    const isHighlighted = pIdx === highlightedSearchIndex;
                                    return (
                                      <div
                                        key={p.id}
                                        onMouseEnter={() => setHighlightedSearchIndex(pIdx)}
                                        onClick={() => handleSelectProduct(idx, p)}
                                        className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between ${
                                          isHighlighted ? 'bg-indigo-50/80 text-indigo-950' : 'hover:bg-slate-50'
                                        }`}
                                      >
                                        <div className="flex-1 pr-2">
                                          <div className="font-bold text-slate-900 flex items-center gap-2">
                                            <span>{p.name}</span>
                                            {p.unit_type === 'roll' && (
                                              <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded text-[10px] font-bold">
                                                Roll ({p.meters_per_roll || 100}m)
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                                            <span>SKU: {p.sku || '-'}</span>
                                            <span>•</span>
                                            <span>Stock: {p.formatted_stock || `${p.current_stock} pcs`}</span>
                                          </div>
                                        </div>
                                        <div className="text-right font-mono">
                                          <div className="text-xs font-bold text-slate-900">
                                            KES {Number(p.cost_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                          </div>
                                          <div className="text-[10px] text-slate-400">Buying Price</div>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>

                              <div className="p-2 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-500">
                                <span>[Esc] to close</span>
                                {onAddNewProduct && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveSearchRowIndex(null);
                                      onAddNewProduct();
                                    }}
                                    className="text-indigo-600 hover:text-indigo-800 font-bold"
                                  >
                                    + Add New Product
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Unit Type Badge */}
                    <td className="py-2 px-3 text-center">
                      {isRoll ? (
                        <span className="inline-flex items-center px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-md text-[11px] font-bold font-mono">
                          Roll ({item.meters_per_roll}m)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[11px] font-bold">
                          Piece (pcs)
                        </span>
                      )}
                    </td>

                    {/* Quantity Inputs (Dual Mode for Rolls vs Pieces) */}
                    <td className="py-2 px-3">
                      {isRoll ? (
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 min-w-[65px]">
                            <div className="relative">
                              <input
                                ref={el => { rollsInputRefs.current[idx] = el; }}
                                type="number"
                                min="0"
                                step="1"
                                placeholder="Rolls"
                                value={item.rolls ?? ''}
                                onChange={(e) =>
                                  handleRollsChange(idx, parseInt(e.target.value) || 0, item.loose_meters || 0)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    looseInputRefs.current[idx]?.focus();
                                    looseInputRefs.current[idx]?.select();
                                  }
                                }}
                                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                              />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                                rls
                              </span>
                            </div>
                          </div>

                          <span className="text-slate-300 font-bold">+</span>

                          <div className="flex-1 min-w-[65px]">
                            <div className="relative">
                              <input
                                ref={el => { looseInputRefs.current[idx] = el; }}
                                type="number"
                                min="0"
                                step="any"
                                placeholder="Meters"
                                value={item.loose_meters || ''}
                                onChange={(e) =>
                                  handleRollsChange(idx, item.rolls || 0, parseFloat(e.target.value) || 0)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    costInputRefs.current[idx]?.focus();
                                    costInputRefs.current[idx]?.select();
                                  }
                                }}
                                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                              />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">
                                m
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <input
                          ref={el => { qtyInputRefs.current[idx] = el; }}
                          type="number"
                          min="0.01"
                          step="any"
                          value={item.quantity || ''}
                          onChange={(e) => handleQuantityChange(idx, parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              costInputRefs.current[idx]?.focus();
                              costInputRefs.current[idx]?.select();
                            }
                          }}
                          className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                        />
                      )}
                      {isRoll && (
                        <div className="text-[10px] text-sky-700 font-mono font-semibold mt-0.5 pl-0.5">
                          = {item.quantity} total meters
                        </div>
                      )}
                    </td>

                    {/* Unit Cost Input */}
                    <td className="py-2 px-3 text-right">
                      <div className="relative">
                        <input
                          ref={el => { costInputRefs.current[idx] = el; }}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_cost || ''}
                          onChange={(e) => handleUnitCostChange(idx, parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
                              if (idx === items.length - 1 && !readOnlyProducts) {
                                e.preventDefault();
                                handleAddBlankRow();
                              }
                            }
                          }}
                          className="w-full px-2.5 py-1 text-right bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                      {isRoll && item.cost_per_meter > 0 && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          ~KES {item.cost_per_meter.toFixed(2)}/m
                        </div>
                      )}
                    </td>

                    {/* Line Total */}
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 text-xs">
                      {currency} {Number(item.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Row Remove Action */}
                    <td className="py-2 px-2 text-center">
                      {!readOnlyProducts && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="text-slate-300 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer"
                          title="Remove Line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Bar with Add Row & Totals */}
        <div className="p-3 bg-slate-50/90 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {!readOnlyProducts && (
              <button
                type="button"
                onClick={handleAddBlankRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4 text-indigo-600" />
                Add Row [Enter]
              </button>
            )}
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              Tip: Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px] text-slate-700">Tab</kbd> to jump between fields
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-500 font-medium">
              Total Units: <span className="font-mono font-bold text-slate-800">{totalUnits.toFixed(1)}</span>
            </div>
            <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-slate-500 text-xs uppercase">Grand Total:</span>
              <span className="font-mono text-base text-indigo-700 font-extrabold">
                {currency} {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
