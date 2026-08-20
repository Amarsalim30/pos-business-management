import React, { useRef } from 'react';
import { Printer, X, Zap } from 'lucide-react';
import type { Sale } from '../types';
import { COMPANY_CONSTANTS } from '../constants/companyConstants';

interface ReceiptModalProps {
  sale: Sale | null;
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
  storeTaxId?: string;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  storeName = COMPANY_CONSTANTS.companyName,
  storePhone = COMPANY_CONSTANTS.phone,
  storeAddress = COMPANY_CONSTANTS.address,
  storeTaxId = COMPANY_CONSTANTS.taxId,
  onClose
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(sale.created_at).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      {/* Modal Container */}
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full">
        {/* Header - Screen Only */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded-md bg-amber-500 flex items-center justify-center text-slate-950 font-black text-xs">
              <Zap className="h-3.5 w-3.5 fill-slate-950" />
            </div>
            <div>
              <span className="font-bold text-xs">Thermal Receipt (80mm)</span>
              <div className="text-[10px] text-slate-400 font-mono">Invoice #{sale.invoice_no}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 80mm Authentic Thermal Receipt Body */}
        <div
          id="thermal-receipt-container"
          ref={receiptRef}
          className="p-5 overflow-y-auto flex-1 font-mono text-[11px] leading-tight text-slate-900 bg-white print:p-1 print:m-0"
        >
          {/* Store Logo & Header */}
          <div className="text-center space-y-1 pb-3 border-b-2 border-dashed border-slate-300">
            <h2 className="font-black text-sm uppercase tracking-tight text-slate-950">{storeName}</h2>
            <p className="text-[10px] text-slate-600 font-medium">{storeAddress}</p>
            <p className="text-[10px] text-slate-600 font-medium">Tel: {storePhone}</p>
            {sale.is_etr && (
              <div className="inline-block mt-1 px-2 py-0.5 bg-slate-100 border border-slate-400 text-[9px] font-black uppercase tracking-wider rounded">
                KRA PIN: {storeTaxId} • FISCAL INVOICE
              </div>
            )}
          </div>

          {/* Meta Details */}
          <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">INVOICE:</span>
              <span className="font-bold font-mono text-slate-950">{sale.invoice_no}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">DATE:</span>
              <span className="font-mono text-slate-800">{formattedDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">CASHIER:</span>
              <span className="font-medium text-slate-900">{sale.cashier_name || 'Staff'}</span>
            </div>
            {sale.customer_name && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">CUSTOMER:</span>
                <span className="font-bold text-slate-900">{sale.customer_name}</span>
              </div>
            )}
            {sale.site_name && (
              <div className="flex justify-between text-amber-950 font-bold bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                <span className="text-amber-800 text-[9px]">SITE:</span>
                <span className="text-right font-black text-[10px]">{sale.site_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">PAYMENT:</span>
              <span className="uppercase font-bold text-slate-900">
                {sale.payment_method} {sale.payment_reference ? `(${sale.payment_reference})` : ''}
              </span>
            </div>
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
                {sale.items.map((item) => {
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
                    displayQty = `${item.quantity} ${item.unit_sold}`;
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

          {/* Totals & Tax Summary */}
          <div className="py-2.5 space-y-1 text-[11px]">
            <div className="flex justify-between text-slate-600">
              <span className="font-medium">Subtotal:</span>
              <span className="font-mono font-bold text-slate-800">
                KES {Number(sale.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {Number(sale.discount_amount) > 0 && (
              <div className="flex justify-between text-rose-700">
                <span className="font-medium">Discount:</span>
                <span className="font-mono font-bold">
                  -KES {Number(sale.discount_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {Number(sale.tax_amount) > 0 && (
              <div className="flex justify-between text-slate-500 text-[10px]">
                <span>16% VAT (Included):</span>
                <span className="font-mono">
                  KES {Number(sale.tax_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div className="flex justify-between text-sm font-black text-slate-950 pt-1.5 border-t-2 border-dashed border-slate-400">
              <span>TOTAL:</span>
              <span className="font-mono">
                KES {Number(sale.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Payments & Settlement Breakdown */}
            {sale.payments && sale.payments.length > 0 ? (
              <div className="pt-2 mt-1 border-t border-dashed border-slate-300 space-y-1 text-[10px]">
                <div className="font-bold text-slate-700 uppercase tracking-wider text-[9px]">Settlement / Payments:</div>
                {sale.payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-slate-700">
                    <span>
                      {p.payment_method.toUpperCase()} {p.reference ? `(${p.reference})` : ''}:
                    </span>
                    <span className="font-mono font-bold">
                      KES {Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-slate-950 font-bold pt-1 border-t border-slate-200">
                  <span>TOTAL PAID:</span>
                  <span className="font-mono">
                    KES {Number(sale.total_paid || sale.payments.reduce((a, b) => a + Number(b.amount), 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {Number(sale.balance_due || 0) > 0 && (
                  <div className="flex justify-between text-rose-700 font-bold">
                    <span>OUTSTANDING BALANCE:</span>
                    <span className="font-mono">
                      KES {Number(sale.balance_due).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Footer Receipt Disclaimer */}
          <div className="text-center pt-3 pb-1 border-t border-dashed border-slate-300 text-[9px] text-slate-500 space-y-0.5">
            <p className="font-medium">Goods once sold are not returnable without receipt.</p>
            <p className="font-black text-slate-800 uppercase tracking-wider">*** THANK YOU FOR SHOPPING WITH US ***</p>
          </div>
        </div>

        {/* Action Controls - Screen Only */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black transition-all shadow-md cursor-pointer active:scale-95"
          >
            <Printer className="h-4 w-4" />
            <span>Print Receipt (Ctrl+P)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
