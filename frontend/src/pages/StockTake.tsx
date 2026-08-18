import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import type { InventoryItem } from '../types';
import { 
  ClipboardCheck, 
  Play, 
  CheckCircle2, 
  Layers, 
  RotateCcw
} from 'lucide-react';

interface StockTakeItem {
  id: number;
  product_id: number;
  product_name: string;
  expected_quantity: number;
  counted_quantity: number | null;
  variance: number | null;
  rolls_counted: number | null;
  loose_meters_counted: number | null;
}

interface StockTakeSession {
  id: number;
  store_id: number;
  user_id: number;
  status: 'in_progress' | 'completed';
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  items: StockTakeItem[];
}

export const StockTakePage: React.FC = () => {
  const [activeSession, setActiveSession] = useState<StockTakeSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [counts, setCounts] = useState<{ [productId: number]: { rolls: string; loose: string; qty: string } }>({});
  const [reconciling, setReconciling] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [inventoryMap, setInventoryMap] = useState<{ [productId: number]: InventoryItem }>({});

  useEffect(() => {
    loadInventoryDetails();
  }, []);

  const loadInventoryDetails = async () => {
    try {
      const inv = await apiFetch<InventoryItem[]>('/api/v1/inventory/');
      const map: { [id: number]: InventoryItem } = {};
      inv.forEach(i => { map[i.product_id] = i; });
      setInventoryMap(map);
    } catch (e) {
      console.error(e);
    }
  };

  const startStockTake = async () => {
    setLoading(true);
    setSuccessMessage(null);
    try {
      const session = await apiFetch<StockTakeSession>('/api/v1/inventory/stock-takes/', {
        method: 'POST',
        body: JSON.stringify({ notes: notes.trim() || 'Physical Store Count Audit' }),
      });
      setActiveSession(session);
      
      const initialCounts: { [id: number]: { rolls: string; loose: string; qty: string } } = {};
      session.items.forEach(item => {
        initialCounts[item.product_id] = { rolls: '', loose: '', qty: '' };
      });
      setCounts(initialCounts);
    } catch (err: any) {
      alert(err.message || 'Failed to start stock take');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveItemCount = async (item: StockTakeItem) => {
    if (!activeSession) return;
    const countState = counts[item.product_id];
    const invInfo = inventoryMap[item.product_id];

    let countedQty: number | null = null;
    let rollsCounted: number | null = null;
    let looseCounted: number | null = null;

    if (invInfo?.unit_type === 'roll') {
      rollsCounted = parseFloat(countState?.rolls || '0');
      looseCounted = parseFloat(countState?.loose || '0');
      const mpr = Number(invInfo.meters_per_roll) || 100;
      countedQty = (rollsCounted * mpr) + looseCounted;
    } else {
      countedQty = parseFloat(countState?.qty || '0');
    }

    try {
      const updatedItem = await apiFetch<StockTakeItem>(`/api/v1/inventory/stock-takes/${activeSession.id}/items`, {
        method: 'POST',
        body: JSON.stringify({
          product_id: item.product_id,
          counted_quantity: countedQty,
          rolls_counted: rollsCounted,
          loose_meters_counted: looseCounted,
        }),
      });

      setActiveSession(prev => {
        if (!prev) return null;
        return {
          ...prev,
          items: prev.items.map(i => i.product_id === updatedItem.product_id ? updatedItem : i),
        };
      });
    } catch (err: any) {
      alert(err.message || 'Failed to save count');
    }
  };

  const handleReconcile = async () => {
    if (!activeSession) return;
    if (!window.confirm('Are you sure you want to reconcile inventory? This will update active inventory balances with physical counts.')) {
      return;
    }

    setReconciling(true);
    try {
      const completedSession = await apiFetch<StockTakeSession>(`/api/v1/inventory/stock-takes/${activeSession.id}/reconcile`, {
        method: 'POST',
      });
      setActiveSession(completedSession);
      setSuccessMessage('Stock take successfully reconciled! Inventory balances updated.');
    } catch (err: any) {
      alert(err.message || 'Failed to reconcile stock take');
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <ClipboardCheck className="h-5 w-5 text-amber-600" />
            <span>Physical Stock Take & Audit</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Conduct store count audits, record physical numbers, and reconcile discrepancies
          </p>
        </div>

        {!activeSession && (
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Session notes (e.g. End of Month Count)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600 w-64 shadow-2xs"
            />
            <button
              onClick={startStockTake}
              disabled={loading}
              className="flex items-center space-x-1.5 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-500 transition-all shadow-xs cursor-pointer active:scale-[0.98]"
            >
              <Play className="h-4 w-4" />
              <span>Start New Count</span>
            </button>
          </div>
        )}
      </div>

      {successMessage && (
        <div className="flex items-center space-x-2 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800 shadow-xs">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {activeSession ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                activeSession.status === 'completed' 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {activeSession.status === 'completed' ? 'Reconciled & Complete' : 'Count In Progress'}
              </span>
              <span className="text-xs text-slate-500">
                Session #{activeSession.id} • Started: {new Date(activeSession.created_at).toLocaleTimeString()}
              </span>
            </div>

            {activeSession.status === 'in_progress' && (
              <button
                onClick={handleReconcile}
                disabled={reconciling}
                className="flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-all shadow-xs cursor-pointer active:scale-[0.98]"
              >
                <RotateCcw className="h-4 w-4" />
                <span>{reconciling ? 'Reconciling...' : '1-Click Reconcile Inventory'}</span>
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Product</th>
                  <th className="p-3.5 text-right">System Expected</th>
                  <th className="p-3.5 text-center">Physical Count Entry</th>
                  <th className="p-3.5 text-right">Recorded Count</th>
                  <th className="p-3.5 text-right">Discrepancy / Variance</th>
                  <th className="p-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {activeSession.items.map((item) => {
                  const inv = inventoryMap[item.product_id];
                  const countState = counts[item.product_id] || { rolls: '', loose: '', qty: '' };
                  const hasCount = item.counted_quantity !== null;
                  const isRoll = inv?.unit_type === 'roll';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{item.product_name}</div>
                        {isRoll && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 mt-1">
                            <Layers className="h-3 w-3 mr-1" />
                            Roll ({inv.meters_per_roll}m/roll)
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-700">
                        {Number(item.expected_quantity).toFixed(1)} {isRoll ? 'm' : 'pcs'}
                      </td>
                      <td className="p-3.5">
                        {activeSession.status === 'in_progress' ? (
                          isRoll ? (
                            <div className="flex items-center justify-center space-x-1.5">
                              <input
                                type="number"
                                placeholder="Rolls"
                                value={countState.rolls}
                                onChange={(e) => setCounts(prev => ({
                                  ...prev,
                                  [item.product_id]: { ...prev[item.product_id], rolls: e.target.value }
                                }))}
                                className="w-16 rounded border border-slate-300 px-2 py-1 text-xs text-center font-mono focus:outline-none focus:border-amber-600"
                              />
                              <span className="text-slate-400 font-bold">+</span>
                              <input
                                type="number"
                                step="0.1"
                                placeholder="Meters"
                                value={countState.loose}
                                onChange={(e) => setCounts(prev => ({
                                  ...prev,
                                  [item.product_id]: { ...prev[item.product_id], loose: e.target.value }
                                }))}
                                className="w-20 rounded border border-slate-300 px-2 py-1 text-xs text-center font-mono focus:outline-none focus:border-amber-600"
                              />
                            </div>
                          ) : (
                            <div className="flex justify-center">
                              <input
                                type="number"
                                placeholder="Count"
                                value={countState.qty}
                                onChange={(e) => setCounts(prev => ({
                                  ...prev,
                                  [item.product_id]: { ...prev[item.product_id], qty: e.target.value }
                                }))}
                                className="w-24 rounded border border-slate-300 px-2 py-1 text-xs text-center font-mono focus:outline-none focus:border-amber-600 font-bold"
                              />
                            </div>
                          )
                        ) : (
                          <div className="text-center font-mono text-slate-400">Locked</div>
                        )}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                        {hasCount ? `${Number(item.counted_quantity).toFixed(1)} ${isRoll ? 'm' : 'pcs'}` : '---'}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold">
                        {item.variance !== null ? (
                          <span className={Number(item.variance) === 0 ? 'text-emerald-600' : Number(item.variance) > 0 ? 'text-blue-600' : 'text-rose-600'}>
                            {Number(item.variance) > 0 ? `+${Number(item.variance).toFixed(1)}` : Number(item.variance).toFixed(1)}
                          </span>
                        ) : '---'}
                      </td>
                      <td className="p-3.5 text-center">
                        {activeSession.status === 'in_progress' && (
                          <button
                            onClick={() => handleSaveItemCount(item)}
                            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 hover:text-amber-700 transition-colors cursor-pointer"
                          >
                            Save
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-3 shadow-xs">
          <ClipboardCheck className="h-12 w-12 text-amber-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">No Active Stock Take Session</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Click "Start New Count" to snapshot system expected balances and enter physical store counts with roll breakdown calculations.
          </p>
        </div>
      )}
    </div>
  );
};
