import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import type { Product, Supplier, Category, GoodsReceivedNote } from '../types';
import { RapidItemGrid, type GridItem } from './RapidItemGrid';
import { QuickProductModal } from './QuickProductModal';
import { QuickSupplierModal } from './QuickSupplierModal';
import { ExcelPasteModal } from './ExcelPasteModal';
import { PackageCheck, X, Plus, Loader2, FileText } from 'lucide-react';

interface DirectGRNModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  suppliers: Supplier[];
  categories: Category[];
  onGRNPosted: (grn: GoodsReceivedNote) => void;
  onRefreshData: () => void;
}

export const DirectGRNModal: React.FC<DirectGRNModalProps> = ({
  isOpen,
  onClose,
  products,
  suppliers,
  categories,
  onGRNPosted,
  onRefreshData
}) => {
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<GridItem[]>([]);

  // Sub-Modals
  const [isQuickProductOpen, setIsQuickProductOpen] = useState(false);
  const [isQuickSupplierOpen, setIsQuickSupplierOpen] = useState(false);
  const [isExcelPasteOpen, setIsExcelPasteOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with 1 blank row
  useEffect(() => {
    if (isOpen) {
      setSupplierId('');
      setInvoiceNumber('');
      setNotes('');
      setItems([{
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
        total_cost: 0,
        is_new: true
      }]);
      setError(null);
    }
  }, [isOpen]);

  // Global Ctrl+Enter shortcut to post GRN
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
  }, [isOpen, supplierId, invoiceNumber, notes, items]);

  if (!isOpen) return null;

  const handleProductCreated = (newProd: Product) => {
    onRefreshData();
    // Replace first empty row or append
    const emptyIdx = items.findIndex(it => !it.product_id);
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
      unit_cost: Number(newProd.cost_price),
      cost_per_meter: isRoll && mpr > 0 ? Number(newProd.cost_price) / mpr : 0,
      total_cost: Number(newProd.cost_price),
      current_stock: newProd.current_stock,
      formatted_stock: newProd.formatted_stock,
      current_bp: newProd.cost_price,
      is_new: false
    };

    if (emptyIdx >= 0) {
      const updated = [...items];
      updated[emptyIdx] = newGridItem;
      setItems(updated);
    } else {
      setItems([...items, newGridItem]);
    }
  };

  const handleSupplierCreated = (newSupplier: Supplier) => {
    onRefreshData();
    setSupplierId(newSupplier.id);
  };

  const handleExcelImport = (importedItems: GridItem[]) => {
    // Filter out initial empty rows and combine
    const existingValid = items.filter(it => it.product_id !== null);
    setItems([...existingValid, ...importedItems]);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const validItems = items.filter(it => it.product_id !== null && it.quantity > 0);
    if (validItems.length === 0) {
      setError('Please add at least one valid product line with quantity greater than 0');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        po_id: null,
        supplier_id: supplierId ? Number(supplierId) : null,
        invoice_number: invoiceNumber.trim() || null,
        notes: notes.trim() || null,
        items: validItems.map(it => ({
          product_id: it.product_id,
          unit_type: it.unit_type,
          quantity_received: Number(it.quantity),
          rolls_received: Number(it.rolls || 0),
          loose_meters_received: Number(it.loose_meters || 0),
          unit_cost: Number(it.unit_cost)
        }))
      };

      const result = await apiFetch<GoodsReceivedNote>('/api/v1/purchases/grn', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      onGRNPosted(result);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to post Direct Goods Received Note');
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
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                  <PackageCheck className="h-5 w-5" />
                </div>
                Direct Goods Inward (Straight to GRN)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Post incoming vendor delivery straight into inventory stock and update supplier ledger balance
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
                    Vendor / Supplier
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickSupplierOpen(true)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" />
                    New
                  </button>
                </div>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                >
                  <option value="">Direct / Cash Vendor (No Account)</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.balance > 0 ? `(Bal: KES ${s.balance.toLocaleString()})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Delivery Note / Invoice Number */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Vendor Invoice / Delivery Note #
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. DN-99420 or INV-1048"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Inward Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Receiving Notes / Condition
                </label>
                <input
                  type="text"
                  placeholder="e.g. Inspected on counter, cartons intact"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Rapid Item Grid */}
            <RapidItemGrid
              mode="grn"
              products={products}
              items={items}
              onChange={setItems}
              onAddNewProduct={() => setIsQuickProductOpen(true)}
              onOpenExcelPaste={() => setIsExcelPasteOpen(true)}
            />
          </div>

          {/* Modal Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-500 font-medium">
              Keyboard shortcut: Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[10px] text-slate-800">Ctrl + Enter</kbd> to post immediately
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
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing Inward Stock...</span>
                  </>
                ) : (
                  <>
                    <PackageCheck className="h-4 w-4" />
                    <span>Post & Accept Inward Stock [Ctrl+Enter]</span>
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

      <ExcelPasteModal
        isOpen={isExcelPasteOpen}
        onClose={() => setIsExcelPasteOpen(false)}
        products={products}
        onImport={handleExcelImport}
      />
    </>
  );
};
