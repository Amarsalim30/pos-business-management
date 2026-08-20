import React, { useState, useEffect } from 'react';
import type { SupplierPayment } from '../types';
import { COMPANY_CONSTANTS } from '../constants/companyConstants';
import {
  Printer,
  X,
  CreditCard,
  Building2,
  Copy,
  Check,
  Download,
  Share2,
  ArrowRight
} from 'lucide-react';

export interface SupplierPaymentVoucherDrawerProps {
  payment?: SupplierPayment | null;
  isOpen: boolean;
  onClose: () => void;
  storeName?: string;
  storePhone?: string;
  storeAddress?: string;
  storeTaxId?: string;
  onViewSupplierStatement?: (supplierId: number) => void;
}

export const SupplierPaymentVoucherDrawer: React.FC<SupplierPaymentVoucherDrawerProps> = ({
  payment,
  isOpen,
  onClose,
  storeName = COMPANY_CONSTANTS.companyName,
  storePhone = COMPANY_CONSTANTS.phone,
  storeAddress = COMPANY_CONSTANTS.address,
  storeTaxId = COMPANY_CONSTANTS.taxId,
  onViewSupplierStatement
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !payment) return null;

  const voucherNo = `PV-${new Date(payment.created_at).getFullYear()}-${String(payment.id).padStart(5, '0')}`;
  const amount = Number(payment.amount || 0);
  const paymentDateFormatted = new Date(payment.created_at).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const handlePrint = () => {
    window.print();
  };

  const handleCopyVoucherNo = () => {
    navigator.clipboard.writeText(voucherNo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `*OFFICIAL PAYMENT VOUCHER*
*${storeName}*
*Voucher No: #${voucherNo}*
Payee / Supplier: ${payment.supplier_name || `Supplier #${payment.supplier_id}`}
Date: ${paymentDateFormatted}
Payment Method: ${payment.payment_method?.toUpperCase()}
${payment.reference ? `Transaction / Ref Code: ${payment.reference}\n` : ''}---------------------------------
*Amount Paid: KES ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}*
${payment.notes ? `Remarks: "${payment.notes}"\n` : ''}Authorized By: ${payment.authorizer_name || 'Accounts Office'}
---------------------------------
Debited from company funds & recorded against supplier ledger balance.`;

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
        <div className="w-screen max-w-3xl bg-slate-100 shadow-2xl flex flex-col print:shadow-none print:bg-white print:max-w-none print:w-full animate-in slide-in-from-right duration-200">
          
          {/* Top Control Bar (Screen Only) */}
          <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between shadow-md print:hidden shrink-0">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-xs">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm tracking-tight text-white font-mono">
                    {voucherNo}
                  </span>
                  <button
                    onClick={handleCopyVoucherNo}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                    title="Copy Voucher Number"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    DISBURSEMENT CONFIRMED
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                  {payment.supplier_name || 'Vendor'} • KES {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
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

          {/* Quick Action Command Strip (Screen Only) */}
          <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 print:hidden shrink-0 shadow-xs">
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrint}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Payment Voucher</span>
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
                title="Share Payment Voucher via WhatsApp"
              >
                <Share2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>WhatsApp</span>
              </button>
            </div>

            {/* View Statement Link */}
            {payment.supplier_id && onViewSupplierStatement && (
              <button
                onClick={() => onViewSupplierStatement(payment.supplier_id)}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>View Full Statement</span>
                <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
              </button>
            )}
          </div>

          {/* Main Scrollable Document Canvas */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 print:p-0 print:overflow-visible">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl border border-slate-200 shadow-md print:shadow-none print:border-none print:p-0">
              
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
                <div>
                  <span className="text-xs font-black uppercase tracking-widest text-emerald-600">OFFICIAL DISBURSEMENT</span>
                  <h1 className="text-2xl font-black text-slate-950 tracking-tight mt-0.5">SUPPLIER PAYMENT VOUCHER</h1>
                  <div className="text-xs text-slate-600 font-medium mt-1">{storeName}</div>
                  <div className="text-xs text-slate-500">{storeAddress} • Tel: {storePhone}</div>
                  <div className="text-xs text-slate-500 font-mono">Tax PIN: {storeTaxId}</div>
                </div>

                <div className="text-right space-y-1">
                  <div className="inline-block bg-slate-900 text-white px-3 py-1 rounded-lg text-xs font-mono font-bold">
                    {voucherNo}
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-1">
                    Date: <strong>{paymentDateFormatted}</strong>
                  </div>
                  <div className="text-xs text-emerald-700 font-bold uppercase">
                    Status: Settled & Posted
                  </div>
                </div>
              </div>

              {/* Payee Info & Payment Method Matrix */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-xs">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payee (Beneficiary Vendor):</div>
                  <div className="text-sm font-bold text-slate-900">{payment.supplier_name || `Supplier #${payment.supplier_id}`}</div>
                  <div className="text-slate-500">Vendor Account #{payment.supplier_id}</div>
                </div>

                <div className="space-y-1 text-right sm:text-left sm:pl-4 sm:border-l sm:border-slate-200">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Disbursement Mode:</div>
                  <div className="font-bold text-slate-900 uppercase">
                    {payment.payment_method === 'bank' ? 'Bank Transfer / EFT' : payment.payment_method?.toUpperCase()}
                  </div>
                  {payment.reference && (
                    <div className="text-slate-700 font-mono">
                      Ref / Trx ID: <strong className="text-slate-950">{payment.reference}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Amount Box */}
              <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200 mb-6 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">Total Amount Disbursed</div>
                  <div className="text-[11px] text-emerald-600 mt-0.5">Credited to Vendor Ledger & Company Accounts</div>
                </div>
                <div className="text-2xl font-black font-mono text-emerald-900">
                  KES {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Notes / Particulars */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white mb-6 space-y-1 text-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment Description / Particulars:</div>
                <div className="text-slate-800 font-medium">
                  {payment.notes || 'Settlement payment towards outstanding delivery supplier account balance.'}
                </div>
              </div>

              {/* Authorization & Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-dashed border-slate-300 text-xs">
                <div className="space-y-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Prepared & Authorized By:</div>
                  <div className="font-bold text-slate-900">{payment.authorizer_name || 'Finance / Store Manager'}</div>
                  <div className="border-b border-slate-400 h-6"></div>
                  <div className="text-[11px] text-slate-600">Signature / Date</div>
                </div>

                <div className="space-y-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Received / Confirmed By (Vendor / Rep):</div>
                  <div className="font-bold text-slate-900">{payment.supplier_name || 'Vendor Representative'}</div>
                  <div className="border-b border-slate-400 h-6"></div>
                  <div className="text-[11px] text-slate-600">Signature / Stamp / Date</div>
                </div>
              </div>

              <div className="mt-8 text-center text-[10px] text-slate-400">
                Official Supplier Payment Voucher • POS Business Management System
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
