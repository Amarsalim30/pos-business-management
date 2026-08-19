import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiFetch } from '../services/api';
import type { Sale, Customer } from '../types';
import { ReceiptModal } from '../components/ReceiptModal';
import { InvoiceDrawer } from '../components/InvoiceDrawer';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import {
  FileText,
  Search,
  Printer,
  RotateCcw,
  Download,
  AlertCircle,
  Calendar,
  Banknote,
  Split,
  Loader2,
  Eye,
  Users,
  User,
  X,
  ChevronDown,
  Check,
  MapPin
} from 'lucide-react';

export const SalesListPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [etrFilter, setEtrFilter] = useState<string>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Searchable Customer Combobox State
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerPickerSearch, setCustomerPickerSearch] = useState('');
  const [customerPickerTab, setCustomerPickerTab] = useState<'all' | 'debt' | 'walkin'>('all');
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  const [selectedSaleForDrawer, setSelectedSaleForDrawer] = useState<Sale | null>(null);
  const [drawerFormat, setDrawerFormat] = useState<'a4' | 'thermal'>('a4');
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);

  // Void Modal State
  const [voidingSale, setVoidingSale] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidLoading, setVoidLoading] = useState(false);

  // Direct Invoice Payment Modal State
  const [payingSale, setPayingSale] = useState<Sale | null>(null);
  const [invoicePayAmount, setInvoicePayAmount] = useState('');
  const [invoicePayMethod, setInvoicePayMethod] = useState('mpesa');
  const [invoicePayRef, setInvoicePayRef] = useState('');
  const [invoicePayNotes, setInvoicePayNotes] = useState('');
  const [recordingPay, setRecordingPay] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Infinite Scroll Sales State
  const {
    items: sales,
    loading: salesLoading,
    loadingMore: salesLoadingMore,
    hasMore: salesHasMore,
    sentinelRef: salesSentinelRef,
    reload: reloadSales
  } = useInfiniteScroll<Sale>({
    fetchFn: async (offset, limit) => {
      let url = `/api/v1/sales/?limit=${limit}&offset=${offset}`;
      if (searchQuery.trim()) url += `&q=${encodeURIComponent(searchQuery.trim())}`;
      if (statusFilter !== 'all') url += `&status_filter=${statusFilter}`;
      if (etrFilter === 'etr') url += `&is_etr=true`;
      if (etrFilter === 'non_etr') url += `&is_etr=false`;
      if (selectedCustomerId !== 'all') url += `&customer_id=${selectedCustomerId}`;
      if (dateFrom && !dateTo) {
        url += `&date_from=${encodeURIComponent(`${dateFrom}T00:00:00`)}`;
        url += `&date_to=${encodeURIComponent(`${dateFrom}T23:59:59`)}`;
      } else if (dateTo && !dateFrom) {
        url += `&date_from=${encodeURIComponent(`${dateTo}T00:00:00`)}`;
        url += `&date_to=${encodeURIComponent(`${dateTo}T23:59:59`)}`;
      } else {
        if (dateFrom) url += `&date_from=${encodeURIComponent(`${dateFrom}T00:00:00`)}`;
        if (dateTo) url += `&date_to=${encodeURIComponent(`${dateTo}T23:59:59`)}`;
      }
      return await apiFetch<Sale[]>(url);
    },
    limit: 25,
    dependencies: [searchQuery, statusFilter, etrFilter, selectedCustomerId, dateFrom, dateTo]
  });

  const setDatePreset = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
    const now = new Date();
    const formatYMD = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (preset === 'today') {
      const todayStr = formatYMD(now);
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = formatYMD(y);
      setDateFrom(yStr);
      setDateTo(yStr);
    } else if (preset === 'week') {
      const w = new Date(now);
      w.setDate(w.getDate() - 7);
      setDateFrom(formatYMD(w));
      setDateTo(formatYMD(now));
    } else if (preset === 'month') {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateFrom(formatYMD(m));
      setDateTo(formatYMD(now));
    } else if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await apiFetch<Customer[]>('/api/v1/customers/');
      setCustomers(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Close customer dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const debtCustomersCount = useMemo(() => {
    return customers.filter(c => Number(c.balance) > 0).length;
  }, [customers]);

  const filteredCustomersForPicker = useMemo(() => {
    let list = customers;
    if (customerPickerTab === 'debt') {
      list = list.filter(c => Number(c.balance) > 0);
    }
    if (customerPickerSearch.trim()) {
      const q = customerPickerSearch.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)));
    }
    return list;
  }, [customers, customerPickerSearch, customerPickerTab]);

  const selectedCustomerObj = useMemo(() => {
    if (selectedCustomerId === 'all' || selectedCustomerId === '-1') return null;
    return customers.find(c => String(c.id) === String(selectedCustomerId)) || null;
  }, [customers, selectedCustomerId]);

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
      reloadSales();
    } catch (err: any) {
      alert(err.message || 'Failed to void sale');
    } finally {
      setVoidLoading(false);
    }
  };

  const handleRecordInvoicePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSale) return;
    const amt = parseFloat(invoicePayAmount);
    if (!amt || amt <= 0) {
      setPayError('Please enter a valid payment amount');
      return;
    }

    setRecordingPay(true);
    setPayError(null);

    try {
      await apiFetch(`/api/v1/sales/${payingSale.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          payment_method: invoicePayMethod,
          reference: invoicePayRef.trim() || null,
          notes: invoicePayNotes.trim() || null
        })
      });
      setPayingSale(null);
      setInvoicePayAmount('');
      setInvoicePayRef('');
      setInvoicePayNotes('');
      reloadSales();
    } catch (err: any) {
      setPayError(err.message || 'Failed to record invoice payment');
    } finally {
      setRecordingPay(false);
    }
  };

  const exportSalesCSV = () => {
    if (sales.length === 0) return;
    const headers = ['Invoice No', 'Date', 'Cashier', 'Customer', 'Payment Method', 'Subtotal', 'Discount', 'Total (KES)', 'Total Paid', 'Balance Due', 'Status', 'ETR'];
    const rows = sales.map(s => [
      `"${s.invoice_no}"`,
      new Date(s.created_at).toLocaleString(),
      `"${(s.cashier_name || 'Staff').replace(/"/g, '""')}"`,
      `"${(s.customer_name || 'Walk-in').replace(/"/g, '""')}"`,
      s.payment_method,
      s.subtotal,
      s.discount_amount,
      s.total_amount,
      s.total_paid || 0,
      s.balance_due || 0,
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

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setEtrFilter('all');
    setSelectedCustomerId('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <FileText className="h-5 w-5 text-amber-600" />
            <span>Sales & Invoices Registry</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Single-row invoice tracking, live payment status, reprint 80mm thermal receipts, and audit voids
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={exportSalesCSV}
            disabled={sales.length === 0}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          {/* Universal Search Bar */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice #, customer, phone, item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-8 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Date Range Picker */}
          <div className="md:col-span-3 flex items-center space-x-1">
            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              title="Date From"
              value={dateFrom}
              onChange={(e) => {
                const val = e.target.value;
                setDateFrom(val);
                if (val && !dateTo) setDateTo(val);
              }}
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-amber-600 font-mono shadow-2xs"
            />
            <span className="text-slate-400 text-xs shrink-0">to</span>
            <input
              type="date"
              title="Date To"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-amber-600 font-mono shadow-2xs"
            />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                className="p-1 text-slate-400 hover:text-rose-600 rounded-full cursor-pointer shrink-0"
                title="Clear date filter"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Searchable Customer Combobox */}
          <div className="md:col-span-3 relative" ref={customerDropdownRef}>
            <button
              type="button"
              onClick={() => setCustomerDropdownOpen(!customerDropdownOpen)}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl border text-xs transition-all cursor-pointer shadow-2xs min-w-0 ${
                selectedCustomerId !== 'all'
                  ? 'border-amber-500 bg-amber-50/50 text-slate-900 font-bold'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate min-w-0 mr-1">
                <Users className={`h-3.5 w-3.5 shrink-0 ${selectedCustomerId !== 'all' ? 'text-amber-600' : 'text-slate-400'}`} />
                <span className="truncate">
                  {selectedCustomerId === 'all'
                    ? `All Customers (${customers.length})`
                    : selectedCustomerId === '-1'
                    ? 'Walk-in Only'
                    : selectedCustomerObj
                    ? selectedCustomerObj.name
                    : `Customer #${selectedCustomerId}`}
                </span>
                {selectedCustomerObj && Number(selectedCustomerObj.balance) > 0 && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-rose-100 text-rose-700 font-mono font-bold shrink-0 truncate max-w-[90px]">
                    {Number(selectedCustomerObj.balance).toLocaleString()} due
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {selectedCustomerId !== 'all' && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCustomerId('all');
                    }}
                    className="p-0.5 text-slate-400 hover:text-rose-600 rounded-full cursor-pointer"
                    title="Reset customer filter"
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </button>

            {/* Dropdown Popover */}
            {customerDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white rounded-xl border border-slate-200 shadow-xl p-2 space-y-2 max-w-sm w-[320px] animate-in fade-in zoom-in-95 duration-100">
                {/* Search in Dropdown */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3 w-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter customer name or phone..."
                    value={customerPickerSearch}
                    onChange={(e) => setCustomerPickerSearch(e.target.value)}
                    autoFocus
                    className="w-full pl-8 pr-2 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:outline-none focus:border-amber-600"
                  />
                </div>

                {/* Quick Segment Filter Chips */}
                <div className="flex items-center gap-1 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setCustomerPickerTab('all')}
                    className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                      customerPickerTab === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All ({customers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerPickerTab('debt')}
                    className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                      customerPickerTab === 'debt' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    With Debt ({debtCustomersCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomerId('-1');
                      setCustomerDropdownOpen(false);
                    }}
                    className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                      selectedCustomerId === '-1' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Walk-in Only
                  </button>
                </div>

                {/* Customer List */}
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomerId('all');
                      setCustomerDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                      selectedCustomerId === 'all' ? 'bg-amber-50 font-bold text-amber-900' : 'text-slate-700'
                    }`}
                  >
                    <span>All Customers</span>
                    {selectedCustomerId === 'all' && <Check className="h-3.5 w-3.5 text-amber-600" />}
                  </button>

                  {filteredCustomersForPicker.length === 0 ? (
                    <div className="py-4 text-center text-[11px] text-slate-400">
                      No matching customers found
                    </div>
                  ) : (
                    filteredCustomersForPicker.map((c) => {
                      const isSelected = String(c.id) === String(selectedCustomerId);
                      const debt = Number(c.balance);

                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId(String(c.id));
                            setCustomerDropdownOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors ${
                            isSelected ? 'bg-amber-50 font-bold text-amber-900' : 'text-slate-700'
                          }`}
                        >
                          <div className="truncate mr-2">
                            <div className="truncate font-semibold">{c.name}</div>
                            {c.phone && <div className="text-[10px] text-slate-400">{c.phone}</div>}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {debt > 0 ? (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 font-mono font-bold border border-rose-200">
                                KES {debt.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-[9px] text-emerald-600 font-medium">Clean</span>
                            )}
                            {isSelected && <Check className="h-3.5 w-3.5 text-amber-600" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Fiscal Type Filter & Reset */}
          <div className="md:col-span-2 flex items-center justify-end space-x-2">
            <select
              value={etrFilter}
              onChange={(e) => setEtrFilter(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600 shadow-2xs"
            >
              <option value="all">All Fiscal Types</option>
              <option value="etr">ETR Only</option>
              <option value="non_etr">Non-ETR</option>
            </select>

            <button
              onClick={resetFilters}
              className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
              title="Reset Filters"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Status Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 mr-1">Status:</span>
            {[
              { id: 'all', label: 'All Invoices' },
              { id: 'paid', label: 'Paid' },
              { id: 'partial', label: 'Partial Debt' },
              { id: 'unpaid', label: 'Unpaid / Credit' },
              { id: 'voided', label: 'Voided' }
            ].map(st => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === st.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Date Quick Presets */}
          <div className="flex flex-wrap items-center gap-1 text-[11px]">
            <span className="text-[11px] font-bold text-slate-400 mr-1">Quick Dates:</span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'Last 7 Days' },
              { id: 'month', label: 'This Month' }
            ].map(dp => {
              return (
                <button
                  key={dp.id}
                  type="button"
                  onClick={() => setDatePreset(dp.id as any)}
                  className="px-2 py-0.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer transition-colors shadow-2xs"
                >
                  {dp.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden max-h-[calc(100vh-275px)] flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 shadow-2xs">
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="px-4 py-3">Invoice No</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Tender / Method</th>
                <th className="px-4 py-3 text-right">Total (KES)</th>
                <th className="px-4 py-3 text-right">Paid / Balance</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {salesLoading && sales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                      <span>Loading sales transactions...</span>
                    </div>
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    No transactions match your search filter criteria.
                  </td>
                </tr>
              ) : (
                sales.map(s => {
                  const isVoided = s.status === 'voided';
                  const isPartial = s.status === 'partial';
                  const isUnpaid = s.status === 'unpaid';
                  const isPaid = s.status === 'paid';
                  const bal = Number(s.balance_due || 0);

                  return (
                    <tr
                      key={s.id}
                      onClick={() => {
                        setSelectedSaleForDrawer(s);
                        setDrawerFormat('a4');
                      }}
                      className={`hover:bg-amber-50/40 transition-colors cursor-pointer group ${isVoided ? 'opacity-60 bg-slate-50/40' : ''}`}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span className="group-hover:text-amber-600 transition-colors underline decoration-slate-300 underline-offset-2">
                            {s.invoice_no}
                          </span>
                          {s.is_etr && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                              ETR
                            </span>
                          )}
                        </div>
                        {isVoided && s.void_reason && (
                          <div className="text-[10px] text-rose-600 italic font-sans">Void: {s.void_reason}</div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                        {new Date(s.created_at).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>

                      <td className="px-4 py-3">
                        {s.customer_name ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <User className="h-3 w-3 text-slate-400 shrink-0" />
                              <span>{s.customer_name}</span>
                            </div>
                            {s.site_name && (
                              <div className="flex items-center gap-1 text-[10px] text-amber-900 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 w-fit">
                                <MapPin className="h-2.5 w-2.5 text-amber-700 shrink-0" />
                                <span className="truncate max-w-[170px]">{s.site_name}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="text-slate-400">Cashier: {s.cashier_name || 'Staff'}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (s.customer_id) {
                                    setSelectedCustomerId(String(s.customer_id));
                                  }
                                }}
                                className="text-amber-700 hover:text-amber-800 font-semibold underline decoration-dotted cursor-pointer"
                                title="Filter all sales to this customer"
                              >
                                Filter client
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-500 italic">Walk-in Customer</div>
                            {s.site_name && (
                              <div className="flex items-center gap-1 text-[10px] text-amber-900 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 w-fit">
                                <MapPin className="h-2.5 w-2.5 text-amber-700 shrink-0" />
                                <span className="truncate max-w-[170px]">{s.site_name}</span>
                              </div>
                            )}
                            <div className="text-[10px] text-slate-400">Cashier: {s.cashier_name || 'Staff'}</div>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          s.payment_method === 'split'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : s.payment_method === 'mpesa'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {s.payment_method === 'split' ? (
                            <span className="flex items-center space-x-1">
                              <Split className="h-3 w-3" />
                              <span>Split ({s.payments?.length || 2})</span>
                            </span>
                          ) : (
                            s.payment_method.toUpperCase()
                          )}
                        </span>
                        {s.payment_reference && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{s.payment_reference}</div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        KES {Number(s.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                        <div className="text-emerald-700 font-bold">
                          Paid: KES {Number(s.total_paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        {bal > 0 && !isVoided && (
                          <div className="text-rose-600 font-black text-[10px]">
                            Due: KES {bal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isPaid
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isPartial
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : isUnpaid
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-200 text-slate-700 border border-slate-300'
                        }`}>
                          {s.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setSelectedSaleForDrawer(s);
                              setDrawerFormat('a4');
                            }}
                            className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer shadow-2xs"
                            title="View A4 Tax Invoice / Document Hub"
                          >
                            <Eye className="h-3.5 w-3.5 text-slate-600" />
                          </button>

                          {(isPartial || isUnpaid) && !isVoided && (
                            <button
                              onClick={() => {
                                setPayingSale(s);
                                setInvoicePayAmount(String(s.balance_due || s.total_amount));
                              }}
                              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer shadow-2xs"
                              title="Record Payment for this Invoice"
                            >
                              <Banknote className="h-3 w-3" />
                              <span>Pay</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedSaleForDrawer(s);
                              setDrawerFormat('thermal');
                            }}
                            className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer shadow-2xs"
                            title="Reprint 80mm Thermal Receipt"
                          >
                            <Printer className="h-3.5 w-3.5 text-slate-600" />
                          </button>

                          {!isVoided && (
                            <button
                              onClick={() => setVoidingSale(s)}
                              className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 cursor-pointer shadow-2xs"
                              title="Void Sale & Restore Stock"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Loading More Rows Indicator */}
              {salesLoadingMore && (
                <tr>
                  <td colSpan={8} className="px-4 py-3 text-center text-amber-600 bg-amber-50/40 text-xs font-bold">
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                      <span>Loading more transactions...</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Intersection Observer Sentinel */}
          <div ref={salesSentinelRef} className="h-4 w-full" />

          {!salesHasMore && sales.length > 0 && (
            <div className="text-center py-2.5 text-[11px] text-slate-400 font-medium border-t border-slate-100 bg-slate-50/50">
              Showing all {sales.length} transactions
            </div>
          )}
        </div>
      </div>

      {/* Record Invoice Payment Modal */}
      {payingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Record Payment: Invoice #{payingSale.invoice_no}</h3>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Customer:</span>
                <span className="font-bold text-slate-900">{payingSale.customer_name || 'Walk-in'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Invoice Total:</span>
                <span className="font-mono">KES {Number(payingSale.total_amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-rose-700 font-bold">
                <span>Remaining Balance Due:</span>
                <span className="font-mono">KES {Number(payingSale.balance_due || payingSale.total_amount).toLocaleString()}</span>
              </div>
            </div>

            {payError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {payError}
              </div>
            )}

            <form onSubmit={handleRecordInvoicePayment} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Payment Amount (KES) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="Amount in KES"
                  value={invoicePayAmount}
                  onChange={(e) => setInvoicePayAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2 font-mono font-bold text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Payment Method:</label>
                <select
                  value={invoicePayMethod}
                  onChange={(e) => setInvoicePayMethod(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                >
                  <option value="mpesa">M-Pesa</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer / EFT</option>
                  <option value="card">Card</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Reference / Transaction Code</label>
                <input
                  type="text"
                  placeholder="E.g. QKH7129JK"
                  value={invoicePayRef}
                  onChange={(e) => setInvoicePayRef(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="E.g. Second installment"
                  value={invoicePayNotes}
                  onChange={(e) => setInvoicePayNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setPayingSale(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingPay}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-xs cursor-pointer"
                >
                  {recordingPay ? 'Saving Payment...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Confirmation Modal */}
      {voidingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertCircle className="h-5 w-5" />
              <h3 className="text-base font-bold">Void Sale Transaction</h3>
            </div>
            
            <p className="text-xs text-slate-600">
              Are you sure you want to void invoice <strong className="font-mono text-slate-900">{voidingSale.invoice_no}</strong> (KES {Number(voidingSale.total_amount).toLocaleString()})?
              All deducted stock will be immediately restored to inventory.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700">Reason for Voiding:</label>
              <input
                type="text"
                placeholder="E.g. Customer cancelled order / Wrong product"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setVoidingSale(null)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={voidLoading}
                onClick={handleVoidSale}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer transition-all shadow-xs"
              >
                {voidLoading ? 'Voiding...' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Document Drawer (A4 Tax Invoice & 80mm Thermal Slip) */}
      <InvoiceDrawer
        sale={selectedSaleForDrawer}
        isOpen={!!selectedSaleForDrawer}
        defaultFormat={drawerFormat}
        onClose={() => setSelectedSaleForDrawer(null)}
        onRecordPayment={(s) => {
          setSelectedSaleForDrawer(null);
          setPayingSale(s);
          setInvoicePayAmount(String(s.balance_due || s.total_amount));
        }}
        onVoidSale={(s) => {
          setSelectedSaleForDrawer(null);
          setVoidingSale(s);
        }}
      />

      {/* 80mm Receipt Reprint Modal fallback */}
      <ReceiptModal
        sale={selectedSaleForReceipt}
        onClose={() => setSelectedSaleForReceipt(null)}
      />
    </div>
  );
};
