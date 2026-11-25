import React, { useCallback, useEffect, useState } from 'react';
import { Trophy, Award, Shield, Plus, Edit3, Trash2, X, Calendar, Lock, CalendarPlus } from 'lucide-react';
import { apiFetch } from '../api.ts';
import type { AwardCategory, AwardRecord, AwardYear, Player } from '../types.ts';
import { ConfirmDialog, ImageUploadField, PlayerAvatar, TROPHY_IMAGE_PATH } from './ClubBrand.tsx';

const AWARD_META: Record<
  AwardCategory,
  {
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  GOLDEN_BALL: {
    title: 'GOLDEN BALL',
    subtitle: 'Best Overall Player of the Year',
    icon: Trophy,
  },
  GOLDEN_BOOT: {
    title: 'GOLDEN BOOT',
    subtitle: 'Top Goal Scorer of the Year',
    icon: Award,
  },
  GOLDEN_GLOVES: {
    title: 'GOLDEN GLOVES',
    subtitle: 'Best Goalkeeper of the Year',
    icon: Shield,
  },
};

export function AwardsSection({
  onNavigateToPlayer,
}: {
  onNavigateToPlayer: (playerId: number) => void;
}) {
  const [awards, setAwards] = useState<AwardRecord[]>([]);
  const [awardYears, setAwardYears] = useState<AwardYear[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected started year (null when no year has been started yet)
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [historyFilterCat, setHistoryFilterCat] = useState<string>('ALL');

  // Start New Year modal state
  const [startYearModalOpen, setStartYearModalOpen] = useState(false);
  const [newYearInput, setNewYearInput] = useState<number>(new Date().getFullYear());
  const [newYearTitle, setNewYearTitle] = useState<string>(`${new Date().getFullYear()} Annual Awards`);
  const [startingYear, setStartingYear] = useState(false);
  const [startYearError, setStartYearError] = useState('');

  // Publish / Edit Award modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAward, setEditingAward] = useState<AwardRecord | null>(null);
  const [formCategory, setFormCategory] = useState<AwardCategory>('GOLDEN_BALL');
  const [formYear, setFormYear] = useState<number>(new Date().getFullYear());
  const [formPlayerId, setFormPlayerId] = useState<string>('');
  const [formPhotoUrl, setFormPhotoUrl] = useState<string>('');
  const [formReason, setFormReason] = useState<string>('');
  const [formDetails, setFormDetails] = useState<string>('');
  const [formGoals, setFormGoals] = useState<number>(0);
  const [formCleanSheets, setFormCleanSheets] = useState<number>(0);
  const [formSaves, setFormSaves] = useState<number>(0);
  const [formGoalsConceded, setFormGoalsConceded] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<AwardRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [trophyImgFailed, setTrophyImgFailed] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [awRes, pRes] = await Promise.all([
        apiFetch<{ awards: AwardRecord[]; awardYears: AwardYear[] }>('/api/awards'),
        apiFetch<{ players: Player[] }>('/api/players'),
      ]);
      setAwards(awRes.awards);
      setAwardYears(awRes.awardYears);
      setPlayers(pRes.players);

      setSelectedYear((prev) => {
        if (awRes.awardYears.length === 0) return null;
        if (prev !== null && awRes.awardYears.some((y) => y.year === prev)) {
          return prev;
        }
        const active = awRes.awardYears.find((y) => y.is_active === 1);
        return active ? active.year : awRes.awardYears[0].year;
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to load awards & achievements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openStartYearModal = () => {
    const currentYear = new Date().getFullYear();
    const suggestedYear =
      awardYears.length > 0 && awardYears.some((y) => y.year === currentYear)
        ? Math.max(...awardYears.map((y) => y.year)) + 1
        : currentYear;
    setNewYearInput(suggestedYear);
    setNewYearTitle(`${suggestedYear} Annual Awards`);
    setStartYearError('');
    setStartYearModalOpen(true);
  };

  const handleStartNewYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setStartYearError('');
    setStartingYear(true);
    try {
      const res = await apiFetch<{ awardYear: AwardYear }>('/api/awards/start-year', {
        method: 'POST',
        body: JSON.stringify({
          year: newYearInput,
          title: newYearTitle,
          set_active: true,
        }),
      });
      setStartYearModalOpen(false);
      setSelectedYear(res.awardYear.year);
      await loadData();
    } catch (err: any) {
      setStartYearError(err?.message || 'Unable to start award year.');
    } finally {
      setStartingYear(false);
    }
  };

  const openAwardModal = (category: AwardCategory, existing?: AwardRecord) => {
    if (!existing && selectedYear === null) {
      openStartYearModal();
      return;
    }
    setFormError('');
    if (existing) {
      setEditingAward(existing);
      setFormCategory(existing.category);
      setFormYear(existing.award_year);
      setFormPlayerId(String(existing.player_id));
      setFormPhotoUrl(existing.winner_photo_url || '');
      setFormReason(existing.reason);
      setFormDetails(existing.performance_details || '');
      setFormGoals(existing.goals_scored);
      setFormCleanSheets(existing.clean_sheets);
      setFormSaves(existing.saves);
      setFormGoalsConceded(existing.goals_conceded);
    } else {
      setEditingAward(null);
      setFormCategory(category);
      setFormYear(selectedYear as number);
      const goalkeepers = players.filter((p) => p.position === 'Goalkeeper');
      const defaultPlayer = category === 'GOLDEN_GLOVES' && goalkeepers.length > 0 ? goalkeepers[0] : players[0];
      setFormPlayerId(defaultPlayer ? String(defaultPlayer.id) : '');
      setFormPhotoUrl(defaultPlayer?.photo_url || '');
      setFormReason('');
      setFormDetails('');
      setFormGoals(0);
      setFormCleanSheets(0);
      setFormSaves(0);
      setFormGoalsConceded(0);
    }
    setModalOpen(true);
  };

  const handleSaveAward = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const payload = {
        category: formCategory,
        period_type: 'ANNUAL',
        award_year: formYear,
        player_id: Number(formPlayerId),
        winner_photo_url: formPhotoUrl,
        reason: formReason,
        performance_details: formDetails,
        goals_scored: formGoals,
        clean_sheets: formCleanSheets,
        saves: formSaves,
        goals_conceded: formGoalsConceded,
        published: 1,
      };
      if (editingAward) {
        await apiFetch(`/api/awards/${editingAward.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/awards', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err?.message || 'Unable to publish award.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteAward = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/awards/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Unable to delete award.');
    } finally {
      setDeleting(false);
    }
  };

  const hasStartedYear = awardYears.length > 0 && selectedYear !== null;
  const activeYearRecord = awardYears.find((y) => y.year === selectedYear) || null;
  const yearAwards = hasStartedYear ? awards.filter((a) => a.award_year === selectedYear) : [];
  const getYearWinner = (cat: AwardCategory) => yearAwards.find((a) => a.category === cat);

  const filteredHistory = awards.filter(
    (a) => historyFilterCat === 'ALL' || a.category === historyFilterCat,
  );

  const gkPlayers = players.filter((p) => p.position === 'Goalkeeper');
  const selectablePlayers = formCategory === 'GOLDEN_GLOVES' && gkPlayers.length > 0 ? gkPlayers : players;

  return (
    <div className="space-y-8">
      {/* Prestigious Gold + Navy Header Banner */}
      <section className="rounded-2xl bg-gradient-to-br from-[#07172E] via-[#0B1F3A] to-[#1E3A5F] text-white p-6 sm:p-8 border border-amber-400/30">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-5">
            {!trophyImgFailed ? (
              <img
                src={TROPHY_IMAGE_PATH}
                alt="KUC Golden Trophy"
                referrerPolicy="no-referrer"
                onError={() => setTrophyImgFailed(true)}
                className="w-20 h-20 rounded-2xl object-cover border border-amber-400/40 shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                <Trophy className="w-10 h-10 text-amber-300" />
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-widest text-amber-300 uppercase">
                Annual Club Honors · Once Per Year
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                AWARDS & ACHIEVEMENTS
              </h1>
              <p className="text-sm text-blue-100/90">
                Golden Ball, Golden Boot, and Golden Gloves awarded once per season year.
              </p>
            </div>
          </div>

          {/* Started Year Selector + Start New Year Button */}
          <div className="flex flex-wrap items-center gap-2.5 bg-white/10 p-3 rounded-xl border border-white/15 shrink-0">
            {hasStartedYear ? (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-200 shrink-0" />
                <select
                  value={String(selectedYear)}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  aria-label="Select started award year"
                  className="px-3 py-1.5 text-xs font-semibold bg-[#0B1F3A] text-white border border-white/20 rounded-lg"
                >
                  {awardYears.map((ay) => (
                    <option key={ay.id} value={String(ay.year)}>
                      {ay.year} — {ay.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-200">
                <Lock className="w-3.5 h-3.5" />
                <span>No Year Started</span>
              </span>
            )}

            <button
              type="button"
              onClick={openStartYearModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-[#07172E] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              <span>Start New Year</span>
            </button>
          </div>
        </div>
      </section>

      {error && <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

      {/* Locked State when NO award year has been started */}
      {!loading && !hasStartedYear ? (
        <section className="bg-white rounded-2xl border border-amber-200 p-10 sm:p-12 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-xl font-extrabold text-[#0F172A]">No Award Year Started Yet</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Golden Ball, Golden Boot, and Golden Gloves remain locked until you explicitly select{' '}
              <strong>Start New Year</strong>. Starting a year opens the three annual honors for that season.
            </p>
          </div>
          <button
            type="button"
            onClick={openStartYearModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-[#07172E] bg-amber-400 hover:bg-amber-500 rounded-xl transition-colors cursor-pointer"
          >
            <CalendarPlus className="w-4 h-4" />
            <span>Start New Year</span>
          </button>
        </section>
      ) : (
        /* Three Major Annual Gold Trophy Cards */
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-[#0F172A]">
              {activeYearRecord ? `${activeYearRecord.title} (${activeYearRecord.year})` : `${selectedYear} Annual Awards`}
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {yearAwards.length} of 3 annual honors published
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {(['GOLDEN_BALL', 'GOLDEN_BOOT', 'GOLDEN_GLOVES'] as AwardCategory[]).map((cat) => {
              const meta = AWARD_META[cat];
              const Icon = meta.icon;
              const winner = getYearWinner(cat);

              return (
                <div
                  key={cat}
                  className="rounded-2xl border border-amber-300/80 bg-gradient-to-b from-amber-50/90 via-white to-white p-6 flex flex-col justify-between gap-5 transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold text-[#0B1F3A] tracking-tight">{meta.title}</h3>
                          <p className="text-xs text-amber-800 font-medium">{meta.subtitle}</p>
                        </div>
                      </div>
                    </div>

                    {loading ? (
                      <div className="h-28 rounded-xl bg-amber-100/40 animate-pulse" />
                    ) : winner ? (
                      <div className="space-y-4">
                        <div
                          onClick={() => onNavigateToPlayer(winner.player_id)}
                          className="flex items-center gap-3.5 p-3 rounded-xl bg-white border border-amber-200 cursor-pointer hover:border-amber-400 transition-colors"
                        >
                          <PlayerAvatar
                            src={winner.winner_photo_url || winner.player_photo}
                            name={winner.player_name}
                            size="lg"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-mono text-amber-700 font-semibold">{winner.player_code}</p>
                            <p className="text-lg font-extrabold text-[#0F172A] truncate">{winner.player_name}</p>
                            <p className="text-xs text-slate-600">{winner.player_position}</p>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-sm font-semibold text-slate-900">{winner.reason}</p>
                          {winner.performance_details && (
                            <p className="text-xs text-slate-600 leading-relaxed">{winner.performance_details}</p>
                          )}
                        </div>

                        {/* Category-Specific Stats */}
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-100 text-xs tabular-nums">
                          {cat === 'GOLDEN_BOOT' ? (
                            <>
                              <div>
                                <span className="text-slate-400 block">Goals</span>
                                <span className="font-bold text-amber-800 text-base">{winner.goals_scored}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-slate-400 block">Season Year</span>
                                <span className="font-semibold text-slate-700">{winner.award_year} Annual</span>
                              </div>
                            </>
                          ) : cat === 'GOLDEN_GLOVES' ? (
                            <>
                              <div>
                                <span className="text-slate-400 block">Clean Sheets</span>
                                <span className="font-bold text-amber-800 text-base">{winner.clean_sheets}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block">Saves</span>
                                <span className="font-bold text-slate-800 text-base">{winner.saves}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block">Conceded</span>
                                <span className="font-bold text-slate-800 text-base">{winner.goals_conceded}</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <span className="text-slate-400 block">Goals</span>
                                <span className="font-bold text-amber-800 text-base">{winner.goals_scored}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-slate-400 block">Season Year</span>
                                <span className="font-semibold text-slate-700">{winner.award_year} Annual</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center rounded-xl border border-dashed border-amber-200 bg-amber-50/40 px-4 space-y-2">
                        <p className="text-sm font-semibold text-slate-700">Not Published Yet</p>
                        <p className="text-xs text-slate-500">
                          Select a registered player and publish the {meta.title.toLowerCase()} winner for{' '}
                          {selectedYear}.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-amber-100 flex items-center justify-between gap-2">
                    {winner ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openAwardModal(cat, winner)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0B1F3A] bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Winner</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(winner)}
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openAwardModal(cat)}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#0B1F3A] to-[#1D4ED8] hover:from-amber-600 hover:to-amber-700 rounded-xl transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Publish {meta.title}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Permanent Annual Award History Archive */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">Permanent Annual Award History</h2>
            <p className="text-xs text-slate-500">All yearly Golden Ball, Golden Boot, and Golden Gloves winners preserved permanently.</p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              { key: 'ALL', label: 'All' },
              { key: 'GOLDEN_BALL', label: 'Golden Ball' },
              { key: 'GOLDEN_BOOT', label: 'Golden Boot' },
              { key: 'GOLDEN_GLOVES', label: 'Golden Gloves' },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setHistoryFilterCat(f.key)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  historyFilterCat === f.key ? 'bg-white text-[#0F172A] shadow-xs' : 'text-slate-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            {hasStartedYear
              ? 'No annual awards published yet. Publish winners above to build the club honors archive.'
              : 'Start a new award year above before publishing annual honors.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-4">Award</th>
                  <th className="py-3 px-4">Winner</th>
                  <th className="py-3 px-3">Year</th>
                  <th className="py-3 px-4">Performance Stats</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {filteredHistory.map((aw) => (
                  <tr key={aw.id} className="hover:bg-amber-50/30">
                    <td className="py-3 px-4 font-bold text-amber-800 whitespace-nowrap">
                      {aw.category.replace(/_/g, ' ')}
                    </td>
                    <td
                      className="py-3 px-4 cursor-pointer"
                      onClick={() => onNavigateToPlayer(aw.player_id)}
                    >
                      <div className="flex items-center gap-3">
                        <PlayerAvatar
                          src={aw.winner_photo_url || aw.player_photo}
                          name={aw.player_name}
                          size="sm"
                        />
                        <div>
                          <p className="font-semibold text-[#0F172A] hover:text-[#1D4ED8]">{aw.player_name}</p>
                          <p className="text-xs text-slate-500 font-mono">{aw.player_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-xs font-mono font-semibold text-slate-700 whitespace-nowrap">
                      {aw.award_year}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      <p className="font-semibold text-slate-800">{aw.reason}</p>
                      {aw.category === 'GOLDEN_GLOVES' ? (
                        <p>
                          Clean Sheets: {aw.clean_sheets} · Saves: {aw.saves} · Conceded: {aw.goals_conceded}
                        </p>
                      ) : (
                        <p>Goals: {aw.goals_scored}{aw.performance_details ? ` · ${aw.performance_details}` : ''}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openAwardModal(aw.category, aw)}
                        className="p-1.5 text-slate-400 hover:text-[#1D4ED8] rounded-lg cursor-pointer"
                        title="Edit award"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(aw)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                        title="Delete award"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Start New Award Year Modal */}
      {startYearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-amber-200 shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">Start New Award Year</h2>
                <p className="text-xs text-slate-500">
                  Initialize Golden Ball, Golden Boot, and Golden Gloves for a single season year.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStartYearModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStartNewYear} className="p-6 space-y-4">
              {startYearError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  {startYearError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Award Year</label>
                <input
                  type="number"
                  min={1950}
                  max={2100}
                  required
                  value={newYearInput}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    setNewYearInput(y);
                    setNewYearTitle(`${y} Annual Awards`);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Season / Cycle Title</label>
                <input
                  type="text"
                  required
                  value={newYearTitle}
                  onChange={(e) => setNewYearTitle(e.target.value)}
                  placeholder="2026 Annual Awards"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Previous years&apos; winners remain permanently preserved. Only 1 Golden Ball, 1 Golden Boot, and 1
                Golden Gloves winner can be awarded per year.
              </p>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStartYearModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={startingYear}
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#1D4ED8] rounded-lg cursor-pointer"
                >
                  {startingYear ? 'Starting...' : 'Start Award Year'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Publish / Edit Award Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-white rounded-2xl border border-amber-200 shadow-xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">
                  {editingAward ? `Edit ${AWARD_META[formCategory].title}` : `Publish ${AWARD_META[formCategory].title}`}
                </h2>
                <p className="text-xs text-slate-500">
                  {formYear} Annual Award · Once Per Year
                </p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAward} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{formError}</div>
              )}

              <ImageUploadField
                label="Award Winner Photograph"
                value={formPhotoUrl}
                onChange={setFormPhotoUrl}
                helperText="Optional custom award ceremony photo (defaults to player profile photo if blank)"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">
                    {formCategory === 'GOLDEN_GLOVES' ? 'Select Registered Goalkeeper' : 'Select Registered Player'}
                  </label>
                  <select
                    required
                    value={formPlayerId}
                    onChange={(e) => {
                      setFormPlayerId(e.target.value);
                      const matched = players.find((p) => String(p.id) === e.target.value);
                      if (matched && !formPhotoUrl) {
                        setFormPhotoUrl(matched.photo_url || '');
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    {selectablePlayers.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.full_name} ({p.player_code} · {p.position})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Started Award Year</label>
                  <select
                    disabled={Boolean(editingAward)}
                    value={String(formYear)}
                    onChange={(e) => setFormYear(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white disabled:bg-slate-100 tabular-nums"
                  >
                    {awardYears.map((ay) => (
                      <option key={ay.id} value={String(ay.year)}>
                        {ay.year} — {ay.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formCategory === 'GOLDEN_GLOVES' ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Clean Sheets</label>
                    <input
                      type="number"
                      min={0}
                      value={formCleanSheets}
                      onChange={(e) => setFormCleanSheets(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Saves</label>
                    <input
                      type="number"
                      min={0}
                      value={formSaves}
                      onChange={(e) => setFormSaves(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Goals Conceded</label>
                    <input
                      type="number"
                      min={0}
                      value={formGoalsConceded}
                      onChange={(e) => setFormGoalsConceded(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    {formCategory === 'GOLDEN_BOOT' ? 'Total Goals Scored' : 'Goals Contributed (Optional)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formGoals}
                    onChange={(e) => setFormGoals(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Reason for Winning</label>
                <input
                  type="text"
                  required
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="e.g., Season-long leadership & decisive tournament goals"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Match & Performance Details</label>
                <textarea
                  rows={2}
                  value={formDetails}
                  onChange={(e) => setFormDetails(e.target.value)}
                  placeholder="Key matches, ratings, or statistical highlights"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg cursor-pointer"
                >
                  {saving ? 'Saving...' : editingAward ? 'Save Award Changes' : 'Save & Publish Award'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove Award Record"
        message={`Remove the ${deleteTarget?.category.replace(/_/g, ' ')} (${deleteTarget?.award_year} Annual) award for ${deleteTarget?.player_name}?`}
        confirmLabel="Delete Award"
        busy={deleting}
        onConfirm={confirmDeleteAward}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
