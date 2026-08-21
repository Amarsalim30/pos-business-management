import React, { useState, useRef, useEffect } from 'react';
import type { Product } from '../types';
import {
  Search,
  Plus,
  Trash2,
  Layers,
  Package,
  ChevronDown,
  X,
  PackagePlus,
  HelpCircle
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
  roll_mode?: 'rolls' | 'meters'; // User preference when entering roll product
  // Pricing fields
  unit_cost: number; // Cost per unit (per piece, or per roll if roll item)
  cost_per_meter: number; // Cost per meter for roll products
  total_cost: number;
  // Metadata for validation
  current_stock?: number;
  formatted_stock?: string;
  current_bp?: number;
}

interface RapidItemGridProps {
  mode: 'po' | 'grn' | 'receive_po';
  products: Product[];
  items: GridItem[];
  onChange: (items: GridItem[]) => void;
  onAddNewProduct?: () => void;
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
  onImportLowStock,
  currency = 'KES',
  readOnlyProducts = false
}) => {
  // Quick Add Bar State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Quick Add input values
  const [addQty, setAddQty] = useState<string>('1');
  const [addRolls, setAddRolls] = useState<string>('1');
  const [addLooseMeters, setAddLooseMeters] = useState<string>('0');
  const [addRollMode, setAddRollMode] = useState<'rolls' | 'meters'>('rolls');
  const [addUnitCost, setAddUnitCost] = useState<string>('');

  // Refs for smooth keyboard traversal
  const searchInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const costInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter products for dropdown
  const filteredProducts = React.useMemo(() => {
    if (!searchQuery.trim()) return products.slice(0, 30);
    const q = searchQuery.toLowerCase().trim();
    return products
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      )
      .slice(0, 30);
  }, [products, searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const calculateLineTotal = (
    unitType: 'piece' | 'roll',
    mpr: number,
    qty: number,
    rolls: number,
    loose: number,
    rollMode: 'rolls' | 'meters',
    unitCost: number
  ): number => {
    if (unitType === 'roll') {
      const metersPerRoll = mpr || 100;
      if (rollMode === 'rolls') {
        const rollFraction = rolls + (loose / (metersPerRoll || 100));
        return rollFraction * unitCost;
      } else {
        const rollFraction = (qty / (metersPerRoll || 100));
        return rollFraction * unitCost;
      }
    }
    return qty * unitCost;
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchQuery(product.name);
    setIsDropdownOpen(false);

    const cost = Number(product.cost_price) || 0;

    setAddQty('1');
    setAddRolls('1');
    setAddLooseMeters('0');
    setAddRollMode('rolls');
    setAddUnitCost(String(cost));

    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 50);
  };

  const handleClearSelection = () => {
    setSelectedProduct(null);
    setSearchQuery('');
    setAddQty('1');
    setAddRolls('1');
    setAddLooseMeters('0');
    setAddUnitCost('');
    searchInputRef.current?.focus();
  };

  const handleAddLineItem = () => {
    if (!selectedProduct) return;

    const isRoll = selectedProduct.unit_type === 'roll';
    const mpr = selectedProduct.meters_per_roll || 100;
    const cost = parseFloat(addUnitCost) || 0;

    let baseQuantity = 1;
    let rollCount = 0;
    let looseMeters = 0;

    if (isRoll) {
      if (addRollMode === 'rolls') {
        rollCount = parseInt(addRolls) || 0;
        looseMeters = parseFloat(addLooseMeters) || 0;
        baseQuantity = (rollCount * mpr) + looseMeters;
      } else {
        baseQuantity = parseFloat(addQty) || 0;
        rollCount = Math.floor(baseQuantity / mpr);
        looseMeters = baseQuantity % mpr;
      }
    } else {
      baseQuantity = parseFloat(addQty) || 1;
    }

    if (baseQuantity <= 0) return;

    const totalCost = calculateLineTotal(
      selectedProduct.unit_type,
      mpr,
      baseQuantity,
      rollCount,
      looseMeters,
      addRollMode,
      cost
    );

    // Check if product already exists in items table
    const existingIndex = items.findIndex(it => it.product_id === selectedProduct.id);
    if (existingIndex >= 0) {
      // Update existing line
      const updated = [...items];
      const existing = updated[existingIndex];
      const newQty = existing.quantity + baseQuantity;
      const newRolls = isRoll ? Math.floor(newQty / mpr) : 0;
      const newLoose = isRoll ? newQty % mpr : 0;
      const newTotal = calculateLineTotal(
        existing.unit_type,
        mpr,
        newQty,
        newRolls,
        newLoose,
        existing.roll_mode || 'rolls',
        cost > 0 ? cost : existing.unit_cost
      );

      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
        rolls: newRolls,
        loose_meters: newLoose,
        unit_cost: cost > 0 ? cost : existing.unit_cost,
        cost_per_meter: isRoll && mpr > 0 ? (cost > 0 ? cost : existing.unit_cost) / mpr : 0,
        total_cost: newTotal
      };
      onChange(updated);
    } else {
      // Append new row
      const newItem: GridItem = {
        id: `line_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        product_sku: selectedProduct.sku || '',
        unit_type: selectedProduct.unit_type,
        meters_per_roll: mpr,
        quantity: baseQuantity,
        rolls: rollCount,
        loose_meters: looseMeters,
        roll_mode: addRollMode,
        unit_cost: cost,
        cost_per_meter: isRoll && mpr > 0 ? cost / mpr : 0,
        total_cost: totalCost,
        current_stock: selectedProduct.current_stock,
        formatted_stock: selectedProduct.formatted_stock,
        current_bp: selectedProduct.cost_price
      };
      onChange([...items, newItem]);
    }

    // Reset quick add bar and refocus product search
    handleClearSelection();
  };

  const handleUpdateTableItemQty = (index: number, val: number) => {
    const updated = [...items];
    const item = { ...updated[index] };
    const isRoll = item.unit_type === 'roll';
    const mpr = item.meters_per_roll || 100;

    item.quantity = Math.max(0, val);
    if (isRoll) {
      item.rolls = Math.floor(item.quantity / mpr);
      item.loose_meters = item.quantity % mpr;
    }
    item.total_cost = calculateLineTotal(
      item.unit_type,
      mpr,
      item.quantity,
      item.rolls,
      item.loose_meters,
      item.roll_mode || 'rolls',
      item.unit_cost
    );
    updated[index] = item;
    onChange(updated);
  };

  const handleUpdateTableItemRolls = (index: number, rolls: number, loose: number) => {
    const updated = [...items];
    const item = { ...updated[index] };
    const mpr = item.meters_per_roll || 100;

    item.rolls = Math.max(0, rolls);
    item.loose_meters = Math.max(0, loose);
    item.quantity = (item.rolls * mpr) + item.loose_meters;
    item.total_cost = calculateLineTotal(
      item.unit_type,
      mpr,
      item.quantity,
      item.rolls,
      item.loose_meters,
      'rolls',
      item.unit_cost
    );
    updated[index] = item;
    onChange(updated);
  };

  const handleUpdateTableItemCost = (index: number, cost: number) => {
    const updated = [...items];
    const item = { ...updated[index] };
    const mpr = item.meters_per_roll || 100;

    item.unit_cost = Math.max(0, cost);
    if (item.unit_type === 'roll' && mpr > 0) {
      item.cost_per_meter = item.unit_cost / mpr;
    }
    item.total_cost = calculateLineTotal(
      item.unit_type,
      mpr,
      item.quantity,
      item.rolls,
      item.loose_meters,
      item.roll_mode || 'rolls',
      item.unit_cost
    );
    updated[index] = item;
    onChange(updated);
  };

  const handleRemoveRow = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsDropdownOpen(true);
        return;
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, filteredProducts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProducts.length > 0 && highlightedIndex >= 0) {
        handleSelectProduct(filteredProducts[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  const grandTotal = items.reduce((sum, item) => sum + (Number(item.total_cost) || 0), 0);
  const totalItemCount = items.length;

  return (
    <div className="space-y-4">
      {/* Quick Add Product Bar (Familiar & Intuitive) */}
      {!readOnlyProducts && (
        <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <PackagePlus className="h-4 w-4 text-indigo-600" />
              Add Line Item to {mode === 'po' ? 'Purchase Order' : 'Stock Inward'}
            </span>
            <div className="flex items-center gap-2">
              {onImportLowStock && mode === 'po' && (
                <button
                  type="button"
                  onClick={onImportLowStock}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                  title="Auto-fill items currently below reorder level"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Import Low Stock Items
                </button>
              )}
              {onAddNewProduct && (
                <button
                  type="button"
                  onClick={onAddNewProduct}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Product
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            {/* Product Combobox Selector */}
            <div className="sm:col-span-5 relative" ref={dropdownRef}>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Select Product *
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Select product or type to search..."
                  value={searchQuery}
                  onFocus={() => {
                    setIsDropdownOpen(true);
                    setHighlightedIndex(0);
                  }}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs"
                />
                {selectedProduct ? (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <ChevronDown
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 cursor-pointer pointer-events-auto"
                  />
                )}
              </div>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-full min-w-[340px] max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-2 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 flex justify-between items-center">
                    <span>PRODUCT CATALOG ({filteredProducts.length})</span>
                    <span>↑↓ navigate, [Enter] select</span>
                  </div>

                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {filteredProducts.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 text-xs">
                        <div>No matching product found in catalog.</div>
                        {onAddNewProduct && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsDropdownOpen(false);
                              onAddNewProduct();
                            }}
                            className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Create "{searchQuery}"
                          </button>
                        )}
                      </div>
                    ) : (
                      filteredProducts.map((p, pIdx) => {
                        const isHighlighted = pIdx === highlightedIndex;
                        return (
                          <div
                            key={p.id}
                            onMouseEnter={() => setHighlightedIndex(pIdx)}
                            onClick={() => handleSelectProduct(p)}
                            className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between ${
                              isHighlighted ? 'bg-indigo-50 text-indigo-950' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex-1 pr-2">
                              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                <span>{p.name}</span>
                                {p.unit_type === 'roll' && (
                                  <span className="px-1.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded text-[10px] font-bold font-mono">
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
                </div>
              )}
            </div>

            {/* Quantity Input */}
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                {selectedProduct?.unit_type === 'roll' ? (
                  <span className="flex items-center justify-between">
                    <span>Quantity</span>
                    <button
                      type="button"
                      onClick={() => setAddRollMode(addRollMode === 'rolls' ? 'meters' : 'rolls')}
                      className="text-[10px] text-sky-700 font-bold underline"
                    >
                      {addRollMode === 'rolls' ? 'Switch to Meters' : 'Switch to Rolls'}
                    </button>
                  </span>
                ) : (
                  'Quantity (Pieces)'
                )}
              </label>

              {selectedProduct?.unit_type === 'roll' && addRollMode === 'rolls' ? (
                <div className="flex items-center gap-1">
                  <div className="relative flex-1">
                    <input
                      ref={qtyInputRef}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Rolls"
                      value={addRolls}
                      onChange={(e) => setAddRolls(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          costInputRef.current?.focus();
                          costInputRef.current?.select();
                        }
                      }}
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">rls</span>
                  </div>
                  <span className="text-slate-300 font-bold">+</span>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Loose"
                      value={addLooseMeters}
                      onChange={(e) => setAddLooseMeters(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          costInputRef.current?.focus();
                          costInputRef.current?.select();
                        }
                      }}
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">m</span>
                  </div>
                </div>
              ) : (
                <input
                  ref={qtyInputRef}
                  type="number"
                  min="0.01"
                  step="any"
                  placeholder="1"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      costInputRef.current?.focus();
                      costInputRef.current?.select();
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs"
                />
              )}
            </div>

            {/* Unit Cost Input */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Unit Cost (KES)
              </label>
              <input
                ref={costInputRef}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={addUnitCost}
                onChange={(e) => setAddUnitCost(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddLineItem();
                  }
                }}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs text-right"
              />
            </div>

            {/* Add Button */}
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={handleAddLineItem}
                disabled={!selectedProduct}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
                <span>Add Item</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Line Items Table */}
      <div className="border border-slate-200 rounded-2xl bg-white shadow-2xs overflow-hidden">
        <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Package className="h-4 w-4 text-indigo-600" />
            Items on Document ({totalItemCount} {totalItemCount === 1 ? 'line' : 'lines'})
          </span>
          <span className="text-xs text-slate-500 font-medium">
            {mode === 'po' ? 'Procurement Order' : 'Inbound Physical Stock'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[240px]">Product / SKU</th>
                <th className="py-2.5 px-3 w-28 text-center">Unit Type</th>
                <th className="py-2.5 px-3 min-w-[160px]">
                  {mode === 'po' ? 'Ordered Qty' : 'Received Qty'}
                </th>
                <th className="py-2.5 px-3 w-32 text-right">Unit Cost ({currency})</th>
                <th className="py-2.5 px-3 w-36 text-right">Line Total ({currency})</th>
                <th className="py-2.5 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-1.5">
                      <HelpCircle className="h-6 w-6 text-slate-300" />
                      <span className="font-medium text-xs">No items added yet.</span>
                      <span className="text-[11px] text-slate-400">
                        Use the product dropdown above to select and add items.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const isRoll = item.unit_type === 'roll';
                  const mpr = item.meters_per_roll || 100;

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-900 text-xs">{item.product_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                          <span>SKU: {item.product_sku || '-'}</span>
                          {item.formatted_stock && (
                            <>
                              <span>•</span>
                              <span>Stock: {item.formatted_stock}</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-2 px-3 text-center">
                        {isRoll ? (
                          <span className="inline-flex items-center px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-md text-[10px] font-bold font-mono">
                            Roll ({mpr}m)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold">
                            Piece (pcs)
                          </span>
                        )}
                      </td>

                      {/* Quantity column */}
                      <td className="py-2 px-3">
                        {isRoll ? (
                          <div className="flex items-center gap-1">
                            <div className="relative flex-1">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={item.rolls ?? ''}
                                onChange={(e) =>
                                  handleUpdateTableItemRolls(idx, parseInt(e.target.value) || 0, item.loose_meters || 0)
                                }
                                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-600"
                              />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">rls</span>
                            </div>
                            <span className="text-slate-300 font-bold">+</span>
                            <div className="relative flex-1">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.loose_meters || ''}
                                onChange={(e) =>
                                  handleUpdateTableItemRolls(idx, item.rolls || 0, parseFloat(e.target.value) || 0)
                                }
                                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-600"
                              />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">m</span>
                            </div>
                          </div>
                        ) : (
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={item.quantity || ''}
                            onChange={(e) => handleUpdateTableItemQty(idx, parseFloat(e.target.value) || 0)}
                            className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-600"
                          />
                        )}
                        {isRoll && (
                          <div className="text-[10px] text-sky-700 font-mono font-semibold mt-0.5">
                            = {item.quantity} total meters
                          </div>
                        )}
                      </td>

                      {/* Unit Cost Column */}
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_cost || ''}
                          onChange={(e) => handleUpdateTableItemCost(idx, parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1 text-right bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-600"
                        />
                      </td>

                      {/* Line Total Column */}
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 text-xs">
                        {currency} {Number(item.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Remove Button */}
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="text-slate-300 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="p-3 bg-slate-50/90 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            {totalItemCount} items listed
          </div>

          <div className="text-sm font-bold text-slate-900 flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-slate-500 text-xs uppercase">Grand Total:</span>
            <span className="font-mono text-base text-indigo-700 font-extrabold">
              {currency} {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
