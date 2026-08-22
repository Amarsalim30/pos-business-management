import React from 'react';
import type { Sale, PreSaleDocument } from '../types';
import { COMPANY_CONSTANTS } from '../constants/companyConstants';
import { ShieldCheck, Phone, Mail, MapPin, Truck } from 'lucide-react';

export interface A4InvoiceDocumentProps {
  sale?: Sale | null;
  preSaleDoc?: PreSaleDocument | null;
  storeName?: string;
  storePhone?: string;
  storeEmail?: string;
  storeAddress?: string;
  storeLandmark?: string;
  storeTaxId?: string;
  bankName?: string;
  bankAccount?: string;
  bankBranch?: string;
  paybillNumber?: string;
  paybillAccount?: string;
  headerBanner?: string;
  logo?: string;
  documentTitle?: string;
  isDeliveryNote?: boolean;
  driverName?: string;
  vehicleReg?: string;
  deliveryAddress?: string;
}

export const A4InvoiceDocument: React.FC<A4InvoiceDocumentProps> = ({
  sale,
  preSaleDoc,
  storeName = COMPANY_CONSTANTS.companyName,
  storePhone = COMPANY_CONSTANTS.phone,
  storeEmail = COMPANY_CONSTANTS.email,
  storeAddress = COMPANY_CONSTANTS.address,
  storeLandmark = COMPANY_CONSTANTS.landmark,
  storeTaxId = COMPANY_CONSTANTS.taxId,
  bankName = COMPANY_CONSTANTS.bankName,
  bankAccount = COMPANY_CONSTANTS.bankAccountNo,
  bankBranch = COMPANY_CONSTANTS.bankBranch,
  paybillNumber = COMPANY_CONSTANTS.paybillNumber,
  paybillAccount = sale ? sale.invoice_no : preSaleDoc ? preSaleDoc.document_no : "STORE-ACC",
  headerBanner = COMPANY_CONSTANTS.headerBannerPath,
  logo = COMPANY_CONSTANTS.logoPath,
  documentTitle,
  isDeliveryNote = false,
  driverName,
  vehicleReg,
  deliveryAddress
}) => {
  if (!sale && !preSaleDoc) return null;

  const docNo = sale ? sale.invoice_no : preSaleDoc?.document_no || '';
  const cleanDocNo = docNo.replace(/^QT-/, '').trim();
  const isEtr = sale ? sale.is_etr : false;
  const createdAt = sale ? sale.created_at : preSaleDoc?.created_at || '';
  const customerName = sale ? sale.customer_name : preSaleDoc?.customer_name;
  const customerPhone = sale ? (sale as any).customer_phone : (preSaleDoc as any)?.customer_phone;
  const siteName = sale?.site_name || preSaleDoc?.site_name;
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
    month: '2-digit',
    year: 'numeric'
  });

  const formattedTime = new Date(createdAt).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const items = sale ? sale.items : (preSaleDoc?.items || []);

  const defaultTitle = isDeliveryNote
    ? "DELIVERY / DISPATCH NOTE"
    : preSaleDoc
      ? (preSaleDoc.type === 'proforma' ? "PROFORMA INVOICE" : "QUOTATION")
      : "INVOICE";

  const resolvedTitle = documentTitle || defaultTitle;

  return (
    <div
      id="a4-invoice-container"
      className="bg-white text-slate-900 font-sans p-6 sm:p-8 max-w-[210mm] mx-auto shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none text-xs leading-normal print:text-[11px]"
      style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
    >
      {/* 1. TOP HEADER SOLAR BANNER (1:1 with Quotation_QT-0163.pdf) */}
      <div className="w-full overflow-hidden mb-3">
        {headerBanner ? (
          <img
            src={headerBanner}
            alt={storeName}
            className="w-full h-auto block object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : logo ? (
          <div className="text-center py-2">
            <img src={logo} alt={storeName} className="h-16 object-contain mx-auto" />
          </div>
        ) : (
          <div className="text-center py-2">
            <h1 className="text-2xl font-black tracking-tight text-[#0F2A4A] uppercase">
              {storeName}
            </h1>
          </div>
        )}
      </div>

      {/* 2. CONTACT DETAILS (LEFT) | ORANGE SEPARATOR | METADATA (RIGHT) */}
      <div className="flex flex-row items-stretch justify-between gap-2 py-1">
        {/* Left: Company Contact Info with Circular Navy Badges */}
        <div className="flex-1 space-y-2">
          {/* Address & Landmark */}
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-[#0F2A4A] text-white flex items-center justify-center shrink-0">
              <MapPin className="h-3 w-3 fill-white" />
            </div>
            <div className="w-[1.5px] h-6 bg-[#F58220] shrink-0" />
            <div className="text-[10px] font-bold text-slate-900 uppercase leading-tight">
              <div>{storeAddress}</div>
              {storeLandmark && <div className="text-slate-700">{storeLandmark}</div>}
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-[#0F2A4A] text-white flex items-center justify-center shrink-0">
              <Phone className="h-2.5 w-2.5 fill-white" />
            </div>
            <div className="w-[1.5px] h-4 bg-[#F58220] shrink-0" />
            <div className="text-[11px] font-bold text-slate-900 font-mono">
              {storePhone}
            </div>
          </div>

          {/* Email */}
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-[#0F2A4A] text-white flex items-center justify-center shrink-0">
              <Mail className="h-2.5 w-2.5 text-white" />
            </div>
            <div className="w-[1.5px] h-4 bg-[#F58220] shrink-0" />
            <div className="text-[10.5px] font-bold text-slate-900">
              {storeEmail}
            </div>
          </div>

          {/* Optional KRA PIN / ETR Tag */}
          <div className="flex items-center gap-2 pt-1">
            {storeTaxId && (
              <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 text-[9.5px] font-mono font-bold text-slate-800 rounded">
                PIN: {storeTaxId}
              </span>
            )}
            {isEtr && !isDeliveryNote && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 border border-amber-300 text-amber-900 text-[9.5px] font-bold uppercase rounded">
                <ShieldCheck className="h-3 w-3 text-amber-600" /> ETR Fiscal Document
              </span>
            )}
            {isDeliveryNote && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-sky-50 border border-sky-300 text-sky-900 text-[9.5px] font-bold uppercase rounded">
                <Truck className="h-3 w-3 text-sky-600" /> Dispatch & Gate Pass
              </span>
            )}
            {sale && !isDeliveryNote && (
              <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider ${isPaid
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : isPartial
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : isUnpaid
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-slate-200 text-slate-800'
                }`}>
                {isPaid ? 'PAID' : isPartial ? 'PARTIAL' : isUnpaid ? 'UNPAID' : sale.status}
              </span>
            )}
          </div>
        </div>

        {/* Center Vertical Orange Divider */}
        <div className="w-[1.5px] bg-[#F58220] self-stretch mx-3 shrink-0" />

        {/* Right: Document Title & Metadata Key-Values */}
        <div className="w-[44%] space-y-1">
          <div>
            <h2 className="text-base font-black tracking-wider text-[#0F2A4A] uppercase">
              {resolvedTitle}
            </h2>
            <div className="w-12 h-[2.5px] bg-[#F58220] mt-0.5 mb-2 rounded-full" />
          </div>

          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="font-bold text-[#0F2A4A] w-28">
                {isDeliveryNote ? 'Delivery No.' : preSaleDoc ? 'Quotation No.' : 'Invoice No.'}
              </span>
              <span className="text-slate-400 w-3">:</span>
              <span className="font-bold font-mono text-slate-900 flex-1 text-right">
                {preSaleDoc ? (cleanDocNo || docNo) : docNo}
              </span>
            </div>

            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="font-bold text-[#0F2A4A] w-28">Date</span>
              <span className="text-slate-400 w-3">:</span>
              <span className="font-medium text-slate-900 flex-1 text-right font-mono">
                {formattedDate} {isDeliveryNote && `(${formattedTime})`}
              </span>
            </div>

            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="font-bold text-[#0F2A4A] w-28">
                {isDeliveryNote ? 'Deliver To' : 'Customer'}
              </span>
              <span className="text-slate-400 w-3">:</span>
              <span className="font-bold text-slate-900 flex-1 text-right truncate">
                {customerName || 'Walk-in Retail Customer'}
              </span>
            </div>

            {customerPhone && (
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="font-bold text-[#0F2A4A] w-28">Phone</span>
                <span className="text-slate-400 w-3">:</span>
                <span className="font-mono text-slate-900 flex-1 text-right">
                  {customerPhone}
                </span>
              </div>
            )}

            {deliveryAddress && isDeliveryNote && (
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="font-bold text-[#0F2A4A] w-28">Destination</span>
                <span className="text-slate-400 w-3">:</span>
                <span className="text-slate-900 flex-1 text-right truncate font-medium">
                  {deliveryAddress}
                </span>
              </div>
            )}

            {siteName && (
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="font-bold text-[#0F2A4A] w-28">Site / Project</span>
                <span className="text-slate-400 w-3">:</span>
                <span className="font-bold text-amber-800 flex-1 text-right truncate">
                  {siteName}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="font-bold text-[#0F2A4A] w-28">Staff</span>
              <span className="text-slate-400 w-3">:</span>
              <span className="text-slate-700 flex-1 text-right font-medium">
                {cashierName}
              </span>
            </div>

            {preSaleDoc?.valid_until && !isDeliveryNote && (
              <div className="flex items-center justify-between pb-1">
                <span className="font-bold text-rose-700 w-28">Valid Until</span>
                <span className="text-slate-400 w-3">:</span>
                <span className="font-mono font-bold text-rose-700 flex-1 text-right">
                  {new Date(preSaleDoc.valid_until).toLocaleDateString('en-GB')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. SOLID NAVY HORIZONTAL DIVIDER BAR */}
      <div className="h-[2.5px] bg-[#0F2A4A] w-full my-3.5" />

      {/* 4. PRODUCT LINE ITEMS TABLE */}
      <div className="my-2">
        <table className="w-full text-left border-collapse border border-slate-300">
          <thead>
            <tr className="bg-[#0F2A4A] text-white text-[10px] font-bold uppercase tracking-wider">
              <th className="py-2 px-2.5 w-8 text-center border-r border-slate-700">#</th>
              <th className="py-2 px-3 border-r border-slate-700">ITEM DESCRIPTION</th>
              <th className="py-2 px-2.5 w-20 text-center border-r border-slate-700">QTY</th>
              {isDeliveryNote ? (
                <>
                  <th className="py-2 px-3 text-center border-r border-slate-700 w-24">UNIT</th>
                  <th className="py-2 px-3 text-right">REMARKS / PACKAGE</th>
                </>
              ) : (
                <>
                  <th className="py-2 px-3 text-right border-r border-slate-700 w-32">UNIT PRICE (KSH)</th>
                  <th className="py-2 px-3 text-right w-32">TOTAL (KSH)</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300 text-xs">
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

              const isEven = idx % 2 === 0;

              return (
                <tr key={item.id || idx} className={isEven ? 'bg-white' : 'bg-[#F8FAFC]'}>
                  <td className="py-2 px-2.5 text-center font-mono text-slate-500 border-r border-slate-300">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3 border-r border-slate-300">
                    <div className="font-bold text-slate-900 uppercase">{itemLabel}</div>
                    {item.sku && (
                      <div className="text-[10px] text-slate-400 font-mono">SKU: {item.sku}</div>
                    )}
                  </td>
                  <td className="py-2 px-2.5 text-center font-mono font-bold text-slate-900 border-r border-slate-300 whitespace-nowrap">
                    {displayQty}
                  </td>
                  {isDeliveryNote ? (
                    <>
                      <td className="py-2 px-3 text-center font-mono text-slate-600 uppercase text-[10px] border-r border-slate-300">
                        {item.unit_type === 'roll' ? 'Rolls/Meters' : (item.unit_sold || 'Pieces')}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600 text-[10px]">
                        Good Condition [✓]
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 px-3 text-right font-mono text-slate-800 border-r border-slate-300 whitespace-nowrap">
                        Ksh{Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-950 whitespace-nowrap">
                        Ksh{Number(item.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 5. BOTTOM SECTION: BANK DETAILS & FINANCIAL TOTALS GRID (ALWAYS SIDE-BY-SIDE) */}
      <div className="my-3.5 flex flex-row items-stretch justify-between gap-4">
        {/* Left: Bank Details Box (or Delivery Certification) */}
        <div className="flex-1">
          {isDeliveryNote ? (
            <div className="h-full p-3 bg-slate-50 border border-slate-300 rounded-lg space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#0F2A4A]">
                Delivery & Gate Clearance Certification:
              </div>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                I hereby certify that the quantities and items listed above have been checked, inspected, and received in full in good order and condition.
              </p>
              <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-[10px] font-mono">
                <div>
                  <span className="text-slate-500 block">Driver / Carrier:</span>
                  <span className="font-bold text-slate-900">{driverName || 'Store Transport'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Vehicle Reg No:</span>
                  <span className="font-bold text-slate-900">{vehicleReg || 'As Assigned'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full p-3 bg-white border border-slate-300 rounded-lg space-y-1.5">
              <div className="text-[10.5px] font-bold text-[#0F2A4A] tracking-wide uppercase border-b border-slate-100 pb-1">
                BANK DETAILS
              </div>
              <div className="space-y-1 text-xs text-slate-800">
                <div className="flex items-start">
                  <span className="w-24 font-bold text-[11px] text-slate-700">Account Name</span>
                  <span className="w-3 text-slate-400">:</span>
                  <span className="font-medium text-slate-900">{storeName}</span>
                </div>
                <div className="flex items-start">
                  <span className="w-24 font-bold text-[11px] text-slate-700">Bank</span>
                  <span className="w-3 text-slate-400">:</span>
                  <span className="font-bold text-slate-900">{bankName}</span>
                </div>
                <div className="flex items-start">
                  <span className="w-24 font-bold text-[11px] text-slate-700">Account No.</span>
                  <span className="w-3 text-slate-400">:</span>
                  <span className="font-bold font-mono text-slate-900">{bankAccount}</span>
                </div>
                {bankBranch && (
                  <div className="flex items-start">
                    <span className="w-24 font-bold text-[11px] text-slate-700">Branch</span>
                    <span className="w-3 text-slate-400">:</span>
                    <span className="text-slate-800 uppercase text-[10px] leading-tight">{bankBranch}</span>
                  </div>
                )}
                {paybillNumber && (
                  <div className="flex items-start pt-1 border-t border-slate-100 text-[10.5px] text-slate-700">
                    <span className="w-24 font-bold text-[10px] text-slate-600">M-Pesa Paybill</span>
                    <span className="w-3 text-slate-400">:</span>
                    <span className="font-mono font-bold text-slate-900">{paybillNumber} <span className="text-slate-500 font-normal">| Acc: {paybillAccount}</span></span>
                  </div>
                )}
              </div>

              {/* Payments History if Invoice */}
              {sale?.payments && sale.payments.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] space-y-0.5 font-mono">
                  <span className="font-bold text-emerald-950 block">Payment Audit ({sale.payments.length}):</span>
                  {sale.payments.map((p, pIdx) => (
                    <div key={p.id || pIdx} className="flex justify-between text-emerald-900">
                      <span>{p.payment_method.toUpperCase()}{p.reference ? ` (${p.reference})` : ''}</span>
                      <span className="font-bold">KES {Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Financial Summary Grid Box (Fixed Width, Never Stacking) */}
        {!isDeliveryNote && (
          <div className="w-72 border border-slate-300 rounded-lg overflow-hidden shrink-0 self-start">
            <table className="w-full text-xs font-mono border-collapse">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-1.5 px-3 font-bold text-slate-700">SUBTOTAL</td>
                  <td className="py-1.5 px-3 text-right font-medium text-slate-900">
                    KSh {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                {discountAmount > 0 && (
                  <tr className="border-b border-slate-200 text-rose-600">
                    <td className="py-1.5 px-3 font-bold">DISCOUNT</td>
                    <td className="py-1.5 px-3 text-right font-bold">
                      - KSh {discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}

                <tr className="border-b border-slate-200 text-slate-600">
                  <td className="py-1.5 px-3">VAT (Inclusive)</td>
                  <td className="py-1.5 px-3 text-right text-slate-600 font-mono">
                    {taxAmount > 0 ? `KSh ${taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                  </td>
                </tr>

                {/* Grand Total Solid Navy Bar */}
                <tr className="bg-[#0F2A4A] text-white">
                  <td className="py-2 px-3 font-black text-xs uppercase">GRAND TOTAL</td>
                  <td className="py-2 px-3 text-right font-black text-sm">
                    KSh {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Balance Due Row */}
                <tr>
                  <td className="py-1.5 px-3 font-bold text-[#0F2A4A] uppercase">BALANCE DUE</td>
                  <td className="py-1.5 px-3 text-right font-black text-[#0F2A4A]">
                    KSh {balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. FOOTER TERMS BOX (ALWAYS 3 EQUAL COLUMNS) */}
      <div className="my-3.5 border border-slate-300 rounded-lg p-3 bg-white">
        {isDeliveryNote ? (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="border-t border-slate-300 pt-4 mt-2">
              <span className="text-[10px] font-bold text-slate-700 uppercase block">Dispatched By (Staff)</span>
              <span className="text-[9px] text-slate-400 font-mono block mt-1">Sign & Date</span>
            </div>
            <div className="border-t border-slate-300 pt-4 mt-2">
              <span className="text-[10px] font-bold text-slate-700 uppercase block">Driver / Carrier</span>
              <span className="text-[9px] text-slate-400 font-mono block mt-1">Sign & ID No</span>
            </div>
            <div className="border-t border-slate-300 pt-4 mt-2">
              <span className="text-[10px] font-bold text-slate-700 uppercase block">Received By (Client)</span>
              <span className="text-[9px] text-slate-400 font-mono block mt-1">Sign, Stamp & Date</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 divide-x divide-slate-200">
            {/* Pillar 1: Validity */}
            <div className="space-y-1 pr-2">
              <div className="text-[10px] font-bold text-[#0F2A4A] uppercase">VALIDITY</div>
              <div className="text-[9.5px] text-slate-600 leading-snug">
                {COMPANY_CONSTANTS.validityText}
              </div>
            </div>

            {/* Pillar 2: VAT */}
            <div className="space-y-1 px-2">
              <div className="text-[10px] font-bold text-[#0F2A4A] uppercase">VAT</div>
              <div className="text-[9.5px] text-slate-600 leading-snug">
                {COMPANY_CONSTANTS.vatText}
              </div>
            </div>

            {/* Pillar 3: Terms & Conditions */}
            <div className="space-y-1 pl-2">
              <div className="text-[10px] font-bold text-[#0F2A4A] uppercase">TERMS & CONDITIONS</div>
              <div className="text-[9.5px] text-slate-600 leading-snug">
                {COMPANY_CONSTANTS.termsText}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 7. CENTERING SIGN-OFF TAGLINE */}
      <div className="text-center pt-2 text-xs italic font-medium text-[#0F2A4A]">
        {COMPANY_CONSTANTS.taglineText}
      </div>
    </div>
  );
};
