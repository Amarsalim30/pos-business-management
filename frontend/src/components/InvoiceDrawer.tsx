import React, { useState, useEffect, useRef } from 'react';
import type { Sale, PreSaleDocument } from '../types';
import { A4InvoiceDocument } from './A4InvoiceDocument';
import {
  Printer,
  X,
  Zap,
  FileText,
  Banknote,
  RotateCcw,
  Copy,
  Check,
  Download,
  Share2,
  MapPin
} from 'lucide-react';

export interface InvoiceDrawerProps {
  sale?: Sale | null;
  preSaleDoc?: PreSaleDocument | null;
  isOpen: boolean;
  onClose: () => void;
  defaultFormat?: 'a4' | 'thermal';
  onRecordPayment?: (sale: Sale) => void;
  onVoidSale?: (sale: Sale) => void;
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
  storeTaxId?: string;
}

export const InvoiceDrawer: React.FC<InvoiceDrawerProps> = ({
  sale,
  preSaleDoc,
  isOpen,
  onClose,
  defaultFormat = 'a4',
  onRecordPayment,
  onVoidSale,
  storeName = "SOLAR & ELECTRICAL HARDWARE SUPPLIES",
  storePhone = "+254 700 000 000",
  storeAddress = "Nairobi, Kenya",
  storeTaxId = "P051234567Z",
}) => {
  const [activeFormat, setActiveFormat] = useState<'a4' | 'thermal'>(defaultFormat);
  const [copied, setCopied] = useState(false);
  const thermalReceiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveFormat(defaultFormat);
  }, [defaultFormat, sale?.id, preSaleDoc?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || (!sale && !preSaleDoc)) return null;

  const docNo = sale ? sale.invoice_no : preSaleDoc?.document_no || '';
  const customerName = sale ? sale.customer_name : preSaleDoc?.customer_name;
  const totalAmount = sale ? Number(sale.total_amount) : Number(preSaleDoc?.total_amount || 0);
  const totalPaid = sale ? Number(sale.total_paid || (sale.payments ? sale.payments.reduce((a, b) => a + Number(b.amount), 0) : (sale.status === 'paid' ? totalAmount : 0))) : 0;
  const balanceDue = sale ? (sale.balance_due !== undefined ? Number(sale.balance_due) : Math.max(0, totalAmount - totalPaid)) : totalAmount;
  const isVoided = sale?.status === 'voided';
  const isPartial = sale?.status === 'partial' || (sale && balanceDue > 0 && totalPaid > 0 && !isVoided);
  const isUnpaid = sale?.status === 'unpaid' || (sale && totalPaid === 0 && !isVoided);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyDocNo = () => {
    navigator.clipboard.writeText(docNo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const siteName = sale?.site_name || preSaleDoc?.site_name;
    const itemsList = (sale?.items || preSaleDoc?.items || []).map((it, idx) => {
      return `${idx + 1}. ${it.product_name} x ${it.quantity} = KES ${Number(it.total).toLocaleString()}`;
    }).join('\n');

    const text = `*${storeName}*
*${preSaleDoc ? (preSaleDoc.type === 'proforma' ? 'PROFORMA INVOICE' : 'QUOTATION') : 'TAX INVOICE'}: #${docNo}*
Customer: ${customerName || 'Walk-in'}${siteName ? `\n*Site / Project: ${siteName}*` : ''}
Date: ${new Date().toLocaleDateString('en-GB')}
---------------------------------
${itemsList}
---------------------------------
*Total Amount: KES ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}*
${sale ? `Amount Paid: KES ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n*Balance Due: KES ${balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}*` : ''}

Payment via M-Pesa Paybill: 247247 | Acc: ${docNo}
Thank you for your business!`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const currentSiteName = sale?.site_name || preSaleDoc?.site_name;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden print:static print:inset-auto print:overflow-visible">
      {/* Dark backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity print:hidden animate-in fade-in duration-200"
      />

      {/* Slide-over Panel Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 print:static print:pl-0">
        <div className="w-screen max-w-4xl bg-slate-100 shadow-2xl flex flex-col print:shadow-none print:bg-white print:max-w-none print:w-full">
          
          {/* Top Control Bar (Screen Only) */}
          <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between shadow-md print:hidden shrink-0">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-black text-xs">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm tracking-tight text-white">
                    {preSaleDoc ? (preSaleDoc.type === 'proforma' ? 'Proforma Invoice' : 'Quotation') : 'Tax Invoice'} #{docNo}
                  </span>
                  <button
                    onClick={handleCopyDocNo}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Copy Document #"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                  <span>{customerName || 'Walk-in Customer'} • KES {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  {currentSiteName && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                      <MapPin className="h-2.5 w-2.5" />
                      {currentSiteName}
                    </span>
                  )}
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
                  <span>A4 Business Doc</span>
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
                  <span>80mm Thermal</span>
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
                <span>Print ({activeFormat === 'a4' ? 'A4' : '80mm'})</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Print to PDF"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>Export PDF</span>
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Send Invoice breakdown via WhatsApp"
              >
                <Share2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>WhatsApp</span>
              </button>
            </div>

            {/* Contextual Actions (Payment / Void) */}
            <div className="flex items-center space-x-2">
              {sale && (isPartial || isUnpaid) && !isVoided && onRecordPayment && (
                <button
                  onClick={() => onRecordPayment(sale)}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all cursor-pointer shadow-2xs"
                >
                  <Banknote className="h-3.5 w-3.5" />
                  <span>Record Payment</span>
                </button>
              )}

              {sale && !isVoided && onVoidSale && (
                <button
                  onClick={() => onVoidSale(sale)}
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-bold cursor-pointer"
                  title="Void Transaction"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Void</span>
                </button>
              )}
            </div>
          </div>

          {/* Main Scrollable Document Canvas */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 print:p-0 print:overflow-visible">
            {activeFormat === 'a4' ? (
              /* A4 Formal Tax Invoice View */
              <div className="print:block">
                <A4InvoiceDocument
                  sale={sale}
                  preSaleDoc={preSaleDoc}
                  storeName={storeName}
                  storePhone={storePhone}
                  storeAddress={storeAddress}
                  storeTaxId={storeTaxId}
                />
              </div>
            ) : (
              /* 80mm Thermal Receipt Slip View */
              <div className="flex justify-center print:block">
                <div
                  id="thermal-receipt-container"
                  ref={thermalReceiptRef}
                  className="bg-white p-6 max-w-sm w-full shadow-md border border-slate-200 font-mono text-[11px] leading-tight text-slate-900 print:shadow-none print:border-none print:p-1 print:m-0"
                >
                  {/* Store Header */}
                  <div className="text-center space-y-1 pb-3 border-b-2 border-dashed border-slate-300">
                    <h2 className="font-black text-sm uppercase tracking-tight text-slate-950">{storeName}</h2>
                    <p className="text-[10px] text-slate-600 font-medium">{storeAddress}</p>
                    <p className="text-[10px] text-slate-600 font-medium">Tel: {storePhone}</p>
                    {sale?.is_etr && (
                      <div className="inline-block mt-1 px-2 py-0.5 bg-slate-100 border border-slate-400 text-[9px] font-black uppercase tracking-wider rounded">
                        KRA PIN: {storeTaxId} • FISCAL INVOICE
                      </div>
                    )}
                  </div>

                  {/* Meta Details */}
                  <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">DOCUMENT:</span>
                      <span className="font-bold font-mono text-slate-950">{docNo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">DATE:</span>
                      <span className="font-mono text-slate-800">
                        {new Date(sale?.created_at || preSaleDoc?.created_at || '').toLocaleString('en-GB')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">CASHIER:</span>
                      <span className="font-medium text-slate-900">{sale?.cashier_name || 'Staff'}</span>
                    </div>
                    {customerName && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">CUSTOMER:</span>
                        <span className="font-bold text-slate-900">{customerName}</span>
                      </div>
                    )}
                    {(sale?.site_name || preSaleDoc?.site_name) && (
                      <div className="flex justify-between text-amber-950 font-bold bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                        <span className="text-amber-800 text-[9px]">SITE:</span>
                        <span className="text-right font-black text-[10px]">{sale?.site_name || preSaleDoc?.site_name}</span>
                      </div>
                    )}
                    {sale && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">PAYMENT:</span>
                        <span className="uppercase font-bold text-slate-900">
                          {sale.payment_method} {sale.payment_reference ? `(${sale.payment_reference})` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Line Items Table */}
                  <div className="py-2 border-b border-dashed border-slate-300">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[9px] font-black text-slate-500 uppercase border-b border-slate-200 pb-1">
                          <th className="pb-1 text-left">ITEM</th>
                          <th className="pb-1 text-center">QTY</th>
                          <th className="pb-1 text-right">PRICE</th>
                          <th className="pb-1 text-right">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(sale?.items || preSaleDoc?.items || []).map((item) => {
                          let displayQty = '';
                          let itemLabel = item.product_name;

                          if (item.unit_type === 'roll') {
                            const looseNum = Number(item.loose_meters) || 0;
                            const rollsNum = Number(item.rolls_qty) || 0;

                            if (item.unit_sold === 'meter') {
                              displayQty = `${Number(item.quantity).toFixed(0)}m`;
                              itemLabel = `${item.product_name} (Meters)`;
                            } else if (item.unit_sold === 'roll') {
                              if (rollsNum > 0 && looseNum > 0) {
                                displayQty = `${rollsNum}r ${looseNum}m`;
                              } else if (looseNum > 0 && rollsNum === 0) {
                                displayQty = `${looseNum}m`;
                              } else {
                                displayQty = `${rollsNum || 1} roll${(rollsNum || 1) > 1 ? 's' : ''}`;
                              }
                            } else {
                              displayQty = `${Number(item.quantity).toFixed(0)}m`;
                            }
                          } else {
                            displayQty = `${item.quantity} ${item.unit_sold || 'pcs'}`;
                          }

                          return (
                            <tr key={item.id} className="text-[10px]">
                              <td className="py-1.5 pr-1 font-bold text-slate-900 leading-snug">
                                {itemLabel}
                              </td>
                              <td className="py-1.5 text-center font-bold font-mono text-slate-800 whitespace-nowrap">
                                {displayQty}
                              </td>
                              <td className="py-1.5 text-right font-mono text-slate-600 whitespace-nowrap">
                                {Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-1.5 text-right font-bold font-mono text-slate-950 whitespace-nowrap">
                                {Number(item.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals & Breakdown */}
                  <div className="py-2.5 space-y-1 text-[11px]">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-mono font-bold text-slate-800">
                        KES {Number(sale?.subtotal || preSaleDoc?.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {Number(sale?.discount_amount || preSaleDoc?.discount_amount || 0) > 0 && (
                      <div className="flex justify-between text-rose-700">
                        <span>Discount:</span>
                        <span className="font-mono font-bold">
                          -KES {Number(sale?.discount_amount || preSaleDoc?.discount_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm font-black text-slate-950 pt-1.5 border-t-2 border-dashed border-slate-400">
                      <span>TOTAL:</span>
                      <span className="font-mono">
                        KES {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {sale && (
                      <>
                        <div className="flex justify-between text-emerald-700 font-bold pt-1">
                          <span>TOTAL PAID:</span>
                          <span className="font-mono">
                            KES {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {balanceDue > 0 && (
                          <div className="flex justify-between text-rose-700 font-bold">
                            <span>BALANCE DUE:</span>
                            <span className="font-mono">
                              KES {balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Thermal Footer */}
                  <div className="text-center pt-3 pb-1 border-t border-dashed border-slate-300 text-[9px] text-slate-500 space-y-0.5">
                    <p className="font-medium">Goods once sold are not returnable without receipt.</p>
                    <p className="font-black text-slate-800 uppercase tracking-wider">*** THANK YOU FOR SHOPPING WITH US ***</p>
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
