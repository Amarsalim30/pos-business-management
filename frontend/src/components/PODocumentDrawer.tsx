import React, { useState, useEffect, useRef } from 'react';
import type { PurchaseOrder } from '../types';
import { COMPANY_CONSTANTS } from '../constants/companyConstants';
import {
  Printer,
  X,
  ShoppingBag,
  Zap,
  Copy,
  Check,
  Share2,
  Building2,
  Truck,
  PackageCheck,
  AlertCircle,
  Edit,
  Trash2
} from 'lucide-react';

export interface PODocumentDrawerProps {
  po?: PurchaseOrder | null;
  isOpen: boolean;
  onClose: () => void;
  defaultFormat?: 'a4' | 'thermal';
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
  storeTaxId?: string;
  onReceivePO?: (po: PurchaseOrder) => void;
  onViewSupplierStatement?: (supplierId: number) => void;
  onEditPO?: (po: PurchaseOrder) => void;
  onDeletePO?: (po: PurchaseOrder) => void;
}

export const PODocumentDrawer: React.FC<PODocumentDrawerProps> = ({
  po,
  isOpen,
  onClose,
  defaultFormat = 'a4',
  storeName = COMPANY_CONSTANTS.companyName,
  storePhone = COMPANY_CONSTANTS.phone,
  storeAddress = COMPANY_CONSTANTS.address,
  storeTaxId = COMPANY_CONSTANTS.taxId,
  onReceivePO,
  onViewSupplierStatement,
  onEditPO,
  onDeletePO
}) => {
  const [activeFormat, setActiveFormat] = useState<'a4' | 'thermal'>(defaultFormat);
  const [copied, setCopied] = useState(false);
  const thermalSlipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveFormat(defaultFormat);
  }, [defaultFormat, po?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !po) return null;

  const totalAmount = Number(po.total_amount || 0);
  const totalExpenses = (po.expenses || []).reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  const netLandedCost = totalAmount + totalExpenses;
  const itemsCount = po.items ? po.items.length : 0;

  const orderDateFormatted = new Date(po.created_at).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const expectedDateFormatted = po.expected_delivery_date
    ? new Date(po.expected_delivery_date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : 'Not Specified';

  const handlePrint = () => {
    window.print();
  };

  const handleCopyPONo = () => {
    navigator.clipboard.writeText(po.po_no);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const itemsList = (po.items || []).map((it, idx) => {
      return `${idx + 1}. ${it.product_name} (${it.ordered_qty} ${it.unit_type === 'roll' ? 'meters' : 'pcs'}) @ KES ${Number(it.unit_cost).toLocaleString()} = KES ${Number(it.total_cost).toLocaleString()}`;
    }).join('\n');

    const text = `*OFFICIAL PURCHASE ORDER (PO)*
*${storeName}*
*PO No: #${po.po_no}*
Vendor / Supplier: ${po.supplier_name || 'Generic Vendor'}
Order Date: ${orderDateFormatted}
Expected Delivery: ${expectedDateFormatted}
Purchasing Officer: ${po.authorizer_name || 'Procurement Dept'}
---------------------------------
*Ordered Line Items (${itemsCount}):*
${itemsList}
---------------------------------
*Total Order Amount: KES ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}*
${po.notes ? `\nInstructions: ${po.notes}` : ''}`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold uppercase tracking-wider">Fully Received</span>;
      case 'partial':
        return <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold uppercase tracking-wider">Partially Received</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold uppercase tracking-wider">Cancelled</span>;
      case 'ordered':
      default:
        return <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold uppercase tracking-wider">Pending Delivery</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex justify-end animate-in fade-in duration-200 print:p-0 print:bg-white print:static print:z-auto">
      <div className="bg-slate-100 w-full max-w-4xl h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200 print:w-full print:max-w-none print:shadow-none print:border-none print:static">
        {/* Drawer Top Navigation & Format Bar (Hidden during print) */}
        <div className="bg-white px-6 py-3.5 border-b border-slate-200 flex items-center justify-between shadow-2xs shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900 text-sm">{po.po_no}</span>
                {getStatusBadge(po.status)}
                {po.is_etr && (
                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-bold uppercase">
                    ETR Official
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 font-medium">Purchase Order Document</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Format Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveFormat('a4')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeFormat === 'a4' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                A4 Document
              </button>
              <button
                type="button"
                onClick={() => setActiveFormat('thermal')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeFormat === 'thermal' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                80mm Thermal Slip
              </button>
            </div>

            {/* Quick Actions */}
            <button
              type="button"
              onClick={handleCopyPONo}
              className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              title="Copy PO Number"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="p-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
              title="Share via WhatsApp"
            >
              <Share2 className="h-4 w-4" />
            </button>

            {onEditPO && po.status !== 'cancelled' && (
              <button
                type="button"
                onClick={() => onEditPO(po)}
                className="p-2 text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                title="Edit Purchase Order"
              >
                <Edit className="h-4 w-4" />
              </button>
            )}

            {onDeletePO && po.status !== 'received' && (
              <button
                type="button"
                onClick={() => onDeletePO(po)}
                className="p-2 text-slate-600 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                title="Delete Purchase Order"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 print:p-0 print:overflow-visible">
          {activeFormat === 'a4' ? (
            /* =========================================================================
               A4 Formatted Official Purchase Order
               ========================================================================= */
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs max-w-3xl mx-auto text-slate-800 space-y-6 print:border-none print:shadow-none print:p-0 print:max-w-none">
              {/* Header */}
              <div className="flex items-start justify-between pb-6 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2 text-indigo-700 font-extrabold text-xl tracking-tight">
                    <Zap className="h-6 w-6 text-amber-500 fill-amber-500" />
                    <span>{storeName}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    <p>{storeAddress}</p>
                    <p>Phone: {storePhone}</p>
                    {storeTaxId && <p>KRA PIN / Tax ID: {storeTaxId}</p>}
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg text-xs font-black uppercase tracking-widest mb-1">
                    PURCHASE ORDER
                  </span>
                  <div className="font-mono font-extrabold text-xl text-slate-900">
                    #{po.po_no}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Order Date: <span className="font-semibold text-slate-700">{orderDateFormatted}</span>
                  </div>
                </div>
              </div>

              {/* Vendor & Logistics Cards Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Vendor Card */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-2">
                    <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                    Vendor / Supplier
                  </span>
                  <div className="font-bold text-slate-900 text-sm">
                    {po.supplier_name || 'Direct Vendor (No Account)'}
                  </div>
                  {onViewSupplierStatement && po.supplier_id && (
                    <button
                      type="button"
                      onClick={() => onViewSupplierStatement(po.supplier_id)}
                      className="mt-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1 cursor-pointer print:hidden"
                    >
                      View Supplier Ledger Statement &rarr;
                    </button>
                  )}
                </div>

                {/* Logistics & Delivery Details */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1 text-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-2">
                    <Truck className="h-3.5 w-3.5 text-indigo-600" />
                    Delivery & Procurement
                  </span>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expected Date:</span>
                    <span className="font-bold text-slate-900">{expectedDateFormatted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Authorized By:</span>
                    <span className="font-bold text-slate-900">{po.authorizer_name || 'Purchasing Dept'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fiscal Status:</span>
                    <span className="font-bold text-slate-900">{po.is_etr ? 'Official ETR Order' : 'Standard'}</span>
                  </div>
                </div>
              </div>

              {/* Notes / Special Instructions */}
              {po.notes && (
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900">
                  <span className="font-bold uppercase tracking-wider text-[10px] block mb-0.5 text-amber-800">
                    Procurement Notes & Delivery Terms:
                  </span>
                  {po.notes}
                </div>
              )}

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-3 w-8 text-center">#</th>
                      <th className="py-2.5 px-3">Product Description / SKU</th>
                      <th className="py-2.5 px-3 w-28 text-center">Unit Type</th>
                      <th className="py-2.5 px-3 w-28 text-right">Ordered Qty</th>
                      <th className="py-2.5 px-3 w-28 text-right">Received Qty</th>
                      <th className="py-2.5 px-3 w-32 text-right">Unit Cost</th>
                      <th className="py-2.5 px-3 w-36 text-right">Total (KES)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {(po.items || []).map((it, idx) => (
                      <tr key={it.id || idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{it.product_name}</div>
                          {it.product_sku && (
                            <div className="text-[10px] font-mono text-slate-400">SKU: {it.product_sku}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            it.unit_type === 'roll' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {it.unit_type === 'roll' ? 'Roll (Meters)' : 'Piece (pcs)'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {it.ordered_qty} {it.unit_type === 'roll' ? 'm' : 'pcs'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-600">
                          {it.received_qty || 0} {it.unit_type === 'roll' ? 'm' : 'pcs'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {Number(it.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {Number(it.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Landed Cost / Direct Expenses Section (if recorded) */}
              {(po.expenses && po.expenses.length > 0) && (
                <div className="border border-slate-200 rounded-xl overflow-hidden p-4 bg-slate-50/50 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-indigo-600" />
                    Associated Transport & Landed Expenses ({po.expenses.length})
                  </span>
                  <div className="divide-y divide-slate-100 text-xs">
                    {po.expenses.map((exp, idx) => (
                      <div key={exp.id || idx} className="py-1.5 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800 uppercase text-[11px] mr-2">[{exp.category}]</span>
                          <span className="text-slate-600">{exp.description}</span>
                          {exp.reference && (
                            <span className="text-slate-400 font-mono text-[10px] ml-2">Ref: {exp.reference}</span>
                          )}
                        </div>
                        <span className="font-mono font-bold text-slate-900">
                          KES {Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Financial Totals Summary Card */}
              <div className="flex justify-end pt-2">
                <div className="w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Order Subtotal:</span>
                    <span className="font-mono font-bold text-slate-900">
                      KES {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {totalExpenses > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Landed Expenses:</span>
                      <span className="font-mono font-bold text-indigo-700">
                        + KES {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-extrabold text-slate-900">
                    <span>Total Valuation:</span>
                    <span className="font-mono text-base text-indigo-700">
                      KES {netLandedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signatures & Acceptance Block */}
              <div className="grid grid-cols-3 gap-6 pt-10 border-t border-slate-200 text-center text-xs">
                <div>
                  <div className="h-10 border-b border-dashed border-slate-300"></div>
                  <span className="block mt-1 font-bold text-slate-700">Prepared By</span>
                  <span className="text-[10px] text-slate-400">Purchasing Officer</span>
                </div>
                <div>
                  <div className="h-10 border-b border-dashed border-slate-300"></div>
                  <span className="block mt-1 font-bold text-slate-700">Approved By</span>
                  <span className="text-[10px] text-slate-400">Managing Director / Finance</span>
                </div>
                <div>
                  <div className="h-10 border-b border-dashed border-slate-300"></div>
                  <span className="block mt-1 font-bold text-slate-700">Supplier Acknowledgment</span>
                  <span className="text-[10px] text-slate-400">Stamp & Signature</span>
                </div>
              </div>
            </div>
          ) : (
            /* =========================================================================
               80mm Thermal Receipt Slip Format
               ========================================================================= */
            <div
              ref={thermalSlipRef}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs max-w-[340px] mx-auto text-slate-900 font-mono text-xs space-y-3 print:border-none print:shadow-none print:p-0 print:max-w-none"
            >
              <div className="text-center pb-2 border-b border-dashed border-slate-300">
                <div className="font-extrabold text-sm uppercase">{storeName}</div>
                <div className="text-[10px] text-slate-500">{storeAddress}</div>
                <div className="text-[10px] text-slate-500">Tel: {storePhone}</div>
                {storeTaxId && <div className="text-[10px] text-slate-500">PIN: {storeTaxId}</div>}
              </div>

              <div className="text-center py-1">
                <div className="font-bold text-xs uppercase tracking-wider">PURCHASE ORDER</div>
                <div className="font-extrabold text-sm">#{po.po_no}</div>
                <div className="text-[10px] text-slate-500">{orderDateFormatted}</div>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-1.5 text-[11px] space-y-0.5">
                <div>Vendor: <span className="font-bold">{po.supplier_name || 'Direct'}</span></div>
                <div>Expected: {expectedDateFormatted}</div>
                <div>Status: <span className="font-bold uppercase">{po.status}</span></div>
              </div>

              {/* Items */}
              <div className="space-y-1.5 text-[11px]">
                <div className="font-bold flex justify-between border-b border-slate-200 pb-0.5">
                  <span>ITEM</span>
                  <span>TOTAL</span>
                </div>
                {(po.items || []).map((it, idx) => (
                  <div key={it.id || idx} className="space-y-0.5">
                    <div className="font-bold truncate">{it.product_name}</div>
                    <div className="flex justify-between text-slate-600">
                      <span>{it.ordered_qty} {it.unit_type === 'roll' ? 'm' : 'pcs'} x {Number(it.unit_cost).toLocaleString()}</span>
                      <span className="font-bold text-slate-900">{Number(it.total_cost).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-right">
                <div className="flex justify-between text-xs font-extrabold">
                  <span>TOTAL:</span>
                  <span>KES {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="text-center pt-3 border-t border-dashed border-slate-300 text-[10px] text-slate-400">
                Authorized Procurement Slip
              </div>
            </div>
          )}
        </div>

        {/* Drawer Bottom Bar (Quick Action Buttons) */}
        {onReceivePO && (po.status === 'ordered' || po.status === 'partial') && (
          <div className="bg-white px-6 py-3 border-t border-slate-200 flex items-center justify-between shrink-0 print:hidden">
            <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span>Pending goods delivery for this purchase order</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onReceivePO(po);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <PackageCheck className="h-4 w-4" />
              <span>Receive Delivered Goods (GRN)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
