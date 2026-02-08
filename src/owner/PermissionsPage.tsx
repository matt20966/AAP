import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion, useSpring, useTransform } from 'framer-motion';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'admin';
  permissions: {
    canApplyCreditUsage: boolean;
    canCreateNewAdminUsers: boolean;
  };
  createdAt: string;
  lastActive: string;
}

interface PermissionChangeRequest {
  userId: string;
  permission: keyof AdminUser['permissions'];
  newValue: boolean;
}

// ─── Design System Constants ─────────────────────────────────────────────────

const DS = {
  // Spacing scale (4px base)
  space: {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },
  // Border radius
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    full: '9999px',
  },
  // Shadows with proper layering
  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.1)',
    md: '0 4px 6px -1px rgba(0,0,0,0.2), 0 2px 4px -2px rgba(0,0,0,0.1)',
    lg: '0 10px 15px -3px rgba(0,0,0,0.3), 0 4px 6px -4px rgba(0,0,0,0.2)',
    xl: '0 20px 25px -5px rgba(0,0,0,0.4), 0 8px 10px -6px rgba(0,0,0,0.2)',
    glow: (color: string) => `0 0 20px ${color}, 0 0 40px ${color}`,
  },
  // Motion presets
  motion: {
    fast: { type: 'spring' as const, damping: 30, stiffness: 500 },
    smooth: { type: 'spring' as const, damping: 25, stiffness: 300 },
    gentle: { type: 'spring' as const, damping: 20, stiffness: 200 },
    bounce: { type: 'spring' as const, damping: 15, stiffness: 400 },
  },
  // Easing
  ease: {
    out: [0.16, 1, 0.3, 1] as const,
    inOut: [0.4, 0, 0.2, 1] as const,
  },
} as const;

// ─── SVG Icons (Optimized) ───────────────────────────────────────────────────

const Icons = {
  x: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  plus: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  check: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  warn: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  loader: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  ),
  shield: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  shieldCheck: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  users: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  userPlus: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  ),
  userMinus: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  ),
  trash: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  ),
  creditCard: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  crown: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4l3 12h14l3-12-5 4-5-4-5 4z" />
      <path d="M5 16h14v4H5z" />
    </svg>
  ),
  search: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  mail: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  clock: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  key: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  ),
  sparkles: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
    </svg>
  ),
  chevronDown: (p: React.SVGProps<SVGSVGElement>) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
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

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getNameFromEmail(email: string): string {
  const localPart = email.split('@')[0];
  return localPart
    .split(/[._-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ─── Permission definitions ──────────────────────────────────────────────────

const PERMISSION_DEFS: {
  key: keyof AdminUser['permissions'];
  label: string;
  description: string;
  icon: (p: React.SVGProps<SVGSVGElement>) => JSX.Element;
  gradient: string;
  accentColor: string;
}[] = [
  {
    key: 'canApplyCreditUsage',
    label: 'Apply Credit Usage',
    description: 'Manage credit usage for accounts',
    icon: Icons.creditCard,
    gradient: 'from-blue-500 to-cyan-400',
    accentColor: 'rgb(59, 130, 246)',
  },
  {
    key: 'canCreateNewAdminUsers',
    label: 'Create Admin Users',
    description: 'Invite new administrator accounts',
    icon: Icons.userPlus,
    gradient: 'from-violet-500 to-purple-400',
    accentColor: 'rgb(139, 92, 246)',
  },
];

// ─── Avatar system ───────────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  { from: 'from-indigo-500', to: 'to-blue-400', text: 'text-white' },
  { from: 'from-emerald-500', to: 'to-teal-400', text: 'text-white' },
  { from: 'from-rose-500', to: 'to-pink-400', text: 'text-white' },
  { from: 'from-amber-500', to: 'to-orange-400', text: 'text-white' },
  { from: 'from-sky-500', to: 'to-cyan-400', text: 'text-white' },
  { from: 'from-violet-500', to: 'to-purple-400', text: 'text-white' },
  { from: 'from-teal-500', to: 'to-green-400', text: 'text-white' },
  { from: 'from-fuchsia-500', to: 'to-pink-400', text: 'text-white' },
];

function getAvatarGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'success' | 'error' | 'info' }[]>([]);
  
  const add = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = uid();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  return { toasts, add };
}

function useTrap(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!open || !ref.current) return;
    const el = ref.current;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
    );
    focusable[0]?.focus();
    
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === focusable[0]) {
          e.preventDefault();
          focusable[focusable.length - 1]?.focus();
        }
      } else {
        if (document.activeElement === focusable[focusable.length - 1]) {
          e.preventDefault();
          focusable[0]?.focus();
        }
      }
    };
    
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [open]);
  
  return ref;
}

// ─── Animated Background ─────────────────────────────────────────────────────

function AnimatedBackground() {
  const reducedMotion = useReducedMotion();
  
  if (reducedMotion) return null;
  
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Primary gradient orb */}
      <motion.div
        animate={{
          x: [0, 100, 50, 0],
          y: [0, 50, 100, 0],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-indigo-500/[0.07] to-transparent rounded-full blur-3xl"
      />
      
      {/* Secondary gradient orb */}
      <motion.div
        animate={{
          x: [0, -80, -40, 0],
          y: [0, 80, 40, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl from-violet-500/[0.05] to-transparent rounded-full blur-3xl"
      />
      
      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

// ─── Toast System ────────────────────────────────────────────────────────────

function Toasts({ items }: { items: { id: string; msg: string; type: string }[] }) {
  const reducedMotion = useReducedMotion();
  
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col-reverse gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {items.map((toast, index) => (
          <motion.div
            key={toast.id}
            layout
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.9, filter: 'blur(10px)' }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
            transition={DS.motion.smooth}
            className="pointer-events-auto"
          >
            <div className={`
              relative overflow-hidden px-4 py-3.5 rounded-2xl text-[13px] font-medium 
              flex items-center gap-3 backdrop-blur-xl shadow-xl
              ${toast.type === 'success' 
                ? 'bg-emerald-950/90 text-emerald-100 shadow-emerald-900/20' 
                : toast.type === 'error'
                  ? 'bg-rose-950/90 text-rose-100 shadow-rose-900/20'
                  : 'bg-zinc-900/90 text-zinc-100 shadow-black/20'
              }
            `}>
              {/* Animated border gradient */}
              <div className={`absolute inset-0 rounded-2xl p-px ${
                toast.type === 'success' 
                  ? 'bg-gradient-to-r from-emerald-500/30 via-emerald-500/10 to-emerald-500/30'
                  : toast.type === 'error'
                    ? 'bg-gradient-to-r from-rose-500/30 via-rose-500/10 to-rose-500/30'
                    : 'bg-gradient-to-r from-zinc-500/30 via-zinc-500/10 to-zinc-500/30'
              }`}>
                <div className="w-full h-full rounded-2xl bg-inherit" />
              </div>
              
              {/* Icon */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ ...DS.motion.bounce, delay: 0.1 }}
                className={`relative w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  toast.type === 'success' 
                    ? 'bg-emerald-500/20' 
                    : toast.type === 'error'
                      ? 'bg-rose-500/20'
                      : 'bg-zinc-500/20'
                }`}
              >
                {toast.type === 'success' && <Icons.check className="w-3.5 h-3.5 text-emerald-400" />}
                {toast.type === 'error' && <Icons.warn className="w-3.5 h-3.5 text-rose-400" />}
                {toast.type === 'info' && <Icons.info className="w-3.5 h-3.5 text-zinc-400" />}
              </motion.div>
              
              <span className="relative">{toast.msg}</span>
              
              {/* Progress bar */}
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 4, ease: 'linear' }}
                className={`absolute bottom-0 left-0 right-0 h-0.5 origin-left ${
                  toast.type === 'success' 
                    ? 'bg-emerald-500/50' 
                    : toast.type === 'error'
                      ? 'bg-rose-500/50'
                      : 'bg-zinc-500/50'
                }`}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Premium Button Component ────────────────────────────────────────────────

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit';
}

function Button({ 
  children, 
  onClick, 
  variant = 'secondary', 
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  className = '',
  type = 'button',
}: ButtonProps) {
  const reducedMotion = useReducedMotion();
  
  const baseStyles = `
    relative inline-flex items-center justify-center gap-2 font-semibold
    transition-all duration-200 ease-out
    focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]
    disabled:opacity-50 disabled:cursor-not-allowed
  `;
  
  const sizeStyles = {
    sm: 'px-3 py-2 text-[12px] rounded-xl',
    md: 'px-4 py-2.5 text-[13px] rounded-xl',
    lg: 'px-5 py-3 text-[14px] rounded-2xl',
  };
  
  const variantStyles = {
    primary: `
      bg-gradient-to-r from-indigo-500 to-indigo-600 text-white
      shadow-lg shadow-indigo-500/25
      hover:shadow-xl hover:shadow-indigo-500/30 hover:from-indigo-400 hover:to-indigo-500
      focus-visible:ring-indigo-500/50
    `,
    secondary: `
      bg-white/[0.05] text-zinc-200 border border-white/[0.08]
      hover:bg-white/[0.08] hover:border-white/[0.12]
      focus-visible:ring-white/20
    `,
    ghost: `
      text-zinc-400 
      hover:text-zinc-200 hover:bg-white/[0.05]
      focus-visible:ring-white/20
    `,
    danger: `
      bg-rose-500/10 text-rose-300 border border-rose-500/20
      hover:bg-rose-500/15 hover:border-rose-500/30
      focus-visible:ring-rose-500/40
    `,
  };
  
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={!disabled && !loading && !reducedMotion ? { scale: 1.02, y: -1 } : undefined}
      whileTap={!disabled && !loading && !reducedMotion ? { scale: 0.98 } : undefined}
      transition={DS.motion.fast}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {loading ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Icons.loader className="w-4 h-4" />
        </motion.div>
      ) : icon}
      {children}
    </motion.button>
  );
}

// ─── Premium Input Component ─────────────────────────────────────────────────

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  error?: string;
  autoFocus?: boolean;
  type?: string;
  onClear?: () => void;
  className?: string;
}

function Input({
  value,
  onChange,
  placeholder,
  icon,
  error,
  autoFocus,
  type = 'text',
  onClear,
  className = '',
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const reducedMotion = useReducedMotion();
  
  return (
    <div className={`relative ${className}`}>
      <motion.div
        animate={{
          borderColor: error 
            ? 'rgba(244, 63, 94, 0.4)' 
            : focused 
              ? 'rgba(99, 102, 241, 0.3)' 
              : 'rgba(255, 255, 255, 0.06)',
          backgroundColor: focused ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.02)',
        }}
        transition={{ duration: 0.2 }}
        className="relative flex items-center rounded-xl border overflow-hidden"
      >
        {icon && (
          <motion.div
            animate={{ color: focused ? 'rgba(99, 102, 241, 0.7)' : 'rgba(113, 113, 122, 0.6)' }}
            transition={{ duration: 0.2 }}
            className="absolute left-4 pointer-events-none"
          >
            {icon}
          </motion.div>
        )}
        
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`
            w-full bg-transparent py-3.5 text-[14px] text-zinc-100 
            placeholder:text-zinc-600 outline-none
            ${icon ? 'pl-11' : 'pl-4'}
            ${onClear && value ? 'pr-10' : 'pr-4'}
          `}
        />
        
        <AnimatePresence>
          {onClear && value && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={DS.motion.fast}
              onClick={onClear}
              type="button"
              className="absolute right-3 w-6 h-6 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.08] transition-colors"
            >
              <Icons.x className="w-3 h-3" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
      
      <AnimatePresence mode="wait">
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={DS.motion.fast}
            className="mt-2 text-[12px] text-rose-400 flex items-center gap-1.5"
          >
            <Icons.warn className="w-3 h-3" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Modal System ────────────────────────────────────────────────────────────

function Modal({ 
  open, 
  onClose, 
  children, 
  width = 'max-w-md' 
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  const trapRef = useTrap(open);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
          onClick={onClose}
        >
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(12px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-black/70"
          />
          
          {/* Modal content */}
          <motion.div
            ref={trapRef}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 20 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 20 }}
            transition={DS.motion.smooth}
            onClick={e => e.stopPropagation()}
            className={`
              relative w-full ${width} overflow-hidden
              bg-[#0f0f14] border border-white/[0.08]
              rounded-t-3xl sm:rounded-2xl
              shadow-2xl shadow-black/50
              flex flex-col max-h-[90vh] sm:max-h-[85vh]
            `}
          >
            {/* Top highlight */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            
            {/* Subtle inner glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
            
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ModalHeader({ 
  children, 
  onClose,
  accent,
}: { 
  children: React.ReactNode; 
  onClose: () => void;
  accent?: 'default' | 'success' | 'danger' | 'warning';
}) {
  const accentColors = {
    default: 'from-indigo-500/20 to-transparent',
    success: 'from-emerald-500/20 to-transparent',
    danger: 'from-rose-500/20 to-transparent',
    warning: 'from-amber-500/20 to-transparent',
  };
  
  return (
    <div className="relative">
      {/* Accent gradient */}
      <div className={`absolute inset-0 bg-gradient-to-b ${accentColors[accent || 'default']} pointer-events-none`} />
      
      <div className="relative flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3.5">{children}</div>
        <motion.button
          onClick={onClose}
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          transition={DS.motion.fast}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
        >
          <Icons.x className="w-4 h-4" />
        </motion.button>
      </div>
      
      {/* Bottom separator */}
      <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  );
}

// ─── Avatar Component ────────────────────────────────────────────────────────

function Avatar({ 
  name, 
  id, 
  size = 'md',
  isOwner = false,
}: { 
  name: string; 
  id: string; 
  size?: 'sm' | 'md' | 'lg';
  isOwner?: boolean;
}) {
  const gradient = getAvatarGradient(id);
  const reducedMotion = useReducedMotion();
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-[11px]',
    md: 'w-11 h-11 text-[13px]',
    lg: 'w-14 h-14 text-[16px]',
  };
  
  return (
    <div className="relative">
      <motion.div
        whileHover={!reducedMotion ? { scale: 1.05 } : undefined}
        transition={DS.motion.fast}
        className={`
          ${sizeClasses[size]}
          rounded-2xl bg-gradient-to-br ${gradient.from} ${gradient.to}
          flex items-center justify-center font-semibold ${gradient.text}
          shadow-lg shadow-black/20
        `}
      >
        {getInitials(name)}
      </motion.div>
      
      {isOwner && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ ...DS.motion.bounce, delay: 0.1 }}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30"
        >
          <Icons.crown className="w-2.5 h-2.5 text-white" />
        </motion.div>
      )}
    </div>
  );
}

// ─── Toggle Switch Component ─────────────────────────────────────────────────

function Toggle({ 
  enabled, 
  onChange, 
  disabled = false,
  accentColor = 'rgb(99, 102, 241)',
}: { 
  enabled: boolean; 
  onChange: () => void; 
  disabled?: boolean;
  accentColor?: string;
}) {
  const reducedMotion = useReducedMotion();
  
  return (
    <motion.button
      onClick={!disabled ? onChange : undefined}
      disabled={disabled}
      whileTap={!disabled && !reducedMotion ? { scale: 0.95 } : undefined}
      className={`
        relative w-12 h-7 rounded-full transition-all duration-300 ease-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f14]
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${enabled 
          ? 'focus-visible:ring-indigo-500/50' 
          : 'focus-visible:ring-white/20'
        }
      `}
      style={{
        backgroundColor: enabled ? `${accentColor}20` : 'rgba(255, 255, 255, 0.06)',
        boxShadow: enabled ? `0 0 16px ${accentColor}20, inset 0 1px 2px rgba(0,0,0,0.1)` : 'inset 0 1px 2px rgba(0,0,0,0.2)',
      }}
      aria-checked={enabled}
      role="switch"
    >
      <motion.div
        animate={{ 
          x: enabled ? 22 : 3,
          scale: enabled ? 1 : 0.9,
        }}
        transition={reducedMotion ? { duration: 0 } : DS.motion.fast}
        className="absolute top-[3px] w-[22px] h-[22px] rounded-full shadow-lg"
        style={{
          backgroundColor: enabled ? accentColor : 'rgba(161, 161, 170, 0.8)',
          boxShadow: enabled 
            ? `0 2px 8px ${accentColor}40, 0 1px 2px rgba(0,0,0,0.2)` 
            : '0 2px 4px rgba(0,0,0,0.3)',
        }}
      />
    </motion.button>
  );
}

// ─── Permission Card Component ───────────────────────────────────────────────

function PermissionCard({ 
  permDef, 
  enabled, 
  isOwner,
  onToggle,
}: {
  permDef: typeof PERMISSION_DEFS[0];
  enabled: boolean;
  isOwner: boolean;
  onToggle: () => void;
}) {
  const reducedMotion = useReducedMotion();
  
  return (
    <motion.div
      whileHover={!isOwner && !reducedMotion ? { y: -2, scale: 1.01 } : undefined}
      transition={DS.motion.fast}
      className={`
        relative overflow-hidden rounded-xl p-4
        border transition-all duration-300
        ${enabled || isOwner
          ? 'bg-white/[0.03] border-white/[0.08]'
          : 'bg-transparent border-white/[0.04] hover:border-white/[0.08]'
        }
        ${isOwner ? 'cursor-default' : 'cursor-pointer'}
      `}
      onClick={!isOwner ? onToggle : undefined}
    >
      {/* Active state glow */}
      {enabled && !isOwner && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at top left, ${permDef.accentColor}10 0%, transparent 60%)`,
          }}
        />
      )}
      
      <div className="relative flex items-center gap-4">
        {/* Icon */}
        <motion.div
          animate={{
            scale: enabled || isOwner ? 1 : 0.9,
            opacity: enabled || isOwner ? 1 : 0.5,
          }}
          transition={DS.motion.fast}
          className={`
            w-10 h-10 rounded-xl flex items-center justify-center
            bg-gradient-to-br ${permDef.gradient}
            shadow-lg
          `}
          style={{
            boxShadow: enabled || isOwner ? `0 4px 12px ${permDef.accentColor}30` : 'none',
          }}
        >
          <permDef.icon className="w-4 h-4 text-white" />
        </motion.div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-semibold transition-colors duration-200 ${
            enabled || isOwner ? 'text-zinc-100' : 'text-zinc-500'
          }`}>
            {permDef.label}
          </p>
          <p className="text-[11px] text-zinc-600 mt-0.5 leading-relaxed">
            {permDef.description}
          </p>
        </div>
        
        {/* Toggle or Owner badge */}
        {isOwner ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Icons.crown className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Owner</span>
          </div>
        ) : (
          <Toggle 
            enabled={enabled} 
            onChange={onToggle} 
            accentColor={permDef.accentColor}
          />
        )}
      </div>
    </motion.div>
  );
}

// ─── Admin User Card ─────────────────────────────────────────────────────────

function AdminUserCard({ 
  user, 
  onPermissionToggle, 
  onRemove,
}: {
  user: AdminUser;
  onPermissionToggle: (userId: string, permission: keyof AdminUser['permissions'], newValue: boolean) => void;
  onRemove: (user: AdminUser) => void;
}) {
  const isOwner = user.role === 'owner';
  const permissionCount = Object.values(user.permissions).filter(Boolean).length;
  const reducedMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      transition={DS.motion.smooth}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="group relative"
    >
      <motion.div
        animate={{
          borderColor: isHovered ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.06)',
          backgroundColor: isHovered ? 'rgba(255, 255, 255, 0.025)' : 'rgba(255, 255, 255, 0.015)',
        }}
        transition={{ duration: 0.2 }}
        className="relative overflow-hidden rounded-2xl border"
      >
        {/* Owner accent line */}
        {isOwner && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500/0 via-amber-500 to-amber-500/0"
          />
        )}
        
        {/* Header section */}
        <div className="p-5">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} id={user.id} isOwner={isOwner} />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <h3 className="text-[15px] font-semibold text-zinc-50 tracking-tight truncate">
                  {user.name}
                </h3>
                {isOwner && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={DS.motion.bounce}
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/20"
                  >
                    Owner
                  </motion.span>
                )}
              </div>
              
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[12px] text-zinc-500 flex items-center gap-1.5 truncate">
                  <Icons.mail className="w-3 h-3 opacity-60" />
                  {user.email}
                </span>
                <span className="text-[11px] text-zinc-600 flex items-center gap-1.5 flex-shrink-0">
                  <Icons.clock className="w-2.5 h-2.5 opacity-60" />
                  {formatRelativeTime(user.lastActive)}
                </span>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Permission count badge */}
              <motion.div
                animate={{
                  backgroundColor: isOwner 
                    ? 'rgba(245, 158, 11, 0.1)' 
                    : permissionCount === PERMISSION_DEFS.length
                      ? 'rgba(16, 185, 129, 0.1)'
                      : permissionCount > 0
                        ? 'rgba(99, 102, 241, 0.1)'
                        : 'rgba(255, 255, 255, 0.03)',
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/5"
              >
                <Icons.key className={`w-3 h-3 ${
                  isOwner ? 'text-amber-400' :
                  permissionCount === PERMISSION_DEFS.length ? 'text-emerald-400' :
                  permissionCount > 0 ? 'text-indigo-400' : 'text-zinc-600'
                }`} />
                <span className={`text-[11px] font-semibold tabular-nums ${
                  isOwner ? 'text-amber-400' :
                  permissionCount === PERMISSION_DEFS.length ? 'text-emerald-400' :
                  permissionCount > 0 ? 'text-indigo-400' : 'text-zinc-600'
                }`}>
                  {isOwner ? 'All' : `${permissionCount}/${PERMISSION_DEFS.length}`}
                </span>
              </motion.div>
              
              {/* Remove button */}
              {!isOwner && (
                <motion.button
                  onClick={() => onRemove(user)}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0.8 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  transition={DS.motion.fast}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 focus-visible:opacity-100"
                  title="Remove admin"
                >
                  <Icons.trash className="w-3.5 h-3.5" />
                </motion.button>
              )}
            </div>
          </div>
        </div>
        
        {/* Permissions section */}
        <div className="px-5 pb-5">
          <div className="flex items-center gap-2.5 mb-3">
            <Icons.shield className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider">
              Permissions
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-white/[0.04] to-transparent" />
          </div>
          
          <div className="space-y-2">
            {PERMISSION_DEFS.map(permDef => (
              <PermissionCard
                key={permDef.key}
                permDef={permDef}
                enabled={isOwner || user.permissions[permDef.key]}
                isOwner={isOwner}
                onToggle={() => onPermissionToggle(user.id, permDef.key, !user.permissions[permDef.key])}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </motion.article>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, ...DS.motion.smooth }}
      className="flex flex-col items-center justify-center py-20"
    >
      <motion.div
        animate={!reducedMotion ? { 
          y: [0, -8, 0],
          rotate: [0, 2, -2, 0],
        } : {}}
        transition={{ 
          duration: 4, 
          repeat: Infinity, 
          ease: 'easeInOut' 
        }}
        className="relative"
      >
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-white/[0.04] to-white/[0.02] border border-white/[0.06] flex items-center justify-center mb-6">
          {filtered ? (
            <Icons.search className="w-8 h-8 text-zinc-700" />
          ) : (
            <Icons.users className="w-8 h-8 text-zinc-700" />
          )}
        </div>
        
        {/* Decorative dots */}
        <motion.div
          animate={!reducedMotion ? { scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute -top-2 -right-2 w-3 h-3 rounded-full bg-indigo-500/30"
        />
        <motion.div
          animate={!reducedMotion ? { scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] } : {}}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
          className="absolute -bottom-1 -left-3 w-2 h-2 rounded-full bg-violet-500/30"
        />
      </motion.div>
      
      <h3 className="text-[16px] font-semibold text-zinc-300 tracking-tight">
        {filtered ? 'No admins match your search' : 'No admin users yet'}
      </h3>
      <p className="text-[13px] text-zinc-600 mt-2 text-center max-w-[260px]">
        {filtered 
          ? 'Try adjusting your search or filter criteria' 
          : 'Add your first admin user to get started with team management'
        }
      </p>
    </motion.div>
  );
}

// ─── Stat Badge ──────────────────────────────────────────────────────────────

function StatBadge({ 
  label, 
  value, 
  icon: Icon,
  accent,
}: { 
  label: string; 
  value: number;
  icon?: (p: React.SVGProps<SVGSVGElement>) => JSX.Element;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {Icon && (
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
          accent ? 'bg-indigo-500/10' : 'bg-white/[0.04]'
        }`}>
          <Icon className={`w-3 h-3 ${accent ? 'text-indigo-400' : 'text-zinc-600'}`} />
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <span className={`text-[15px] font-bold tabular-nums ${accent ? 'text-zinc-100' : 'text-zinc-500'}`}>
          {value}
        </span>
        <span className="text-[12px] text-zinc-600 font-medium">
          {label}
        </span>
      </div>
    </div>
  );
}

// ─── Filter Chip ─────────────────────────────────────────────────────────────

function FilterChip({
  label,
  icon: Icon,
  active,
  onClick,
  accentColor,
}: {
  label: string;
  icon: (p: React.SVGProps<SVGSVGElement>) => JSX.Element;
  active: boolean;
  onClick: () => void;
  accentColor?: string;
}) {
  const reducedMotion = useReducedMotion();
  
  return (
    <motion.button
      onClick={onClick}
      whileHover={!reducedMotion ? { y: -1 } : undefined}
      whileTap={!reducedMotion ? { scale: 0.97 } : undefined}
      transition={DS.motion.fast}
      className={`
        relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-medium
        border transition-all duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]
        ${active
          ? 'text-zinc-100 border-white/10 focus-visible:ring-white/20'
          : 'text-zinc-500 border-transparent hover:text-zinc-400 hover:bg-white/[0.03] focus-visible:ring-white/10'
        }
      `}
      style={active ? {
        backgroundColor: accentColor ? `${accentColor}10` : 'rgba(255, 255, 255, 0.05)',
        borderColor: accentColor ? `${accentColor}30` : 'rgba(255, 255, 255, 0.1)',
      } : undefined}
    >
      <Icon className={`w-3.5 h-3.5 ${active && accentColor ? '' : ''}`} 
        style={active && accentColor ? { color: accentColor } : undefined}
      />
      {label}
      
      {active && (
        <motion.div
          layoutId="activeFilter"
          className="absolute inset-0 rounded-xl border-2 border-white/10 pointer-events-none"
          transition={DS.motion.fast}
        />
      )}
    </motion.button>
  );
}

// ─── Add Admin Modal ─────────────────────────────────────────────────────────

function AddAdminModal({ 
  open, 
  onClose, 
  onAdd, 
  existingEmails,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (email: string) => void;
  existingEmails: string[];
}) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setEmail('');
      setLoading(false);
      setError('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError('Please enter an email address');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (existingEmails.includes(trimmedEmail)) {
      setError('This email is already an admin');
      return;
    }

    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    onAdd(trimmedEmail);
  };

  return (
    <Modal open={open} onClose={onClose} width="max-w-[440px]">
      <ModalHeader onClose={onClose}>
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={DS.motion.bounce}
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30"
        >
          <Icons.userPlus className="w-4.5 h-4.5 text-white" />
        </motion.div>
        <div>
          <h2 className="text-[16px] font-semibold text-zinc-50 tracking-tight">
            Add Admin User
          </h2>
          <p className="text-[12px] text-zinc-500 mt-0.5">
            Invite a new administrator
          </p>
        </div>
      </ModalHeader>

      <form onSubmit={handleSubmit}>
        <div className="px-6 py-6 space-y-5">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2.5">
              Email Address
            </label>
            <Input
              type="email"
              value={email}
              onChange={(v) => { setEmail(v); setError(''); }}
              placeholder="admin@company.com"
              icon={<Icons.mail className="w-4 h-4" />}
              error={error}
              autoFocus
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]"
          >
            <Icons.info className="w-4 h-4 text-zinc-600 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-zinc-500 leading-relaxed">
              The new admin will be created with default permissions. You can modify their permissions after adding them.
            </p>
          </motion.div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-5 border-t border-white/[0.04] bg-white/[0.01]">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="primary" 
            loading={loading}
            icon={<Icons.userPlus className="w-4 h-4" />}
          >
            {loading ? 'Adding…' : 'Add Admin'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Remove Admin Modal ──────────────────────────────────────────────────────

function RemoveAdminModal({ 
  open, 
  onClose, 
  onConfirm, 
  user,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  user: AdminUser | null;
}) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setLoading(false);
  }, [open]);

  if (!user) return null;

  const handleConfirm = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    onConfirm();
  };

  return (
    <Modal open={open} onClose={onClose} width="max-w-[400px]">
      <ModalHeader onClose={onClose} accent="danger">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={DS.motion.bounce}
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/30"
        >
          <Icons.userMinus className="w-4.5 h-4.5 text-white" />
        </motion.div>
        <div>
          <h2 className="text-[16px] font-semibold text-zinc-50 tracking-tight">
            Remove Admin User
          </h2>
          <p className="text-[12px] text-zinc-500 mt-0.5">
            This action cannot be undone
          </p>
        </div>
      </ModalHeader>

      <div className="px-6 py-6 space-y-5">
        {/* User card */}
        <div className="flex items-center gap-3.5 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <Avatar name={user.name} id={user.id} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-zinc-200 truncate">{user.name}</p>
            <p className="text-[12px] text-zinc-500 truncate">{user.email}</p>
          </div>
        </div>

        {/* Warning */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/[0.06] border border-rose-500/10"
        >
          <Icons.warn className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-rose-300/80 leading-relaxed">
            The user will lose all admin access immediately and won't be able to access admin features.
          </p>
        </motion.div>
      </div>

      <div className="flex justify-end gap-3 px-6 py-5 border-t border-white/[0.04] bg-white/[0.01]">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          variant="danger" 
          onClick={handleConfirm}
          loading={loading}
          icon={<Icons.trash className="w-4 h-4" />}
        >
          {loading ? 'Removing…' : 'Remove Admin'}
        </Button>
      </div>
    </Modal>
  );
}

// ─── Permission Confirmation Modal ───────────────────────────────────────────

function PermissionConfirmModal({ 
  open, 
  onClose, 
  onConfirm, 
  request, 
  users,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  request: PermissionChangeRequest | null;
  users: AdminUser[];
}) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setLoading(false);
  }, [open]);

  if (!request) return null;
  
  const user = users.find(u => u.id === request.userId);
  const permDef = PERMISSION_DEFS.find(p => p.key === request.permission);
  
  if (!user || !permDef) return null;

  const isGranting = request.newValue;

  const handleConfirm = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    onConfirm();
  };

  return (
    <Modal open={open} onClose={onClose} width="max-w-[420px]">
      <ModalHeader onClose={onClose} accent={isGranting ? 'success' : 'warning'}>
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={DS.motion.bounce}
          className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
            isGranting 
              ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30'
              : 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/30'
          }`}
        >
          {isGranting 
            ? <Icons.shieldCheck className="w-4.5 h-4.5 text-white" />
            : <Icons.shield className="w-4.5 h-4.5 text-white" />
          }
        </motion.div>
        <div>
          <h2 className="text-[16px] font-semibold text-zinc-50 tracking-tight">
            {isGranting ? 'Grant Permission' : 'Revoke Permission'}
          </h2>
          <p className="text-[12px] text-zinc-500 mt-0.5">
            {isGranting ? 'Enable access for this user' : 'Remove access from this user'}
          </p>
        </div>
      </ModalHeader>

      <div className="px-6 py-6 space-y-5">
        {/* User card */}
        <div className="flex items-center gap-3.5 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <Avatar name={user.name} id={user.id} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-zinc-200 truncate">{user.name}</p>
            <p className="text-[12px] text-zinc-500 truncate">{user.email}</p>
          </div>
        </div>

        {/* Permission card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`flex items-center gap-4 p-4 rounded-xl border ${
            isGranting 
              ? 'bg-emerald-500/[0.04] border-emerald-500/10'
              : 'bg-amber-500/[0.04] border-amber-500/10'
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${permDef.gradient} shadow-lg`}
            style={{ boxShadow: `0 4px 12px ${permDef.accentColor}30` }}
          >
            <permDef.icon className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-zinc-200">{permDef.label}</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">{permDef.description}</p>
          </div>
        </motion.div>

        <p className="text-[13px] text-zinc-400 leading-relaxed">
          {isGranting ? (
            <>
              Are you sure you want to <span className="font-medium text-zinc-200">grant</span> this 
              permission to <span className="font-medium text-zinc-200">{user.name}</span>? 
              They will immediately be able to perform this action.
            </>
          ) : (
            <>
              Are you sure you want to <span className="font-medium text-zinc-200">revoke</span> this 
              permission from <span className="font-medium text-zinc-200">{user.name}</span>? 
              They will lose access immediately.
            </>
          )}
        </p>
      </div>

      <div className="flex justify-end gap-3 px-6 py-5 border-t border-white/[0.04] bg-white/[0.01]">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          variant={isGranting ? 'primary' : 'secondary'}
          onClick={handleConfirm}
          loading          icon={isGranting ? <Icons.check className="w-4 h-4" /> : <Icons.x className="w-4 h-4" />}
        >
          {loading ? 'Updating…' : isGranting ? 'Grant Permission' : 'Revoke Permission'}
        </Button>
      </div>
    </Modal>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const INITIAL_USERS: AdminUser[] = [
  {
    id: 'owner-1',
    name: 'Alex Johnson',
    email: 'alex@company.com',
    role: 'owner',
    permissions: {
      canApplyCreditUsage: true,
      canCreateNewAdminUsers: true,
    },
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    lastActive: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'admin-1',
    name: 'Sarah Miller',
    email: 'sarah@company.com',
    role: 'admin',
    permissions: {
      canApplyCreditUsage: true,
      canCreateNewAdminUsers: false,
    },
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'admin-2',
    name: 'Michael Chen',
    email: 'michael@company.com',
    role: 'admin',
    permissions: {
      canApplyCreditUsage: false,
      canCreateNewAdminUsers: true,
    },
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

type FilterType = 'all' | 'canApplyCreditUsage' | 'canCreateNewAdminUsers';

export default function AdminUserManagement() {
  const [users, setUsers] = useState<AdminUser[]>(INITIAL_USERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<AdminUser | null>(null);
  const [permissionRequest, setPermissionRequest] = useState<PermissionChangeRequest | null>(null);
  
  const { toasts, add: addToast } = useToast();
  const reducedMotion = useReducedMotion();

  // Filter and search users
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Search filter
      const matchesSearch = 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;
      
      // Permission filter
      if (activeFilter === 'all') return true;
      if (user.role === 'owner') return true; // Owners always show
      return user.permissions[activeFilter];
    });
  }, [users, searchQuery, activeFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: users.length,
    owners: users.filter(u => u.role === 'owner').length,
    admins: users.filter(u => u.role === 'admin').length,
  }), [users]);

  // Handlers
  const handleAddAdmin = useCallback((email: string) => {
    const newUser: AdminUser = {
      id: uid(),
      name: getNameFromEmail(email),
      email: email.toLowerCase(),
      role: 'admin',
      permissions: {
        canApplyCreditUsage: false,
        canCreateNewAdminUsers: false,
      },
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    };
    
    setUsers(prev => [...prev, newUser]);
    setAddModalOpen(false);
    addToast(`${newUser.name} has been added as an admin`, 'success');
  }, [addToast]);

  const handleRemoveAdmin = useCallback(() => {
    if (!userToRemove) return;
    
    setUsers(prev => prev.filter(u => u.id !== userToRemove.id));
    addToast(`${userToRemove.name} has been removed`, 'success');
    setRemoveModalOpen(false);
    setUserToRemove(null);
  }, [userToRemove, addToast]);

  const handlePermissionToggle = useCallback((userId: string, permission: keyof AdminUser['permissions'], newValue: boolean) => {
    setPermissionRequest({ userId, permission, newValue });
    setPermissionModalOpen(true);
  }, []);

  const handlePermissionConfirm = useCallback(() => {
    if (!permissionRequest) return;
    
    setUsers(prev => prev.map(user => {
      if (user.id !== permissionRequest.userId) return user;
      return {
        ...user,
        permissions: {
          ...user.permissions,
          [permissionRequest.permission]: permissionRequest.newValue,
        },
      };
    }));
    
    const user = users.find(u => u.id === permissionRequest.userId);
    const permDef = PERMISSION_DEFS.find(p => p.key === permissionRequest.permission);
    
    if (user && permDef) {
      addToast(
        `${permDef.label} ${permissionRequest.newValue ? 'granted to' : 'revoked from'} ${user.name}`,
        'success'
      );
    }
    
    setPermissionModalOpen(false);
    setPermissionRequest(null);
  }, [permissionRequest, users, addToast]);

  const openRemoveModal = useCallback((user: AdminUser) => {
    setUserToRemove(user);
    setRemoveModalOpen(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      <AnimatedBackground />
      
      <div className="relative max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={DS.motion.smooth}
          className="mb-10"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ ...DS.motion.bounce, delay: 0.1 }}
                  className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-500/25"
                >
                  <Icons.users className="w-5 h-5 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-[28px] font-bold text-zinc-50 tracking-tight">
                    Admin Users
                  </h1>
                  <p className="text-[14px] text-zinc-500 mt-0.5">
                    Manage team access and permissions
                  </p>
                </div>
              </div>
            </div>
            
            <Button
              variant="primary"
              onClick={() => setAddModalOpen(true)}
              icon={<Icons.plus className="w-4 h-4" />}
            >
              Add Admin
            </Button>
          </div>
          
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...DS.motion.smooth, delay: 0.2 }}
            className="flex items-center gap-6 mt-6 pt-6 border-t border-white/[0.04]"
          >
            <StatBadge label="Total" value={stats.total} icon={Icons.users} accent />
            <div className="w-px h-5 bg-white/[0.06]" />
            <StatBadge label="Owner" value={stats.owners} icon={Icons.crown} />
            <StatBadge label="Admins" value={stats.admins} icon={Icons.shield} />
          </motion.div>
        </motion.header>

        {/* Toolbar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...DS.motion.smooth, delay: 0.3 }}
          className="mb-6 space-y-4"
        >
          {/* Search */}
          <Input
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by name or email..."
            icon={<Icons.search className="w-4 h-4" />}
            onClear={() => setSearchQuery('')}
          />
          
          {/* Filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider mr-1">
              Filter:
            </span>
            <FilterChip
              label="All Users"
              icon={Icons.users}
              active={activeFilter === 'all'}
              onClick={() => setActiveFilter('all')}
            />
            {PERMISSION_DEFS.map(perm => (
              <FilterChip
                key={perm.key}
                label={perm.label}
                icon={perm.icon}
                active={activeFilter === perm.key}
                onClick={() => setActiveFilter(activeFilter === perm.key ? 'all' : perm.key)}
                accentColor={perm.accentColor}
              />
            ))}
          </div>
        </motion.div>

        {/* User list */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
        >
          <AnimatePresence mode="popLayout">
            {filteredUsers.length === 0 ? (
              <EmptyState filtered={searchQuery.length > 0 || activeFilter !== 'all'} />
            ) : (
              filteredUsers.map(user => (
                <AdminUserCard
                  key={user.id}
                  user={user}
                  onPermissionToggle={handlePermissionToggle}
                  onRemove={openRemoveModal}
                />
              ))
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Modals */}
      <AddAdminModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={handleAddAdmin}
        existingEmails={users.map(u => u.email)}
      />
      
      <RemoveAdminModal
        open={removeModalOpen}
        onClose={() => { setRemoveModalOpen(false); setUserToRemove(null); }}
        onConfirm={handleRemoveAdmin}
        user={userToRemove}
      />
      
      <PermissionConfirmModal
        open={permissionModalOpen}
        onClose={() => { setPermissionModalOpen(false); setPermissionRequest(null); }}
        onConfirm={handlePermissionConfirm}
        request={permissionRequest}
        users={users}
      />

      {/* Toasts */}
      <Toasts items={toasts} />
    </div>
  );
}