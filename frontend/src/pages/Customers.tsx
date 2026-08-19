import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../services/api';
import type { Customer, CustomerLedgerResponse, CustomerSummaryResponse } from '../types';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
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
  AlertTriangle
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

  // Live Statement Ledger Modal
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);
  const [ledgerData, setLedgerData] = useState<CustomerLedgerResponse | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const ledgerPrintRef = useRef<HTMLDivElement>(null);

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
    try {
      const data = await apiFetch<CustomerLedgerResponse>(`/api/v1/customers/${cust.id}/ledger`);
      setLedgerData(data);
    } catch (e) {
      console.error('Failed to load ledger', e);
    } finally {
      setLoadingLedger(false);
    }
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

      {/* Live Customer Statement Ledger Modal */}
      {ledgerCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:w-full">
            {/* Header - Screen Only */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm">Customer Statement Ledger</h3>
                  <div className="text-[11px] text-slate-400">{ledgerCustomer.name}</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs transition-colors cursor-pointer border border-slate-700"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Statement</span>
                </button>
                <button
                  onClick={() => {
                    setLedgerCustomer(null);
                    setLedgerData(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Statement Document Body */}
            <div ref={ledgerPrintRef} className="p-6 overflow-y-auto flex-1 font-mono text-xs space-y-4 bg-white print:p-4">
              {/* Company & Customer Header Box */}
              <div className="border-2 border-slate-900 p-4 rounded-xl space-y-2 bg-slate-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-slate-200 pb-2">
                  <h2 className="font-black text-sm uppercase tracking-tight text-slate-950">
                    {ledgerCustomer.name}
                  </h2>
                  <div className="text-[11px] text-slate-500 font-sans">
                    Statement Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
                  <div className="text-[11px] text-slate-600 font-sans space-y-0.5">
                    {ledgerCustomer.phone && <div>Tel: {ledgerCustomer.phone}</div>}
                    {ledgerCustomer.address && <div>Location: {ledgerCustomer.address}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 font-sans uppercase font-bold tracking-wider">Outstanding Balance:</div>
                    <div className="text-base font-black text-rose-600 font-mono">
                      KES {Number(ledgerData?.total_debt ?? ledgerCustomer.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Statement Ledger Table */}
              <div className="rounded-xl border border-slate-300 overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-800">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Invoice / Ref</th>
                      <th className="px-3 py-2 text-right">Debit (KES)</th>
                      <th className="px-3 py-2 text-right">Credit (KES)</th>
                      <th className="px-3 py-2 text-right">Balance (KES)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px] text-slate-800">
                    {loadingLedger ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-slate-400 font-sans">
                          Loading statement entries...
                        </td>
                      </tr>
                    ) : !ledgerData || ledgerData.entries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-slate-400 font-sans">
                          No transaction history recorded for this customer account.
                        </td>
                      </tr>
                    ) : (
                      ledgerData.entries.map((en) => (
                        <tr key={en.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                            {new Date(en.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-bold flex items-center space-x-1.5 text-slate-900">
                              {en.entry_type === 'sale' ? (
                                <ArrowUpRight className="h-3 w-3 text-rose-500 shrink-0" />
                              ) : en.entry_type === 'void' ? (
                                <span className="text-[9px] px-1 bg-slate-200 text-slate-700 rounded">VOID</span>
                              ) : (
                                <ArrowDownRight className="h-3 w-3 text-emerald-600 shrink-0" />
                              )}
                              <span>{en.reference}</span>
                            </div>
                            {en.notes && <div className="text-[10px] text-slate-400 italic font-sans">{en.notes}</div>}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900 whitespace-nowrap">
                            {en.debit ? Number(en.debit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-700 whitespace-nowrap">
                            {en.credit ? Number(en.credit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-black text-slate-950 whitespace-nowrap">
                            {Number(en.running_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Current Balance Footer Box */}
              <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between font-mono">
                <span className="font-bold text-xs uppercase tracking-wider">Current Account Balance:</span>
                <span className="text-base font-black text-amber-400">
                  KES {Number(ledgerData?.total_debt ?? ledgerCustomer.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
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
                Close
              </button>

              {Number(ledgerCustomer.balance) > 0 && (
                <button
                  type="button"
                  onClick={() => setPaymentCustomer(ledgerCustomer)}
                  className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <Banknote className="h-4 w-4" />
                  <span>Record Payment Against Account</span>
                </button>
              )}
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
    </div>
  );
};

