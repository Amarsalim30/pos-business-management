import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import type { PreSaleDocument, Product, Customer, Sale } from '../types';
import { ReceiptModal } from '../components/ReceiptModal';
import { InvoiceDrawer } from '../components/InvoiceDrawer';
import {
  FileCheck2,
  Plus,
  Trash2,
  Sparkles,
  AlertCircle,
  Eye,
  MapPin,
  Pencil,
  Loader2
} from 'lucide-react';

interface PreSaleLine {
  product_id: number;
  product_name: string;
  sku: string | null;
  unit_type: 'piece' | 'roll';
  unit: string;
  meters_per_roll: number | null;
  unit_sold: 'piece' | 'roll';
  rolls: string;
  loose: string;
  qty: string;
  unit_price: string;
}

export const PreSalesPage: React.FC = () => {
  const [documents, setDocuments] = useState<PreSaleDocument[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeTab, setActiveTab] = useState<'quotation' | 'proforma'>('quotation');

  const [selectedDocForDrawer, setSelectedDocForDrawer] = useState<PreSaleDocument | null>(null);
  const [drawerFormat, setDrawerFormat] = useState<'a4' | 'thermal'>('a4');

  // New / Edit Document Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [docCustomerId, setDocCustomerId] = useState<number | ''>('');
  const [docSiteName, setDocSiteName] = useState('');
  const [docValidDays, setDocValidDays] = useState('14');
  const [docDiscount, setDocDiscount] = useState('0');
  const [docNotes, setDocNotes] = useState('');
  const [docLines, setDocLines] = useState<PreSaleLine[]>([]);
  const [productToAdd, setProductToAdd] = useState<string>('');
  const [submittingDoc, setSubmittingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  // Delete Confirmation State
  const [deletingDoc, setDeletingDoc] = useState<PreSaleDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Conversion state
  const [convertingDoc, setConvertingDoc] = useState<PreSaleDocument | null>(null);
  const [convertPaymentMethod, setConvertPaymentMethod] = useState('cash');
  const [converting, setConverting] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  useEffect(() => {
    loadDocuments();
    loadProducts();
    loadCustomers();
  }, [activeTab]);

  const loadDocuments = async () => {
    try {
      const data = await apiFetch<PreSaleDocument[]>(`/api/v1/pre-sales/?doc_type=${activeTab}`);
      setDocuments(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await apiFetch<Product[]>('/api/v1/products/');
      setProducts(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await apiFetch<Customer[]>('/api/v1/customers/');
      setCustomers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingDocId(null);
    setDocCustomerId('');
    setDocSiteName('');
    setDocValidDays('14');
    setDocDiscount('0');
    setDocNotes('');
    setDocLines([]);
    setDocError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (doc: PreSaleDocument) => {
    if (doc.status === 'converted') {
      alert('Cannot edit a document that has already been converted to an active invoice');
      return;
    }

    setEditingDocId(doc.id);
    setDocCustomerId(doc.customer_id || '');
    setDocSiteName(doc.site_name || '');
    setDocValidDays('14');
    setDocDiscount(String(doc.discount_amount || 0));
    setDocNotes(doc.notes || '');
    setDocLines(
      doc.items.map(it => {
        const prod = products.find(p => p.id === it.product_id);
        const mpr = Number(it.unit_type === 'roll' ? (prod?.meters_per_roll || 100) : 100);
        return {
          product_id: it.product_id,
          product_name: it.product_name,
          sku: it.sku,
          unit_type: it.unit_type,
          unit: prod?.unit || 'pcs',
          meters_per_roll: mpr,
          unit_sold: it.unit_sold as any,
          rolls: String(it.rolls_qty || Math.floor(Number(it.quantity) / mpr)),
          loose: String(it.loose_meters || (Number(it.quantity) % mpr)),
          qty: String(it.quantity),
          unit_price: String(it.unit_price)
        };
      })
    );
    setDocError(null);
    setIsModalOpen(true);
  };

  const handleDeleteDocument = async () => {
    if (!deletingDoc) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/api/v1/pre-sales/${deletingDoc.id}`, {
        method: 'DELETE'
      });
      if (selectedDocForDrawer?.id === deletingDoc.id) {
        setSelectedDocForDrawer(null);
      }
      setDeletingDoc(null);
      loadDocuments();
    } catch (err: any) {
      alert(err.message || 'Failed to delete document');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddProductToDoc = (productId: number) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    if (docLines.some(l => l.product_id === productId)) return;

    setDocLines(prev => [
      ...prev,
      {
        product_id: prod.id,
        product_name: prod.name,
        sku: prod.sku,
        unit_type: prod.unit_type,
        unit: prod.unit,
        meters_per_roll: prod.meters_per_roll,
        unit_sold: prod.unit_type === 'roll' ? 'roll' : 'piece',
        rolls: '1',
        loose: '0',
        qty: '1',
        unit_price: String(prod.selling_price)
      }
    ]);
    setProductToAdd('');
  };

  const calculateLineQuantity = (line: PreSaleLine): number => {
    if (line.unit_type === 'roll') {
      const rolls = parseInt(line.rolls || '0', 10) || 0;
      const loose = parseFloat(line.loose || '0') || 0;
      const mpr = Number(line.meters_per_roll) || 100;
      return (rolls * mpr) + loose;
    }
    return parseFloat(line.qty || '0') || 0;
  };

  const calculateTotalDocValue = (): number => {
    return docLines.reduce((acc, line) => {
      const totalQty = calculateLineQuantity(line);
      const price = parseFloat(line.unit_price || '0') || 0;
      if (line.unit_type === 'roll') {
        const mpr = Number(line.meters_per_roll) || 100;
        return acc + ((totalQty / mpr) * price);
      }
      return acc + (totalQty * price);
    }, 0);
  };

  const handleSaveDocument = async () => {
    if (docLines.length === 0) {
      setDocError('Please add at least one product item');
      return;
    }

    setSubmittingDoc(true);
    setDocError(null);

    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + (parseInt(docValidDays, 10) || 14));

    const payload = {
      type: activeTab,
      customer_id: docCustomerId ? Number(docCustomerId) : null,
      discount_amount: parseFloat(docDiscount) || 0,
      valid_until: validUntilDate.toISOString(),
      site_name: docSiteName.trim() || null,
      notes: docNotes.trim() || null,
      items: docLines.map(line => ({
        product_id: line.product_id,
        unit_type: line.unit_type,
        unit_sold: line.unit_sold,
        quantity: calculateLineQuantity(line),
        rolls_qty: line.unit_type === 'roll' ? parseInt(line.rolls || '0', 10) : null,
        loose_meters: line.unit_type === 'roll' ? parseFloat(line.loose || '0') : null,
        unit_price: parseFloat(line.unit_price || '0')
      }))
    };

    try {
      if (editingDocId) {
        // PUT Update
        await apiFetch(`/api/v1/pre-sales/${editingDocId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        // POST Create
        await apiFetch('/api/v1/pre-sales/', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setIsModalOpen(false);
      setEditingDocId(null);
      setDocLines([]);
      setDocSiteName('');
      setDocNotes('');
      setDocDiscount('0');
      loadDocuments();
    } catch (err: any) {
      setDocError(err.message || 'Failed to save document');
    } finally {
      setSubmittingDoc(false);
    }
  };

  const handleConvert = async () => {
    if (!convertingDoc) return;
    setConverting(true);
    try {
      const sale = await apiFetch<Sale>(`/api/v1/pre-sales/${convertingDoc.id}/convert-to-sale?payment_method=${convertPaymentMethod}`, {
        method: 'POST'
      });
      setConvertingDoc(null);
      setCompletedSale(sale);
      loadDocuments();
    } catch (err: any) {
      alert(err.message || 'Failed to convert document');
    } finally {
      setConverting(false);
    }
  };

  const totalValue = calculateTotalDocValue();
  const netTotal = Math.max(0, totalValue - (parseFloat(docDiscount) || 0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <FileCheck2 className="h-5 w-5 text-amber-600" />
            <span>Pre-Sale Documents</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Create, edit, and convert professional Quotations and Proforma Invoices
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex space-x-1 rounded-xl bg-slate-200/70 p-1">
            <button
              onClick={() => setActiveTab('quotation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'quotation'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Quotations
            </button>
            <button
              onClick={() => setActiveTab('proforma')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'proforma'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Proforma Invoices
            </button>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center space-x-1.5 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-500 transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>New {activeTab === 'quotation' ? 'Quotation' : 'Proforma'}</span>
          </button>
        </div>
      </div>

      {/* Documents List */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Document No</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    No {activeTab} documents created yet.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => {
                      setSelectedDocForDrawer(doc);
                      setDrawerFormat('a4');
                    }}
                    className="hover:bg-amber-50/40 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      <span className="group-hover:text-amber-600 transition-colors underline decoration-slate-300 underline-offset-2">
                        {doc.document_no}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {doc.customer_name ? (
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-900">{doc.customer_name}</div>
                          {doc.site_name && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-900 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 w-fit">
                              <MapPin className="h-2.5 w-2.5 text-amber-700 shrink-0" />
                              <span className="truncate max-w-[160px]">{doc.site_name}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="text-slate-400 italic">Unspecified</span>
                          {doc.site_name && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-900 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 w-fit">
                              <MapPin className="h-2.5 w-2.5 text-amber-700 shrink-0" />
                              <span className="truncate max-w-[160px]">{doc.site_name}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {doc.items.length} products
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      KES {Number(doc.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        doc.status === 'converted'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => {
                            setSelectedDocForDrawer(doc);
                            setDrawerFormat('a4');
                          }}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs"
                          title="View / Print Document"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-600" />
                        </button>

                        {/* Edit Button */}
                        {doc.status === 'draft' ? (
                          <button
                            onClick={() => handleOpenEditModal(doc)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs hover:text-amber-600"
                            title="Edit Quotation / Proforma"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            disabled
                            className="p-1.5 rounded-lg border border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                            title="Converted documents cannot be edited"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Delete Button */}
                        {doc.status === 'draft' ? (
                          <button
                            onClick={() => setDeletingDoc(doc)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 cursor-pointer shadow-2xs"
                            title="Delete Document"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            disabled
                            className="p-1.5 rounded-lg border border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                            title="Converted documents cannot be deleted"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Convert to Sale Button */}
                        {doc.status === 'draft' ? (
                          <button
                            onClick={() => setConvertingDoc(doc)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer shadow-2xs"
                            title="Convert into Active Sale Invoice"
                          >
                            <Sparkles className="h-3 w-3" />
                            <span>Convert</span>
                          </button>
                        ) : (
                          <span className="text-[11px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                            Sale #{doc.converted_sale_id}
                          </span>
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

      {/* Delete Document Confirmation Dialog */}
      {deletingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2 bg-rose-50 rounded-xl border border-rose-100">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Delete {deletingDoc.type.toUpperCase()}?
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-slate-900 font-mono">#{deletingDoc.document_no}</strong> for <strong>{deletingDoc.customer_name || 'Walk-in'}</strong> totaling <strong className="text-slate-900">KES {Number(deletingDoc.total_amount).toLocaleString()}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingDoc(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDocument}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span>{isDeleting ? 'Deleting...' : 'Yes, Delete Document'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert Document Modal */}
      {convertingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2 text-emerald-600">
              <Sparkles className="h-5 w-5" />
              <h3 className="text-base font-bold text-slate-900">Convert to Official Sale</h3>
            </div>
            <p className="text-xs text-slate-600">
              Converting <strong>{convertingDoc.document_no}</strong> will create a finalized Sale, deduct items from inventory stock, and mark this pre-sale document as converted.
            </p>

            <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold text-slate-800">{convertingDoc.customer_name || 'Walk-in / Cash'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Valuation:</span>
                <span className="font-mono font-bold text-slate-900">KES {Number(convertingDoc.total_amount).toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Select Payment Settlement Method:</label>
              <select
                value={convertPaymentMethod}
                onChange={(e) => setConvertPaymentMethod(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 bg-white focus:outline-none focus:border-emerald-600"
              >
                <option value="cash">Cash Settlement</option>
                <option value="mpesa">M-Pesa Direct</option>
                <option value="credit">Credit (Invoice on Customer Ledger)</option>
                <option value="bank">Bank Wire / Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setConvertingDoc(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConvert}
                disabled={converting}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                {converting ? 'Converting...' : 'Confirm & Complete Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New / Edit Document Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-3xl w-full shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <FileCheck2 className="h-5 w-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingDocId ? `Edit ${activeTab === 'quotation' ? 'Quotation' : 'Proforma Invoice'}` : `New ${activeTab === 'quotation' ? 'Quotation' : 'Proforma Invoice'}`}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer">
                ✕ Close
              </button>
            </div>

            {docError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{docError}</span>
              </div>
            )}

            {/* Header Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="text-xs font-bold text-slate-700">Customer Account:</label>
                <select
                  value={docCustomerId}
                  onChange={(e) => setDocCustomerId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                >
                  <option value="">-- Optional / Walk-in Quote --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-amber-600" />
                  <span>Site / Project Narrative:</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nyali Heights Block B"
                  value={docSiteName}
                  onChange={(e) => setDocSiteName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Validity Period (Days):</label>
                <input
                  type="number"
                  min="1"
                  value={docValidDays}
                  onChange={(e) => setDocValidDays(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>
            </div>

            {/* Product Selector */}
            <div className="flex items-center space-x-2">
              <select
                value={productToAdd}
                onChange={(e) => {
                  setProductToAdd(e.target.value);
                  if (e.target.value) handleAddProductToDoc(Number(e.target.value));
                }}
                className="flex-1 rounded-xl border border-amber-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600 cursor-pointer shadow-2xs"
              >
                <option value="">-- Add Product to Document --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.sku ? `(${p.sku})` : ''} — Stock: {p.formatted_stock || `${p.current_stock} ${p.unit}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Line items table */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3">Product</th>
                    <th className="p-3 w-56">Quoted Quantity</th>
                    <th className="p-3 w-32">Quoted Unit Price (KES)</th>
                    <th className="p-3 w-28 text-right">Line Total</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {docLines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">
                        No products added yet. Select a product from the dropdown above.
                      </td>
                    </tr>
                  ) : (
                    docLines.map(line => {
                      const isRoll = line.unit_type === 'roll';
                      const mpr = Number(line.meters_per_roll) || 100;
                      const totalQty = calculateLineQuantity(line);
                      const price = parseFloat(line.unit_price || '0') || 0;
                      const lineTotal = isRoll ? (totalQty / mpr) * price : totalQty * price;

                      return (
                        <tr key={line.product_id} className="hover:bg-slate-50/50">
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{line.product_name}</div>
                            {line.sku && <div className="text-[10px] text-slate-400 font-mono">SKU: {line.sku}</div>}
                          </td>
                          <td className="p-3">
                            {isRoll ? (
                              <div className="flex items-center space-x-1">
                                <input
                                  type="number"
                                  min="0"
                                  value={line.rolls}
                                  onChange={(e) => setDocLines(prev => prev.map(l => l.product_id === line.product_id ? { ...l, rolls: e.target.value } : l))}
                                  className="w-14 rounded border border-slate-300 px-1 py-0.5 text-center font-mono"
                                />
                                <span className="text-[10px] text-slate-400">r +</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={line.loose}
                                  onChange={(e) => setDocLines(prev => prev.map(l => l.product_id === line.product_id ? { ...l, loose: e.target.value } : l))}
                                  className="w-16 rounded border border-slate-300 px-1 py-0.5 text-center font-mono"
                                />
                                <span className="text-[10px] text-slate-400">m</span>
                              </div>
                            ) : (
                              <input
                                type="number"
                                min="1"
                                value={line.qty}
                                onChange={(e) => setDocLines(prev => prev.map(l => l.product_id === line.product_id ? { ...l, qty: e.target.value } : l))}
                                className="w-20 rounded border border-slate-300 px-2 py-0.5 text-center font-mono font-bold"
                              />
                            )}
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              value={line.unit_price}
                              onChange={(e) => setDocLines(prev => prev.map(l => l.product_id === line.product_id ? { ...l, unit_price: e.target.value } : l))}
                              className="w-28 rounded border border-slate-300 px-2 py-0.5 text-right font-mono"
                            />
                          </td>
                          <td className="p-3 text-right font-bold font-mono text-slate-900">
                            KES {lineTotal.toLocaleString()}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setDocLines(prev => prev.filter(l => l.product_id !== line.product_id))}
                              className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Notes & Terms:</label>
              <input
                type="text"
                placeholder="e.g. Price includes delivery to site, payment terms 30 days"
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
              />
            </div>

            {/* Discount & Totals */}
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center space-x-2">
                <label className="font-bold text-slate-700">Special Discount (KES):</label>
                <input
                  type="number"
                  min="0"
                  value={docDiscount}
                  onChange={(e) => setDocDiscount(e.target.value)}
                  className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-right font-mono font-bold"
                />
              </div>

              <div className="text-right">
                <div className="text-xs text-slate-500">Document Total:</div>
                <div className="text-lg font-extrabold text-amber-700 font-mono">
                  KES {netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDocument}
                disabled={submittingDoc || docLines.length === 0}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                {submittingDoc ? 'Saving Document...' : editingDocId ? 'Save Changes' : `Create ${activeTab === 'quotation' ? 'Quotation' : 'Proforma'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Drawer for Quotations & Proformas */}
      <InvoiceDrawer
        preSaleDoc={selectedDocForDrawer}
        isOpen={!!selectedDocForDrawer}
        defaultFormat={drawerFormat}
        onClose={() => setSelectedDocForDrawer(null)}
        onEditPreSaleDoc={(doc) => {
          setSelectedDocForDrawer(null);
          handleOpenEditModal(doc);
        }}
        onDeletePreSaleDoc={(doc) => {
          setDeletingDoc(doc);
        }}
      />

      {/* Invoice Drawer for Converted Sales */}
      <InvoiceDrawer
        sale={completedSale}
        isOpen={!!completedSale}
        defaultFormat="a4"
        onClose={() => setCompletedSale(null)}
      />

      {/* 80mm Receipt Modal after conversion fallback */}
      <ReceiptModal
        sale={completedSale}
        onClose={() => setCompletedSale(null)}
      />
    </div>
  );
};
