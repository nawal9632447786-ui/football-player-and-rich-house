import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Wallet,
  Search,
  Landmark,
  Award,
  Activity,
  LogOut,
  Lock,
  Menu,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch, setAuthToken } from './api.ts';
import type { AdminUser, AuthStatus, DashboardSummary, SectionKey } from './types.ts';
import { AuthGate } from './components/AuthGate.tsx';
import { KucCrest, ConfirmDialog } from './components/ClubBrand.tsx';
import { DashboardHome } from './components/DashboardHome.tsx';
import { PlayersSection } from './components/PlayersSection.tsx';
import { StatsSection } from './components/StatsSection.tsx';
import { MoneySection } from './components/MoneySection.tsx';
import { KucGoogleSection } from './components/KucGoogleSection.tsx';
import { CommitteeSection } from './components/CommitteeSection.tsx';
import { AwardsSection } from './components/AwardsSection.tsx';
import { ActivityLog } from './components/ActivityLog.tsx';

const NAV_ITEMS: Array<{
  key: SectionKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  alwaysUnlocked?: boolean;
}> = [
  { key: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard, alwaysUnlocked: true },
  { key: 'PLAYERS', label: 'Players', icon: Users, alwaysUnlocked: true },
  { key: 'STATS', label: 'Stats', icon: BarChart3 },
  { key: 'MONEY', label: 'Money', icon: Wallet },
  { key: 'GOOGLE', label: 'KUC Google', icon: Search },
  { key: 'COMMITTEE', label: 'Committee', icon: Landmark },
  { key: 'AWARDS', label: 'Awards & Honors', icon: Award },
  { key: 'ACTIVITY', label: 'Activity Log', icon: Activity, alwaysUnlocked: true },
];

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>('DASHBOARD');
  const [focusedEntityId, setFocusedEntityId] = useState<number | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const status = await apiFetch<AuthStatus>('/api/auth/status');
      setAuthStatus(status);
      if (status.authenticated && status.admin) {
        setAdmin(status.admin);
      }
    } catch {
      setAuthStatus({
        configured: false,
        envOverride: false,
        authenticated: false,
        admin: null,
      });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const loadDashboard = useCallback(async () => {
    if (!admin) return;
    setLoadingSummary(true);
    try {
      const data = await apiFetch<DashboardSummary>('/api/dashboard');
      setSummary(data);
      if (!data.hasPlayers && activeSection !== 'DASHBOARD' && activeSection !== 'PLAYERS' && activeSection !== 'ACTIVITY') {
        setActiveSection('PLAYERS');
      }
    } catch (err: any) {
      if (err?.status === 401) {
        setAuthToken(null);
        setAdmin(null);
        checkAuth();
      }
    } finally {
      setLoadingSummary(false);
    }
  }, [admin, activeSection, checkAuth]);

  useEffect(() => {
    if (admin) {
      loadDashboard();
    }
  }, [admin, loadDashboard]);

  const handleAuthenticated = (loggedInAdmin: AdminUser) => {
    setAdmin(loggedInAdmin);
    setAuthStatus((prev) =>
      prev ? { ...prev, configured: true, authenticated: true, admin: loggedInAdmin } : null,
    );
    setActiveSection('DASHBOARD');
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore logout error
    } finally {
      setAuthToken(null);
      setAdmin(null);
      setSummary(null);
      setLogoutConfirmOpen(false);
      setActiveSection('DASHBOARD');
      checkAuth();
    }
  };

  const handleNavigate = (section: SectionKey, entityId?: number) => {
    const hasPlayers = Boolean(summary?.hasPlayers);
    if (!hasPlayers && section !== 'DASHBOARD' && section !== 'PLAYERS' && section !== 'ACTIVITY') {
      return;
    }
    setFocusedEntityId(entityId ?? null);
    setActiveSection(section);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!authStatus) {
    return (
      <div className="min-h-screen bg-[#07172E] flex items-center justify-center text-white">
        <div className="flex items-center gap-3">
          <KucCrest size={44} />
          <span className="text-sm font-semibold tracking-wide">Loading KUC – Kalanja United Club...</span>
        </div>
      </div>
    );
  }

  if (!admin) {
    return <AuthGate authStatus={authStatus} onAuthenticated={handleAuthenticated} />;
  }

  const hasPlayers = Boolean(summary?.hasPlayers);
  const activeNavMeta = NAV_ITEMS.find((n) => n.key === activeSection);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#0B1F3A] text-white border-r border-[#173B6C]">
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
          <KucCrest size={42} />
          <div className="min-w-0">
            <p className="text-sm font-extrabold tracking-tight truncate">KUC</p>
            <p className="text-[11px] text-sky-300 truncate">Kalanja United Club</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Main Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const locked = !item.alwaysUnlocked && !hasPlayers;
            const active = activeSection === item.key;

            return (
              <button
                key={item.key}
                type="button"
                disabled={locked}
                onClick={() => handleNavigate(item.key)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  locked
                    ? 'text-blue-200/35 cursor-not-allowed'
                    : active
                      ? 'bg-[#1D4ED8] text-white font-semibold'
                      : 'text-blue-100/80 hover:bg-white/10 hover:text-white cursor-pointer'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {locked && <Lock className="w-3.5 h-3.5 shrink-0 opacity-70" />}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="px-2">
            <p className="text-xs font-semibold text-white truncate">{admin.displayName}</p>
            <p className="text-[11px] text-sky-300/80 truncate">@{admin.username} · Admin</p>
          </div>
          <button
            type="button"
            onClick={() => setLogoutConfirmOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-blue-100 hover:text-white bg-white/10 hover:bg-red-600/80 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-[#0B1F3A] text-white flex flex-col h-full z-10">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <KucCrest size={36} />
                <span className="text-sm font-extrabold">KUC – KALANJA</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-blue-200 hover:text-white rounded-lg"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const locked = !item.alwaysUnlocked && !hasPlayers;
                const active = activeSection === item.key;

                return (
                  <button
                    key={item.key}
                    type="button"
                    disabled={locked}
                    onClick={() => handleNavigate(item.key)}
                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors ${
                      locked
                        ? 'text-blue-200/35 cursor-not-allowed'
                        : active
                          ? 'bg-[#1D4ED8] text-white font-semibold'
                          : 'text-blue-100/85 hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {locked && <Lock className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setLogoutConfirmOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-white bg-white/10 hover:bg-red-600/80 rounded-xl"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Clean Top Header Bar (3-zone contract) */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold text-[#0B1F3A] whitespace-nowrap shrink-0">
              KUC – Kalanja United Club
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap shrink-0">
            <span>Dashboard</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-[#1D4ED8]">{activeNavMeta?.label || 'Overview'}</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setLogoutConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-red-700 bg-slate-100 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeSection === 'DASHBOARD' && (
                <DashboardHome
                  admin={admin}
                  summary={summary}
                  loading={loadingSummary}
                  onNavigate={handleNavigate}
                />
              )}

              {activeSection === 'PLAYERS' && (
                <PlayersSection
                  initialPlayerId={focusedEntityId}
                  onPlayersChanged={loadDashboard}
                />
              )}

              {activeSection === 'STATS' && hasPlayers && (
                <StatsSection
                  initialPlayerId={focusedEntityId}
                  onNavigateToPlayer={(pid) => handleNavigate('PLAYERS', pid)}
                />
              )}

              {activeSection === 'MONEY' && hasPlayers && (
                <MoneySection
                  onNavigateToPlayer={(pid) => handleNavigate('PLAYERS', pid)}
                  onMoneyChanged={loadDashboard}
                />
              )}

              {activeSection === 'GOOGLE' && hasPlayers && (
                <KucGoogleSection onNavigate={handleNavigate} />
              )}

              {activeSection === 'COMMITTEE' && hasPlayers && (
                <CommitteeSection
                  onNavigateToPlayer={(pid) => handleNavigate('PLAYERS', pid)}
                  onCommitteeChanged={loadDashboard}
                />
              )}

              {activeSection === 'AWARDS' && hasPlayers && (
                <AwardsSection
                  onNavigateToPlayer={(pid) => handleNavigate('PLAYERS', pid)}
                />
              )}

              {activeSection === 'ACTIVITY' && (
                <ActivityLog
                  variant="full"
                  hasPlayers={hasPlayers}
                  onNavigate={handleNavigate}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Quiet Footer */}
        <footer className="border-t border-slate-200 bg-white px-4 sm:px-6 lg:px-8 py-4 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>KUC – KALANJA UNITED CLUB · United We Play, United We Grow.</span>
          <span>Admin Management Platform</span>
        </footer>
      </div>

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Sign Out of KUC Admin Portal"
        message="Are you sure you want to end your admin session? All club data remains permanently saved in the database."
        confirmLabel="Sign Out"
        danger={false}
        onConfirm={handleLogout}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
    </div>
  );
}
