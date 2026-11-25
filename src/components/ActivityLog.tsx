import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Clock,
  Download,
  RefreshCw,
  Search,
  Users,
  Wallet,
  Landmark,
  BarChart3,
  Award,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { apiFetch } from '../api.ts';
import type { ActivityLog as ActivityLogItem, ActivityLogsResponse, SectionKey } from '../types.ts';

const CATEGORIES = [
  { key: 'ALL', label: 'All Events' },
  { key: 'PLAYERS', label: 'Players' },
  { key: 'MONEY', label: 'Money' },
  { key: 'COMMITTEE', label: 'Committee' },
  { key: 'STATS', label: 'Stats' },
  { key: 'AWARDS', label: 'Awards' },
  { key: 'AUTH', label: 'Security' },
] as const;

const CATEGORY_META: Record<
  string,
  {
    label: string;
    color: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  PLAYERS: { label: 'Players', color: 'text-[#1D4ED8]', icon: Users },
  MONEY: { label: 'Money', color: 'text-emerald-700', icon: Wallet },
  COMMITTEE: { label: 'Committee', color: 'text-indigo-700', icon: Landmark },
  STATS: { label: 'Stats', color: 'text-sky-700', icon: BarChart3 },
  AWARDS: { label: 'Awards', color: 'text-amber-700', icon: Award },
  AUTH: { label: 'Security', color: 'text-slate-700', icon: ShieldCheck },
};

function formatAuditTimestamp(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { date: iso.slice(0, 10), time: '' };
  }
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
}

function getNavigationTarget(
  item: ActivityLogItem,
  hasPlayers: boolean,
): { section: SectionKey; entityId?: number } | null {
  if (item.category === 'PLAYERS') {
    return item.entity_id ? { section: 'PLAYERS', entityId: item.entity_id } : { section: 'PLAYERS' };
  }
  if (!hasPlayers) return null;

  if (item.category === 'STATS') {
    return item.entity_type === 'STAT' && item.entity_id
      ? { section: 'STATS', entityId: item.entity_id }
      : { section: 'STATS' };
  }
  if (item.category === 'MONEY') {
    return item.entity_type === 'PAYMENT' && item.entity_id
      ? { section: 'PLAYERS', entityId: item.entity_id }
      : { section: 'MONEY' };
  }
  if (item.category === 'COMMITTEE') {
    return { section: 'COMMITTEE' };
  }
  if (item.category === 'AWARDS') {
    return item.entity_id ? { section: 'PLAYERS', entityId: item.entity_id } : { section: 'AWARDS' };
  }
  return null;
}

export function ActivityLog({
  variant = 'full',
  initialLogs = [],
  hasPlayers = true,
  onNavigate,
}: {
  variant?: 'compact' | 'full';
  initialLogs?: ActivityLogItem[];
  hasPlayers?: boolean;
  onNavigate: (section: SectionKey, entityId?: number) => void;
}) {
  const [compactFilter, setCompactFilter] = useState<string>('ALL');

  // Full audit trail states
  const [logs, setLogs] = useState<ActivityLogItem[]>(initialLogs);
  const [total, setTotal] = useState<number>(initialLogs.length);
  const [todayCount, setTodayCount] = useState<number>(0);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [category, setCategory] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(variant === 'full');
  const [error, setError] = useState<string>('');

  const pageSize = 25;

  const loadFullLogs = useCallback(async () => {
    if (variant !== 'full') return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('category', category);
      if (search.trim()) params.set('search', search.trim());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      params.set('limit', String(pageSize));
      params.set('offset', String(page * pageSize));

      const res = await apiFetch<ActivityLogsResponse>(`/api/activity-logs?${params.toString()}`);
      setLogs(res.logs);
      setTotal(res.total);
      setTodayCount(res.todayCount);
      setCategoryCounts(res.categoryCounts);
    } catch (err: any) {
      setError(err?.message || 'Unable to load activity log.');
    } finally {
      setLoading(false);
    }
  }, [variant, category, search, dateFrom, dateTo, page]);

  useEffect(() => {
    if (variant !== 'full') return;
    const timer = setTimeout(() => {
      loadFullLogs();
    }, 150);
    return () => clearTimeout(timer);
  }, [variant, loadFullLogs]);

  const handleExportCsv = () => {
    if (logs.length === 0) return;
    const escapeCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['ID', 'Timestamp', 'Category', 'Action', 'Details', 'Admin Actor'];
    const rows = logs.map((l) =>
      [l.id, l.created_at, l.category, l.action, l.details, l.actor || 'admin'].map(escapeCell).join(','),
    );
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kuc-activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ==================== COMPACT DASHBOARD WIDGET ====================
  if (variant === 'compact') {
    const filteredCompact = initialLogs.filter(
      (l) => compactFilter === 'ALL' || l.category === compactFilter,
    );

    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#1D4ED8]" />
            <h2 className="text-base font-bold text-[#0F172A]">Activity Log</h2>
            <span className="text-xs text-slate-400">· Audit Feed</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('ACTIVITY')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] hover:underline cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>View Full Audit Log</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {CATEGORIES.slice(0, 6).map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setCompactFilter(cat.key)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                compactFilter === cat.key
                  ? 'bg-[#0B1F3A] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {filteredCompact.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <Clock className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-medium text-slate-600">
              {initialLogs.length === 0
                ? 'No club activities recorded yet'
                : `No recent ${compactFilter.toLowerCase()} events`}
            </p>
            <p className="text-xs text-slate-500">
              Every player addition, payment toggle, stat entry, committee update, and award is recorded automatically.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCompact.slice(0, 8).map((act) => {
              const meta = CATEGORY_META[act.category] || {
                label: act.category,
                color: 'text-slate-600',
                icon: Activity,
              };
              const Icon = meta.icon;
              const ts = formatAuditTimestamp(act.created_at);
              const navTarget = getNavigationTarget(act, hasPlayers);

              return (
                <div
                  key={act.id}
                  onClick={() => navTarget && onNavigate(navTarget.section, navTarget.entityId)}
                  className={`py-3 flex items-start justify-between gap-4 ${
                    navTarget ? 'cursor-pointer hover:bg-slate-50/80 -mx-2 px-2 rounded-lg transition-colors' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-semibold text-slate-900">
                        {act.action}{' '}
                        <span className={`text-xs font-medium ${meta.color}`}>· {meta.label}</span>
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed">{act.details}</p>
                      <p className="text-[11px] text-slate-400">
                        By @{act.actor || 'admin'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums whitespace-nowrap shrink-0">
                    <p className="text-xs text-slate-600">{ts.date}</p>
                    {ts.time && <p className="text-[11px] text-slate-400">{ts.time}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ==================== FULL AUDIT LOG VIEW ====================
  const totalAllEvents = Object.values(categoryCounts).reduce((s, n) => s + n, 0);
  const financialEvents = categoryCounts.MONEY ?? 0;
  const governanceEvents = (categoryCounts.PLAYERS ?? 0) + (categoryCounts.COMMITTEE ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Club Activity Log</h1>
          <p className="text-sm text-slate-600">
            Complete audit trail of administrative actions across rosters, finances, committees, stats, and honors.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadFullLogs}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-[#0B1F3A] bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            disabled={logs.length === 0}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#1D4ED8] rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Audit Metrics Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <p className="text-xs text-slate-500">Total Logged Actions</p>
          <p className="text-2xl font-bold text-[#0F172A] tabular-nums">{totalAllEvents}</p>
          <p className="text-xs text-slate-500">Permanent database trail</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <p className="text-xs text-slate-500">Actions Today</p>
          <p className="text-2xl font-bold text-[#1D4ED8] tabular-nums">{todayCount}</p>
          <p className="text-xs text-slate-500">Recorded in last 24h UTC</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <p className="text-xs text-slate-500">Roster & Committee</p>
          <p className="text-2xl font-bold text-[#0F172A] tabular-nums">{governanceEvents}</p>
          <p className="text-xs text-slate-500">Players & board updates</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <p className="text-xs text-slate-500">Financial Audit Events</p>
          <p className="text-2xl font-bold text-emerald-700 tabular-nums">{financialEvents}</p>
          <p className="text-xs text-slate-500">Payments & club ledger</p>
        </div>
      </section>

      {/* Filters Toolbar */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => {
            const count = cat.key === 'ALL' ? totalAllEvents : categoryCounts[cat.key] ?? 0;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  setCategory(cat.key);
                  setPage(0);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                  category === cat.key
                    ? 'bg-[#0B1F3A] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search action, player name, amount, or admin actor..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
            />
          </div>

          <input
            type="date"
            value={dateFrom}
            aria-label="Filter from date"
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(0);
            }}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
          />

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateTo}
              aria-label="Filter to date"
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(0);
              }}
              className="flex-1 min-w-0 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
            />
            {(search || dateFrom || dateTo || category !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setCategory('ALL');
                  setSearch('');
                  setDateFrom('');
                  setDateTo('');
                  setPage(0);
                }}
                title="Reset filters"
                className="p-2 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {error && <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

      {/* Audit Table */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="h-11 rounded-lg bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Clock className="w-9 h-9 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No Matching Audit Events</p>
            <p className="text-xs text-slate-500">
              Try clearing your filters or perform an administrative action to record new events.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-4">Action & Details</th>
                    <th className="py-3 px-3">Admin</th>
                    <th className="py-3 px-4 text-right">Record</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {logs.map((act) => {
                    const meta = CATEGORY_META[act.category] || {
                      label: act.category,
                      color: 'text-slate-600',
                      icon: Activity,
                    };
                    const Icon = meta.icon;
                    const ts = formatAuditTimestamp(act.created_at);
                    const navTarget = getNavigationTarget(act, hasPlayers);

                    return (
                      <tr key={act.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-slate-600">
                          <div>{ts.date}</div>
                          <div className="text-[11px] text-slate-400">{ts.time}</div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${meta.color}`}>
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span>{meta.label}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-[#0F172A]">{act.action}</p>
                          <p className="text-xs text-slate-600 mt-0.5">{act.details}</p>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-xs text-slate-600">
                          @{act.actor || 'admin'}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {navTarget ? (
                            <button
                              type="button"
                              onClick={() => onNavigate(navTarget.section, navTarget.entityId)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#1D4ED8] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <span>Open</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600">
              <span className="tabular-nums">
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total} event(s)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="px-3 py-1.5 font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <span className="font-mono tabular-nums">
                  Page {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
