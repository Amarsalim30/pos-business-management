import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import type { NetProfitStatement, FastMovingProductItem, SalesReportSummary } from '../types';
import {
  BarChart3,
  Loader2,
  Printer
} from 'lucide-react';


export const ReportsPage: React.FC = () => {
  const [period, setPeriod] = useState<'today' | '7days' | 'month' | 'all'>('month');
  const [statement, setStatement] = useState<NetProfitStatement | null>(null);
  const [fastMoving, setFastMoving] = useState<FastMovingProductItem[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesReportSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReports();
  }, [period]);

  const loadReports = async () => {
    setLoading(true);
    try {
      let dateFrom = '';
      const now = new Date();

      if (period === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateFrom = startOfDay.toISOString();
      } else if (period === '7days') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        dateFrom = d.toISOString();
      } else if (period === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFrom = startOfMonth.toISOString();
      }

      let netUrl = '/api/v1/reports/net-profit';
      let fastUrl = '/api/v1/reports/fast-moving?limit=10';
      let salesUrl = '/api/v1/reports/sales-summary';

      if (dateFrom) {
        netUrl += `?date_from=${encodeURIComponent(dateFrom)}`;
        salesUrl += `?date_from=${encodeURIComponent(dateFrom)}`;
      }

      const [netData, fastData, salesData] = await Promise.all([
        apiFetch<NetProfitStatement>(netUrl),
        apiFetch<FastMovingProductItem[]>(fastUrl),
        apiFetch<SalesReportSummary>(salesUrl)
      ]);

      setStatement(netData);
      setFastMoving(fastData);
      setSalesSummary(salesData);
    } catch (e) {
      console.error('Failed to load reports', e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
              <BarChart3 className="h-6 w-6" />
            </div>
            Owner Profit Statement & Business Reports
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Executive financial intelligence, true store net profit calculation, and product turnover velocity
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(['today', '7days', 'month', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                  period === p
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {p === '7days' ? 'Last 7 Days' : p === 'month' ? 'This Month' : p === 'today' ? 'Today' : 'All Time'}
              </button>
            ))}
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer shadow-xs"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {loading && !statement ? (
        <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2">
          <Loader2 className="h-8 w-8 mx-auto text-emerald-600 animate-spin" />
          <p className="text-xs">Generating financial reports...</p>
        </div>
      ) : (
        <>
          {/* Top KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Sales Revenue</div>
              <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                KES {Number(statement?.gross_sales_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">Total customer invoices in period</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Cost of Goods Sold (COGS)</div>
              <div className="text-2xl font-black text-indigo-700 mt-2 font-mono">
                KES {Number(statement?.cost_of_goods_sold || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">Snapshot product buying cost</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">Gross Margin %</div>
              <div className="text-2xl font-black text-blue-700 mt-2 font-mono">
                {Number(statement?.gross_margin_percentage || 0).toFixed(1)}%
              </div>
              <div className="text-xs text-slate-400 mt-1">Gross profit over sales revenue</div>
            </div>

            <div className="bg-emerald-50/80 p-5 rounded-2xl border border-emerald-200 shadow-sm">
              <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Store Net Profit</div>
              <div className="text-2xl font-black text-emerald-700 mt-2 font-mono">
                KES {Number(statement?.net_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-emerald-600/80 mt-1">Revenue - COGS - Expenses + Projects</div>
            </div>
          </div>

          {/* Detailed Auditable Net Profit Statement */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Executive Net Profit Statement</h3>
                  <p className="text-xs text-slate-500">Comprehensive profit breakdown for selected period</p>
                </div>
                <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-lg uppercase">
                  {period}
                </span>
              </div>

              {statement && (
                <div className="space-y-4 text-xs">
                  {/* Sales Revenue Section */}
                  <div className="space-y-1.5 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="font-bold text-slate-900 uppercase text-[11px] tracking-wider mb-1">1. Sales Revenue</div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Gross Sales Invoices</span>
                      <span className="font-mono font-semibold">KES {Number(statement.gross_sales_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Less VAT Tax Extracted (16%)</span>
                      <span className="font-mono">- KES {Number(statement.tax_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Less Discounts Allowed</span>
                      <span className="font-mono">- KES {Number(statement.discount_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-900">
                      <span>Net Sales Revenue</span>
                      <span className="font-mono">KES {Number(statement.net_sales_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* COGS & Gross Profit */}
                  <div className="space-y-1.5 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                    <div className="font-bold text-indigo-950 uppercase text-[11px] tracking-wider mb-1">2. Cost of Goods Sold & Gross Margin</div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Cost of Goods Sold (Inventory Buying Price BP)</span>
                      <span className="font-mono font-semibold text-rose-600">- KES {Number(statement.cost_of_goods_sold).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between border-t border-indigo-200 pt-1.5 font-bold text-indigo-900 text-sm">
                      <span>Gross Trading Profit ({Number(statement.gross_margin_percentage).toFixed(1)}%)</span>
                      <span className="font-mono">KES {Number(statement.gross_profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Operating Expenses */}
                  <div className="space-y-1.5 bg-rose-50/40 p-4 rounded-xl border border-rose-100">
                    <div className="font-bold text-rose-950 uppercase text-[11px] tracking-wider mb-1">3. Operating Expenses & Deductions</div>
                    <div className="flex justify-between text-slate-600">
                      <span>Purchasing Logistics & Labour Expenses</span>
                      <span className="font-mono">KES {Number(statement.purchase_expenses).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Recurring Operating Expenses (Rent & Payroll)</span>
                      <span className="font-mono">KES {Number(statement.recurring_expenses).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Petty Cash Outflows & Store Incidentals</span>
                      <span className="font-mono">KES {Number(statement.petty_cash_expenses).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between border-t border-rose-200 pt-1.5 font-bold text-rose-700">
                      <span>Total Operating Deductions</span>
                      <span className="font-mono">- KES {Number(statement.total_operating_expenses).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Other Income & Projects */}
                  <div className="space-y-1.5 bg-blue-50/40 p-4 rounded-xl border border-blue-100">
                    <div className="font-bold text-blue-950 uppercase text-[11px] tracking-wider mb-1">4. Other Business Incomes</div>
                    <div className="flex justify-between text-slate-600">
                      <span>Solar Installations Net Profit</span>
                      <span className="font-mono text-emerald-600">+ KES {Number(statement.project_net_profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>M-Pesa Agent Commissions</span>
                      <span className="font-mono text-emerald-600">+ KES {Number(statement.mpesa_commission_income).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Final Net Profit Banner */}
                  <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase font-bold text-slate-400 tracking-wider">Final Store Net Profit</div>
                      <div className="text-xs text-slate-300">Auditable bottom-line earnings</div>
                    </div>
                    <div className="text-xl font-black font-mono text-emerald-400">
                      KES {Number(statement.net_profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sales & Payment Methods Breakdown */}
            <div className="space-y-6">
              {salesSummary && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">Payment Tender Distribution</h3>
                  <div className="space-y-3">
                    {salesSummary.payment_methods.map((pm) => (
                      <div key={pm.method} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="capitalize text-slate-700">{pm.method}</span>
                          <span className="font-mono font-bold text-slate-900">
                            KES {Number(pm.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} ({Number(pm.percentage)}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pm.method === 'mpesa'
                                ? 'bg-emerald-500'
                                : pm.method === 'cash'
                                ? 'bg-amber-500'
                                : pm.method === 'bank'
                                ? 'bg-indigo-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, Number(pm.percentage)))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">ETR Invoiced Sales:</span>
                      <span className="font-mono font-bold text-slate-900">
                        KES {Number(salesSummary.etr_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Non-ETR Sales:</span>
                      <span className="font-mono font-bold text-slate-900">
                        KES {Number(salesSummary.non_etr_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-rose-600">
                      <span>Outstanding Receivables (Credit):</span>
                      <span className="font-mono">
                        KES {Number(salesSummary.total_outstanding_credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fast-Moving Inventory Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Top 10 Fast-Moving Products</h3>
                <p className="text-xs text-slate-500">Ranked by sales velocity and turnover contribution</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Rank</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Units Sold</th>
                    <th className="p-3 text-right">Revenue Generated</th>
                    <th className="p-3 text-right">Gross Profit Contribution</th>
                    <th className="p-3 text-right">Stock on Hand</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {fastMoving.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No sales transaction records to compute product velocity.
                      </td>
                    </tr>
                  ) : (
                    fastMoving.map((p, idx) => (
                      <tr key={p.product_id} className="hover:bg-slate-50/80">
                        <td className="p-3 font-bold text-slate-400">#{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">
                          {p.product_name} {p.sku ? <span className="font-mono text-slate-400 font-normal text-[11px]">({p.sku})</span> : ''}
                        </td>
                        <td className="p-3 text-slate-500">{p.category_name || 'General'}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">{Number(p.total_units_sold)}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          KES {Number(p.total_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-600">
                          +KES {Number(p.total_profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-600">{Number(p.stock_on_hand)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
