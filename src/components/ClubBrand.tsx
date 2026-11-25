import React, { useState } from 'react';
import { Shield, Upload, X, AlertTriangle } from 'lucide-react';

export const CREST_IMAGE_PATH = '/src/assets/images/kuc_club_crest_1795522525092.jpg';
export const STADIUM_IMAGE_PATH = '/src/assets/images/kuc_stadium_hero_1795522525863.jpg';
export const TROPHY_IMAGE_PATH = '/src/assets/images/kuc_award_gold_trophy_1795522526080.jpg';

export function KucCrest({ size = 44, className = '' }: { size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`rounded-lg bg-[#0B1F3A] border border-blue-400/30 flex items-center justify-center text-white shrink-0 ${className}`}
      >
        <Shield className="w-1/2 h-1/2 text-sky-300" />
      </div>
    );
  }

  return (
    <img
      src={CREST_IMAGE_PATH}
      alt="KUC – Kalanja United Club Crest"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      className={`rounded-lg object-cover shrink-0 border border-white/15 bg-[#0B1F3A] ${className}`}
    />
  );
}

export function PlayerAvatar({
  src,
  name,
  size = 'md',
  className = '',
}: {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);

  const dims = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-2xl',
  }[size];

  const initials = (name || 'KU')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || '')
    .join('');

  if (!src || imgError) {
    return (
      <div
        className={`${dims} rounded-xl bg-gradient-to-br from-[#0F294D] to-[#1D4ED8] text-white font-display font-bold flex items-center justify-center shrink-0 select-none border border-blue-200/30 ${className}`}
        aria-label={name}
      >
        {initials || 'KU'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
      className={`${dims} rounded-xl object-cover shrink-0 border border-slate-200 bg-slate-100 ${className}`}
    />
  );
}

export function ImageUploadField({
  label,
  value,
  onChange,
  helperText = 'Upload a photo (PNG/JPG/WebP) or paste an image URL',
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  helperText?: string;
}) {
  const [uploadError, setUploadError] = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file.');
      return;
    }
    if (file.size > 1_600_000) {
      setUploadError('Image is over 1.6 MB. Please choose a smaller image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex items-center gap-3">
        <PlayerAvatar src={value} name="Player Preview" size="lg" />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#0F294D] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer transition-colors whitespace-nowrap shrink-0">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Photo</span>
              <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </label>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-red-700 bg-slate-100 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
          <input
            type="url"
            value={value.startsWith('data:') ? '' : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={value.startsWith('data:') ? 'Uploaded photo attached' : 'Or paste https:// photo URL'}
            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <p className="text-xs text-slate-500">{uploadError ? <span className="text-red-600">{uploadError}</span> : helperText}</p>
        </div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              danger ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#1D4ED8] hover:bg-[#1E40AF]'
            } disabled:opacity-60`}
          >
            {busy ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
