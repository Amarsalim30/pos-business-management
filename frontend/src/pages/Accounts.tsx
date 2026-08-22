import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';
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
  Loader2,
  ShieldAlert,
  Edit,
  Trash2
} from 'lucide-react';


export const AccountsPage: React.FC = () => {
  const { hasPermission, isOwner } = usePermissions();
  const canBanking = isOwner || hasPermission('accounts:banking_mpesa');
  const canPettyCash = isOwner || hasPermission('accounts:petty_cash');

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab = (canBanking && (tabParam === 'mpesa' || tabParam === 'banks')) ? tabParam : 'petty_cash';
  const [activeTab, setActiveTab] = useState<'petty_cash' | 'banks' | 'mpesa'>(initialTab);

  useEffect(() => {
    if (tabParam && (tabParam === 'mpesa' || tabParam === 'banks' || tabParam === 'petty_cash')) {
      if (!canBanking && (tabParam === 'banks' || tabParam === 'mpesa')) {
        setActiveTab('petty_cash');
      } else if (tabParam !== activeTab) {
        setActiveTab(tabParam);
      }
    }
  }, [tabParam, canBanking]);

  const handleTabChange = (tab: 'petty_cash' | 'banks' | 'mpesa') => {
    if (!canBanking && (tab === 'banks' || tab === 'mpesa')) return;
    setActiveTab(tab);
    setSearchParams({ tab });
  };
  const [overview, setOverview] = useState<AccountsOverview | null>(null);

  // Petty Cash State
  const [pettyEntries, setPettyEntries] = useState<PettyCashEntry[]>([]);
  const [pettySummary, setPettySummary] = useState<PettyCashSummary | null>(null);
  const [pettyLoading, setPettyLoading] = useState(false);
  const [pettyCategoryFilter, setPettyCategoryFilter] = useState('all');
  const [isPettyModalOpen, setIsPettyModalOpen] = useState(false);
  const [pettyAmount, setPettyAmount] = useState('');
  const [pettyCategory, setPettyCategory] = useState('tea_snacks');
  const [pettyDesc, setPettyDesc] = useState('');
  const [pettyReceipt, setPettyReceipt] = useState('');
  const [savingPetty, setSavingPetty] = useState(false);
  const [pettyError, setPettyError] = useState<string | null>(null);

  // Petty Cash Edit & Delete State
  const [editingPetty, setEditingPetty] = useState<PettyCashEntry | null>(null);
  const [editPettyAmount, setEditPettyAmount] = useState('');
  const [editPettyCategory, setEditPettyCategory] = useState('tea_snacks');
  const [editPettyDesc, setEditPettyDesc] = useState('');
  const [editPettyReceipt, setEditPettyReceipt] = useState('');
  const [savingEditPetty, setSavingEditPetty] = useState(false);
  const [editPettyError, setEditPettyError] = useState<string | null>(null);
  const [deletingPetty, setDeletingPetty] = useState<PettyCashEntry | null>(null);
  const [isDeletingPetty, setIsDeletingPetty] = useState(false);

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

  // Bank Account Edit & Delete State
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);
  const [editBankName, setEditBankName] = useState('');
  const [editBankInstitution, setEditBankInstitution] = useState('Kenya Commercial Bank');
  const [editBankAccNumber, setEditBankAccNumber] = useState('');
  const [savingEditBank, setSavingEditBank] = useState(false);
  const [editBankError, setEditBankError] = useState<string | null>(null);
  const [deletingBankAccount, setDeletingBankAccount] = useState<BankAccount | null>(null);
  const [isDeletingBank, setIsDeletingBank] = useState(false);

  // Bank Transaction Modal State
  const [isBankTxModalOpen, setIsBankTxModalOpen] = useState(false);
  const [txBankId, setTxBankId] = useState<number | ''>('');
  const [txType, setTxType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [txRef, setTxRef] = useState('');
  const [savingTx, setSavingTx] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  // Bank Transaction Edit & Delete State
  const [editingBankTx, setEditingBankTx] = useState<BankTransaction | null>(null);
  const [editTxAmount, setEditTxAmount] = useState('');
  const [editTxType, setEditTxType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [editTxDesc, setEditTxDesc] = useState('');
  const [editTxRef, setEditTxRef] = useState('');
  const [savingEditTx, setSavingEditTx] = useState(false);
  const [editTxError, setEditTxError] = useState<string | null>(null);
  const [deletingBankTx, setDeletingBankTx] = useState<BankTransaction | null>(null);
  const [isDeletingBankTx, setIsDeletingBankTx] = useState(false);

  // M-Pesa Income State
  const [mpesaIncomes, setMpesaIncomes] = useState<MpesaIncome[]>([]);
  const [mpesaLoading, setMpesaLoading] = useState(false);
  const [isMpesaModalOpen, setIsMpesaModalOpen] = useState(false);
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [mpesaDesc, setMpesaDesc] = useState('');
  const [mpesaRef, setMpesaRef] = useState('');
  const [savingMpesa, setSavingMpesa] = useState(false);
  const [mpesaError, setMpesaError] = useState<string | null>(null);

  // M-Pesa Income Edit & Delete State
  const [editingMpesa, setEditingMpesa] = useState<MpesaIncome | null>(null);
  const [editMpesaAmount, setEditMpesaAmount] = useState('');
  const [editMpesaDesc, setEditMpesaDesc] = useState('');
  const [editMpesaRef, setEditMpesaRef] = useState('');
  const [savingEditMpesa, setSavingEditMpesa] = useState(false);
  const [editMpesaError, setEditMpesaError] = useState<string | null>(null);
  const [deletingMpesa, setDeletingMpesa] = useState<MpesaIncome | null>(null);
  const [isDeletingMpesa, setIsDeletingMpesa] = useState(false);

  useEffect(() => {
    if (canBanking || canPettyCash) {
      loadOverview();
      if (activeTab === 'petty_cash' && canPettyCash) loadPettyCash();
      if (activeTab === 'banks' && canBanking) loadBankAccounts();
      if (activeTab === 'mpesa' && canBanking) loadMpesaIncomes();
    }
  }, [activeTab, pettyCategoryFilter, canBanking, canPettyCash]);

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
      if (data.length > 0) {
        if (!selectedBankId || !data.some(b => b.id === selectedBankId)) {
          loadBankDetail(data[0].id);
        } else {
          loadBankDetail(selectedBankId);
        }
      } else {
        setSelectedBankId(null);
        setSelectedBankDetail(null);
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

  // --- Petty Cash Handlers ---
  const handleSavePettyCash = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(pettyAmount);
    if (!amt || amt <= 0) return;

    setSavingPetty(true);
    setPettyError(null);
    try {
      await apiFetch('/api/v1/accounts/petty-cash', {
        method: 'POST',
        body: JSON.stringify({
          description: pettyDesc.trim() || undefined,
          amount: amt,
          type: 'out',
          category: pettyCategory,
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
      setPettyError(err.message || 'Failed to record expense');
    } finally {
      setSavingPetty(false);
    }
  };

  const openEditPetty = (entry: PettyCashEntry) => {
    setEditingPetty(entry);
    setEditPettyAmount(String(entry.amount));
    setEditPettyCategory(entry.category || 'general');
    setEditPettyDesc(entry.description);
    setEditPettyReceipt(entry.receipt_no || '');
    setEditPettyError(null);
  };

  const handleSaveEditPetty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPetty) return;
    const amt = parseFloat(editPettyAmount);
    if (!amt || amt <= 0) return;

    setSavingEditPetty(true);
    setEditPettyError(null);
    try {
      await apiFetch(`/api/v1/accounts/petty-cash/${editingPetty.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          amount: amt,
          type: editingPetty.type || 'out',
          category: editPettyCategory,
          description: editPettyDesc.trim() || undefined,
          receipt_no: editPettyReceipt.trim() || null
        })
      });
      setEditingPetty(null);
      loadPettyCash();
      loadOverview();
    } catch (err: any) {
      setEditPettyError(err.message || 'Failed to update expense entry');
    } finally {
      setSavingEditPetty(false);
    }
  };

  const handleDeletePetty = async () => {
    if (!deletingPetty) return;
    setIsDeletingPetty(true);
    try {
      await apiFetch(`/api/v1/accounts/petty-cash/${deletingPetty.id}`, {
        method: 'DELETE'
      });
      setDeletingPetty(null);
      loadPettyCash();
      loadOverview();
    } catch (err: any) {
      alert(err.message || 'Failed to delete petty cash entry');
    } finally {
      setIsDeletingPetty(false);
    }
  };

  // --- Bank Account Handlers ---
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
      await loadBankAccounts();
      loadOverview();
      loadBankDetail(created.id);
    } catch (err: any) {
      setBankError(err.message || 'Failed to create bank account');
    } finally {
      setSavingBank(false);
    }
  };

  const openEditBankAccount = (acc: BankAccount) => {
    setEditingBankAccount(acc);
    setEditBankName(acc.name);
    setEditBankInstitution(acc.bank_name);
    setEditBankAccNumber(acc.account_number);
    setEditBankError(null);
  };

  const handleSaveEditBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBankAccount || !editBankName.trim()) return;

    setSavingEditBank(true);
    setEditBankError(null);
    try {
      await apiFetch(`/api/v1/accounts/bank-accounts/${editingBankAccount.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editBankName.trim(),
          bank_name: editBankInstitution.trim(),
          account_number: editBankAccNumber.trim()
        })
      });
      setEditingBankAccount(null);
      await loadBankAccounts();
      loadOverview();
    } catch (err: any) {
      setEditBankError(err.message || 'Failed to update bank account');
    } finally {
      setSavingEditBank(false);
    }
  };

  const handleDeleteBankAccount = async () => {
    if (!deletingBankAccount) return;
    setIsDeletingBank(true);
    try {
      await apiFetch(`/api/v1/accounts/bank-accounts/${deletingBankAccount.id}`, {
        method: 'DELETE'
      });
      setDeletingBankAccount(null);
      setSelectedBankDetail(null);
      setSelectedBankId(null);
      await loadBankAccounts();
      loadOverview();
    } catch (err: any) {
      alert(err.message || 'Failed to delete bank account');
    } finally {
      setIsDeletingBank(false);
    }
  };

  // --- Bank Transaction Handlers ---
  const handleSaveBankTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txBankId) return;
    const amt = parseFloat(txAmount);
    if (!amt || amt <= 0) return;

    setSavingTx(true);
    setTxError(null);
    try {
      await apiFetch(`/api/v1/accounts/bank-accounts/${txBankId}/transactions`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          type: txType,
          description: txDesc.trim() || undefined,
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

  const openEditBankTx = (tx: BankTransaction) => {
    setEditingBankTx(tx);
    setEditTxType(tx.type as 'deposit' | 'withdrawal');
    setEditTxAmount(String(tx.amount));
    setEditTxDesc(tx.description);
    setEditTxRef(tx.reference || '');
    setEditTxError(null);
  };

  const handleSaveEditBankTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBankTx || !selectedBankId) return;
    const amt = parseFloat(editTxAmount);
    if (!amt || amt <= 0) return;

    setSavingEditTx(true);
    setEditTxError(null);
    try {
      await apiFetch(`/api/v1/accounts/bank-accounts/${selectedBankId}/transactions/${editingBankTx.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          amount: amt,
          type: editTxType,
          description: editTxDesc.trim() || undefined,
          reference: editTxRef.trim() || null
        })
      });
      setEditingBankTx(null);
      loadBankAccounts();
      loadOverview();
      loadBankDetail(selectedBankId);
    } catch (err: any) {
      setEditTxError(err.message || 'Failed to update bank transaction');
    } finally {
      setSavingEditTx(false);
    }
  };

  const handleDeleteBankTx = async () => {
    if (!deletingBankTx || !selectedBankId) return;
    setIsDeletingBankTx(true);
    try {
      await apiFetch(`/api/v1/accounts/bank-accounts/${selectedBankId}/transactions/${deletingBankTx.id}`, {
        method: 'DELETE'
      });
      setDeletingBankTx(null);
      loadBankAccounts();
      loadOverview();
      loadBankDetail(selectedBankId);
    } catch (err: any) {
      alert(err.message || 'Failed to delete bank transaction');
    } finally {
      setIsDeletingBankTx(false);
    }
  };

  // --- M-Pesa Income Handlers ---
  const handleSaveMpesaIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(mpesaAmount);
    if (!amt || amt <= 0) return;

    setSavingMpesa(true);
    setMpesaError(null);
    try {
      await apiFetch('/api/v1/accounts/mpesa-income', {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          description: mpesaDesc.trim() || undefined,
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

  const openEditMpesa = (record: MpesaIncome) => {
    setEditingMpesa(record);
    setEditMpesaAmount(String(record.amount));
    setEditMpesaDesc(record.description);
    setEditMpesaRef(record.reference || '');
    setEditMpesaError(null);
  };

  const handleSaveEditMpesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMpesa) return;
    const amt = parseFloat(editMpesaAmount);
    if (!amt || amt <= 0) return;

    setSavingEditMpesa(true);
    setEditMpesaError(null);
    try {
      await apiFetch(`/api/v1/accounts/mpesa-income/${editingMpesa.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          amount: amt,
          description: editMpesaDesc.trim() || undefined,
          reference: editMpesaRef.trim() || null
        })
      });
      setEditingMpesa(null);
      loadMpesaIncomes();
      loadOverview();
    } catch (err: any) {
      setEditMpesaError(err.message || 'Failed to update M-Pesa commission record');
    } finally {
      setSavingEditMpesa(false);
    }
  };

  const handleDeleteMpesa = async () => {
    if (!deletingMpesa) return;
    setIsDeletingMpesa(true);
    try {
      await apiFetch(`/api/v1/accounts/mpesa-income/${deletingMpesa.id}`, {
        method: 'DELETE'
      });
      setDeletingMpesa(null);
      loadMpesaIncomes();
      loadOverview();
    } catch (err: any) {
      alert(err.message || 'Failed to delete M-Pesa commission record');
    } finally {
      setIsDeletingMpesa(false);
    }
  };

  if (!canBanking && !canPettyCash) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs max-w-md mx-auto my-12">
        <div className="p-3.5 bg-rose-50 text-rose-600 rounded-2xl w-12 h-12 flex items-center justify-center mx-auto mb-3 border border-rose-100">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h3 className="text-base font-black text-slate-900">Accounts Access Restricted</h3>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
          Your account does not have permission to view petty cash books or bank accounts. Contact the store owner to request permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
              <Wallet className="h-6 w-6" />
            </div>
            {canBanking ? 'Financial Accounts & Petty Cash' : 'Store Petty Cash Book'}
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            {canBanking
              ? 'Consolidated management for Petty Cash, Bank Accounts, and M-Pesa Commissions.'
              : 'Record and track everyday store operational expenses and petty cash disbursements.'}
          </p>
        </div>

        {/* Global Accounts Overview Metrics */}
        {overview && (
          <div className="flex items-center gap-3">
            <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Petty Expenses</div>
              <div className="text-base font-black text-rose-600 font-mono">
                KES {Number(pettySummary ? pettySummary.total_out : Math.abs(Number(overview.petty_cash_balance))).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>

            {canBanking && (
              <>
                <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Bank Balance</div>
                  <div className="text-base font-black text-slate-900 font-mono">
                    KES {Number(overview.total_bank_balances).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total M-Pesa Comms</div>
                  <div className="text-base font-black text-emerald-600 font-mono">
                    KES {Number(overview.total_mpesa_commission).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => handleTabChange('petty_cash')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'petty_cash'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Wallet className="h-4 w-4" />
          <span>Petty Cash Book</span>
        </button>

        {canBanking && (
          <>
            <button
              onClick={() => handleTabChange('banks')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'banks'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span>Bank Accounts</span>
            </button>

            <button
              onClick={() => handleTabChange('mpesa')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'mpesa'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Smartphone className="h-4 w-4" />
              <span>M-Pesa Commissions</span>
            </button>
          </>
        )}
      </div>

      {/* Tab 1: Petty Cash */}
      {activeTab === 'petty_cash' && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Store Expenses (Out)</div>
              <div className="text-2xl font-black text-rose-600 mt-2 font-mono">
                KES {Number(pettySummary ? pettySummary.total_out : 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expense Entries Logged</div>
              <div className="text-2xl font-black text-indigo-700 mt-2 font-mono">
                {pettySummary ? pettySummary.entries_count : 0} <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vouchers</span>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-2">
              <select
                value={pettyCategoryFilter}
                onChange={(e) => setPettyCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
              >
                <option value="all">All Expense Categories</option>
                <option value="tea_snacks">Tea & Snacks</option>
                <option value="office">Office Supplies</option>
                <option value="transport">Transport</option>
                <option value="cleaning">Cleaning</option>
                <option value="repairs">Repairs</option>
                <option value="general">General</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setPettyCategory('tea_snacks');
                  setIsPettyModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Record Expense</span>
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
                    <th className="p-3">Category</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Receipt / Ref</th>
                    <th className="p-3">Logged By</th>
                    <th className="p-3 text-right">Amount (KES)</th>
                    <th className="p-3 text-center">Actions</th>
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
                        No expense entries found.
                      </td>
                    </tr>
                  ) : (
                    pettyEntries.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/80">
                        <td className="p-3 text-slate-500 font-mono">{new Date(e.date).toLocaleDateString()}</td>
                        <td className="p-3 capitalize font-semibold text-slate-700">{e.category?.replace('_', ' ') || 'General'}</td>
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
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditPetty(e)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Entry"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingPetty(e)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Entry"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
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
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative group ${
                    selectedBankId === acc.id
                      ? 'bg-indigo-50/50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-900 text-sm">{acc.name}</div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditBankAccount(acc);
                        }}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-100/60 rounded-md transition-colors"
                        title="Edit Bank Account"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingBankAccount(acc);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-100/60 rounded-md transition-colors"
                        title="Delete Bank Account"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs font-medium text-slate-500 mt-0.5">{acc.bank_name}</div>
                  <div className="text-xs font-mono text-slate-400 mt-0.5">Acc: {acc.account_number}</div>
                  <div className="text-base font-black text-slate-900 font-mono mt-2.5">
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
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {selectedBankDetail.transactions?.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
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
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditBankTx(t)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Transaction"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingBankTx(t)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Transaction"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
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
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {mpesaLoading && mpesaIncomes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Loading M-Pesa commission ledger...
                      </td>
                    </tr>
                  ) : mpesaIncomes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
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
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditMpesa(m)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Record"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingMpesa(m)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
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

      {/* --- CREATE MODALS --- */}

      {/* Petty Cash Create Modal */}
      {isPettyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Record Petty Cash Expense
              </h3>
              <button onClick={() => setIsPettyModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
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

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Milk and coffee for staff"
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
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPetty}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingPetty && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Petty Cash Edit Modal */}
      {editingPetty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Edit Expense Entry #{editingPetty.id}
              </h3>
              <button onClick={() => setEditingPetty(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPetty} className="mt-4 space-y-3">
              {editPettyError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {editPettyError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Amount (KES) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editPettyAmount}
                  onChange={(e) => setEditPettyAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Expense Category</label>
                <select
                  value={editPettyCategory}
                  onChange={(e) => setEditPettyCategory(e.target.value)}
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

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={editPettyDesc}
                  onChange={(e) => setEditPettyDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Receipt / Voucher Number</label>
                <input
                  type="text"
                  value={editPettyReceipt}
                  onChange={(e) => setEditPettyReceipt(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingPetty(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEditPetty}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingEditPetty && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Petty Cash Confirmation */}
      {deletingPetty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Petty Cash Entry</h3>
                <p className="text-xs text-slate-500">Remove this record from cashbook</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-1 text-slate-700 font-medium">
              <div>Description: <span className="font-bold text-slate-900">{deletingPetty.description}</span></div>
              <div>Amount: <span className="font-mono font-bold text-slate-900">KES {Number(deletingPetty.amount).toLocaleString()}</span></div>
              <div>Type: <span className="uppercase font-bold">{deletingPetty.type}</span></div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingPetty}
                onClick={() => setDeletingPetty(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingPetty}
                onClick={handleDeletePetty}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isDeletingPetty && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Bank Account Modal */}
      {isNewBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add New Bank Account</h3>
              <button onClick={() => setIsNewBankModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
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
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBank}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingBank && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Bank Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Bank Account Modal */}
      {editingBankAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Edit Bank Account</h3>
              <button onClick={() => setEditingBankAccount(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditBankAccount} className="mt-4 space-y-3">
              {editBankError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {editBankError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Account Nickname *</label>
                <input
                  type="text"
                  required
                  value={editBankName}
                  onChange={(e) => setEditBankName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Bank Name *</label>
                <input
                  type="text"
                  required
                  value={editBankInstitution}
                  onChange={(e) => setEditBankInstitution(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Account Number *</label>
                <input
                  type="text"
                  required
                  value={editBankAccNumber}
                  onChange={(e) => setEditBankAccNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingBankAccount(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEditBank}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingEditBank && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Bank Account Confirmation */}
      {deletingBankAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Bank Account</h3>
                <p className="text-xs text-slate-500">Remove account and its transaction records</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-1 text-slate-700 font-medium">
              <div>Account: <span className="font-bold text-slate-900">{deletingBankAccount.name}</span></div>
              <div>Bank: <span className="font-semibold text-slate-800">{deletingBankAccount.bank_name}</span></div>
              <div>Account Number: <span className="font-mono text-slate-800">{deletingBankAccount.account_number}</span></div>
              <div>Current Balance: <span className="font-mono font-bold text-slate-900">KES {Number(deletingBankAccount.balance).toLocaleString()}</span></div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingBank}
                onClick={() => setDeletingBankAccount(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingBank}
                onClick={handleDeleteBankAccount}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isDeletingBank && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bank Transaction Create Modal */}
      {isBankTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Record Bank {txType === 'deposit' ? 'Deposit' : 'Withdrawal'}
              </h3>
              <button onClick={() => setIsBankTxModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
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
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      txType === 'deposit' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Deposit (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxType('withdrawal')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      txType === 'withdrawal' ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600'
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
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Description (Optional)</label>
                <input
                  type="text"
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
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTx}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingTx && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Bank Transaction Modal */}
      {editingBankTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Edit Bank Transaction #{editingBankTx.id}
              </h3>
              <button onClick={() => setEditingBankTx(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditBankTx} className="mt-4 space-y-3">
              {editTxError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {editTxError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Transaction Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditTxType('deposit')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      editTxType === 'deposit' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Deposit (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTxType('withdrawal')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      editTxType === 'withdrawal' ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600'
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
                  value={editTxAmount}
                  onChange={(e) => setEditTxAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={editTxDesc}
                  onChange={(e) => setEditTxDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Bank / Slip Reference</label>
                <input
                  type="text"
                  value={editTxRef}
                  onChange={(e) => setEditTxRef(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingBankTx(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEditTx}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingEditTx && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Bank Transaction Confirmation */}
      {deletingBankTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Bank Transaction</h3>
                <p className="text-xs text-slate-500">Reverses transaction and updates bank account balance</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-1 text-slate-700 font-medium">
              <div>Description: <span className="font-bold text-slate-900">{deletingBankTx.description}</span></div>
              <div>Amount: <span className="font-mono font-bold text-slate-900">KES {Number(deletingBankTx.amount).toLocaleString()}</span></div>
              <div>Type: <span className="uppercase font-bold">{deletingBankTx.type}</span></div>
              {deletingBankTx.reference && <div>Ref: <span className="font-mono">{deletingBankTx.reference}</span></div>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingBankTx}
                onClick={() => setDeletingBankTx(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingBankTx}
                onClick={handleDeleteBankTx}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isDeletingBankTx && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* M-Pesa Income Create Modal */}
      {isMpesaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Log M-Pesa Commission Income</h3>
              <button onClick={() => setIsMpesaModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
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
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Description (Optional)</label>
                <input
                  type="text"
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
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMpesa}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingMpesa && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Commission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit M-Pesa Income Modal */}
      {editingMpesa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Edit M-Pesa Commission #{editingMpesa.id}
              </h3>
              <button onClick={() => setEditingMpesa(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditMpesa} className="mt-4 space-y-3">
              {editMpesaError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                  {editMpesaError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Commission Amount (KES) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editMpesaAmount}
                  onChange={(e) => setEditMpesaAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={editMpesaDesc}
                  onChange={(e) => setEditMpesaDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Safaricom Txn / Statement Ref</label>
                <input
                  type="text"
                  value={editMpesaRef}
                  onChange={(e) => setEditMpesaRef(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingMpesa(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEditMpesa}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingEditMpesa && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete M-Pesa Income Confirmation */}
      {deletingMpesa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete M-Pesa Commission</h3>
                <p className="text-xs text-slate-500">Remove this commission payout record</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-1 text-slate-700 font-medium">
              <div>Description: <span className="font-bold text-slate-900">{deletingMpesa.description}</span></div>
              <div>Amount: <span className="font-mono font-bold text-slate-900">KES {Number(deletingMpesa.amount).toLocaleString()}</span></div>
              {deletingMpesa.reference && <div>Ref: <span className="font-mono">{deletingMpesa.reference}</span></div>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingMpesa}
                onClick={() => setDeletingMpesa(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingMpesa}
                onClick={handleDeleteMpesa}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isDeletingMpesa && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
