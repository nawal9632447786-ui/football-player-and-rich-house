import React, { useCallback, useEffect, useState } from 'react';
import { Landmark, Plus, Edit3, CheckCircle2, X, Trash2 } from 'lucide-react';
import { apiFetch } from '../api.ts';
import type { Committee, Player } from '../types.ts';
import { PlayerAvatar } from './ClubBrand.tsx';

const COMMITTEE_POSITIONS = [
  'President',
  'Vice President',
  'General Secretary',
  'Joint Secretary',
  'Treasurer',
  'Joint Treasurer',
  'Executive Members',
] as const;

interface DraftMember {
  position: string;
  player_id: string;
}

export function CommitteeSection({
  onNavigateToPlayer,
  onCommitteeChanged,
}: {
  onNavigateToPlayer: (playerId: number) => void;
  onCommitteeChanged: () => void;
}) {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCommittee, setEditingCommittee] = useState<Committee | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [title, setTitle] = useState<string>(`${new Date().getFullYear()} Executive Committee`);
  const [isCurrent, setIsCurrent] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [allowDuplicatePlayer, setAllowDuplicatePlayer] = useState<boolean>(false);
  const [draftMembers, setDraftMembers] = useState<DraftMember[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cRes, pRes] = await Promise.all([
        apiFetch<{ committees: Committee[] }>('/api/committees'),
        apiFetch<{ players: Player[] }>('/api/players'),
      ]);
      setCommittees(cRes.committees);
      setPlayers(pRes.players);
    } catch (err: any) {
      setError(err?.message || 'Unable to load committees.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    const nextYear = committees.length > 0 ? Math.max(...committees.map((c) => c.year)) + 1 : new Date().getFullYear();
    setEditingCommittee(null);
    setYear(nextYear);
    setTitle(`${nextYear} Executive Committee`);
    setIsCurrent(true);
    setNotes('');
    setAllowDuplicatePlayer(false);
    setDraftMembers([
      { position: 'President', player_id: players[0] ? String(players[0].id) : '' },
      { position: 'General Secretary', player_id: players[1] ? String(players[1].id) : players[0] ? String(players[0].id) : '' },
      { position: 'Treasurer', player_id: players[2] ? String(players[2].id) : players[0] ? String(players[0].id) : '' },
    ]);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (c: Committee) => {
    setEditingCommittee(c);
    setYear(c.year);
    setTitle(c.title);
    setIsCurrent(Boolean(c.is_current));
    setNotes(c.notes || '');
    const ids = c.members.map((m) => m.player_id);
    setAllowDuplicatePlayer(new Set(ids).size !== ids.length);
    setDraftMembers(
      c.members.map((m) => ({
        position: m.position,
        player_id: String(m.player_id),
      })),
    );
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const validMembers = draftMembers
      .filter((m) => m.player_id && m.position)
      .map((m) => ({ player_id: Number(m.player_id), position: m.position }));

    if (validMembers.length === 0) {
      setFormError('Assign at least one player to a committee position.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        year,
        title,
        is_current: isCurrent,
        notes,
        allowDuplicatePlayer,
        members: validMembers,
      };
      if (editingCommittee) {
        await apiFetch(`/api/committees/${editingCommittee.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/committees', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await loadData();
      onCommitteeChanged();
    } catch (err: any) {
      setFormError(err?.message || 'Unable to save committee.');
    } finally {
      setSaving(false);
    }
  };

  const handleSetCurrent = async (id: number) => {
    try {
      await apiFetch(`/api/committees/${id}/set-current`, { method: 'POST' });
      await loadData();
      onCommitteeChanged();
    } catch (err: any) {
      setError(err?.message || 'Failed to update current committee.');
    }
  };

  const currentCommittee = committees.find((c) => c.is_current === 1) || committees[0] || null;
  const previousCommittees = committees.filter((c) => !currentCommittee || c.id !== currentCommittee.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Committee Management</h1>
          <p className="text-sm text-slate-600">
            Annual executive boards preserving every year&apos;s leadership archive permanently.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#1D4ED8] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Annual Committee</span>
        </button>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="h-64 bg-white rounded-xl border border-slate-200 animate-pulse" />
      ) : !currentCommittee ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1D4ED8] flex items-center justify-center mx-auto">
            <Landmark className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-lg font-bold text-[#0F172A]">No Annual Committee Created Yet</h2>
            <p className="text-sm text-slate-600">
              Form your club&apos;s executive committee by assigning registered players to President, Vice President,
              Secretaries, Treasurers, and Executive Member roles.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#1D4ED8] rounded-xl cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Form First Committee</span>
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Current Committee Showcase */}
          <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-[#0B1F3A] to-[#173B6C] text-white px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-sky-300 uppercase tracking-wider">
                  Current Active Board · Year {currentCommittee.year}
                </p>
                <h2 className="text-xl font-bold mt-0.5">{currentCommittee.title}</h2>
                {currentCommittee.notes && (
                  <p className="text-xs text-blue-100/80 mt-1">{currentCommittee.notes}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => openEditModal(currentCommittee)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-white text-[#0B1F3A] hover:bg-sky-50 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Committee</span>
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {currentCommittee.members.map((m) => (
                <div
                  key={m.id}
                  onClick={() => onNavigateToPlayer(m.player_id)}
                  className="rounded-xl border border-slate-200 hover:border-[#1D4ED8] p-4 flex items-center gap-3.5 cursor-pointer transition-colors bg-slate-50/50 hover:bg-white"
                >
                  <PlayerAvatar src={m.photo_url} name={m.full_name} size="md" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1D4ED8] truncate">{m.position}</p>
                    <p className="text-sm font-bold text-[#0F172A] truncate">{m.full_name}</p>
                    <p className="text-xs text-slate-500 font-mono">{m.player_code}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Previous Years Committees */}
          {previousCommittees.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#0F172A]">Previous Committees Archive</h2>
                <span className="text-xs text-slate-500">{previousCommittees.length} historical term(s)</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {previousCommittees.map((c) => (
                  <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <p className="text-xs font-mono text-slate-500">Year {c.year}</p>
                        <h3 className="text-base font-bold text-[#0F172A]">{c.title}</h3>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSetCurrent(c.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#1D4ED8] bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Set Current</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          className="p-1.5 text-slate-400 hover:text-[#1D4ED8] rounded-lg cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {c.members.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => onNavigateToPlayer(m.player_id)}
                          className="flex items-center gap-2.5 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg"
                        >
                          <PlayerAvatar src={m.photo_url} name={m.full_name} size="sm" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#1D4ED8] truncate">{m.position}</p>
                            <p className="text-sm font-semibold text-slate-800 truncate">{m.full_name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Create / Edit Committee Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#0F172A]">
                {editingCommittee ? `Edit ${editingCommittee.year} Committee` : 'Create Annual Committee'}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{formError}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Committee Year</label>
                  <input
                    type="number"
                    disabled={Boolean(editingCommittee)}
                    required
                    min={1950}
                    max={2100}
                    value={year}
                    onChange={(e) => {
                      const y = Number(e.target.value);
                      setYear(y);
                      if (!editingCommittee) setTitle(`${y} Executive Committee`);
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg disabled:bg-slate-100 tabular-nums"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Committee Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 text-sm">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCurrent}
                    onChange={(e) => setIsCurrent(e.target.checked)}
                    className="rounded border-slate-300 text-[#1D4ED8]"
                  />
                  <span className="font-medium text-slate-700">Set as Current Committee</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowDuplicatePlayer}
                    onChange={(e) => setAllowDuplicatePlayer(e.target.checked)}
                    className="rounded border-slate-300 text-[#1D4ED8]"
                  />
                  <span className="font-medium text-slate-700">Allow multi-role assignment for same player</span>
                </label>
              </div>

              {/* Member Assignments */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#0F172A]">Committee Positions</h3>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftMembers((prev) => [
                        ...prev,
                        { position: 'Executive Members', player_id: players[0] ? String(players[0].id) : '' },
                      ])
                    }
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-[#1D4ED8] bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Position</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {draftMembers.map((dm, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <select
                        value={dm.position}
                        onChange={(e) =>
                          setDraftMembers((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, position: e.target.value } : item)),
                          )
                        }
                        className="col-span-5 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                      >
                        {COMMITTEE_POSITIONS.map((pos) => (
                          <option key={pos} value={pos}>
                            {pos}
                          </option>
                        ))}
                      </select>

                      <select
                        value={dm.player_id}
                        onChange={(e) =>
                          setDraftMembers((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, player_id: e.target.value } : item)),
                          )
                        }
                        className="col-span-6 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                      >
                        {players.map((p) => (
                          <option key={p.id} value={String(p.id)}>
                            {p.full_name} ({p.player_code})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => setDraftMembers((prev) => prev.filter((_, i) => i !== idx))}
                        className="col-span-1 p-2 text-slate-400 hover:text-red-600 rounded-lg justify-self-center cursor-pointer"
                        title="Remove slot"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Term Notes (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Elected at Annual General Meeting"
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
                  className="px-5 py-2 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#1D4ED8] rounded-lg cursor-pointer"
                >
                  {saving ? 'Saving...' : editingCommittee ? 'Update Committee' : 'Save Committee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
