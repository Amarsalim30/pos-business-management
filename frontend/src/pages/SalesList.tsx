import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import type { Sale } from '../types';
import { ReceiptModal } from '../components/ReceiptModal';
import {
  FileText,
  Search,
  Printer,
  RotateCcw,
  Download,
  AlertCircle
} from 'lucide-react';

export const SalesListPage: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [etrFilter, setEtrFilter] = useState<string>('all');
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);
  
  // Void Modal State
  const [voidingSale, setVoidingSale] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidLoading, setVoidLoading] = useState(false);

  useEffect(() => {
    loadSales();
  }, [statusFilter, etrFilter]);

  const loadSales = async () => {
    try {
      let url = '/api/v1/sales/?limit=100';
      if (searchQuery) url += `&q=${encodeURIComponent(searchQuery)}`;
      if (statusFilter !== 'all') url += `&status_filter=${statusFilter}`;
      if (etrFilter === 'etr') url += `&is_etr=true`;
      if (etrFilter === 'non_etr') url += `&is_etr=false`;

      const data = await apiFetch<Sale[]>(url);
      setSales(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleVoidSale = async () => {
    if (!voidingSale) return;
    setVoidLoading(true);
    try {
      await apiFetch(`/api/v1/sales/${voidingSale.id}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: voidReason.trim() || 'Voided by cashier' })
      });
      setVoidingSale(null);
      setVoidReason('');
      loadSales();
    } catch (err: any) {
      alert(err.message || 'Failed to void sale');
    } finally {
      setVoidLoading(false);
    }
  };

  const exportSalesCSV = () => {
    if (sales.length === 0) return;
    const headers = ['Invoice No', 'Date', 'Cashier', 'Customer', 'Payment Method', 'Subtotal', 'Discount', 'Total (KES)', 'Status', 'ETR'];
    const rows = sales.map(s => [
      `"${s.invoice_no}"`,
      new Date(s.created_at).toLocaleString(),
      `"${(s.cashier_name || 'Staff').replace(/"/g, '""')}"`,
      `"${(s.customer_name || 'Walk-in').replace(/"/g, '""')}"`,
      s.payment_method,
      s.subtotal,
      s.discount_amount,
      s.total_amount,
      s.status,
      s.is_etr ? 'YES' : 'NO'
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sales_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <FileText className="h-5 w-5 text-amber-600" />
            <span>Sales & Transaction Invoices</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            View transaction history, reprint 80mm thermal receipts, and void cancelled sales
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={exportSalesCSV}
            disabled={sales.length === 0}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadSales()}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
            />
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-slate-700">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid / Credit</option>
              <option value="voided">Voided</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-slate-700">ETR:</label>
            <select
              value={etrFilter}
              onChange={(e) => setEtrFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
            >
              <option value="all">All Invoices</option>
              <option value="etr">ETR Only</option>
              <option value="non_etr">Non-ETR Only</option>
            </select>
          </div>
        </div>

        <button
          onClick={loadSales}
          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {/* Sales Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Invoice No</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Payment Method</th>
                <th className="px-4 py-3 text-right">Items</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    No sales invoices recorded matching your filters.
                  </td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-slate-900 flex items-center space-x-1.5">
                        <span>{s.invoice_no}</span>
                        {s.is_etr && (
                          <span className="px-1 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                            ETR
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">By {s.cashier_name || 'Staff'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {s.customer_name ? (
                        <span className="font-bold text-slate-900">{s.customer_name}</span>
                      ) : (
                        <span className="text-slate-400 italic">Walk-in Customer</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                        {s.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-600">
                      {s.items.length}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      KES {Number(s.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        s.status === 'paid'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : s.status === 'voided'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setSelectedSaleForReceipt(s)}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                          title="Print 80mm Receipt"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        {s.status !== 'voided' && (
                          <button
                            onClick={() => setVoidingSale(s)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-[11px] cursor-pointer"
                            title="Void this sale and return items to stock"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Void</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 80mm Receipt Modal */}
      <ReceiptModal
        sale={selectedSaleForReceipt}
        onClose={() => setSelectedSaleForReceipt(null)}
      />

      {/* Void Modal Confirmation */}
      {voidingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertCircle className="h-5 w-5" />
              <h3 className="font-bold text-base text-slate-900">Void Transaction {voidingSale.invoice_no}</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Voiding this sale will mark it as cancelled, reverse credit balances (if applicable), and strictly return all sold items back into active store inventory with audit trail.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Reason for Voiding:</label>
              <textarea
                placeholder="E.g. Customer returned items, Cashier input error"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setVoidingSale(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleVoidSale}
                disabled={voidLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              >
                {voidLoading ? 'Voiding...' : 'Confirm Void & Return Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
