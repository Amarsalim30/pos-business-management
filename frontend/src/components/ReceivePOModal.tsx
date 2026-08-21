import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import type { PurchaseOrder, GoodsReceivedNote, Product } from '../types';
import { RapidItemGrid, type GridItem } from './RapidItemGrid';
import { PackageCheck, X, Loader2, FileText, CheckCircle2 } from 'lucide-react';

interface ReceivePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrder: PurchaseOrder | null;
  products: Product[];
  onGRNPosted: (grn: GoodsReceivedNote) => void;
}

export const ReceivePOModal: React.FC<ReceivePOModalProps> = ({
  isOpen,
  onClose,
  purchaseOrder,
  products,
  onGRNPosted
}) => {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<GridItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && purchaseOrder) {
      setInvoiceNumber('');
      setNotes('');
      setError(null);

      // Prepopulate items with pending quantities
      const gridItems: GridItem[] = purchaseOrder.items.map(it => {
        const pendingQty = Math.max(0, Number(it.ordered_qty) - Number(it.received_qty));
        const prod = products.find(p => p.id === it.product_id);
        const isRoll = it.unit_type === 'roll';
        const mpr = prod?.meters_per_roll || 100;
        const rolls = isRoll && mpr > 0 ? Math.floor(pendingQty / mpr) : 0;
        const loose = isRoll && mpr > 0 ? pendingQty % mpr : 0;
        const unitCost = Number(it.unit_cost) || 0;
        const totalCost = isRoll && mpr > 0
          ? (pendingQty / mpr) * unitCost
          : pendingQty * unitCost;

        return {
          id: `po_item_${it.id}`,
          product_id: it.product_id,
          product_name: it.product_name || (prod ? prod.name : `Product #${it.product_id}`),
          product_sku: it.product_sku || (prod ? prod.sku || '' : ''),
          unit_type: it.unit_type,
          meters_per_roll: mpr,
          quantity: pendingQty,
          rolls: rolls,
          loose_meters: loose,
          unit_cost: unitCost,
          cost_per_meter: isRoll && mpr > 0 ? unitCost / mpr : 0,
          total_cost: totalCost,
          current_stock: prod?.current_stock,
          formatted_stock: prod?.formatted_stock,
          current_bp: prod?.cost_price,
          is_new: false
        };
      });

      setItems(gridItems);
    }
  }, [isOpen, purchaseOrder, products]);

  // Global Ctrl+Enter shortcut
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
  }, [isOpen, purchaseOrder, invoiceNumber, notes, items]);

  if (!isOpen || !purchaseOrder) return null;

  const handleReceiveAllFull = () => {
    // Reset all items to full remaining ordered quantities
    const updated = items.map(it => {
      const origPOItem = purchaseOrder.items.find(p => p.product_id === it.product_id);
      const pendingQty = origPOItem ? Math.max(0, Number(origPOItem.ordered_qty) - Number(origPOItem.received_qty)) : it.quantity;
      const isRoll = it.unit_type === 'roll';
      const mpr = it.meters_per_roll || 100;
      return {
        ...it,
        quantity: pendingQty,
        rolls: isRoll && mpr > 0 ? Math.floor(pendingQty / mpr) : 0,
        loose_meters: isRoll && mpr > 0 ? pendingQty % mpr : 0,
        total_cost: isRoll && mpr > 0 ? (pendingQty / mpr) * it.unit_cost : pendingQty * it.unit_cost
      };
    });
    setItems(updated);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const validItems = items.filter(it => it.product_id !== null && it.quantity > 0);
    if (validItems.length === 0) {
      setError('Please specify received quantities greater than 0 for at least one item');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        po_id: purchaseOrder.id,
        supplier_id: purchaseOrder.supplier_id,
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
      setError(err.message || 'Failed to process Goods Received Note against PO');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl max-w-5xl w-full p-6 max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                <PackageCheck className="h-5 w-5" />
              </div>
              Receive Goods Against PO <span className="font-mono text-indigo-700">#{purchaseOrder.po_no}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Supplier: <strong className="text-slate-800">{purchaseOrder.supplier_name}</strong> • Verify physical delivered stock against ordered amounts
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Top Info Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50/60 p-4 rounded-2xl border border-slate-200/80">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Supplier Delivery Note / Invoice #
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

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Receiving / Inspection Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Delivered complete and verified in good working condition"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Verify Line Item Quantities Received:
            </span>
            <button
              type="button"
              onClick={handleReceiveAllFull}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Fill 100% Remaining Quantities
            </button>
          </div>

          {/* Rapid Item Grid */}
          <RapidItemGrid
            mode="receive_po"
            products={products}
            items={items}
            onChange={setItems}
            readOnlyProducts={true}
          />
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <div className="text-xs text-slate-500 font-medium">
            Keyboard shortcut: Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-[10px] text-slate-800">Ctrl + Enter</kbd> to accept
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
                  <span>Processing GRN...</span>
                </>
              ) : (
                <>
                  <PackageCheck className="h-4 w-4" />
                  <span>Accept & Add to Inventory [Ctrl+Enter]</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
