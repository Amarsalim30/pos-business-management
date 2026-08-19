import React from 'react';
import type { Sale, PreSaleDocument } from '../types';
import { ShieldCheck, Building2, Phone, Mail, MapPin } from 'lucide-react';

export interface A4InvoiceDocumentProps {
  sale?: Sale | null;
  preSaleDoc?: PreSaleDocument | null;
  storeName?: string;
  storePhone?: string;
  storeEmail?: string;
  storeAddress?: string;
  storeTaxId?: string;
  bankName?: string;
  bankAccount?: string;
  paybillNumber?: string;
  paybillAccount?: string;
  documentTitle?: string;
  isDeliveryNote?: boolean;
}

export const A4InvoiceDocument: React.FC<A4InvoiceDocumentProps> = ({
  sale,
  preSaleDoc,
  storeName = "SOLAR & ELECTRICAL HARDWARE SUPPLIES",
  storePhone = "+254 700 000 000 / +254 711 111 222",
  storeEmail = "sales@solarhardware.co.ke",
  storeAddress = "Commercial Center, Ground Floor, Nairobi, Kenya",
  storeTaxId = "P051234567Z",
  bankName = "Equity Bank Kenya (Commercial Branch)",
  bankAccount = "0120293847561",
  paybillNumber = "247247",
  paybillAccount = sale ? sale.invoice_no : preSaleDoc ? preSaleDoc.document_no : "STORE-ACC",
  documentTitle,
  isDeliveryNote = false,
}) => {
  if (!sale && !preSaleDoc) return null;

  const docNo = sale ? sale.invoice_no : preSaleDoc?.document_no || '';
  const isEtr = sale ? sale.is_etr : false;
  const createdAt = sale ? sale.created_at : preSaleDoc?.created_at || '';
  const customerName = sale ? sale.customer_name : preSaleDoc?.customer_name;
  const cashierName = sale ? sale.cashier_name : 'Sales Desk';
  const subtotal = sale ? Number(sale.subtotal) : Number(preSaleDoc?.subtotal || 0);
  const taxAmount = sale ? Number(sale.tax_amount) : Number(preSaleDoc?.tax_amount || 0);
  const discountAmount = sale ? Number(sale.discount_amount) : Number(preSaleDoc?.discount_amount || 0);
  const totalAmount = sale ? Number(sale.total_amount) : Number(preSaleDoc?.total_amount || 0);
  const totalPaid = sale ? Number(sale.total_paid || (sale.payments ? sale.payments.reduce((acc, p) => acc + Number(p.amount), 0) : (sale.status === 'paid' ? totalAmount : 0))) : 0;
  const balanceDue = sale ? (sale.balance_due !== undefined ? Number(sale.balance_due) : Math.max(0, totalAmount - totalPaid)) : totalAmount;
  const isVoided = sale?.status === 'voided';
  const isPaid = sale?.status === 'paid' || (sale && balanceDue <= 0 && !isVoided);
  const isPartial = sale?.status === 'partial' || (sale && balanceDue > 0 && totalPaid > 0 && !isVoided);
  const isUnpaid = sale?.status === 'unpaid' || (sale && totalPaid === 0 && !isVoided);

  const formattedDate = new Date(createdAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const formattedTime = new Date(createdAt).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const items = sale ? sale.items : (preSaleDoc?.items || []);

  const defaultTitle = isDeliveryNote
    ? "DELIVERY NOTE"
    : preSaleDoc
    ? (preSaleDoc.type === 'proforma' ? "PROFORMA INVOICE" : "PRICE QUOTATION")
    : "TAX INVOICE";

  const resolvedTitle = documentTitle || defaultTitle;

  return (
    <div
      id="a4-invoice-container"
      className="bg-white text-slate-900 font-sans p-8 md:p-12 max-w-[210mm] mx-auto shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none text-xs leading-relaxed"
    >
      {/* Top Header & Branding */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
        <div className="space-y-1.5 max-w-[60%]">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-amber-600 flex items-center justify-center text-white font-black text-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
              {storeName}
            </h1>
          </div>
          <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
            {storeAddress}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 font-medium pt-0.5">
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3 text-slate-400" /> {storePhone}
            </span>
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3 text-slate-400" /> {storeEmail}
            </span>
          </div>
          <div className="pt-1 flex items-center gap-2">
            <span className="inline-block px-2 py-0.5 bg-slate-100 border border-slate-300 text-[10px] font-mono font-bold text-slate-800 rounded">
              KRA PIN: {storeTaxId}
            </span>
            {isEtr && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-300 text-amber-900 text-[10px] font-black uppercase rounded">
                <ShieldCheck className="h-3 w-3 text-amber-600" /> ETR Fiscal Document
              </span>
            )}
          </div>
        </div>

        {/* Invoice Title & Meta */}
        <div className="text-right space-y-2">
          <div className="inline-block px-3 py-1 bg-slate-900 text-white font-black text-sm tracking-wider uppercase rounded-lg">
            {resolvedTitle}
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex justify-end gap-2">
              <span className="text-slate-500">Doc No:</span>
              <span className="font-bold text-slate-900 text-xs">{docNo}</span>
            </div>
            <div className="flex justify-end gap-2">
              <span className="text-slate-500">Date:</span>
              <span className="font-semibold text-slate-800">{formattedDate} ({formattedTime})</span>
            </div>
            <div className="flex justify-end gap-2">
              <span className="text-slate-500">Staff / Cashier:</span>
              <span className="font-semibold text-slate-800">{cashierName || 'Staff'}</span>
            </div>
            {preSaleDoc?.valid_until && (
              <div className="flex justify-end gap-2 text-rose-700 font-bold">
                <span>Valid Until:</span>
                <span>{new Date(preSaleDoc.valid_until).toLocaleDateString('en-GB')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bill To & Status Strip */}
      <div className="grid grid-cols-2 gap-6 py-5 border-b border-slate-200">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer / Bill To:</div>
          <div className="text-sm font-bold text-slate-900">
            {customerName || 'Walk-in Retail Customer'}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            Account Type: {customerName ? 'Registered Account' : 'Counter Cash Sale'}
          </div>
          {(sale?.site_name || preSaleDoc?.site_name) && (
            <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-start gap-1.5 text-xs text-amber-950 bg-amber-50/90 p-2 rounded-lg border border-amber-200">
              <MapPin className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-800 block">Site / Project Location:</span>
                <span className="font-bold text-slate-900">{sale?.site_name || preSaleDoc?.site_name}</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Settlement Status:</span>
            {sale && (
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isPaid
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : isPartial
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : isUnpaid
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : 'bg-slate-200 text-slate-800'
              }`}>
                {isPaid ? 'PAID IN FULL' : isPartial ? 'PARTIAL PAYMENT' : isUnpaid ? 'CREDIT / UNPAID' : sale.status}
              </span>
            )}
          </div>

          <div className="flex justify-between items-end pt-2 border-t border-slate-200 mt-2">
            <div>
              <span className="text-[10px] text-slate-500">Tender Method:</span>
              <div className="font-bold text-slate-900 uppercase">
                {sale?.payment_method || 'PENDING'}
              </div>
            </div>
            {sale && balanceDue > 0 && !isVoided && (
              <div className="text-right">
                <span className="text-[10px] text-rose-600 font-bold uppercase">Balance Due:</span>
                <div className="text-sm font-black font-mono text-rose-600">
                  KES {balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="py-5">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/80 border-y border-slate-300 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
              <th className="py-2.5 px-3 w-8 text-center">#</th>
              <th className="py-2.5 px-3">Item & Description</th>
              <th className="py-2.5 px-3 text-center">Quantity</th>
              <th className="py-2.5 px-3 text-right">Unit Price (KES)</th>
              <th className="py-2.5 px-3 text-center w-16">VAT</th>
              <th className="py-2.5 px-3 text-right">Total (KES)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((item, idx) => {
              let displayQty = '';
              let itemLabel = item.product_name;

              if (item.unit_type === 'roll') {
                const looseNum = Number(item.loose_meters) || 0;
                const rollsNum = Number(item.rolls_qty) || 0;

                if (item.unit_sold === 'meter') {
                  displayQty = `${Number(item.quantity).toFixed(0)} meters`;
                  itemLabel = `${item.product_name} (Cut Length)`;
                } else if (item.unit_sold === 'roll') {
                  if (rollsNum > 0 && looseNum > 0) {
                    displayQty = `${rollsNum} roll${rollsNum > 1 ? 's' : ''} + ${looseNum}m`;
                  } else if (looseNum > 0 && rollsNum === 0) {
                    displayQty = `${looseNum} meters`;
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
                <tr key={item.id || idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900">{itemLabel}</div>
                    {item.sku && (
                      <div className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                    {displayQty}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                    {Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-[10px] text-slate-500">
                    {item.tax_rate > 0 ? `${(item.tax_rate * 100).toFixed(0)}%` : '0%'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                    {Number(item.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Financial Breakdown & Totals */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2 pb-6 border-b border-slate-200">
        {/* Payment Methods & Remittance Instructions */}
        <div className="md:col-span-7 space-y-3">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
            <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
              Payment & Settlement Instructions:
            </div>
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-slate-500 font-medium block">M-PESA PAYBILL:</span>
                <span className="font-bold font-mono text-slate-900">Business No: {paybillNumber}</span>
                <span className="text-slate-600 block font-mono">Account No: {paybillAccount}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">BANK WIRE / EFT:</span>
                <span className="font-bold text-slate-900 block">{bankName}</span>
                <span className="font-mono text-slate-700">Account: {bankAccount}</span>
              </div>
            </div>
          </div>

          {/* Audit Payments Received Breakdown */}
          {sale?.payments && sale.payments.length > 0 && (
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-[10px] space-y-1 font-mono">
              <div className="font-bold text-emerald-950 uppercase font-sans text-[10px]">
                Recorded Payment Transactions ({sale.payments.length}):
              </div>
              {sale.payments.map((p, pIdx) => (
                <div key={p.id || pIdx} className="flex justify-between text-emerald-900">
                  <span>
                    {new Date(p.created_at).toLocaleDateString('en-GB')} • {p.payment_method.toUpperCase()}
                    {p.reference ? ` (${p.reference})` : ''}
                  </span>
                  <span className="font-bold">
                    KES {Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals Summary */}
        <div className="md:col-span-5 space-y-1.5 text-xs font-mono">
          <div className="flex justify-between py-1 text-slate-600">
            <span>Subtotal:</span>
            <span className="font-bold text-slate-900">
              KES {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          {discountAmount > 0 && (
            <div className="flex justify-between py-1 text-rose-600">
              <span>Discount Allowed:</span>
              <span className="font-bold">
                -KES {discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <div className="flex justify-between py-1 text-slate-500 text-[11px]">
            <span>VAT (16% Extracted):</span>
            <span>KES {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="flex justify-between py-2 border-t-2 border-slate-900 font-bold text-slate-950 text-sm">
            <span>TOTAL AMOUNT:</span>
            <span className="font-black text-base">
              KES {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          {sale && (
            <>
              <div className="flex justify-between py-1 text-emerald-700 font-bold border-t border-slate-200">
                <span>Total Amount Paid:</span>
                <span>KES {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              {balanceDue > 0 && (
                <div className="flex justify-between py-1 text-rose-700 font-black text-sm bg-rose-50 px-2 rounded">
                  <span>BALANCE DUE:</span>
                  <span>KES {balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer Disclaimer & Signatures */}
      <div className="pt-6 space-y-6">
        <div className="grid grid-cols-2 gap-8 text-[11px] text-slate-500">
          <div>
            <div className="font-bold text-slate-800 uppercase text-[10px] mb-1">Terms & Conditions:</div>
            <ul className="list-disc pl-4 space-y-0.5 text-[10px]">
              <li>All goods remain the property of {storeName} until paid in full.</li>
              <li>Warranty claims require presentation of this original tax invoice.</li>
              <li>Cut cables, wires, and special order components are non-returnable.</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="border-t border-slate-300 pt-8 mt-6">
              <span className="text-[10px] font-bold text-slate-700 uppercase">Received By (Customer)</span>
            </div>
            <div className="border-t border-slate-300 pt-8 mt-6">
              <span className="text-[10px] font-bold text-slate-700 uppercase">Authorized Store Stamp</span>
            </div>
          </div>
        </div>

        <div className="text-center pt-2 border-t border-slate-100 text-[10px] text-slate-400">
          Thank you for your business. For support or orders, contact {storePhone}
        </div>
      </div>
    </div>
  );
};
