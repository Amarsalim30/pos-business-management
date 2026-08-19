import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../services/api';
import type { InventoryItem, StockMovement, Supplier, GoodsReceivedNote } from '../types';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { GRNDocumentDrawer } from '../components/GRNDocumentDrawer';
import { ProductHistoryDrawer } from '../components/ProductHistoryDrawer';
import {
  Boxes,
  Search,
  AlertTriangle,
  ArrowDownUp,
  History,
  RefreshCw,
  Download,
  Truck,
  Check,
  Loader2,
  Plus,
  X,
  Building2,
  FileText,
  ChevronDown,
  ShieldCheck,
  Package
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
  const [searchQuery, setSearchQuery] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<'levels' | 'history'>('levels');
  const [movementProductFilter, setMovementProductFilter] = useState<number | 'all'>('all');
  const [historyDrawerProductId, setHistoryDrawerProductId] = useState<number | null>(null);

  // Suppliers State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | 'walkin'>('walkin');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const supplierDropdownRef = useRef<HTMLDivElement>(null);

  // Quick Supplier Add Modal State
  const [isCreateSupplierModalOpen, setIsCreateSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierContact, setNewSupplierContact] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [newSupplierAddress, setNewSupplierAddress] = useState('');
  const [newSupplierTaxPin, setNewSupplierTaxPin] = useState('');
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [createSupplierError, setCreateSupplierError] = useState<string | null>(null);

  // Product Autocomplete Inside GRN Modal
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  // Success Feedback
  const [grnSuccessMsg, setGrnSuccessMsg] = useState<string | null>(null);

  // Infinite Scroll for Inventory Items
  const {
    items,
    loading: itemsLoading,
    loadingMore: itemsLoadingMore,
    hasMore: itemsHasMore,
    sentinelRef: itemsSentinelRef,
    reload: reloadItems
  } = useInfiniteScroll<InventoryItem>({
    fetchFn: async (offset, limit) => {
      let url = `/api/v1/inventory/?low_stock_only=${lowStockOnly}&limit=${limit}&offset=${offset}`;
      return await apiFetch<InventoryItem[]>(url);
    },
    limit: 25,
    dependencies: [lowStockOnly]
  });

  // Infinite Scroll for Stock Movements
  const {
    items: movements,
    loading: movementsLoading,
    loadingMore: movementsLoadingMore,
    hasMore: movementsHasMore,
    sentinelRef: movementsSentinelRef,
    reload: reloadMovements
  } = useInfiniteScroll<StockMovement>({
    fetchFn: async (offset, limit) => {
      let url = `/api/v1/inventory/movements?limit=${limit}&offset=${offset}`;
      if (movementProductFilter !== 'all') {
        url += `&product_id=${movementProductFilter}`;
      }
      return await apiFetch<StockMovement[]>(url);
    },
    limit: 30,
    dependencies: [activeTab, movementProductFilter]
  });

  // Adjustment Modal
  const [adjustModalItem, setAdjustModalItem] = useState<InventoryItem | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Multi-Product GRN Batch Modal State
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [grnReferenceId, setGrnReferenceId] = useState('');
  const [grnGeneralNote, setGrnGeneralNote] = useState('');
  const [grnLines, setGrnLines] = useState<GRNLineItem[]>([]);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [submittingGRN, setSubmittingGRN] = useState(false);

  // Universal GRN Document Drawer State
  const [selectedGRNForDrawer, setSelectedGRNForDrawer] = useState<GoodsReceivedNote | null>(null);
  const [isGRNDrawerOpen, setIsGRNDrawerOpen] = useState(false);
  const [postedGRN, setPostedGRN] = useState<GoodsReceivedNote | null>(null);

  const handleOpenGRNDrawer = async (grnIdOrNo: number | string) => {
    try {
      const data = await apiFetch<GoodsReceivedNote>(`/api/v1/purchases/grn/${grnIdOrNo}`);
      setSelectedGRNForDrawer(data);
      setIsGRNDrawerOpen(true);
    } catch (e) {
      console.error('Failed to load GRN document', e);
    }
  };

  // Load suppliers
  const fetchSuppliers = async () => {
    try {
      const data = await apiFetch<Supplier[]>('/api/v1/suppliers/');
      setSuppliers(data || []);
    } catch (e) {
      console.error('Failed to load suppliers', e);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Click outside handling for comboboxes
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(e.target as Node)) {
        setIsSupplierDropdownOpen(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(e.target as Node)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const exportMovementsCSV = () => {
    if (movements.length === 0) return;
    const headers = ['ID', 'Date', 'Product Name', 'SKU', 'Type', 'Quantity', 'Unit', 'Prev Balance', 'New Balance', 'Reference', 'Note'];
    const rows = movements.map(m => [
      m.id,
      new Date(m.created_at).toLocaleString(),
      `"${(m.product_name || `Product #${m.product_id}`).replace(/"/g, '""')}"`,
      `"${(m.sku || '').replace(/"/g, '""')}"`,
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
      reloadItems();
      reloadMovements();
    } catch (err: any) {
      setAdjustError(err.message || 'Failed to adjust stock');
    }
  };

  const handleOpenGRNModal = (initialProdId?: number) => {
    setGrnReferenceId('');
    setSelectedSupplierId('walkin');
    setSupplierSearchQuery('');
    setIsSupplierDropdownOpen(false);
    setGrnGeneralNote('');
    setReceiveError(null);
    setProductSearchTerm('');
    setIsProductDropdownOpen(false);

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
      setReceiveError(`Product '${p.product_name}' is already in this delivery consignment.`);
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
    setProductSearchTerm('');
    setIsProductDropdownOpen(false);
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

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) {
      setCreateSupplierError('Supplier / Vendor name is required');
      return;
    }
    setCreateSupplierError(null);
    setCreatingSupplier(true);

    try {
      const created = await apiFetch<Supplier>('/api/v1/suppliers/', {
        method: 'POST',
        body: JSON.stringify({
          name: newSupplierName.trim(),
          phone: newSupplierPhone.trim() || undefined,
          contact_person: newSupplierContact.trim() || undefined,
          email: newSupplierEmail.trim() || undefined,
          address: newSupplierAddress.trim() || undefined,
          tax_pin: newSupplierTaxPin.trim() || undefined,
        }),
      });

      await fetchSuppliers();
      setSelectedSupplierId(created.id);
      setIsCreateSupplierModalOpen(false);
      setNewSupplierName('');
      setNewSupplierPhone('');
      setNewSupplierContact('');
      setNewSupplierEmail('');
      setNewSupplierAddress('');
      setNewSupplierTaxPin('');
    } catch (err: any) {
      setCreateSupplierError(err.message || 'Failed to create supplier');
    } finally {
      setCreatingSupplier(false);
    }
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
        unit_type: line.unit_type,
        quantity_received: q,
        unit_cost: line.unit_cost ? parseFloat(line.unit_cost) : 0,
      };

      if (line.unit_type === 'roll') {
        itemPayload.rolls_received = line.rolls ? parseInt(line.rolls, 10) : 0;
        itemPayload.loose_meters_received = line.loose ? parseFloat(line.loose) : 0;
      }

      payloadItems.push(itemPayload);
    }

    try {
      const res = await apiFetch<any>('/api/v1/purchases/grn', {
        method: 'POST',
        body: JSON.stringify({
          supplier_id: selectedSupplierId !== 'walkin' ? Number(selectedSupplierId) : undefined,
          invoice_number: grnReferenceId.trim() || undefined,
          notes: grnGeneralNote.trim() || undefined,
          items: payloadItems,
        }),
      });

      setIsReceiveModalOpen(false);
      reloadItems();
      reloadMovements();
      fetchSuppliers();
      setPostedGRN(res);
      setGrnSuccessMsg(`Successfully posted ${res?.grn_no || 'Goods Received Note'} (${payloadItems.length} products received). Stock balances & supplier ledger updated.`);
      setTimeout(() => setGrnSuccessMsg(null), 10000);
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

  const selectedSupplierObj = selectedSupplierId !== 'walkin' ? suppliers.find(s => s.id === selectedSupplierId) : null;

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase()) ||
    (s.phone && s.phone.includes(supplierSearchQuery)) ||
    (s.contact_person && s.contact_person.toLowerCase().includes(supplierSearchQuery.toLowerCase()))
  );

  const searchedProductsForGRN = items.filter(i =>
    productSearchTerm.trim() === '' ||
    i.product_name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    (i.sku && i.sku.toLowerCase().includes(productSearchTerm.toLowerCase()))
  ).slice(0, 15);

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
              className={`flex items-center space-x-1 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${activeTab === 'levels'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <ArrowDownUp className="h-3.5 w-3.5" />
              <span>Levels</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${activeTab === 'history'
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
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${lowStockOnly
                    ? 'bg-rose-50 border-rose-200 text-rose-700 font-bold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                <span>Low Stock Only</span>
              </button>

              <button
                onClick={reloadItems}
                disabled={itemsLoading}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
                title="Refresh Inventory"
              >
                <RefreshCw className={`h-4 w-4 ${itemsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Stock Table */}
          <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs max-h-[calc(100vh-290px)] flex flex-col overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-100 shadow-2xs">
                  <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
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
                  {itemsLoading && items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-amber-600" />
                        Loading Stock Balances...
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
                          <button
                            onClick={() => setHistoryDrawerProductId(item.product_id)}
                            className="text-left group cursor-pointer"
                            title="Click to view purchase, sales & movement telemetry"
                          >
                            <span className="font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                              {item.product_name}
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                          {item.sku || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${item.unit_type === 'roll'
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
                              onClick={() => setHistoryDrawerProductId(item.product_id)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 font-semibold text-[11px] cursor-pointer"
                              title="View sales & purchase history"
                            >
                              <History className="h-3 w-3" />
                              <span>History</span>
                            </button>
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

                  {/* Loading More Rows */}
                  {itemsLoadingMore && (
                    <tr>
                      <td colSpan={7} className="px-4 py-3 text-center text-amber-600 bg-amber-50/40 text-xs font-bold">
                        <div className="flex items-center justify-center space-x-2">
                          <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                          <span>Loading more stock records...</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Sentinel */}
              <div ref={itemsSentinelRef} className="h-4 w-full" />

              {!itemsHasMore && items.length > 0 && (
                <div className="text-center py-2.5 text-[11px] text-slate-400 font-medium border-t border-slate-100 bg-slate-50/50">
                  Showing all {items.length} inventory items
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Movement Audit View */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <label className="text-xs font-bold text-slate-700">Product:</label>
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
                onClick={reloadMovements}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
                title="Refresh Movements"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs max-h-[calc(100vh-290px)] flex flex-col overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-slate-100 shadow-2xs">
                  <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Delivered Product</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Delta / Quantity</th>
                    <th className="px-4 py-3">Previous Balance</th>
                    <th className="px-4 py-3">New Balance</th>
                    <th className="px-4 py-3">Reference / Order</th>
                    <th className="px-4 py-3">Audit Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {movementsLoading && movements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-amber-600" />
                        Loading movement history...
                      </td>
                    </tr>
                  ) : movements.length === 0 ? (
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
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">
                            {m.product_name || `Product #${m.product_id}`}
                          </div>
                          {m.sku && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              SKU: {m.sku}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${m.type === 'in'
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
                        <td className="px-4 py-3 font-mono text-[11px]">
                          {m.reference_id && (m.reference_id.startsWith('GRN') || m.reference_id.startsWith('DN')) ? (
                            <button
                              type="button"
                              onClick={() => handleOpenGRNDrawer(m.reference_id!)}
                              className="text-amber-700 hover:text-amber-900 font-bold underline decoration-slate-300 hover:decoration-amber-500 cursor-pointer flex items-center gap-1"
                              title="Inspect Delivery GRN Document"
                            >
                              <Truck className="h-3 w-3 text-amber-600" />
                              <span>{m.reference_id}</span>
                            </button>
                          ) : (
                            <span className="text-slate-600">{m.reference_id || '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {m.note || '—'}
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Loading More Rows */}
                  {movementsLoadingMore && (
                    <tr>
                      <td colSpan={8} className="px-4 py-3 text-center text-amber-600 bg-amber-50/40 text-xs font-bold">
                        <div className="flex items-center justify-center space-x-2">
                          <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                          <span>Loading more movements...</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Sentinel */}
              <div ref={movementsSentinelRef} className="h-4 w-full" />

              {!movementsHasMore && movements.length > 0 && (
                <div className="text-center py-2.5 text-[11px] text-slate-400 font-medium border-t border-slate-100 bg-slate-50/50">
                  Showing all {movements.length} stock movements
                </div>
              )}
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
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${adjustType === 'add' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                    }`}
                >
                  + Add Stock
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('subtract')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${adjustType === 'subtract' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
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

      {/* Success Notification Banner */}
      {grnSuccessMsg && (
        <div className="fixed top-5 right-5 z-50 flex items-center space-x-3 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-2xl border border-emerald-500/60 animate-in fade-in slide-in-from-top-4 duration-200">
          <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold text-slate-100">{grnSuccessMsg}</span>
          </div>
          {postedGRN && (
            <button
              onClick={() => {
                setSelectedGRNForDrawer(postedGRN);
                setIsGRNDrawerOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs shrink-0 active:scale-95"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>View GRN Slip</span>
            </button>
          )}
          <button
            onClick={() => {
              setGrnSuccessMsg(null);
              setPostedGRN(null);
            }}
            className="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Multi-Product Goods Received Note (GRN) Batch Modal */}
      {isReceiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 my-8 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Truck className="h-5 w-5 text-emerald-600" />
                  <span>Goods Received Note (GRN) — Delivery Consignment</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Receive supplier consignments, auto-link supplier liability & ledger, and post multi-item stock in one batch.
                </p>
              </div>
              <button
                onClick={() => setIsReceiveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {receiveError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium flex items-center space-x-2 shrink-0">
                <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                <span>{receiveError}</span>
              </div>
            )}

            <form onSubmit={handleBatchGRNSubmit} className="space-y-4 flex-1 flex flex-col min-h-0 overflow-y-auto pr-0.5">
              {/* Header Details (Supplier Combobox, Invoice Ref, Remarks) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 shrink-0">
                {/* Searchable Supplier Combobox with On-Spot Add */}
                <div className="md:col-span-5 relative" ref={supplierDropdownRef}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold uppercase text-slate-700">
                      Supplier / Vendor
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCreateSupplierModalOpen(true)}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center space-x-0.5 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>New Supplier</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSupplierDropdownOpen(!isSupplierDropdownOpen)}
                    className="w-full flex items-center justify-between rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 shadow-2xs cursor-pointer text-left"
                  >
                    <div className="flex items-center space-x-2 truncate min-w-0 mr-1">
                      <Building2 className={`h-4 w-4 shrink-0 ${selectedSupplierId !== 'walkin' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="truncate font-semibold">
                        {selectedSupplierId === 'walkin'
                          ? 'Direct / Walk-in Vendor (No Account)'
                          : selectedSupplierObj
                          ? selectedSupplierObj.name
                          : 'Select Supplier'}
                      </span>
                      {selectedSupplierObj && Number(selectedSupplierObj.balance) > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-mono font-bold shrink-0">
                          Due: KES {Number(selectedSupplierObj.balance).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  </button>

                  {/* Supplier Dropdown Menu */}
                  {isSupplierDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <div className="p-2 border-b border-slate-100 bg-slate-50/80">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search supplier by name or phone..."
                            value={supplierSearchQuery}
                            onChange={(e) => setSupplierSearchQuery(e.target.value)}
                            className="w-full rounded-lg bg-white border border-slate-200 pl-8 pr-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                            autoFocus
                          />
                        </div>
                      </div>

                      <div className="max-h-52 overflow-y-auto divide-y divide-slate-50 text-xs">
                        {/* Option: Walk-in / Direct receipt */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSupplierId('walkin');
                            setIsSupplierDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 cursor-pointer ${
                            selectedSupplierId === 'walkin' ? 'bg-emerald-50/60 text-emerald-950 font-bold' : 'text-slate-700'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="h-2 w-2 rounded-full bg-slate-300"></span>
                            <span>Direct / Walk-in Vendor (No Account)</span>
                          </div>
                          {selectedSupplierId === 'walkin' && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                        </button>

                        {/* Supplier List */}
                        {filteredSuppliers.length === 0 ? (
                          <div className="p-4 text-center text-slate-400">
                            <p>No matching suppliers found.</p>
                            <button
                              type="button"
                              onClick={() => {
                                setIsSupplierDropdownOpen(false);
                                setIsCreateSupplierModalOpen(true);
                              }}
                              className="mt-2 inline-flex items-center space-x-1 text-emerald-600 hover:text-emerald-700 font-bold text-xs cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                              <span>Create New Supplier</span>
                            </button>
                          </div>
                        ) : (
                          filteredSuppliers.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSelectedSupplierId(s.id);
                                setIsSupplierDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 cursor-pointer ${
                                selectedSupplierId === s.id ? 'bg-emerald-50/60 text-emerald-950 font-bold' : 'text-slate-800'
                              }`}
                            >
                              <div className="min-w-0 mr-2">
                                <div className="font-semibold text-slate-900 truncate">{s.name}</div>
                                <div className="text-[10px] text-slate-400 flex items-center space-x-2">
                                  {s.contact_person && <span>{s.contact_person}</span>}
                                  {s.phone && <span>• {s.phone}</span>}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                {Number(s.balance) > 0 ? (
                                  <span className="text-[10px] font-mono font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                    KES {Number(s.balance).toLocaleString()} due
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                    Clean
                                  </span>
                                )}
                              </div>
                            </button>
                          ))
                        )}
                      </div>

                      {/* Dropdown Footer Action */}
                      <div className="p-2 border-t border-slate-100 bg-slate-50/80 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setIsSupplierDropdownOpen(false);
                            setIsCreateSupplierModalOpen(true);
                          }}
                          className="w-full py-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>+ Register New Supplier</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Delivery Note / Invoice / PO # */}
                <div className="md:col-span-4">
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Delivery Note / Invoice # <span className="text-slate-400 font-normal text-[10px] lowercase">(optional)</span>
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. DN-2026-8819 / INV-4402"
                      value={grnReferenceId}
                      onChange={(e) => setGrnReferenceId(e.target.value)}
                      className="w-full rounded-xl bg-white border border-slate-300 pl-8.5 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-mono shadow-2xs"
                    />
                  </div>
                </div>

                {/* Delivery Remarks */}
                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Consignment Remarks <span className="text-slate-400 font-normal text-[10px] lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Morning shipment, Batch #3"
                    value={grnGeneralNote}
                    onChange={(e) => setGrnGeneralNote(e.target.value)}
                    className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>
              </div>

              {/* Searchable Product Consignment Bar */}
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-3.5 relative shrink-0" ref={productDropdownRef}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-emerald-950 flex items-center space-x-1.5">
                    <Package className="h-4 w-4 text-emerald-600" />
                    <span>+ Add Products to Delivery Consignment</span>
                  </label>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Type name or SKU to quick-add
                  </span>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-emerald-600" />
                  <input
                    type="text"
                    placeholder="Type product name, SKU, or model to search and add..."
                    value={productSearchTerm}
                    onFocus={() => setIsProductDropdownOpen(true)}
                    onChange={(e) => {
                      setProductSearchTerm(e.target.value);
                      setIsProductDropdownOpen(true);
                    }}
                    className="w-full rounded-xl bg-white border border-emerald-300 pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 shadow-2xs font-medium"
                  />
                  {productSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setProductSearchTerm('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Product Search Results Autocomplete Dropdown */}
                {isProductDropdownOpen && (
                  <div className="absolute left-3.5 right-3.5 top-full mt-1 z-30 rounded-xl bg-white border border-slate-200 shadow-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                    {searchedProductsForGRN.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 text-xs">
                        No products found matching "{productSearchTerm}"
                      </div>
                    ) : (
                      searchedProductsForGRN.map((p) => {
                        const isAlreadyAdded = grnLines.some(l => l.product_id === p.product_id);
                        return (
                          <button
                            key={p.product_id}
                            type="button"
                            disabled={isAlreadyAdded}
                            onClick={() => handleAddProductToGRN(p.product_id)}
                            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs transition-colors ${
                              isAlreadyAdded
                                ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                                : 'hover:bg-emerald-50/70 text-slate-800 cursor-pointer'
                            }`}
                          >
                            <div className="min-w-0 mr-3">
                              <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                                <span className="truncate">{p.product_name}</span>
                                {isAlreadyAdded && (
                                  <span className="text-[10px] font-normal text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded font-mono">
                                    Added
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center space-x-2">
                                {p.sku && <span>SKU: {p.sku}</span>}
                                <span>• Type: {p.unit_type === 'roll' ? `Roll (${p.meters_per_roll}m)` : `Piece (${p.unit})`}</span>
                              </div>
                            </div>

                            <div className="text-right shrink-0 space-y-0.5">
                              <div className="text-[11px] font-mono font-bold text-emerald-700">
                                Stock: {p.formatted_stock}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                BP: KES {Number(p.cost_price).toLocaleString()}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Multi-Line Items Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white flex-1 min-h-[140px] flex flex-col">
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="px-3.5 py-2.5">Delivered Product</th>
                        <th className="px-3.5 py-2.5 w-60">Received Quantity</th>
                        <th className="px-3.5 py-2.5 w-36">Buying Cost (BP)</th>
                        <th className="px-3.5 py-2.5 w-32 text-right">Line Total</th>
                        <th className="px-3 py-2.5 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {grnLines.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                            <Truck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                            <p className="font-semibold text-slate-600">No products added to this consignment note yet.</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Use the search bar above to select and add delivery products.
                            </p>
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
                              <td className="px-3.5 py-2.5">
                                <div className="font-bold text-slate-900">{line.product_name}</div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {line.sku ? `SKU: ${line.sku} | ` : ''}
                                  {line.unit_type === 'roll' ? `Roll (${line.meters_per_roll}m)` : `Piece (${line.unit})`}
                                </div>
                              </td>

                              <td className="px-3.5 py-2.5">
                                {line.unit_type === 'roll' ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center space-x-1.5">
                                      <input
                                        type="number"
                                        min="0"
                                        placeholder="Rolls"
                                        value={line.rolls}
                                        onChange={(e) => handleUpdateGRNLine(line.product_id, 'rolls', e.target.value)}
                                        className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-600 text-center shadow-2xs font-bold"
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
                                        className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-600 text-center shadow-2xs font-bold"
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
                                      className="w-28 rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-600 font-bold shadow-2xs"
                                    />
                                    <span className="text-[11px] text-slate-500 font-medium">{line.unit}</span>
                                  </div>
                                )}
                              </td>

                              <td className="px-3.5 py-2.5">
                                <div className="space-y-0.5">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Cost"
                                    value={line.unit_cost}
                                    onChange={(e) => handleUpdateGRNLine(line.product_id, 'unit_cost', e.target.value)}
                                    className="w-28 rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-600 shadow-2xs font-bold"
                                  />
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {line.unit_type === 'roll' ? 'per roll' : `per ${line.unit}`}
                                  </div>
                                </div>
                              </td>

                              <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">
                                KES {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>

                              <td className="px-3 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveGRNLine(line.product_id)}
                                  className="text-slate-400 hover:text-rose-600 font-bold text-xs cursor-pointer p-1 rounded-md hover:bg-rose-50"
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
              <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-900 text-white p-3.5 rounded-xl gap-3 shrink-0 shadow-lg">
                <div className="flex items-center space-x-6 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Items</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">{grnLines.length} products</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Consignment Value</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      KES {calculateTotalGRNValue().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setIsReceiveModalOpen(false)}
                    className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingGRN || grnLines.length === 0}
                    className="flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-md cursor-pointer disabled:opacity-50 active:scale-[0.98] transition-all"
                  >
                    {submittingGRN ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    <span>{submittingGRN ? 'Posting GRN & Ledger...' : 'Post Goods Received Note (GRN)'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick On-the-Spot Supplier Creation Modal */}
      {isCreateSupplierModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  <span>Register New Supplier / Vendor</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Instantly creates supplier profile and selects for current GRN
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {createSupplierError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 font-medium">
                {createSupplierError}
              </div>
            )}

            <form onSubmit={handleCreateSupplier} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                  Supplier / Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SolarMax Kenya Ltd"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-medium shadow-2xs"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0712345678"
                    value={newSupplierPhone}
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={newSupplierContact}
                    onChange={(e) => setNewSupplierContact(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. info@solarmax.ke"
                    value={newSupplierEmail}
                    onChange={(e) => setNewSupplierEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Tax PIN / KRA
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. P051234567Z"
                    value={newSupplierTaxPin}
                    onChange={(e) => setNewSupplierTaxPin(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-mono uppercase shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                  Physical Address / Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Industrial Area, Road A, Nairobi"
                  value={newSupplierAddress}
                  onChange={(e) => setNewSupplierAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 shadow-2xs"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateSupplierModalOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingSupplier || !newSupplierName.trim()}
                  className="flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-md cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                >
                  {creatingSupplier ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  <span>{creatingSupplier ? 'Creating...' : 'Create & Select'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Universal Goods Received Note (GRN) Document Viewer Drawer */}
      <GRNDocumentDrawer
        grn={selectedGRNForDrawer}
        isOpen={isGRNDrawerOpen}
        onClose={() => {
          setIsGRNDrawerOpen(false);
          setSelectedGRNForDrawer(null);
        }}
      />

      {/* Universal Product Telemetry & History Drawer */}
      <ProductHistoryDrawer
        productId={historyDrawerProductId}
        isOpen={!!historyDrawerProductId}
        onClose={() => setHistoryDrawerProductId(null)}
      />
    </div>
  );
};
