import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── USER IMPORTS ────────────────────────────────────────────────────────────
import DocumentProcessorDev from './dev/DocumentProcessorDev';
import DocumentProcessor from './customer/DocumentProcessor';
import ProcessedDocuments from './customer/ProcessedDocuments';
import AnalyticsPage from './owner/Analytics';
import PermissionsPage from './owner/PermissionsPage';
import ErrorDashboard from './admin/ErrorDashboard';

// ─── Configuration ───────────────────────────────────────────────────────────

const DEBUG = true;

// ─── Types ───────────────────────────────────────────────────────────────────

type UserRole = 'admin' | 'owner' | 'customer' | 'dev' | null;

interface User {
  email: string;
  role: UserRole;
  name: string;
  avatar: string;
}

// ─── Role Mapping ────────────────────────────────────────────────────────────

const ROLE_MAP: Record<string, { role: UserRole; name: string }> = {
  'admin@email.com': { role: 'admin', name: 'Admin User' },
  'owner@email.com': { role: 'owner', name: 'Owner User' },
  'customer@email.com': { role: 'customer', name: 'Customer User' },
  'dev@email.com': { role: 'dev', name: 'Developer User' },
};

const ROLE_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  border: string;
  text: string;
  glow: string;
  icon: string;
  gradient: string;
  description: string;
}> = {
  admin: {
    label: 'Admin',
    color: 'indigo',
    bg: 'bg-indigo-500/[0.08]',
    border: 'border-indigo-500/20',
    text: 'text-indigo-400',
    glow: 'shadow-indigo-500/20',
    icon: '🛡️',
    gradient: 'from-indigo-500/20 to-violet-500/10',
    description: 'Error monitoring, system health & analytics',
  },
  owner: {
    label: 'Owner',
    color: 'emerald',
    bg: 'bg-emerald-500/[0.08]',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/20',
    icon: '👑',
    gradient: 'from-emerald-500/20 to-teal-500/10',
    description: 'Analytics & permissions management',
  },
  customer: {
    label: 'Customer',
    color: 'amber',
    bg: 'bg-amber-500/[0.08]',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/20',
    icon: '✨',
    gradient: 'from-amber-500/20 to-orange-500/10',
    description: 'Document processing & management',
  },
  dev: {
    label: 'Developer',
    color: 'cyan',
    bg: 'bg-cyan-500/[0.08]',
    border: 'border-cyan-500/20',
    text: 'text-cyan-400',
    glow: 'shadow-cyan-500/20',
    icon: '⚡',
    gradient: 'from-cyan-500/20 to-sky-500/10',
    description: 'Developer processor & tools',
  },
};

// ─── SVG Icons ───────────────────────────────────────────────────────────────

const Icons = {
  mail: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  arrowRight: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  ),
  loader: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  ),
  check: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  shield: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  logOut: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  sparkle: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
    </svg>
  ),
  users: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  barChart: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  ),
  settings: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
  package: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  home: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  globe: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  creditCard: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  info: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  copy: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  code: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  terminal: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  git: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
      <line x1="6" y1="9" x2="6" y2="21" />
    </svg>
  ),
  database: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
  zap: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  cpu: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  ),
  activity: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  key: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  ),
  document: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  alertTriangle: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  archive: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  ),
  plus: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  send: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  close: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

// ─── Animation Variants ─────────────────────────────────────────────────────

const staggerContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', damping: 28, stiffness: 380 } },
};

// ─── Floating Particles Background ──────────────────────────────────────────

function FloatingParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.3 + 0.05,
    })), []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-indigo-400"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            opacity: p.opacity,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [p.opacity, p.opacity * 1.5, p.opacity],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ─── Grid Background ────────────────────────────────────────────────────────

function GridBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 30%, rgba(99,102,241,0.06) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 40% 30% at 70% 60%, rgba(139,92,246,0.04) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}

// ─── Toast System ────────────────────────────────────────────────────────────

function useToast() {
  const [items, setItems] = useState<{ id: string; msg: string; type: 'success' | 'error' | 'info' }[]>([]);
  const add = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 11);
    setItems(p => [...p, { id, msg, type }]);
    setTimeout(() => setItems(p => p.filter(x => x.id !== id)), 3500);
  }, []);
  return { items, add };
}

function Toasts({ items }: { items: { id: string; msg: string; type: string }[] }) {
  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col-reverse gap-2.5 pointer-events-none">
      <AnimatePresence>
        {items.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.9, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 16, scale: 0.9, filter: 'blur(6px)' }}
            transition={{ type: 'spring', damping: 30, stiffness: 420 }}
            className={`pointer-events-auto px-4 py-3 rounded-2xl text-[12px] font-semibold flex items-center gap-2.5 border backdrop-blur-2xl tracking-[-0.01em] ${
              t.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/20 text-emerald-300 shadow-xl shadow-emerald-950/40'
              : t.type === 'error' ? 'bg-rose-950/90 border-rose-500/20 text-rose-300 shadow-xl shadow-rose-950/40'
              : 'bg-zinc-900/90 border-zinc-700/25 text-zinc-300 shadow-xl shadow-black/50'
            }`}
          >
            {t.type === 'success' && <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center"><Icons.check className="w-2.5 h-2.5 text-emerald-400" /></div>}
            {t.type === 'error' && <div className="w-5 h-5 rounded-full bg-rose-500/15 flex items-center justify-center"><Icons.info className="w-2.5 h-2.5 text-rose-400" /></div>}
            {t.type === 'info' && <div className="w-5 h-5 rounded-full bg-zinc-500/15 flex items-center justify-center"><Icons.info className="w-2.5 h-2.5 text-zinc-400" /></div>}
            <span>{t.msg}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Debug Panel ─────────────────────────────────────────────────────────────

function DebugPanel({ onFill }: { onFill: (email: string) => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (email: string) => {
    navigator.clipboard?.writeText(email);
    setCopied(email);
    setTimeout(() => setCopied(null), 1500);
  };

  if (!DEBUG) return null;

  const accounts = [
    { email: 'admin@email.com', role: 'admin' as const },
    { email: 'owner@email.com', role: 'owner' as const },
    { email: 'customer@email.com', role: 'customer' as const },
    { email: 'dev@email.com', role: 'dev' as const },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, type: 'spring', damping: 28 }}
      className="w-full max-w-sm mt-4"
    >
      <div className="rounded-2xl border border-amber-500/10 bg-amber-500/[0.02] backdrop-blur-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-amber-500/10">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[10px] font-bold text-amber-500/70 uppercase tracking-[0.15em]">Debug Mode</span>
        </div>
        <div className="p-2.5 space-y-1.5">
          {accounts.map(({ email, role }) => {
            const config = ROLE_CONFIG[role];
            return (
              <motion.div
                key={email}
                className="flex items-center gap-2 group"
              >
                <motion.button
                  onClick={() => onFill(email)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all duration-250 ${config.bg} ${config.border} hover:brightness-125`}
                >
                  <span className="text-sm leading-none">{config.icon}</span>
                  <div className="flex-1 text-left">
                    <span className={`text-[10px] font-bold ${config.text} block`}>{config.label}</span>
                    <span className="text-[9px] text-zinc-600 font-mono">{email}</span>
                  </div>
                  <Icons.arrowRight className={`w-3 h-3 ${config.text} opacity-0 group-hover:opacity-60 transition-opacity duration-200`} />
                </motion.button>
                <motion.button
                  onClick={() => handleCopy(email)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-6 h-6 flex items-center justify-center rounded-lg border border-white/[0.06] text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-all duration-200"
                >
                  {copied === email ? (
                    <Icons.check className="w-2.5 h-2.5 text-emerald-400" />
                  ) : (
                    <Icons.copy className="w-2.5 h-2.5" />
                  )}
                </motion.button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Auth Page ───────────────────────────────────────────────────────────────

function AuthPage({ onAuth }: { onAuth: (user: User) => void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { items: toasts, add: toast } = useToast();

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const isValidEmail = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }, [email]);

  const matchedRole = useMemo(() => {
    const lower = email.toLowerCase().trim();
    return ROLE_MAP[lower] || null;
  }, [email]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (!isValidEmail) {
      setError('Please enter a valid email');
      return;
    }

    const roleInfo = ROLE_MAP[email.toLowerCase().trim()];
    if (!roleInfo) {
      setError('Account not found. Try one of the debug emails.');
      toast('Account not found', 'error');
      return;
    }

    const user: User = {
      email: email.toLowerCase().trim(),
      role: roleInfo.role,
      name: roleInfo.name,
      avatar: ROLE_CONFIG[roleInfo.role!].icon,
    };

    onAuth(user);
  }, [email, isValidEmail, toast, onAuth]);

  const handleDebugFill = useCallback((debugEmail: string) => {
    setEmail(debugEmail);
    setError('');
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className="h-screen w-full flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0a0a10 0%, #06060a 50%, #0a0a10 100%)' }}
    >
      <GridBackground />
      <FloatingParticles />

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] pointer-events-none" style={{
        background: 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 60%)',
      }} />

      <div className="relative z-10 w-full max-w-sm px-5 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          className="w-full flex flex-col items-center"
        >
          <motion.div
            className="flex flex-col items-center mb-8"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            <motion.div
              variants={staggerItem}
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 shadow-2xl shadow-indigo-500/10 relative"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent" />
              <Icons.sparkle className="w-6 h-6 text-indigo-400 relative z-10" />
            </motion.div>

            <motion.h1
              variants={staggerItem}
              className="text-2xl font-bold text-zinc-50 tracking-[-0.04em] text-center"
            >
              MerlinAAP
            </motion.h1>
            <motion.p
              variants={staggerItem}
              className="text-[13px] text-zinc-500 mt-1.5 text-center font-medium tracking-[-0.01em]"
            >
              Sign in with your email
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.25, type: 'spring', damping: 28 }}
            className="w-full relative"
          >
            <div className="rounded-2xl border border-white/[0.08] bg-[#0e0e14]/80 backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent h-20 pointer-events-none rounded-t-2xl" />

              <form onSubmit={handleSubmit} className="relative p-5 space-y-4">
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 mb-1.5 block uppercase tracking-[0.1em]">
                    Email Address
                  </label>
                  <div className={`relative rounded-xl transition-all duration-300 ${
                    isFocused
                      ? 'ring-2 ring-indigo-500/[0.15] shadow-lg shadow-indigo-500/[0.05]'
                      : error
                        ? 'ring-2 ring-rose-500/[0.15]'
                        : ''
                  }`}>
                    <div className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-300 ${
                      isFocused ? 'text-indigo-400/60' : error ? 'text-rose-400/40' : 'text-zinc-600'
                    }`}>
                      <Icons.mail className="w-4 h-4" />
                    </div>
                    <input
                      ref={inputRef}
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(''); }}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className={`w-full bg-white/[0.03] border rounded-xl pl-10 pr-4 py-3 text-[13px] text-zinc-100 outline-none transition-all duration-300 placeholder:text-zinc-600 font-medium tracking-[-0.01em] ${
                        error
                          ? 'border-rose-500/30 focus:border-rose-500/40'
                          : 'border-white/[0.07] focus:border-indigo-500/40'
                      }`}
                    />
                    <AnimatePresence>
                      {matchedRole && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', damping: 18, stiffness: 400 }}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
                            ROLE_CONFIG[matchedRole.role!].bg
                          } border ${ROLE_CONFIG[matchedRole.role!].border}`}>
                            <Icons.check className={`w-2.5 h-2.5 ${ROLE_CONFIG[matchedRole.role!].text}`} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -4, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -4, height: 0 }}
                        className="text-[10px] text-rose-400/80 font-medium mt-1.5 flex items-center gap-1.5"
                      >
                        <div className="w-3 h-3 rounded-full bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                          <Icons.info className="w-1.5 h-1.5 text-rose-400" />
                        </div>
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {matchedRole && !error && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -4, height: 0 }}
                        transition={{ type: 'spring', damping: 28 }}
                        className="mt-2"
                      >
                        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${
                          ROLE_CONFIG[matchedRole.role!].bg
                        } border ${ROLE_CONFIG[matchedRole.role!].border}`}>
                          <span className="text-xs leading-none">{ROLE_CONFIG[matchedRole.role!].icon}</span>
                          <div className="flex-1">
                            <p className={`text-[10px] font-bold ${ROLE_CONFIG[matchedRole.role!].text}`}>
                              {ROLE_CONFIG[matchedRole.role!].label} Account
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <motion.button
                  type="submit"
                  disabled={!email.trim()}
                  whileHover={email.trim() ? { scale: 1.01 } : {}}
                  whileTap={email.trim() ? { scale: 0.98 } : {}}
                  className={`w-full py-3 rounded-xl text-[13px] font-bold border transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden group ${
                    email.trim()
                      ? 'bg-gradient-to-r from-indigo-500/20 to-indigo-600/15 text-indigo-200 border-indigo-500/25 hover:from-indigo-500/25 hover:to-indigo-600/20 hover:border-indigo-500/35 shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20'
                      : 'bg-white/[0.02] text-zinc-700 border-white/[0.06] cursor-not-allowed'
                  }`}
                >
                  {email.trim() && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  )}
                  <span className="relative z-10">Continue</span>
                  <Icons.arrowRight className="w-3.5 h-3.5 relative z-10 group-hover:translate-x-0.5 transition-transform duration-200" />
                </motion.button>

                <div className="flex items-center justify-center gap-1.5 pt-0.5">
                  <Icons.shield className="w-2.5 h-2.5 text-zinc-700" />
                  <span className="text-[9px] text-zinc-700 font-medium">
                    Passwordless • Secure • Instant
                  </span>
                </div>
              </form>
            </div>
          </motion.div>

          <DebugPanel onFill={handleDebugFill} />
        </motion.div>
      </div>

      <Toasts items={toasts} />
    </div>
  );
}

// ─── Dashboard Nav Item ──────────────────────────────────────────────────────

function NavItem({ icon: Icon, label, active, onClick }: {
  icon: (p: React.SVGProps<SVGSVGElement>) => JSX.Element;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl w-full text-left transition-all duration-250 ${
        active
          ? 'bg-white/[0.06] text-zinc-200 border border-white/[0.08]'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] border border-transparent'
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="text-[13px] font-semibold tracking-[-0.01em]">{label}</span>
    </motion.button>
  );
}

// ─── Dashboard Shell ─────────────────────────────────────────────────────────

function DashboardShell({ user, onLogout, roleConfig, navItems, children }: {
  user: User;
  onLogout: () => void;
  roleConfig: typeof ROLE_CONFIG[string];
  navItems: { icon: (p: React.SVGProps<SVGSVGElement>) => JSX.Element; label: string; active?: boolean; onClick?: () => void }[];
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div
      className="min-h-screen w-full flex relative"
      style={{ background: 'linear-gradient(180deg, #0a0a10 0%, #08080c 100%)' }}
    >
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{
          x: sidebarOpen ? 0 : (typeof window !== 'undefined' && window.innerWidth < 1024) ? -280 : 0,
        }}
        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        className="fixed lg:sticky top-0 left-0 z-50 lg:z-auto h-screen w-[260px] sm:w-[280px] border-r border-white/[0.06] bg-[#0a0a10]/95 backdrop-blur-xl flex flex-col flex-shrink-0"
      >
        <div className="p-4 sm:p-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${roleConfig.gradient} border ${roleConfig.border} flex items-center justify-center text-lg`}>
              {roleConfig.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-zinc-100 truncate tracking-[-0.01em]">{user.name}</p>
              <p className={`text-[10px] font-bold ${roleConfig.text} uppercase tracking-[0.1em]`}>
                {roleConfig.label}
              </p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item, i) => (
            <NavItem key={i} icon={item.icon} label={item.label} active={item.active} onClick={item.onClick} />
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.06] space-y-2">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              <Icons.mail className="w-3.5 h-3.5 text-zinc-500" />
            </div>
            <span className="text-[11px] text-zinc-500 font-mono truncate flex-1">{user.email}</span>
          </div>
          <motion.button
            onClick={onLogout}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/[0.06] border border-transparent hover:border-rose-500/15 transition-all duration-250"
          >
            <Icons.logOut className="w-4 h-4" />
            <span className="text-[13px] font-semibold">Sign Out</span>
          </motion.button>
        </div>
      </motion.aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-4 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 border-b border-white/[0.06] bg-[#0a0a10]/80 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] border border-white/[0.06] transition-all"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-4 h-4">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${roleConfig.bg} ${roleConfig.border} border ${roleConfig.text} uppercase tracking-[0.1em]`}>
              {roleConfig.label}
            </span>
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${roleConfig.gradient} border ${roleConfig.border} flex items-center justify-center text-sm`}>
              {roleConfig.icon}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

// ─── Admin Dashboard ─────────────────────────────────────────────────────────

function AdminDashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const config = ROLE_CONFIG.admin;
  const [activeTab, setActiveTab] = useState('errors');

  const navItems = [
    { icon: Icons.alertTriangle, label: 'Error Dashboard', active: activeTab === 'errors', onClick: () => setActiveTab('errors') }
  ];

  return (
    <DashboardShell user={user} onLogout={onLogout} roleConfig={config} navItems={navItems}>
      <AnimatePresence mode="wait">
        {activeTab === 'errors' ? (
          <motion.div key="error-dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <ErrorDashboard />
          </motion.div> 
        ) : (
          <motion.div key="empty" className="flex items-center justify-center h-64 text-zinc-500">
            Section not implemented
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardShell>
  );
}

// ─── Owner Dashboard ─────────────────────────────────────────────────────────

function OwnerDashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const config = ROLE_CONFIG.owner;
  const [activeTab, setActiveTab] = useState('analytics');

  const navItems = [
    { icon: Icons.barChart, label: 'Analytics', active: activeTab === 'analytics', onClick: () => setActiveTab('analytics') },
    { icon: Icons.shield, label: 'Permissions', active: activeTab === 'permissions', onClick: () => setActiveTab('permissions') },
  ];

  return (
    <DashboardShell user={user} onLogout={onLogout} roleConfig={config} navItems={navItems}>
      <AnimatePresence mode="wait">
        {activeTab === 'analytics' ? (
          <motion.div key="analytics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <AnalyticsPage />
          </motion.div>
        ) : activeTab === 'permissions' ? (
          <motion.div key="permissions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <PermissionsPage />
          </motion.div>
        ) : (
          <motion.div key="empty" className="flex items-center justify-center h-64 text-zinc-500">
            Section not implemented
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardShell>
  );
}

// ─── Request Credits Modal ───────────────────────────────────────────────────

interface CreditRequestForm {
  amount: string;
  reason: string;
  urgency: 'low' | 'medium' | 'high';
}

function RequestCreditsModal({ isOpen, onClose, onSubmit, currentCredits }: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: CreditRequestForm) => void;
  currentCredits: number;
}) {
  const [form, setForm] = useState<CreditRequestForm>({
    amount: '',
    reason: '',
    urgency: 'medium',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof CreditRequestForm, string>>>({});

  const creditPackages = [
    { amount: 100, label: '100 Credits', price: '$10', popular: false },
    { amount: 500, label: '500 Credits', price: '$45', popular: true },
    { amount: 1000, label: '1,000 Credits', price: '$80', popular: false },
    { amount: 5000, label: '5,000 Credits', price: '$350', popular: false },
  ];

  const urgencyOptions = [
    { value: 'low' as const, label: 'Low', description: 'Within 48 hours', color: 'text-zinc-400', bg: 'bg-zinc-500/[0.08]', border: 'border-zinc-500/20' },
    { value: 'medium' as const, label: 'Medium', description: 'Within 24 hours', color: 'text-amber-400', bg: 'bg-amber-500/[0.08]', border: 'border-amber-500/20' },
    { value: 'high' as const, label: 'High', description: 'Within 4 hours', color: 'text-rose-400', bg: 'bg-rose-500/[0.08]', border: 'border-rose-500/20' },
  ];

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CreditRequestForm, string>> = {};
    if (!form.amount || parseInt(form.amount) <= 0) {
      newErrors.amount = 'Please select or enter a valid credit amount';
    }
    if (!form.reason.trim()) {
      newErrors.reason = 'Please provide a reason for the request';
    }
    if (form.reason.trim().length > 0 && form.reason.trim().length < 10) {
      newErrors.reason = 'Please provide a more detailed reason (at least 10 characters)';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    onSubmit(form);
    setIsSubmitting(false);
    setForm({ amount: '', reason: '', urgency: 'medium' });
    setErrors({});
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setForm({ amount: '', reason: '', urgency: 'medium' });
      setErrors({});
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 380 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
          >
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0e0e14] shadow-2xl shadow-black/60">
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-[#0e0e14]/95 backdrop-blur-xl rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/15 to-indigo-500/10 border border-violet-500/20 flex items-center justify-center">
                    <Icons.creditCard className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-zinc-100 tracking-tight">Request More Credits</h2>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Current balance: <span className="text-emerald-400 font-bold">{currentCredits.toLocaleString()}</span> credits</p>
                  </div>
                </div>
                <motion.button
                  onClick={handleClose}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  disabled={isSubmitting}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all disabled:opacity-50"
                >
                  <Icons.close className="w-4 h-4" />
                </motion.button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                {/* Credit Packages */}
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 mb-3 block uppercase tracking-[0.1em]">
                    Select a Package
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {creditPackages.map((pkg) => (
                      <motion.button
                        key={pkg.amount}
                        onClick={() => {
                          setForm(f => ({ ...f, amount: pkg.amount.toString() }));
                          setErrors(e => ({ ...e, amount: undefined }));
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`relative p-4 rounded-xl border text-left transition-all duration-200 ${
                          form.amount === pkg.amount.toString()
                            ? 'bg-violet-500/[0.1] border-violet-500/30 shadow-lg shadow-violet-500/10'
                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]'
                        }`}
                      >
                        {pkg.popular && (
                          <div className="absolute -top-2 right-3">
                            <span className="px-2 py-0.5 bg-violet-500/20 border border-violet-500/30 rounded-full text-[8px] font-bold text-violet-300 uppercase tracking-wider">
                              Popular
                            </span>
                          </div>
                        )}
                        <div className={`text-lg font-bold ${
                          form.amount === pkg.amount.toString() ? 'text-violet-300' : 'text-zinc-200'
                        }`}>
                          {pkg.label}
                        </div>
                        <div className={`text-[12px] font-semibold mt-1 ${
                          form.amount === pkg.amount.toString() ? 'text-violet-400/70' : 'text-zinc-500'
                        }`}>
                          {pkg.price}
                        </div>
                        {form.amount === pkg.amount.toString() && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-3 right-3"
                          >
                            <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                              <Icons.check className="w-2.5 h-2.5 text-violet-400" />
                            </div>
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                  </div>

                  {/* Custom Amount */}
                  <div className="mt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 h-px bg-white/[0.06]" />
                      <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">or custom amount</span>
                      <div className="flex-1 h-px bg-white/[0.06]" />
                    </div>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600">
                        <Icons.plus className="w-4 h-4" />
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="100000"
                        value={!creditPackages.some(p => p.amount.toString() === form.amount) ? form.amount : ''}
                        onChange={e => {
                          setForm(f => ({ ...f, amount: e.target.value }));
                          setErrors(er => ({ ...er, amount: undefined }));
                        }}
                        onFocus={() => {
                          if (creditPackages.some(p => p.amount.toString() === form.amount)) {
                            setForm(f => ({ ...f, amount: '' }));
                          }
                        }}
                        placeholder="Enter custom amount..."
                        className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl pl-10 pr-4 py-2.5 text-[13px] text-zinc-100 outline-none focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/[0.1] transition-all placeholder:text-zinc-600 font-medium"
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {errors.amount && (
                      <motion.p
                        initial={{ opacity: 0, y: -4, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -4, height: 0 }}
                        className="text-[10px] text-rose-400/80 font-medium mt-2 flex items-center gap-1.5"
                      >
                        <div className="w-3 h-3 rounded-full bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                          <Icons.info className="w-1.5 h-1.5 text-rose-400" />
                        </div>
                        {errors.amount}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Urgency */}
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 mb-3 block uppercase tracking-[0.1em]">
                    Urgency Level
                  </label>
                  <div className="flex gap-2">
                    {urgencyOptions.map((opt) => (
                      <motion.button
                        key={opt.value}
                        onClick={() => setForm(f => ({ ...f, urgency: opt.value }))}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`flex-1 px-3 py-3 rounded-xl border text-center transition-all duration-200 ${
                          form.urgency === opt.value
                            ? `${opt.bg} ${opt.border} shadow-md`
                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className={`text-[12px] font-bold ${
                          form.urgency === opt.value ? opt.color : 'text-zinc-400'
                        }`}>
                          {opt.label}
                        </div>
                        <div className={`text-[9px] mt-0.5 ${
                          form.urgency === opt.value ? `${opt.color} opacity-70` : 'text-zinc-600'
                        }`}>
                          {opt.description}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 mb-2 block uppercase tracking-[0.1em]">
                    Reason for Request
                  </label>
                  <textarea
                    value={form.reason}
                    onChange={e => {
                      setForm(f => ({ ...f, reason: e.target.value }));
                      setErrors(er => ({ ...er, reason: undefined }));
                    }}
                    placeholder="Describe why you need additional credits (e.g., large batch processing, upcoming project deadline...)"
                    rows={3}
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-[13px] text-zinc-100 outline-none focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/[0.1] transition-all placeholder:text-zinc-600 font-medium resize-none"
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <AnimatePresence>
                      {errors.reason && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="text-[10px] text-rose-400/80 font-medium flex items-center gap-1.5"
                        >
                          <div className="w-3 h-3 rounded-full bg-rose-500/15 flex items-center justify-center flex-shrink-0">
                            <Icons.info className="w-1.5 h-1.5 text-rose-400" />
                          </div>
                          {errors.reason}
                        </motion.p>
                      )}
                    </AnimatePresence>
                    <span className={`text-[9px] ml-auto ${
                      form.reason.length > 0 && form.reason.length < 10 ? 'text-rose-400' : 'text-zinc-600'
                    }`}>
                      {form.reason.length}/500
                    </span>
                  </div>
                </div>

                {/* Summary */}
                <AnimatePresence>
                  {form.amount && parseInt(form.amount) > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: 8, height: 0 }}
                      transition={{ type: 'spring', damping: 28 }}
                    >
                      <div className="rounded-xl bg-gradient-to-br from-violet-500/[0.06] to-indigo-500/[0.04] border border-violet-500/15 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Icons.info className="w-3.5 h-3.5 text-violet-400" />
                          <span className="text-[11px] font-bold text-violet-300 uppercase tracking-wider">Request Summary</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] text-zinc-400">Credits requested</span>
                            <span className="text-[13px] font-bold text-zinc-200">{parseInt(form.amount).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] text-zinc-400">New balance (after approval)</span>
                            <span className="text-[13px] font-bold text-emerald-400">{(currentCredits + parseInt(form.amount)).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] text-zinc-400">Urgency</span>
                            <span className={`text-[12px] font-bold ${
                              urgencyOptions.find(o => o.value === form.urgency)?.color
                            }`}>
                              {urgencyOptions.find(o => o.value === form.urgency)?.label} — {urgencyOptions.find(o => o.value === form.urgency)?.description}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 px-6 py-4 border-t border-white/[0.06] bg-[#0e0e14]/95 backdrop-blur-xl rounded-b-2xl flex items-center gap-3">
                <motion.button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 py-3 rounded-xl text-[13px] font-semibold text-zinc-400 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:text-zinc-300 transition-all disabled:opacity-50"
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  whileHover={!isSubmitting ? { scale: 1.01 } : {}}
                  whileTap={!isSubmitting ? { scale: 0.98 } : {}}
                  className="flex-1 py-3 rounded-xl text-[13px] font-bold bg-gradient-to-r from-violet-500/25 to-indigo-500/20 text-violet-200 border border-violet-500/30 hover:from-violet-500/30 hover:to-indigo-500/25 hover:border-violet-500/40 shadow-lg shadow-violet-500/10 hover:shadow-violet-500/20 transition-all flex items-center justify-center gap-2 relative overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Icons.loader className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                      <Icons.send className="w-3.5 h-3.5 relative z-10" />
                      <span className="relative z-10">Submit Request</span>
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Customer Dashboard ──────────────────────────────────────────────────────
// Includes Overview, Process Documents, and Processed Documents tabs

function CustomerOverview({ user, onNavigate }: { user: User; onNavigate: (tab: string) => void }) {
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [currentCredits, setCurrentCredits] = useState(850);
  const [pendingRequests, setPendingRequests] = useState<{ amount: number; date: string; status: string; urgency: string }[]>([]);
  const { items: toasts, add: toast } = useToast();

  const stats = [
    { label: 'Documents Processed', value: '124', icon: Icons.document, color: 'text-amber-400', actionable: false },
    { label: 'Credits Remaining', value: currentCredits.toLocaleString(), icon: Icons.creditCard, color: 'text-emerald-400', actionable: true },
  ];

  const recentActivity = [
    { id: 1, name: 'Invoice_2023_001.pdf', date: '2 mins ago', status: 'Completed', type: 'Invoice' },
    { id: 2, name: 'Contract_Draft_v2.docx', date: '1 hour ago', status: 'Processing', type: 'Contract' },
    { id: 3, name: 'Financial_Report_Q3.xlsx', date: 'Yesterday', status: 'Completed', type: 'Report' },
  ];

  const handleCreditRequest = (form: CreditRequestForm) => {
    const newRequest = {
      amount: parseInt(form.amount),
      date: 'Just now',
      status: 'Pending',
      urgency: form.urgency,
    };
    setPendingRequests(prev => [newRequest, ...prev]);
    setShowCreditModal(false);
    toast(`Credit request for ${parseInt(form.amount).toLocaleString()} credits submitted successfully!`, 'success');
  };

  return (
    <>
      <motion.div 
        variants={staggerContainer} 
        initial="hidden" 
        animate="show" 
        className="space-y-6"
      >
        <motion.div variants={staggerItem} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-zinc-100 tracking-tight">Welcome back, {user.name}</h2>
            <p className="text-[13px] text-zinc-500 mt-1">Here is what's happening with your documents today.</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onNavigate('processed')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Icons.archive className="w-4 h-4" />
              <span>View Processed</span>
            </button>
            <button 
              onClick={() => onNavigate('documents')}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Icons.sparkle className="w-4 h-4" />
              <span>New Process</span>
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat, i) => (
            <motion.div 
              key={i} 
              variants={staggerItem}
              className="p-5 rounded-2xl bg-[#0e0e14] border border-white/[0.06] hover:border-white/[0.1] transition-colors group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                {stat.actionable && (
                  <motion.button
                    onClick={() => setShowCreditModal(true)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/[0.08] border border-violet-500/20 text-violet-400 hover:bg-violet-500/15 hover:border-violet-500/30 transition-all text-[10px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100"
                  >
                    <Icons.plus className="w-3 h-3" />
                    <span>Request</span>
                  </motion.button>
                )}
              </div>
              <div className="text-2xl font-bold text-zinc-100">{stat.value}</div>
              <div className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mt-1">{stat.label}</div>
            </motion.div>
          ))}

          {/* Request Credits Card */}
          <motion.div 
            variants={staggerItem}
            className="p-5 rounded-2xl bg-gradient-to-br from-violet-500/[0.06] to-indigo-500/[0.04] border border-violet-500/15 hover:border-violet-500/25 transition-colors relative overflow-hidden group cursor-pointer"
            onClick={() => setShowCreditModal(true)}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/[0.03] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/[0.1] border border-violet-500/20 flex items-center justify-center text-violet-400">
                  <Icons.plus className="w-5 h-5" />
                </div>
                <Icons.arrowRight className="w-4 h-4 text-violet-400/50 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
              </div>
              <div className="text-[15px] font-bold text-violet-300">Request Credits</div>
              <div className="text-[11px] font-medium text-zinc-500 mt-1">Need more processing power?</div>
            </div>
          </motion.div>
        </div>

        {/* Pending Credit Requests */}
        <AnimatePresence>
          {pendingRequests.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              variants={staggerItem}
              className="rounded-2xl border border-violet-500/15 bg-[#0e0e14] overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                  <h3 className="text-sm font-bold text-zinc-200">Pending Credit Requests</h3>
                  <span className="px-2 py-0.5 bg-violet-500/[0.1] border border-violet-500/20 rounded-full text-[10px] font-bold text-violet-400">
                    {pendingRequests.length}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {pendingRequests.map((req, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-500/[0.08] border border-violet-500/15 flex items-center justify-center text-violet-400">
                      <Icons.creditCard className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-zinc-200">
                        {req.amount.toLocaleString()} credits requested
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-zinc-500">{req.date}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                        <span className={`text-[11px] font-semibold capitalize ${
                          req.urgency === 'high' ? 'text-rose-400' : req.urgency === 'medium' ? 'text-amber-400' : 'text-zinc-400'
                        }`}>
                          {req.urgency} priority
                        </span>
                      </div>
                    </div>
                    <div className="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-amber-500/[0.08] text-amber-400 border-amber-500/20">
                      {req.status}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={staggerItem} className="rounded-2xl border border-white/[0.06] bg-[#0e0e14] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-200">Recent Activity</h3>
            <button 
              onClick={() => onNavigate('processed')}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 font-medium transition-colors"
            >
              View All
            </button>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {recentActivity.map((item) => (
              <div key={item.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-zinc-900/50 border border-white/[0.06] flex items-center justify-center text-zinc-400">
                  <Icons.document className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-zinc-200 truncate group-hover:text-indigo-300 transition-colors">{item.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-zinc-500">{item.type}</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-700" />
                    <span className="text-[11px] text-zinc-500">{item.date}</span>
                  </div>
                </div>
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                  item.status === 'Completed' 
                    ? 'bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/20' 
                    : 'bg-amber-500/[0.08] text-amber-400 border-amber-500/20'
                }`}>
                  {item.status}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>

      <RequestCreditsModal
        isOpen={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        onSubmit={handleCreditRequest}
        currentCredits={currentCredits}
      />
      <Toasts items={toasts} />
    </>
  );
}

function CustomerDashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const config = ROLE_CONFIG.customer;
  const [activeTab, setActiveTab] = useState('overview');

  const navItems = [
    { icon: Icons.home, label: 'Overview', active: activeTab === 'overview', onClick: () => setActiveTab('overview') },
    { icon: Icons.document, label: 'Process Documents', active: activeTab === 'documents', onClick: () => setActiveTab('documents') },
    { icon: Icons.archive, label: 'Processed Documents', active: activeTab === 'processed', onClick: () => setActiveTab('processed') },
  ];

  return (
    <DashboardShell user={user} onLogout={onLogout} roleConfig={config} navItems={navItems}>
      <AnimatePresence mode="wait">
        {activeTab === 'overview' ? (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <CustomerOverview user={user} onNavigate={setActiveTab} />
          </motion.div>
        ) : activeTab === 'documents' ? (
          <motion.div key="documents" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <DocumentProcessor />
          </motion.div>
        ) : activeTab === 'processed' ? (
          <motion.div key="processed" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <ProcessedDocuments />
          </motion.div>
        ) : (
          <motion.div key="empty" className="flex items-center justify-center h-64 text-zinc-500">
            Section not implemented
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardShell>
  );
}

// ─── Developer Dashboard ─────────────────────────────────────────────────────

function DevDashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const config = ROLE_CONFIG.dev;
  const [activeTab, setActiveTab] = useState('processor');

  const navItems = [
    { icon: Icons.code, label: 'Dev Processor', active: activeTab === 'processor', onClick: () => setActiveTab('processor') },
    { icon: Icons.archive, label: 'Processed Documents', active: activeTab === 'processed', onClick: () => setActiveTab('processed') },
  ];

  return (
    <DashboardShell user={user} onLogout={onLogout} roleConfig={config} navItems={navItems}>
      <AnimatePresence mode="wait">
        {activeTab === 'processor' ? (
          <motion.div key="processor" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <DocumentProcessorDev />
          </motion.div>
        ) : activeTab === 'processed' ? (
          <motion.div key="processed" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <ProcessedDocuments />
          </motion.div>
        ) : (
          <motion.div key="empty" className="flex items-center justify-center h-64 text-zinc-500">
            Section not implemented
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardShell>
  );
}

// ─── Main App Component ──────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  const handleAuth = useCallback((authenticatedUser: User) => {
    setUser(authenticatedUser);
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
  }, []);

  if (!user) {
    return <AuthPage onAuth={handleAuth} />;
  }

  switch (user.role) {
    case 'admin':
      return <AdminDashboard user={user} onLogout={handleLogout} />;
    case 'owner':
      return <OwnerDashboard user={user} onLogout={handleLogout} />;
    case 'customer':
      return <CustomerDashboard user={user} onLogout={handleLogout} />;
    case 'dev':
      return <DevDashboard user={user} onLogout={handleLogout} />;
    default:
      return <AuthPage onAuth={handleAuth} />;
  }
}