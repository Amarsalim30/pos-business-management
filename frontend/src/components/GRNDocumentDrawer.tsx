import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../services/api';
import type { GoodsReceivedNote, PurchaseExpense } from '../types';
import { COMPANY_CONSTANTS } from '../constants/companyConstants';
import {
  Printer,
  X,
  Truck,
  FileText,
  Zap,
  Copy,
  Check,
  Download,
  Share2,
  Layers,
  Building2,
  ArrowRight,
  Edit,
  Trash2,
  Plus,
  DollarSign,
  Loader2
} from 'lucide-react';

export interface GRNDocumentDrawerProps {
  grn?: GoodsReceivedNote | null;
  isOpen: boolean;
  onClose: () => void;
  defaultFormat?: 'a4' | 'thermal';
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
  storeTaxId?: string;
  onViewSupplierStatement?: (supplierId: number) => void;
  onEditGRN?: (grn: GoodsReceivedNote) => void;
  onDeleteGRN?: (grn: GoodsReceivedNote) => void;
  onRefreshData?: () => void;
}

export const GRNDocumentDrawer: React.FC<GRNDocumentDrawerProps> = ({
  grn,
  isOpen,
  onClose,
  defaultFormat = 'a4',
  storeName = COMPANY_CONSTANTS.companyName,
  storePhone = COMPANY_CONSTANTS.phone,
  storeAddress = COMPANY_CONSTANTS.address,
  storeTaxId = COMPANY_CONSTANTS.taxId,
  onViewSupplierStatement,
  onEditGRN,
  onDeleteGRN,
  onRefreshData
}) => {
  const [activeFormat, setActiveFormat] = useState<'a4' | 'thermal'>(defaultFormat);
  const [copied, setCopied] = useState(false);
  const [currentGRN, setCurrentGRN] = useState<GoodsReceivedNote | null>(null);
  const thermalSlipRef = useRef<HTMLDivElement>(null);

  // Expense Modal state inside Drawer
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<PurchaseExpense | null>(null);
  const [expCategory, setExpCategory] = useState('transport');
  const [expDescription, setExpDescription] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPaymentMethod, setExpPaymentMethod] = useState('cash');
  const [expReference, setExpReference] = useState('');
  const [savingExp, setSavingExp] = useState(false);
  const [expError, setExpError] = useState<string | null>(null);

  useEffect(() => {
    setActiveFormat(defaultFormat);
    setCurrentGRN(grn || null);
  }, [defaultFormat, grn]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isExpenseModalOpen) {
          setIsExpenseModalOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExpenseModalOpen, onClose]);

  if (!isOpen || !currentGRN) return null;

  const totalAmount = Number(currentGRN.total_amount || 0);
  const expensesList = currentGRN.expenses || [];
  const totalExpenses = expensesList.reduce((acc, exp) => acc + Number(exp.amount || 0), 0);
  const totalLandedCost = totalAmount + totalExpenses;
  const itemsCount = currentGRN.items ? currentGRN.items.length : 0;

  const deliveryDateFormatted = new Date(currentGRN.delivery_date || currentGRN.created_at).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const handlePrint = () => {
    window.print();
  };

  const handleCopyGRNNo = () => {
    navigator.clipboard.writeText(currentGRN.grn_no);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reloadGRNDetails = async () => {
    try {
      const refreshed = await apiFetch<GoodsReceivedNote>(`/api/v1/purchases/grn/${currentGRN.id}`);
      setCurrentGRN(refreshed);
      if (onRefreshData) onRefreshData();
    } catch (e) {
      console.error('Failed to reload GRN details', e);
    }
  };

  const handleOpenAddExpense = () => {
    setEditingExpense(null);
    setExpCategory('transport');
    setExpDescription('');
    setExpAmount('');
    setExpPaymentMethod('cash');
    setExpReference('');
    setExpError(null);
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditExpense = (exp: PurchaseExpense) => {
    setEditingExpense(exp);
    setExpCategory(exp.category);
    setExpDescription(exp.description);
    setExpAmount(String(exp.amount));
    setExpPaymentMethod(exp.payment_method);
    setExpReference(exp.reference || '');
    setExpError(null);
    setIsExpenseModalOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(expAmount);
    if (!amt || amt <= 0) {
      setExpError('Please enter a valid amount greater than 0');
      return;
    }

    setSavingExp(true);
    setExpError(null);
    try {
      if (editingExpense) {
        await apiFetch(`/api/v1/purchases/expenses/${editingExpense.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            category: expCategory,
            description: expDescription.trim() || undefined,
            amount: amt,
            payment_method: expPaymentMethod,
            reference: expReference.trim() || null
          })
        });
      } else {
        await apiFetch(`/api/v1/purchases/grn/${currentGRN.id}/expenses`, {
          method: 'POST',
          body: JSON.stringify({
            category: expCategory,
            description: expDescription.trim() || undefined,
            amount: amt,
            payment_method: expPaymentMethod,
            reference: expReference.trim() || null
          })
        });
      }

      setIsExpenseModalOpen(false);
      await reloadGRNDetails();
    } catch (err: any) {
      setExpError(err.message || 'Failed to save landed expense');
    } finally {
      setSavingExp(false);
    }
  };

  const handleDeleteExpense = async (expenseId: number) => {
    if (!window.confirm('Are you sure you want to remove this landed expense?')) return;
    try {
      await apiFetch(`/api/v1/purchases/expenses/${expenseId}`, {
        method: 'DELETE'
      });
      await reloadGRNDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense');
    }
  };

  const handleShareWhatsApp = () => {
    const itemsList = (currentGRN.items || []).map((it, idx) => {
      const pack = it.unit_type === 'roll'
        ? `${it.rolls_received || 0} rolls + ${Number(it.loose_meters_received || 0).toFixed(1)}m`
        : `${it.quantity_received} ${it.unit || 'pcs'}`;
      return `${idx + 1}. ${it.product_name} (${pack}) @ KES ${Number(it.unit_cost).toLocaleString()} = KES ${Number(it.total_cost).toLocaleString()}`;
    }).join('\n');

    const expensesSummary = expensesList.length > 0
      ? `\n*Landed Expenses (${expensesList.length}):* KES ${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` +
        `*Total Landed Cost:* KES ${totalLandedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`
      : '';

    const text = `*GOODS RECEIVED NOTE (GRN)*
*${storeName}*
*GRN No: #${currentGRN.grn_no}*
Supplier: ${currentGRN.supplier_name || 'Direct / Walk-in'}
${currentGRN.invoice_number ? `Delivery Note / Inv: ${currentGRN.invoice_number}\n` : ''}${currentGRN.po_no ? `PO Ref: ${currentGRN.po_no}\n` : ''}Date: ${deliveryDateFormatted}
Received By: ${currentGRN.receiver_name || 'Warehouse Staff'}
---------------------------------
*Delivered Items (${itemsCount}):*
${itemsList}
---------------------------------
*Goods Consignment Valuation: KES ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}*${expensesSummary}
${currentGRN.notes ? `Remarks: "${currentGRN.notes}"\n` : ''}---------------------------------
Physical delivery verified and recorded in stock inventory.`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden print:static print:inset-auto print:overflow-visible">
      {/* Dark backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity print:hidden animate-in fade-in duration-200"
      />

      {/* Slide-over Panel Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 print:static print:pl-0">
        <div className="w-screen max-w-4xl bg-slate-100 shadow-2xl flex flex-col print:shadow-none print:bg-white print:max-w-none print:w-full animate-in slide-in-from-right duration-200">
          
          {/* Top Control Bar (Screen Only) */}
          <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between shadow-md print:hidden shrink-0">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black text-xs">
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm tracking-tight text-white font-mono">
                    GRN #{currentGRN.grn_no}
                  </span>
                  <button
                    onClick={handleCopyGRNNo}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                    title="Copy GRN Number"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    CONSIGNMENT RECEIVED
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                  {currentGRN.supplier_name || 'Direct Delivery'} • KES {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({itemsCount} items)
                  {totalExpenses > 0 && ` • Landed Cost: KES ${totalLandedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                </div>
              </div>
            </div>

            {/* Format Toggle Pill */}
            <div className="flex items-center space-x-3">
              <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                <button
                  onClick={() => setActiveFormat('a4')}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeFormat === 'a4'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>A4 Delivery Slip</span>
                </button>
                <button
                  onClick={() => setActiveFormat('thermal')}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeFormat === 'thermal'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>80mm Gate Pass</span>
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Quick Action Command Strip (Screen Only) */}
          <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 print:hidden shrink-0 shadow-xs">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <button
                onClick={handlePrint}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print ({activeFormat === 'a4' ? 'A4 Slip' : 'Thermal'})</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Export / Save PDF"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>Export PDF</span>
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Share Delivery Slip via WhatsApp"
              >
                <Share2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddExpense}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Add landed cost (Transport, Offloading, Customs, etc.)"
              >
                <DollarSign className="h-3.5 w-3.5 text-amber-700" />
                <span>+ Add Landed Expense</span>
              </button>

              {onEditGRN && (
                <button
                  type="button"
                  onClick={() => onEditGRN(currentGRN)}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  title="Edit GRN / Inward Stock"
                >
                  <Edit className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Edit GRN</span>
                </button>
              )}

              {onDeleteGRN && (
                <button
                  type="button"
                  onClick={() => onDeleteGRN(currentGRN)}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  title="Delete GRN (Reverse Stock)"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                  <span>Delete GRN</span>
                </button>
              )}
            </div>

            {/* Contextual Action (Open Supplier Statement) */}
            {currentGRN.supplier_id && onViewSupplierStatement && (
              <button
                onClick={() => onViewSupplierStatement(currentGRN.supplier_id!)}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Supplier Statement</span>
                <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
              </button>
            )}
          </div>

          {/* Main Scrollable Document Canvas */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 print:p-0 print:overflow-visible space-y-6">
            {activeFormat === 'a4' ? (
              /* A4 Formal Goods Received Note View */
              <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl border border-slate-200 shadow-md print:shadow-none print:border-none print:p-0 space-y-6">
                {/* Header Top Section */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
                  <div>
                    <span className="text-xs font-black uppercase tracking-widest text-amber-600">INBOUND CONSIGNMENT</span>
                    <h1 className="text-2xl font-black text-slate-950 tracking-tight mt-0.5">GOODS RECEIVED NOTE</h1>
                    <div className="text-xs text-slate-600 font-medium mt-1">{storeName}</div>
                    <div className="text-xs text-slate-500">{storeAddress} • Tel: {storePhone}</div>
                    <div className="text-xs text-slate-500 font-mono">Tax PIN: {storeTaxId}</div>
                  </div>

                  <div className="text-right space-y-1">
                    <div className="inline-block bg-slate-900 text-white px-3 py-1 rounded-lg text-xs font-mono font-bold">
                      {currentGRN.grn_no}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-1">
                      Received: <strong>{deliveryDateFormatted}</strong>
                    </div>
                    {currentGRN.invoice_number && (
                      <div className="text-xs text-slate-700 font-mono">
                        Delivery Note / Inv: <strong className="text-slate-950">{currentGRN.invoice_number}</strong>
                      </div>
                    )}
                    {currentGRN.po_no && (
                      <div className="text-xs text-slate-700 font-mono">
                        PO Number: <strong className="text-slate-950">{currentGRN.po_no}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2-Column Vendor & Receiving Info */}
                <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Supplier / Vendor:</div>
                    <div className="text-sm font-bold text-slate-900">{currentGRN.supplier_name || 'Direct / Walk-in Vendor'}</div>
                    <div className="text-slate-500">Account ID: #{currentGRN.supplier_id || 'N/A'}</div>
                  </div>

                  <div className="space-y-1 text-right sm:text-left sm:pl-4 sm:border-l sm:border-slate-200">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Warehouse Receiving:</div>
                    <div className="font-semibold text-slate-800">
                      Receiver: <strong className="text-slate-950">{currentGRN.receiver_name || 'Staff Member'}</strong>
                    </div>
                    {currentGRN.notes && (
                      <div className="text-slate-500 italic mt-1">
                        Remarks: "{currentGRN.notes}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Itemized Table */}
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-700">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Item Description</th>
                        <th className="py-2.5 px-3">Packaging / Form</th>
                        <th className="py-2.5 px-3 text-right">Received Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit BP (KES)</th>
                        <th className="py-2.5 px-3 text-right">Line Total (KES)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {currentGRN.items.map((it, idx) => (
                        <tr key={it.id || idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{it.product_name || `Product #${it.product_id}`}</div>
                            {it.product_sku && <div className="text-[10px] text-slate-400 font-mono">SKU: {it.product_sku}</div>}
                          </td>
                          <td className="py-2.5 px-3">
                            {it.unit_type === 'roll' ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 text-[11px] font-semibold">
                                <Layers className="h-3 w-3 text-sky-600" />
                                {it.rolls_received || 0} rolls + {Number(it.loose_meters_received || 0).toFixed(1)}m loose
                              </span>
                            ) : (
                              <span className="text-slate-600">Piece ({it.unit || 'pcs'})</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {it.unit_type === 'roll'
                              ? `${Number(it.quantity_received).toFixed(1)}m`
                              : `${Number(it.quantity_received)} ${it.unit || 'pcs'}`}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                            {Number(it.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-950">
                            {Number(it.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Landed Expenses / Additional Costs Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-amber-700" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Landed Expenses / Additional Costs ({expensesList.length})
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenAddExpense}
                      className="print:hidden inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Expense</span>
                    </button>
                  </div>

                  {expensesList.length === 0 ? (
                    <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                      No additional landed expenses recorded for this GRN.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-700">
                            <th className="py-2 px-3">Category</th>
                            <th className="py-2 px-3">Description / Reference</th>
                            <th className="py-2 px-3">Payment</th>
                            <th className="py-2 px-3 text-right">Amount (KES)</th>
                            <th className="py-2 px-3 text-right print:hidden">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {expensesList.map((exp) => (
                            <tr key={exp.id} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 font-bold text-slate-800 capitalize">
                                {exp.category}
                              </td>
                              <td className="py-2 px-3 text-slate-600">
                                {exp.description}
                                {exp.reference && <span className="text-slate-400 font-mono text-[10px] ml-1">({exp.reference})</span>}
                              </td>
                              <td className="py-2 px-3 text-slate-500 uppercase text-[10px] font-semibold">
                                {exp.payment_method}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                {Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-3 text-right print:hidden">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleOpenEditExpense(exp)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100"
                                    title="Edit Expense"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteExpense(exp.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100"
                                    title="Delete Expense"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Valuation & Landed Cost Breakdown Card */}
                <div className="flex justify-end">
                  <div className="w-80 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600 font-medium">
                      <span>Goods Valuation ({itemsCount} items):</span>
                      <span className="font-mono font-bold text-slate-900">
                        KES {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {totalExpenses > 0 && (
                      <div className="flex justify-between text-amber-800 font-medium">
                        <span>Landed Expenses ({expensesList.length}):</span>
                        <span className="font-mono font-bold">
                          + KES {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-slate-950 text-sm">
                      <span>Total Landed Cost:</span>
                      <span className="font-mono text-emerald-700">
                        KES {totalLandedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Audit & Physical Delivery Verification Signatures */}
                <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-dashed border-slate-300 text-xs">
                  <div className="space-y-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Delivered By (Driver / Supplier Agent):</div>
                    <div className="border-b border-slate-400 h-8"></div>
                    <div className="text-[11px] text-slate-600">Name & Signature / Date</div>
                  </div>

                  <div className="space-y-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Received & Verified By (Storekeeper / Manager):</div>
                    <div className="border-b border-slate-400 h-8"></div>
                    <div className="text-[11px] text-slate-600">Official Stamp & Signature / Date</div>
                  </div>
                </div>

                <div className="mt-8 text-center text-[10px] text-slate-400">
                  Document generated by POS Business Management System • Inbound Stock Ledger Audit Certified
                </div>
              </div>
            ) : (
              /* 80mm Thermal Delivery Slip View */
              <div className="flex justify-center print:block">
                <div
                  ref={thermalSlipRef}
                  className="bg-white p-6 max-w-sm w-full shadow-md border border-slate-200 font-mono text-[11px] leading-tight text-slate-900 print:shadow-none print:border-none print:p-1 print:m-0"
                >
                  <div className="text-center space-y-1 pb-3 border-b-2 border-dashed border-slate-300">
                    <h2 className="font-black text-sm uppercase tracking-tight text-slate-950">{storeName}</h2>
                    <p className="text-[10px] text-slate-600 font-medium">{storeAddress}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-800 mt-1">GOODS RECEIVED NOTE (GRN)</p>
                    <p className="text-xs font-bold text-slate-900">GRN #{currentGRN.grn_no}</p>
                  </div>

                  <div className="py-2.5 space-y-1 border-b border-dashed border-slate-300 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Supplier:</span>
                      <span className="font-bold truncate max-w-[170px]">{currentGRN.supplier_name || 'Direct'}</span>
                    </div>
                    {currentGRN.invoice_number && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">DN / Inv:</span>
                        <span className="font-bold">{currentGRN.invoice_number}</span>
                      </div>
                    )}
                    {currentGRN.po_no && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">PO Ref:</span>
                        <span className="font-bold">{currentGRN.po_no}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Date:</span>
                      <span>{deliveryDateFormatted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Receiver:</span>
                      <span>{currentGRN.receiver_name || 'Staff'}</span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="py-3 border-b-2 border-dashed border-slate-300 space-y-2">
                    <div className="text-[10px] font-bold uppercase text-slate-500 flex justify-between border-b pb-1">
                      <span>Item</span>
                      <span>Total</span>
                    </div>
                    {currentGRN.items.map((it, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="font-bold text-slate-900">{it.product_name}</div>
                        <div className="flex justify-between text-[10px] text-slate-600">
                          <span>
                            {it.unit_type === 'roll'
                              ? `${it.rolls_received || 0}r + ${Number(it.loose_meters_received || 0).toFixed(1)}m (${Number(it.quantity_received).toFixed(1)}m)`
                              : `${Number(it.quantity_received)} ${it.unit || 'pcs'}`}
                            {' '}@ {Number(it.unit_cost).toLocaleString()}
                          </span>
                          <span className="font-bold font-mono text-slate-950">
                            {Number(it.total_cost).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Thermal Total */}
                  <div className="py-3 space-y-1 text-right border-b-2 border-dashed border-slate-300">
                    <div className="flex justify-between text-xs font-bold text-slate-800">
                      <span>GOODS VALUE:</span>
                      <span>KES {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    {totalExpenses > 0 && (
                      <div className="flex justify-between text-[10px] font-semibold text-amber-800">
                        <span>EXPENSES:</span>
                        <span>+ KES {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-black text-slate-950 pt-1 border-t">
                      <span>TOTAL LANDED:</span>
                      <span>KES {totalLandedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div className="pt-4 text-center text-[10px] text-slate-500 space-y-1">
                    <p className="font-bold">PHYSICAL STOCK VERIFIED</p>
                    <p>Driver Sign: _______________</p>
                    <p>Receiver Sign: _____________</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit Expense Sub-Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingExpense ? 'Edit Landed Expense' : 'Add Landed Expense to GRN'}
                  </h3>
                  <p className="text-xs text-slate-500">GRN #{currentGRN.grn_no}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {expError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                {expError}
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Expense Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="transport">Freight / Transport</option>
                  <option value="labour">Labour / Offloading</option>
                  <option value="customs">Customs / Clearance</option>
                  <option value="packaging">Handling / Packaging</option>
                  <option value="other">Other Landed Cost</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount (KES) *</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="e.g. 1500"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Matatu transport from Industrial Area"
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={expPaymentMethod}
                    onChange={(e) => setExpPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value="cash">Cash / Petty Cash</option>
                    <option value="mpesa">M-Pesa</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="credit">Supplier Payable</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ref / Receipt #</label>
                  <input
                    type="text"
                    placeholder="e.g. TX123456"
                    value={expReference}
                    onChange={(e) => setExpReference(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingExp}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingExp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  <span>{editingExpense ? 'Update Expense' : 'Save Landed Expense'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
