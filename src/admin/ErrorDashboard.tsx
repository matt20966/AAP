import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FailedDocument {
  id: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  processedAt: string;
  errorType: ErrorType;
  errorCode: string;
  errorMessage: string;
  errorDetails: string;
  stackTrace: string;
  pipeline: PipelineStage[];
  retryCount: number;
  maxRetries: number;
  metadata: Record<string, string>;
}

type ErrorType =
  | 'ocr_failure'
  | 'format_invalid'
  | 'missing_fields'
  | 'timeout'
  | 'ai_classification'
  | 'file_corrupt'
  | 'size_exceeded'
  | 'parse_error';

interface PipelineStage {
  name: string;
  status: 'success' | 'failed' | 'skipped';
  duration: number;
  message?: string;
  timestamp: string;
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────

const Icons = {
  x: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
  ),
  check: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
  ),
  warn: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
  ),
  info: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
  ),
  loader: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
  ),
  search: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
  ),
  mail: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
  ),
  clock: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
  ),
  file: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
  ),
  fileText: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
  ),
  alertCircle: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
  ),
  bug: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" /><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" /><path d="M12 20v-9" /><path d="M6.53 9C4.6 8.8 3 7.1 3 5" /><path d="M6 13H2" /><path d="M3 21c0-2.1 1.7-3.9 3.8-4" /><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" /><path d="M22 13h-4" /><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" /></svg>
  ),
  eye: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
  ),
  user: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
  ),
  refresh: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
  ),
  chevronRight: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
  ),
  chevronDown: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
  ),
  arrowLeft: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
  ),
  terminal: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
  ),
  zap: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
  ),
  database: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>
  ),
  copy: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
  ),
  externalLink: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
  ),
  layers: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
  ),
  hash: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></svg>
  ),
  filter: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
  ),
  barChart: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
  ),
  shield: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
  ),
  settings: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
  ),
};

// ─── Utilities ───────────────────────────────────────────────────────────────

const uid = (): string => Math.random().toString(36).substring(2, 11) + Date.now().toString(36);

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Error Type Configurations ───────────────────────────────────────────────

const ERROR_TYPE_CONFIG: Record<ErrorType, {
  label: string;
  shortLabel: string;
  icon: (p: React.SVGProps<SVGSVGElement>) => JSX.Element;
  color: { bg: string; border: string; text: string; dot: string };
}> = {
  ocr_failure: {
    label: 'OCR Extraction Failed',
    shortLabel: 'OCR Failure',
    icon: Icons.eye,
    color: { bg: 'bg-rose-500/[0.08]', border: 'border-rose-500/20', text: 'text-rose-400', dot: 'bg-rose-400' },
  },
  format_invalid: {
    label: 'Invalid Document Format',
    shortLabel: 'Invalid Format',
    icon: Icons.fileText,
    color: { bg: 'bg-orange-500/[0.08]', border: 'border-orange-500/20', text: 'text-orange-400', dot: 'bg-orange-400' },
  },
  missing_fields: {
    label: 'Missing Required Fields',
    shortLabel: 'Missing Fields',
    icon: Icons.alertCircle,
    color: { bg: 'bg-amber-500/[0.08]', border: 'border-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400' },
  },
  timeout: {
    label: 'Processing Timeout',
    shortLabel: 'Timeout',
    icon: Icons.clock,
    color: { bg: 'bg-yellow-500/[0.08]', border: 'border-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  },
  ai_classification: {
    label: 'AI Classification Error',
    shortLabel: 'AI Error',
    icon: Icons.zap,
    color: { bg: 'bg-violet-500/[0.08]', border: 'border-violet-500/20', text: 'text-violet-400', dot: 'bg-violet-400' },
  },
  file_corrupt: {
    label: 'File Corruption Detected',
    shortLabel: 'Corrupt File',
    icon: Icons.warn,
    color: { bg: 'bg-red-500/[0.08]', border: 'border-red-500/20', text: 'text-red-400', dot: 'bg-red-400' },
  },
  size_exceeded: {
    label: 'File Size Exceeded',
    shortLabel: 'Size Limit',
    icon: Icons.database,
    color: { bg: 'bg-sky-500/[0.08]', border: 'border-sky-500/20', text: 'text-sky-400', dot: 'bg-sky-400' },
  },
  parse_error: {
    label: 'Document Parse Error',
    shortLabel: 'Parse Error',
    icon: Icons.terminal,
    color: { bg: 'bg-pink-500/[0.08]', border: 'border-pink-500/20', text: 'text-pink-400', dot: 'bg-pink-400' },
  },
};

// ─── Avatar colors ───────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/30' },
  { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  { bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/30' },
  { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  { bg: 'bg-sky-500/20', text: 'text-sky-300', border: 'border-sky-500/30' },
  { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/30' },
  { bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/30' },
  { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-300', border: 'border-fuchsia-500/30' },
];

function getAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Animation Variants ─────────────────────────────────────────────────────

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', damping: 30, stiffness: 400 } },
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useToast() {
  const [t, set] = useState<{ id: string; msg: string; type: 'success' | 'error' | 'info' }[]>([]);
  const add = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = uid();
    set(p => [...p, { id, msg, type }]);
    setTimeout(() => set(p => p.filter(x => x.id !== id)), 3500);
  }, []);
  return { t, add };
}

// ─── Toasts Component ───────────────────────────────────────────────────────

function Toasts({ items }: { items: { id: string; msg: string; type: string }[] }) {
  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col-reverse gap-2.5 pointer-events-none sm:bottom-5 sm:right-5 bottom-24 right-4">
      <AnimatePresence>
        {items.map(t => (
          <motion.div key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.9, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 16, scale: 0.9, filter: 'blur(6px)' }}
            transition={{ type: 'spring', damping: 30, stiffness: 420 }}
            className={`pointer-events-auto px-4 py-3 rounded-2xl text-[12px] font-semibold flex items-center gap-2.5 border backdrop-blur-2xl tracking-[-0.01em] ${
              t.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/20 text-emerald-300 shadow-xl shadow-emerald-950/40' :
              t.type === 'error' ? 'bg-rose-950/90 border-rose-500/20 text-rose-300 shadow-xl shadow-rose-950/40' :
              'bg-zinc-900/90 border-zinc-700/25 text-zinc-300 shadow-xl shadow-black/50'
            }`}>
            {t.type === 'success' && <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center"><Icons.check className="w-2.5 h-2.5 text-emerald-400" /></div>}
            {t.type === 'error' && <div className="w-5 h-5 rounded-full bg-rose-500/15 flex items-center justify-center"><Icons.warn className="w-2.5 h-2.5 text-rose-400" /></div>}
            {t.type === 'info' && <div className="w-5 h-5 rounded-full bg-zinc-500/15 flex items-center justify-center"><Icons.info className="w-2.5 h-2.5 text-zinc-400" /></div>}
            <span>{t.msg}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Pipeline Stage Indicator ────────────────────────────────────────────────

function PipelineView({ stages }: { stages: PipelineStage[] }) {
  return (
    <div className="space-y-1">
      {stages.map((stage, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.05 }}
          className="flex items-center gap-3 group"
        >
          <div className="flex flex-col items-center">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center border ${
              stage.status === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : stage.status === 'failed'
                  ? 'bg-rose-500/10 border-rose-500/20'
                  : 'bg-zinc-500/10 border-zinc-500/20'
            }`}>
              {stage.status === 'success' && <Icons.check className="w-3 h-3 text-emerald-400" />}
              {stage.status === 'failed' && <Icons.x className="w-3 h-3 text-rose-400" />}
              {stage.status === 'skipped' && <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />}
            </div>
            {idx < stages.length - 1 && (
              <div className={`w-px h-4 ${
                stage.status === 'success' ? 'bg-emerald-500/20' :
                stage.status === 'failed' ? 'bg-rose-500/20' : 'bg-zinc-700/30'
              }`} />
            )}
          </div>
          <div className="flex-1 min-w-0 py-1">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[11px] font-semibold ${
                stage.status === 'success' ? 'text-zinc-300' :
                stage.status === 'failed' ? 'text-rose-400' : 'text-zinc-600'
              }`}>
                {stage.name}
              </span>
              <span className="text-[10px] text-zinc-600 tabular-nums font-mono">
                {stage.duration}ms
              </span>
            </div>
            {stage.message && (
              <p className={`text-[10px] mt-0.5 ${stage.status === 'failed' ? 'text-rose-400/70' : 'text-zinc-600'}`}>
                {stage.message}
              </p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Debug Code Block ────────────────────────────────────────────────────────

function CodeBlock({ label, content, onCopy }: { label: string; content: string; onCopy: () => void }) {
  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-white/[0.02] border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <Icons.terminal className="w-3 h-3 text-zinc-600" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.08em]">{label}</span>
        </div>
        <motion.button
          onClick={onCopy}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-all duration-200"
        >
          <Icons.copy className="w-3 h-3" />
          Copy
        </motion.button>
      </div>
      <pre className="px-3.5 py-3 text-[11px] font-mono text-zinc-400 leading-relaxed overflow-x-auto max-h-48 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800">
        {content}
      </pre>
    </div>
  );
}

// ─── Document Detail View ────────────────────────────────────────────────────

function DocumentDetail({ doc, onBack, toast }: {
  doc: FailedDocument;
  onBack: () => void;
  toast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'debug' | 'pdf'>('overview');
  const errCfg = ERROR_TYPE_CONFIG[doc.errorType];
  const avatarColor = getAvatarColor(doc.customerId);

  const handleCopy = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast(`Copied ${label} to clipboard`, 'success');
    }).catch(() => {
      toast('Failed to copy', 'error');
    });
  }, [toast]);

  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: Icons.info },
    { key: 'debug' as const, label: 'Debug Info', icon: Icons.bug },
    { key: 'pdf' as const, label: 'View PDF', icon: Icons.file },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: 'spring', damping: 28, stiffness: 350 }}
      className="h-full flex flex-col"
    >
      {/* Detail Header */}
      <div className="flex-shrink-0 relative">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(239,68,68,0.03) 0%, transparent 100%)'
        }} />
        <div className="relative px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6 pb-4 sm:pb-5">
          {/* Back button + title */}
          <div className="flex items-center gap-3 mb-4">
            <motion.button
              onClick={onBack}
              whileHover={{ scale: 1.05, x: -2 }}
              whileTap={{ scale: 0.95 }}
              className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:border-white/[0.1] transition-all duration-200"
            >
              <Icons.arrowLeft className="w-4 h-4" />
            </motion.button>
            <div className="flex-1 min-w-0">
              <h2 className="text-[15px] sm:text-[16px] font-bold text-zinc-100 tracking-[-0.02em] truncate">
                {doc.fileName}
              </h2>
              <div className="flex items-center gap-2.5 mt-1">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg ${errCfg.color.bg} border ${errCfg.color.border}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${errCfg.color.dot}`} />
                  <span className={`text-[10px] font-bold ${errCfg.color.text}`}>{errCfg.shortLabel}</span>
                </span>
                <span className="text-[11px] text-zinc-600">{formatRelativeTime(doc.processedAt)}</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-white/[0.02] rounded-xl p-1 border border-white/[0.04]">
            {tabs.map(tab => (
              <motion.button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                whileTap={{ scale: 0.97 }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] sm:text-[12px] font-bold transition-all duration-250 ${
                  activeTab === tab.key
                    ? 'bg-white/[0.06] text-zinc-200 border border-white/[0.08] shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </motion.button>
            ))}
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Error Summary Card */}
                <div className={`p-4 rounded-2xl border ${errCfg.color.bg} ${errCfg.color.border}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${errCfg.color.bg} border ${errCfg.color.border}`}>
                      <errCfg.icon className={`w-4.5 h-4.5 ${errCfg.color.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-[13px] font-bold ${errCfg.color.text}`}>{errCfg.label}</h3>
                      <p className="text-[12px] text-zinc-400 mt-1 leading-relaxed">{doc.errorMessage}</p>
                      <div className="flex items-center gap-2 mt-2.5">
                        <span className="text-[10px] font-mono text-zinc-600 px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.05]">
                          {doc.errorCode}
                        </span>
                        <span className="text-[10px] text-zinc-600">
                          Retry {doc.retryCount}/{doc.maxRetries}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.01]">
                  <div className="flex items-center gap-2 mb-3">
                    <Icons.user className="w-3.5 h-3.5 text-zinc-600" />
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.1em]">Customer</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${avatarColor.bg} border ${avatarColor.border} flex items-center justify-center`}>
                      <span className={`text-[13px] font-bold ${avatarColor.text}`}>
                        {getInitials(doc.customerName)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-zinc-200 truncate">{doc.customerName}</p>
                      <p className="text-[11px] text-zinc-500 truncate flex items-center gap-1">
                        <Icons.mail className="w-3 h-3 flex-shrink-0" />
                        {doc.customerEmail}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-600 px-2 py-1 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                      {doc.customerId}
                    </span>
                  </div>
                </div>

                {/* Document Details */}
                <div className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.01]">
                  <div className="flex items-center gap-2 mb-3">
                    <Icons.fileText className="w-3.5 h-3.5 text-zinc-600" />
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.1em]">Document Details</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'File Name', value: doc.fileName },
                      { label: 'File Size', value: formatFileSize(doc.fileSize) },
                      { label: 'Processed At', value: formatFullDate(doc.processedAt) },
                      { label: 'Document ID', value: doc.id },
                    ].map((item, i) => (
                      <div key={i} className="px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <p className="text-[10px] text-zinc-600 font-medium mb-0.5">{item.label}</p>
                        <p className="text-[12px] text-zinc-300 font-semibold truncate">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Processing Pipeline */}
                <div className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.01]">
                  <div className="flex items-center gap-2 mb-3">
                    <Icons.layers className="w-3.5 h-3.5 text-zinc-600" />
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.1em]">Processing Pipeline</span>
                    <div className="flex-1 h-px bg-white/[0.04]" />
                    <span className="text-[10px] text-zinc-600 tabular-nums font-mono">
                      {doc.pipeline.reduce((s, p) => s + p.duration, 0)}ms total
                    </span>
                  </div>
                  <PipelineView stages={doc.pipeline} />
                </div>

                {/* Metadata */}
                {Object.keys(doc.metadata).length > 0 && (
                  <div className="p-4 rounded-2xl border border-white/[0.06] bg-white/[0.01]">
                    <div className="flex items-center gap-2 mb-3">
                      <Icons.hash className="w-3.5 h-3.5 text-zinc-600" />
                      <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.1em]">Metadata</span>
                    </div>
                    <div className="space-y-1.5">
                      {Object.entries(doc.metadata).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <span className="text-[11px] font-mono text-zinc-500">{key}</span>
                          <span className="text-[11px] font-mono text-zinc-300">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'debug' && (
              <motion.div
                key="debug"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <CodeBlock
                  label="Error Message"
                  content={`Error Code: ${doc.errorCode}\nType: ${doc.errorType}\n\n${doc.errorMessage}\n\n${doc.errorDetails}`}
                  onCopy={() => handleCopy(`${doc.errorCode}: ${doc.errorMessage}\n${doc.errorDetails}`, 'error details')}
                />

                <CodeBlock
                  label="Stack Trace"
                  content={doc.stackTrace}
                  onCopy={() => handleCopy(doc.stackTrace, 'stack trace')}
                />

                <CodeBlock
                  label="Pipeline Execution Log"
                  content={doc.pipeline.map((s, i) =>
                    `[${s.timestamp}] Stage ${i + 1}: ${s.name}\n  Status: ${s.status.toUpperCase()}\n  Duration: ${s.duration}ms${s.message ? `\n  Message: ${s.message}` : ''}`
                  ).join('\n\n')}
                  onCopy={() => handleCopy(
                    doc.pipeline.map((s, i) =>
                      `[${s.timestamp}] Stage ${i + 1}: ${s.name} | ${s.status} | ${s.duration}ms${s.message ? ` | ${s.message}` : ''}`
                    ).join('\n'),
                    'pipeline log'
                  )}
                />

                <CodeBlock
                  label="Full Document Payload (JSON)"
                  content={JSON.stringify({
                    id: doc.id,
                    fileName: doc.fileName,
                    fileSize: doc.fileSize,
                    customerId: doc.customerId,
                    customerName: doc.customerName,
                    processedAt: doc.processedAt,
                    errorType: doc.errorType,
                    errorCode: doc.errorCode,
                    errorMessage: doc.errorMessage,
                    errorDetails: doc.errorDetails,
                    retryCount: doc.retryCount,
                    maxRetries: doc.maxRetries,
                    pipeline: doc.pipeline,
                    metadata: doc.metadata,
                  }, null, 2)}
                  onCopy={() => handleCopy(JSON.stringify(doc, null, 2), 'JSON payload')}
                />
              </motion.div>
            )}

            {activeTab === 'pdf' && (
              <motion.div
                key="pdf"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                      <Icons.file className="w-3.5 h-3.5 text-rose-400" />
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-zinc-300">{doc.fileName}</p>
                      <p className="text-[10px] text-zinc-600">{formatFileSize(doc.fileSize)}</p>
                    </div>
                  </div>
                  <motion.a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/15 hover:border-indigo-500/30 transition-all duration-200"
                  >
                    <Icons.externalLink className="w-3 h-3" />
                    Open in New Tab
                  </motion.a>
                </div>

                <div className="rounded-2xl border border-white/[0.06] overflow-hidden bg-zinc-950">
                  <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.02] border-b border-white/[0.04]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500/40" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
                    </div>
                    <span className="text-[10px] text-zinc-600 font-mono ml-2 truncate">{doc.fileUrl}</span>
                  </div>
                  <div className="relative" style={{ height: 'calc(100vh - 420px)', minHeight: '400px' }}>
                    <iframe
                      src={doc.fileUrl}
                      className="w-full h-full border-0"
                      title={`PDF Viewer - ${doc.fileName}`}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Document List Card ──────────────────────────────────────────────────────

function DocumentCard({ doc, onClick }: { doc: FailedDocument; onClick: () => void }) {
  const errCfg = ERROR_TYPE_CONFIG[doc.errorType];
  const avatarColor = getAvatarColor(doc.customerId);

  return (
    <motion.div
      layout
      variants={staggerItem}
      whileHover={{ scale: 1.005 }}
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.06] hover:border-white/[0.1] bg-white/[0.01] hover:bg-white/[0.015] transition-all duration-300 cursor-pointer"
    >
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${
        errCfg.color.dot === 'bg-rose-400' ? 'via-rose-500/40' :
        errCfg.color.dot === 'bg-orange-400' ? 'via-orange-500/40' :
        errCfg.color.dot === 'bg-amber-400' ? 'via-amber-500/40' :
        errCfg.color.dot === 'bg-yellow-400' ? 'via-yellow-500/40' :
        errCfg.color.dot === 'bg-violet-400' ? 'via-violet-500/40' :
        errCfg.color.dot === 'bg-red-400' ? 'via-red-500/40' :
        errCfg.color.dot === 'bg-sky-400' ? 'via-sky-500/40' :
        'via-pink-500/40'
      } to-transparent`} />

      <div className="px-4 sm:px-5 py-4">
        <div className="flex items-start gap-3.5">
          <div className={`w-11 h-11 rounded-xl ${errCfg.color.bg} border ${errCfg.color.border} flex items-center justify-center flex-shrink-0`}>
            <errCfg.icon className={`w-[18px] h-[18px] ${errCfg.color.text}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[13px] sm:text-[14px] font-bold text-zinc-100 tracking-[-0.02em] truncate">
                {doc.fileName}
              </h3>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg ${errCfg.color.bg} border ${errCfg.color.border} flex-shrink-0`}>
                <div className={`w-1.5 h-1.5 rounded-full ${errCfg.color.dot}`} />
                <span className={`text-[10px] font-bold ${errCfg.color.text}`}>{errCfg.shortLabel}</span>
              </span>
            </div>

            <p className="text-[12px] text-zinc-500 mt-1 line-clamp-1">{doc.errorMessage}</p>

            <div className="flex items-center gap-3 mt-2.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-md ${avatarColor.bg} border ${avatarColor.border} flex items-center justify-center`}>
                  <span className={`text-[8px] font-bold ${avatarColor.text}`}>{getInitials(doc.customerName)}</span>
                </div>
                <span className="text-[11px] text-zinc-400 font-medium">{doc.customerName}</span>
              </div>

              <div className="w-px h-3 bg-white/[0.06]" />

              <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                <Icons.clock className="w-2.5 h-2.5" />
                {formatRelativeTime(doc.processedAt)}
              </span>

              <div className="w-px h-3 bg-white/[0.06]" />

              <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                <Icons.file className="w-2.5 h-2.5" />
                {formatFileSize(doc.fileSize)}
              </span>

              {doc.retryCount > 0 && (
                <>
                  <div className="w-px h-3 bg-white/[0.06]" />
                  <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                    <Icons.refresh className="w-2.5 h-2.5" />
                    {doc.retryCount}/{doc.maxRetries} retries
                  </span>
                </>
              )}
            </div>
          </div>

          <motion.div
            className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            <Icons.chevronRight className="w-3.5 h-3.5 text-zinc-500" />
          </motion.div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-700 px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/[0.04]">
            {doc.errorCode}
          </span>
          <div className="flex-1 h-px bg-white/[0.03]" />
          <span className="text-[10px] text-zinc-700 font-medium">
            {formatFullDate(doc.processedAt)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col items-center justify-center py-20 sm:py-24"
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-5"
      >
        {filtered
          ? <Icons.search className="w-6 h-6 text-zinc-700" />
          : <Icons.check className="w-6 h-6 text-emerald-600" />
        }
      </motion.div>
      <p className="text-[14px] font-semibold text-zinc-500 tracking-[-0.02em]">
        {filtered ? 'No failed documents match your filters' : 'No failed documents'}
      </p>
      <p className="text-[12px] text-zinc-600 mt-1.5 tracking-[-0.01em]">
        {filtered ? 'Try adjusting your search or filters' : 'All documents have been processed successfully'}
      </p>
    </motion.div>
  );
}

// ─── Stat Pill ───────────────────────────────────────────────────────────────

function StatPill({ label, value, accent, color }: { label: string; value: number; accent?: boolean; color?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-[13px] font-bold tabular-nums tracking-[-0.02em] ${color || (accent ? 'text-zinc-300' : 'text-zinc-500')}`}>
        {value}
      </span>
      <span className="text-[11px] text-zinc-600 font-medium">
        {label}
      </span>
    </div>
  );
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_FAILED_DOCS: FailedDocument[] = [
  {
    id: 'doc_f1a2b3c4',
    fileName: 'invoice_2024_Q3_final.pdf',
    fileSize: 2457600,
    fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    customerId: 'cust_8x9y1z',
    customerName: 'Acme Corporation',
    customerEmail: 'billing@acme.com',
    processedAt: new Date(Date.now() - 1200000).toISOString(),
    errorType: 'ocr_failure',
    errorCode: 'ERR_OCR_001',
    errorMessage: 'OCR engine failed to extract text from pages 3-7. Document contains heavily rotated and skewed text blocks.',
    errorDetails: 'The Tesseract OCR engine returned confidence scores below the minimum threshold (0.4) for 5 consecutive pages.',
    stackTrace: `DocumentProcessingError: OCR extraction failed\n    at OcrEngine.extractText (src/engines/ocr.ts:142:15)\n    at Pipeline.runOcr (src/pipeline/stages/ocr.ts:58:22)`,
    pipeline: [
      { name: 'File Upload & Validation', status: 'success', duration: 120, timestamp: new Date(Date.now() - 1200000).toISOString() },
      { name: 'Format Detection', status: 'success', duration: 45, timestamp: new Date(Date.now() - 1199880).toISOString() },
      { name: 'Page Extraction', status: 'success', duration: 890, timestamp: new Date(Date.now() - 1199835).toISOString() },
      { name: 'OCR Processing', status: 'failed', duration: 15200, message: 'Confidence below threshold on pages 3-7', timestamp: new Date(Date.now() - 1198945).toISOString() },
      { name: 'Field Extraction', status: 'skipped', duration: 0, message: 'Skipped due to OCR failure', timestamp: new Date(Date.now() - 1183745).toISOString() },
      { name: 'AI Classification', status: 'skipped', duration: 0, message: 'Skipped due to OCR failure', timestamp: new Date(Date.now() - 1183745).toISOString() },
    ],
    retryCount: 2,
    maxRetries: 3,
    metadata: { pageCount: '12', language: 'en', dpi: '150', colorSpace: 'RGB' },
  },
  {
    id: 'doc_e5f6g7h8',
    fileName: 'contract_amendment_v2.pdf',
    fileSize: 5242880,
    fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    customerId: 'cust_3a4b5c',
    customerName: 'TechFlow Solutions',
    customerEmail: 'docs@techflow.io',
    processedAt: new Date(Date.now() - 3600000).toISOString(),
    errorType: 'timeout',
    errorCode: 'ERR_TIMEOUT_002',
    errorMessage: 'Processing exceeded the maximum allowed time of 120 seconds during AI classification stage.',
    errorDetails: 'The document classification model timed out after 120s.',
    stackTrace: `TimeoutError: Processing exceeded 120s limit\n    at Timer.check (src/utils/timer.ts:28:11)`,
    pipeline: [
      { name: 'File Upload & Validation', status: 'success', duration: 230, timestamp: new Date(Date.now() - 3600000).toISOString() },
      { name: 'Format Detection', status: 'success', duration: 62, timestamp: new Date(Date.now() - 3599770).toISOString() },
      { name: 'Page Extraction', status: 'success', duration: 2100, timestamp: new Date(Date.now() - 3599708).toISOString() },
      { name: 'OCR Processing', status: 'success', duration: 18400, timestamp: new Date(Date.now() - 3597608).toISOString() },
      { name: 'Field Extraction', status: 'success', duration: 3200, timestamp: new Date(Date.now() - 3579208).toISOString() },
      { name: 'AI Classification', status: 'failed', duration: 120003, message: 'Timeout exceeded (120s limit)', timestamp: new Date(Date.now() - 3576008).toISOString() },
    ],
    retryCount: 3,
    maxRetries: 3,
    metadata: { pageCount: '47', language: 'en', dpi: '300', colorSpace: 'CMYK' },
  },
  {
    id: 'doc_i9j0k1l2',
    fileName: 'bank_statement_march.pdf',
    fileSize: 1048576,
    fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    customerId: 'cust_7m8n9o',
    customerName: 'Sarah Mitchell',
    customerEmail: 'sarah.mitchell@email.com',
    processedAt: new Date(Date.now() - 7200000).toISOString(),
    errorType: 'missing_fields',
    errorCode: 'ERR_FIELDS_003',
    errorMessage: 'Required fields "account_number" and "statement_date" could not be extracted.',
    errorDetails: 'Field extraction completed but required fields were not found.',
    stackTrace: `FieldExtractionError: Missing required fields\n    at FieldValidator.validate (src/validation/fields.ts:67:13)`,
    pipeline: [
      { name: 'File Upload & Validation', status: 'success', duration: 95, timestamp: new Date(Date.now() - 7200000).toISOString() },
      { name: 'Format Detection', status: 'success', duration: 38, timestamp: new Date(Date.now() - 7199905).toISOString() },
      { name: 'Page Extraction', status: 'success', duration: 420, timestamp: new Date(Date.now() - 7199867).toISOString() },
      { name: 'OCR Processing', status: 'success', duration: 3200, timestamp: new Date(Date.now() - 7199447).toISOString() },
      { name: 'Field Extraction', status: 'failed', duration: 1800, message: 'Missing required fields', timestamp: new Date(Date.now() - 7196247).toISOString() },
      { name: 'AI Classification', status: 'skipped', duration: 0, timestamp: new Date(Date.now() - 7194447).toISOString() },
    ],
    retryCount: 1,
    maxRetries: 3,
    metadata: { pageCount: '3', language: 'en', dpi: '200' },
  },
];

// ─── Main App Component ──────────────────────────────────────────────────────

export default function App() {
  const [documents, setDocuments] = useState<FailedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<ErrorType | 'all'>('all');
  const [selectedDoc, setSelectedDoc] = useState<FailedDocument | null>(null);

  const { t: toasts, add: toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await new Promise(r => setTimeout(r, 800));
      setDocuments(MOCK_FAILED_DOCS);
      setIsLoading(false);
    };
    loadData();
  }, []);

  const filteredDocs = useMemo(() => {
    let docs = [...documents];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      docs = docs.filter(d =>
        d.fileName.toLowerCase().includes(q) ||
        d.customerName.toLowerCase().includes(q) ||
        d.customerEmail.toLowerCase().includes(q) ||
        d.errorMessage.toLowerCase().includes(q) ||
        d.errorCode.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q)
      );
    }

    if (filterType !== 'all') {
      docs = docs.filter(d => d.errorType === filterType);
    }

    docs.sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime());

    return docs;
  }, [documents, searchQuery, filterType]);

  const stats = useMemo(() => {
    const byType: Partial<Record<ErrorType, number>> = {};
    documents.forEach(d => {
      byType[d.errorType] = (byType[d.errorType] || 0) + 1;
    });
    const uniqueCustomers = new Set(documents.map(d => d.customerId)).size;
    return { total: documents.length, byType, uniqueCustomers };
  }, [documents]);

  const activeErrorTypes = useMemo(() => {
    const types = new Set(documents.map(d => d.errorType));
    return (Object.keys(ERROR_TYPE_CONFIG) as ErrorType[]).filter(t => types.has(t));
  }, [documents]);

  if (isLoading) {
    return (
      <div
        className="h-screen w-screen flex flex-col items-center justify-center"
        style={{ background: 'linear-gradient(180deg, #0a0a10 0%, #08080c 100%)' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center"
          >
            <Icons.loader className="w-5 h-5 text-rose-400" />
          </motion.div>
          <p className="text-sm text-zinc-500 font-medium">Loading failed documents...</p>
        </motion.div>
      </div>
    );
  }

  if (selectedDoc) {
    return (
      <div
        className="h-screen w-screen overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0a0a10 0%, #08080c 100%)' }}
      >
        <AnimatePresence mode="wait">
          <DocumentDetail
            key={selectedDoc.id}
            doc={selectedDoc}
            onBack={() => setSelectedDoc(null)}
            toast={toast}
          />
        </AnimatePresence>
        <Toasts items={toasts} />
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0a0a10 0%, #08080c 100%)' }}
    >
      <div className="h-full flex flex-col overflow-hidden">
        {/* Page Header */}
        <div className="flex-shrink-0 relative">
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(239,68,68,0.04) 0%, transparent 100%)'
          }} />

          <div className="relative px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-5 sm:pb-6">
            <div className="flex items-center justify-between mb-5">
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                className="flex items-center gap-3.5"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 16, delay: 0.05 }}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-rose-500/15 to-rose-500/5 border border-rose-500/20 flex items-center justify-center shadow-lg shadow-rose-500/[0.06]"
                >
                  <Icons.alertCircle className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-rose-400" />
                </motion.div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-zinc-50 tracking-[-0.03em]">Failed Documents</h1>
                  <p className="text-[11px] sm:text-[12px] text-zinc-500 font-medium mt-0.5">Review processing failures & debug errors</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 350, delay: 0.05 }}
                className="flex items-center gap-3"
              >
                <div className="hidden sm:flex items-center gap-3">
                  <StatPill label="failed" value={stats.total} accent color="text-rose-400" />
                  <div className="w-px h-3 bg-white/[0.06]" />
                  <StatPill label={stats.uniqueCustomers === 1 ? 'customer' : 'customers'} value={stats.uniqueCustomers} />
                </div>
              </motion.div>
            </div>

            {/* Search Bar */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.3 }}
              className="flex items-center gap-3"
            >
              <div className="relative flex-1 group/input">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within/input:text-rose-400/60 transition-colors duration-250">
                  <Icons.search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by filename, customer, error code..."
                  className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl pl-10 pr-4 py-3 text-[13px] text-zinc-100 outline-none focus:border-rose-500/40 focus:ring-2 focus:ring-rose-500/[0.1] focus:bg-white/[0.04] transition-all duration-250 placeholder:text-zinc-600 font-medium tracking-[-0.01em]"
                />
                <AnimatePresence>
                  {searchQuery && (
                    <motion.button
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', damping: 22, stiffness: 500 }}
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all duration-200"
                    >
                      <Icons.x className="w-3 h-3" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Error Type Filters */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.3 }}
              className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none"
            >
              <motion.button
                onClick={() => setFilterType('all')}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                className={`text-[11px] sm:text-[12px] px-3 py-1.5 rounded-xl font-bold border transition-all duration-250 flex items-center gap-1.5 flex-shrink-0 ${
                  filterType === 'all'
                    ? 'bg-zinc-500/10 border-zinc-500/20 text-zinc-300'
                    : 'bg-transparent border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-400'
                }`}
              >
                <Icons.filter className="w-3 h-3" />
                All Errors
                <span className={`text-[10px] tabular-nums ${filterType === 'all' ? 'opacity-70' : 'text-zinc-700'}`}>
                  {stats.total}
                </span>
              </motion.button>

              {activeErrorTypes.map(errType => {
                const cfg = ERROR_TYPE_CONFIG[errType];
                const count = stats.byType[errType] || 0;
                const isActive = filterType === errType;
                return (
                  <motion.button
                    key={errType}
                    onClick={() => setFilterType(isActive ? 'all' : errType)}
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.02 }}
                    className={`text-[11px] sm:text-[12px] px-3 py-1.5 rounded-xl font-bold border transition-all duration-250 flex items-center gap-1.5 flex-shrink-0 ${
                      isActive
                        ? `${cfg.color.bg} ${cfg.color.border} ${cfg.color.text}`
                        : 'bg-transparent border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-400'
                    }`}
                  >
                    <cfg.icon className={`w-3 h-3 ${isActive ? '' : 'opacity-60'}`} />
                    {cfg.shortLabel}
                    <span className={`text-[10px] tabular-nums ${isActive ? 'opacity-70' : 'text-zinc-700'}`}>
                      {count}
                    </span>
                  </motion.button>
                );
              })}

              {filterType !== 'all' && (
                <motion.button
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  onClick={() => setFilterType('all')}
                  whileTap={{ scale: 0.94 }}
                  className="text-[10px] px-2 py-1 rounded-lg font-bold text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-all duration-200 flex items-center gap-1 flex-shrink-0"
                >
                  <Icons.x className="w-3 h-3" /> Clear
                </motion.button>
              )}
            </motion.div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
            {filteredDocs.length === 0 ? (
              <EmptyState filtered={searchQuery.trim().length > 0 || filterType !== 'all'} />
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="space-y-3"
              >
                <AnimatePresence mode="popLayout">
                  {filteredDocs.map(doc => (
                    <DocumentCard
                      key={doc.id}
                      doc={doc}
                      onClick={() => setSelectedDoc(doc)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}

            {filteredDocs.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-6 flex items-center justify-center gap-4 py-4"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-lg bg-rose-500/10 flex items-center justify-center">
                    <Icons.info className="w-3 h-3 text-rose-400/40" />
                  </div>
                  <span className="text-[11px] text-zinc-600 font-medium">
                    {filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''} shown
                    {searchQuery || filterType !== 'all' ? ` of ${stats.total} total` : ''}
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <Toasts items={toasts} />
    </div>
  );
}