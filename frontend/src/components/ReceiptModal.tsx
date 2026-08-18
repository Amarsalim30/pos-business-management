import React, { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import type { Sale } from '../types';

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
  storeName = "Solar & Electrical Hardware",
  storePhone = "+254 700 000 000",
  storeAddress = "Nairobi, Kenya",
  storeTaxId = "P000000000X",
  onClose
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto print:p-0 print:bg-white">
      {/* Screen Controls */}
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:w-full">
        {/* Header - Hidden on Print */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <Printer className="h-5 w-5 text-amber-400" />
            <span className="font-bold text-sm">Receipt Preview (80mm Thermal)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 80mm Receipt Body */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs text-slate-800 bg-white print:p-0 print:m-0" ref={receiptRef}>
          {/* Store Header */}
          <div className="text-center space-y-1 pb-4 border-b border-dashed border-slate-300">
            <h2 className="font-extrabold text-base uppercase text-slate-900 tracking-tight">{storeName}</h2>
            <p className="text-[11px] text-slate-600">{storeAddress}</p>
            <p className="text-[11px] text-slate-600">Tel: {storePhone}</p>
            {sale.is_etr && (
              <div className="inline-block mt-1 px-2 py-0.5 bg-slate-100 border border-slate-300 text-[10px] font-bold uppercase rounded">
                PIN: {storeTaxId} • ETR INVOICE
              </div>
            )}
          </div>

          {/* Invoice Meta */}
          <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice No:</span>
              <span className="font-bold text-slate-900">{sale.invoice_no}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date:</span>
              <span>{new Date(sale.created_at).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cashier:</span>
              <span>{sale.cashier_name || 'Staff'}</span>
            </div>
            {sale.customer_name && (
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-900">{sale.customer_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Payment:</span>
              <span className="uppercase font-bold text-slate-900">{sale.payment_method} {sale.payment_reference ? `(${sale.payment_reference})` : ''}</span>
            </div>
          </div>

          {/* Line Items */}
          <div className="py-3 border-b border-dashed border-slate-300">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] text-slate-500 uppercase border-b border-slate-200">
                  <th className="pb-1">Item</th>
                  <th className="pb-1 text-center">Qty</th>
                  <th className="pb-1 text-right">Price</th>
                  <th className="pb-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sale.items.map((item) => (
                  <tr key={item.id} className="text-[11px]">
                    <td className="py-1.5 pr-2 font-medium">
                      <div>{item.product_name}</div>
                      {item.unit_type === 'roll' && (
                        <div className="text-[9px] text-slate-500">
                          {item.rolls_qty ? `${item.rolls_qty} rolls ` : ''}
                          {item.loose_meters ? `+ ${item.loose_meters}m` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 text-center font-bold">
                      {item.unit_type === 'roll' ? `${Number(item.quantity).toFixed(1)}m` : item.quantity}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {Number(item.unit_price).toLocaleString()}
                    </td>
                    <td className="py-1.5 text-right font-bold font-mono">
                      {Number(item.total).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="py-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono">KES {Number(sale.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            {Number(sale.discount_amount) > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount:</span>
                <span className="font-mono">-KES {Number(sale.discount_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {Number(sale.tax_amount) > 0 && (
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>VAT (Included):</span>
                <span className="font-mono">KES {Number(sale.tax_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-200">
              <span>TOTAL:</span>
              <span className="font-mono">KES {Number(sale.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center pt-4 border-t border-dashed border-slate-300 text-[10px] text-slate-500 space-y-1">
            <p>Goods once sold are not returnable without valid receipt.</p>
            <p className="font-bold text-slate-700">Thank you for your business!</p>
          </div>
        </div>

        {/* Footer Actions - Hidden on Print */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer active:scale-95"
          >
            <Printer className="h-4 w-4" />
            <span>Print Receipt (Ctrl+P)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
