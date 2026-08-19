import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../services/api';
import type {
  PettyCashEntry,
  PettyCashSummary,
  BankAccount,
  BankTransaction,
  BankAccountDetail,
  MpesaIncome,
  AccountsOverview
} from '../types';
import {
  Wallet,
  Building2,
  Smartphone,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  Loader2
} from 'lucide-react';


export const AccountsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab = (tabParam === 'mpesa' || tabParam === 'banks' || tabParam === 'petty_cash') ? tabParam : 'petty_cash';
  const [activeTab, setActiveTab] = useState<'petty_cash' | 'banks' | 'mpesa'>(initialTab);

  useEffect(() => {
    if (tabParam && (tabParam === 'mpesa' || tabParam === 'banks' || tabParam === 'petty_cash')) {
      if (tabParam !== activeTab) {
        setActiveTab(tabParam);
      }
    }
  }, [tabParam]);

  const handleTabChange = (tab: 'petty_cash' | 'banks' | 'mpesa') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };
  const [overview, setOverview] = useState<AccountsOverview | null>(null);

  // Petty Cash State
  const [pettyEntries, setPettyEntries] = useState<PettyCashEntry[]>([]);
  const [pettySummary, setPettySummary] = useState<PettyCashSummary | null>(null);
  const [pettyLoading, setPettyLoading] = useState(false);
  const [pettyTypeFilter, setPettyTypeFilter] = useState('all');
  const [pettyCategoryFilter, setPettyCategoryFilter] = useState('all');
  const [isPettyModalOpen, setIsPettyModalOpen] = useState(false);
  const [pettyType, setPettyType] = useState<'in' | 'out'>('out');
  const [pettyAmount, setPettyAmount] = useState('');
  const [pettyCategory, setPettyCategory] = useState('tea_snacks');
  const [pettyDesc, setPettyDesc] = useState('');
  const [pettyReceipt, setPettyReceipt] = useState('');
  const [savingPetty, setSavingPetty] = useState(false);
  const [pettyError, setPettyError] = useState<string | null>(null);

  // Bank Accounts State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
  const [selectedBankDetail, setSelectedBankDetail] = useState<BankAccountDetail | null>(null);
  const [isNewBankModalOpen, setIsNewBankModalOpen] = useState(false);
  const [bankName, setBankName] = useState('');
  const [bankInstitution, setBankInstitution] = useState('Kenya Commercial Bank');
  const [bankAccNumber, setBankAccNumber] = useState('');
  const [bankInitialBal, setBankInitialBal] = useState('');
  const [savingBank, setSavingBank] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);


  // Bank Transaction Modal State
  const [isBankTxModalOpen, setIsBankTxModalOpen] = useState(false);
  const [txBankId, setTxBankId] = useState<number | ''>('');
  const [txType, setTxType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [txRef, setTxRef] = useState('');
  const [savingTx, setSavingTx] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  // M-Pesa Income State
  const [mpesaIncomes, setMpesaIncomes] = useState<MpesaIncome[]>([]);
  const [mpesaLoading, setMpesaLoading] = useState(false);
  const [isMpesaModalOpen, setIsMpesaModalOpen] = useState(false);
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [mpesaDesc, setMpesaDesc] = useState('');
  const [mpesaRef, setMpesaRef] = useState('');
  const [savingMpesa, setSavingMpesa] = useState(false);
  const [mpesaError, setMpesaError] = useState<string | null>(null);

  useEffect(() => {
    loadOverview();
    if (activeTab === 'petty_cash') loadPettyCash();
    if (activeTab === 'banks') loadBankAccounts();
    if (activeTab === 'mpesa') loadMpesaIncomes();
  }, [activeTab, pettyTypeFilter, pettyCategoryFilter]);

  const loadOverview = async () => {
    try {
      const data = await apiFetch<AccountsOverview>('/api/v1/accounts/overview');
      setOverview(data);
    } catch (e) {
      console.error('Failed to load accounts overview', e);
    }
  };

  const loadPettyCash = async () => {
    setPettyLoading(true);
    try {
      let url = '/api/v1/accounts/petty-cash?limit=50';
      if (pettyTypeFilter !== 'all') url += `&type=${pettyTypeFilter}`;
      if (pettyCategoryFilter !== 'all') url += `&category=${pettyCategoryFilter}`;
      const [entries, sum] = await Promise.all([
        apiFetch<PettyCashEntry[]>(url),
        apiFetch<PettyCashSummary>('/api/v1/accounts/petty-cash/summary')
      ]);
      setPettyEntries(entries);
      setPettySummary(sum);
    } catch (e) {
      console.error('Failed to load petty cash', e);
    } finally {
      setPettyLoading(false);
    }
  };

  const loadBankAccounts = async () => {
    try {
      const data = await apiFetch<BankAccount[]>('/api/v1/accounts/bank-accounts');

      setBankAccounts(data);
      if (data.length > 0 && !selectedBankId) {
        loadBankDetail(data[0].id);
      }
    } catch (e) {
      console.error('Failed to load bank accounts', e);
    }
  };


  const loadBankDetail = async (id: number) => {
    setSelectedBankId(id);
    try {
      const detail = await apiFetch<BankAccountDetail>(`/api/v1/accounts/bank-accounts/${id}`);
      setSelectedBankDetail(detail);
    } catch (e) {
      console.error('Failed to load bank details', e);
    }
  };

  const loadMpesaIncomes = async () => {
    setMpesaLoading(true);
    try {
      const data = await apiFetch<MpesaIncome[]>('/api/v1/accounts/mpesa-income?limit=50');
      setMpesaIncomes(data);
    } catch (e) {
      console.error('Failed to load mpesa incomes', e);
    } finally {
      setMpesaLoading(false);
    }
  };

  const handleSavePettyCash = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(pettyAmount);
    if (!amt || amt <= 0 || !pettyDesc.trim()) return;

    setSavingPetty(true);
    setPettyError(null);
    try {
      await apiFetch('/api/v1/accounts/petty-cash', {
        method: 'POST',
        body: JSON.stringify({
          description: pettyDesc.trim(),
          amount: amt,
          type: pettyType,
          category: pettyType === 'in' ? 'float_deposit' : pettyCategory,
          receipt_no: pettyReceipt.trim() || null
        })
      });
      setIsPettyModalOpen(false);
      setPettyAmount('');
      setPettyDesc('');
      setPettyReceipt('');
      loadPettyCash();
      loadOverview();
    } catch (err: any) {
      setPettyError(err.message || 'Failed to record petty cash entry');
    } finally {
      setSavingPetty(false);
    }
  };

  const handleSaveBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim() || !bankAccNumber.trim()) return;

    setSavingBank(true);
    setBankError(null);
    try {
      const created = await apiFetch<BankAccount>('/api/v1/accounts/bank-accounts', {
        method: 'POST',
        body: JSON.stringify({
          name: bankName.trim(),
          bank_name: bankInstitution.trim(),
          account_number: bankAccNumber.trim(),
          initial_balance: parseFloat(bankInitialBal) || 0
        })
      });
      setIsNewBankModalOpen(false);
      setBankName('');
      setBankAccNumber('');
      setBankInitialBal('');
      loadBankAccounts();
      loadOverview();
      loadBankDetail(created.id);
    } catch (err: any) {
      setBankError(err.message || 'Failed to create bank account');
    } finally {
      setSavingBank(false);
    }
  };

  const handleSaveBankTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txBankId) return;
    const amt = parseFloat(txAmount);
    if (!amt || amt <= 0 || !txDesc.trim()) return;

    setSavingTx(true);
    setTxError(null);
    try {
      await apiFetch(`/api/v1/accounts/bank-accounts/${txBankId}/transactions`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          type: txType,
          description: txDesc.trim(),
          reference: txRef.trim() || null
        })
      });
      setIsBankTxModalOpen(false);
      setTxAmount('');
      setTxDesc('');
      setTxRef('');
      loadBankAccounts();
      loadOverview();
      if (selectedBankId === txBankId) loadBankDetail(txBankId);
    } catch (err: any) {
      setTxError(err.message || 'Failed to record bank transaction');
    } finally {
      setSavingTx(false);
    }
  };

  const handleSaveMpesaIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(mpesaAmount);
    if (!amt || amt <= 0 || !mpesaDesc.trim()) return;

    setSavingMpesa(true);
    setMpesaError(null);
    try {
      await apiFetch('/api/v1/accounts/mpesa-income', {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          description: mpesaDesc.trim(),
          reference: mpesaRef.trim() || null
        })
      });
      setIsMpesaModalOpen(false);
      setMpesaAmount('');
      setMpesaDesc('');
      setMpesaRef('');
      loadMpesaIncomes();
      loadOverview();
    } catch (err: any) {
      setMpesaError(err.message || 'Failed to record M-Pesa income');
    } finally {
      setSavingMpesa(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
              <Wallet className="h-6 w-6" />
            </div>
            Financial Accounts & Petty Cash
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Manage store petty cash float, bank account deposits/withdrawals, and M-Pesa agent commission logs
          </p>
        </div>

        {/* Global Overview Pill Badges */}
        {overview && (
          <div className="flex items-center gap-2">
            <div className="bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold">
              Petty Cash: <span className="font-mono font-bold text-slate-900">KES {Number(overview.petty_cash_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold">
              Bank Total: <span className="font-mono font-bold text-indigo-600">KES {Number(overview.total_bank_balances).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => handleTabChange('petty_cash')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'petty_cash'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Wallet className="h-4 w-4" />
          <span>Petty Cash Book</span>
        </button>

        <button
          onClick={() => handleTabChange('banks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'banks'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Bank Accounts ({bankAccounts.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('mpesa')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'mpesa'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Smartphone className="h-4 w-4 text-emerald-500" />
          <span>M-Pesa Commission Income</span>
        </button>
      </div>

      {/* Tab 1: Petty Cash */}
      {activeTab === 'petty_cash' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Float Balance</div>
              <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                KES {Number(pettySummary ? pettySummary.balance : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">Cash on hand in petty drawer</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Total Cash In (Deposits)</div>
              <div className="text-2xl font-black text-emerald-600 mt-2 font-mono">
                KES {Number(pettySummary ? pettySummary.total_in : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">Float top-ups & replenish funds</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-xs font-bold text-rose-600 uppercase tracking-wider">Total Cash Out (Expenses)</div>
              <div className="text-2xl font-black text-rose-600 mt-2 font-mono">
                KES {Number(pettySummary ? pettySummary.total_out : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-slate-400 mt-1">Vouchers & store incidentals</div>
            </div>
          </div>

          {/* Action & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={pettyTypeFilter}
                onChange={(e) => setPettyTypeFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none"
              >
                <option value="all">All In/Out Types</option>
                <option value="in">Cash In (Float Top-up)</option>
                <option value="out">Cash Out (Expense)</option>
              </select>

              <select
                value={pettyCategoryFilter}
                onChange={(e) => setPettyCategoryFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="tea_snacks">Tea & Snacks</option>
                <option value="office">Office Supplies</option>
                <option value="transport">Transport & Fare</option>
                <option value="cleaning">Cleaning</option>
                <option value="repairs">Repairs & Maintenance</option>
                <option value="float_deposit">Float Replenishment</option>
                <option value="general">General</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setPettyType('in');
                  setIsPettyModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                <ArrowDownLeft className="h-3.5 w-3.5" />
                <span>+ Top Up Float</span>
              </button>

              <button
                onClick={() => {
                  setPettyType('out');
                  setIsPettyModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Record Expense Out</span>
              </button>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="max-h-[calc(100vh-420px)] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Receipt / Ref</th>
                    <th className="p-3">Logged By</th>
                    <th className="p-3 text-right">Amount (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {pettyLoading && pettyEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-1" />
                        Loading petty cash ledger...
                      </td>
                    </tr>
                  ) : pettyEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No petty cash entries found.
                      </td>
                    </tr>
                  ) : (
                    pettyEntries.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/80">
                        <td className="p-3 text-slate-500 font-mono">{new Date(e.date).toLocaleDateString()}</td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                              e.type === 'in'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {e.type === 'in' ? 'Cash In' : 'Cash Out'}
                          </span>
                        </td>
                        <td className="p-3 capitalize font-semibold text-slate-700">{e.category?.replace('_', ' ') || '—'}</td>
                        <td className="p-3 text-slate-900 font-semibold">{e.description}</td>
                        <td className="p-3 text-slate-500">{e.receipt_no || '—'}</td>
                        <td className="p-3 text-slate-500">{e.user_name || 'Staff'}</td>
                        <td
                          className={`p-3 text-right font-mono font-bold ${
                            e.type === 'in' ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {e.type === 'in' ? '+' : '-'}KES {Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Bank Accounts */}
      {activeTab === 'banks' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left: Accounts List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Bank Accounts</h3>
              <button
                onClick={() => setIsNewBankModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Bank
              </button>
            </div>

            <div className="space-y-3">
              {bankAccounts.map((acc) => (
                <div
                  key={acc.id}
                  onClick={() => loadBankDetail(acc.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    selectedBankId === acc.id
                      ? 'bg-indigo-50/50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-900 text-sm">{acc.name}</div>
                    <span className="text-xs font-medium text-slate-500">{acc.bank_name}</span>
                  </div>
                  <div className="text-xs font-mono text-slate-400 mt-1">Acc: {acc.account_number}</div>
                  <div className="text-base font-black text-slate-900 font-mono mt-3">
                    KES {Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Selected Account Ledger */}
          <div className="md:col-span-2 space-y-4">
            {selectedBankDetail ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{selectedBankDetail.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">
                      {selectedBankDetail.bank_name} • Account #{selectedBankDetail.account_number}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setTxBankId(selectedBankDetail.id);
                        setTxType('deposit');
                        setIsBankTxModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowDownLeft className="h-3.5 w-3.5" />
                      Deposit
                    </button>

                    <button
                      onClick={() => {
                        setTxBankId(selectedBankDetail.id);
                        setTxType('withdrawal');
                        setIsBankTxModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Withdrawal
                    </button>
                  </div>
                </div>

                {/* Account Transactions Ledger */}
                <div className="max-h-[calc(100vh-420px)] overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Reference</th>
                        <th className="p-3 text-right">Amount (KES)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {selectedBankDetail.transactions?.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400">
                            No transactions recorded for this bank account yet.
                          </td>
                        </tr>
                      ) : (
                        selectedBankDetail.transactions?.map((t: BankTransaction) => (
                          <tr key={t.id} className="hover:bg-slate-50/80">

                            <td className="p-3 text-slate-500 font-mono">{new Date(t.date).toLocaleDateString()}</td>
                            <td className="p-3 capitalize font-bold">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  t.type === 'deposit' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {t.type}
                              </span>
                            </td>
                            <td className="p-3 text-slate-900 font-semibold">{t.description}</td>
                            <td className="p-3 text-slate-500">{t.reference || '—'}</td>
                            <td
                              className={`p-3 text-right font-mono font-bold ${
                                t.type === 'deposit' ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {t.type === 'deposit' ? '+' : '-'}KES {Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
                Select a bank account to view statement ledger.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: M-Pesa Commissions */}
      {activeTab === 'mpesa' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-900">M-Pesa Agent Commission Records</h3>
              <p className="text-xs text-slate-500">Log monthly Safaricom commission earnings</p>
            </div>
            <button
              onClick={() => setIsMpesaModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Log M-Pesa Income
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="max-h-[calc(100vh-420px)] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Reference / Period</th>
                    <th className="p-3">Recorded By</th>
                    <th className="p-3 text-right">Commission Amount (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {mpesaLoading && mpesaIncomes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        Loading M-Pesa commission ledger...
                      </td>
                    </tr>
                  ) : mpesaIncomes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        No M-Pesa commission records logged yet.
                      </td>
                    </tr>
                  ) : (
                    mpesaIncomes.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/80">
                        <td className="p-3 text-slate-500 font-mono">{new Date(m.date).toLocaleDateString()}</td>
                        <td className="p-3 text-slate-900 font-semibold">{m.description}</td>
                        <td className="p-3 text-slate-500">{m.reference || '—'}</td>
                        <td className="p-3 text-slate-500">{m.user_name || 'Staff'}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-600">
                          +KES {Number(m.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Petty Cash Modal */}
      {isPettyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {pettyType === 'in' ? 'Top Up Petty Cash Float' : 'Record Petty Cash Expense'}
              </h3>
              <button onClick={() => setIsPettyModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePettyCash} className="mt-4 space-y-3">
              {pettyError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {pettyError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Amount (KES) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 1500"
                  value={pettyAmount}
                  onChange={(e) => setPettyAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono focus:bg-white focus:outline-none"
                />
              </div>

              {pettyType === 'out' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Expense Category</label>
                  <select
                    value={pettyCategory}
                    onChange={(e) => setPettyCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                  >
                    <option value="tea_snacks">Tea & Snacks</option>
                    <option value="office">Office Supplies / Stationery</option>
                    <option value="transport">Transport / Fare / Delivery</option>
                    <option value="cleaning">Cleaning Supplies</option>
                    <option value="repairs">Small Repairs</option>
                    <option value="general">General Expense</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Description *</label>
                <input
                  type="text"
                  required
                  placeholder={pettyType === 'in' ? 'e.g. Weekly float replenishment' : 'e.g. Milk and coffee for staff'}
                  value={pettyDesc}
                  onChange={(e) => setPettyDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Receipt / Voucher Number</label>
                <input
                  type="text"
                  placeholder="e.g. VOUCH-0091"
                  value={pettyReceipt}
                  onChange={(e) => setPettyReceipt(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsPettyModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPetty}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingPetty && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Bank Account Modal */}
      {isNewBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add New Bank Account</h3>
              <button onClick={() => setIsNewBankModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBankAccount} className="mt-4 space-y-3">
              {bankError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {bankError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Account Nickname *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KCB Operations Account"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Bank Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kenya Commercial Bank / Equity / NCBA"
                  value={bankInstitution}
                  onChange={(e) => setBankInstitution(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Account Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1234567890"
                  value={bankAccNumber}
                  onChange={(e) => setBankAccNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Initial Balance (KES)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 50000"
                  value={bankInitialBal}
                  onChange={(e) => setBankInitialBal(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewBankModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBank}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingBank && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Bank Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bank Transaction Modal */}
      {isBankTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Record Bank {txType === 'deposit' ? 'Deposit' : 'Withdrawal'}
              </h3>
              <button onClick={() => setIsBankTxModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBankTx} className="mt-4 space-y-3">
              {txError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {txError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Transaction Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTxType('deposit')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      txType === 'deposit' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    Deposit (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxType('withdrawal')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      txType === 'withdrawal' ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    Withdrawal (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Amount (KES) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 25000"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Daily cash sales banked at branch"
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Bank / Slip Reference</label>
                <input
                  type="text"
                  placeholder="e.g. SLIP-998811"
                  value={txRef}
                  onChange={(e) => setTxRef(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsBankTxModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTx}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingTx && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* M-Pesa Income Modal */}
      {isMpesaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Log M-Pesa Commission Income</h3>
              <button onClick={() => setIsMpesaModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMpesaIncome} className="mt-4 space-y-3">
              {mpesaError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {mpesaError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Commission Amount (KES) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 14500"
                  value={mpesaAmount}
                  onChange={(e) => setMpesaAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Safaricom agent float commission for August"
                  value={mpesaDesc}
                  onChange={(e) => setMpesaDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Safaricom Txn / Statement Ref</label>
                <input
                  type="text"
                  placeholder="e.g. QK882299"
                  value={mpesaRef}
                  onChange={(e) => setMpesaRef(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsMpesaModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMpesa}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingMpesa && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Commission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
