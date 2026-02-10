// App.tsx - Fixed to properly host DashboardPage

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';

import DashboardPage from './DashboardPage';

// ─── Types ───────────────────────────────────────────────────────────────────

type UserRole = 'customer' | 'admin' | null;

interface User {
  role: UserRole;
  name: string;
}

const MOCK_ACCOUNTS: Record<string, { role: UserRole; name: string }> = {
  customer: { role: 'customer', name: 'Customer User' },
  admin: { role: 'admin', name: 'Admin User' },
};

// ─── Design Tokens ──────────────────────────────────────────────────────────

const tokens = {
  radius: {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-3xl',
  },
  transition: {
    base: 'transition-all duration-200 ease-out',
    slow: 'transition-all duration-300 ease-out',
    fast: 'transition-all duration-150 ease-out',
  },
};

// ─── Role Configuration ─────────────────────────────────────────────────────

const ROLE_CONFIG = {
  customer: {
    label: 'Customer',
    description: 'Access dashboards, charts, permissions & documents',
    icon: '✦',
    gradient: 'from-violet-500/20 to-indigo-500/10',
    bg: 'bg-violet-500/[0.08]',
    border: 'border-violet-500/20',
    text: 'text-violet-400',
    hoverBorder: 'hover:border-violet-500/40',
    ring: 'ring-violet-500/30',
    activeBg: 'bg-violet-500/[0.12]',
    activeBorder: 'border-violet-500/35',
    shadowColor: 'shadow-violet-500/10',
    accentGradient: 'from-violet-500 to-indigo-500',
    glowColor: 'rgba(139, 92, 246, 0.15)',
    solidAccent: 'bg-violet-500',
    accentHover: 'hover:bg-violet-400',
    buttonBg: 'bg-violet-500/15 hover:bg-violet-500/25',
    buttonText: 'text-violet-300',
    buttonBorder: 'border-violet-500/25 hover:border-violet-500/40',
  },
  admin: {
    label: 'Admin',
    description: 'Design charts, manage accounts & documents',
    icon: '⬡',
    gradient: 'from-emerald-500/20 to-teal-500/10',
    bg: 'bg-emerald-500/[0.08]',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    hoverBorder: 'hover:border-emerald-500/40',
    ring: 'ring-emerald-500/30',
    activeBg: 'bg-emerald-500/[0.12]',
    activeBorder: 'border-emerald-500/35',
    shadowColor: 'shadow-emerald-500/10',
    accentGradient: 'from-emerald-500 to-teal-500',
    glowColor: 'rgba(16, 185, 129, 0.15)',
    solidAccent: 'bg-emerald-500',
    accentHover: 'hover:bg-emerald-400',
    buttonBg: 'bg-emerald-500/15 hover:bg-emerald-500/25',
    buttonText: 'text-emerald-300',
    buttonBorder: 'border-emerald-500/25 hover:border-emerald-500/40',
  },
};

// ─── Navigation Configs ──────────────────────────────────────────────────────

const CUSTOMER_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid', shortcut: '⌘1' },
  { id: 'chart-creator', label: 'Chart Creator', icon: 'bar-chart', shortcut: '⌘2' },
  { id: 'permissions', label: 'Permissions', icon: 'shield', shortcut: '⌘3' },
  { id: 'create-document', label: 'Create Document', icon: 'file-plus', shortcut: '⌘4' },
];

const ADMIN_NAV = [
  { id: 'chart-designer', label: 'Chart Designer', icon: 'pen-tool', shortcut: '⌘1' },
  { id: 'accounts', label: 'Accounts Management', icon: 'users', shortcut: '⌘2' },
  { id: 'document-designer', label: 'Document Designer', icon: 'layout', shortcut: '⌘3' },
];

// ─── SVG Icon Components ─────────────────────────────────────────────────────

function IconComponent({ name, className = 'w-4 h-4' }: { name: string; className?: string }) {
  const props = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'grid':
      return (<svg {...props}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>);
    case 'bar-chart':
      return (<svg {...props}><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>);
    case 'shield':
      return (<svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>);
    case 'file-plus':
      return (<svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>);
    case 'pen-tool':
      return (<svg {...props}><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg>);
    case 'users':
      return (<svg {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
    case 'layout':
      return (<svg {...props}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>);
    case 'log-out':
      return (<svg {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>);
    case 'arrow-right':
      return (<svg {...props}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>);
    case 'check':
      return (<svg {...props}><polyline points="20 6 9 17 4 12" /></svg>);
    case 'menu':
      return (<svg {...props}><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>);
    case 'x':
      return (<svg {...props}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>);
    case 'trending-up':
      return (<svg {...props}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>);
    case 'activity':
      return (<svg {...props}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>);
    case 'clock':
      return (<svg {...props}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>);
    case 'zap':
      return (<svg {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>);
    case 'plus':
      return (<svg {...props}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>);
    case 'search':
      return (<svg {...props}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>);
    case 'settings':
      return (<svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>);
    case 'chevron-down':
      return (<svg {...props}><polyline points="6 9 12 15 18 9" /></svg>);
    case 'command':
      return (<svg {...props}><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" /></svg>);
    case 'bell':
      return (<svg {...props}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>);
    case 'sparkles':
      return (<svg {...props}><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" /></svg>);
    default:
      return (<svg {...props}><circle cx="12" cy="12" r="10" /></svg>);
  }
}

// ─── Reusable UI ─────────────────────────────────────────────────────────────

function AppButton({
  children, variant = 'primary', size = 'md', icon, onClick, disabled, className = '', roleConfig,
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  roleConfig?: (typeof ROLE_CONFIG)['customer'];
}) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-[12px] gap-1.5',
    md: 'px-4 py-2.5 text-[13px] gap-2',
    lg: 'px-5 py-3 text-[14px] gap-2.5',
  };
  const variantClasses = {
    primary: roleConfig
      ? `${roleConfig.buttonBg} ${roleConfig.buttonText} border ${roleConfig.buttonBorder} shadow-lg ${roleConfig.shadowColor}`
      : 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/25 hover:border-indigo-500/40 shadow-lg shadow-indigo-500/10',
    secondary: 'bg-white/[0.03] hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-300 border border-white/[0.06] hover:border-white/[0.1]',
    ghost: 'bg-transparent hover:bg-white/[0.04] text-zinc-400 hover:text-zinc-300 border border-transparent',
    danger: 'bg-rose-500/[0.06] hover:bg-rose-500/[0.12] text-rose-400 border border-rose-500/15 hover:border-rose-500/25',
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.02, y: -1 } : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      transition={{ type: 'spring', damping: 20, stiffness: 400 }}
      className={`
        inline-flex items-center justify-center font-semibold tracking-[-0.01em]
        ${tokens.radius.md} ${tokens.transition.base}
        ${sizeClasses[size]} ${variantClasses[variant]}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        relative overflow-hidden group ${className}
      `}
    >
      {variant === 'primary' && !disabled && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700 ease-out" />
      )}
      {icon && <IconComponent name={icon} className="w-4 h-4 relative z-10" />}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}

function Input({
  placeholder, icon, value, onChange, className = '', accentColor = 'violet',
}: {
  placeholder?: string; icon?: string; value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string; accentColor?: 'violet' | 'emerald';
}) {
  const [isFocused, setIsFocused] = useState(false);
  const focusRing = accentColor === 'emerald'
    ? 'focus-within:border-emerald-500/30 focus-within:ring-2 focus-within:ring-emerald-500/10'
    : 'focus-within:border-violet-500/30 focus-within:ring-2 focus-within:ring-violet-500/10';

  return (
    <motion.div animate={isFocused ? { scale: 1.005 } : { scale: 1 }} transition={{ type: 'spring', damping: 25, stiffness: 400 }} className={`relative ${className}`}>
      {icon && <IconComponent name={icon} className={`w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${isFocused ? 'text-zinc-400' : 'text-zinc-600'}`} />}
      <input
        type="text" placeholder={placeholder} value={value} onChange={onChange}
        onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}
        className={`w-full bg-white/[0.02] border border-white/[0.07] ${tokens.radius.md} ${icon ? 'pl-11' : 'pl-4'} pr-4 py-3 text-[13px] text-zinc-200 outline-none ${focusRing} ${tokens.transition.base} placeholder:text-zinc-600 font-medium hover:border-white/[0.12] hover:bg-white/[0.03]`}
      />
    </motion.div>
  );
}

function Card({
  children, className = '', hover = false, onClick, padding = 'p-5',
}: {
  children: React.ReactNode; className?: string; hover?: boolean; onClick?: () => void; padding?: string;
}) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={hover ? { y: -3, scale: 1.01 } : {}}
      whileTap={hover && onClick ? { scale: 0.985 } : {}}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className={`${tokens.radius.lg} bg-[#0f0f15]/80 border border-white/[0.06] ${hover ? 'cursor-pointer hover:border-white/[0.12] hover:bg-[#0f0f15] hover:shadow-xl hover:shadow-black/20' : ''} ${tokens.transition.slow} relative overflow-hidden backdrop-blur-sm ${padding} ${className}`}
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      {children}
    </motion.div>
  );
}

function Badge({
  children, variant = 'default', dot = false, pulse = false,
}: {
  children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'; dot?: boolean; pulse?: boolean;
}) {
  const variants = {
    default: 'bg-zinc-500/[0.08] text-zinc-400 border-zinc-500/20',
    success: 'bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/[0.08] text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/[0.08] text-rose-400 border-rose-500/20',
    info: 'bg-blue-500/[0.08] text-blue-400 border-blue-500/20',
  };
  const dotColors = {
    default: 'bg-zinc-500', success: 'bg-emerald-400', warning: 'bg-amber-400',
    danger: 'bg-rose-400', info: 'bg-blue-400',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border tracking-wide ${variants[variant]}`}>
      {dot && <div className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} ${pulse ? 'animate-pulse' : ''}`} />}
      {children}
    </span>
  );
}

function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 className="text-[22px] font-bold text-zinc-50 tracking-[-0.03em] leading-tight">{title}</h2>
        {description && <p className="text-[13px] text-zinc-500 mt-1.5 leading-relaxed">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {headers.map((header) => (
                <th key={header} className="text-left px-5 py-3.5 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em]">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </Card>
  );
}

function TableRow({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <motion.tr onClick={onClick} whileHover={{ backgroundColor: 'rgba(255,255,255,0.015)' }} className={`border-b border-white/[0.03] last:border-0 ${tokens.transition.fast} ${onClick ? 'cursor-pointer' : ''}`}>
      {children}
    </motion.tr>
  );
}

function SkeletonLine({ width = 'w-full', height = 'h-3' }: { width?: string; height?: string }) {
  return (
    <motion.div className={`${width} ${height} bg-white/[0.04] rounded-md`} animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
  );
}

// ─── Magnetic Hover Effect ──────────────────────────────────────────────────

function MagneticWrapper({ children, strength = 0.15 }: { children: React.ReactNode; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { damping: 20, stiffness: 300 });
  const springY = useSpring(y, { damping: 20, stiffness: 300 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * strength);
    y.set((e.clientY - rect.top - rect.height / 2) * strength);
  }, [x, y, strength]);

  const handleMouseLeave = useCallback(() => { x.set(0); y.set(0); }, [x, y]);

  return (
    <motion.div ref={ref} style={{ x: springX, y: springY }} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      {children}
    </motion.div>
  );
}

// ─── Animation Variants ─────────────────────────────────────────────────────

const pageTransition = {
  initial: { opacity: 0, y: 12, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.45, type: 'tween' as const } },
  exit: { opacity: 0, y: -8, filter: 'blur(4px)', transition: { duration: 0.2, type: 'tween' as const } },
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.06, type: 'spring' as const } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, damping: 24, stiffness: 280 } },
};

// ─── Background Effects ─────────────────────────────────────────────────────

function GridBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: `linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.5) 1px, transparent 1px)`, backgroundSize: '72px 72px' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(99,102,241,0.05) 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 left-0 right-0 h-40" style={{ background: 'linear-gradient(to top, #09090b 0%, transparent 100%)' }} />
    </div>
  );
}

function FloatingParticles() {
  const particles = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    id: i, x: Math.random() * 100, y: Math.random() * 100,
    size: Math.random() * 2 + 0.5, duration: Math.random() * 30 + 20,
    delay: Math.random() * 15, opacity: Math.random() * 0.15 + 0.03,
  })), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div key={p.id} className="absolute rounded-full bg-slate-400"
          style={{ width: p.size, height: p.size, left: `${p.x}%`, top: `${p.y}%`, opacity: p.opacity }}
          animate={{ y: [0, -30, 0], x: [0, Math.random() * 20 - 10, 0], opacity: [p.opacity, p.opacity * 2, p.opacity] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

function GlowOrb({ color = 'indigo', position = 'top' }: { color?: string; position?: string }) {
  const colors: Record<string, string> = { indigo: 'rgba(99,102,241,0.06)', violet: 'rgba(139,92,246,0.06)', emerald: 'rgba(16,185,129,0.06)' };
  const positions: Record<string, string> = { top: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2', 'top-right': 'top-0 right-0 translate-x-1/4 -translate-y-1/4', 'bottom-left': 'bottom-0 left-0 -translate-x-1/4 translate-y-1/4' };

  return (
    <motion.div className={`absolute ${positions[position]} w-[500px] h-[500px] rounded-full pointer-events-none`}
      style={{ background: `radial-gradient(circle, ${colors[color]} 0%, transparent 70%)` }}
      animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// ─── Login Page ──────────────────────────────────────────────────────────────

function LoginPage({ onLogin }: { onLogin: (user: User) => void }) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  const handleLogin = useCallback(async () => {
    if (!selectedRole) return;
    setIsLoggingIn(true);
    await new Promise((r) => setTimeout(r, 500));
    setLoginSuccess(true);
    await new Promise((r) => setTimeout(r, 400));
    const account = MOCK_ACCOUNTS[selectedRole];
    onLogin({ role: account.role, name: account.name });
  }, [selectedRole, onLogin]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #07070a 0%, #0a0a10 40%, #07070a 100%)' }}>
      <GridBackground />
      <FloatingParticles />
      <GlowOrb color="indigo" position="top" />

      <div className="relative z-10 w-full max-w-[420px] px-5">
        <motion.div initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', damping: 25, stiffness: 200, delay: 0.1 }} className="flex flex-col items-center">
          {/* Logo */}
          <motion.div className="flex flex-col items-center mb-12" variants={staggerContainer} initial="hidden" animate="show">
            <motion.div variants={staggerItem}>
              <MagneticWrapper strength={0.2}>
                <div className="w-[72px] h-[72px] rounded-[20px] bg-gradient-to-br from-indigo-500/10 to-violet-500/5 border border-white/[0.08] flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/10 relative group">
                  <div className="absolute inset-0 rounded-[20px] bg-gradient-to-b from-white/[0.05] to-transparent" />
                  <div className="absolute inset-[-1px] rounded-[20px] bg-gradient-to-b from-white/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
                    <IconComponent name="sparkles" className="w-8 h-8 text-indigo-400 relative z-10" />
                  </motion.div>
                </div>
              </MagneticWrapper>
            </motion.div>
            <motion.h1 variants={staggerItem} className="text-[32px] font-bold text-zinc-50 tracking-[-0.05em] leading-none">Merlin</motion.h1>
            <motion.p variants={staggerItem} className="text-[14px] text-zinc-500 mt-3 text-center font-medium tracking-[-0.01em] leading-relaxed">Select your account type to continue</motion.p>
          </motion.div>

          {/* Login Card */}
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.25, type: 'spring', damping: 25, stiffness: 200 }} className="w-full">
            <div className="rounded-2xl border border-white/[0.07] bg-[#0c0c12]/90 backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent h-32 pointer-events-none rounded-t-2xl" />

              <div className="relative p-7 space-y-6">
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-500/[0.04] border border-amber-500/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                  <span className="text-[10px] font-semibold text-amber-500/70 uppercase tracking-[0.08em]">Dev mode — No credentials required</span>
                </motion.div>

                <div>
                  <label className="text-[10px] font-semibold text-zinc-500 mb-3 block uppercase tracking-[0.14em]">Account Type</label>
                  <div className="space-y-3">
                    {(['customer', 'admin'] as const).map((role, index) => {
                      const config = ROLE_CONFIG[role];
                      const isSelected = selectedRole === role;
                      return (
                        <motion.button key={role} onClick={() => setSelectedRole(role)}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 + index * 0.08 }}
                          whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.99 }}
                          className={`w-full flex items-center gap-4 p-4 rounded-xl border ${tokens.transition.slow} text-left group relative overflow-hidden ${
                            isSelected ? `${config.activeBg} ${config.activeBorder} ring-1 ${config.ring} shadow-xl ${config.shadowColor}` : `bg-white/[0.015] border-white/[0.06] ${config.hoverBorder} hover:bg-white/[0.03]`
                          }`}
                        >
                          <motion.div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full bg-gradient-to-b ${config.accentGradient}`}
                            initial={{ opacity: 0, scaleY: 0 }} animate={isSelected ? { opacity: 1, scaleY: 1 } : { opacity: 0, scaleY: 0 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                          />
                          {isSelected && (
                            <motion.div className="absolute inset-0 pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                              style={{ background: `radial-gradient(ellipse at 20% 50%, ${config.glowColor} 0%, transparent 70%)` }}
                            />
                          )}
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} border ${config.border} flex items-center justify-center text-lg ${tokens.transition.slow} flex-shrink-0 relative ${isSelected ? 'shadow-lg ' + config.shadowColor : ''}`}>
                            <span className="relative z-10">{config.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0 relative z-10">
                            <div className={`text-[14px] font-bold tracking-[-0.01em] ${tokens.transition.base} ${isSelected ? 'text-zinc-100' : 'text-zinc-300 group-hover:text-zinc-200'}`}>{config.label}</div>
                            <div className={`text-[12px] mt-0.5 ${tokens.transition.base} leading-relaxed ${isSelected ? 'text-zinc-400' : 'text-zinc-600 group-hover:text-zinc-500'}`}>{config.description}</div>
                          </div>
                          <AnimatePresence>
                            {isSelected && (
                              <motion.div initial={{ scale: 0, opacity: 0, rotate: -90 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0, opacity: 0, rotate: 90 }} transition={{ type: 'spring', damping: 15, stiffness: 350 }} className="relative z-10">
                                <div className={`w-7 h-7 rounded-lg ${config.bg} border ${config.border} flex items-center justify-center`}>
                                  <IconComponent name="check" className={`w-3.5 h-3.5 ${config.text}`} />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Login Button */}
                <motion.button onClick={handleLogin} disabled={!selectedRole || isLoggingIn}
                  whileHover={selectedRole && !isLoggingIn ? { scale: 1.015, y: -1 } : {}}
                  whileTap={selectedRole && !isLoggingIn ? { scale: 0.985 } : {}}
                  transition={{ type: 'spring', damping: 18, stiffness: 350 }}
                  className={`w-full py-3.5 rounded-xl text-[13px] font-bold border ${tokens.transition.slow} flex items-center justify-center gap-2.5 relative overflow-hidden group ${
                    loginSuccess ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : selectedRole && !isLoggingIn ? 'bg-gradient-to-r from-indigo-500/20 to-violet-500/15 text-indigo-200 border-indigo-500/25 hover:from-indigo-500/30 hover:to-violet-500/20 hover:border-indigo-500/40 shadow-lg shadow-indigo-500/15 hover:shadow-indigo-500/25'
                    : 'bg-white/[0.02] text-zinc-700 border-white/[0.05] cursor-not-allowed'
                  }`}
                >
                  {selectedRole && !isLoggingIn && !loginSuccess && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700 ease-out" />
                  )}
                  <AnimatePresence mode="wait">
                    {loginSuccess ? (
                      <motion.div key="success" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2">
                        <IconComponent name="check" className="w-4 h-4" /><span>Welcome!</span>
                      </motion.div>
                    ) : isLoggingIn ? (
                      <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                        </motion.div>
                        <span className="relative z-10">Signing in...</span>
                      </motion.div>
                    ) : (
                      <motion.div key="default" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                        <span className="relative z-10">{selectedRole ? `Continue as ${ROLE_CONFIG[selectedRole].label}` : 'Select an account type'}</span>
                        {selectedRole && <IconComponent name="arrow-right" className="w-3.5 h-3.5 relative z-10 group-hover:translate-x-1 transition-transform duration-300 ease-out" />}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>

                <div className="flex items-center justify-center gap-2 pt-1">
                  <div className="flex items-center gap-1"><IconComponent name="shield" className="w-2.5 h-2.5 text-zinc-700" /><span className="text-[9px] text-zinc-700 font-medium">Secure</span></div>
                  <span className="text-zinc-800">·</span><span className="text-[9px] text-zinc-700 font-medium">Role-based</span>
                  <span className="text-zinc-800">·</span><span className="text-[9px] text-zinc-700 font-medium">Extensible</span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-[10px] text-zinc-700 mt-10 text-center font-medium tracking-wide">Merlin v0.1 — Development Preview</motion.p>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({
  user, activeTab, onTabChange, onLogout, navItems, roleConfig, sidebarOpen, onCloseSidebar,
}: {
  user: User; activeTab: string; onTabChange: (tab: string) => void; onLogout: () => void;
  navItems: typeof CUSTOMER_NAV; roleConfig: (typeof ROLE_CONFIG)['customer'];
  sidebarOpen: boolean; onCloseSidebar: () => void;
}) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <>
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            onClick={onCloseSidebar} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside initial={false}
        className={`fixed lg:sticky top-0 left-0 z-50 lg:z-auto h-screen w-[260px] border-r border-white/[0.06] bg-[#08080c]/98 backdrop-blur-2xl flex flex-col flex-shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="p-5 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${roleConfig.gradient} border ${roleConfig.border} flex items-center justify-center text-base relative overflow-hidden`}>
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent" />
                <span className="relative z-10">{roleConfig.icon}</span>
              </div>
              <div>
                <p className="text-[14px] font-bold text-zinc-100 tracking-[-0.02em]">Merlin</p>
                <p className={`text-[10px] font-bold ${roleConfig.text} uppercase tracking-[0.12em]`}>{roleConfig.label}</p>
              </div>
            </div>
            <button onClick={onCloseSidebar} className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all">
              <IconComponent name="x" className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-4 pb-3">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-all cursor-pointer group">
            <IconComponent name="search" className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            <span className="text-[12px] text-zinc-600 group-hover:text-zinc-500 transition-colors flex-1">Search...</span>
            <div className="flex items-center gap-0.5">
              <kbd className="text-[9px] text-zinc-700 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5 font-mono">⌘</kbd>
              <kbd className="text-[9px] text-zinc-700 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5 font-mono">K</kbd>
            </div>
          </div>
        </div>

        <div className="h-px bg-white/[0.04] mx-4" />

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto mt-1">
          <div className="px-3 py-2">
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.16em]">Navigation</span>
          </div>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const isHovered = hoveredItem === item.id;
            return (
              <motion.button key={item.id}
                onClick={() => { onTabChange(item.id); onCloseSidebar(); }}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                whileTap={{ scale: 0.97 }}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl w-full text-left ${tokens.transition.base} relative group ${isActive ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {isActive && (
                  <motion.div layoutId="navActiveBackground" className={`absolute inset-0 ${roleConfig.activeBg} border ${roleConfig.activeBorder} rounded-xl`} transition={{ type: 'spring', damping: 25, stiffness: 300 }} />
                )}
                {!isActive && isHovered && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-white/[0.03] rounded-xl border border-white/[0.04]" />
                )}
                {isActive && (
                  <motion.div layoutId="activeNavIndicator" className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b ${roleConfig.accentGradient}`} transition={{ type: 'spring', damping: 22, stiffness: 300 }} />
                )}
                <IconComponent name={item.icon} className={`w-[18px] h-[18px] flex-shrink-0 relative z-10 ${tokens.transition.base} ${isActive ? roleConfig.text : 'group-hover:text-zinc-400'}`} />
                <span className="text-[13px] font-semibold tracking-[-0.01em] flex-1 relative z-10">{item.label}</span>
                <span className={`text-[9px] font-mono relative z-10 ${tokens.transition.base} ${isActive ? 'text-zinc-500' : 'text-zinc-700 group-hover:text-zinc-600'}`}>{item.shortcut}</span>
              </motion.button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/[0.04] space-y-1">
          <motion.button whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl w-full text-left transition-all group">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${roleConfig.gradient} border ${roleConfig.border} flex items-center justify-center text-[11px] font-bold relative overflow-hidden`}>
              <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent" />
              <span className="relative z-10">{user.name.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-zinc-300 truncate leading-tight">{user.name}</p>
              <p className="text-[10px] text-zinc-600 leading-tight">{roleConfig.label}</p>
            </div>
            <IconComponent name="chevron-down" className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-500 transition-colors" />
          </motion.button>

          <motion.button onClick={onLogout} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/[0.06] border border-transparent hover:border-rose-500/12 ${tokens.transition.base}`}
          >
            <IconComponent name="log-out" className="w-[18px] h-[18px]" />
            <span className="text-[13px] font-semibold">Sign Out</span>
          </motion.button>
        </div>
      </motion.aside>
    </>
  );
}

// ─── Placeholder Pages (Customer) ───────────────────────────────────────────

function ChartCreatorPage() {
  const chartTypes = [
    { type: 'Line', desc: 'Trend analysis over time', icon: 'trending-up' },
    { type: 'Bar', desc: 'Compare categories', icon: 'bar-chart' },
    { type: 'Pie', desc: 'Part-to-whole ratios', icon: 'activity' },
    { type: 'Area', desc: 'Volume over time', icon: 'trending-up' },
    { type: 'Scatter', desc: 'Correlation analysis', icon: 'grid' },
    { type: 'Radar', desc: 'Multi-variable comparison', icon: 'activity' },
  ];

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={staggerItem}>
        <SectionHeader title="Chart Creator" description="Create and customize data visualizations."
          action={<AppButton icon="plus" roleConfig={ROLE_CONFIG.customer}>New Chart</AppButton>}
        />
      </motion.div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {chartTypes.map((chart) => (
          <motion.div key={chart.type} variants={staggerItem}>
            <Card hover onClick={() => {}}>
              <div className="w-full h-28 rounded-xl bg-gradient-to-br from-white/[0.02] to-transparent border border-white/[0.04] mb-4 flex items-center justify-center">
                <IconComponent name={chart.icon} className="w-8 h-8 text-zinc-700" />
              </div>
              <h3 className="text-[14px] font-bold text-zinc-200">{chart.type} Chart</h3>
              <p className="text-[12px] text-zinc-500 mt-1 leading-relaxed">{chart.desc}</p>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function PermissionsPage() {
  const permissions = [
    { user: 'Alice Johnson', role: 'Editor', access: 'Full', status: 'Active' },
    { user: 'Bob Smith', role: 'Viewer', access: 'Read Only', status: 'Active' },
    { user: 'Carol Williams', role: 'Editor', access: 'Full', status: 'Pending' },
    { user: 'Dave Brown', role: 'Admin', access: 'Full', status: 'Active' },
  ];

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={staggerItem}>
        <SectionHeader title="Permissions" description="Manage access levels and user permissions."
          action={<AppButton icon="plus" roleConfig={ROLE_CONFIG.customer}>Invite User</AppButton>}
        />
      </motion.div>
      <motion.div variants={staggerItem}><Input icon="search" placeholder="Search users..." /></motion.div>
      <motion.div variants={staggerItem}>
        <Table headers={['User', 'Role', 'Access', 'Status']}>
          {permissions.map((p, i) => (
            <TableRow key={i}>
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/10 to-indigo-500/5 border border-violet-500/15 flex items-center justify-center text-[11px] font-bold text-violet-400">{p.user.charAt(0)}</div>
                  <span className="text-[13px] font-medium text-zinc-200">{p.user}</span>
                </div>
              </td>
              <td className="px-5 py-4 text-[12px] text-zinc-400">{p.role}</td>
              <td className="px-5 py-4 text-[12px] text-zinc-400">{p.access}</td>
              <td className="px-5 py-4"><Badge variant={p.status === 'Active' ? 'success' : 'warning'} dot pulse={p.status !== 'Active'}>{p.status}</Badge></td>
            </TableRow>
          ))}
        </Table>
      </motion.div>
    </motion.div>
  );
}

function CreateDocumentPage() {
  const [selectedTemplate, setSelectedTemplate] = useState(0);

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={staggerItem}><SectionHeader title="Create Document" description="Create and manage new documents from templates." /></motion.div>
      <motion.div variants={staggerItem}>
        <Card padding="p-7">
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 mb-2 block uppercase tracking-[0.12em]">Document Title</label>
              <Input placeholder="Enter document title..." />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 mb-3 block uppercase tracking-[0.12em]">Template</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { name: 'Blank', desc: 'Start from scratch', icon: 'file-plus' },
                  { name: 'Report', desc: 'Pre-formatted report', icon: 'layout' },
                  { name: 'Invoice', desc: 'Business invoice', icon: 'file-plus' },
                ].map((tmpl, i) => (
                  <motion.button key={tmpl.name} onClick={() => setSelectedTemplate(i)}
                    whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}
                    className={`p-4 rounded-xl border text-left ${tokens.transition.slow} relative overflow-hidden ${
                      selectedTemplate === i ? 'bg-violet-500/[0.08] border-violet-500/25 ring-1 ring-violet-500/15' : 'bg-white/[0.015] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]'
                    }`}
                  >
                    <div className="w-full h-16 rounded-lg bg-white/[0.02] border border-white/[0.04] mb-3 flex items-center justify-center">
                      <IconComponent name={tmpl.icon} className={`w-5 h-5 ${selectedTemplate === i ? 'text-violet-400' : 'text-zinc-600'} transition-colors`} />
                    </div>
                    <h4 className={`text-[13px] font-bold transition-colors ${selectedTemplate === i ? 'text-violet-300' : 'text-zinc-300'}`}>{tmpl.name}</h4>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{tmpl.desc}</p>
                  </motion.button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-zinc-500 mb-2 block uppercase tracking-[0.12em]">Description</label>
              <textarea placeholder="Add a description..." rows={3}
                className={`w-full bg-white/[0.02] border border-white/[0.07] ${tokens.radius.md} px-4 py-3 text-[13px] text-zinc-100 outline-none focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/10 ${tokens.transition.base} placeholder:text-zinc-600 font-medium resize-none hover:border-white/[0.12] hover:bg-white/[0.03]`}
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <AppButton variant="secondary">Cancel</AppButton>
              <AppButton icon="plus" roleConfig={ROLE_CONFIG.customer}>Create Document</AppButton>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ─── Placeholder Pages (Admin) ──────────────────────────────────────────────

function ChartDesignerPage() {
    const designOptions = [
    { name: 'Color Palette', desc: 'Define chart color schemes', icon: 'sparkles', count: 8 },
    { name: 'Layout Templates', desc: 'Manage chart layouts', icon: 'layout', count: 12 },
    { name: 'Data Sources', desc: 'Configure data connections', icon: 'activity', count: 5 },
    { name: 'Export Presets', desc: 'Define export configurations', icon: 'file-plus', count: 3 },
  ];

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={staggerItem}>
        <SectionHeader title="Chart Designer" description="Design and configure chart templates for the platform."
          action={<AppButton icon="plus" roleConfig={ROLE_CONFIG.admin}>New Template</AppButton>}
        />
      </motion.div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {designOptions.map((option) => (
          <motion.div key={option.name} variants={staggerItem}>
            <Card hover onClick={() => {}}>
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/15 flex items-center justify-center flex-shrink-0">
                  <IconComponent name={option.icon} className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[14px] font-bold text-zinc-200">{option.name}</h3>
                    <Badge variant="success">{option.count}</Badge>
                  </div>
                  <p className="text-[12px] text-zinc-500 mt-1 leading-relaxed">{option.desc}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
      <motion.div variants={staggerItem}>
        <Card padding="p-6">
          <h3 className="text-[14px] font-bold text-zinc-200 mb-4">Recent Designs</h3>
          <div className="space-y-3">
            {[
              { name: 'Revenue Dashboard Template', modified: '2 hours ago', status: 'Published' },
              { name: 'User Analytics Layout', modified: '1 day ago', status: 'Draft' },
              { name: 'Sales Funnel Chart', modified: '3 days ago', status: 'Published' },
            ].map((design, i) => (
              <motion.div key={i} whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                className="flex items-center justify-between p-3 rounded-xl border border-white/[0.04] hover:border-white/[0.08] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                    <IconComponent name="bar-chart" className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-zinc-300">{design.name}</p>
                    <p className="text-[11px] text-zinc-600">{design.modified}</p>
                  </div>
                </div>
                <Badge variant={design.status === 'Published' ? 'success' : 'warning'} dot>{design.status}</Badge>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function AccountsManagementPage() {
  const accounts = [
    { name: 'Acme Corporation', plan: 'Enterprise', users: 45, status: 'Active', usage: 78 },
    { name: 'Startup Labs', plan: 'Pro', users: 12, status: 'Active', usage: 54 },
    { name: 'Design Co', plan: 'Basic', users: 5, status: 'Trial', usage: 23 },
    { name: 'Tech Innovations', plan: 'Enterprise', users: 89, status: 'Active', usage: 92 },
    { name: 'Creative Agency', plan: 'Pro', users: 18, status: 'Suspended', usage: 0 },
  ];

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={staggerItem}>
        <SectionHeader title="Accounts Management" description="Manage organization accounts, plans, and billing."
          action={<AppButton icon="plus" roleConfig={ROLE_CONFIG.admin}>Add Account</AppButton>}
        />
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Accounts', value: '156', change: '+12%', icon: 'users', trend: 'up' },
          { label: 'Active Users', value: '1,247', change: '+8%', icon: 'activity', trend: 'up' },
          { label: 'Revenue MRR', value: '$48.2k', change: '+15%', icon: 'trending-up', trend: 'up' },
        ].map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em]">{stat.label}</p>
                <p className="text-[24px] font-bold text-zinc-100 tracking-[-0.03em] mt-1">{stat.value}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/15 flex items-center justify-center">
                <IconComponent name={stat.icon} className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-3">
              <IconComponent name="trending-up" className="w-3 h-3 text-emerald-400" />
              <span className="text-[11px] font-semibold text-emerald-400">{stat.change}</span>
              <span className="text-[11px] text-zinc-600">vs last month</span>
            </div>
          </Card>
        ))}
      </motion.div>

      <motion.div variants={staggerItem}><Input icon="search" placeholder="Search accounts..." accentColor="emerald" /></motion.div>

      <motion.div variants={staggerItem}>
        <Table headers={['Account', 'Plan', 'Users', 'Usage', 'Status']}>
          {accounts.map((account, i) => (
            <TableRow key={i} onClick={() => {}}>
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/15 flex items-center justify-center text-[11px] font-bold text-emerald-400">{account.name.charAt(0)}</div>
                  <span className="text-[13px] font-medium text-zinc-200">{account.name}</span>
                </div>
              </td>
              <td className="px-5 py-4"><Badge variant={account.plan === 'Enterprise' ? 'info' : account.plan === 'Pro' ? 'success' : 'default'}>{account.plan}</Badge></td>
              <td className="px-5 py-4 text-[12px] text-zinc-400">{account.users}</td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-20 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${account.usage}%` }} transition={{ duration: 1, delay: i * 0.1, ease: 'easeOut' }}
                      className={`h-full rounded-full ${account.usage > 80 ? 'bg-rose-400' : account.usage > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                    />
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono">{account.usage}%</span>
                </div>
              </td>
              <td className="px-5 py-4">
                <Badge variant={account.status === 'Active' ? 'success' : account.status === 'Trial' ? 'warning' : 'danger'} dot pulse={account.status === 'Trial'}>
                  {account.status}
                </Badge>
              </td>
            </TableRow>
          ))}
        </Table>
      </motion.div>
    </motion.div>
  );
}

function DocumentDesignerPage() {
  const [activeDesignTab, setActiveDesignTab] = useState('templates');

  const templates = [
    { name: 'Annual Report', category: 'Business', pages: 12, lastEdited: '3 hours ago' },
    { name: 'Project Proposal', category: 'Business', pages: 8, lastEdited: '1 day ago' },
    { name: 'User Manual', category: 'Technical', pages: 24, lastEdited: '2 days ago' },
    { name: 'Invoice Template', category: 'Finance', pages: 2, lastEdited: '5 days ago' },
  ];

  const components = [
    { name: 'Header Block', type: 'Layout', uses: 89 },
    { name: 'Data Table', type: 'Content', uses: 156 },
    { name: 'Chart Embed', type: 'Visualization', uses: 67 },
    { name: 'Signature Block', type: 'Form', uses: 45 },
    { name: 'Footer Block', type: 'Layout', uses: 92 },
    { name: 'Image Gallery', type: 'Content', uses: 34 },
  ];

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={staggerItem}>
        <SectionHeader title="Document Designer" description="Design document templates and reusable components."
          action={<AppButton icon="plus" roleConfig={ROLE_CONFIG.admin}>New Template</AppButton>}
        />
      </motion.div>

      <motion.div variants={staggerItem}>
        <div className="flex items-center gap-1 p-1 bg-white/[0.02] border border-white/[0.06] rounded-xl w-fit">
          {['templates', 'components', 'styles'].map((tab) => (
            <button key={tab} onClick={() => setActiveDesignTab(tab)}
              className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-all duration-200 capitalize ${
                activeDesignTab === tab ? 'bg-emerald-500/[0.12] text-emerald-300 border border-emerald-500/20' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {activeDesignTab === 'templates' && (
          <motion.div key="templates" {...pageTransition} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {templates.map((tmpl, i) => (
                <motion.div key={tmpl.name} variants={staggerItem}>
                  <Card hover onClick={() => {}}>
                    <div className="w-full h-32 rounded-xl bg-gradient-to-br from-white/[0.02] to-transparent border border-white/[0.04] mb-4 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-4 space-y-2 opacity-30">
                        <div className="w-3/4 h-2 bg-white/[0.08] rounded" />
                        <div className="w-full h-2 bg-white/[0.06] rounded" />
                        <div className="w-full h-2 bg-white/[0.06] rounded" />
                        <div className="w-2/3 h-2 bg-white/[0.06] rounded" />
                        <div className="w-full h-2 bg-white/[0.04] rounded" />
                      </div>
                      <IconComponent name="layout" className="w-8 h-8 text-zinc-700 relative z-10" />
                    </div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-[14px] font-bold text-zinc-200">{tmpl.name}</h3>
                        <p className="text-[11px] text-zinc-500 mt-1">{tmpl.pages} pages · {tmpl.lastEdited}</p>
                      </div>
                      <Badge variant="default">{tmpl.category}</Badge>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {activeDesignTab === 'components' && (
          <motion.div key="components" {...pageTransition}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {components.map((comp) => (
                <Card key={comp.name} hover onClick={() => {}}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/15 flex items-center justify-center">
                      <IconComponent name="grid" className="w-4.5 h-4.5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-bold text-zinc-200">{comp.name}</h3>
                      <p className="text-[10px] text-zinc-600">{comp.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
                    <span className="text-[11px] text-zinc-500">{comp.uses} uses</span>
                    <Badge variant="success" dot>Active</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {activeDesignTab === 'styles' && (
          <motion.div key="styles" {...pageTransition}>
            <Card padding="p-6">
              <h3 className="text-[14px] font-bold text-zinc-200 mb-5">Design System</h3>
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em] mb-3 block">Typography Scale</label>
                  <div className="space-y-2">
                    {[
                      { label: 'Heading 1', size: '32px', weight: 'Bold' },
                      { label: 'Heading 2', size: '24px', weight: 'Semibold' },
                      { label: 'Body', size: '14px', weight: 'Regular' },
                      { label: 'Caption', size: '12px', weight: 'Medium' },
                    ].map((typo) => (
                      <div key={typo.label} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                        <span className="text-[13px] font-medium text-zinc-300">{typo.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-zinc-500 font-mono">{typo.size}</span>
                          <Badge variant="default">{typo.weight}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em] mb-3 block">Color Palette</label>
                  <div className="flex items-center gap-3">
                    {['bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-zinc-500'].map((color) => (
                      <motion.div key={color} whileHover={{ scale: 1.2, y: -4 }} className={`w-8 h-8 rounded-lg ${color} cursor-pointer shadow-lg`} />
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Top Bar ────────────────────────────────────────────────────────────────

function TopBar({
  activeTab, roleConfig, navItems, onMenuClick,
}: {
  activeTab: string; roleConfig: (typeof ROLE_CONFIG)['customer'];
  navItems: typeof CUSTOMER_NAV; onMenuClick: () => void;
}) {
  const currentNav = navItems.find((n) => n.id === activeTab);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 sm:px-8 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onMenuClick} className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-all">
            <IconComponent name="menu" className="w-5 h-5" />
          </button>
          <div className="hidden sm:flex items-center gap-2 text-[12px] text-zinc-600">
            <span className={`${roleConfig.text} font-semibold`}>{roleConfig.label}</span>
            <span>/</span>
            <span className="text-zinc-400 font-medium">{currentNav?.label || activeTab}</span>
          </div>
          <div className="sm:hidden">
            <span className="text-[13px] font-semibold text-zinc-300">{currentNav?.label || activeTab}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-600 font-mono hidden sm:block">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all relative"
          >
            <IconComponent name="bell" className="w-4 h-4" />
            <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
          >
            <IconComponent name="settings" className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App Shell ─────────────────────────────────────────────────────────

function AppShell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const role = user.role!;
  const roleConfig = ROLE_CONFIG[role];
  const navItems = role === 'customer' ? CUSTOMER_NAV : ADMIN_NAV;
  const [activeTab, setActiveTab] = useState(navItems[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (index < navItems.length) {
          setActiveTab(navItems[index].id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navItems]);

  const renderPage = () => {
    if (role === 'customer') {
      switch (activeTab) {
        case 'dashboard':
          return <DashboardPage />;
        case 'chart-creator':
          return <ChartCreatorPage />;
        case 'permissions':
          return <PermissionsPage />;
        case 'create-document':
          return <CreateDocumentPage />;
        default:
          return <DashboardPage />;
      }
    } else {
      switch (activeTab) {
        case 'chart-designer':
          return <ChartDesignerPage />;
        case 'accounts':
          return <AccountsManagementPage />;
        case 'document-designer':
          return <DocumentDesignerPage />;
        default:
          return <ChartDesignerPage />;
      }
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: 'linear-gradient(180deg, #09090b 0%, #0a0a10 50%, #09090b 100%)' }}>
      <Sidebar
        user={user}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={onLogout}
        navItems={navItems}
        roleConfig={roleConfig}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          activeTab={activeTab}
          roleConfig={roleConfig}
          navItems={navItems}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="relative">
            <GlowOrb color={role === 'customer' ? 'violet' : 'emerald'} position="top-right" />
            <div className="relative z-10 px-4 sm:px-8 py-8 max-w-[1400px] mx-auto">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} {...pageTransition}>
                  {renderPage()}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Root App ───────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  const handleLogin = useCallback((loggedInUser: User) => {
    setUser(loggedInUser);
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <div className="antialiased">
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div key="login" {...pageTransition}>
            <LoginPage onLogin={handleLogin} />
          </motion.div>
        ) : (
          <motion.div key="app" {...pageTransition}>
            <AppShell user={user} onLogout={handleLogout} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}