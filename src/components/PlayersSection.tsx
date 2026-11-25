import React, { useCallback, useEffect, useState } from 'react';
import {
  Search,
  UserPlus,
  Edit3,
  Trash2,
  ArrowLeft,
  Phone,
  MapPin,
  Calendar,
  Trophy,
  Wallet,
  BarChart3,
  X,
} from 'lucide-react';
import { apiFetch } from '../api.ts';
import type {
  AwardRecord,
  Player,
  PlayerPosition,
  PlayerStatRecord,
  PlayerStatTotals,
  PlayerStatus,
  WeeklyPayment,
} from '../types.ts';
import { ConfirmDialog, ImageUploadField, PlayerAvatar } from './ClubBrand.tsx';

interface HydratedPlayer extends Player {
  total_goals?: number;
  total_matches?: number;
  avg_rating?: number;
}

interface PlayerDetailPayload {
  player: Player;
  statTotals: PlayerStatTotals;
  statHistory: PlayerStatRecord[];
  payments: WeeklyPayment[];
  awards: AwardRecord[];
  committees: Array<{ position: string; year: number; title: string; is_current: number }>;
}

const POSITIONS: PlayerPosition[] = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Winger'];
const STATUSES: PlayerStatus[] = ['Active', 'Injured', 'Suspended', 'Inactive'];

export function PlayersSection({
  initialPlayerId,
  onPlayersChanged,
}: {
  initialPlayerId?: number | null;
  onPlayersChanged: () => void;
}) {
  const [players, setPlayers] = useState<HydratedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filterPosition, setFilterPosition] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');

  const [selectedProfile, setSelectedProfile] = useState<PlayerDetailPayload | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('2002-01-15');
  const [age, setAge] = useState(24);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [position, setPosition] = useState<PlayerPosition>('Midfielder');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<PlayerStatus>('Active');

  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (filterPosition !== 'ALL') params.set('position', filterPosition);
      if (filterStatus !== 'ALL') params.set('status', filterStatus);
      params.set('sort', sortBy);

      const data = await apiFetch<{ players: HydratedPlayer[] }>(`/api/players?${params.toString()}`);
      setPlayers(data.players);
    } catch (err: any) {
      setError(err?.message || 'Failed to load players.');
    } finally {
      setLoading(false);
    }
  }, [search, filterPosition, filterStatus, sortBy]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPlayers();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadPlayers]);

  const openProfile = useCallback(async (playerId: number) => {
    setLoadingProfile(true);
    try {
      const detail = await apiFetch<PlayerDetailPayload>(`/api/players/${playerId}`);
      setSelectedProfile(detail);
    } catch (err: any) {
      setError(err?.message || 'Unable to load player profile.');
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    if (initialPlayerId) {
      openProfile(initialPlayerId);
    }
  }, [initialPlayerId, openProfile]);

  const calculateAge = (dob: string) => {
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return 18;
    const now = new Date();
    let calc = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) calc -= 1;
    return Math.max(5, Math.min(99, calc));
  };

  const openAddModal = () => {
    setEditingPlayer(null);
    setFullName('');
    setPhotoUrl('');
    setDateOfBirth('2002-01-15');
    setAge(calculateAge('2002-01-15'));
    setPhone('');
    setAddress('');
    setPosition('Midfielder');
    setJoiningDate(new Date().toISOString().slice(0, 10));
    setStatus('Active');
    setFormError('');
    setFormOpen(true);
  };

  const openEditModal = (p: Player, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingPlayer(p);
    setFullName(p.full_name);
    setPhotoUrl(p.photo_url || '');
    setDateOfBirth(p.date_of_birth);
    setAge(p.age);
    setPhone(p.phone);
    setAddress(p.address);
    setPosition(p.position);
    setJoiningDate(p.joining_date);
    setStatus(p.status);
    setFormError('');
    setFormOpen(true);
  };

  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const payload = {
        full_name: fullName,
        photo_url: photoUrl,
        date_of_birth: dateOfBirth,
        age,
        phone,
        address,
        position,
        joining_date: joiningDate,
        status,
      };
      if (editingPlayer) {
        await apiFetch(`/api/players/${editingPlayer.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (selectedProfile && selectedProfile.player.id === editingPlayer.id) {
          await openProfile(editingPlayer.id);
        }
      } else {
        await apiFetch('/api/players', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setFormOpen(false);
      await loadPlayers();
      onPlayersChanged();
    } catch (err: any) {
      setFormError(err?.message || 'Unable to save player.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/players/${deleteTarget.id}`, { method: 'DELETE' });
      if (selectedProfile && selectedProfile.player.id === deleteTarget.id) {
        setSelectedProfile(null);
      }
      setDeleteTarget(null);
      await loadPlayers();
      onPlayersChanged();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete player.');
    } finally {
      setDeleting(false);
    }
  };

  const statusTone = (st: string) => {
    if (st === 'Active') return 'text-emerald-700';
    if (st === 'Injured') return 'text-amber-700';
    if (st === 'Suspended') return 'text-red-700';
    return 'text-slate-500';
  };

  // ==================== FULL PLAYER PROFILE VIEW ====================
  if (selectedProfile) {
    const { player, statTotals, statHistory, payments, awards, committees } = selectedProfile;
    const paidTotal = payments.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);
    const unpaidCount = payments.filter((p) => p.status === 'UNPAID').length;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedProfile(null)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-[#0B1F3A] bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Players</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openEditModal(player)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-xl transition-colors cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Profile</span>
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(player)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Profile Hero Header */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <PlayerAvatar src={player.photo_url} name={player.full_name} size="xl" />
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-semibold text-[#1D4ED8]">{player.player_code}</span>
                <span aria-hidden="true">·</span>
                <span>{player.position}</span>
                <span aria-hidden="true">·</span>
                <span className={`font-semibold ${statusTone(player.status)}`}>{player.status}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                {player.full_name}
              </h1>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    Age {player.age} (DOB: {player.date_of_birth})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="tabular-nums">{player.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{player.address}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Joined KUC on {player.joining_date}
                {committees.length > 0 &&
                  ` · Committee Roles: ${committees.map((c) => `${c.position} (${c.year})`).join(', ')}`}
              </p>
            </div>
          </div>
        </section>

        {/* Aggregated Statistics Strip */}
        <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: 'Matches', value: statTotals.matches_played },
            { label: 'Goals', value: statTotals.goals },
            { label: 'Assists', value: statTotals.assists },
            { label: 'Wins / Draws / Losses', value: `${statTotals.wins}/${statTotals.draws}/${statTotals.losses}` },
            { label: 'Avg Rating', value: statTotals.avg_rating || '0.0' },
            { label: 'Attendance', value: `${statTotals.avg_attendance || 0}%` },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-xl border border-slate-200 p-4 space-y-1">
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className="text-2xl font-bold text-[#0F172A] tabular-nums">{item.value}</p>
            </div>
          ))}
        </section>

        {/* Two Column Split: Stat History & Payment History */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance History */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#1D4ED8]" />
                <h2 className="text-base font-bold text-[#0F172A]">Statistics History</h2>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">{statHistory.length} records</span>
            </div>

            {statHistory.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                No statistics recorded for this player yet. Record stats in the STATS module.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {statHistory.map((st) => (
                  <div key={st.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">{st.record_label}</p>
                      <span className="text-xs font-mono text-slate-500">{st.record_date}</span>
                    </div>
                    <p className="text-xs text-slate-600 tabular-nums">
                      Matches: {st.matches_played} · Goals: {st.goals} · Assists: {st.assists} · Yellow:{' '}
                      {st.yellow_cards} · Red: {st.red_cards} · Rating: {st.performance_rating}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weekly Payment History */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#1D4ED8]" />
                <h2 className="text-base font-bold text-[#0F172A]">Weekly ₹10 Payment History</h2>
              </div>
              <span className="text-xs font-semibold text-slate-600 tabular-nums">
                Paid: ₹{paidTotal} · Pending: {unpaidCount} wk(s)
              </span>
            </div>

            {payments.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                No weekly payment records generated yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {payments.map((pay) => (
                  <div key={pay.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{pay.week_label}</p>
                      <p className="text-xs text-slate-500">
                        {pay.paid_at ? `Paid on ${pay.paid_at}` : 'Payment pending'}
                      </p>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="text-sm font-bold text-slate-900">₹{pay.amount}</p>
                      <p
                        className={`text-xs font-semibold ${
                          pay.status === 'PAID' ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {pay.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Awards Won by Player */}
        {awards.length > 0 && (
          <section className="bg-white rounded-xl border border-amber-200 p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-amber-100 pb-3">
              <Trophy className="w-4 h-4 text-amber-600" />
              <h2 className="text-base font-bold text-[#0F172A]">Club Honors & Annual Awards</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {awards.map((aw) => (
                <div key={aw.id} className="rounded-xl bg-amber-50/60 border border-amber-200 p-4 space-y-1.5">
                  <p className="text-xs font-bold text-amber-800">
                    {aw.category.replace(/_/g, ' ')} · {aw.award_year} Annual
                  </p>
                  <p className="text-sm font-semibold text-slate-900">{aw.reason}</p>
                  {aw.performance_details && <p className="text-xs text-slate-600">{aw.performance_details}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title="Delete Player Record"
          message={`Are you sure you want to permanently remove ${deleteTarget?.full_name} (${deleteTarget?.player_code})? This removes their profile and linked historical records.`}
          confirmLabel="Delete Player"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Players Management</h1>
          <p className="text-sm text-slate-600">
            Register squad members, manage player profiles, and track unique KUC Player IDs.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#1D4ED8] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Player</span>
        </button>
      </div>

      {/* Search, Filter & Sort Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, KUC ID, phone..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
          />
        </div>

        <select
          value={filterPosition}
          onChange={(e) => setFilterPosition(e.target.value)}
          aria-label="Filter by position"
          className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
        >
          <option value="ALL">All Positions</option>
          {POSITIONS.map((pos) => (
            <option key={pos} value={pos}>
              {pos}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          aria-label="Filter by status"
          className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
        >
          <option value="ALL">All Statuses</option>
          {STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          aria-label="Sort players"
          className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
        >
          <option value="newest">Sort: Newest Registered</option>
          <option value="oldest">Sort: Oldest Registered</option>
          <option value="name_asc">Sort: Name (A–Z)</option>
          <option value="name_desc">Sort: Name (Z–A)</option>
          <option value="age_asc">Sort: Age (Low–High)</option>
          <option value="age_desc">Sort: Age (High–Low)</option>
        </select>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      {/* Player Cards Grid */}
      {loading || loadingProfile ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-44 rounded-xl bg-white border border-slate-200 animate-pulse p-5" />
          ))}
        </div>
      ) : players.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1D4ED8] flex items-center justify-center mx-auto">
            <UserPlus className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-lg font-bold text-[#0F172A]">No Players Registered Yet</h2>
            <p className="text-sm text-slate-600">
              Add your first KUC player to generate their permanent Player ID and unlock Stats, Money, KUC Google,
              Committee, and Awards.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1D4ED8] hover:bg-[#1E40AF] rounded-xl transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register First Player</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {players.map((p) => (
            <div
              key={p.id}
              onClick={() => openProfile(p.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openProfile(p.id);
                }
              }}
              className="group bg-white rounded-xl border border-slate-200 hover:border-[#1D4ED8] p-5 transition-all cursor-pointer space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <PlayerAvatar src={p.photo_url} name={p.full_name} size="lg" />
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-[#1D4ED8]">{p.player_code}</span>
                      <span aria-hidden="true">·</span>
                      <span className={`font-semibold ${statusTone(p.status)}`}>{p.status}</span>
                    </div>
                    <h3 className="text-base font-bold text-[#0F172A] truncate group-hover:text-[#1D4ED8] transition-colors">
                      {p.full_name}
                    </h3>
                    <p className="text-xs text-slate-600">
                      {p.position} · Age {p.age}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => openEditModal(p, e)}
                    title="Edit player"
                    className="p-2 text-slate-400 hover:text-[#1D4ED8] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(p);
                    }}
                    title="Delete player"
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-xs tabular-nums">
                <div>
                  <span className="text-slate-400 block">Matches</span>
                  <span className="font-bold text-slate-800">{p.total_matches ?? 0}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Goals</span>
                  <span className="font-bold text-slate-800">{p.total_goals ?? 0}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Joined</span>
                  <span className="font-semibold text-slate-700">{p.joining_date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Player Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">
                  {editingPlayer ? `Edit Player (${editingPlayer.player_code})` : 'Register New Player'}
                </h2>
                <p className="text-xs text-slate-500">
                  {editingPlayer
                    ? 'Player ID remains permanently fixed.'
                    : 'A unique KUC Player ID will be automatically assigned.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlayer} className="p-6 space-y-5">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <ImageUploadField label="Player Photograph" value={photoUrl} onChange={setPhotoUrl} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Arjun Nair"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">Date of Birth</label>
                  <input
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => {
                      setDateOfBirth(e.target.value);
                      setAge(calculateAge(e.target.value));
                    }}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">Age</label>
                  <input
                    type="number"
                    min={5}
                    max={99}
                    required
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">Playing Position</label>
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value as PlayerPosition)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  >
                    {POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">Joining Date</label>
                  <input
                    type="date"
                    required
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">Player Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as PlayerStatus)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  >
                    {STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Residential Address</label>
                  <textarea
                    rows={2}
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, Town / District, PIN"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#1D4ED8] rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : editingPlayer ? 'Save Changes' : 'Register Player'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Player Record"
        message={`Are you sure you want to delete ${deleteTarget?.full_name} (${deleteTarget?.player_code})? If this is the last remaining player, other management sections will automatically lock until a new player is registered.`}
        confirmLabel="Delete Player"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
