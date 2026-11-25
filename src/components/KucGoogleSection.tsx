import React, { useEffect, useState } from 'react';
import { Search, ArrowRight, Database, Lock } from 'lucide-react';
import { apiFetch } from '../api.ts';
import type { InternalSearchResult, SectionKey } from '../types.ts';
import { KucCrest } from './ClubBrand.tsx';

const CATEGORIES = [
  'ALL',
  'Players',
  'Player IDs',
  'Player Statistics',
  'Money Records',
  'Payment History',
  'Committee Members',
  'Previous Committees',
  'Club Records',
] as const;

export function KucGoogleSection({
  onNavigate,
}: {
  onNavigate: (section: SectionKey, entityId?: number) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('ALL');
  const [results, setResults] = useState<InternalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ results: InternalSearchResult[] }>(
          `/api/search?q=${encodeURIComponent(trimmed)}&category=${encodeURIComponent(category)}`,
        );
        setResults(res.results);
        setHasSearched(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query, category]);

  return (
    <div className="space-y-8">
      {/* Centered KUC GOOGLE Hero Search Box */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 text-center space-y-6">
        <div className="flex flex-col items-center space-y-3">
          <div className="flex items-center gap-3">
            <KucCrest size={48} />
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              <span className="text-[#0B1F3A]">KUC </span>
              <span className="text-[#1D4ED8]">G</span>
              <span className="text-[#0284C7]">O</span>
              <span className="text-[#1D4ED8]">O</span>
              <span className="text-[#0B1F3A]">G</span>
              <span className="text-[#0284C7]">L</span>
              <span className="text-[#1D4ED8]">E</span>
            </h1>
          </div>
          <p className="text-sm text-slate-600 max-w-xl">
            Private internal search across Kalanja United Club records only. Searches Players, Player IDs, Statistics,
            Money Records, Committees, and Awards without connecting to external websites.
          </p>
        </div>

        {/* Large Search Bar */}
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <Search className="w-5 h-5 text-[#1D4ED8] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search player name, KUC-0001, PAID, President, Golden Ball, opponent..."
              className="w-full pl-12 pr-4 py-4 text-base bg-slate-50 border-2 border-slate-200 rounded-2xl focus:bg-white focus:outline-none focus:border-[#1D4ED8] transition-colors"
            />
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Lock className="w-3.5 h-3.5 text-[#1D4ED8]" />
            <span>Closed Club Database Index · Zero External Search Results</span>
          </div>
        </div>

        {/* Search Categories Filter */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                category === cat
                  ? 'bg-[#0B1F3A] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {cat === 'ALL' ? 'All Records' : cat}
            </button>
          ))}
        </div>
      </section>

      {/* Instant Results */}
      <section className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            Searching internal KUC database...
          </div>
        ) : !hasSearched ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2">
            <Database className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">Ready to Search KUC Database</p>
            <p className="text-xs text-slate-500">
              Try searching by a player name, <span className="font-mono">KUC-0001</span>, <span className="font-mono">UNPAID</span>,{' '}
              <span className="font-mono">Treasurer</span>, or <span className="font-mono">Golden</span>.
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-1">
            <p className="text-sm font-semibold text-slate-800">No internal KUC records matched "{query}"</p>
            <p className="text-xs text-slate-500">Try a different keyword or switch the category filter above.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 text-xs font-semibold text-slate-500 flex items-center justify-between">
              <span>{results.length} matching club record(s) found</span>
              <span>Click any result to open</span>
            </div>
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onNavigate(r.targetSection, r.entityId)}
                className="w-full text-left px-5 py-4 hover:bg-blue-50/50 transition-colors flex items-center justify-between gap-4 cursor-pointer"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-[#1D4ED8]">{r.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{r.meta}</span>
                  </div>
                  <p className="text-base font-bold text-[#0F172A] truncate">{r.title}</p>
                  <p className="text-xs text-slate-600 truncate">{r.subtitle}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
