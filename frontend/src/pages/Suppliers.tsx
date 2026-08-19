import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../services/api';
import type { Supplier, SupplierLedgerResponse, SupplierSummaryResponse } from '../types';
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
  AlertTriangle
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

  // Live Statement Ledger Modal
  const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);
  const [ledgerData, setLedgerData] = useState<SupplierLedgerResponse | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const ledgerPrintRef = useRef<HTMLDivElement>(null);

  // Payment Modal
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
    try {
      const data = await apiFetch<SupplierLedgerResponse>(`/api/v1/suppliers/${supp.id}/ledger`);
      setLedgerData(data);
    } catch (e) {
      console.error('Failed to load ledger', e);
    } finally {
      setLoadingLedger(false);
    }
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
    if (!paymentSupplier) return;
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      setPayError('Please enter a valid positive payment amount');
      return;
    }

    setPaying(true);
    setPayError(null);
    try {
      await apiFetch(`/api/v1/suppliers/${paymentSupplier.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          payment_method: paymentMethod,
          reference: paymentReference.trim() || null,
          notes: paymentNotes.trim() || null
        })
      });
      setPaymentSupplier(null);
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentNotes('');
      reloadSuppliers();
      loadSummary();
      if (ledgerSupplier?.id === paymentSupplier.id) {
        loadLedger(paymentSupplier);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
              <Truck className="h-6 w-6" />
            </div>
            Suppliers & Payables
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Manage vendor directories, track inbound deliveries, payables, and live statement ledgers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow-sm transition-all duration-150 active:scale-[0.98] cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Supplier
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Suppliers</div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {summary ? summary.active_suppliers : suppliers.filter(s => s.is_active).length}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {summary ? `${summary.total_suppliers} total registered suppliers` : 'Total registered suppliers'}
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-bold text-rose-600 uppercase tracking-wider">Total Payables Debt</div>
          <div className="text-2xl font-black text-rose-600 mt-2 font-mono">
            KES {Number(summary ? summary.total_payables_debt : suppliers.reduce((sum, s) => sum + Number(s.balance || 0), 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-1">Outstanding vendor liability</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Suppliers with Balance</div>
          <div className="text-2xl font-black text-emerald-600 mt-2 font-mono">
            {summary ? summary.suppliers_with_balance : suppliers.filter(s => Number(s.balance) > 0).length}
          </div>
          <div className="text-xs text-slate-400 mt-1">Vendors pending settlement</div>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search suppliers by name, phone, or KRA PIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden max-h-[calc(100vh-270px)] flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 shadow-2xs">
              <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Supplier Name</th>
                <th className="py-3.5 px-4">Contact Info</th>
                <th className="py-3.5 px-4">Address / PIN</th>
                <th className="py-3.5 px-4 text-right">Payable Balance</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {suppliersLoading && suppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-normal">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                      <span>Loading suppliers...</span>
                    </div>
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-normal">
                    No suppliers found matching your query.
                  </td>
                </tr>
              ) : (
                suppliers.map((supp) => (
                  <tr key={supp.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{supp.name}</div>
                      {supp.contact_person && (
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <User className="h-3 w-3 text-slate-400" />
                          {supp.contact_person}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {supp.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-700">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {supp.phone}
                        </div>
                      )}
                      {supp.email && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                          <Mail className="h-3 w-3 text-slate-400" />
                          {supp.email}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {supp.address && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {supp.address}
                        </div>
                      )}
                      {supp.tax_pin && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 font-mono">
                          <Hash className="h-3 w-3 text-slate-400" />
                          PIN: {supp.tax_pin}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold">
                      {Number(supp.balance) > 0 ? (
                        <span className="text-rose-600">
                          KES {Number(supp.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-slate-400">KES 0.00</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        supp.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {supp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => loadLedger(supp)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        title="View Statement Ledger"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Ledger
                      </button>
                      <button
                        onClick={() => {
                          setPaymentSupplier(supp);
                          setPaymentAmount(supp.balance > 0 ? String(supp.balance) : '');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        title="Record Payment"
                      >
                        <Banknote className="h-3.5 w-3.5" />
                        Pay
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
                  <td colSpan={6} className="px-4 py-3 text-center text-indigo-600 bg-indigo-50/40 text-xs font-bold">
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
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

      {/* Create / Edit Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {editingSupplier ? <Edit3 className="h-5 w-5 text-indigo-600" /> : <Truck className="h-5 w-5 text-indigo-600" />}
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium uppercase font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {editingSupplier && (
                <div className="pt-1 flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active_supp"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
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

      {/* Delete Supplier Confirmation Modal */}
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

      {/* Record Payment Modal */}
      {paymentSupplier && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Banknote className="h-5 w-5 text-emerald-600" />
                Record Supplier Payment
              </h3>
              <button onClick={() => setPaymentSupplier(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 mb-4 text-xs">
              <div className="text-slate-500">Paying Supplier:</div>
              <div className="font-bold text-slate-900 text-sm">{paymentSupplier.name}</div>
              <div className="text-slate-500 mt-1">Outstanding Liability:</div>
              <div className="font-mono font-black text-rose-600 text-sm">
                KES {Number(paymentSupplier.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Notes
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
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paying}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {paying ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Statement Ledger Modal */}
      {ledgerSupplier && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 print:p-0 print:bg-white print:static">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 print:max-h-none print:shadow-none print:border-none">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Supplier Statement Ledger</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {ledgerSupplier.name} {ledgerSupplier.tax_pin && `• PIN: ${ledgerSupplier.tax_pin}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintLedger}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  <Printer className="h-4 w-4" />
                  Print Statement
                </button>
                <button onClick={() => setLedgerSupplier(null)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content for Print & Screen */}
            <div ref={ledgerPrintRef} className="p-6 overflow-y-auto flex-1 font-mono text-xs">
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

              {loadingLedger ? (
                <div className="py-12 text-center text-slate-400 font-sans">Loading statement ledger...</div>
              ) : !ledgerData || ledgerData.entries.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-sans">
                  No goods received or payment transactions on record for this supplier.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 font-sans text-xs">
                    <div>
                      <span className="text-slate-500">Current Outstanding Payable:</span>
                    </div>
                    <div className="font-mono font-black text-rose-600 text-base">
                      KES {Number(ledgerData.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b-2 border-slate-300 text-[11px] font-bold uppercase text-slate-600">
                          <th className="py-2 px-2">Date</th>
                          <th className="py-2 px-2">Type</th>
                          <th className="py-2 px-2">Reference / Note</th>
                          <th className="py-2 px-2 text-right">Debit (Paid)</th>
                          <th className="py-2 px-2 text-right">Credit (Received)</th>
                          <th className="py-2 px-2 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-[11px]">
                        {ledgerData.entries.map((entry, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-2 text-slate-600 whitespace-nowrap">
                              {new Date(entry.date).toLocaleDateString()}
                            </td>
                            <td className="py-2 px-2 uppercase font-bold text-slate-700">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                entry.type === 'grn' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {entry.type}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-slate-800">
                              <div className="font-semibold">{entry.reference}</div>
                              {entry.notes && <div className="text-[10px] text-slate-500 font-normal">{entry.notes}</div>}
                            </td>
                            <td className="py-2 px-2 text-right font-semibold text-emerald-700">
                              {entry.debit > 0 ? Number(entry.debit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                            </td>
                            <td className="py-2 px-2 text-right font-semibold text-amber-800">
                              {entry.credit > 0 ? Number(entry.credit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                            </td>
                            <td className="py-2 px-2 text-right font-bold text-slate-900">
                              KES {Number(entry.running_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-between items-center print:hidden">
              <div className="text-xs text-slate-500 font-medium">
                {ledgerData?.entries.length || 0} ledger transactions
              </div>
              <button
                onClick={() => setLedgerSupplier(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
