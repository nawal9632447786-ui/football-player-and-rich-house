import React from 'react';
import {
  Users,
  BarChart3,
  Wallet,
  Search,
  Award,
  Landmark,
  Lock,
  ArrowUpRight,
  Trophy,
  Plus,
} from 'lucide-react';
import type { AdminUser, DashboardSummary, SectionKey } from '../types.ts';
import { KucCrest, PlayerAvatar } from './ClubBrand.tsx';
import { ActivityLog } from './ActivityLog.tsx';

export function DashboardHome({
  admin,
  summary,
  loading,
  onNavigate,
}: {
  admin: AdminUser;
  summary: DashboardSummary | null;
  loading: boolean;
  onNavigate: (section: SectionKey, entityId?: number) => void;
}) {
  const hasPlayers = Boolean(summary?.hasPlayers);
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const mainButtons: Array<{
    key: SectionKey;
    label: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    locked: boolean;
  }> = [
    {
      key: 'PLAYERS',
      label: 'PLAYERS',
      subtitle: 'Squad roster, player IDs & profiles',
      icon: Users,
      locked: false,
    },
    {
      key: 'STATS',
      label: 'STATS',
      subtitle: 'Match logs, goals, ratings & rankings',
      icon: BarChart3,
      locked: !hasPlayers,
    },
    {
      key: 'MONEY',
      label: 'MONEY',
      subtitle: '₹10 weekly fees, balance & reports',
      icon: Wallet,
      locked: !hasPlayers,
    },
    {
      key: 'GOOGLE',
      label: 'GOOGLE',
      subtitle: 'KUC internal database search engine',
      icon: Search,
      locked: !hasPlayers,
    },
    {
      key: 'COMMITTEE',
      label: 'COMMITTEE',
      subtitle: 'Annual leadership & executive board',
      icon: Landmark,
      locked: !hasPlayers,
    },
  ];

  const currentCommitteeLabel = summary?.currentCommittee
    ? `${summary.currentCommittee.title} (${summary.currentCommittee.members.length} members)`
    : 'Not Assigned Yet';

  return (
    <div className="space-y-8">
      {/* Club Header Hero Banner */}
      <section className="rounded-2xl bg-gradient-to-br from-[#07172E] via-[#0B1F3A] to-[#173B6C] text-white p-6 sm:p-8 border border-[#1E40AF]/40">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4 sm:gap-5">
            <KucCrest size={68} className="shadow-md" />
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-wider text-sky-300 uppercase">
                Welcome, {admin.displayName} · {formattedDate}
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                KALANJA UNITED CLUB
              </h1>
              <p className="text-sm text-blue-100/90">
                United We Play, United We Grow.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('PLAYERS')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-white text-[#0B1F3A] hover:bg-sky-50 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{hasPlayers ? 'Manage Players' : 'Add First Player'}</span>
            </button>
            <button
              type="button"
              disabled={!hasPlayers}
              onClick={() => hasPlayers && onNavigate('AWARDS')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border transition-colors whitespace-nowrap shrink-0 ${
                hasPlayers
                  ? 'border-amber-400/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 cursor-pointer'
                  : 'border-white/15 bg-white/5 text-white/40 cursor-not-allowed'
              }`}
            >
              {hasPlayers ? <Trophy className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span>Awards & Achievements</span>
            </button>
          </div>
        </div>
      </section>

      {/* Onboarding Lock Notice when 0 players */}
      {!loading && !hasPlayers && (
        <section className="rounded-xl bg-blue-50 border border-blue-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#0B1F3A]">
              Register Your First Player to Unlock Full Club Operations
            </h2>
            <p className="text-sm text-slate-600">
              Currently, only <strong>PLAYERS</strong> is accessible. Once you register the first player,{' '}
              <strong>STATS</strong>, <strong>MONEY</strong>, <strong>GOOGLE</strong>, <strong>COMMITTEE</strong>, and{' '}
              <strong>AWARDS</strong> unlock automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('PLAYERS')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Users className="w-4 h-4" />
            <span>Open Players</span>
          </button>
        </section>
      )}

      {/* Key Metrics Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Total Players</p>
          <p className="text-3xl font-bold text-[#0F172A] tabular-nums">
            {loading ? '—' : summary?.playerCount ?? 0}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {summary?.activePlayerCount ?? 0} Active · ₹{(summary?.activePlayerCount ?? 0) * 10}/wk target
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Total Money (Club Balance)</p>
          <p className="text-3xl font-bold text-[#0F172A] tabular-nums">
            {loading ? '—' : `₹${(summary?.totalMoney ?? 0).toLocaleString('en-IN')}`}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            This week: ₹{summary?.weeklyCollected ?? 0} / ₹{summary?.weeklyExpected ?? 0}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Current Committee</p>
          <p className="text-lg font-bold text-[#0F172A] truncate" title={currentCommitteeLabel}>
            {loading ? '—' : currentCommitteeLabel}
          </p>
          <p className="text-xs text-slate-500">
            {summary?.currentCommittee
              ? `Year ${summary.currentCommittee.year} · Active Board`
              : 'Create annual committee after adding players'}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">Annual Awards</p>
          <p className="text-3xl font-bold text-[#0F172A] tabular-nums">
            {loading ? '—' : summary?.latestAwards.length ?? 0}
          </p>
          <p className="text-xs text-slate-500">
            Golden Ball · Golden Boot · Golden Gloves
          </p>
        </div>
      </section>

      {/* Five Main Navigation Buttons + Awards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0F172A]">Club Management Modules</h2>
          <span className="text-xs text-slate-500">
            {hasPlayers ? 'All modules unlocked' : '1 of 6 modules active'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mainButtons.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.key}
                type="button"
                disabled={btn.locked}
                onClick={() => !btn.locked && onNavigate(btn.key)}
                className={`group text-left rounded-xl border p-5 transition-all flex items-start justify-between gap-4 ${
                  btn.locked
                    ? 'bg-slate-100/80 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-white border-slate-200 hover:border-[#1D4ED8] hover:shadow-sm cursor-pointer'
                }`}
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      btn.locked
                        ? 'bg-slate-200 text-slate-400'
                        : 'bg-[#0B1F3A] text-white group-hover:bg-[#1D4ED8]'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-base font-bold tracking-tight ${
                          btn.locked ? 'text-slate-500' : 'text-[#0F172A]'
                        }`}
                      >
                        {btn.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {btn.locked ? 'Locked until first player is registered' : btn.subtitle}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 pt-0.5">
                  {btn.locked ? (
                    <Lock className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#1D4ED8] transition-colors" />
                  )}
                </div>
              </button>
            );
          })}

          {/* Awards & Achievements Card */}
          <button
            type="button"
            disabled={!hasPlayers}
            onClick={() => hasPlayers && onNavigate('AWARDS')}
            className={`group text-left rounded-xl border p-5 transition-all flex items-start justify-between gap-4 ${
              !hasPlayers
                ? 'bg-slate-100/80 border-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-br from-amber-50/70 to-white border-amber-200 hover:border-amber-500 hover:shadow-sm cursor-pointer'
            }`}
          >
            <div className="flex items-start gap-4 min-w-0">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  !hasPlayers
                    ? 'bg-slate-200 text-slate-400'
                    : 'bg-amber-600 text-white group-hover:bg-amber-700'
                }`}
              >
                <Award className="w-5 h-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <span
                  className={`text-base font-bold tracking-tight block ${
                    !hasPlayers ? 'text-slate-500' : 'text-[#0F172A]'
                  }`}
                >
                  AWARDS & ACHIEVEMENTS
                </span>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {!hasPlayers
                    ? 'Locked until first player is registered'
                    : 'Golden Ball, Golden Boot & Golden Gloves'}
                </p>
              </div>
            </div>
            <div className="shrink-0 pt-0.5">
              {!hasPlayers ? (
                <Lock className="w-4 h-4 text-slate-400" />
              ) : (
                <ArrowUpRight className="w-4 h-4 text-amber-600 group-hover:text-amber-800 transition-colors" />
              )}
            </div>
          </button>
        </div>
      </section>

      {/* Bottom Split: Recent Activities & Current Committee / Awards */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Activity Log Audit Feed */}
        <div className="lg:col-span-7">
          <ActivityLog
            variant="compact"
            initialLogs={summary?.recentActivities || []}
            hasPlayers={hasPlayers}
            onNavigate={onNavigate}
          />
        </div>

        {/* Current Committee Preview */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-[#0F172A]">Current Committee</h2>
            {hasPlayers && (
              <button
                type="button"
                onClick={() => onNavigate('COMMITTEE')}
                className="text-xs font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
              >
                Manage
              </button>
            )}
          </div>

          {!summary?.currentCommittee ? (
            <div className="py-10 text-center space-y-2">
              <Landmark className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-medium text-slate-600">No active committee yet</p>
              <p className="text-xs text-slate-500">
                {hasPlayers
                  ? 'Create an annual committee to assign President, Secretary, Treasurer, and Executive Members.'
                  : 'Register players first to form an executive committee.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-500">
                {summary.currentCommittee.title} · Year {summary.currentCommittee.year}
              </p>
              <div className="divide-y divide-slate-100">
                {summary.currentCommittee.members.slice(0, 6).map((m) => (
                  <div key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <PlayerAvatar src={m.photo_url} name={m.full_name} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{m.full_name}</p>
                        <p className="text-xs text-slate-500 font-mono">{m.player_code}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#1D4ED8] whitespace-nowrap shrink-0">
                      {m.position}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
