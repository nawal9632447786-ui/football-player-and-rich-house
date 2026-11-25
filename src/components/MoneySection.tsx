import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Wallet,
  Calendar,
  ArrowDownRight,
  ArrowUpRight,
  X,
} from 'lucide-react';
import { apiFetch } from '../api.ts';
import type { FinancialTransaction, WeeklyPayment } from '../types.ts';
import { PlayerAvatar } from './ClubBrand.tsx';

interface MoneyPayload {
  weekStart: string;
  weekLabel: string;
  activePlayerCount: number;
  weeklyTarget: number;
  weeklyRecords: WeeklyPayment[];
  availableWeeks: Array<{
    week_start: string;
    week_label: string;
    player_count: number;
    collected: number;
    expected: number;
  }>;
  weeklyCollection: number;
  monthlyCollection: number;
  yearlyCollection: number;
  totalClubBalance: number;
  pendingPaymentsAmount: number;
  allPendingTotal: number;
  allPendingCount: number;
  paidCount: number;
  unpaidCount: number;
  transactions: FinancialTransaction[];
  weeklyTrend: Array<{
    week_start: string;
    week_label: string;
    collected: number;
    expected: number;
  }>;
}

export function MoneySection({
  onNavigateToPlayer,
  onMoneyChanged,
}: {
  onNavigateToPlayer: (playerId: number) => void;
  onMoneyChanged: () => void;
}) {
  const [data, setData] = useState<MoneyPayload | null>(null);
  const [selectedWeekDate, setSelectedWeekDate] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Add Expense / Income Modal
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txType, setTxType] = useState<'EXPENSE' | 'SPONSORSHIP' | 'OTHER_INCOME'>('EXPENSE');
  const [txAmount, setTxAmount] = useState<number>(100);
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [txDescription, setTxDescription] = useState('');
  const [savingTx, setSavingTx] = useState(false);
  const [txError, setTxError] = useState('');

  const loadMoney = useCallback(async (weekParam?: string) => {
    setLoading(true);
    setError('');
    try {
      const qs = weekParam ? `?week=${encodeURIComponent(weekParam)}` : '';
      const res = await apiFetch<MoneyPayload>(`/api/money${qs}`);
      setData(res);
      if (!weekParam) {
        setSelectedWeekDate(res.weekStart);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load club finances.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMoney(selectedWeekDate || undefined);
  }, [selectedWeekDate, loadMoney]);

  const handleSyncWeek = async () => {
    try {
      await apiFetch('/api/money/generate', {
        method: 'POST',
        body: JSON.stringify({ week_date: selectedWeekDate || undefined }),
      });
      await loadMoney(selectedWeekDate || undefined);
      onMoneyChanged();
    } catch (err: any) {
      setError(err?.message || 'Unable to generate weekly sheet.');
    }
  };

  const handleTogglePayment = async (wp: WeeklyPayment) => {
    setTogglingId(wp.id);
    setError('');
    try {
      const targetStatus = wp.status === 'PAID' ? 'UNPAID' : 'PAID';
      await apiFetch('/api/money/toggle-payment', {
        method: 'POST',
        body: JSON.stringify({
          payment_id: wp.id,
          status: targetStatus,
          paid_at: paymentDate,
        }),
      });
      await loadMoney(selectedWeekDate || undefined);
      onMoneyChanged();
    } catch (err: any) {
      setError(err?.message || 'Unable to update payment status.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleSaveTx = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxError('');
    setSavingTx(true);
    try {
      await apiFetch('/api/money/transaction', {
        method: 'POST',
        body: JSON.stringify({
          tx_type: txType,
          direction: txType === 'EXPENSE' ? 'OUT' : 'IN',
          amount: txAmount,
          description: txDescription,
          tx_date: txDate,
        }),
      });
      setTxModalOpen(false);
      setTxDescription('');
      await loadMoney(selectedWeekDate || undefined);
      onMoneyChanged();
    } catch (err: any) {
      setTxError(err?.message || 'Unable to log transaction.');
    } finally {
      setSavingTx(false);
    }
  };

  const filteredRecords = (data?.weeklyRecords || []).filter(
    (r) => filterStatus === 'ALL' || r.status === filterStatus,
  );

  const trend = data?.weeklyTrend || [];
  const maxTrend = Math.max(10, ...trend.map((t) => Math.max(t.expected, t.collected)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Money Management</h1>
          <p className="text-sm text-slate-600">
            ₹10 weekly player contribution ledger ({data?.activePlayerCount ?? 0} active players = ₹
            {data?.weeklyTarget ?? 0} / week).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleSyncWeek}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-[#0B1F3A] bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Sync Weekly Sheet</span>
          </button>
          <button
            type="button"
            onClick={() => setTxModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#1D4ED8] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log Expense / Income</span>
          </button>
        </div>
      </div>

      {/* Financial KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[#0B1F3A] text-white rounded-xl p-5 space-y-1">
          <p className="text-xs text-sky-300">Total Club Balance</p>
          <p className="text-3xl font-bold tabular-nums">
            ₹{(data?.totalClubBalance ?? 0).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-blue-200/80">Net club treasury</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
          <p className="text-xs text-slate-500">Weekly Collection</p>
          <p className="text-2xl font-bold text-[#0F172A] tabular-nums">
            ₹{data?.weeklyCollection ?? 0}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            Target: ₹{data?.weeklyTarget ?? 0} ({data?.paidCount ?? 0} paid)
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
          <p className="text-xs text-slate-500">Monthly Collection</p>
          <p className="text-2xl font-bold text-[#0F172A] tabular-nums">
            ₹{(data?.monthlyCollection ?? 0).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-500">Selected month total</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
          <p className="text-xs text-slate-500">Yearly Collection</p>
          <p className="text-2xl font-bold text-[#0F172A] tabular-nums">
            ₹{(data?.yearlyCollection ?? 0).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-500">Annual player fees</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
          <p className="text-xs text-slate-500">Pending Payments</p>
          <p className="text-2xl font-bold text-red-600 tabular-nums">
            ₹{data?.allPendingTotal ?? 0}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {data?.unpaidCount ?? 0} unpaid this week · {data?.allPendingCount ?? 0} total
          </p>
        </div>
      </section>

      {error && <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

      {/* Week Controls & Roster Table */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Weekly ₹10 Player Contributions</h2>
              <p className="text-xs text-slate-500">{data?.weekLabel || 'Current Week'}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={selectedWeekDate}
                  onChange={(e) => setSelectedWeekDate(e.target.value)}
                  aria-label="Select week date"
                  className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['ALL', 'PAID', 'UNPAID'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilterStatus(f)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      filterStatus === f ? 'bg-white text-[#0F172A] shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-2.5 bg-blue-50/60 border-b border-blue-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-600">
              Payment Date applied when marking PAID:
            </span>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="px-2.5 py-1 bg-white border border-blue-200 rounded-md text-xs font-mono"
            />
          </div>

          {loading ? (
            <div className="h-56 animate-pulse bg-slate-50" />
          ) : filteredRecords.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Wallet className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm text-slate-600">No payment records match the current filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Player</th>
                    <th className="py-3 px-3 text-right">Fee</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Paid Date</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {filteredRecords.map((wp) => {
                    const isPaid = wp.status === 'PAID';
                    return (
                      <tr key={wp.id} className="hover:bg-slate-50">
                        <td
                          className="py-3 px-4 cursor-pointer"
                          onClick={() => onNavigateToPlayer(wp.player_id)}
                        >
                          <div className="flex items-center gap-3">
                            <PlayerAvatar src={wp.photo_url} name={wp.full_name} size="sm" />
                            <div>
                              <p className="font-semibold text-slate-900 hover:text-[#1D4ED8]">{wp.full_name}</p>
                              <p className="text-xs text-slate-500 font-mono">
                                {wp.player_code} · {wp.position}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-[#0F172A]">₹{wp.amount}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                              isPaid ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {isPaid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {wp.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 font-mono">
                          {wp.paid_at || '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            disabled={togglingId === wp.id}
                            onClick={() => handleTogglePayment(wp)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              isPaid
                                ? 'bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700'
                                : 'bg-[#1D4ED8] hover:bg-[#1E40AF] text-white'
                            }`}
                          >
                            {togglingId === wp.id ? 'Updating...' : isPaid ? 'Mark Unpaid' : 'Mark Paid'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Collection Chart & Financial Ledger */}
        <div className="xl:col-span-4 space-y-6">
          {/* Weekly Collection Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-[#0F172A]">Weekly Collection Trend</h2>
              <span className="text-xs text-slate-500">Collected vs Target</span>
            </div>
            {trend.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No weekly trend data yet.</p>
            ) : (
              <div className="space-y-3">
                {trend.slice(-6).map((w) => {
                  const expPct = Math.round((w.expected / maxTrend) * 100);
                  const colPct = Math.round((w.collected / maxTrend) * 100);
                  return (
                    <div key={w.week_start} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-slate-600">{w.week_start}</span>
                        <span className="font-semibold text-slate-800 tabular-nums">
                          ₹{w.collected} / ₹{w.expected}
                        </span>
                      </div>
                      <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-blue-200 rounded-full"
                          style={{ width: `${expPct}%` }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 bg-[#1D4ED8] rounded-full"
                          style={{ width: `${colPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Financial Transactions Report */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-[#0F172A]">Recent Financial Transactions</h2>
              <span className="text-xs text-slate-500">{data?.transactions.length ?? 0} entries</span>
            </div>

            {!data?.transactions.length ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No transactions logged yet. Mark a player as PAID or log an expense.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {data.transactions.map((tx) => (
                  <div key={tx.id} className="py-2.5 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <div
                        className={`mt-0.5 p-1 rounded-md shrink-0 ${
                          tx.direction === 'IN' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {tx.direction === 'IN' ? (
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{tx.description}</p>
                        <p className="text-xs text-slate-400 font-mono">{tx.tx_date}</p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-bold tabular-nums whitespace-nowrap shrink-0 ${
                        tx.direction === 'IN' ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {tx.direction === 'IN' ? '+' : '-'}₹{tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Log Expense / Income Modal */}
      {txModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#0F172A]">Record Club Transaction</h2>
              <button type="button" onClick={() => setTxModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveTx} className="p-6 space-y-4">
              {txError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{txError}</div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Transaction Type</label>
                <select
                  value={txType}
                  onChange={(e) => setTxType(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="EXPENSE">Club Expense (Money Out)</option>
                  <option value="SPONSORSHIP">Sponsorship / Donation (Money In)</option>
                  <option value="OTHER_INCOME">Other Club Income (Money In)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Amount (₹)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={txAmount}
                    onChange={(e) => setTxAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Date</label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  required
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder="e.g., Match footballs & ground booking fee"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTxModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTx}
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#1D4ED8] rounded-lg cursor-pointer"
                >
                  {savingTx ? 'Saving...' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
