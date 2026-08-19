import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiFetch } from '../services/api';
import type { Supplier, SupplierLedgerResponse, SupplierSummaryResponse, GoodsReceivedNote, SupplierPayment } from '../types';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import {
  Truck,
  Plus,
  Search,
  Banknote,
  Phone,
  Mail,
  MapPin,
  FileText,
  Printer,
  X,
  User,
  Hash,
  Loader2,
  Edit3,
  Trash2,
  AlertTriangle,
  MessageCircle,
  ArrowDownRight,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Package,
  Layers,
  Building2,
  Receipt
} from 'lucide-react';

export const SuppliersPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState<SupplierSummaryResponse | null>(null);

  // Supplier Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [taxPin, setTaxPin] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Supplier State
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Live Statement Ledger Drawer State
  const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);
  const [ledgerData, setLedgerData] = useState<SupplierLedgerResponse | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'grn' | 'payments'>('all');
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const ledgerPrintRef = useRef<HTMLDivElement>(null);

  // Universal Document Viewers
  const [selectedGRNForDrawer, setSelectedGRNForDrawer] = useState<GoodsReceivedNote | null>(null);
  const [isGRNDrawerOpen, setIsGRNDrawerOpen] = useState(false);
  const [loadingGRNId, setLoadingGRNId] = useState<string | null>(null);

  const [selectedPaymentForModal, setSelectedPaymentForModal] = useState<SupplierPayment | null>(null);
  const [isPaymentVoucherOpen, setIsPaymentVoucherOpen] = useState(false);
  const [loadingPaymentId, setLoadingPaymentId] = useState<number | null>(null);

  // Record Payment Modal
  const [paymentSupplier, setPaymentSupplier] = useState<Supplier | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Infinite Scroll Suppliers State
  const {
    items: suppliers,
    loading: suppliersLoading,
    loadingMore: suppliersLoadingMore,
    hasMore: suppliersHasMore,
    sentinelRef: suppliersSentinelRef,
    reload: reloadSuppliers
  } = useInfiniteScroll<Supplier>({
    fetchFn: async (offset, limit) => {
      let url = `/api/v1/suppliers/?limit=${limit}&offset=${offset}`;
      if (searchQuery.trim()) url += `&q=${encodeURIComponent(searchQuery.trim())}`;
      return await apiFetch<Supplier[]>(url);
    },
    limit: 25,
    dependencies: [searchQuery]
  });

  const loadSummary = async () => {
    try {
      const data = await apiFetch<SupplierSummaryResponse>('/api/v1/suppliers/summary');
      setSummary(data);
    } catch (e) {
      console.error('Failed to load supplier summary', e);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const loadLedger = async (supp: Supplier) => {
    setLedgerSupplier(supp);
    setLoadingLedger(true);
    setLedgerFilter('all');
    setExpandedEntries(new Set());
    try {
      const data = await apiFetch<SupplierLedgerResponse>(`/api/v1/suppliers/${supp.id}/ledger`);
      setLedgerData(data);
    } catch (e) {
      console.error('Failed to load ledger', e);
    } finally {
      setLoadingLedger(false);
    }
  };

  // KPI Metrics for Statement Hub
  const ledgerMetrics = useMemo(() => {
    if (!ledgerData) return { totalInvoiced: 0, totalPaid: 0, currentDebt: 0, grnCount: 0, paymentsCount: 0 };
    let totalInvoiced = Number(ledgerData.total_invoiced || 0);
    let totalPaid = Number(ledgerData.total_paid || 0);
    let grnCount = 0;
    let paymentsCount = 0;

    ledgerData.entries.forEach(e => {
      if (e.type === 'grn') {
        grnCount++;
        if (!ledgerData.total_invoiced) totalInvoiced += Number(e.credit || 0);
      } else if (e.type === 'payment') {
        paymentsCount++;
        if (!ledgerData.total_paid) totalPaid += Number(e.debit || 0);
      }
    });

    return {
      totalInvoiced,
      totalPaid,
      currentDebt: Number(ledgerData.current_balance || 0),
      grnCount,
      paymentsCount
    };
  }, [ledgerData]);

  // Filtered Ledger Entries
  const filteredLedgerEntries = useMemo(() => {
    if (!ledgerData) return [];
    if (ledgerFilter === 'grn') {
      return ledgerData.entries.filter(e => e.type === 'grn');
    }
    if (ledgerFilter === 'payments') {
      return ledgerData.entries.filter(e => e.type === 'payment');
    }
    return ledgerData.entries;
  }, [ledgerData, ledgerFilter]);

  const toggleEntryExpand = (entryId: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  // Inspect GRN Consignment Document
  const handleViewGRNDocument = async (grnIdOrNo: number | string) => {
    const lookupKey = String(grnIdOrNo);
    setLoadingGRNId(lookupKey);
    try {
      const grn = await apiFetch<GoodsReceivedNote>(`/api/v1/purchases/grn/${encodeURIComponent(lookupKey)}`);
      setSelectedGRNForDrawer(grn);
      setIsGRNDrawerOpen(true);
    } catch (err) {
      console.error('Failed to fetch GRN document details', err);
    } finally {
      setLoadingGRNId(null);
    }
  };

  // Inspect Supplier Payment Voucher
  const handleViewPaymentVoucher = async (paymentId: number) => {
    setLoadingPaymentId(paymentId);
    try {
      const payment = await apiFetch<SupplierPayment>(`/api/v1/suppliers/payments/${paymentId}`);
      setSelectedPaymentForModal(payment);
      setIsPaymentVoucherOpen(true);
    } catch (err) {
      console.error('Failed to fetch payment voucher details', err);
    } finally {
      setLoadingPaymentId(null);
    }
  };

  // Share Statement via WhatsApp
  const handleShareWhatsAppSupplierStatement = () => {
    if (!ledgerSupplier || !ledgerData) return;
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const totalInvoiced = ledgerMetrics.totalInvoiced;
    const totalPaid = ledgerMetrics.totalPaid;
    const currentDebt = ledgerMetrics.currentDebt;

    const recentLines = ledgerData.entries.slice(-5).map(e => {
      const d = new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      if (e.type === 'grn') {
        return `• ${d}: GRN ${e.reference} -> KES ${Number(e.credit).toLocaleString()}${e.items_summary ? ` (${e.items_summary})` : ''}`;
      }
      return `• ${d}: ${e.reference} -> KES ${Number(e.debit).toLocaleString()}`;
    }).join('\n');

    const msg = `*SUPPLIER STATEMENT OF ACCOUNT: ${ledgerSupplier.name.toUpperCase()}*\n` +
      `Statement Date: ${dateStr}\n` +
      `---------------------------------\n` +
      `*Total Consignments Received:* KES ${totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` +
      `*Total Payments Settled:* KES ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` +
      `*Current Outstanding Payable:* KES ${currentDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n` +
      `---------------------------------\n` +
      `*Recent Activity:*\n${recentLines}\n` +
      `---------------------------------\n` +
      `Verified by POS Business Management System.`;

    const cleanPhone = (ledgerSupplier.phone || '').replace(/\D/g, '');
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone.startsWith('0') ? '254' + cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const handleOpenCreateModal = () => {
    setEditingSupplier(null);
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setTaxPin('');
    setIsActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (supp: Supplier) => {
    setEditingSupplier(supp);
    setName(supp.name);
    setContactPerson(supp.contact_person || '');
    setPhone(supp.phone || '');
    setEmail(supp.email || '');
    setAddress(supp.address || '');
    setTaxPin(supp.tax_pin || '');
    setIsActive(supp.is_active ?? true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setFormError(null);

    try {
      if (editingSupplier) {
        await apiFetch(`/api/v1/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: name.trim(),
            contact_person: contactPerson.trim() || null,
            phone: phone.trim() || null,
            email: email.trim() || null,
            address: address.trim() || null,
            tax_pin: taxPin.trim() || null,
            is_active: isActive
          })
        });
      } else {
        await apiFetch('/api/v1/suppliers/', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            contact_person: contactPerson.trim() || null,
            phone: phone.trim() || null,
            email: email.trim() || null,
            address: address.trim() || null,
            tax_pin: taxPin.trim() || null
          })
        });
      }
      setIsModalOpen(false);
      setName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setAddress('');
      setTaxPin('');
      setEditingSupplier(null);
      reloadSuppliers();
      loadSummary();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save supplier');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!deletingSupplier) return;
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      await apiFetch(`/api/v1/suppliers/${deletingSupplier.id}`, {
        method: 'DELETE'
      });
      setDeletingSupplier(null);
      reloadSuppliers();
      loadSummary();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete supplier');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentSupplier || !paymentAmount) return;
    setPaying(true);
    setPayError(null);

    try {
      await apiFetch(`/api/v1/suppliers/${paymentSupplier.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          payment_method: paymentMethod,
          reference: paymentReference.trim() || null,
          notes: paymentNotes.trim() || null
        })
      });

      const updatedSupplier = await apiFetch<Supplier>(`/api/v1/suppliers/${paymentSupplier.id}`);
      setPaymentSupplier(null);
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentNotes('');
      reloadSuppliers();
      loadSummary();

      if (ledgerSupplier && ledgerSupplier.id === updatedSupplier.id) {
        loadLedger(updatedSupplier);
      }
    } catch (err: any) {
      setPayError(err.message || 'Failed to record payment');
    } finally {
      setPaying(false);
    }
  };

  const handlePrintLedger = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header & KPI Summary Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-900 text-white shadow-xs">
              <Truck className="h-6 w-6" />
            </div>
            <span>Suppliers & Payables</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Manage vendor directories, track inbound deliveries, payables, and live statement ledgers
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm transition-all shadow-md active:scale-[0.98] cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Add Supplier</span>
        </button>
      </div>

      {/* Summary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Suppliers</div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{summary?.total_suppliers ?? 0}</div>
          <div className="text-xs text-slate-400 font-medium mt-0.5">{summary?.active_suppliers ?? 0} active registered vendors</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Total Payables Debt</div>
          <div className="text-2xl font-black text-rose-600 mt-1 font-mono">
            KES {summary?.total_payables_debt ? Number(summary.total_payables_debt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </div>
          <div className="text-xs text-rose-500/80 font-medium mt-0.5">Outstanding vendor liability across all accounts</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Suppliers With Balance</div>
          <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">{summary?.suppliers_with_balance ?? 0}</div>
          <div className="text-xs text-emerald-600/80 font-medium mt-0.5">Vendors pending settlement</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search suppliers by name, phone, or KRA PIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Supplier Name</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4">Address / PIN</th>
                <th className="py-3 px-4 text-right">Payable Balance</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {suppliersLoading && suppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
                      <span className="font-medium">Loading suppliers...</span>
                    </div>
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Truck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">No suppliers found.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {searchQuery ? `No results for "${searchQuery}"` : 'Get started by creating your first supplier profile.'}
                    </p>
                  </td>
                </tr>
              ) : (
                suppliers.map((supp) => (
                  <tr key={supp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-sm">{supp.name}</div>
                      {supp.contact_person && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>{supp.contact_person}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 space-y-1">
                      {supp.phone && (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>{supp.phone}</span>
                        </div>
                      )}
                      {supp.email && (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Mail className="h-3 w-3 text-slate-400" />
                          <span className="truncate max-w-[150px]">{supp.email}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 space-y-1">
                      {supp.address && (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          <span className="truncate max-w-[160px]">{supp.address}</span>
                        </div>
                      )}
                      {supp.tax_pin && (
                        <div className="flex items-center gap-1.5 text-slate-600 font-mono text-[10px]">
                          <Hash className="h-3 w-3 text-slate-400" />
                          <span className="font-bold text-slate-700">{supp.tax_pin}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold">
                      {supp.balance > 0 ? (
                        <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg">
                          KES {Number(supp.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-slate-400">KES 0.00</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          supp.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {supp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => loadLedger(supp)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        title="View Statement Ledger"
                      >
                        <FileText className="h-3.5 w-3.5 text-slate-500" />
                        <span>Statement</span>
                      </button>
                      <button
                        onClick={() => {
                          setPaymentSupplier(supp);
                          setPaymentAmount(supp.balance > 0 ? String(supp.balance) : '');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        title="Record Payment"
                      >
                        <Banknote className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Pay</span>
                      </button>
                      <button
                        onClick={() => handleOpenEditModal(supp)}
                        className="inline-flex items-center p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg text-xs transition-colors cursor-pointer"
                        title="Edit Supplier Details"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setDeletingSupplier(supp);
                          setDeleteError(null);
                        }}
                        className="inline-flex items-center p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 border border-rose-100 rounded-lg text-xs transition-colors cursor-pointer"
                        title="Delete Supplier"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}

              {/* Loading More Suppliers */}
              {suppliersLoadingMore && (
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-center text-slate-600 bg-slate-50/50 text-xs font-bold">
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
                      <span>Loading more suppliers...</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Sentinel */}
          <div ref={suppliersSentinelRef} className="h-4 w-full" />

          {!suppliersHasMore && suppliers.length > 0 && (
            <div className="text-center py-2.5 text-[11px] text-slate-400 font-medium border-t border-slate-100 bg-slate-50/50">
              Showing all {suppliers.length} suppliers
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Universal Interactive Supplier Statement Ledger Drawer / Hub */}
      {/* ========================================================================= */}
      {ledgerSupplier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 print:p-0 print:bg-white print:static overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 print:max-h-none print:shadow-none print:border-none my-6">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between print:hidden shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>{ledgerSupplier.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                      STATEMENT OF ACCOUNT
                    </span>
                  </h3>
                  <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                    {ledgerSupplier.phone && (
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="h-3 w-3 text-slate-400" />
                        {ledgerSupplier.phone}
                      </span>
                    )}
                    {ledgerSupplier.tax_pin && (
                      <span className="flex items-center gap-1 font-mono">
                        <Hash className="h-3 w-3 text-slate-400" />
                        PIN: {ledgerSupplier.tax_pin}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShareWhatsAppSupplierStatement}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Share Statement via WhatsApp"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintLedger}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const s = ledgerSupplier;
                    setPaymentSupplier(s);
                    setPaymentAmount(s.balance > 0 ? String(s.balance) : '');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
                >
                  <Banknote className="h-3.5 w-3.5" />
                  <span>+ Record Payment</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerSupplier(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer ml-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Statement Content */}
            <div ref={ledgerPrintRef} className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Print Header */}
              <div className="hidden print:block mb-6 border-b pb-4">
                <div className="text-xl font-black uppercase tracking-wider text-slate-900">SUPPLIER STATEMENT OF ACCOUNT</div>
                <div className="text-sm font-bold text-slate-800 mt-1">{ledgerSupplier.name}</div>
                {ledgerSupplier.phone && <div>Tel: {ledgerSupplier.phone}</div>}
                {ledgerSupplier.tax_pin && <div>Tax PIN: {ledgerSupplier.tax_pin}</div>}
                <div className="text-slate-500 text-[10px] mt-2">
                  Generated on: {new Date().toLocaleString()}
                </div>
              </div>

              {/* 3 KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print:grid-cols-3">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>Total Received (Credit)</span>
                    <Truck className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <div className="text-lg font-black text-slate-900 font-mono mt-1">
                    KES {ledgerMetrics.totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                    Across {ledgerMetrics.grnCount} consignment{ledgerMetrics.grnCount === 1 ? '' : 's'} (GRNs)
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center justify-between">
                    <span>Total Settled / Paid</span>
                    <Banknote className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div className="text-lg font-black text-emerald-700 font-mono mt-1">
                    KES {ledgerMetrics.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-emerald-600/90 font-medium mt-0.5">
                    {ledgerMetrics.paymentsCount} recorded settlement{ledgerMetrics.paymentsCount === 1 ? '' : 's'}
                  </div>
                </div>

                <div className={`p-3.5 rounded-2xl border shadow-2xs ${ledgerMetrics.currentDebt > 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-emerald-50/70 border-emerald-200'}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-between text-slate-600">
                    <span>Current Outstanding Payable</span>
                    <AlertTriangle className={`h-3.5 w-3.5 ${ledgerMetrics.currentDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
                  </div>
                  <div className={`text-lg font-black font-mono mt-1 ${ledgerMetrics.currentDebt > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    KES {ledgerMetrics.currentDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className={`text-[10px] font-medium mt-0.5 ${ledgerMetrics.currentDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {ledgerMetrics.currentDebt > 0 ? 'Open liability pending settlement' : 'Account is fully settled'}
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
                    onClick={() => setLedgerFilter('grn')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      ledgerFilter === 'grn'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Goods Received Notes ({ledgerMetrics.grnCount})
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
                    Payments & Settlements ({ledgerMetrics.paymentsCount})
                  </button>
                </div>

                <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
                  Statement Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>

              {/* Interactive Statement Matrix Table */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/80 text-[10px] font-black uppercase tracking-wider text-slate-700">
                      <th className="px-3.5 py-2.5">Date</th>
                      <th className="px-3.5 py-2.5">Transaction Ref / Details</th>
                      <th className="px-3.5 py-2.5 text-right">Settled (Debit)</th>
                      <th className="px-3.5 py-2.5 text-right">Received (Credit)</th>
                      <th className="px-3.5 py-2.5 text-right">Balance Due</th>
                      <th className="px-3.5 py-2.5 text-center print:hidden">Document</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {loadingLedger ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                            <span className="font-medium">Loading statement transactions...</span>
                          </div>
                        </td>
                      </tr>
                    ) : !ledgerData || filteredLedgerEntries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-slate-400 font-medium">
                          No {ledgerFilter !== 'all' ? (ledgerFilter === 'grn' ? 'goods received notes' : 'payments') : ''} records found for this supplier.
                        </td>
                      </tr>
                    ) : (
                      filteredLedgerEntries.map((en) => {
                        const isExpanded = expandedEntries.has(en.id);
                        const isGRN = en.type === 'grn';
                        const isPayment = en.type === 'payment';

                        return (
                          <React.Fragment key={en.id}>
                            <tr className={`transition-colors ${isExpanded ? 'bg-emerald-50/30' : 'hover:bg-slate-50/80'}`}>
                              {/* Date */}
                              <td className="px-3.5 py-3 text-slate-600 whitespace-nowrap align-top font-mono text-[11px]">
                                {new Date(en.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>

                              {/* Transaction Ref & Line Item Summary */}
                              <td className="px-3.5 py-3 align-top">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {/* Type badge */}
                                    {isGRN ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                        <Truck className="h-3 w-3" />
                                        GRN DELIVERY
                                      </span>
                                    ) : isPayment ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                        <ArrowDownRight className="h-3 w-3" />
                                        PAYMENT
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                                        {en.type.toUpperCase()}
                                      </span>
                                    )}

                                    {/* Clickable Reference Link */}
                                    {isGRN && en.grn_id ? (
                                      <button
                                        type="button"
                                        onClick={() => handleViewGRNDocument(en.grn_id!)}
                                        className="font-bold text-slate-900 hover:text-emerald-700 underline decoration-slate-300 hover:decoration-emerald-500 underline-offset-2 transition-colors flex items-center gap-1 cursor-pointer font-mono"
                                        title="Click to view full Goods Received Note (GRN) details"
                                      >
                                        <span>{en.reference}</span>
                                        <ExternalLink className="h-3 w-3 text-slate-400" />
                                      </button>
                                    ) : isPayment && en.payment_id ? (
                                      <button
                                        type="button"
                                        onClick={() => handleViewPaymentVoucher(en.payment_id!)}
                                        className="font-bold text-slate-900 hover:text-emerald-700 underline decoration-slate-300 hover:decoration-emerald-500 underline-offset-2 transition-colors flex items-center gap-1 cursor-pointer font-mono"
                                        title="Click to view Payment Voucher"
                                      >
                                        <span>{en.reference}</span>
                                        <ExternalLink className="h-3 w-3 text-slate-400" />
                                      </button>
                                    ) : (
                                      <span className="font-bold text-slate-900 font-mono">{en.reference}</span>
                                    )}
                                  </div>

                                  {/* Item Summary / Note */}
                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                    {en.items_summary && (
                                      <button
                                        type="button"
                                        onClick={() => toggleEntryExpand(en.id)}
                                        className="flex items-center gap-1 text-slate-700 hover:text-emerald-700 font-medium cursor-pointer"
                                      >
                                        {isExpanded ? <ChevronDown className="h-3 w-3 text-emerald-600" /> : <ChevronRight className="h-3 w-3 text-slate-400" />}
                                        <span className="font-semibold text-slate-800">{en.items_summary}</span>
                                        {en.items_count && (
                                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-mono">
                                            {en.items_count} item{en.items_count === 1 ? '' : 's'}
                                          </span>
                                        )}
                                      </button>
                                    )}

                                    {!en.items_summary && en.notes && (
                                      <span className="text-slate-500 italic">{en.notes}</span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Debit (Paid) */}
                              <td className="px-3.5 py-3 text-right font-mono align-top">
                                {en.debit > 0 ? (
                                  <span className="font-bold text-emerald-700">
                                    - KES {Number(en.debit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>

                              {/* Credit (Received Goods) */}
                              <td className="px-3.5 py-3 text-right font-mono align-top">
                                {en.credit > 0 ? (
                                  <span className="font-bold text-slate-900">
                                    + KES {Number(en.credit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>

                              {/* Running Balance */}
                              <td className="px-3.5 py-3 text-right font-mono font-bold align-top">
                                <span className={en.running_balance > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                                  KES {Number(en.running_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </td>

                              {/* Document Action Button */}
                              <td className="px-3.5 py-3 text-center align-top print:hidden">
                                {isGRN && en.grn_id ? (
                                  <button
                                    type="button"
                                    onClick={() => handleViewGRNDocument(en.grn_id!)}
                                    disabled={loadingGRNId === String(en.grn_id)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                                    title="View Delivery GRN Note"
                                  >
                                    {loadingGRNId === String(en.grn_id) ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Truck className="h-3 w-3 text-amber-700" />
                                    )}
                                    <span>GRN Slip</span>
                                  </button>
                                ) : isPayment && en.payment_id ? (
                                  <button
                                    type="button"
                                    onClick={() => handleViewPaymentVoucher(en.payment_id!)}
                                    disabled={loadingPaymentId === en.payment_id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                                    title="View Payment Voucher"
                                  >
                                    {loadingPaymentId === en.payment_id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Receipt className="h-3 w-3 text-emerald-700" />
                                    )}
                                    <span>Voucher</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                            </tr>

                            {/* Inline Expandable Details Row */}
                            {isExpanded && (
                              <tr className="bg-emerald-50/20 border-b border-emerald-100">
                                <td colSpan={6} className="px-6 py-3">
                                  <div className="bg-white p-3 rounded-xl border border-emerald-200/70 text-xs space-y-2">
                                    <div className="flex items-center justify-between font-bold text-slate-800">
                                      <div className="flex items-center gap-1.5 text-emerald-950">
                                        <Package className="h-3.5 w-3.5 text-emerald-600" />
                                        <span>Consignment Products Breakdown</span>
                                      </div>
                                      {en.grn_id && (
                                        <button
                                          type="button"
                                          onClick={() => handleViewGRNDocument(en.grn_id!)}
                                          className="text-xs text-emerald-700 hover:text-emerald-900 font-bold underline flex items-center gap-1 cursor-pointer"
                                        >
                                          <span>Open Complete GRN Voucher</span>
                                          <ExternalLink className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                    <div className="text-slate-600 text-[11px] bg-slate-50 p-2 rounded-lg font-mono">
                                      {en.items_summary || en.notes || 'Consignment receipt verified.'}
                                    </div>
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
            </div>

            {/* Statement Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/80 rounded-b-3xl flex justify-between items-center print:hidden shrink-0">
              <div className="text-xs text-slate-500 font-medium">
                {ledgerData?.entries.length || 0} ledger transactions
              </div>
              <button
                type="button"
                onClick={() => setLedgerSupplier(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Universal Goods Received Note (GRN) Document Viewer Drawer / Modal */}
      {/* ========================================================================= */}
      {isGRNDrawerOpen && selectedGRNForDrawer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4 print:p-0 print:bg-white print:static overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-6">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between print:hidden shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-800 rounded-2xl border border-amber-200">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Goods Received Note (GRN)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-900">
                      {selectedGRNForDrawer.grn_no}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Official Inbound Stock Delivery Consignment Slip
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsGRNDrawerOpen(false);
                    setSelectedGRNForDrawer(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* GRN Document Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
              {/* Delivery Meta Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Supplier / Vendor Details</div>
                  <div className="font-bold text-slate-900 text-sm">{selectedGRNForDrawer.supplier_name || 'Direct / Walk-in Vendor'}</div>
                  {selectedGRNForDrawer.invoice_number && (
                    <div className="text-slate-600 font-mono text-xs">
                      Delivery Note / Inv: <strong className="text-slate-900">{selectedGRNForDrawer.invoice_number}</strong>
                    </div>
                  )}
                  {selectedGRNForDrawer.po_no && (
                    <div className="text-slate-600 font-mono text-xs">
                      Purchase Order: <strong className="text-slate-900">{selectedGRNForDrawer.po_no}</strong>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 sm:text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Consignment Meta</div>
                  <div className="font-mono text-slate-700">
                    Received Date: <strong className="text-slate-900">{new Date(selectedGRNForDrawer.delivery_date || selectedGRNForDrawer.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
                  </div>
                  {selectedGRNForDrawer.receiver_name && (
                    <div className="text-slate-600">
                      Received By: <strong className="text-slate-900">{selectedGRNForDrawer.receiver_name}</strong>
                    </div>
                  )}
                  {selectedGRNForDrawer.notes && (
                    <div className="text-slate-500 italic text-[11px]">
                      Remarks: "{selectedGRNForDrawer.notes}"
                    </div>
                  )}
                </div>
              </div>

              {/* Itemized Consignment Table */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
                <div className="px-4 py-2.5 bg-slate-100/75 border-b border-slate-200 flex items-center justify-between">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-emerald-600" />
                    <span>Delivered Items ({selectedGRNForDrawer.items.length})</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono font-medium">Physical Stock Verified</span>
                </div>

                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="px-3.5 py-2.5">Delivered Product</th>
                      <th className="px-3.5 py-2.5">Packaging / Breakdown</th>
                      <th className="px-3.5 py-2.5 text-right">Received Qty</th>
                      <th className="px-3.5 py-2.5 text-right">Buying Cost (BP)</th>
                      <th className="px-3.5 py-2.5 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-800 font-mono">
                    {selectedGRNForDrawer.items.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50/50">
                        <td className="px-3.5 py-3 font-sans">
                          <div className="font-bold text-slate-900">{it.product_name || `Product #${it.product_id}`}</div>
                          {it.product_sku && <div className="text-[11px] text-slate-400 font-mono">SKU: {it.product_sku}</div>}
                        </td>

                        <td className="px-3.5 py-3 font-sans">
                          {it.unit_type === 'roll' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 text-[11px] font-semibold">
                              <Layers className="h-3 w-3 text-sky-600" />
                              {it.rolls_received || 0} rolls + {Number(it.loose_meters_received || 0).toFixed(1)}m loose
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                              Piece Unit ({it.unit || 'pcs'})
                            </span>
                          )}
                        </td>

                        <td className="px-3.5 py-3 text-right font-bold text-slate-900">
                          {it.unit_type === 'roll'
                            ? `${Number(it.quantity_received).toFixed(1)}m`
                            : `${Number(it.quantity_received)} ${it.unit || 'pcs'}`}
                        </td>

                        <td className="px-3.5 py-3 text-right text-slate-700">
                          KES {Number(it.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="text-[10px] text-slate-400 block font-sans">
                            {it.unit_type === 'roll' ? 'per roll' : `per ${it.unit || 'pc'}`}
                          </span>
                        </td>

                        <td className="px-3.5 py-3 text-right font-bold text-emerald-700">
                          KES {Number(it.total_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Consignment Valuation Summary */}
              <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-2xl shadow-lg">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Total Consignment Value</span>
                  <span className="text-xs text-slate-300 font-medium">Recorded on Supplier Statement Ledger</span>
                </div>
                <div className="font-mono font-black text-emerald-400 text-lg">
                  KES {Number(selectedGRNForDrawer.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/80 rounded-b-3xl flex justify-end print:hidden shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsGRNDrawerOpen(false);
                  setSelectedGRNForDrawer(null);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Close GRN Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Universal Supplier Payment Voucher Modal */}
      {/* ========================================================================= */}
      {isPaymentVoucherOpen && selectedPaymentForModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4 print:p-0 print:bg-white print:static overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 my-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 print:hidden">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Supplier Payment Voucher</h3>
                  <p className="text-[11px] text-slate-500 font-mono">Voucher #{selectedPaymentForModal.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
                  title="Print Voucher"
                >
                  <Printer className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPaymentVoucherOpen(false);
                    setSelectedPaymentForModal(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Voucher Details */}
            <div className="space-y-3 text-xs">
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">Payment Settled</span>
                <span className="text-2xl font-black text-emerald-700 font-mono mt-0.5 block">
                  KES {Number(selectedPaymentForModal.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-emerald-800 font-semibold mt-1 inline-block uppercase">
                  Method: {selectedPaymentForModal.payment_method}
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Payee / Supplier:</span>
                  <span className="font-bold text-slate-900">{selectedPaymentForModal.supplier_name || ledgerSupplier?.name || `Supplier #${selectedPaymentForModal.supplier_id}`}</span>
                </div>
                {selectedPaymentForModal.reference && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Transaction Reference:</span>
                    <span className="font-mono font-bold text-slate-900">{selectedPaymentForModal.reference}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Date Paid:</span>
                  <span className="font-mono text-slate-800">
                    {new Date(selectedPaymentForModal.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {selectedPaymentForModal.authorizer_name && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Authorized By:</span>
                    <span className="font-medium text-slate-800">{selectedPaymentForModal.authorizer_name}</span>
                  </div>
                )}
                {selectedPaymentForModal.notes && (
                  <div className="pt-1.5 border-t border-slate-200 text-slate-600 italic">
                    Note: "{selectedPaymentForModal.notes}"
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 print:hidden">
              <button
                type="button"
                onClick={() => {
                  setIsPaymentVoucherOpen(false);
                  setSelectedPaymentForModal(null);
                }}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Close Voucher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Create / Edit Supplier Modal */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {editingSupplier ? <Edit3 className="h-5 w-5 text-slate-900" /> : <Truck className="h-5 w-5 text-slate-900" />}
                <span>{editingSupplier ? `Edit Supplier: ${editingSupplier.name}` : 'Add New Supplier'}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Supplier / Company Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SolarTech Kenya Ltd"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John Mwangi"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +254712345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="sales@supplier.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    KRA Tax PIN
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. P051234567Z"
                    value={taxPin}
                    onChange={(e) => setTaxPin(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium uppercase font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Physical Address / Warehouse Location
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Industrial Area, Enterprise Road, Nairobi"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                />
              </div>

              {editingSupplier && (
                <div className="pt-1 flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active_supp"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <label htmlFor="is_active_supp" className="text-xs font-semibold text-slate-700 select-none cursor-pointer">
                    Supplier Account is Active
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {saving ? 'Saving...' : editingSupplier ? 'Save Changes' : 'Create Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Delete Supplier Confirmation Modal */}
      {/* ========================================================================= */}
      {deletingSupplier && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100">
                <AlertTriangle className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Supplier</h3>
                <p className="text-xs text-slate-500 font-medium">{deletingSupplier.name}</p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {deleteError}
              </div>
            )}

            {Number(deletingSupplier.balance) > 0 ? (
              <div className="space-y-3">
                <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1.5 font-medium">
                  <div className="font-bold flex items-center gap-1.5 text-rose-900">
                    <Banknote className="h-4 w-4" />
                    Open Payable Balance Detected
                  </div>
                  <div>
                    This supplier currently has an open payable balance of <strong className="font-mono text-rose-900">KES {Number(deletingSupplier.balance).toLocaleString()}</strong>.
                    You cannot delete a supplier with an outstanding balance. Please settle or reconcile the balance first.
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeletingSupplier(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const supp = deletingSupplier;
                      setDeletingSupplier(null);
                      setPaymentSupplier(supp);
                      setPaymentAmount(String(supp.balance));
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
                  Are you sure you want to delete <strong>{deletingSupplier.name}</strong>?
                </p>
                <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  💡 <strong>Integrity Safeguard</strong>: If this supplier has past Purchase Orders, GRNs, or payment transactions, their account will be deactivated instead of removed to maintain audit logs.
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeletingSupplier(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteLoading}
                    onClick={handleDeleteSupplier}
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

      {/* ========================================================================= */}
      {/* Record Payment Modal */}
      {/* ========================================================================= */}
      {paymentSupplier && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Banknote className="h-5 w-5 text-emerald-600" />
                Record Supplier Payment
              </h3>
              <button onClick={() => setPaymentSupplier(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 mb-4 text-xs">
              <div className="text-slate-500">Paying Supplier:</div>
              <div className="font-bold text-slate-900 text-sm">{paymentSupplier.name}</div>
              <div className="text-slate-500 mt-1">Outstanding Liability:</div>
              <div className="font-mono font-black text-rose-600 text-sm">
                KES {Number(paymentSupplier.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {payError && (
              <div className="mb-4 p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 font-medium">
                {payError}
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Payment Amount (KES) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-lg font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                >
                  <option value="bank">Bank Transfer / EFT / RTGS</option>
                  <option value="mpesa">M-Pesa Paybill / Till</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash Tender</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Reference / Transaction No / Cheque #
                </label>
                <input
                  type="text"
                  placeholder="e.g. EFT-992109 or CHQ-0012"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Partial settlement for invoice DN-88192"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPaymentSupplier(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paying}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
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
