import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Trophy,
  Star,
  Calendar,
  Edit3,
  Trash2,
  X,
  BarChart3,
} from 'lucide-react';
import { apiFetch } from '../api.ts';
import type { MatchRecord, Player, PlayerStatRecord } from '../types.ts';
import { ConfirmDialog, PlayerAvatar } from './ClubBrand.tsx';

interface LeaderboardRow {
  player_id: number;
  player_code: string;
  full_name: string;
  photo_url: string;
  position: string;
  status: string;
  matches_played: number;
  goals: number;
  assists: number;
  wins: number;
  losses: number;
  draws: number;
  yellow_cards: number;
  red_cards: number;
  clean_sheets: number;
  saves: number;
  goals_conceded: number;
  avg_attendance: number;
  avg_rating: number;
  record_count: number;
}

interface StatsPayload {
  clubTotals: {
    total_appearances: number;
    total_goals: number;
    total_assists: number;
    total_yellow_cards: number;
    total_red_cards: number;
    total_clean_sheets: number;
    avg_attendance: number;
    avg_rating: number;
  };
  matchTotals: {
    total_matches: number;
    wins: number;
    losses: number;
    draws: number;
    goals_for: number;
    goals_against: number;
  };
  playerLeaderboard: LeaderboardRow[];
  statRecords: PlayerStatRecord[];
  matches: MatchRecord[];
}

export function StatsSection({
  initialPlayerId,
  onNavigateToPlayer,
}: {
  initialPlayerId?: number | null;
  onNavigateToPlayer: (playerId: number) => void;
}) {
  const [data, setData] = useState<StatsPayload | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'records' | 'matches'>('overview');
  const [selectedPlayerFilter, setSelectedPlayerFilter] = useState<string>(
    initialPlayerId ? String(initialPlayerId) : 'ALL',
  );

  // Stat modal state
  const [statModalOpen, setStatModalOpen] = useState(false);
  const [editingStat, setEditingStat] = useState<PlayerStatRecord | null>(null);
  const [savingStat, setSavingStat] = useState(false);
  const [statFormError, setStatFormError] = useState('');

  const [formPlayerId, setFormPlayerId] = useState<string>('');
  const [formMatchId, setFormMatchId] = useState<string>('');
  const [formRecordDate, setFormRecordDate] = useState(new Date().toISOString().slice(0, 10));
  const [formRecordLabel, setFormRecordLabel] = useState('Matchday Performance');
  const [formMatchesPlayed, setFormMatchesPlayed] = useState(1);
  const [formGoals, setFormGoals] = useState(0);
  const [formAssists, setFormAssists] = useState(0);
  const [formWins, setFormWins] = useState(1);
  const [formLosses, setFormLosses] = useState(0);
  const [formDraws, setFormDraws] = useState(0);
  const [formYellow, setFormYellow] = useState(0);
  const [formRed, setFormRed] = useState(0);
  const [formCleanSheets, setFormCleanSheets] = useState(0);
  const [formSaves, setFormSaves] = useState(0);
  const [formGoalsConceded, setFormGoalsConceded] = useState(0);
  const [formAttendance, setFormAttendance] = useState(100);
  const [formRating, setFormRating] = useState(7.5);
  const [customStatKey, setCustomStatKey] = useState('');
  const [customStatVal, setCustomStatVal] = useState('');

  // Match modal state
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [savingMatch, setSavingMatch] = useState(false);
  const [matchError, setMatchError] = useState('');
  const [matchDate, setMatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [opponent, setOpponent] = useState('');
  const [competition, setCompetition] = useState('District League');
  const [venue, setVenue] = useState('KUC Home Ground');
  const [kucScore, setKucScore] = useState(2);
  const [opponentScore, setOpponentScore] = useState(1);
  const [matchNotes, setMatchNotes] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<PlayerStatRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, playersRes] = await Promise.all([
        apiFetch<StatsPayload>('/api/stats'),
        apiFetch<{ players: Player[] }>('/api/players'),
      ]);
      setData(statsRes);
      setPlayers(playersRes.players);
    } catch (err: any) {
      setError(err?.message || 'Unable to load club statistics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const openAddStat = () => {
    setEditingStat(null);
    setFormPlayerId(players[0] ? String(players[0].id) : '');
    setFormMatchId('');
    setFormRecordDate(new Date().toISOString().slice(0, 10));
    setFormRecordLabel('Matchday Performance');
    setFormMatchesPlayed(1);
    setFormGoals(0);
    setFormAssists(0);
    setFormWins(1);
    setFormLosses(0);
    setFormDraws(0);
    setFormYellow(0);
    setFormRed(0);
    setFormCleanSheets(0);
    setFormSaves(0);
    setFormGoalsConceded(0);
    setFormAttendance(100);
    setFormRating(7.5);
    setCustomStatKey('');
    setCustomStatVal('');
    setStatFormError('');
    setStatModalOpen(true);
  };

  const openEditStat = (rec: PlayerStatRecord) => {
    setEditingStat(rec);
    setFormPlayerId(String(rec.player_id));
    setFormMatchId(rec.match_id ? String(rec.match_id) : '');
    setFormRecordDate(rec.record_date);
    setFormRecordLabel(rec.record_label);
    setFormMatchesPlayed(rec.matches_played);
    setFormGoals(rec.goals);
    setFormAssists(rec.assists);
    setFormWins(rec.wins);
    setFormLosses(rec.losses);
    setFormDraws(rec.draws);
    setFormYellow(rec.yellow_cards);
    setFormRed(rec.red_cards);
    setFormCleanSheets(rec.clean_sheets);
    setFormSaves(rec.saves);
    setFormGoalsConceded(rec.goals_conceded);
    setFormAttendance(rec.attendance);
    setFormRating(rec.performance_rating);
    try {
      const parsed = JSON.parse(rec.custom_stats || '{}');
      const keys = Object.keys(parsed);
      setCustomStatKey(keys[0] || '');
      setCustomStatVal(keys[0] ? String(parsed[keys[0]]) : '');
    } catch {
      setCustomStatKey('');
      setCustomStatVal('');
    }
    setStatFormError('');
    setStatModalOpen(true);
  };

  const handleSaveStat = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatFormError('');
    setSavingStat(true);
    try {
      const customStats: Record<string, string> = {};
      if (customStatKey.trim() && customStatVal.trim()) {
        customStats[customStatKey.trim()] = customStatVal.trim();
      }
      const payload = {
        player_id: Number(formPlayerId),
        match_id: formMatchId ? Number(formMatchId) : null,
        record_date: formRecordDate,
        record_label: formRecordLabel,
        matches_played: formMatchesPlayed,
        goals: formGoals,
        assists: formAssists,
        wins: formWins,
        losses: formLosses,
        draws: formDraws,
        yellow_cards: formYellow,
        red_cards: formRed,
        clean_sheets: formCleanSheets,
        saves: formSaves,
        goals_conceded: formGoalsConceded,
        attendance: formAttendance,
        performance_rating: formRating,
        custom_stats: customStats,
      };
      if (editingStat) {
        await apiFetch(`/api/stats/record/${editingStat.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/stats/record', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setStatModalOpen(false);
      await loadStats();
    } catch (err: any) {
      setStatFormError(err?.message || 'Unable to save statistics record.');
    } finally {
      setSavingStat(false);
    }
  };

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setMatchError('');
    setSavingMatch(true);
    try {
      await apiFetch('/api/matches', {
        method: 'POST',
        body: JSON.stringify({
          match_date: matchDate,
          opponent,
          competition,
          venue,
          kuc_score: kucScore,
          opponent_score: opponentScore,
          notes: matchNotes,
        }),
      });
      setMatchModalOpen(false);
      setOpponent('');
      setMatchNotes('');
      await loadStats();
    } catch (err: any) {
      setMatchError(err?.message || 'Unable to log match.');
    } finally {
      setSavingMatch(false);
    }
  };

  const confirmDeleteStat = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/stats/record/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await loadStats();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete stat record.');
    } finally {
      setDeleting(false);
    }
  };

  const leaderboard = data?.playerLeaderboard || [];
  const topScorers = [...leaderboard].sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 6);
  const bestPlayers = [...leaderboard].sort((a, b) => b.avg_rating - a.avg_rating || b.goals - a.goals).slice(0, 6);
  const maxGoals = Math.max(1, ...topScorers.map((p) => p.goals));

  const filteredRecords = (data?.statRecords || []).filter(
    (r) => selectedPlayerFilter === 'ALL' || String(r.player_id) === selectedPlayerFilter,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Statistics & Performance</h1>
          <p className="text-sm text-slate-600">
            Historical player performance ledger, match history, and automated club rankings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setMatchModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#0B1F3A] bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span>Log Match</span>
          </button>
          <button
            type="button"
            onClick={openAddStat}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#1D4ED8] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Player Stats</span>
          </button>
        </div>
      </div>

      {/* Club Totals Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <p className="text-xs text-slate-500">Club Matches (W–D–L)</p>
          <p className="text-2xl font-bold text-[#0F172A] tabular-nums">
            {data?.matchTotals.total_matches ?? 0}
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {data?.matchTotals.wins ?? 0}W · {data?.matchTotals.draws ?? 0}D · {data?.matchTotals.losses ?? 0}L
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <p className="text-xs text-slate-500">Total Club Goals & Assists</p>
          <p className="text-2xl font-bold text-[#0F172A] tabular-nums">
            {data?.clubTotals.total_goals ?? 0} <span className="text-sm font-medium text-slate-500">G</span> /{' '}
            {data?.clubTotals.total_assists ?? 0} <span className="text-sm font-medium text-slate-500">A</span>
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            {data?.clubTotals.total_clean_sheets ?? 0} Clean Sheets
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <p className="text-xs text-slate-500">Average Attendance</p>
          <p className="text-2xl font-bold text-[#0F172A] tabular-nums">
            {data?.clubTotals.avg_attendance ?? 0}%
          </p>
          <p className="text-xs text-slate-500">Squad training & match presence</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
          <p className="text-xs text-slate-500">Average Rating</p>
          <p className="text-2xl font-bold text-[#1D4ED8] tabular-nums">
            {data?.clubTotals.avg_rating ?? 0} / 10
          </p>
          <p className="text-xs text-slate-500 tabular-nums">
            Cards: {data?.clubTotals.total_yellow_cards ?? 0}Y · {data?.clubTotals.total_red_cards ?? 0}R
          </p>
        </div>
      </section>

      {/* Segmented Tabs */}
      <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
        {[
          { key: 'overview', label: 'Rankings & Charts' },
          { key: 'records', label: `Stat History (${data?.statRecords.length ?? 0})` },
          { key: 'matches', label: `Match History (${data?.matches.length ?? 0})` },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === tab.key ? 'bg-white text-[#0F172A] shadow-xs' : 'text-slate-600 hover:text-[#0F172A]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse" />
      ) : activeTab === 'overview' ? (
        <div className="space-y-6">
          {/* Performance Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Scorers Bar Chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#1D4ED8]" />
                  <h2 className="text-base font-bold text-[#0F172A]">Top Scorer Ranking</h2>
                </div>
                <span className="text-xs text-slate-500">Goals & Assists</span>
              </div>

              {topScorers.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">No player statistics recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {topScorers.map((p, idx) => {
                    const widthPct = Math.max(4, Math.round((p.goals / maxGoals) * 100));
                    return (
                      <div
                        key={p.player_id}
                        onClick={() => onNavigateToPlayer(p.player_id)}
                        className="space-y-1.5 cursor-pointer group"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800 group-hover:text-[#1D4ED8]">
                            {idx + 1}. {p.full_name}{' '}
                            <span className="font-mono text-slate-400">({p.player_code})</span>
                          </span>
                          <span className="font-mono font-bold text-[#0F172A] tabular-nums">
                            {p.goals}G · {p.assists}A
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#0B1F3A] to-[#2563EB] rounded-full transition-all"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Best Player Rating Ranking */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <h2 className="text-base font-bold text-[#0F172A]">Best Player Ranking</h2>
                </div>
                <span className="text-xs text-slate-500">By Average Rating</span>
              </div>

              {bestPlayers.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">Record player stats to compute rankings.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {bestPlayers.map((p, idx) => (
                    <div
                      key={p.player_id}
                      onClick={() => onNavigateToPlayer(p.player_id)}
                      className="py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 px-2 rounded-lg"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-5 text-xs font-mono font-bold text-slate-400">#{idx + 1}</span>
                        <PlayerAvatar src={p.photo_url} name={p.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{p.full_name}</p>
                          <p className="text-xs text-slate-500">
                            {p.position} · {p.matches_played} matches
                          </p>
                        </div>
                      </div>
                      <div className="text-right tabular-nums shrink-0">
                        <p className="text-sm font-bold text-[#1D4ED8]">{p.avg_rating || '—'}</p>
                        <p className="text-xs text-slate-400">{p.avg_attendance || 0}% att.</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Complete Squad Totals Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#1D4ED8]" />
                <h2 className="text-base font-bold text-[#0F172A]">Squad Career & Season Totals</h2>
              </div>
              <span className="text-xs text-slate-500">Aggregated from historical records</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Player</th>
                    <th className="py-3 px-3 text-right">MP</th>
                    <th className="py-3 px-3 text-right">G</th>
                    <th className="py-3 px-3 text-right">A</th>
                    <th className="py-3 px-3 text-right">W/D/L</th>
                    <th className="py-3 px-3 text-right">YC/RC</th>
                    <th className="py-3 px-3 text-right">CS</th>
                    <th className="py-3 px-3 text-right">Att%</th>
                    <th className="py-3 px-4 text-right">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {leaderboard.map((row) => (
                    <tr
                      key={row.player_id}
                      onClick={() => onNavigateToPlayer(row.player_id)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <PlayerAvatar src={row.photo_url} name={row.full_name} size="sm" />
                          <div>
                            <p className="font-semibold text-slate-900">{row.full_name}</p>
                            <p className="text-xs text-slate-500 font-mono">
                              {row.player_code} · {row.position}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium">{row.matches_played}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#0F172A]">{row.goals}</td>
                      <td className="py-2.5 px-3 text-right">{row.assists}</td>
                      <td className="py-2.5 px-3 text-right text-xs text-slate-600">
                        {row.wins}/{row.draws}/{row.losses}
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs text-slate-600">
                        {row.yellow_cards}/{row.red_cards}
                      </td>
                      <td className="py-2.5 px-3 text-right">{row.clean_sheets}</td>
                      <td className="py-2.5 px-3 text-right">{row.avg_attendance}%</td>
                      <td className="py-2.5 px-4 text-right font-bold text-[#1D4ED8]">{row.avg_rating || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'records' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Historical Performance Entries</h2>
              <p className="text-xs text-slate-500">Previous records remain permanently preserved when new stats are added.</p>
            </div>
            <select
              value={selectedPlayerFilter}
              onChange={(e) => setSelectedPlayerFilter(e.target.value)}
              className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="ALL">All Players</option>
              {players.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.full_name} ({p.player_code})
                </option>
              ))}
            </select>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm text-slate-600">No statistical records logged yet.</p>
              <button
                type="button"
                onClick={openAddStat}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1D4ED8] rounded-lg cursor-pointer"
              >
                Add First Stat Entry
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Date & Label</th>
                    <th className="py-3 px-4">Player</th>
                    <th className="py-3 px-3 text-right">MP</th>
                    <th className="py-3 px-3 text-right">G / A</th>
                    <th className="py-3 px-3 text-right">Att%</th>
                    <th className="py-3 px-3 text-right">Rating</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {filteredRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{rec.record_label}</p>
                        <p className="text-xs text-slate-500 font-mono">
                          {rec.record_date}
                          {rec.opponent ? ` · vs ${rec.opponent}` : ''}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-800">{rec.player_name}</p>
                        <p className="text-xs text-slate-500 font-mono">{rec.player_code}</p>
                      </td>
                      <td className="py-3 px-3 text-right">{rec.matches_played}</td>
                      <td className="py-3 px-3 text-right font-semibold">
                        {rec.goals} / {rec.assists}
                      </td>
                      <td className="py-3 px-3 text-right">{rec.attendance}%</td>
                      <td className="py-3 px-3 text-right font-bold text-[#1D4ED8]">{rec.performance_rating}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditStat(rec)}
                            title="Edit stat record"
                            className="p-1.5 text-slate-400 hover:text-[#1D4ED8] hover:bg-blue-50 rounded-lg cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(rec)}
                            title="Delete stat record"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Matches History */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0F172A]">Club Match History</h2>
            <button
              type="button"
              onClick={() => setMatchModalOpen(true)}
              className="text-xs font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
            >
              + Log Match
            </button>
          </div>
          {!data?.matches.length ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm text-slate-600">No matches logged yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.matches.map((m) => (
                <div key={m.id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#0F172A]">
                      KUC {m.kuc_score} – {m.opponent_score} {m.opponent}
                    </p>
                    <p className="text-xs text-slate-500">
                      {m.match_date} · {m.competition} · {m.venue}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold uppercase tracking-wide ${
                      m.result === 'Win'
                        ? 'text-emerald-700'
                        : m.result === 'Loss'
                          ? 'text-red-600'
                          : 'text-amber-700'
                    }`}
                  >
                    {m.result}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Stat Modal */}
      {statModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#0F172A]">
                {editingStat ? 'Edit Statistics Record' : 'Record Player Statistics'}
              </h2>
              <button type="button" onClick={() => setStatModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStat} className="p-6 space-y-4">
              {statFormError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  {statFormError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Player</label>
                  <select
                    disabled={Boolean(editingStat)}
                    required
                    value={formPlayerId}
                    onChange={(e) => setFormPlayerId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white disabled:bg-slate-100"
                  >
                    {players.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.full_name} ({p.player_code} · {p.position})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Link to Match (Optional)</label>
                  <select
                    value={formMatchId}
                    onChange={(e) => setFormMatchId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">Standalone / Training Block</option>
                    {(data?.matches || []).map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        {m.match_date} vs {m.opponent} ({m.kuc_score}-{m.opponent_score})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Record Label</label>
                  <input
                    type="text"
                    required
                    value={formRecordLabel}
                    onChange={(e) => setFormRecordLabel(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Record Date</label>
                  <input
                    type="date"
                    required
                    value={formRecordDate}
                    onChange={(e) => setFormRecordDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {[
                  { label: 'Matches Played', val: formMatchesPlayed, set: setFormMatchesPlayed },
                  { label: 'Goals', val: formGoals, set: setFormGoals },
                  { label: 'Assists', val: formAssists, set: setFormAssists },
                  { label: 'Wins', val: formWins, set: setFormWins },
                  { label: 'Draws', val: formDraws, set: setFormDraws },
                  { label: 'Losses', val: formLosses, set: setFormLosses },
                  { label: 'Yellow Cards', val: formYellow, set: setFormYellow },
                  { label: 'Red Cards', val: formRed, set: setFormRed },
                  { label: 'Clean Sheets', val: formCleanSheets, set: setFormCleanSheets },
                  { label: 'Saves (GK)', val: formSaves, set: setFormSaves },
                  { label: 'Goals Conceded', val: formGoalsConceded, set: setFormGoalsConceded },
                ].map((f) => (
                  <div key={f.label} className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">{f.label}</label>
                    <input
                      type="number"
                      min={0}
                      value={f.val}
                      onChange={(e) => f.set(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg tabular-nums"
                    />
                  </div>
                ))}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Attendance (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={formAttendance}
                    onChange={(e) => setFormAttendance(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Rating (1–10)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    step="0.1"
                    value={formRating}
                    onChange={(e) => setFormRating(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Custom Stat Name (Optional)</label>
                  <input
                    type="text"
                    value={customStatKey}
                    onChange={(e) => setCustomStatKey(e.target.value)}
                    placeholder="e.g., Key Passes"
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Custom Stat Value</label>
                  <input
                    type="text"
                    value={customStatVal}
                    onChange={(e) => setCustomStatVal(e.target.value)}
                    placeholder="e.g., 12"
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStat}
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#1D4ED8] rounded-lg cursor-pointer"
                >
                  {savingStat ? 'Saving...' : editingStat ? 'Update Record' : 'Save Stat Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Match Modal */}
      {matchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#0F172A]">Log Club Match</h2>
              <button type="button" onClick={() => setMatchModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateMatch} className="p-6 space-y-4">
              {matchError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{matchError}</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Opponent Club</label>
                  <input
                    type="text"
                    required
                    value={opponent}
                    onChange={(e) => setOpponent(e.target.value)}
                    placeholder="e.g., Malabar Rovers FC"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Match Date</label>
                  <input
                    type="date"
                    required
                    value={matchDate}
                    onChange={(e) => setMatchDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Competition</label>
                  <input
                    type="text"
                    value={competition}
                    onChange={(e) => setCompetition(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">KUC Score</label>
                  <input
                    type="number"
                    min={0}
                    value={kucScore}
                    onChange={(e) => setKucScore(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Opponent Score</label>
                  <input
                    type="number"
                    min={0}
                    value={opponentScore}
                    onChange={(e) => setOpponentScore(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Venue</label>
                  <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Match Notes</label>
                  <textarea
                    rows={2}
                    value={matchNotes}
                    onChange={(e) => setMatchNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMatchModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMatch}
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#1D4ED8] rounded-lg cursor-pointer"
                >
                  {savingMatch ? 'Saving...' : 'Save Match'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Statistical Entry"
        message={`Remove stat record "${deleteTarget?.record_label}" for ${deleteTarget?.player_name}?`}
        confirmLabel="Delete Entry"
        busy={deleting}
        onConfirm={confirmDeleteStat}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
