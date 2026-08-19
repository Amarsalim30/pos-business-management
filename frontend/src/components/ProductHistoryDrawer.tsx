import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import type { ProductHistoryResponse } from '../types';
import {
  X,
  Clock,
  ShoppingCart,
  Truck,
  ArrowUpDown,
  Calendar,
  User as UserIcon,
  AlertCircle,
  Loader2,
  Receipt
} from 'lucide-react';

interface ProductHistoryDrawerProps {
  productId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ProductHistoryDrawer: React.FC<ProductHistoryDrawerProps> = ({
  productId,
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'sales' | 'purchases' | 'movements'>('sales');
  const [historyData, setHistoryData] = useState<ProductHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && productId) {
      loadHistory(productId);
    } else {
      setHistoryData(null);
      setError(null);
    }
  }, [isOpen, productId]);

  const loadHistory = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ProductHistoryResponse>(`/api/v1/products/${id}/history`);
      setHistoryData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load product history');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const product = historyData?.product;

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'in':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Stock IN / GRN</span>;
      case 'sale':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Shop Sale</span>;
      case 'adjust':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Adjustment</span>;
      case 'project_allocation':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">Project BOM</span>;
      case 'void_return':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">Void Return</span>;
      case 'stock_take':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">Stock Take</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">{type}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold tracking-wider uppercase text-amber-600">
                  Product Telemetry
                </span>
                {product?.sku && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200">
                    {product.sku}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {product?.name || (loading ? 'Loading product...' : 'Product Details')}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Product Quick Stats Bar */}
          {product && (
            <div className="grid grid-cols-3 gap-px bg-slate-200 border-b border-slate-200 text-xs">
              <div className="bg-white p-3">
                <span className="text-slate-700 block font-medium">Current Stock</span>
                <span className="font-semibold text-slate-900 font-mono text-sm">
                  {product.formatted_stock || `${product.current_stock} ${product.unit}`}
                </span>
              </div>
              <div className="bg-white p-3">
                <span className="text-slate-700 block font-medium">Cost Price (BP)</span>
                <span className="font-semibold text-slate-900 font-mono text-sm">
                  KES {Number(product.cost_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bg-white p-3">
                <span className="text-slate-700 block font-medium">Selling Price (SP)</span>
                <span className="font-semibold text-emerald-600 font-mono text-sm">
                  KES {Number(product.selling_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 px-6 bg-white">
            <button
              onClick={() => setActiveTab('sales')}
              className={`py-3 px-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'sales'
                  ? 'border-amber-600 text-amber-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              Sales History ({historyData?.sales_history.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('purchases')}
              className={`py-3 px-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'purchases'
                  ? 'border-amber-600 text-amber-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Truck className="w-4 h-4" />
              Purchases & GRN ({historyData?.purchase_history.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('movements')}
              className={`py-3 px-4 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'movements'
                  ? 'border-amber-600 text-amber-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ArrowUpDown className="w-4 h-4" />
              Movements Log ({historyData?.stock_movements.length || 0})
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-amber-600" />
                <p className="text-sm font-medium">Loading telemetry history...</p>
              </div>
            ) : error ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
                <p className="text-sm">{error}</p>
              </div>
            ) : (
              <>
                {/* 1. SALES HISTORY */}
                {activeTab === 'sales' && (
                  <div className="space-y-3">
                    {historyData?.sales_history.length === 0 ? (
                      <div className="text-center py-12 bg-white rounded-xl border border-slate-200 p-8">
                        <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-700">No Sales Recorded</p>
                        <p className="text-xs text-slate-700 mt-1">This product has not been sold through the counter yet.</p>
                      </div>
                    ) : (
                      historyData?.sales_history.map((sale) => (
                        <div
                          key={`${sale.sale_id}-${sale.invoice_no}`}
                          className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-slate-900">
                                  {sale.invoice_no}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                  sale.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  sale.status === 'voided' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                  'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {sale.status.toUpperCase()}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700 mt-1 flex items-center gap-1.5">
                                <UserIcon className="w-3.5 h-3.5" />
                                {sale.customer_name || 'Walk-in Customer'}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-mono text-sm font-bold text-slate-900 block">
                                KES {Number(sale.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-xs text-slate-700">
                                {Number(sale.quantity)} {sale.unit_sold || 'pcs'} @ KES {Number(sale.unit_price).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {new Date(sale.date).toLocaleString()}
                            </span>
                            <span className="font-mono text-slate-700">
                              Cost Margin: KES {(Number(sale.unit_price) - Number(sale.cost_price)).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 2. PURCHASES / GRN HISTORY */}
                {activeTab === 'purchases' && (
                  <div className="space-y-3">
                    {historyData?.purchase_history.length === 0 ? (
                      <div className="text-center py-12 bg-white rounded-xl border border-slate-200 p-8">
                        <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-700">No Supplier Purchases Recorded</p>
                        <p className="text-xs text-slate-700 mt-1">No Goods Received Notes (GRN) found for this SKU.</p>
                      </div>
                    ) : (
                      historyData?.purchase_history.map((pur, idx) => (
                        <div
                          key={`pur-${idx}`}
                          className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-slate-900">
                                  {pur.grn_no || `GRN #${pur.grn_id}`}
                                </span>
                                {pur.po_no && (
                                  <span className="text-xs font-mono text-slate-700">
                                    PO: {pur.po_no}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-medium text-slate-800 mt-1 flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-slate-400" />
                                {pur.supplier_name || 'Supplier'}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-mono text-sm font-bold text-slate-900 block">
                                KES {Number(pur.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-xs text-slate-700">
                                {Number(pur.quantity)} units @ KES {Number(pur.unit_cost).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {new Date(pur.date).toLocaleDateString()}
                            </span>
                            <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Received into Stock
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 3. STOCK MOVEMENTS LOG */}
                {activeTab === 'movements' && (
                  <div className="space-y-2.5">
                    {historyData?.stock_movements.length === 0 ? (
                      <div className="text-center py-12 bg-white rounded-xl border border-slate-200 p-8">
                        <ArrowUpDown className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-700">No Stock Movements Logged</p>
                      </div>
                    ) : (
                      historyData?.stock_movements.map((mov) => (
                        <div
                          key={`mov-${mov.id}`}
                          className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              {getMovementBadge(mov.type)}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-900 flex items-center gap-2">
                                {mov.reference_id && (
                                  <span className="font-mono text-slate-700">{mov.reference_id}</span>
                                )}
                                <span className="text-slate-700 font-normal">by {mov.user_name || 'Staff'}</span>
                              </div>
                              <div className="text-xs text-slate-700 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" />
                                {new Date(mov.timestamp).toLocaleString()}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className={`font-mono text-sm font-bold ${
                              Number(mov.quantity) > 0 ? 'text-emerald-600' : 'text-slate-700'
                            }`}>
                              {Number(mov.quantity) > 0 ? `+${Number(mov.quantity)}` : Number(mov.quantity)} {mov.unit_sold || ''}
                            </span>
                            <div className="text-xs text-slate-700 font-mono">
                              {Number(mov.previous_quantity)} → {Number(mov.new_quantity)}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Close Drawer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
