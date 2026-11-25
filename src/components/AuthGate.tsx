import React, { useState } from 'react';
import { Lock, ShieldCheck, KeyRound, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { apiFetch, setAuthToken } from '../api.ts';
import type { AdminUser, AuthStatus } from '../types.ts';
import { KucCrest, STADIUM_IMAGE_PATH } from './ClubBrand.tsx';

export function AuthGate({
  authStatus,
  onAuthenticated,
}: {
  authStatus: AuthStatus;
  onAuthenticated: (admin: AdminUser) => void;
}) {
  const isSetupMode = !authStatus.configured;

  const [username, setUsername] = useState('admin');
  const [displayName, setDisplayName] = useState('Club Administrator');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [heroError, setHeroError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isSetupMode) {
      if (password.length < 6) {
        setError('Admin password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      setSubmitting(true);
      try {
        const res = await apiFetch<{ token: string; admin: AdminUser }>('/api/auth/setup', {
          method: 'POST',
          body: JSON.stringify({ username, password, displayName }),
        });
        setAuthToken(res.token);
        onAuthenticated(res.admin);
      } catch (err: any) {
        setError(err?.message || 'Unable to complete admin setup.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{ token: string; admin: AdminUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setAuthToken(res.token);
      onAuthenticated(res.admin);
    } catch (err: any) {
      setError(err?.message || 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07172E] flex flex-col lg:flex-row">
      {/* Left Brand Showcase */}
      <div className="relative lg:w-1/2 min-h-[280px] lg:min-h-screen overflow-hidden flex flex-col justify-between p-8 lg:p-14 text-white bg-[#0B1F3A]">
        {!heroError && (
          <img
            src={STADIUM_IMAGE_PATH}
            alt="Kalanja United Club Stadium"
            referrerPolicy="no-referrer"
            onError={() => setHeroError(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-35"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-[#07172E]/95 via-[#0B1F3A]/80 to-[#1D4ED8]/50" />

        <div className="relative z-10 flex items-center gap-4">
          <KucCrest size={56} />
          <div>
            <p className="text-xs font-semibold tracking-widest text-sky-300 uppercase">Official Management Portal</p>
            <h1 className="text-xl font-extrabold tracking-tight text-white">KUC – KALANJA UNITED CLUB</h1>
          </div>
        </div>

        <div className="relative z-10 my-10 lg:my-0 max-w-lg space-y-5">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-balance">
            United We Play, United We Grow.
          </h2>
          <p className="text-sm sm:text-base text-blue-100/90 leading-relaxed">
            Centralized administration for squad rosters, historical match statistics, weekly ₹10 member contributions,
            annual executive committees, and six-month club honors.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/15">
            <div>
              <p className="text-xs text-sky-300">Access Level</p>
              <p className="text-sm font-semibold text-white mt-0.5">Admin Only</p>
            </div>
            <div>
              <p className="text-xs text-sky-300">Database</p>
              <p className="text-sm font-semibold text-white mt-0.5">Persistent SQL</p>
            </div>
            <div>
              <p className="text-xs text-sky-300">Protection</p>
              <p className="text-sm font-semibold text-white mt-0.5">Signed Session</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-blue-200/70">
          KUC – Kalanja United Club · Restricted Administrative Console
        </div>
      </div>

      {/* Right Login / Claim Form */}
      <div className="lg:w-1/2 bg-white flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#1D4ED8]">
              <ShieldCheck className="w-4 h-4" />
              <span>{isSetupMode ? 'First-Run Admin Setup' : 'Authorized Admin Sign-In'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
              {isSetupMode ? 'Claim Club Administrator Access' : 'Sign In to Club Dashboard'}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {isSetupMode
                ? 'Create the authorized administrator credentials for KUC. Public registration and player login are disabled.'
                : 'Enter your administrator credentials to manage players, statistics, finances, and committees.'}
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="admin-username" className="block text-sm font-medium text-slate-700">
                Admin Username
              </label>
              <input
                id="admin-username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] focus:border-transparent"
              />
            </div>

            {isSetupMode && (
              <div className="space-y-1.5">
                <label htmlFor="admin-display" className="block text-sm font-medium text-slate-700">
                  Administrator Name
                </label>
                <input
                  id="admin-display"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Club Administrator"
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] focus:border-transparent"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="admin-password" className="block text-sm font-medium text-slate-700">
                {isSetupMode ? 'Create Admin Password' : 'Admin Password'}
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete={isSetupMode ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSetupMode ? 'Minimum 6 characters' : 'Enter password'}
                  className="w-full pl-4 pr-11 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isSetupMode && (
              <div className="space-y-1.5">
                <label htmlFor="admin-confirm" className="block text-sm font-medium text-slate-700">
                  Confirm Password
                </label>
                <input
                  id="admin-confirm"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8] focus:border-transparent"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#1D4ED8] rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isSetupMode ? <KeyRound className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span>{submitting ? 'Verifying...' : isSetupMode ? 'Initialize Admin & Enter Club' : 'Sign In to Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Admin-only encrypted access</span>
            <span>No public registration</span>
          </div>
        </div>
      </div>
    </div>
  );
}
