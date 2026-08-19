import React, { useState, useEffect, useRef } from 'react';
import type { GoodsReceivedNote } from '../types';
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
  ArrowRight
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
}

export const GRNDocumentDrawer: React.FC<GRNDocumentDrawerProps> = ({
  grn,
  isOpen,
  onClose,
  defaultFormat = 'a4',
  storeName = "SOLAR & ELECTRICAL HARDWARE SUPPLIES",
  storePhone = "+254 700 000 000",
  storeAddress = "Nairobi, Kenya",
  storeTaxId = "P051234567Z",
  onViewSupplierStatement
}) => {
  const [activeFormat, setActiveFormat] = useState<'a4' | 'thermal'>(defaultFormat);
  const [copied, setCopied] = useState(false);
  const thermalSlipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveFormat(defaultFormat);
  }, [defaultFormat, grn?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !grn) return null;

  const totalAmount = Number(grn.total_amount || 0);
  const itemsCount = grn.items ? grn.items.length : 0;
  const deliveryDateFormatted = new Date(grn.delivery_date || grn.created_at).toLocaleDateString('en-GB', {
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
    navigator.clipboard.writeText(grn.grn_no);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const itemsList = (grn.items || []).map((it, idx) => {
      const pack = it.unit_type === 'roll'
        ? `${it.rolls_received || 0} rolls + ${Number(it.loose_meters_received || 0).toFixed(1)}m`
        : `${it.quantity_received} ${it.unit || 'pcs'}`;
      return `${idx + 1}. ${it.product_name} (${pack}) @ KES ${Number(it.unit_cost).toLocaleString()} = KES ${Number(it.total_cost).toLocaleString()}`;
    }).join('\n');

    const text = `*GOODS RECEIVED NOTE (GRN)*
*${storeName}*
*GRN No: #${grn.grn_no}*
Supplier: ${grn.supplier_name || 'Direct / Walk-in'}
${grn.invoice_number ? `Delivery Note / Inv: ${grn.invoice_number}\n` : ''}${grn.po_no ? `PO Ref: ${grn.po_no}\n` : ''}Date: ${deliveryDateFormatted}
Received By: ${grn.receiver_name || 'Warehouse Staff'}
---------------------------------
*Delivered Items (${itemsCount}):*
${itemsList}
---------------------------------
*Total Consignment Valuation: KES ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}*
${grn.notes ? `Remarks: "${grn.notes}"\n` : ''}---------------------------------
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
                    GRN #{grn.grn_no}
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
                  {grn.supplier_name || 'Direct Delivery'} • KES {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({itemsCount} items)
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
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrint}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print ({activeFormat === 'a4' ? 'A4 Slip' : 'Thermal'})</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Export / Save PDF"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>Export PDF</span>
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Share Delivery Slip via WhatsApp"
              >
                <Share2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>WhatsApp</span>
              </button>
            </div>

            {/* Contextual Action (Open Supplier Statement) */}
            {grn.supplier_id && onViewSupplierStatement && (
              <button
                onClick={() => onViewSupplierStatement(grn.supplier_id!)}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Supplier Statement</span>
                <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
              </button>
            )}
          </div>

          {/* Main Scrollable Document Canvas */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 print:p-0 print:overflow-visible">
            {activeFormat === 'a4' ? (
              /* A4 Formal Goods Received Note View */
              <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl border border-slate-200 shadow-md print:shadow-none print:border-none print:p-0">
                {/* Header Top Section */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
                  <div>
                    <span className="text-xs font-black uppercase tracking-widest text-amber-600">INBOUND CONSIGNMENT</span>
                    <h1 className="text-2xl font-black text-slate-950 tracking-tight mt-0.5">GOODS RECEIVED NOTE</h1>
                    <div className="text-xs text-slate-600 font-medium mt-1">{storeName}</div>
                    <div className="text-xs text-slate-500">{storeAddress} • Tel: {storePhone}</div>
                    <div className="text-xs text-slate-500 font-mono">Tax PIN: {storeTaxId}</div>
                  </div>

                  <div className="text-right space-y-1">
                    <div className="inline-block bg-slate-900 text-white px-3 py-1 rounded-lg text-xs font-mono font-bold">
                      {grn.grn_no}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-1">
                      Received: <strong>{deliveryDateFormatted}</strong>
                    </div>
                    {grn.invoice_number && (
                      <div className="text-xs text-slate-700 font-mono">
                        Delivery Note / Inv: <strong className="text-slate-950">{grn.invoice_number}</strong>
                      </div>
                    )}
                    {grn.po_no && (
                      <div className="text-xs text-slate-700 font-mono">
                        PO Number: <strong className="text-slate-950">{grn.po_no}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2-Column Vendor & Receiving Info */}
                <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-xs">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Supplier / Vendor:</div>
                    <div className="text-sm font-bold text-slate-900">{grn.supplier_name || 'Direct / Walk-in Vendor'}</div>
                    <div className="text-slate-500">Account ID: #{grn.supplier_id || 'N/A'}</div>
                  </div>

                  <div className="space-y-1 text-right sm:text-left sm:pl-4 sm:border-l sm:border-slate-200">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Warehouse Receiving:</div>
                    <div className="font-semibold text-slate-800">
                      Receiver: <strong className="text-slate-950">{grn.receiver_name || 'Staff Member'}</strong>
                    </div>
                    {grn.notes && (
                      <div className="text-slate-500 italic mt-1">
                        Remarks: "{grn.notes}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Itemized Table */}
                <div className="rounded-xl border border-slate-200 overflow-hidden mb-6">
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
                      {grn.items.map((it, idx) => (
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

                {/* Valuation Totals Card */}
                <div className="flex justify-end mb-8">
                  <div className="w-64 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600 font-medium">
                      <span>Total Line Items:</span>
                      <span className="font-mono font-bold text-slate-900">{itemsCount}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-950 text-sm">
                      <span>Total Consignment:</span>
                      <span className="font-mono text-amber-700">
                        KES {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    <p className="text-xs font-bold text-slate-900">GRN #{grn.grn_no}</p>
                  </div>

                  <div className="py-2.5 space-y-1 border-b border-dashed border-slate-300 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Supplier:</span>
                      <span className="font-bold truncate max-w-[170px]">{grn.supplier_name || 'Direct'}</span>
                    </div>
                    {grn.invoice_number && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">DN / Inv:</span>
                        <span className="font-bold">{grn.invoice_number}</span>
                      </div>
                    )}
                    {grn.po_no && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">PO Ref:</span>
                        <span className="font-bold">{grn.po_no}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Date:</span>
                      <span>{deliveryDateFormatted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Receiver:</span>
                      <span>{grn.receiver_name || 'Staff'}</span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="py-3 border-b-2 border-dashed border-slate-300 space-y-2">
                    <div className="text-[10px] font-bold uppercase text-slate-500 flex justify-between border-b pb-1">
                      <span>Item</span>
                      <span>Total</span>
                    </div>
                    {grn.items.map((it, idx) => (
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
                    <div className="flex justify-between text-xs font-black text-slate-950">
                      <span>TOTAL CONSIGNMENT:</span>
                      <span>KES {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
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
    </div>
  );
};
