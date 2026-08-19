import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiFetch } from '../services/api';
import type { Customer, CustomerLedgerResponse, CustomerSummaryResponse, Sale } from '../types';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { InvoiceDrawer } from '../components/InvoiceDrawer';
import {
  Users,
  UserPlus,
  Search,
  Banknote,
  Phone,
  Mail,
  MapPin,
  FileText,
  Printer,
  X,
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Edit3,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  Share2,
  Receipt,
  ExternalLink,
  Package
} from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState<CustomerSummaryResponse | null>(null);

  // Customer Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Customer State
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Live Statement Ledger Modal & Interactive Hub
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);
  const [ledgerData, setLedgerData] = useState<CustomerLedgerResponse | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'sales' | 'payments'>('all');
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const ledgerPrintRef = useRef<HTMLDivElement>(null);

  // Universal Invoice Document Drawer State
  const [selectedSaleForDrawer, setSelectedSaleForDrawer] = useState<Sale | null>(null);
  const [isInvoiceDrawerOpen, setIsInvoiceDrawerOpen] = useState(false);
  const [loadingSaleId, setLoadingSaleId] = useState<number | null>(null);

  // Payment Modal
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Infinite Scroll Customers State
  const {
    items: customers,
    loading: customersLoading,
    loadingMore: customersLoadingMore,
    hasMore: customersHasMore,
    sentinelRef: customersSentinelRef,
    reload: reloadCustomers
  } = useInfiniteScroll<Customer>({
    fetchFn: async (offset, limit) => {
      let url = `/api/v1/customers/?limit=${limit}&offset=${offset}`;
      if (searchQuery.trim()) url += `&q=${encodeURIComponent(searchQuery.trim())}`;
      return await apiFetch<Customer[]>(url);
    },
    limit: 24,
    dependencies: [searchQuery]
  });

  const loadSummary = async () => {
    try {
      const data = await apiFetch<CustomerSummaryResponse>('/api/v1/customers/summary');
      setSummary(data);
    } catch (e) {
      console.error('Failed to load customer summary', e);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const loadLedger = async (cust: Customer) => {
    setLedgerCustomer(cust);
    setLoadingLedger(true);
    setLedgerFilter('all');
    setExpandedEntries(new Set());
    try {
      const data = await apiFetch<CustomerLedgerResponse>(`/api/v1/customers/${cust.id}/ledger`);
      setLedgerData(data);
    } catch (e) {
      console.error('Failed to load ledger', e);
    } finally {
      setLoadingLedger(false);
    }
  };

  const ledgerMetrics = useMemo(() => {
    if (!ledgerData) return { totalInvoiced: 0, totalPaid: 0, currentDebt: 0, salesCount: 0, paymentsCount: 0 };
    let totalInvoiced = 0;
    let totalPaid = 0;
    let salesCount = 0;
    let paymentsCount = 0;

    for (const en of ledgerData.entries) {
      if (en.debit) {
        totalInvoiced += Number(en.debit);
      }
      if (en.credit) {
        totalPaid += Number(en.credit);
      }
      if (en.entry_type === 'sale') salesCount++;
      if (en.entry_type === 'payment') paymentsCount++;
    }

    return {
      totalInvoiced,
      totalPaid,
      currentDebt: Number(ledgerData.total_debt),
      salesCount,
      paymentsCount
    };
  }, [ledgerData]);

  const filteredLedgerEntries = useMemo(() => {
    if (!ledgerData) return [];
    if (ledgerFilter === 'sales') {
      return ledgerData.entries.filter(e => e.entry_type === 'sale' || e.entry_type === 'void');
    }
    if (ledgerFilter === 'payments') {
      return ledgerData.entries.filter(e => e.entry_type === 'payment');
    }
    return ledgerData.entries;
  }, [ledgerData, ledgerFilter]);

  const handleViewInvoice = async (saleId: number) => {
    setLoadingSaleId(saleId);
    try {
      const sale = await apiFetch<Sale>(`/api/v1/sales/${saleId}`);
      setSelectedSaleForDrawer(sale);
      setIsInvoiceDrawerOpen(true);
    } catch (err) {
      console.error('Failed to fetch invoice details', err);
    } finally {
      setLoadingSaleId(null);
    }
  };

  const toggleEntryExpand = (entryId: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const handleShareWhatsAppStatement = () => {
    if (!ledgerCustomer || !ledgerData) return;
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const totalInvoiced = ledgerMetrics.totalInvoiced;
    const totalPaid = ledgerMetrics.totalPaid;
    const currentDebt = ledgerMetrics.currentDebt;

    const recentLines = ledgerData.entries.slice(-5).map((e) => {
      const d = new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      if (e.entry_type === 'sale') {
        return `• ${d}: Invoice ${e.reference} -> KES ${Number(e.debit).toLocaleString()}${e.items_summary ? ` (${e.items_summary})` : ''}`;
      }
      return `• ${d}: ${e.reference} -> KES ${Number(e.credit).toLocaleString()}`;
    }).join('\n');

    const msg = `*ACCOUNT STATEMENT: ${ledgerCustomer.name.toUpperCase()}*\n` +
      `Statement Date: ${dateStr}\n` +
      `---------------------------------\n` +
      `*Total Invoiced:* KES ${totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` +
      `*Total Settled / Paid:* KES ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` +
      `*Current Outstanding Due:* KES ${currentDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` +
      `---------------------------------\n` +
      `*Recent Activity:*\n${recentLines}\n` +
      `---------------------------------\n` +
      `Payment via M-Pesa / Bank / Cash.\n` +
      `Thank you for your business!`;

    const cleanPhone = (ledgerCustomer.phone || '').replace(/\D/g, '');
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone.startsWith('0') ? '254' + cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const handleOpenCreateModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setIsActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setName(cust.name);
    setPhone(cust.phone || '');
    setEmail(cust.email || '');
    setAddress(cust.address || '');
    setIsActive(cust.is_active ?? true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setFormError(null);

    try {
      if (editingCustomer) {
        await apiFetch(`/api/v1/customers/${editingCustomer.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim() || null,
            email: email.trim() || null,
            address: address.trim() || null,
            is_active: isActive
          })
        });
      } else {
        await apiFetch('/api/v1/customers/', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim() || null,
            email: email.trim() || null,
            address: address.trim() || null
          })
        });
      }
      setIsModalOpen(false);
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setEditingCustomer(null);
      reloadCustomers();
      loadSummary();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return;
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      await apiFetch(`/api/v1/customers/${deletingCustomer.id}`, {
        method: 'DELETE'
      });
      setDeletingCustomer(null);
      reloadCustomers();
      loadSummary();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete customer');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomer) return;
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      setPayError('Please enter a valid payment amount');
      return;
    }

    setPaying(true);
    setPayError(null);

    try {
      await apiFetch(`/api/v1/customers/${paymentCustomer.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          payment_method: paymentMethod,
          reference: paymentReference.trim() || null,
          notes: paymentNotes.trim() || null
        })
      });
      const updatedCust = { ...paymentCustomer, balance: Math.max(0, paymentCustomer.balance - amt) };
      setPaymentCustomer(null);
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentNotes('');
      reloadCustomers();
      loadSummary();
      if (ledgerCustomer && ledgerCustomer.id === updatedCust.id) {
        loadLedger(updatedCust);
      }
    } catch (err: any) {
      setPayError(err.message || 'Failed to record payment');
    } finally {
      setPaying(false);
    }
  };

  const totalDebt = summary ? summary.total_receivables_debt : customers.reduce((acc, c) => acc + Number(c.balance || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Users className="h-5 w-5 text-amber-600" />
            <span>Customer Accounts & Debt Ledger</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage customer directories, track credit sales balances, and record payments
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center space-x-1.5 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-500 transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <UserPlus className="h-4 w-4" />
            <span>New Customer</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Customers</div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {summary ? summary.active_customers : customers.filter(c => c.is_active).length}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {summary ? `${summary.total_customers} total registered accounts` : 'Total registered accounts'}
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-bold text-rose-600 uppercase tracking-wider">Total Receivables Debt</div>
          <div className="text-2xl font-black text-rose-600 mt-2 font-mono">
            KES {Number(totalDebt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-1">Outstanding customer credit liability</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-bold text-amber-600 uppercase tracking-wider">Accounts with Debt</div>
          <div className="text-2xl font-black text-amber-600 mt-2 font-mono">
            {summary ? summary.customers_with_debt : customers.filter(c => Number(c.balance) > 0).length}
          </div>
          <div className="text-xs text-slate-400 mt-1">Customers with open credit balance</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search customer name or phone number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-600 shadow-2xs"
        />
      </div>

      {/* Customer Directory Cards Grid */}
      <div className="max-h-[calc(100vh-270px)] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customersLoading && customers.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 space-y-2">
              <Loader2 className="h-8 w-8 mx-auto text-amber-600 animate-spin" />
              <p className="text-xs">Loading customer directory...</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 space-y-2">
              <Users className="h-8 w-8 mx-auto text-slate-300" />
              <p className="text-xs">No customer accounts registered yet.</p>
            </div>
          ) : (
            customers.map(c => {
              const hasDebt = Number(c.balance) > 0;
              return (
                <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <h3 className="font-bold text-sm text-slate-900">{c.name}</h3>
                          {c.is_active === false && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          hasDebt ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {hasDebt ? `Debt: KES ${Number(c.balance).toLocaleString()}` : 'Clean'}
                        </span>
                        <button
                          onClick={() => handleOpenEditModal(c)}
                          className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                          title="Edit Customer Details"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setDeletingCustomer(c);
                            setDeleteError(null);
                          }}
                          className="p-1 rounded-lg border border-rose-100 hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition-colors cursor-pointer"
                          title="Delete Customer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                      {c.phone && (
                        <div className="flex items-center space-x-2 text-slate-600">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center space-x-2 text-slate-600">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          <span>{c.email}</span>
                        </div>
                      )}
                      {c.address && (
                        <div className="flex items-center space-x-2 text-slate-600">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span>{c.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => loadLedger(c)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5 text-slate-500" />
                      <span>Statement Ledger</span>
                    </button>

                    {hasDebt && (
                      <button
                        onClick={() => setPaymentCustomer(c)}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer shadow-2xs"
                      >
                        <Banknote className="h-3.5 w-3.5" />
                        <span>Record Payment</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Loading More Indicator */}
        {customersLoadingMore && (
          <div className="flex items-center justify-center space-x-2 py-4 text-amber-600 text-xs font-bold">
            <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
            <span>Loading more customers...</span>
          </div>
        )}

        {/* Sentinel */}
        <div ref={customersSentinelRef} className="h-4 w-full" />

        {!customersHasMore && customers.length > 0 && (
          <div className="text-center py-2.5 text-[11px] text-slate-400 font-medium">
            Showing all {customers.length} customer accounts
          </div>
        )}
      </div>

      {/* Live Interactive Customer Statement Ledger Modal & Document Hub */}
      {ledgerCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full animate-in fade-in zoom-in-95 duration-150">
            {/* Header - Screen Only */}
            <div className="p-4 sm:px-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30">
                  <FileText className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base tracking-tight text-white">Financial Statement & Ledger</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-300">
                      ID #{ledgerCustomer.id}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-medium flex items-center gap-2">
                    <span className="font-bold text-white">{ledgerCustomer.name}</span>
                    {ledgerCustomer.phone && <span>• {ledgerCustomer.phone}</span>}
                    {ledgerCustomer.address && <span>• {ledgerCustomer.address}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={handleShareWhatsAppStatement}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs active:scale-95"
                  title="Share formatted statement via WhatsApp"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs transition-colors cursor-pointer border border-slate-700 active:scale-95"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print A4</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLedgerCustomer(null);
                    setLedgerData(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Statement Document Body */}
            <div ref={ledgerPrintRef} className="p-4 sm:p-6 overflow-y-auto flex-1 font-sans text-xs space-y-4 bg-slate-50/50 print:bg-white print:p-4">
              
              {/* Executive KPI Summary Dashboard */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:grid-cols-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>Total Invoiced</span>
                    <Receipt className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <div className="text-lg font-black text-slate-900 font-mono mt-1">
                    KES {ledgerMetrics.totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                    Across {ledgerMetrics.salesCount} invoice{ledgerMetrics.salesCount === 1 ? '' : 's'}
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center justify-between">
                    <span>Total Collections / Settled</span>
                    <Banknote className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div className="text-lg font-black text-emerald-700 font-mono mt-1">
                    KES {ledgerMetrics.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-emerald-600/90 font-medium mt-0.5">
                    {ledgerMetrics.paymentsCount} recorded payment{ledgerMetrics.paymentsCount === 1 ? '' : 's'}
                  </div>
                </div>

                <div className={`p-3.5 rounded-xl border shadow-2xs ${ledgerMetrics.currentDebt > 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-emerald-50/70 border-emerald-200'}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-between text-slate-600">
                    <span>Current Outstanding Debt</span>
                    <AlertTriangle className={`h-3.5 w-3.5 ${ledgerMetrics.currentDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
                  </div>
                  <div className={`text-lg font-black font-mono mt-1 ${ledgerMetrics.currentDebt > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    KES {ledgerMetrics.currentDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className={`text-[10px] font-medium mt-0.5 ${ledgerMetrics.currentDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {ledgerMetrics.currentDebt > 0 ? 'Open balance due' : 'Account is fully settled'}
                  </div>
                </div>
              </div>

              {/* Filter Tabs Bar (Screen Only) */}
              <div className="flex items-center justify-between gap-2 pt-1 border-b border-slate-200 pb-2 print:hidden">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLedgerFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      ledgerFilter === 'all'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    All Records ({ledgerData?.entries.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerFilter('sales')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      ledgerFilter === 'sales'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Sales Invoices ({ledgerMetrics.salesCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerFilter('payments')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      ledgerFilter === 'payments'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Payments & Credits ({ledgerMetrics.paymentsCount})
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
                  Statement Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>

              {/* Interactive Statement Ledger Matrix Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/80 text-[10px] font-black uppercase tracking-wider text-slate-700">
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5">Transaction Ref / Line Items</th>
                      <th className="px-3.5 py-2.5 text-right">Invoiced (Debit)</th>
                      <th className="px-3.5 py-2.5 text-right">Settled (Credit)</th>
                      <th className="px-3.5 py-2.5 text-right">Balance Due</th>
                      <th className="px-3.5 py-2.5 text-center print:hidden">Document</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {loadingLedger ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                            <span className="font-medium">Loading ledger statement entries...</span>
                          </div>
                        </td>
                      </tr>
                    ) : !ledgerData || filteredLedgerEntries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-slate-400 font-medium">
                          No {ledgerFilter !== 'all' ? ledgerFilter : ''} transactions recorded for this customer.
                        </td>
                      </tr>
                    ) : (
                      filteredLedgerEntries.map((en) => {
                        const isExpanded = expandedEntries.has(en.id);
                        const isSale = en.entry_type === 'sale';
                        const isVoid = en.entry_type === 'void';

                        return (
                          <React.Fragment key={en.id}>
                            <tr
                              className={`transition-colors ${
                                isExpanded ? 'bg-amber-50/40' : 'hover:bg-slate-50/80'
                              }`}
                            >
                              {/* Date */}
                              <td className="px-3.5 py-3 text-slate-600 whitespace-nowrap align-top font-mono text-[11px]">
                                {new Date(en.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>

                              {/* Transaction Ref & Summary */}
                              <td className="px-3.5 py-3 align-top">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {/* Type icon & badge */}
                                    {isSale ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                                        <ArrowUpRight className="h-3 w-3" />
                                        INVOICE
                                      </span>
                                    ) : isVoid ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                                        VOID
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                        <ArrowDownRight className="h-3 w-3" />
                                        PAYMENT
                                      </span>
                                    )}

                                    {/* Clickable Reference Link */}
                                    {en.sale_id ? (
                                      <button
                                        type="button"
                                        onClick={() => handleViewInvoice(en.sale_id!)}
                                        className="font-bold text-slate-900 hover:text-amber-700 underline decoration-slate-300 hover:decoration-amber-500 underline-offset-2 transition-colors flex items-center gap-1 cursor-pointer font-mono"
                                        title="Click to view full Tax Invoice / Thermal receipt"
                                      >
                                        <span>{en.reference}</span>
                                        {loadingSaleId === en.sale_id ? (
                                          <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
                                        ) : (
                                          <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-amber-600" />
                                        )}
                                      </button>
                                    ) : (
                                      <span className="font-bold text-slate-900 font-mono">{en.reference}</span>
                                    )}

                                    {/* Inline Accordion Expand Button for Invoices with items */}
                                    {en.items_summary && (
                                      <button
                                        type="button"
                                        onClick={() => toggleEntryExpand(en.id)}
                                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium flex items-center gap-0.5 cursor-pointer transition-colors"
                                      >
                                        <span>{en.items_count} item{en.items_count === 1 ? '' : 's'}</span>
                                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                      </button>
                                    )}
                                  </div>

                                  {/* Line item quick preview snippet */}
                                  {en.items_summary && !isExpanded && (
                                    <div className="text-[11px] text-slate-500 font-medium line-clamp-1">
                                      📦 {en.items_summary}
                                    </div>
                                  )}

                                  {/* Notes */}
                                  {en.notes && (
                                    <div className="text-[10px] text-slate-400 italic">
                                      {en.notes}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Debit (Invoiced) */}
                              <td className="px-3.5 py-3 text-right font-bold text-slate-900 whitespace-nowrap align-top font-mono">
                                {en.debit ? (
                                  <span className="text-slate-900">
                                    KES {Number(en.debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>

                              {/* Credit (Settled) */}
                              <td className="px-3.5 py-3 text-right font-bold text-emerald-700 whitespace-nowrap align-top font-mono">
                                {en.credit ? (
                                  <span className="text-emerald-700">
                                    KES {Number(en.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>

                              {/* Running Balance */}
                              <td className="px-3.5 py-3 text-right font-black text-slate-950 whitespace-nowrap align-top font-mono">
                                KES {Number(en.running_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>

                              {/* Document Action Button */}
                              <td className="px-3.5 py-3 text-center align-top print:hidden whitespace-nowrap">
                                {en.sale_id ? (
                                  <button
                                    type="button"
                                    onClick={() => handleViewInvoice(en.sale_id!)}
                                    disabled={loadingSaleId === en.sale_id}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-600 transition-colors cursor-pointer inline-flex items-center gap-1 font-bold text-[11px]"
                                    title="Open interactive A4 Invoice & Receipt Hub"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">View Doc</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-300 text-[10px]">—</span>
                                )}
                              </td>
                            </tr>

                            {/* Expanded Inline Product Accordion */}
                            {isExpanded && en.items_summary && (
                              <tr className="bg-amber-50/50 border-y border-amber-200/60 print:bg-white">
                                <td colSpan={6} className="px-4 py-3">
                                  <div className="bg-white p-3 rounded-xl border border-amber-200/80 shadow-2xs space-y-2">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                      <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                                        <Package className="h-3.5 w-3.5 text-amber-600" />
                                        <span>Invoice Items & Products Breakdown</span>
                                      </div>
                                      {en.sale_id && (
                                        <button
                                          type="button"
                                          onClick={() => handleViewInvoice(en.sale_id!)}
                                          className="text-[10px] text-amber-700 hover:text-amber-800 font-bold flex items-center gap-1 underline cursor-pointer"
                                        >
                                          Open Full A4 Tax Invoice / Thermal Receipt →
                                        </button>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-700 font-mono leading-relaxed">
                                      {en.items_summary}
                                    </div>
                                    {en.payment_method && (
                                      <div className="text-[10px] text-slate-500 flex items-center gap-2 pt-1 border-t border-slate-100">
                                        <span>Payment Term / Mode: <strong className="uppercase text-slate-700">{en.payment_method}</strong></span>
                                        {en.notes && <span>• Note: {en.notes}</span>}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Current Account Balance Summary Bar */}
              <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between font-mono shadow-md">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Statement Reconciliation</div>
                  <div className="text-xs font-semibold text-slate-200">Current Outstanding Account Due:</div>
                </div>
                <div className="text-xl font-black text-amber-400">
                  KES {Number(ledgerData?.total_debt ?? ledgerCustomer.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions - Screen Only */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between print:hidden">
              <button
                type="button"
                onClick={() => {
                  setLedgerCustomer(null);
                  setLedgerData(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Close Statement
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleShareWhatsAppStatement}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <Share2 className="h-4 w-4" />
                  <span>Send Statement to Client</span>
                </button>

                {Number(ledgerCustomer.balance) > 0 && (
                  <button
                    type="button"
                    onClick={() => setPaymentCustomer(ledgerCustomer)}
                    className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <Banknote className="h-4 w-4" />
                    <span>Record Payment</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {editingCustomer ? <Edit3 className="h-4 w-4 text-amber-600" /> : <UserPlus className="h-4 w-4 text-amber-600" />}
                <span>{editingCustomer ? `Edit Customer: ${editingCustomer.name}` : 'Register New Customer'}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveCustomer} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Full Name / Company *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Phone Number</label>
                <input
                  type="text"
                  placeholder="+254 7..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Location / Physical Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              {editingCustomer && (
                <div className="pt-2 flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active_cust"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                  />
                  <label htmlFor="is_active_cust" className="font-semibold text-slate-700 select-none cursor-pointer">
                    Account is Active (enable for new POS credit sales)
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition-all shadow-xs cursor-pointer"
                >
                  {saving ? 'Saving...' : editingCustomer ? 'Save Changes' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation Modal */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                <AlertTriangle className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Customer Account</h3>
                <p className="text-xs text-slate-500 font-medium">{deletingCustomer.name}</p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {deleteError}
              </div>
            )}

            {Number(deletingCustomer.balance) > 0 ? (
              <div className="space-y-3">
                <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1.5 font-medium">
                  <div className="font-bold flex items-center gap-1.5 text-rose-900">
                    <Banknote className="h-4 w-4" />
                    Outstanding Debt Detected
                  </div>
                  <div>
                    This customer currently owes <strong className="font-mono text-rose-900">KES {Number(deletingCustomer.balance).toLocaleString()}</strong>.
                    You cannot delete an account with an open debt balance. Please settle or write off the balance first.
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeletingCustomer(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cust = deletingCustomer;
                      setDeletingCustomer(null);
                      setPaymentCustomer(cust);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    Record Settlement
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Are you sure you want to delete <strong>{deletingCustomer.name}</strong>?
                </p>
                <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  💡 <strong>Integrity Safeguard</strong>: If this customer has existing sales invoices or ledger payments, their account will be deactivated instead of removed to preserve accounting history.
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeletingCustomer(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteLoading}
                    onClick={handleDeleteCustomer}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                  >
                    {deleteLoading ? 'Deleting...' : 'Confirm Deletion'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Record Debt Payment: {paymentCustomer.name}</h3>
            <p className="text-xs text-slate-600">
              Current Open Debt: <strong className="text-rose-600 font-mono">KES {Number(paymentCustomer.balance).toLocaleString()}</strong>
            </p>

            {payError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {payError}
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Payment Amount (KES) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="Amount in KES"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2 font-mono font-bold text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Payment Method:</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                >
                  <option value="cash">Cash</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="bank">Bank Transfer / EFT</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700">Reference / Transaction Code</label>
                <input
                  type="text"
                  placeholder="E.g. QKH7129JK"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="E.g. Part payment for inv #41"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setPaymentCustomer(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paying}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-xs cursor-pointer"
                >
                  {paying ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Universal Interactive Invoice & Document Hub Drawer */}
      <InvoiceDrawer
        sale={selectedSaleForDrawer}
        isOpen={isInvoiceDrawerOpen}
        onClose={() => {
          setIsInvoiceDrawerOpen(false);
          setSelectedSaleForDrawer(null);
        }}
      />
    </div>
  );
};

