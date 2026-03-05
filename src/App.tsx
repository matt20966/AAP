// App.tsx - Full integrated with Chart Builder

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart
} from 'recharts';

import DashboardPage from './DashboardPage';
import { showToast, ToastContainer } from './ui/Toast';
import { withHtml2CanvasColorFix } from './utils/html2canvasSafe';
import { CHART_TYPES, COLOR_SCHEMES, DATA_SOURCES, formatBuilderNumber } from './data/chartBuilderShared';

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

// ─── Chart Builder Types ────────────────────────────────────────────────────

type ChartType = 'bar' | 'bar-stacked' | 'bar-grouped' | 'line' | 'area' | 'pie' | 'donut' | 'kpi' | 'composed';
type AggregationType = 'sum' | 'average' | 'count' | 'min' | 'max' | 'none';

interface ChartStyle {
  colorScheme: string;
  showGrid: boolean;
  showLegend: boolean;
  legendPosition: 'top' | 'bottom' | 'left' | 'right';
  showTooltip: boolean;
  showLabels: boolean;
  numberFormat: 'number' | 'currency' | 'percent' | 'compact';
  curveType: 'linear' | 'monotone' | 'step';
  fillOpacity: number;
  strokeWidth: number;
  borderRadius: number;
  gradientFill: boolean;
  animationEnabled: boolean;
}

interface ChartConfig {
  id: string;
  title: string;
  subtitle: string;
  chartType: ChartType;
  dataSource: string;
  xAxis: string;
  yAxis: string[];
  aggregation: AggregationType;
  style: ChartStyle;
}

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
  { id: 'chart-creator', label: 'Chart Builder', icon: 'bar-chart', shortcut: '⌘2' },
  { id: 'permissions', label: 'Permissions', icon: 'shield', shortcut: '⌘3' },
  { id: 'create-document', label: 'Create Document', icon: 'file-plus', shortcut: '⌘4' },
];

const ADMIN_NAV = [
  { id: 'chart-designer', label: 'Chart Designer', icon: 'pen-tool', shortcut: '⌘1' },
  { id: 'accounts', label: 'Accounts Management', icon: 'users', shortcut: '⌘2' },
  { id: 'document-designer', label: 'Document Designer', icon: 'layout', shortcut: '⌘3' },
];

// ─── Chart Builder Data ─────────────────────────────────────────────────────

const formatChartNumber = formatBuilderNumber;

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
    case 'arrow-up':
      return (<svg {...props}><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>);
    case 'arrow-down':
      return (<svg {...props}><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>);
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
    case 'chevron-right':
      return (<svg {...props}><polyline points="9 18 15 12 9 6" /></svg>);
    case 'command':
      return (<svg {...props}><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" /></svg>);
    case 'bell':
      return (<svg {...props}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>);
    case 'sparkles':
      return (<svg {...props}><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" /></svg>);
    case 'download':
      return (<svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>);
    case 'save':
      return (<svg {...props}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>);
    case 'eye':
      return (<svg {...props}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>);
    case 'database':
      return (<svg {...props}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>);
    case 'layers':
      return (<svg {...props}><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>);
    case 'sliders':
      return (<svg {...props}><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>);
    case 'palette':
      return (<svg {...props}><circle cx="13.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="10.5" r="1.5" /><circle cx="8.5" cy="7.5" r="1.5" /><circle cx="6.5" cy="12.5" r="1.5" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></svg>);
    case 'type':
      return (<svg {...props}><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>);
    case 'maximize':
      return (<svg {...props}><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>);
    case 'minimize':
      return (<svg {...props}><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" /></svg>);
    case 'refresh':
      return (<svg {...props}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>);
    case 'copy':
      return (<svg {...props}><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>);
    case 'info':
      return (<svg {...props}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>);
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
  const sizeClasses = { sm: 'px-3 py-1.5 text-[12px] gap-1.5', md: 'px-4 py-2.5 text-[13px] gap-2', lg: 'px-5 py-3 text-[14px] gap-2.5' };
  const variantClasses = {
    primary: roleConfig
      ? `${roleConfig.buttonBg} ${roleConfig.buttonText} border ${roleConfig.buttonBorder} shadow-lg ${roleConfig.shadowColor}`
      : 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/25 hover:border-indigo-500/40 shadow-lg shadow-indigo-500/10',
    secondary: 'bg-white/[0.03] hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-300 border border-white/[0.06] hover:border-white/[0.1]',
    ghost: 'bg-transparent hover:bg-white/[0.04] text-zinc-400 hover:text-zinc-300 border border-transparent',
    danger: 'bg-rose-500/[0.06] hover:bg-rose-500/[0.12] text-rose-400 border border-rose-500/15 hover:border-rose-500/25',
  };

  return (
    <motion.button onClick={onClick} disabled={disabled}
      whileHover={!disabled ? { scale: 1.02, y: -1 } : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      transition={{ type: 'spring', damping: 20, stiffness: 400 }}
      className={`inline-flex items-center justify-center font-semibold tracking-[-0.01em] ${tokens.radius.md} ${tokens.transition.base} ${sizeClasses[size]} ${variantClasses[variant]} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} relative overflow-hidden group ${className}`}
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
      <input type="text" placeholder={placeholder} value={value} onChange={onChange}
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
    <motion.div onClick={onClick}
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
  const dotColors = { default: 'bg-zinc-500', success: 'bg-emerald-400', warning: 'bg-amber-400', danger: 'bg-rose-400', info: 'bg-blue-400' };

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
          <thead><tr className="border-b border-white/[0.06]">{headers.map((h) => (<th key={h} className="text-left px-5 py-3.5 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em]">{h}</th>))}</tr></thead>
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
      <GridBackground /><FloatingParticles /><GlowOrb color="indigo" position="top" />
      <div className="relative z-10 w-full max-w-[420px] px-5">
        <motion.div initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', damping: 25, stiffness: 200, delay: 0.1 }} className="flex flex-col items-center">
          <motion.div className="flex flex-col items-center mb-12" variants={staggerContainer} initial="hidden" animate="show">
            <motion.div variants={staggerItem}>
              <MagneticWrapper strength={0.2}>
                <div className="w-[72px] h-[72px] rounded-[20px] bg-gradient-to-br from-indigo-500/10 to-violet-500/5 border border-white/[0.08] flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/10 relative group">
                  <div className="absolute inset-0 rounded-[20px] bg-gradient-to-b from-white/[0.05] to-transparent" />
                  <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
                    <IconComponent name="sparkles" className="w-8 h-8 text-indigo-400 relative z-10" />
                  </motion.div>
                </div>
              </MagneticWrapper>
            </motion.div>
            <motion.h1 variants={staggerItem} className="text-[32px] font-bold text-zinc-50 tracking-[-0.05em] leading-none">Merlin</motion.h1>
            <motion.p variants={staggerItem} className="text-[14px] text-zinc-500 mt-3 text-center font-medium tracking-[-0.01em] leading-relaxed">Select your account type to continue</motion.p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.25, type: 'spring', damping: 25, stiffness: 200 }} className="w-full">
            <div className="rounded-2xl border border-white/[0.07] bg-[#0c0c12]/90 backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent" />
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
                          className={`w-full flex items-center gap-4 p-4 rounded-xl border ${tokens.transition.slow} text-left group relative overflow-hidden ${isSelected ? `${config.activeBg} ${config.activeBorder} ring-1 ${config.ring} shadow-xl ${config.shadowColor}` : `bg-white/[0.015] border-white/[0.06] ${config.hoverBorder} hover:bg-white/[0.03]`}`}
                        >
                          <motion.div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full bg-gradient-to-b ${config.accentGradient}`}
                            initial={{ opacity: 0, scaleY: 0 }} animate={isSelected ? { opacity: 1, scaleY: 1 } : { opacity: 0, scaleY: 0 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                          />
                          {isSelected && <motion.div className="absolute inset-0 pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: `radial-gradient(ellipse at 20% 50%, ${config.glowColor} 0%, transparent 70%)` }} />}
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

                <motion.button onClick={handleLogin} disabled={!selectedRole || isLoggingIn}
                  whileHover={selectedRole && !isLoggingIn ? { scale: 1.015, y: -1 } : {}}
                  whileTap={selectedRole && !isLoggingIn ? { scale: 0.985 } : {}}
                  transition={{ type: 'spring', damping: 18, stiffness: 350 }}
                  className={`w-full py-3.5 rounded-xl text-[13px] font-bold border ${tokens.transition.slow} flex items-center justify-center gap-2.5 relative overflow-hidden group ${loginSuccess ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : selectedRole && !isLoggingIn ? 'bg-gradient-to-r from-indigo-500/20 to-violet-500/15 text-indigo-200 border-indigo-500/25 hover:from-indigo-500/30 hover:to-violet-500/20 hover:border-indigo-500/40 shadow-lg shadow-indigo-500/15' : 'bg-white/[0.02] text-zinc-700 border-white/[0.05] cursor-not-allowed'}`}
                >
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
                        <span>Signing in...</span>
                      </motion.div>
                    ) : (
                      <motion.div key="default" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                        <span>{selectedRole ? `Continue as ${ROLE_CONFIG[selectedRole].label}` : 'Select an account type'}</span>
                        {selectedRole && <IconComponent name="arrow-right" className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-300" />}
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
  user, activeTab, onTabChange, onLogout, navItems, roleConfig, sidebarOpen, onCloseSidebar, desktopSidebarVisible, onDesktopSidebarVisibilityChange,
}: {
  user: User; activeTab: string; onTabChange: (tab: string) => void; onLogout: () => void;
  navItems: typeof CUSTOMER_NAV; roleConfig: (typeof ROLE_CONFIG)['customer'];
  sidebarOpen: boolean; onCloseSidebar: () => void;
  desktopSidebarVisible: boolean; onDesktopSidebarVisibilityChange: (visible: boolean) => void;
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
        onMouseEnter={() => onDesktopSidebarVisibilityChange(true)}
        onMouseLeave={() => onDesktopSidebarVisibilityChange(false)}
        className={`fixed top-0 left-0 z-50 h-screen w-[260px] border-r border-white/[0.06] bg-[#08080c]/98 backdrop-blur-2xl flex flex-col flex-shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${desktopSidebarVisible ? 'lg:translate-x-0' : 'lg:-translate-x-full'}`}
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
          <div className="px-3 py-2"><span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.16em]">Navigation</span></div>
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
                {isActive && <motion.div layoutId="navActiveBackground" className={`absolute inset-0 ${roleConfig.activeBg} border ${roleConfig.activeBorder} rounded-xl`} transition={{ type: 'spring', damping: 25, stiffness: 300 }} />}
                {!isActive && isHovered && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-white/[0.03] rounded-xl border border-white/[0.04]" />}
                {isActive && <motion.div layoutId="activeNavIndicator" className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b ${roleConfig.accentGradient}`} transition={{ type: 'spring', damping: 22, stiffness: 300 }} />}
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

// ─── Chart Builder Sub-Components ───────────────────────────────────────────

function CollapsibleSection({ title, icon, children, defaultOpen = true, badge }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean; badge?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-white/[0.01]">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-2.5">
          <IconComponent name={icon} className="w-4 h-4 text-zinc-500" />
          <span className="text-[12px] font-semibold text-zinc-300">{title}</span>
          {badge && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">{badge}</span>}
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <IconComponent name="chevron-down" className="w-3.5 h-3.5 text-zinc-600" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="px-4 pb-4 pt-1 border-t border-white/[0.04]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BuilderSelect({ label, value, onChange, options, icon }: {
  label?: string; value: string; onChange: (val: string) => void;
  options: { value: string; label: string; description?: string }[]; icon?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedOption = options.find(o => o.value === value);
  return (
    <div ref={ref} className="relative">
      {label && <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em] mb-2 block">{label}</label>}
      <button onClick={() => setIsOpen(!isOpen)} className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-all duration-200 ${isOpen ? 'border-violet-500/30 bg-violet-500/[0.04] ring-2 ring-violet-500/10' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12]'}`}>
        {icon && <IconComponent name={icon} className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
        <span className={`text-[13px] font-medium flex-1 truncate ${selectedOption ? 'text-zinc-200' : 'text-zinc-600'}`}>{selectedOption?.label || 'Select...'}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}><IconComponent name="chevron-down" className="w-3.5 h-3.5 text-zinc-500" /></motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1.5 py-1.5 rounded-xl border border-white/[0.08] bg-[#0e0e16]/98 backdrop-blur-xl shadow-2xl shadow-black/60 max-h-[240px] overflow-y-auto">
            {options.map((opt) => (
              <button key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-all duration-150 ${value === opt.value ? 'bg-violet-500/10 text-violet-300' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium truncate">{opt.label}</div>
                  {opt.description && <div className="text-[10px] text-zinc-600 truncate mt-0.5">{opt.description}</div>}
                </div>
                {value === opt.value && <IconComponent name="check" className="w-3.5 h-3.5 text-violet-400" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MultiSelect({ label, values, onChange, options, maxSelect }: {
  label?: string; values: string[]; onChange: (vals: string[]) => void;
  options: { value: string; label: string }[]; maxSelect?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleValue = (val: string) => {
    if (values.includes(val)) onChange(values.filter(v => v !== val));
    else if (!maxSelect || values.length < maxSelect) onChange([...values, val]);
  };

  return (
    <div ref={ref} className="relative">
      {label && <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em] mb-2 block">{label}</label>}
      <button onClick={() => setIsOpen(!isOpen)} className={`w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-left transition-all duration-200 min-h-[42px] ${isOpen ? 'border-violet-500/30 bg-violet-500/[0.04] ring-2 ring-violet-500/10' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12]'}`}>
        <div className="flex-1 flex items-center gap-1.5 flex-wrap">
          {values.length === 0 ? <span className="text-[13px] font-medium text-zinc-600">Select fields...</span> : values.map(v => {
            const opt = options.find(o => o.value === v);
            return (
              <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-[10px] font-semibold text-violet-300">
                {opt?.label}
                <button onClick={(e) => { e.stopPropagation(); onChange(values.filter(x => x !== v)); }} className="hover:text-violet-200"><IconComponent name="x" className="w-2.5 h-2.5" /></button>
              </span>
            );
          })}
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}><IconComponent name="chevron-down" className="w-3.5 h-3.5 text-zinc-500" /></motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1.5 py-1.5 rounded-xl border border-white/[0.08] bg-[#0e0e16]/98 backdrop-blur-xl shadow-2xl shadow-black/60 max-h-[200px] overflow-y-auto">
            {options.map((opt) => {
              const isSelected = values.includes(opt.value);
              const isDisabled = !isSelected && maxSelect !== undefined && values.length >= maxSelect;
              return (
                <button key={opt.value} onClick={() => !isDisabled && toggleValue(opt.value)} disabled={isDisabled}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-all duration-150 ${isSelected ? 'bg-violet-500/10 text-violet-300' : isDisabled ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'}`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-violet-500/20 border-violet-500/40' : 'border-white/[0.1]'}`}>
                    {isSelected && <IconComponent name="check" className="w-2.5 h-2.5 text-violet-400" />}
                  </div>
                  <span className="text-[12px] font-medium">{opt.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center justify-between w-full py-1.5 group">
      <span className="text-[11px] font-medium text-zinc-400 group-hover:text-zinc-300 transition-colors">{label}</span>
      <div className={`w-8 h-[18px] rounded-full transition-all duration-200 relative ${checked ? 'bg-violet-500/30 border-violet-500/40' : 'bg-white/[0.06] border-white/[0.1]'} border`}>
        <motion.div animate={{ x: checked ? 14 : 2 }} transition={{ type: 'spring', damping: 20, stiffness: 300 }} className={`absolute top-[2px] w-3 h-3 rounded-full ${checked ? 'bg-violet-400' : 'bg-zinc-500'}`} />
      </div>
    </button>
  );
}

function Slider({ label, value, onChange, min = 0, max = 100, step = 1, unit = '' }: {
  label: string; value: number; onChange: (val: number) => void; min?: number; max?: number; step?: number; unit?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-zinc-400">{label}</span>
        <span className="text-[11px] font-mono text-zinc-500">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer bg-white/[0.06] accent-violet-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-violet-500/50 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-violet-500/20"
      />
    </div>
  );
}

function ChartTooltip({ active, payload, label, numberFormat }: any) {
  if (!active || !payload) return null;
  return (
    <div className="bg-[#0c0c14]/95 backdrop-blur-xl border border-white/[0.1] rounded-xl px-4 py-3 shadow-2xl shadow-black/60">
      <p className="text-[11px] font-semibold text-zinc-300 mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 py-0.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[10px] text-zinc-500 font-medium">{entry.name}:</span>
          <span className="text-[11px] text-zinc-200 font-semibold">{formatChartNumber(entry.value, numberFormat)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card Preview ───────────────────────────────────────────────────────

function KPICardPreview({ data, yAxis, style }: { data: any[]; yAxis: string[]; style: ChartStyle }) {
  const field = yAxis[0];
  if (!field) return null;
  const values = data.map(d => Number(d[field]) || 0);
  const total = values.reduce((a, b) => a + b, 0);
  const avg = total / values.length;
  const max = Math.max(...values);
  const lastValue = values[values.length - 1];
  const prevValue = values.length > 1 ? values[values.length - 2] : lastValue;
  const change = prevValue !== 0 ? ((lastValue - prevValue) / prevValue * 100) : 0;
  const colors = COLOR_SCHEMES[style.colorScheme]?.colors || COLOR_SCHEMES.violet.colors;

  return (
    <div className="grid grid-cols-2 gap-4">
      {[
        { label: 'Total', value: total, icon: 'layers' },
        { label: 'Average', value: avg, icon: 'activity' },
        { label: 'Maximum', value: max, icon: 'arrow-up' },
        { label: 'Latest', value: lastValue, icon: 'zap' },
      ].map((kpi, i) => (
        <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, type: 'spring', damping: 20, stiffness: 300 }}
          className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ background: `linear-gradient(to right, ${colors[i % colors.length]}, ${colors[(i + 1) % colors.length]})` }} />
          <div className="flex items-start justify-between mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${colors[i % colors.length]}15` }}>
              <IconComponent name={kpi.icon} className="w-4 h-4" />
            </div>
            {i === 3 && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${change >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                <IconComponent name={change >= 0 ? 'arrow-up' : 'arrow-down'} className="w-2.5 h-2.5" />
                {Math.abs(change).toFixed(1)}%
              </div>
            )}
          </div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.1em]">{kpi.label}</p>
          <p className="text-[22px] font-bold text-zinc-100 tracking-[-0.03em] mt-1">{formatChartNumber(kpi.value, style.numberFormat)}</p>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Chart Preview Renderer ─────────────────────────────────────────────────

function ChartPreview({ config, data }: { config: ChartConfig; data: any[] }) {
  const colors = COLOR_SCHEMES[config.style.colorScheme]?.colors || COLOR_SCHEMES.violet.colors;
  const { style } = config;

  if (!config.xAxis || config.yAxis.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
          <IconComponent name="bar-chart" className="w-7 h-7 text-zinc-700" />
        </div>
        <div className="text-center">
          <p className="text-[14px] font-semibold text-zinc-400">Configure your chart</p>
          <p className="text-[12px] text-zinc-600 mt-1">Select data source, axes, and chart type to see a preview</p>
        </div>
      </div>
    );
  }

  if (config.chartType === 'kpi') return <KPICardPreview data={data} yAxis={config.yAxis} style={style} />;

  const commonAxisProps = { tick: { fontSize: 11, fill: '#71717a', fontWeight: 500 }, axisLine: { stroke: 'rgba(255,255,255,0.06)' }, tickLine: false };

  const renderChart = () => {
    switch (config.chartType) {
      case 'bar':
      case 'bar-grouped':
        return (
          <BarChart data={data} barGap={4}>
            {style.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />}
            <XAxis dataKey={config.xAxis} {...commonAxisProps} />
            <YAxis {...commonAxisProps} tickFormatter={(v) => formatChartNumber(v, style.numberFormat)} />
            {style.showTooltip && <Tooltip content={<ChartTooltip numberFormat={style.numberFormat} />} />}
            {style.showLegend && <Legend wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />}
            {config.yAxis.map((field, i) => (
              <Bar key={field} dataKey={field} fill={colors[i % colors.length]} radius={[style.borderRadius, style.borderRadius, 0, 0]} fillOpacity={style.fillOpacity} animationDuration={style.animationEnabled ? 800 : 0} />
            ))}
          </BarChart>
        );
      case 'bar-stacked':
        return (
          <BarChart data={data}>
            {style.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />}
            <XAxis dataKey={config.xAxis} {...commonAxisProps} />
            <YAxis {...commonAxisProps} tickFormatter={(v) => formatChartNumber(v, style.numberFormat)} />
            {style.showTooltip && <Tooltip content={<ChartTooltip numberFormat={style.numberFormat} />} />}
            {style.showLegend && <Legend wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />}
            {config.yAxis.map((field, i) => (
              <Bar key={field} dataKey={field} stackId="stack" fill={colors[i % colors.length]} fillOpacity={style.fillOpacity}
                radius={i === config.yAxis.length - 1 ? [style.borderRadius, style.borderRadius, 0, 0] : [0, 0, 0, 0]}
                animationDuration={style.animationEnabled ? 800 : 0} />
            ))}
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={data}>
            {style.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />}
            <XAxis dataKey={config.xAxis} {...commonAxisProps} />
            <YAxis {...commonAxisProps} tickFormatter={(v) => formatChartNumber(v, style.numberFormat)} />
            {style.showTooltip && <Tooltip content={<ChartTooltip numberFormat={style.numberFormat} />} />}
            {style.showLegend && <Legend wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />}
            {config.yAxis.map((field, i) => (
              <Line key={field} type={style.curveType} dataKey={field} stroke={colors[i % colors.length]} strokeWidth={style.strokeWidth}
                dot={{ fill: colors[i % colors.length], r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: colors[i % colors.length], strokeWidth: 2, fill: '#0c0c14' }}
                animationDuration={style.animationEnabled ? 1000 : 0} />
            ))}
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart data={data}>
            <defs>
              {config.yAxis.map((field, i) => (
                <linearGradient key={field} id={`gradient-${field}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors[i % colors.length]} stopOpacity={style.gradientFill ? 0.3 : style.fillOpacity} />
                  <stop offset="100%" stopColor={colors[i % colors.length]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            {style.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />}
            <XAxis dataKey={config.xAxis} {...commonAxisProps} />
            <YAxis {...commonAxisProps} tickFormatter={(v) => formatChartNumber(v, style.numberFormat)} />
            {style.showTooltip && <Tooltip content={<ChartTooltip numberFormat={style.numberFormat} />} />}
            {style.showLegend && <Legend wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />}
            {config.yAxis.map((field, i) => (
              <Area key={field} type={style.curveType} dataKey={field} stroke={colors[i % colors.length]} strokeWidth={style.strokeWidth}
                fill={`url(#gradient-${field})`} animationDuration={style.animationEnabled ? 1000 : 0} />
            ))}
          </AreaChart>
        );
      case 'pie':
      case 'donut':
        const pieField = config.yAxis[0];
        if (!pieField) return null;
        return (
          <PieChart>
            {style.showTooltip && <Tooltip content={<ChartTooltip numberFormat={style.numberFormat} />} />}
            {style.showLegend && <Legend wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />}
            <Pie data={data} dataKey={pieField} nameKey={config.xAxis} cx="50%" cy="50%" outerRadius={120}
              innerRadius={config.chartType === 'donut' ? 70 : 0} paddingAngle={2}
              animationDuration={style.animationEnabled ? 800 : 0}
              label={style.showLabels ? ({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)` : false}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} fillOpacity={style.fillOpacity} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
              ))}
            </Pie>
          </PieChart>
        );
      case 'composed':
        return (
          <ComposedChart data={data}>
            {style.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />}
            <XAxis dataKey={config.xAxis} {...commonAxisProps} />
            <YAxis {...commonAxisProps} tickFormatter={(v) => formatChartNumber(v, style.numberFormat)} />
            {style.showTooltip && <Tooltip content={<ChartTooltip numberFormat={style.numberFormat} />} />}
            {style.showLegend && <Legend wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />}
            {config.yAxis.map((field, i) => {
              if (i === 0) return <Bar key={field} dataKey={field} fill={colors[i]} fillOpacity={style.fillOpacity} radius={[style.borderRadius, style.borderRadius, 0, 0]} animationDuration={style.animationEnabled ? 800 : 0} />;
              return <Line key={field} type={style.curveType} dataKey={field} stroke={colors[i % colors.length]} strokeWidth={style.strokeWidth} dot={{ fill: colors[i % colors.length], r: 3, strokeWidth: 0 }} animationDuration={style.animationEnabled ? 1000 : 0} />;
            })}
          </ComposedChart>
        );
      default:
        return null;
    }
  };

  const chart = renderChart();
  if (!chart) return null;
  return <div className="w-full h-full"><ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer></div>;
}

// ─── Chart Builder Page (replaces ChartCreatorPage) ─────────────────────────

function ChartBuilderPage() {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [activeConfigTab, setActiveConfigTab] = useState<'data' | 'style' | 'advanced'>('data');
  const [savedMessage, setSavedMessage] = useState('');

  const [config, setConfig] = useState<ChartConfig>({
    id: `chart-${Date.now()}`,
    title: 'Monthly Revenue Overview',
    subtitle: 'Revenue, expenses, and profit trends',
    chartType: 'bar',
    dataSource: 'salesByMonth',
    xAxis: 'month',
    yAxis: ['revenue'],
    aggregation: 'none',
    style: {
      colorScheme: 'violet',
      showGrid: true,
      showLegend: true,
      legendPosition: 'bottom',
      showTooltip: true,
      showLabels: false,
      numberFormat: 'compact',
      curveType: 'monotone',
      fillOpacity: 0.85,
      strokeWidth: 2,
      borderRadius: 6,
      gradientFill: true,
      animationEnabled: true,
    },
  });

  const currentDataSource = DATA_SOURCES[config.dataSource];
  const currentData = currentDataSource?.data || [];
  const numericFields = currentDataSource?.fields.filter(f => f.type === 'number') || [];
  const allFields = currentDataSource?.fields || [];
  const currentChartType = CHART_TYPES.find(ct => ct.id === config.chartType);

  const updateConfig = useCallback((partial: Partial<ChartConfig>) => { setConfig(prev => ({ ...prev, ...partial })); }, []);
  const updateStyle = useCallback((partial: Partial<ChartStyle>) => { setConfig(prev => ({ ...prev, style: { ...prev.style, ...partial } })); }, []);

  const handleDataSourceChange = useCallback((source: string) => {
    const ds = DATA_SOURCES[source];
    if (!ds) return;
    const xField = ds.fields.find(f => f.type === 'string')?.key || ds.fields[0].key;
    const yField = ds.fields.find(f => f.type === 'number')?.key || '';
    updateConfig({ dataSource: source, xAxis: xField, yAxis: yField ? [yField] : [] });
    showToast('info', `Data source set to ${ds.label}`);
  }, [updateConfig]);

  const handleChartTypeChange = useCallback((chartType: ChartType) => {
    const ct = CHART_TYPES.find(c => c.id === chartType);
    if (ct && !ct.multiY && config.yAxis.length > 1) updateConfig({ chartType, yAxis: [config.yAxis[0]] });
    else updateConfig({ chartType });
    if (ct) showToast('info', `Chart type changed to ${ct.label}`);
  }, [config.yAxis, updateConfig]);

  const handleExportPDF = useCallback(async () => {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      showToast('error', 'Chart is not visible yet. Open the preview and try again.');
      return;
    }
    setIsExporting(true);
    try {
      const canvas = await html2canvas(chartRef.current, withHtml2CanvasColorFix({
        backgroundColor: '#0c0c14',
        scale: 2,
        useCORS: true,
        logging: false,
      }));
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width / 2, canvas.height / 2 + 80] });

      pdf.setFillColor(12, 12, 20);
      pdf.rect(0, 0, canvas.width / 2, canvas.height / 2 + 80, 'F');
      pdf.setFontSize(16);
      pdf.setTextColor(244, 244, 245);
      pdf.text(config.title || 'Chart Export', 30, 35);
      if (config.subtitle) { pdf.setFontSize(10); pdf.setTextColor(161, 161, 170); pdf.text(config.subtitle, 30, 52); }
      pdf.addImage(imgData, 'PNG', 15, 60, canvas.width / 2 - 30, canvas.height / 2 - 20);
      pdf.setFontSize(8); pdf.setTextColor(113, 113, 122);
      pdf.text(`Generated: ${new Date().toLocaleString()} · Merlin ERP`, 30, canvas.height / 2 + 70);
      pdf.save(`${config.title || 'chart'}-${Date.now()}.pdf`);
      showToast('success', 'Chart exported to PDF');
    } catch (error) {
      console.error('Export failed:', error);
      showToast('error', 'Failed to export PDF');
    }
    finally { setIsExporting(false); }
  }, [config.title, config.subtitle]);

  const handleSave = useCallback(() => {
    const saved = JSON.parse(localStorage.getItem('merlin_charts') || '[]');
    const idx = saved.findIndex((c: any) => c.id === config.id);
    if (idx >= 0) saved[idx] = config; else saved.push(config);
    localStorage.setItem('merlin_charts', JSON.stringify(saved));
    setSavedMessage('Chart saved successfully!');
    showToast('success', 'Chart saved successfully');
    setTimeout(() => setSavedMessage(''), 3000);
  }, [config]);

  const handleReset = useCallback(() => {
    setConfig({
      id: `chart-${Date.now()}`, title: '', subtitle: '', chartType: 'bar',
      dataSource: 'salesByMonth', xAxis: 'month', yAxis: ['revenue'], aggregation: 'none',
      style: { colorScheme: 'violet', showGrid: true, showLegend: true, legendPosition: 'bottom', showTooltip: true, showLabels: false, numberFormat: 'compact', curveType: 'monotone', fillOpacity: 0.85, strokeWidth: 2, borderRadius: 6, gradientFill: true, animationEnabled: true },
    });
    showToast('info', 'Chart configuration reset');
  }, []);

  const steps = [
    { label: 'Data Source', icon: 'database' },
    { label: 'Configure', icon: 'sliders' },
    { label: 'Customize', icon: 'palette' },
    { label: 'Export', icon: 'download' },
  ];

  const currentStep = useMemo(() => {
    if (!config.dataSource) return 0;
    if (config.yAxis.length === 0) return 1;
    return 2;
  }, [config.dataSource, config.yAxis]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-[22px] font-bold text-zinc-50 tracking-[-0.03em] leading-tight">Chart Builder</h2>
            <span className="px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-[9px] font-bold text-violet-400 uppercase tracking-wide">Beta</span>
          </div>
          <p className="text-[13px] text-zinc-500 leading-relaxed">Create, customize, and export data visualizations</p>
        </div>
        <div className="flex items-center gap-2">
          {steps.map((step, index) => (
            <React.Fragment key={step.label}>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-300 ${index === currentStep ? 'bg-violet-500/15 border border-violet-500/30 text-violet-300' : index < currentStep ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-white/[0.02] border border-white/[0.06] text-zinc-600'}`}>
                <IconComponent name={index < currentStep ? 'check' : step.icon} className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold hidden sm:block">{step.label}</span>
              </div>
              {index < steps.length - 1 && <div className={`w-6 h-px ${index < currentStep ? 'bg-emerald-500/30' : 'bg-white/[0.06]'}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Saved Message */}
      <AnimatePresence>
        {savedMessage && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[12px] font-semibold">
            <IconComponent name="check" className="w-4 h-4" />{savedMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Layout */}
      <div className="flex flex-col xl:flex-row gap-5">
        {/* Left Panel - Configuration */}
        <motion.div layout className={`${showFullPreview ? 'hidden' : 'w-full xl:w-[380px]'} flex-shrink-0 space-y-4`}>
          {/* Config Tabs */}
          <div className="flex items-center gap-1 p-1 bg-white/[0.02] border border-white/[0.06] rounded-xl">
            {([
              { id: 'data' as const, label: 'Data', icon: 'database' },
              { id: 'style' as const, label: 'Style', icon: 'palette' },
              { id: 'advanced' as const, label: 'Advanced', icon: 'settings' },
            ]).map((tab) => (
              <button key={tab.id} onClick={() => setActiveConfigTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all duration-200 ${activeConfigTab === tab.id ? 'bg-violet-500/[0.12] text-violet-300 border border-violet-500/20' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'}`}>
                <IconComponent name={tab.icon} className="w-3.5 h-3.5" />{tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeConfigTab === 'data' && (
              <motion.div key="data" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
                <CollapsibleSection title="Data Source" icon="database">
                  <div className="space-y-2 mt-2">
                    {Object.entries(DATA_SOURCES).map(([key, source]) => (
                      <motion.button key={key} onClick={() => handleDataSourceChange(key)} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 ${config.dataSource === key ? 'bg-violet-500/[0.08] border-violet-500/25 ring-1 ring-violet-500/15' : 'bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03] hover:border-white/[0.1]'}`}>
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${config.dataSource === key ? 'bg-violet-500/15' : 'bg-white/[0.03]'}`}>
                          <IconComponent name={source.icon} className={`w-4 h-4 ${config.dataSource === key ? 'text-violet-400' : 'text-zinc-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[12px] font-semibold ${config.dataSource === key ? 'text-zinc-200' : 'text-zinc-400'}`}>{source.label}</p>
                          <p className="text-[10px] text-zinc-600 truncate">{source.description}</p>
                        </div>
                        {config.dataSource === key && <IconComponent name="check" className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />}
                      </motion.button>
                    ))}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Chart Type" icon="layers">
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {CHART_TYPES.map((ct) => (
                      <motion.button key={ct.id} onClick={() => handleChartTypeChange(ct.id)} whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 ${config.chartType === ct.id ? 'bg-violet-500/[0.1] border-violet-500/30 ring-1 ring-violet-500/15' : 'bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03]'}`}>
                        <IconComponent name={ct.icon} className={`w-5 h-5 ${config.chartType === ct.id ? 'text-violet-400' : 'text-zinc-600'}`} />
                        <span className={`text-[10px] font-semibold ${config.chartType === ct.id ? 'text-violet-300' : 'text-zinc-500'}`}>{ct.label}</span>
                      </motion.button>
                    ))}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Axes" icon="sliders">
                  <div className="space-y-4 mt-2">
                    <BuilderSelect label="X-Axis (Category)" value={config.xAxis} onChange={(val) => updateConfig({ xAxis: val })}
                      options={allFields.map(f => ({ value: f.key, label: f.label }))} icon="chevron-right" />
                    {currentChartType?.multiY ? (
                      <MultiSelect label="Y-Axis (Values)" values={config.yAxis} onChange={(vals) => updateConfig({ yAxis: vals })}
                        options={numericFields.map(f => ({ value: f.key, label: f.label }))} maxSelect={6} />
                    ) : (
                      <BuilderSelect label="Y-Axis (Value)" value={config.yAxis[0] || ''} onChange={(val) => updateConfig({ yAxis: [val] })}
                        options={numericFields.map(f => ({ value: f.key, label: f.label }))} icon="chevron-right" />
                    )}
                    <BuilderSelect label="Aggregation" value={config.aggregation} onChange={(val) => updateConfig({ aggregation: val as AggregationType })}
                      options={[
                        { value: 'none', label: 'No Aggregation', description: 'Use raw data values' },
                        { value: 'sum', label: 'Sum', description: 'Total of all values' },
                        { value: 'average', label: 'Average', description: 'Mean of all values' },
                        { value: 'count', label: 'Count', description: 'Number of records' },
                        { value: 'min', label: 'Minimum', description: 'Lowest value' },
                        { value: 'max', label: 'Maximum', description: 'Highest value' },
                      ]} />
                  </div>
                </CollapsibleSection>
              </motion.div>
            )}

            {activeConfigTab === 'style' && (
              <motion.div key="style" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
                <CollapsibleSection title="Titles & Labels" icon="type">
                  <div className="space-y-3 mt-2">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em] mb-1.5 block">Chart Title</label>
                      <input type="text" value={config.title} onChange={(e) => updateConfig({ title: e.target.value })} placeholder="Enter chart title..."
                        className="w-full bg-white/[0.02] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-[13px] text-zinc-200 outline-none focus:border-violet-500/30 focus:ring-2 focus:ring-violet-500/10 transition-all placeholder:text-zinc-600 font-medium" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em] mb-1.5 block">Subtitle</label>
                      <input type="text" value={config.subtitle} onChange={(e) => updateConfig({ subtitle: e.target.value })} placeholder="Enter subtitle..."
                        className="w-full bg-white/[0.02] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-[13px] text-zinc-200 outline-none focus:border-violet-500/30 focus:ring-2 focus:ring-violet-500/10 transition-all placeholder:text-zinc-600 font-medium" />
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Color Scheme" icon="palette">
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {Object.entries(COLOR_SCHEMES).map(([key, scheme]) => (
                      <motion.button key={key} onClick={() => updateStyle({ colorScheme: key })} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-200 ${config.style.colorScheme === key ? 'bg-violet-500/[0.08] border-violet-500/25 ring-1 ring-violet-500/15' : 'bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03]'}`}>
                        <div className="flex items-center gap-0.5">
                          {scheme.colors.slice(0, 4).map((color, i) => <div key={i} className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: color }} />)}
                        </div>
                        <span className={`text-[10px] font-semibold ${config.style.colorScheme === key ? 'text-violet-300' : 'text-zinc-500'}`}>{scheme.name}</span>
                      </motion.button>
                    ))}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Number Format" icon="type" defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      { value: 'number', label: '1,234', desc: 'Standard' },
                      { value: 'currency', label: '$1,234', desc: 'Currency' },
                      { value: 'percent', label: '12%', desc: 'Percentage' },
                      { value: 'compact', label: '1.2K', desc: 'Compact' },
                    ].map((fmt) => (
                      <button key={fmt.value} onClick={() => updateStyle({ numberFormat: fmt.value as any })}
                        className={`p-2.5 rounded-xl border text-center transition-all duration-200 ${config.style.numberFormat === fmt.value ? 'bg-violet-500/[0.08] border-violet-500/25 ring-1 ring-violet-500/15' : 'bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03]'}`}>
                        <p className={`text-[14px] font-bold ${config.style.numberFormat === fmt.value ? 'text-violet-300' : 'text-zinc-400'}`}>{fmt.label}</p>
                        <p className="text-[9px] text-zinc-600 mt-0.5">{fmt.desc}</p>
                      </button>
                    ))}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Display Options" icon="eye" defaultOpen={false}>
                  <div className="space-y-2 mt-2">
                    <Toggle label="Show Grid Lines" checked={config.style.showGrid} onChange={(v) => updateStyle({ showGrid: v })} />
                    <Toggle label="Show Legend" checked={config.style.showLegend} onChange={(v) => updateStyle({ showLegend: v })} />
                    <Toggle label="Show Tooltips" checked={config.style.showTooltip} onChange={(v) => updateStyle({ showTooltip: v })} />
                    <Toggle label="Show Labels" checked={config.style.showLabels} onChange={(v) => updateStyle({ showLabels: v })} />
                    <Toggle label="Gradient Fill" checked={config.style.gradientFill} onChange={(v) => updateStyle({ gradientFill: v })} />
                    <Toggle label="Animations" checked={config.style.animationEnabled} onChange={(v) => updateStyle({ animationEnabled: v })} />
                  </div>
                </CollapsibleSection>
              </motion.div>
            )}

            {activeConfigTab === 'advanced' && (
              <motion.div key="advanced" initial={{ opacity: 0, x:  -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
                <CollapsibleSection title="Chart Dimensions" icon="maximize">
                  <div className="space-y-3 mt-2">
                    <Slider label="Fill Opacity" value={Math.round(config.style.fillOpacity * 100)} onChange={(v) => updateStyle({ fillOpacity: v / 100 })} min={10} max={100} step={5} unit="%" />
                    <Slider label="Stroke Width" value={config.style.strokeWidth} onChange={(v) => updateStyle({ strokeWidth: v })} min={1} max={5} step={0.5} unit="px" />
                    <Slider label="Border Radius" value={config.style.borderRadius} onChange={(v) => updateStyle({ borderRadius: v })} min={0} max={20} step={1} unit="px" />
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Curve Type" icon="activity" defaultOpen={false}>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[
                      { value: 'linear', label: 'Linear' },
                      { value: 'monotone', label: 'Smooth' },
                      { value: 'step', label: 'Step' },
                    ].map((curve) => (
                      <button key={curve.value} onClick={() => updateStyle({ curveType: curve.value as any })}
                        className={`p-2.5 rounded-xl border text-center transition-all duration-200 ${config.style.curveType === curve.value ? 'bg-violet-500/[0.08] border-violet-500/25 ring-1 ring-violet-500/15' : 'bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03]'}`}>
                        <p className={`text-[11px] font-semibold ${config.style.curveType === curve.value ? 'text-violet-300' : 'text-zinc-500'}`}>{curve.label}</p>
                      </button>
                    ))}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Legend Position" icon="layout" defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      { value: 'top', label: 'Top' },
                      { value: 'bottom', label: 'Bottom' },
                      { value: 'left', label: 'Left' },
                      { value: 'right', label: 'Right' },
                    ].map((pos) => (
                      <button key={pos.value} onClick={() => updateStyle({ legendPosition: pos.value as any })}
                        className={`p-2.5 rounded-xl border text-center transition-all duration-200 ${config.style.legendPosition === pos.value ? 'bg-violet-500/[0.08] border-violet-500/25 ring-1 ring-violet-500/15' : 'bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03]'}`}>
                        <p className={`text-[11px] font-semibold ${config.style.legendPosition === pos.value ? 'text-violet-300' : 'text-zinc-500'}`}>{pos.label}</p>
                      </button>
                    ))}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Data Preview" icon="database" defaultOpen={false}>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          {allFields.slice(0, 5).map((field) => (
                            <th key={field.key} className="text-left px-2 py-2 text-zinc-500 font-bold uppercase tracking-wider">{field.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {currentData.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-b border-white/[0.03]">
                            {allFields.slice(0, 5).map((field) => (
                              <td key={field.key} className="px-2 py-1.5 text-zinc-400 font-medium">
                                {field.type === 'number' ? formatChartNumber(row[field.key], config.style.numberFormat) : row[field.key]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {currentData.length > 5 && (
                      <p className="text-[10px] text-zinc-600 mt-2 text-center">...and {currentData.length - 5} more rows</p>
                    )}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Actions" icon="zap" defaultOpen={true}>
                  <div className="space-y-2 mt-2">
                    <motion.button onClick={handleReset} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] text-zinc-400 hover:text-zinc-300 transition-all text-[12px] font-semibold">
                      <IconComponent name="refresh" className="w-3.5 h-3.5" />
                      Reset Configuration
                    </motion.button>
                    <motion.button onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
                        setSavedMessage('Config copied to clipboard!');
                        showToast('success', 'Config copied to clipboard');
                        setTimeout(() => setSavedMessage(''), 3000);
                      } catch (error) {
                        console.error('Copy failed:', error);
                        showToast('error', 'Unable to copy config');
                      }
                    }}
                      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] text-zinc-400 hover:text-zinc-300 transition-all text-[12px] font-semibold">
                      <IconComponent name="copy" className="w-3.5 h-3.5" />
                      Copy Config JSON
                    </motion.button>
                  </div>
                </CollapsibleSection>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Right Panel - Preview */}
        <motion.div layout className="flex-1 space-y-4 min-w-0">
          {/* Preview Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-[14px] font-bold text-zinc-200">Preview</h3>
              <Badge variant="info" dot>{config.chartType.toUpperCase()}</Badge>
              {currentDataSource && <Badge variant="default">{currentData.length} rows</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <motion.button onClick={() => setShowFullPreview(!showFullPreview)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className="w-8 h-8 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-all"
                title={showFullPreview ? 'Show config panel' : 'Full preview'}>
                <IconComponent name={showFullPreview ? 'minimize' : 'maximize'} className="w-3.5 h-3.5" />
              </motion.button>
              <motion.button onClick={handleSave} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 hover:bg-violet-500/15 text-violet-300 text-[11px] font-semibold transition-all">
                <IconComponent name="save" className="w-3.5 h-3.5" />Save
              </motion.button>
              <motion.button onClick={handleExportPDF} disabled={isExporting} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${isExporting ? 'border-white/[0.06] bg-white/[0.02] text-zinc-600 cursor-not-allowed' : 'border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-300'}`}>
                {isExporting ? (
                  <><motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                  </motion.div>Exporting...</>
                ) : (
                  <><IconComponent name="download" className="w-3.5 h-3.5" />Export PDF</>
                )}
              </motion.button>
            </div>
          </div>

          {/* Chart Preview Card */}
          <Card padding="p-0" className="overflow-hidden">
            <div ref={chartRef}>
              {/* Chart Title Area */}
              {(config.title || config.subtitle) && (
                <div className="px-6 pt-6 pb-2">
                  {config.title && <h3 className="text-[16px] font-bold text-zinc-100 tracking-[-0.02em]">{config.title}</h3>}
                  {config.subtitle && <p className="text-[12px] text-zinc-500 mt-1">{config.subtitle}</p>}
                </div>
              )}

              {/* Chart Area */}
              <div className={`px-4 pb-4 ${config.title || config.subtitle ? 'pt-2' : 'pt-6'}`} style={{ height: config.chartType === 'kpi' ? 'auto' : showFullPreview ? '600px' : '420px' }}>
                <ChartPreview config={config} data={currentData} />
              </div>
            </div>

            {/* Chart Footer */}
            <div className="px-6 py-3 border-t border-white/[0.04] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <IconComponent name="database" className="w-3 h-3 text-zinc-600" />
                  <span className="text-[10px] text-zinc-600 font-medium">{currentDataSource?.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <IconComponent name="layers" className="w-3 h-3 text-zinc-600" />
                  <span className="text-[10px] text-zinc-600 font-medium">{config.yAxis.length} metric{config.yAxis.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <IconComponent name="clock" className="w-3 h-3 text-zinc-600" />
                <span className="text-[10px] text-zinc-600 font-medium">Live preview</span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
              </div>
            </div>
          </Card>

          {/* Quick Stats */}
          {config.yAxis.length > 0 && currentData.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {config.yAxis.slice(0, 4).map((field, i) => {
                const values = currentData.map(d => Number(d[field]) || 0);
                const total = values.reduce((a, b) => a + b, 0);
                const avg = total / values.length;
                const fieldLabel = allFields.find(f => f.key === field)?.label || field;
                const colors = COLOR_SCHEMES[config.style.colorScheme]?.colors || COLOR_SCHEMES.violet.colors;

                return (
                  <Card key={field} padding="p-4" className="relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: colors[i % colors.length] + '40' }} />
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.1em]">{fieldLabel}</p>
                    <p className="text-[18px] font-bold text-zinc-100 tracking-[-0.03em] mt-1">{formatChartNumber(total, config.style.numberFormat)}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">Avg: {formatChartNumber(avg, config.style.numberFormat)}</p>
                  </Card>
                );
              })}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ─── Placeholder Pages ──────────────────────────────────────────────────────

function PermissionsPage() {
  type PermissionStatus = 'granted' | 'pending' | 'denied';
  type ChartScope = 'warehouse' | 'sales' | 'company';

  const permissionStates: PermissionStatus[] = ['granted', 'pending', 'denied'];
  const [people, setPeople] = useState([
    {
      id: 'sarah',
      name: 'Sarah Chen',
      role: 'Operations Manager',
      chartAccess: { warehouse: 'granted', sales: 'pending', company: 'granted' } as Record<ChartScope, PermissionStatus>,
    },
    {
      id: 'james',
      name: 'James Wilson',
      role: 'Sales Lead',
      chartAccess: { warehouse: 'denied', sales: 'granted', company: 'granted' } as Record<ChartScope, PermissionStatus>,
    },
    {
      id: 'maria',
      name: 'Maria Garcia',
      role: 'Warehouse Analyst',
      chartAccess: { warehouse: 'granted', sales: 'denied', company: 'pending' } as Record<ChartScope, PermissionStatus>,
    },
    {
      id: 'emma',
      name: 'Emma Thompson',
      role: 'Customer Success',
      chartAccess: { warehouse: 'pending', sales: 'granted', company: 'granted' } as Record<ChartScope, PermissionStatus>,
    },
  ]);

  const chartLabels: Record<ChartScope, string> = {
    warehouse: 'Warehouse Charts',
    sales: 'Sales Charts',
    company: 'Company Charts',
  };

  const [selectedPersonId, setSelectedPersonId] = useState(people[0].id);
  const selectedPerson = people.find((person) => person.id === selectedPersonId) || people[0];
  const editablePermissionScopeById: Record<number, ChartScope> = {
    4: 'warehouse',
    5: 'sales',
    6: 'company',
  };

  const updatePersonPermission = useCallback((personId: string, scope: ChartScope, status: PermissionStatus) => {
    setPeople((currentPeople) => currentPeople.map((person) => {
      if (person.id !== personId || person.chartAccess[scope] === status) return person;
      return {
        ...person,
        chartAccess: { ...person.chartAccess, [scope]: status },
      };
    }));
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    showToast('success', `${scope.charAt(0).toUpperCase() + scope.slice(1)} permission set to ${statusLabel}`);
  }, []);

  const permissions = [
    { id: 1, name: 'Dashboard Access', description: 'View and interact with dashboards', status: 'granted' as PermissionStatus, scope: 'All dashboards', grantedBy: 'Admin', grantedDate: '2024-01-15' },
    { id: 2, name: 'Chart Creation', description: 'Create and edit custom charts', status: 'granted' as PermissionStatus, scope: 'Personal workspace', grantedBy: 'Admin', grantedDate: '2024-01-15' },
    { id: 3, name: 'Data Export', description: 'Export data in various formats', status: 'pending' as PermissionStatus, scope: 'CSV, PDF, Excel', grantedBy: '-', grantedDate: '-' },
    {
      id: 4,
      name: chartLabels.warehouse,
      description: `Access for ${selectedPerson.name} to warehouse dashboards and charts`,
      status: selectedPerson.chartAccess.warehouse,
      scope: 'Warehouse',
      grantedBy: selectedPerson.chartAccess.warehouse === 'granted' ? 'Admin' : '-',
      grantedDate: selectedPerson.chartAccess.warehouse === 'granted' ? '2024-02-01' : '-',
    },
    {
      id: 5,
      name: chartLabels.sales,
      description: `Access for ${selectedPerson.name} to sales dashboards and charts`,
      status: selectedPerson.chartAccess.sales,
      scope: 'Sales',
      grantedBy: selectedPerson.chartAccess.sales === 'granted' ? 'Admin' : '-',
      grantedDate: selectedPerson.chartAccess.sales === 'granted' ? '2024-02-01' : '-',
    },
    {
      id: 6,
      name: chartLabels.company,
      description: `Access for ${selectedPerson.name} to company dashboards and charts`,
      status: selectedPerson.chartAccess.company,
      scope: 'Company',
      grantedBy: selectedPerson.chartAccess.company === 'granted' ? 'Admin' : '-',
      grantedDate: selectedPerson.chartAccess.company === 'granted' ? '2024-02-01' : '-',
    },
  ];

  const chartStatusCards = (Object.keys(chartLabels) as ChartScope[]).map((scope) => ({
    scope,
    label: chartLabels[scope],
    status: selectedPerson.chartAccess[scope],
  }));

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={staggerItem}>
        <SectionHeader title="Permissions" description="View your access rights and request additional permissions" />
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card padding="p-5">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em]">Select Person</p>
              <p className="text-[13px] text-zinc-500 mt-1">Choose a user to preview chart permissions for warehouse, sales, and company dashboards.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {people.map((person) => {
                const isSelected = person.id === selectedPerson.id;
                return (
                  <motion.button
                    key={person.id}
                    onClick={() => setSelectedPersonId(person.id)}
                    whileTap={{ scale: 0.98 }}
                    className={`text-left p-3 rounded-xl border transition-all duration-200 ${isSelected ? 'bg-violet-500/[0.10] border-violet-500/30 ring-1 ring-violet-500/20' : 'bg-white/[0.01] border-white/[0.06] hover:bg-white/[0.03] hover:border-white/[0.10]'}`}
                  >
                    <p className={`text-[12px] font-semibold ${isSelected ? 'text-zinc-100' : 'text-zinc-300'}`}>{person.name}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{person.role}</p>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Granted', count: permissions.filter(p => p.status === 'granted').length, variant: 'success' as const, icon: 'check' },
          { label: 'Pending', count: permissions.filter(p => p.status === 'pending').length, variant: 'warning' as const, icon: 'clock' },
          { label: 'Denied', count: permissions.filter(p => p.status === 'denied').length, variant: 'danger' as const, icon: 'x' },
        ].map((stat) => (
          <Card key={stat.label} padding="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em]">{stat.label}</p>
                <p className="text-[28px] font-bold text-zinc-100 tracking-[-0.04em] mt-1">{stat.count}</p>
              </div>
              <Badge variant={stat.variant} dot pulse={stat.variant === 'warning'}>{stat.label}</Badge>
            </div>
          </Card>
        ))}
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {chartStatusCards.map((chartAccess) => (
          <Card key={chartAccess.scope} padding="p-5">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em]">{chartAccess.label}</p>
            <div className="mt-3">
              <Badge
                variant={
                  chartAccess.status === 'granted'
                    ? 'success'
                    : chartAccess.status === 'pending'
                      ? 'warning'
                      : 'danger'
                }
                dot
                pulse={chartAccess.status === 'pending'}
              >
                {chartAccess.status.charAt(0).toUpperCase() + chartAccess.status.slice(1)}
              </Badge>
            </div>
            <p className="text-[11px] text-zinc-500 mt-3">Current view for {selectedPerson.name}</p>
          </Card>
        ))}
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card padding="p-5">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em]">Edit User Permissions</p>
              <p className="text-[13px] text-zinc-500 mt-1">Update chart access for {selectedPerson.name}.</p>
            </div>
            <div className="space-y-3">
              {(Object.keys(chartLabels) as ChartScope[]).map((scope) => (
                <div key={scope} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-xl border border-white/[0.06] bg-white/[0.01]">
                  <p className="text-[12px] font-semibold text-zinc-300">{chartLabels[scope]}</p>
                  <div className="inline-flex rounded-lg border border-white/[0.08] bg-black/20 p-1">
                    {permissionStates.map((status) => {
                      const isActive = selectedPerson.chartAccess[scope] === status;
                      return (
                        <button
                          key={status}
                          onClick={() => updatePersonPermission(selectedPerson.id, scope, status)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${isActive ? 'bg-violet-500/20 text-violet-300 border border-violet-500/25' : 'text-zinc-400 hover:text-zinc-200'}`}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Table headers={['Permission', 'Scope', 'Status', 'Granted By', 'Date']}>
          {permissions.map((perm) => (
            <TableRow key={perm.id}>
              <td className="px-5 py-4">
                <p className="text-[13px] font-semibold text-zinc-200">{perm.name}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{perm.description}</p>
              </td>
              <td className="px-5 py-4 text-[12px] text-zinc-400 font-medium">{perm.scope}</td>
              <td className="px-5 py-4">
                {editablePermissionScopeById[perm.id] ? (
                  <select
                    value={perm.status}
                    onChange={(e) => updatePersonPermission(selectedPerson.id, editablePermissionScopeById[perm.id], e.target.value as PermissionStatus)}
                    className="bg-zinc-900/80 border border-white/[0.10] rounded-lg text-[12px] text-zinc-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                  >
                    {permissionStates.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge variant={perm.status === 'granted' ? 'success' : perm.status === 'pending' ? 'warning' : 'danger'} dot pulse={perm.status === 'pending'}>
                    {perm.status.charAt(0).toUpperCase() + perm.status.slice(1)}
                  </Badge>
                )}
              </td>
              <td className="px-5 py-4 text-[12px] text-zinc-400 font-medium">{perm.grantedBy}</td>
              <td className="px-5 py-4 text-[12px] text-zinc-500 font-medium">{perm.grantedDate}</td>
            </TableRow>
          ))}
        </Table>
      </motion.div>
    </motion.div>
  );
}

function CreateDocumentPage() {
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState('report');
  const handleCreateDocument = useCallback(() => {
    if (!docTitle.trim()) {
      showToast('error', 'Enter a document title first');
      return;
    }
    showToast('success', `${docType.charAt(0).toUpperCase() + docType.slice(1)} created`);
    setDocTitle('');
  }, [docTitle, docType]);

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={staggerItem}>
        <SectionHeader title="Create Document" description="Generate reports, invoices, and custom documents" />
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="p-6">
          <h3 className="text-[14px] font-bold text-zinc-200 mb-4">Document Details</h3>
          <div className="space-y-4">
            <Input placeholder="Document title..." icon="type" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
            <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em] mb-2 block">Document Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'report', label: 'Report', icon: 'file-plus', desc: 'Data analysis report' },
                  { value: 'invoice', label: 'Invoice', icon: 'file-plus', desc: 'Billing document' },
                  { value: 'proposal', label: 'Proposal', icon: 'file-plus', desc: 'Business proposal' },
                  { value: 'summary', label: 'Summary', icon: 'file-plus', desc: 'Executive summary' },
                ].map((type) => (
                  <motion.button key={type.value} onClick={() => setDocType(type.value)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${docType === type.value ? 'bg-violet-500/[0.08] border-violet-500/25 ring-1 ring-violet-500/15' : 'bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03]'}`}>
                    <IconComponent name={type.icon} className={`w-4 h-4 ${docType === type.value ? 'text-violet-400' : 'text-zinc-600'}`} />
                    <div>
                      <p className={`text-[12px] font-semibold ${docType === type.value ? 'text-zinc-200' : 'text-zinc-400'}`}>{type.label}</p>
                      <p className="text-[10px] text-zinc-600">{type.desc}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
            <div className="pt-2">
              <AppButton variant="primary" icon="file-plus" roleConfig={ROLE_CONFIG.customer} onClick={handleCreateDocument}>Create Document</AppButton>
            </div>
          </div>
        </Card>

        <Card padding="p-6">
          <h3 className="text-[14px] font-bold text-zinc-200 mb-4">Recent Documents</h3>
          <div className="space-y-3">
            {[
              { name: 'Q4 Sales Report', type: 'Report', date: 'Dec 15, 2024', status: 'completed' },
              { name: 'Invoice #1234', type: 'Invoice', date: 'Dec 12, 2024', status: 'completed' },
              { name: 'Annual Summary', type: 'Summary', date: 'Dec 10, 2024', status: 'draft' },
            ].map((doc, i) => (
              <motion.div key={i} whileHover={{ x: 2 }} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.05] hover:border-white/[0.1] bg-white/[0.01] hover:bg-white/[0.02] transition-all cursor-pointer">
                <div className="w-9 h-9 rounded-lg bg-white/[0.03] flex items-center justify-center">
                  <IconComponent name="file-plus" className="w-4 h-4 text-zinc-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-zinc-300">{doc.name}</p>
                  <p className="text-[10px] text-zinc-600">{doc.type} · {doc.date}</p>
                </div>
                <Badge variant={doc.status === 'completed' ? 'success' : 'warning'} dot>{doc.status}</Badge>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function ChartDesignerPage() {
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={staggerItem}>
        <SectionHeader title="Chart Designer" description="Design and manage chart templates for the organization"
          action={<AppButton variant="primary" icon="plus" roleConfig={ROLE_CONFIG.admin} onClick={() => showToast('info', 'Template editor opening soon')}>New Template</AppButton>} />
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Templates', count: 12, icon: 'layers', color: 'emerald' },
          { label: 'Active Charts', count: 48, icon: 'bar-chart', color: 'emerald' },
          { label: 'Data Sources', count: 5, icon: 'database', color: 'emerald' },
        ].map((stat) => (
          <Card key={stat.label} padding="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <IconComponent name={stat.icon} className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em]">{stat.label}</p>
                <p className="text-[24px] font-bold text-zinc-100 tracking-[-0.04em]">{stat.count}</p>
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card padding="p-6">
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <IconComponent name="pen-tool" className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-[16px] font-bold text-zinc-200">Chart Template Designer</p>
              <p className="text-[13px] text-zinc-500 mt-1 max-w-md">Create reusable chart templates that can be shared across the organization. Define data bindings, styles, and layouts.</p>
            </div>
            <AppButton variant="primary" icon="plus" roleConfig={ROLE_CONFIG.admin} onClick={() => showToast('info', 'Template editor opening soon')}>Create First Template</AppButton>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

function AccountsManagementPage() {
  const accounts = [
    { id: 1, name: 'Sarah Chen', email: 'sarah@company.com', role: 'Admin', status: 'active', lastLogin: '2 hours ago' },
    { id: 2, name: 'James Wilson', email: 'james@company.com', role: 'Customer', status: 'active', lastLogin: '5 hours ago' },
    { id: 3, name: 'Maria Garcia', email: 'maria@company.com', role: 'Customer', status: 'active', lastLogin: '1 day ago' },
    { id: 4, name: 'David Kim', email: 'david@company.com', role: 'Admin', status: 'inactive', lastLogin: '5 days ago' },
    { id: 5, name: 'Emma Thompson', email: 'emma@company.com', role: 'Customer', status: 'active', lastLogin: '3 hours ago' },
  ];

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={staggerItem}>
        <SectionHeader title="Accounts Management" description="Manage user accounts, roles, and access"
          action={<AppButton variant="primary" icon="plus" roleConfig={ROLE_CONFIG.admin} onClick={() => showToast('info', 'User invite flow opening soon')}>Add User</AppButton>} />
      </motion.div>

      <motion.div variants={staggerItem} className="flex items-center gap-3">
        <Input placeholder="Search users..." icon="search" className="flex-1 max-w-xs" accentColor="emerald" />
        <AppButton variant="secondary" icon="sliders" onClick={() => showToast('info', 'Advanced filters coming soon')}>Filters</AppButton>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Table headers={['User', 'Role', 'Status', 'Last Login', 'Actions']}>
          {accounts.map((account) => (
            <TableRow key={account.id}>
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center text-[11px] font-bold text-emerald-400">
                    {account.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-zinc-200">{account.name}</p>
                    <p className="text-[11px] text-zinc-500">{account.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4"><Badge variant={account.role === 'Admin' ? 'info' : 'default'}>{account.role}</Badge></td>
              <td className="px-5 py-4"><Badge variant={account.status === 'active' ? 'success' : 'warning'} dot pulse={account.status === 'active'}>{account.status}</Badge></td>
              <td className="px-5 py-4 text-[12px] text-zinc-500 font-medium">{account.lastLogin}</td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-1">
                  <AppButton variant="ghost" size="sm" icon="settings" onClick={() => showToast('info', `Editing ${account.name}`)}>Edit</AppButton>
                </div>
              </td>
            </TableRow>
          ))}
        </Table>
      </motion.div>
    </motion.div>
  );
}

function DocumentDesignerPage() {
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={staggerItem}>
        <SectionHeader title="Document Designer" description="Create and manage document templates"
          action={<AppButton variant="primary" icon="plus" roleConfig={ROLE_CONFIG.admin} onClick={() => showToast('info', 'Document template editor opening soon')}>New Template</AppButton>} />
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { name: 'Invoice Template', type: 'Invoice', lastModified: 'Dec 15, 2024', uses: 234 },
          { name: 'Sales Report', type: 'Report', lastModified: 'Dec 12, 2024', uses: 89 },
          { name: 'Quarterly Summary', type: 'Summary', lastModified: 'Dec 10, 2024', uses: 45 },
          { name: 'Project Proposal', type: 'Proposal', lastModified: 'Dec 8, 2024', uses: 67 },
          { name: 'Expense Report', type: 'Report', lastModified: 'Dec 5, 2024', uses: 156 },
          { name: 'Client Brief', type: 'Proposal', lastModified: 'Dec 3, 2024', uses: 23 },
        ].map((template, i) => (
          <Card key={i} hover padding="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <IconComponent name="layout" className="w-5 h-5 text-emerald-400" />
              </div>
              <Badge variant="default">{template.type}</Badge>
            </div>
            <h4 className="text-[14px] font-bold text-zinc-200">{template.name}</h4>
            <p className="text-[11px] text-zinc-500 mt-1">Last modified: {template.lastModified}</p>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.04]">
              <span className="text-[10px] text-zinc-600 font-medium">{template.uses} uses</span>
              <AppButton variant="ghost" size="sm" icon="pen-tool" onClick={() => showToast('info', `Editing ${template.name}`)}>Edit</AppButton>
            </div>
          </Card>
        ))}
      </motion.div>
    </motion.div>
  );
}

// ─── Main Layout ─────────────────────────────────────────────────────────────

function MainLayout({ user, onLogout }: { user: User; onLogout: () => void }) {
  const role = user.role!;
  const roleConfig = ROLE_CONFIG[role];
  const navItems = role === 'customer' ? CUSTOMER_NAV : ADMIN_NAV;
  const [activeTab, setActiveTab] = useState(navItems[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarVisible, setDesktopSidebarVisible] = useState(false);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    const selectedTab = navItems.find((item) => item.id === tab);
    if (selectedTab) showToast('info', `Switched to ${selectedTab.label}`);
  }, [navItems]);

  const renderContent = () => {
    switch (activeTab) {
      // Customer pages
      case 'dashboard': return <DashboardPage />;
      case 'chart-creator': return <ChartBuilderPage />;
      case 'permissions': return <PermissionsPage />;
      case 'create-document': return <CreateDocumentPage />;
      // Admin pages
      case 'chart-designer': return <ChartDesignerPage />;
      case 'accounts': return <AccountsManagementPage />;
      case 'document-designer': return <DocumentDesignerPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: 'linear-gradient(180deg, #07070a 0%, #0a0a10 40%, #07070a 100%)' }}>
      <div
        className="hidden lg:block fixed top-0 left-0 h-screen w-4 z-40"
        onMouseEnter={() => setDesktopSidebarVisible(true)}
        aria-hidden="true"
      />
      <Sidebar
        user={user}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onLogout={onLogout}
        navItems={navItems}
        roleConfig={roleConfig}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        desktopSidebarVisible={desktopSidebarVisible}
        onDesktopSidebarVisibilityChange={setDesktopSidebarVisible}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04] bg-[#08080c]/80 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden w-9 h-9 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition-all">
              <IconComponent name="menu" className="w-4 h-4" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-[12px] text-zinc-600">
              <span className="font-medium">Merlin</span>
              <IconComponent name="chevron-right" className="w-3 h-3" />
              <span className={`font-semibold ${roleConfig.text}`}>{navItems.find(n => n.id === activeTab)?.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <motion.button onClick={() => showToast('info', 'No new notifications')}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="w-9 h-9 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] transition-all relative">
              <IconComponent name="bell" className="w-4 h-4" />
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-violet-500 border border-[#08080c]" />
            </motion.button>
            <motion.button onClick={() => showToast('info', 'Command palette shortcut: Cmd/Ctrl + K')}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="w-9 h-9 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] transition-all">
              <IconComponent name="command" className="w-4 h-4" />
            </motion.button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-7 relative">
          <GridBackground />
          <div className="relative z-10 max-w-[1400px] mx-auto">
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} {...pageTransition}>
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── App Root ────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  const handleLogin = useCallback((loggedInUser: User) => {
    setUser(loggedInUser);
    showToast('success', `Welcome back, ${loggedInUser.name}`);
  }, []);
  const handleLogout = useCallback(() => {
    setUser(null);
    showToast('info', 'Signed out successfully');
  }, []);

  return (
    <>
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}>
            <LoginPage onLogin={handleLogin} />
          </motion.div>
        ) : (
          <motion.div key="main" initial={{ opacity: 0, scale: 1.01 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <MainLayout user={user} onLogout={handleLogout} />
          </motion.div>
        )}
      </AnimatePresence>
      <ToastContainer />
    </>
  );
}





