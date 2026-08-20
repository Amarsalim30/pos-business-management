import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
import type { NetProfitStatement, FastMovingProductItem, SalesReportSummary, Sale } from '../types';
import { InvoiceDrawer } from '../components/InvoiceDrawer';
import {
  BarChart3,
  Loader2,
  Printer,
  Calendar,
  ArrowUpRight,
  TrendingUp,
  Download,
  Eye,
  X,
  ShieldAlert,
  Receipt,
  ShoppingCart,
  DollarSign
} from 'lucide-react';

interface DrilldownState {
  title: string;
  subtitle: string;
  metricKey: 'sales' | 'cogs' | 'discounts' | 'credit' | 'etr' | 'non_etr';
  statusFilter?: string;
  isEtr?: boolean;
}

export const ReportsPage: React.FC = () => {
  const { hasPermission, isOwner } = usePermissions();
  const canViewNetProfit = isOwner || hasPermission('reports:view_net_profit');
  const canViewSales = isOwner || hasPermission('reports:view_sales') || hasPermission('pos:sell');

  const [period, setPeriod] = useState<'today' | 'yesterday' | '7days' | 'month' | 'last_month' | 'custom'>('month');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  
  const [statement, setStatement] = useState<NetProfitStatement | null>(null);
  const [fastMoving, setFastMoving] = useState<FastMovingProductItem[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesReportSummary | null>(null);
  const [loading, setLoading] = useState(false);

  // Drilldown Modal State
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);
  const [drilldownSales, setDrilldownSales] = useState<Sale[]>([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  // Invoice Drawer State
  const [selectedSaleForDrawer, setSelectedSaleForDrawer] = useState<Sale | null>(null);
  const [drawerFormat, setDrawerFormat] = useState<'a4' | 'thermal'>('a4');

  useEffect(() => {
    if (canViewNetProfit || canViewSales) {
      loadReports();
    }
  }, [period, customDateFrom, customDateTo, canViewNetProfit, canViewSales]);

  const getDateRange = () => {
    const now = new Date();
    let dateFrom = '';
    let dateTo = '';

    if (period === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFrom = startOfDay.toISOString();
    } else if (period === 'yesterday') {
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      dateFrom = startOfYesterday.toISOString();
      dateTo = endOfYesterday.toISOString();
    } else if (period === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      dateFrom = d.toISOString();
    } else if (period === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFrom = startOfMonth.toISOString();
    } else if (period === 'last_month') {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      dateFrom = startOfLastMonth.toISOString();
      dateTo = endOfLastMonth.toISOString();
    } else if (period === 'custom') {
      if (customDateFrom) {
        dateFrom = new Date(customDateFrom).toISOString();
      }
      if (customDateTo) {
        const endOfDay = new Date(customDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        dateTo = endOfDay.toISOString();
      }
    }

    return { dateFrom, dateTo };
  };

  const loadReports = async () => {
    setLoading(true);
    try {
      const { dateFrom, dateTo } = getDateRange();

      let netUrl = '/api/v1/reports/net-profit';
      let fastUrl = '/api/v1/reports/fast-moving?limit=10';
      let salesUrl = '/api/v1/reports/sales-summary';

      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const qs = params.toString();
      if (qs) {
        netUrl += `?${qs}`;
        fastUrl += `&${qs}`;
        salesUrl += `?${qs}`;
      }

      const promises: Promise<any>[] = [];
      if (canViewNetProfit) {
        promises.push(apiFetch<NetProfitStatement>(netUrl));
      } else {
        promises.push(Promise.resolve(null));
      }

      if (canViewSales) {
        promises.push(apiFetch<FastMovingProductItem[]>(fastUrl));
        promises.push(apiFetch<SalesReportSummary>(salesUrl));
      } else {
        promises.push(Promise.resolve([]));
        promises.push(Promise.resolve(null));
      }

      const [netData, fastData, salesData] = await Promise.all(promises);

      setStatement(netData);
      setFastMoving(fastData || []);
      setSalesSummary(salesData);
    } catch (e) {
      console.error('Failed to load reports', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDrilldown = async (config: DrilldownState) => {
    setDrilldown(config);
    setDrilldownLoading(true);
    setDrilldownSales([]);

    try {
      const { dateFrom, dateTo } = getDateRange();
      let url = `/api/v1/sales/?limit=100`;

      if (dateFrom) url += `&date_from=${encodeURIComponent(dateFrom)}`;
      if (dateTo) url += `&date_to=${encodeURIComponent(dateTo)}`;

      if (config.statusFilter && config.statusFilter !== 'all') {
        url += `&status_filter=${config.statusFilter}`;
      }
      if (config.isEtr !== undefined) {
        url += `&is_etr=${config.isEtr}`;
      }

      const data = await apiFetch<Sale[]>(url);
      setDrilldownSales(data);
    } catch (err) {
      console.error('Failed to load drilldown sales', err);
    } finally {
      setDrilldownLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const exportSummaryCSV = () => {
    if (!statement) return;
    const lines = [
      ['Metric', 'Amount (KES)'],
      ['Gross Sales Revenue', statement.gross_sales_revenue],
      ['Less VAT (16% Extracted)', statement.tax_amount],
      ['Less Discounts Allowed', statement.discount_amount],
      ['Net Sales Revenue', statement.net_sales_revenue],
      ['Cost of Goods Sold (COGS)', statement.cost_of_goods_sold],
      ['Gross Trading Profit', statement.gross_profit],
      ['Gross Margin %', `${Number(statement.gross_margin_percentage).toFixed(1)}%`],
      ['Purchasing Logistics & Labour', statement.purchase_expenses],
      ['Recurring Rent & Payroll', statement.recurring_expenses],
      ['Petty Cash Outflows', statement.petty_cash_expenses],
      ['Total Operating Expenses', statement.total_operating_expenses],
      ['Solar Installations Net Profit', statement.project_net_profit],
      ['M-Pesa Agent Commissions', statement.mpesa_commission_income],
      ['Final Store Net Profit', statement.net_profit]
    ];
    const csvContent = lines.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `financial_report_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!canViewNetProfit && !canViewSales) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs max-w-md mx-auto my-12">
        <div className="p-3.5 bg-rose-50 text-rose-600 rounded-2xl w-12 h-12 flex items-center justify-center mx-auto mb-3 border border-rose-100">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h3 className="text-base font-black text-slate-900">Reports Access Restricted</h3>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
          Your account does not have permission to view financial statements or sales analytics. Contact the store owner to request permission.
        </p>
      </div>
    );
  }

  return (
    <div id="executive-report-container" className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
              <BarChart3 className="h-6 w-6" />
            </div>
            <span>
              {canViewNetProfit
                ? 'Owner Profit Statement & Financial Intelligence'
                : 'Sales Analytics & ETR Performance Reports'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {canViewNetProfit
              ? 'Interactive auditable P&L statement, sales velocity, and click-to-drilldown transaction ledger'
              : 'Daily sales turnover, tax register metrics, payment distribution, and fast-moving inventory'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Selector Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: '7 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'custom', label: 'Custom' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  period === p.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {canViewNetProfit && (
            <button
              onClick={exportSummaryCSV}
              disabled={!statement}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer shadow-xs disabled:opacity-50"
              title="Export Statement to CSV"
            >
              <Download className="h-4 w-4 text-slate-500" />
              <span>CSV</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 rounded-xl text-xs font-bold text-white cursor-pointer shadow-xs"
            title="Print Executive Statement"
          >
            <Printer className="h-4 w-4 text-slate-300" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {period === 'custom' && (
        <div className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs text-xs print:hidden animate-in fade-in duration-150">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-amber-600" /> Custom Range:
          </span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customDateFrom}
              onChange={(e) => setCustomDateFrom(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-mono focus:border-amber-600 focus:outline-none"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={customDateTo}
              onChange={(e) => setCustomDateTo(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-mono focus:border-amber-600 focus:outline-none"
            />
          </div>
        </div>
      )}

      {loading && (!statement && !salesSummary) ? (
        <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2">
          <Loader2 className="h-8 w-8 mx-auto text-emerald-600 animate-spin" />
          <p className="text-xs">Computing report analytics...</p>
        </div>
      ) : (
        <div id="executive-report-container" className="space-y-6">
          {/* Printable Report Header (Print Only) */}
          <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-black uppercase text-slate-900">SOLAR & ELECTRICAL HARDWARE SUPPLIES</h1>
                <p className="text-xs text-slate-600">Executive Performance & Sales Statement</p>
              </div>
              <div className="text-right text-xs font-mono">
                <div>Period: {period.toUpperCase()}</div>
                <div>Generated: {new Date().toLocaleString('en-GB')}</div>
              </div>
            </div>
          </div>

          {/* Top KPI Cards (Net Profit Version vs Sales Overview Version) */}
          {canViewNetProfit ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Gross Revenue */}
              <div
                onClick={() => handleOpenDrilldown({
                  title: 'Gross Sales Invoices',
                  subtitle: 'All completed customer transactions for the selected period',
                  metricKey: 'sales'
                })}
                className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-amber-500 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
              >
                <div className="flex justify-between items-start">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Sales Revenue</div>
                  <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-amber-600 transition-colors" />
                </div>
                <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                  KES {Number(statement?.gross_sales_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-amber-600 font-semibold mt-1 flex items-center gap-1">
                  <span>Click to drill down invoices</span>
                </div>
              </div>

              {/* Cost of Goods Sold */}
              <div
                onClick={() => handleOpenDrilldown({
                  title: 'Cost of Goods Sold (COGS)',
                  subtitle: 'Inventory cost price snapshot for sold items',
                  metricKey: 'cogs'
                })}
                className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
              >
                <div className="flex justify-between items-start">
                  <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Cost of Goods Sold</div>
                  <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                </div>
                <div className="text-2xl font-black text-indigo-700 mt-2 font-mono">
                  KES {Number(statement?.cost_of_goods_sold || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-indigo-600 font-semibold mt-1">
                  Inventory buying cost (BP)
                </div>
              </div>

              {/* Gross Margin % */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">Gross Margin %</div>
                <div className="text-2xl font-black text-blue-700 mt-2 font-mono">
                  {Number(statement?.gross_margin_percentage || 0).toFixed(1)}%
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Gross trading profit ratio
                </div>
              </div>

              {/* Net Profit */}
              <div className="bg-emerald-50/90 p-5 rounded-2xl border border-emerald-200 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Store Net Profit</div>
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-700 mt-2 font-mono">
                  KES {Number(statement?.net_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-emerald-700/90 font-medium mt-1">
                  True bottom-line business earnings
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Sales Revenue */}
              <div
                onClick={() => handleOpenDrilldown({
                  title: 'All Invoiced Sales',
                  subtitle: 'Completed transactions for the period',
                  metricKey: 'sales'
                })}
                className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-amber-500 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sales Revenue</div>
                  <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-amber-600" />
                </div>
                <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                  KES {Number(salesSummary?.total_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-amber-600 font-semibold mt-1">
                  {salesSummary?.total_transactions || 0} Invoices Ringed Up
                </div>
              </div>

              {/* ETR Invoiced Revenue */}
              <div
                onClick={() => handleOpenDrilldown({
                  title: 'ETR Invoiced Sales',
                  subtitle: 'Official tax register transactions',
                  metricKey: 'etr',
                  isEtr: true
                })}
                className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start">
                  <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">ETR Invoices</div>
                  <Receipt className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-700 mt-2 font-mono">
                  KES {Number(salesSummary?.etr_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-emerald-600 font-semibold mt-1">
                  Official fiscal receipts
                </div>
              </div>

              {/* Non-ETR Invoiced Revenue */}
              <div
                onClick={() => handleOpenDrilldown({
                  title: 'Non-ETR Sales',
                  subtitle: 'Standard counter transactions',
                  metricKey: 'non_etr',
                  isEtr: false
                })}
                className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-400 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Non-ETR Sales</div>
                  <ShoppingCart className="h-4 w-4 text-slate-400" />
                </div>
                <div className="text-2xl font-black text-slate-800 mt-2 font-mono">
                  KES {Number(salesSummary?.non_etr_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">
                  Standard counter tickets
                </div>
              </div>

              {/* Outstanding Debtors */}
              <div
                onClick={() => handleOpenDrilldown({
                  title: 'Customer Debt Balances',
                  subtitle: 'Unpaid and partially settled invoices',
                  metricKey: 'credit',
                  statusFilter: 'unpaid'
                })}
                className="bg-rose-50/70 p-5 rounded-2xl border border-rose-200 hover:border-rose-400 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start">
                  <div className="text-xs font-bold text-rose-800 uppercase tracking-wider">Outstanding Debt</div>
                  <DollarSign className="h-4 w-4 text-rose-600" />
                </div>
                <div className="text-2xl font-black text-rose-700 mt-2 font-mono">
                  KES {Number(salesSummary?.total_outstanding_credit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-rose-700 font-medium mt-1">
                  Pending customer receivables
                </div>
              </div>
            </div>
          )}

          {/* Detailed Statement Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {canViewNetProfit && statement ? (
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Auditable Net Profit Waterfall Statement</h3>
                    <p className="text-xs text-slate-500">Itemized revenue, COGS, operating costs, and secondary streams</p>
                  </div>
                  <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-lg uppercase">
                    {period}
                  </span>
                </div>

                <div className="space-y-4 text-xs">
                  {/* 1. Sales Revenue */}
                  <div className="space-y-1.5 bg-slate-50/80 p-4 rounded-xl border border-slate-200/60">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">1. Sales Trading Revenue</span>
                      <button
                        onClick={() => handleOpenDrilldown({
                          title: 'All Invoices (Trading Revenue)',
                          subtitle: 'Every transaction contributing to gross revenue',
                          metricKey: 'sales'
                        })}
                        className="text-[11px] text-amber-600 font-bold hover:underline flex items-center gap-0.5 print:hidden cursor-pointer"
                      >
                        <span>Drilldown</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Gross Sales Invoices</span>
                      <span className="font-mono font-semibold">KES {Number(statement.gross_sales_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Less VAT Tax Extracted (16%)</span>
                      <span className="font-mono">- KES {Number(statement.tax_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div
                      onClick={() => handleOpenDrilldown({
                        title: 'Discounted Transactions',
                        subtitle: 'Invoices where cashier granted discounts',
                        metricKey: 'discounts'
                      })}
                      className="flex justify-between text-rose-600 font-medium hover:bg-rose-50 p-1 rounded transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1">Less Discounts Allowed <ArrowUpRight className="h-3 w-3 print:hidden" /></span>
                      <span className="font-mono">- KES {Number(statement.discount_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-900">
                      <span>Net Sales Revenue</span>
                      <span className="font-mono">KES {Number(statement.net_sales_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* 2. COGS & Gross Trading Margin */}
                  <div className="space-y-1.5 bg-indigo-50/40 p-4 rounded-xl border border-indigo-100">
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

                  {/* 3. Operating Overheads */}
                  <div className="space-y-1.5 bg-rose-50/30 p-4 rounded-xl border border-rose-100">
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

                  {/* 4. Other Business Incomes */}
                  <div className="space-y-1.5 bg-blue-50/30 p-4 rounded-xl border border-blue-100">
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
                  <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between shadow-md">
                    <div>
                      <div className="text-xs uppercase font-bold text-slate-400 tracking-wider">Final Store Net Profit</div>
                      <div className="text-xs text-slate-300">Auditable bottom-line earnings</div>
                    </div>
                    <div className="text-xl font-black font-mono text-emerald-400">
                      KES {Number(statement.net_profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Payment Distribution Card */}
            <div className={`space-y-6 ${canViewNetProfit ? 'lg:col-span-1' : 'lg:col-span-3'}`}>
              {salesSummary && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">Payment Tender Distribution</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
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
                    <div
                      onClick={() => handleOpenDrilldown({
                        title: 'ETR Invoiced Sales',
                        subtitle: 'Official tax register transactions',
                        metricKey: 'etr',
                        isEtr: true
                      })}
                      className="flex justify-between hover:bg-slate-50 p-1.5 rounded transition-colors cursor-pointer"
                    >
                      <span className="text-slate-600 flex items-center gap-1 font-medium">
                        ETR Invoiced Sales <ArrowUpRight className="h-3 w-3 text-slate-400 print:hidden" />
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        KES {Number(salesSummary.etr_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div
                      onClick={() => handleOpenDrilldown({
                        title: 'Non-ETR Sales',
                        subtitle: 'Standard retail sales',
                        metricKey: 'non_etr',
                        isEtr: false
                      })}
                      className="flex justify-between hover:bg-slate-50 p-1.5 rounded transition-colors cursor-pointer"
                    >
                      <span className="text-slate-600 flex items-center gap-1 font-medium">
                        Non-ETR Sales <ArrowUpRight className="h-3 w-3 text-slate-400 print:hidden" />
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        KES {Number(salesSummary.non_etr_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div
                      onClick={() => handleOpenDrilldown({
                        title: 'Outstanding Customer Credit / Debt',
                        subtitle: 'Unpaid and partially paid invoices awaiting settlement',
                        metricKey: 'credit',
                        statusFilter: 'unpaid'
                      })}
                      className="flex justify-between border-t border-slate-100 pt-2 font-bold text-rose-600 hover:bg-rose-50 p-1.5 rounded transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1">
                        Outstanding Credit (Debtors) <ArrowUpRight className="h-3 w-3 print:hidden" />
                      </span>
                      <span className="font-mono">
                        KES {Number(salesSummary.total_outstanding_credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top 10 Fast-Moving Products Matrix */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Top 10 Fast-Moving Products & Velocity</h3>
                <p className="text-xs text-slate-500">Ranked by sales velocity and gross margin contribution</p>
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
                    <th className="p-3 text-right">Gross Profit</th>
                    <th className="p-3 text-right">Stock on Hand</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {fastMoving.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No sales transaction records found to compute velocity.
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
        </div>
      )}

      {/* Interactive Drilldown Drawer Modal */}
      {drilldown && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div
            onClick={() => setDrilldown(null)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
          />

          <div className="relative w-screen max-w-3xl bg-white shadow-2xl z-10 flex flex-col h-full animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">{drilldown.title}</h3>
                <p className="text-xs text-slate-400">{drilldown.subtitle}</p>
              </div>
              <button
                onClick={() => setDrilldown(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Content Table */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {drilldownLoading ? (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-600 mx-auto" />
                  <p className="text-xs">Loading underlying invoices...</p>
                </div>
              ) : drilldownSales.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No matching transaction records for this drilldown category.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                      <tr>
                        <th className="p-3">Invoice No</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3 text-right">Total (KES)</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">View</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {drilldownSales.map((s) => (
                        <tr
                          key={s.id}
                          onClick={() => {
                            setSelectedSaleForDrawer(s);
                            setDrawerFormat('a4');
                          }}
                          className="hover:bg-amber-50/40 transition-colors cursor-pointer"
                        >
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {s.invoice_no}
                          </td>
                          <td className="p-3 text-slate-500 font-mono text-[11px]">
                            {new Date(s.created_at).toLocaleDateString('en-GB')}
                          </td>
                          <td className="p-3 text-slate-800 font-medium">
                            {s.customer_name || 'Walk-in'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">
                            KES {Number(s.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              s.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-700'
                                : s.status === 'partial'
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-rose-50 text-rose-700'
                            }`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSaleForDrawer(s);
                                setDrawerFormat('a4');
                              }}
                              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unified Document Drawer */}
      <InvoiceDrawer
        sale={selectedSaleForDrawer}
        isOpen={!!selectedSaleForDrawer}
        defaultFormat={drawerFormat}
        onClose={() => setSelectedSaleForDrawer(null)}
      />
    </div>
  );
};
