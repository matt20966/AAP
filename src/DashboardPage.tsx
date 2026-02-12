// DashboardPage.tsx - Fixed for embedding inside DashboardLayout

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { withHtml2CanvasColorFix } from './utils/html2canvasSafe';
import type {
  TimeRange,
  TabKey,
  WidgetConfig,
  DashboardSettings,
  WidgetColor,
} from './types/dashboard';
import {
  CHART_REGISTRY,
  getDashboardData,
  getDefaultLayout,
  WIDGET_CATALOG,
} from './data/dashboardData';
import GridLayout from './layouts/GridLayout';

// ─── Design Tokens ──────────────────────────────────────────────────

const tokens = {
  colors: {
    background: {
      primary: 'transparent',
      card: '#131316',
      cardHover: '#1a1a1f',
      elevated: '#18181b',
    },
    border: {
      subtle: 'rgba(255,255,255,0.06)',
      default: 'rgba(255,255,255,0.10)',
      strong: 'rgba(255,255,255,0.16)',
      accent: 'rgba(99,102,241,0.4)',
    },
    text: {
      primary: '#fafafa',
      secondary: '#b4b4bd',
      tertiary: '#8a8a96',
      muted: '#62626e',
    },
    accent: {
      primary: '#6366f1',
      secondary: '#8b5cf6',
      glow: 'rgba(99,102,241,0.15)',
    },
    chart: {
      background: '#131316',
      gridLine: 'rgba(255,255,255,0.06)',
      axisLabel: '#9ca3af',
      tooltip: '#1e1e24',
      tooltipBorder: 'rgba(255,255,255,0.12)',
    },
  },
  radius: {
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
  shadow: {
    card: '0 4px 24px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
  },
  transition: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    spring: { type: 'spring' as const, damping: 25, stiffness: 350, mass: 0.8 },
  },
};

// ─── Currency Formatter ─────────────────────────────────────────────

export function formatCurrency(
  value: number,
  currency: string = 'GBP',
  locale: string = 'en-GB',
  opts?: { compact?: boolean; decimals?: number },
): string {
  const { compact = false, decimals } = opts || {};

  if (compact) {
    const absValue = Math.abs(value);
    if (absValue >= 1_000_000_000) {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 1,
      }).format(value / 1_000_000_000) + 'B';
    }
    if (absValue >= 1_000_000) {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 1,
      }).format(value / 1_000_000) + 'M';
    }
    if (absValue >= 1_000) {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 1,
      }).format(value / 1_000) + 'K';
    }
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals ?? (Number.isInteger(value) ? 0 : 2),
    maximumFractionDigits: decimals ?? 2,
  }).format(value);
}

export function getCurrencySymbol(currency: string = 'GBP', locale: string = 'en-GB'): string {
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).formatToParts(0);
  return parts.find((p) => p.type === 'currency')?.value || '£';
}

// ─── Chart Theme Export ────────────────────────────────────────────
export const chartTheme = {
  seriesColors: [
    '#818cf8',
    '#34d399',
    '#fbbf24',
    '#38bdf8',
    '#a78bfa',
    '#fb7185',
    '#fb923c',
    '#22d3ee',
    '#f472b6',
    '#4ade80',
  ],
  axis: {
    stroke: 'rgba(255,255,255,0.08)',
    tickStroke: 'rgba(255,255,255,0.08)',
    tickLabelFill: '#9ca3af',
    tickLabelFontSize: 12,
    tickLabelFontWeight: 500,
  },
  grid: {
    stroke: 'rgba(255,255,255,0.05)',
    strokeDasharray: '3 3',
  },
  tooltip: {
    backgroundColor: '#1e1e24',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    textColor: '#f4f4f5',
    labelColor: '#a1a1aa',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  legend: {
    textColor: '#d4d4d8',
    inactiveColor: '#52525b',
    fontSize: 12,
    fontWeight: 500,
  },
  pie: {
    strokeColor: '#131316',
    strokeWidth: 2,
    labelColor: '#e4e4e7',
  },
};

// ─── Persistence ────────────────────────────────────────────────────

const STORAGE_KEY = 'erp-dashboard-state';

function loadState(): { layouts: Record<string, WidgetConfig[]>; settings: DashboardSettings } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.settings) {
        parsed.settings.currency = 'GBP';
        parsed.settings.locale = 'en-GB';
      }
      return parsed;
    }
  } catch {
    /* noop */
  }
  return {
    layouts: {},
    settings: {
      gridSnapping: true,
      compactMode: false,
      showWidgetTitles: true,
      theme: 'dark',
      refreshInterval: 'off',
      defaultTimeRange: 'month',
      defaultTab: 'main',
      gridColumns: 12,
      rowHeight: 40,
      margin: [8, 8],
      containerPadding: [16, 16],
      animationsEnabled: true,
      showBorders: true,
      currency: 'GBP',
      locale: 'en-GB',
      timezone: 'Europe/London',
      dateFormat: 'dd/MM/yyyy',
      numberFormat: 'eu',
      densityMode: 'comfortable',
    },
  };
}

function saveState(state: {
  layouts: Record<string, WidgetConfig[]>;
  settings: DashboardSettings;
}) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

// ─── Glass Card ─────────────────────────────────────────────────────

const GlassCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'elevated' | 'interactive' | 'chart';
    padding?: 'none' | 'sm' | 'md' | 'lg';
  }
>(({ className = '', variant = 'default', padding = 'md', children, ...props }, ref) => {
  const paddings = { none: '', sm: 'p-3', md: 'p-4 sm:p-5', lg: 'p-5 sm:p-6' };
  const variants = {
    default: 'bg-[#131316] border-white/[0.08] shadow-md shadow-black/20',
    elevated: 'bg-[#16161a] border-white/[0.10] shadow-lg shadow-black/30',
    interactive:
      'bg-[#131316] border-white/[0.08] hover:bg-[#1a1a1f] hover:border-white/[0.14] transition-all duration-200 shadow-md shadow-black/20',
    chart: 'bg-[#111114] border-white/[0.08] shadow-lg shadow-black/30',
  };

  return (
    <div
      ref={ref}
      className={`rounded-2xl border ${variants[variant]} ${paddings[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});
GlassCard.displayName = 'GlassCard';

// ─── Button ─────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      icon,
      loading,
      children,
      className = '',
      disabled,
      ...props
    },
    ref,
  ) => {
    const sizes = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-10 px-4 text-sm gap-2',
      lg: 'h-12 px-6 text-sm gap-2.5',
    };

    const variants = {
      primary: `
        bg-gradient-to-b from-indigo-500 to-indigo-600 
        text-white font-semibold
        shadow-lg shadow-indigo-500/25
        hover:from-indigo-400 hover:to-indigo-500
        active:from-indigo-600 active:to-indigo-700
        border border-indigo-400/20
      `,
      secondary: `
        bg-white/[0.06] text-zinc-200
        border border-white/[0.10]
        hover:bg-white/[0.10] hover:border-white/[0.16]
        active:bg-white/[0.08]
      `,
      ghost: `
        text-zinc-400 hover:text-zinc-200
        hover:bg-white/[0.06]
        active:bg-white/[0.08]
      `,
      danger: `
        bg-rose-500/10 text-rose-400
        border border-rose-500/20
        hover:bg-rose-500/15 hover:border-rose-500/30
        active:bg-rose-500/20
      `,
    };

    return (
      <motion.button
        ref={ref as React.Ref<HTMLButtonElement>}
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        transition={{ type: 'spring' as const, damping: 20, stiffness: 400 }}
        disabled={disabled || loading}
        className={`
          relative inline-flex items-center justify-center
          rounded-xl font-medium
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900
          ${sizes[size]}
          ${variants[variant]}
          ${className}
        `}
        {...(props as any)}
      >
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <LoadingSpinner size={size === 'sm' ? 14 : 18} />
            </motion.div>
          ) : null}
        </AnimatePresence>
        <span className={`flex items-center gap-inherit ${loading ? 'opacity-0' : ''}`}>
          {icon}
          {children}
        </span>
      </motion.button>
    );
  },
);
Button.displayName = 'Button';

// ─── Loading Spinner ────────────────────────────────────────────────

function LoadingSpinner({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </motion.svg>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────

function Skeleton({ className = '', animate = true }: { className?: string; animate?: boolean }) {
  return (
    <motion.div
      className={`bg-white/[0.06] rounded-lg ${className}`}
      animate={animate ? { opacity: [0.4, 0.7, 0.4] } : undefined}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// ─── Icon Button ────────────────────────────────────────────────────

function IconButton({
  icon,
  label,
  onClick,
  size = 'md',
  variant = 'ghost',
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'filled';
  active?: boolean;
}) {
  const sizes = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12' };
  const iconSizes = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-5 h-5' };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`${sizes[size]} rounded-xl flex items-center justify-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
        variant === 'filled'
          ? 'bg-white/[0.08] border border-white/[0.10] hover:bg-white/[0.12]'
          : 'hover:bg-white/[0.08]'
      } ${active ? 'bg-indigo-500/15 text-indigo-400' : 'text-zinc-400 hover:text-zinc-200'}`}
      aria-label={label}
    >
      <span className={iconSizes[size]}>{icon}</span>
    </motion.button>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────

const Icons = {
  Settings: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Plus: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Close: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Grid: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  Box: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </svg>
  ),
  TrendingUp: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  Sparkles: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4M19 17v4M3 5h4M17 19h4" />
    </svg>
  ),
  Check: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Download: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  FileText: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
};

// Widget Icons
const widgetIcons: Record<string, React.ReactNode> = {
  kpi: <Icons.Sparkles className="w-full h-full" />,
  'line-chart': <Icons.TrendingUp className="w-full h-full" />,
  'bar-chart': (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  ),
  'stacked-bar': (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="4" y="4" width="4" height="16" rx="1" />
      <rect x="10" y="8" width="4" height="12" rx="1" />
      <rect x="16" y="2" width="4" height="18" rx="1" />
    </svg>
  ),
  'pie-chart': (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  ),
  sankey: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M6 21V9a9 9 0 0 0 9 9" />
    </svg>
  ),
  table: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  ),
};

// ─── PDF Generation Utilities ───────────────────────────────────────

const PDF_COLORS = {
  background: '#0a0a0f',
  cardBg: '#131316',
  cardBorder: '#1e1e24',
  accent: '#6366f1',
  accentLight: '#818cf8',
  accentGlow: 'rgba(99,102,241,0.15)',
  text: {
    primary: '#fafafa',
    secondary: '#a1a1aa',
    tertiary: '#71717a',
    muted: '#52525b',
  },
  positive: '#34d399',
  negative: '#fb7185',
  warning: '#fbbf24',
  divider: '#1e1e24',
  gradientStart: '#6366f1',
  gradientEnd: '#8b5cf6',
};

interface PDFGeneratorOptions {
  tab: TabKey;
  timeRange: TimeRange;
  dashboardData: any;
  widgets: WidgetConfig[];
  settings: DashboardSettings;
}

function getTimeRangeLabel(tr: TimeRange): string {
  const labels: Record<TimeRange, string> = {
    day: 'Today',
    week: 'This Week',
    month: 'This Month',
    quarter: 'This Quarter',
    year: 'This Year',
  };
  return labels[tr] || tr;
}

function getTimeRangeDateStr(tr: TimeRange): string {
  const now = new Date();
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  switch (tr) {
    case 'day':
      return fmt(now);
    case 'week': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() + 1);
      return `${fmt(start)} — ${fmt(now)}`;
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return `${fmt(start)} — ${fmt(now)}`;
    }
    case 'quarter': {
      const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      return `${fmt(qStart)} — ${fmt(now)}`;
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1);
      return `${fmt(start)} — ${fmt(now)}`;
    }
    default:
      return fmt(now);
  }
}

function getTabLabel(tab: TabKey): string {
  const labels: Record<TabKey, string> = {
    main: 'Overview Dashboard',
    warehouse: 'Warehouse Dashboard',
    sales: 'Sales Dashboard',
    analytics: 'Analytics Dashboard',
    inventory: 'Inventory Dashboard',
    playground: 'Playground Dashboard',
  };
  return labels[tab] || tab;
}

function getTabDescription(tab: TabKey): string {
  const descriptions: Record<TabKey, string> = {
    main: 'Comprehensive overview of all business operations, financial metrics, and key performance indicators.',
    warehouse: 'Warehouse operations, inventory levels, fulfillment rates, and logistics performance metrics.',
    sales: 'Sales performance, revenue analytics, customer acquisition, and pipeline management overview.',
    analytics: 'Cross-functional analytics with trend analysis and performance benchmarking.',
    inventory: 'Inventory health, stock movement, and replenishment risk indicators.',
    playground: 'Experimental workspace with all available widgets and synthetic datasets.',
  };
  return descriptions[tab] || '';
}

// Helper: draw rounded rectangle
function drawRoundedRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  style: 'F' | 'S' | 'FD' = 'F',
) {
  doc.roundedRect(x, y, w, h, r, r, style);
}

// Helper: draw a gradient-like header bar (simulated with overlapping rects)
function drawGradientBar(doc: jsPDF, x: number, y: number, w: number, h: number) {
  const steps = 20;
  const stepW = w / steps;
  for (let i = 0; i < steps; i++) {
    const r = Math.round(99 + (139 - 99) * (i / steps));
    const g = Math.round(102 + (92 - 102) * (i / steps));
    const b = Math.round(241 + (246 - 241) * (i / steps));
    doc.setFillColor(r, g, b);
    doc.rect(x + i * stepW, y, stepW + 0.5, h, 'F');
  }
}

// Helper: hex to RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

// Helper: mini sparkline in PDF
function drawMiniSparkline(
  doc: jsPDF,
  data: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  color: [number, number, number],
) {
  if (!data || data.length < 2) return;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);

  doc.setDrawColor(...color);
  doc.setLineWidth(0.5);

  for (let i = 0; i < data.length - 1; i++) {
    const x1 = x + i * stepX;
    const y1 = y + h - ((data[i] - min) / range) * h;
    const x2 = x + (i + 1) * stepX;
    const y2 = y + h - ((data[i + 1] - min) / range) * h;
    doc.line(x1, y1, x2, y2);
  }
}

// Helper: draw a mini bar chart
function drawMiniBarChart(
  doc: jsPDF,
  data: { label: string; value: number }[],
  x: number,
  y: number,
  w: number,
  h: number,
  color: [number, number, number],
) {
  if (!data || data.length === 0) return;
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const barW = Math.min((w - (data.length - 1) * 2) / data.length, 12);
  const totalBarsW = data.length * barW + (data.length - 1) * 2;
  const startX = x + (w - totalBarsW) / 2;

  data.forEach((item, i) => {
    const barH = (item.value / max) * (h - 10);
    const bx = startX + i * (barW + 2);
    const by = y + h - barH - 5;

    // Bar with slight opacity variation
    const opacity = 0.5 + (item.value / max) * 0.5;
    doc.setFillColor(
      Math.round(color[0] * opacity + 19 * (1 - opacity)),
      Math.round(color[1] * opacity + 19 * (1 - opacity)),
      Math.round(color[2] * opacity + 19 * (1 - opacity)),
    );
    drawRoundedRect(doc, bx, by, barW, barH, 1.5, 'F');

    // Label
    doc.setFontSize(5);
    doc.setTextColor(161, 161, 170);
    doc.text(item.label.substring(0, 4), bx + barW / 2, y + h, { align: 'center' });
  });
}

// Helper: draw mini pie chart
export function drawMiniPie(
  doc: jsPDF,
  data: { label: string; value: number; color: string }[],
  cx: number,
  cy: number,
  radius: number,
) {
  if (!data || data.length === 0) return;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let startAngle = -Math.PI / 2;

  data.forEach((item) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;
    const rgb = hexToRgb(item.color);

    // Draw pie slice using lines (approximation)
    doc.setFillColor(...rgb);
    const points: [number, number][] = [[cx, cy]];
    const steps = Math.max(Math.ceil(sliceAngle / 0.1), 3);
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + (sliceAngle * i) / steps;
      points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
    }

    // Use triangle fan
    for (let i = 1; i < points.length - 1; i++) {
      doc.triangle(
        points[0][0], points[0][1],
        points[i][0], points[i][1],
        points[i + 1][0], points[i + 1][1],
        'F',
      );
    }

    startAngle = endAngle;
  });

  // Center circle for donut effect
  doc.setFillColor(...hexToRgb(PDF_COLORS.cardBg));
  doc.circle(cx, cy, radius * 0.55, 'F');
}

// Extract KPI data from dashboard data
function extractKPIData(data: any): Array<{ title: string; value: string; change: number; sparkline?: number[] }> {
  const kpis: Array<{ title: string; value: string; change: number; sparkline?: number[] }> = [];

  if (!data) return kpis;

  // Try to extract from various data structures
  if (data.kpis) {
    if (Array.isArray(data.kpis)) {
      return data.kpis.map((k: any) => ({
        title: k.title || k.label || k.name || 'Metric',
        value: typeof k.value === 'number' ? formatCurrency(k.value) : String(k.value || ''),
        change: k.change || k.trend || k.delta || 0,
        sparkline: k.sparkline || k.data || k.history,
      }));
    }
    if (typeof data.kpis === 'object') {
      Object.entries(data.kpis).forEach(([key, val]: [string, any]) => {
        kpis.push({
          title: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
          value: typeof val === 'number' ? formatCurrency(val) : typeof val === 'object' ? formatCurrency(val.value || 0) : String(val),
          change: typeof val === 'object' ? (val.change || val.trend || 0) : 0,
          sparkline: typeof val === 'object' ? val.sparkline : undefined,
        });
      });
    }
  }

  // Fallback: scan top-level numeric properties
  if (kpis.length === 0) {
    const numericKeys = Object.keys(data).filter(
      (k) => typeof data[k] === 'number' || (typeof data[k] === 'object' && data[k]?.value !== undefined),
    );
    numericKeys.slice(0, 8).forEach((key) => {
      const val = data[key];
      kpis.push({
        title: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
        value: typeof val === 'number' ? formatCurrency(val) : formatCurrency(val?.value || 0),
        change: typeof val === 'object' ? (val.change || 0) : 0,
      });
    });
  }

  return kpis;
}

// Extract chart data
function extractChartData(data: any): Array<{ title: string; type: string; data: any[] }> {
  const charts: Array<{ title: string; type: string; data: any[] }> = [];

  if (!data) return charts;

  // Look for arrays in the data that could be chart data
  Object.entries(data).forEach(([key, val]) => {
    if (Array.isArray(val) && val.length > 0) {
      const first = val[0];
      if (typeof first === 'object' && first !== null) {
        const hasNumericValues = Object.values(first).some((v) => typeof v === 'number');
        if (hasNumericValues) {
          charts.push({
            title: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
            type: val.length > 10 ? 'line' : 'bar',
            data: val,
          });
        }
      }
    }
    // Nested chart configs
    if (typeof val === 'object' && val !== null && !Array.isArray(val) && (val as any).data) {
      const chartObj = val as any;
      if (Array.isArray(chartObj.data)) {
        charts.push({
          title: chartObj.title || key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
          type: chartObj.type || 'bar',
          data: chartObj.data,
        });
      }
    }
  });

  return charts;
}

// Extract table data
function extractTableData(data: any): Array<{ title: string; headers: string[]; rows: string[][] }> {
  const tables: Array<{ title: string; headers: string[]; rows: string[][] }> = [];

  if (!data) return tables;

  Object.entries(data).forEach(([key, val]) => {
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
      const headers = Object.keys(val[0]).slice(0, 6);
      const rows = val.slice(0, 15).map((row: any) =>
        headers.map((h) => {
          const v = row[h];
          if (typeof v === 'number') {
            return v > 100 ? formatCurrency(v) : v.toLocaleString('en-GB');
          }
          return String(v || '—');
        }),
      );

      if (headers.length >= 2 && rows.length >= 1) {
        tables.push({
          title: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
          headers: headers.map((h) => h.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())),
          rows,
        });
      }
    }
  });

  return tables;
}

async function generateDashboardPDF(options: PDFGeneratorOptions): Promise<void> {
  const { tab, timeRange, dashboardData, widgets } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let curY = 0;

  // ───── Background ─────
  function drawPageBackground() {
    doc.setFillColor(...hexToRgb(PDF_COLORS.background));
    doc.rect(0, 0, pageW, pageH, 'F');

    // Subtle gradient overlay at top
    for (let i = 0; i < 60; i++) {
      const opacity = Math.max(0, 0.04 - i * 0.0007);
      doc.setFillColor(99, 102, 241);
      doc.setGState(new (doc as any).GState({ opacity }));
      doc.rect(0, i * 1.5, pageW, 1.5, 'F');
    }
    doc.setGState(new (doc as any).GState({ opacity: 1 }));
  }

  function checkNewPage(requiredHeight: number) {
    if (curY + requiredHeight > pageH - 20) {
      doc.addPage();
      drawPageBackground();
      curY = margin;
      return true;
    }
    return false;
  }

  // ───── Page 1: Cover / Header ─────
  drawPageBackground();

  // Top accent bar
  drawGradientBar(doc, 0, 0, pageW, 3);

  curY = 22;

  // Company logo area (abstract geometric mark)
  doc.setFillColor(...hexToRgb(PDF_COLORS.accent));
  drawRoundedRect(doc, margin, curY, 12, 12, 3, 'F');
  doc.setFillColor(...hexToRgb(PDF_COLORS.background));
  drawRoundedRect(doc, margin + 3, curY + 3, 6, 6, 2, 'F');
  doc.setFillColor(...hexToRgb(PDF_COLORS.accentLight));
  drawRoundedRect(doc, margin + 4.5, curY + 4.5, 3, 3, 1, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...hexToRgb(PDF_COLORS.text.primary));
  doc.text(getTabLabel(tab), margin + 17, curY + 8);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...hexToRgb(PDF_COLORS.text.secondary));
  doc.text('ERP Analytics Report', margin + 17, curY + 13);

  curY += 22;

  // Report info card
  doc.setFillColor(...hexToRgb(PDF_COLORS.cardBg));
  drawRoundedRect(doc, margin, curY, contentW, 28, 4, 'F');
  doc.setDrawColor(...hexToRgb(PDF_COLORS.cardBorder));
  doc.setLineWidth(0.3);
  drawRoundedRect(doc, margin, curY, contentW, 28, 4, 'S');

  // Info items
  const infoItems = [
    { label: 'Period', value: getTimeRangeLabel(timeRange) },
    { label: 'Date Range', value: getTimeRangeDateStr(timeRange) },
    { label: 'Generated', value: new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) },
    { label: 'Currency', value: '£ GBP' },
  ];

  const infoColW = contentW / infoItems.length;
  infoItems.forEach((item, i) => {
    const ix = margin + i * infoColW + 8;
    const iy = curY + 9;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...hexToRgb(PDF_COLORS.text.muted));
    doc.text(item.label.toUpperCase(), ix, iy);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...hexToRgb(PDF_COLORS.text.primary));
    doc.text(item.value, ix, iy + 7);

    // Divider
    if (i < infoItems.length - 1) {
      doc.setDrawColor(...hexToRgb(PDF_COLORS.divider));
      doc.setLineWidth(0.2);
      doc.line(margin + (i + 1) * infoColW, curY + 6, margin + (i + 1) * infoColW, curY + 22);
    }
  });

  curY += 34;

  // Description
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...hexToRgb(PDF_COLORS.text.tertiary));
  const descLines = doc.splitTextToSize(getTabDescription(tab), contentW);
  doc.text(descLines, margin, curY);
  curY += descLines.length * 4 + 6;

  // Divider line
  doc.setDrawColor(...hexToRgb(PDF_COLORS.divider));
  doc.setLineWidth(0.3);
  doc.line(margin, curY, margin + contentW, curY);
  curY += 8;

  // ───── KPIs Section ─────
  const kpis = extractKPIData(dashboardData);
  if (kpis.length > 0) {
    // Section header
    doc.setFillColor(...hexToRgb(PDF_COLORS.accent));
    drawRoundedRect(doc, margin, curY, 3, 14, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...hexToRgb(PDF_COLORS.text.primary));
    doc.text('Key Performance Indicators', margin + 8, curY + 9);
    curY += 20;

    // KPI cards (2 per row)
    const kpiPerRow = Math.min(kpis.length, 4);
    const kpiCardW = (contentW - (kpiPerRow - 1) * 4) / kpiPerRow;
    const kpiCardH = 32;

    for (let row = 0; row < Math.ceil(kpis.length / kpiPerRow); row++) {
      checkNewPage(kpiCardH + 8);

      for (let col = 0; col < kpiPerRow; col++) {
        const idx = row * kpiPerRow + col;
        if (idx >= kpis.length) break;
        const kpi = kpis[idx];

        const cx = margin + col * (kpiCardW + 4);
        const cy = curY;

        // Card background
        doc.setFillColor(...hexToRgb(PDF_COLORS.cardBg));
        drawRoundedRect(doc, cx, cy, kpiCardW, kpiCardH, 3, 'F');
        doc.setDrawColor(...hexToRgb(PDF_COLORS.cardBorder));
        doc.setLineWidth(0.2);
        drawRoundedRect(doc, cx, cy, kpiCardW, kpiCardH, 3, 'S');

        // KPI title
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...hexToRgb(PDF_COLORS.text.muted));
        doc.text(kpi.title.toUpperCase(), cx + 6, cy + 8);

        // KPI value
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...hexToRgb(PDF_COLORS.text.primary));
        const valueStr = kpi.value.length > 12 ? kpi.value.substring(0, 12) + '…' : kpi.value;
        doc.text(valueStr, cx + 6, cy + 18);

        // Change indicator
        if (kpi.change !== 0) {
          const isPositive = kpi.change > 0;
          const changeColor = isPositive ? hexToRgb(PDF_COLORS.positive) : hexToRgb(PDF_COLORS.negative);
          const changeBg = isPositive ? [16, 52, 40] : [52, 16, 30];

          doc.setFillColor(changeBg[0], changeBg[1], changeBg[2]);
          const changeText = `${isPositive ? '↑' : '↓'} ${Math.abs(kpi.change).toFixed(1)}%`;
          const changeW = doc.getTextWidth(changeText) * 0.8 + 6;
          drawRoundedRect(doc, cx + 6, cy + 22, changeW + 2, 6, 2, 'F');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(...(changeColor as [number, number, number]));
          doc.text(changeText, cx + 8, cy + 26.5);
        }

        // Mini sparkline
        if (kpi.sparkline && kpi.sparkline.length > 1) {
          const sparkColor: [number, number, number] = kpi.change >= 0
            ? hexToRgb(PDF_COLORS.positive) as [number, number, number]
            : hexToRgb(PDF_COLORS.negative) as [number, number, number];
          drawMiniSparkline(doc, kpi.sparkline, cx + kpiCardW - 26, cy + 8, 20, 12, sparkColor);
        }
      }

      curY += kpiCardH + 4;
    }

    curY += 8;
  }

  // ───── Charts Section ─────
  const charts = extractChartData(dashboardData);
  if (charts.length > 0) {
    checkNewPage(30);

    // Section header
    doc.setFillColor(...hexToRgb(PDF_COLORS.accent));
    drawRoundedRect(doc, margin, curY, 3, 14, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...hexToRgb(PDF_COLORS.text.primary));
    doc.text('Analytics & Charts', margin + 8, curY + 9);
    curY += 20;

    const chartsPerRow = 2;
    const chartCardW = (contentW - 4) / chartsPerRow;
    const chartCardH = 55;

    for (let row = 0; row < Math.ceil(charts.length / chartsPerRow); row++) {
      checkNewPage(chartCardH + 8);

      for (let col = 0; col < chartsPerRow; col++) {
        const idx = row * chartsPerRow + col;
        if (idx >= charts.length) break;
        const chart = charts[idx];

        const cx = margin + col * (chartCardW + 4);
        const cy = curY;

        // Card background
        doc.setFillColor(...hexToRgb(PDF_COLORS.cardBg));
        drawRoundedRect(doc, cx, cy, chartCardW, chartCardH, 3, 'F');
        doc.setDrawColor(...hexToRgb(PDF_COLORS.cardBorder));
        doc.setLineWidth(0.2);
        drawRoundedRect(doc, cx, cy, chartCardW, chartCardH, 3, 'S');

        // Chart title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...hexToRgb(PDF_COLORS.text.primary));
        doc.text(chart.title, cx + 6, cy + 8);

        // Chart type badge
        doc.setFillColor(30, 30, 36);
        const typeLabel = chart.type.toUpperCase();
        const badgeW = doc.getTextWidth(typeLabel) * 0.65 + 6;
        drawRoundedRect(doc, cx + chartCardW - badgeW - 6, cy + 3, badgeW, 7, 2, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.setTextColor(...hexToRgb(PDF_COLORS.text.muted));
        doc.text(typeLabel, cx + chartCardW - badgeW / 2 - 3, cy + 7.5, { align: 'center' });

        // Draw chart visualization
        const chartArea = { x: cx + 6, y: cy + 14, w: chartCardW - 12, h: chartCardH - 20 };

        if (chart.type === 'line' || chart.data.length > 8) {
          // Line chart
          const numericKey = Object.keys(chart.data[0]).find((k) => typeof chart.data[0][k] === 'number');
          if (numericKey) {
            const values = chart.data.map((d) => d[numericKey] as number);
            const seriesColors = chartTheme.seriesColors;
            drawMiniSparkline(
              doc,
              values,
              chartArea.x,
              chartArea.y,
              chartArea.w,
              chartArea.h,
              hexToRgb(seriesColors[idx % seriesColors.length]) as [number, number, number],
            );

            // Area fill (simulated)
            const min = Math.min(...values);
            const max = Math.max(...values);
            const range = max - min || 1;
            const stepX = chartArea.w / (values.length - 1);
            const color = hexToRgb(seriesColors[idx % seriesColors.length]);

            doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
            doc.setFillColor(...color);
            for (let i = 0; i < values.length - 1; i++) {
              const x1 = chartArea.x + i * stepX;
              const y1 = chartArea.y + chartArea.h - ((values[i] - min) / range) * chartArea.h;
              const x2 = chartArea.x + (i + 1) * stepX;
              const y2 = chartArea.y + chartArea.h - ((values[i + 1] - min) / range) * chartArea.h;
              doc.triangle(x1, y1, x2, y2, x2, chartArea.y + chartArea.h, 'F');
              doc.triangle(x1, y1, x1, chartArea.y + chartArea.h, x2, chartArea.y + chartArea.h, 'F');
            }
            doc.setGState(new (doc as any).GState({ opacity: 1 }));
          }
        } else {
          // Bar chart
          const labelKey = Object.keys(chart.data[0]).find((k) => typeof chart.data[0][k] === 'string') || Object.keys(chart.data[0])[0];
          const numericKey = Object.keys(chart.data[0]).find((k) => typeof chart.data[0][k] === 'number');
          if (numericKey) {
            const barData = chart.data.map((d) => ({
              label: String(d[labelKey] || ''),
              value: d[numericKey] as number,
            }));
            drawMiniBarChart(
              doc,
              barData,
              chartArea.x,
              chartArea.y,
              chartArea.w,
              chartArea.h,
              hexToRgb(chartTheme.seriesColors[idx % chartTheme.seriesColors.length]) as [number, number, number],
            );
          }
        }
      }

      curY += chartCardH + 4;
    }

    curY += 8;
  }

  // ───── Tables Section ─────
  const tables = extractTableData(dashboardData);
  if (tables.length > 0) {
    tables.forEach((table) => {
      checkNewPage(40);

      // Section header for table
      doc.setFillColor(...hexToRgb(PDF_COLORS.accent));
      drawRoundedRect(doc, margin, curY, 3, 14, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...hexToRgb(PDF_COLORS.text.primary));
      doc.text(table.title, margin + 8, curY + 9);
      curY += 18;

      // Table card
      const colW = contentW / table.headers.length;
      const rowH = 8;
      const headerH = 9;
      const tableH = headerH + table.rows.length * rowH + 4;

      checkNewPage(tableH + 4);

      // Table background
      doc.setFillColor(...hexToRgb(PDF_COLORS.cardBg));
      drawRoundedRect(doc, margin, curY, contentW, tableH, 3, 'F');
      doc.setDrawColor(...hexToRgb(PDF_COLORS.cardBorder));
      doc.setLineWidth(0.2);
      drawRoundedRect(doc, margin, curY, contentW, tableH, 3, 'S');

      // Header row
      doc.setFillColor(22, 22, 28);
      drawRoundedRect(doc, margin + 0.5, curY + 0.5, contentW - 1, headerH, 2.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...hexToRgb(PDF_COLORS.text.muted));

      table.headers.forEach((header, i) => {
        doc.text(header.toUpperCase(), margin + i * colW + 5, curY + 6);
      });

      curY += headerH;

      // Data rows
      table.rows.forEach((row, rowIdx) => {
        if (rowIdx % 2 === 1) {
          doc.setFillColor(15, 15, 19);
          doc.rect(margin + 0.5, curY, contentW - 1, rowH, 'F');
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...hexToRgb(PDF_COLORS.text.secondary));

        row.forEach((cell, colIdx) => {
          const cellText = cell.length > 18 ? cell.substring(0, 18) + '…' : cell;
          doc.text(cellText, margin + colIdx * colW + 5, curY + 5.5);
        });

        // Row divider
        if (rowIdx < table.rows.length - 1) {
          doc.setDrawColor(25, 25, 32);
          doc.setLineWidth(0.15);
          doc.line(margin + 4, curY + rowH, margin + contentW - 4, curY + rowH);
        }

        curY += rowH;
      });

      curY += 12;
    });
  }

  // ───── Widgets Summary Section ─────
  if (widgets.length > 0) {
    checkNewPage(30);

    doc.setFillColor(...hexToRgb(PDF_COLORS.accent));
    drawRoundedRect(doc, margin, curY, 3, 14, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...hexToRgb(PDF_COLORS.text.primary));
    doc.text('Dashboard Configuration', margin + 8, curY + 9);
    curY += 18;

    // Widget list
    doc.setFillColor(...hexToRgb(PDF_COLORS.cardBg));
    const widgetListH = Math.min(widgets.length * 10 + 8, 80);
    drawRoundedRect(doc, margin, curY, contentW, widgetListH, 3, 'F');
    doc.setDrawColor(...hexToRgb(PDF_COLORS.cardBorder));
    doc.setLineWidth(0.2);
    drawRoundedRect(doc, margin, curY, contentW, widgetListH, 3, 'S');

    const displayWidgets = widgets.slice(0, 7);
    displayWidgets.forEach((widget, i) => {
      const wy = curY + 6 + i * 10;

      // Widget type dot
      const colorMap: Record<string, string> = {
        indigo: '#818cf8',
        emerald: '#34d399',
        amber: '#fbbf24',
        sky: '#38bdf8',
        violet: '#a78bfa',
        rose: '#fb7185',
        orange: '#fb923c',
        cyan: '#22d3ee',
      };
      const dotColor = hexToRgb(colorMap[widget.color || 'indigo'] || '#818cf8');
      doc.setFillColor(...dotColor);
      doc.circle(margin + 8, wy + 1, 2, 'F');

      // Widget title
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...hexToRgb(PDF_COLORS.text.secondary));
      doc.text(widget.title || widget.type, margin + 14, wy + 2.5);

      // Widget type
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...hexToRgb(PDF_COLORS.text.muted));
      doc.text(widget.type, margin + contentW - 30, wy + 2.5);

      // Size
      doc.text(`${widget.w}×${widget.h}`, margin + contentW - 10, wy + 2.5);
    });

    if (widgets.length > 7) {
      const wy = curY + 6 + 7 * 10;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(...hexToRgb(PDF_COLORS.text.muted));
      doc.text(`+ ${widgets.length - 7} more widgets`, margin + 14, wy + 2);
    }

    curY += widgetListH + 8;
  }

  // ───── Footer on every page ─────
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Bottom border
    doc.setDrawColor(...hexToRgb(PDF_COLORS.divider));
    doc.setLineWidth(0.2);
    doc.line(margin, pageH - 12, margin + contentW, pageH - 12);

    // Footer text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...hexToRgb(PDF_COLORS.text.muted));
    doc.text(
      `${getTabLabel(tab)} — ${getTimeRangeLabel(timeRange)} Report`,
      margin,
      pageH - 7,
    );

    // Page number
    doc.text(
      `Page ${i} of ${totalPages}`,
      margin + contentW,
      pageH - 7,
      { align: 'right' },
    );

    // Confidential watermark
    doc.setFontSize(5);
    doc.text('CONFIDENTIAL — Generated by ERP Dashboard', pageW / 2, pageH - 7, { align: 'center' });

    // Bottom accent line
    drawGradientBar(doc, 0, pageH - 2, pageW, 2);
  }

  // ───── Save ─────
  const fileName = `${tab}-dashboard-${timeRange}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

// ───── PDF with Screenshot approach (captures actual charts) ─────
async function generatePDFWithScreenshot(
  gridRef: React.RefObject<HTMLDivElement | null>,
  options: PDFGeneratorOptions,
): Promise<void> {
  const { tab, timeRange, widgets } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;

  // Background
  doc.setFillColor(...hexToRgb(PDF_COLORS.background));
  doc.rect(0, 0, pageW, pageH, 'F');

  // Header gradient bar
  drawGradientBar(doc, 0, 0, pageW, 3);

  // Title section
  let curY = 18;

  // Logo mark
  doc.setFillColor(...hexToRgb(PDF_COLORS.accent));
  drawRoundedRect(doc, margin, curY, 10, 10, 2.5, 'F');
  doc.setFillColor(...hexToRgb(PDF_COLORS.background));
  drawRoundedRect(doc, margin + 2.5, curY + 2.5, 5, 5, 1.5, 'F');
  doc.setFillColor(...hexToRgb(PDF_COLORS.accentLight));
  drawRoundedRect(doc, margin + 3.5, curY + 3.5, 3, 3, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...hexToRgb(PDF_COLORS.text.primary));
  doc.text(getTabLabel(tab), margin + 14, curY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...hexToRgb(PDF_COLORS.text.secondary));
  doc.text(`${getTimeRangeLabel(timeRange)} • ${getTimeRangeDateStr(timeRange)}`, margin + 14, curY + 12);

  curY += 20;

  // Info bar
  doc.setFillColor(...hexToRgb(PDF_COLORS.cardBg));
  drawRoundedRect(doc, margin, curY, contentW, 14, 3, 'F');
  doc.setDrawColor(...hexToRgb(PDF_COLORS.cardBorder));
  doc.setLineWidth(0.2);
  drawRoundedRect(doc, margin, curY, contentW, 14, 3, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...hexToRgb(PDF_COLORS.text.tertiary));
  doc.text(
    `Generated: ${new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}  •  Currency: £ GBP  •  ${widgets.length} Widgets`,
    margin + 6,
    curY + 9,
  );

  curY += 20;

  // Screenshot of the actual dashboard
  if (gridRef.current) {
    try {
      const rect = gridRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        throw new Error('Dashboard grid is not visible');
      }

      const canvas = await html2canvas(gridRef.current, withHtml2CanvasColorFix({
        backgroundColor: '#0a0a0f',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
        windowWidth: gridRef.current.scrollWidth,
        windowHeight: gridRef.current.scrollHeight,
      }));

      const imgData = canvas.toDataURL('image/png');
      const imgW = contentW;
      const imgH = (canvas.height / canvas.width) * imgW;

      // Split across pages if needed
      let remainingH = imgH;
      let srcY = 0;
      const availableH = pageH - curY - 20;

      if (imgH <= availableH) {
        // Fits on one page
        doc.addImage(imgData, 'PNG', margin, curY, imgW, imgH);
      } else {
        // Multi-page
        let firstPage = true;
        while (remainingH > 0) {
          const sliceH = firstPage ? availableH : pageH - margin * 2 - 10;
          const actualSliceH = Math.min(remainingH, sliceH);

          if (!firstPage) {
            doc.addPage();
            doc.setFillColor(...hexToRgb(PDF_COLORS.background));
            doc.rect(0, 0, pageW, pageH, 'F');
            curY = margin;
          }

          // Calculate source crop
          const srcRatio = canvas.height / imgH;
          const srcCropY = srcY * srcRatio;
          const srcCropH = actualSliceH * srcRatio;

          // Create cropped canvas
          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = canvas.width;
          cropCanvas.height = srcCropH;
          const ctx = cropCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(
              canvas,
              0, srcCropY, canvas.width, srcCropH,
              0, 0, canvas.width, srcCropH,
            );
            const cropData = cropCanvas.toDataURL('image/png');
            doc.addImage(cropData, 'PNG', margin, curY, imgW, actualSliceH);
          }

          remainingH -= actualSliceH;
          srcY += actualSliceH;
          firstPage = false;
        }
      }
    } catch (err) {
      console.warn('Screenshot capture failed, falling back to data-based PDF:', err);
      // Fallback: generate data-based content
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...hexToRgb(PDF_COLORS.text.tertiary));
      doc.text('Dashboard visualization capture unavailable. See data summary below.', margin, curY + 10);
      curY += 20;
    }
  }

  // Footer on all pages
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...hexToRgb(PDF_COLORS.divider));
    doc.setLineWidth(0.2);
    doc.line(margin, pageH - 12, margin + contentW, pageH - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...hexToRgb(PDF_COLORS.text.muted));
    doc.text(`${getTabLabel(tab)} Report`, margin, pageH - 7);
    doc.text(`Page ${i}/${totalPages}`, margin + contentW, pageH - 7, { align: 'right' });

    drawGradientBar(doc, 0, pageH - 2, pageW, 2);
  }

  const fileName = `${tab}-dashboard-${timeRange}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

// ─── Download PDF Button Component ──────────────────────────────────

function DownloadPDFButton({
  tab,
  timeRange,
  dashboardData,
  widgets,
  settings,
  gridRef,
}: {
  tab: TabKey;
  timeRange: TimeRange;
  dashboardData: any;
  widgets: WidgetConfig[];
  settings: DashboardSettings;
  gridRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
        setShowOptions(false);
      }
    }
    if (showOptions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showOptions]);

  const handleDownload = useCallback(
    async (mode: 'data' | 'screenshot') => {
      setIsGenerating(true);
      setShowOptions(false);
      setProgress(0);

      try {
        // Simulate progress
        const progressInterval = setInterval(() => {
          setProgress((p) => Math.min(p + Math.random() * 20, 90));
        }, 200);

        if (mode === 'screenshot' && gridRef.current) {
          await generatePDFWithScreenshot(gridRef, {
            tab,
            timeRange,
            dashboardData,
            widgets,
            settings,
          });
        } else {
          await generateDashboardPDF({
            tab,
            timeRange,
            dashboardData,
            widgets,
            settings,
          });
        }

        clearInterval(progressInterval);
        setProgress(100);

        // Show success
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } catch (err) {
        console.error('PDF generation failed:', err);
      } finally {
        setTimeout(() => {
          setIsGenerating(false);
          setProgress(0);
        }, 500);
      }
    },
    [tab, timeRange, dashboardData, widgets, settings, gridRef],
  );

  return (
    <div className="relative" ref={optionsRef}>
      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute -bottom-14 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap"
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-medium shadow-lg shadow-emerald-500/10">
              <Icons.Check className="w-3.5 h-3.5" />
              PDF Downloaded Successfully
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Overlay */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#131316] border border-white/[0.10] rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl"
            >
              <div className="flex flex-col items-center gap-5">
                {/* Animated icon */}
                <motion.div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.12) 100%)',
                    border: '1px solid rgba(99,102,241,0.25)',
                  }}
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Icons.FileText className="w-8 h-8 text-indigo-400" />
                </motion.div>

                <div className="text-center">
                  <h3 className="text-lg font-semibold text-zinc-100">Generating PDF</h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    {getTabLabel(tab)} • {getTimeRangeLabel(timeRange)}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full">
                  <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)',
                      }}
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-xs text-zinc-500">Processing...</span>
                    <span className="text-xs text-zinc-400 font-mono">{Math.round(progress)}%</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Button */}
      <Button
        variant="secondary"
        size="md"
        icon={<Icons.Download className="w-4 h-4" />}
        onClick={() => setShowOptions(!showOptions)}
        disabled={isGenerating}
        loading={isGenerating}
        className="relative"
      >
        <span className="hidden sm:inline">PDF</span>
      </Button>

      {/* Dropdown Options */}
      <AnimatePresence>
        {showOptions && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-50 w-72"
          >
            <div
              className="rounded-2xl border border-white/[0.10] overflow-hidden shadow-2xl"
              style={{
                background: 'linear-gradient(180deg, #16161a 0%, #111114 100%)',
              }}
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.12) 100%)',
                      border: '1px solid rgba(99,102,241,0.25)',
                    }}
                  >
                    <Icons.FileText className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-zinc-100 block">Export as PDF</span>
                    <span className="text-[10px] text-zinc-500">
                      {getTabLabel(tab)} • {getTimeRangeLabel(timeRange)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Options */}
              <div className="p-2">
                {/* Data Report Option */}
                <motion.button
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDownload('data')}
                  className="w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <path d="M8 13h2M8 17h2M12 13h4M12 17h4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-zinc-100 block">Data Report</span>
                    <span className="text-xs text-zinc-500 block mt-0.5">
                      Beautiful formatted report with KPIs, mini charts, tables & analytics data
                    </span>
                    <span className="text-[10px] text-indigo-400/70 font-medium mt-1 block">Recommended</span>
                  </div>
                </motion.button>

                {/* Screenshot Option */}
                <motion.button
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDownload('screenshot')}
                  className="w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-zinc-100 block">Visual Screenshot</span>
                    <span className="text-xs text-zinc-500 block mt-0.5">
                      High-resolution capture of the live dashboard exactly as displayed
                    </span>
                  </div>
                </motion.button>
              </div>

              {/* Footer info */}
              <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.02]">
                <span className="text-[10px] text-zinc-600">
                  Reports include all visible widgets • Data as of {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Time Range Selector ────────────────────────────────────────────

function TimeRangeSelector({ value, onChange }: { value: TimeRange; onChange: (v: TimeRange) => void }) {
  const ranges: { key: TimeRange; label: string; short: string }[] = [
    { key: 'day', label: 'Today', short: '1D' },
    { key: 'week', label: 'This Week', short: '1W' },
    { key: 'month', label: 'This Month', short: '1M' },
    { key: 'quarter', label: 'This Quarter', short: '3M' },
    { key: 'year', label: 'This Year', short: '1Y' },
  ];

  return (
    <div className="flex items-center">
      <div
        className="flex items-center p-1 rounded-xl"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {ranges.map((r) => (
          <motion.button
            key={r.key}
            onClick={() => onChange(r.key)}
            className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200 ${
              value === r.key ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            whileTap={{ scale: 0.97 }}
            aria-pressed={value === r.key}
          >
            {value === r.key && (
              <motion.div
                layoutId="timerange-active"
                className="absolute inset-0 rounded-lg"
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.12) 100%)',
                  border: '1px solid rgba(99,102,241,0.25)',
                }}
                transition={tokens.transition.spring}
              />
            )}
            <span className="relative z-10">{r.short}</span>
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.span
          key={value}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 8 }}
          transition={{ duration: 0.15 }}
          className="ml-3 text-xs text-zinc-400 font-medium hidden lg:inline-block"
        >
          {ranges.find((r) => r.key === value)?.label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

// ─── Tab Navigation ─────────────────────────────────────────────────

// In your TabNav component, add the playground tab:

function TabNav({ value, onChange }: { value: TabKey; onChange: (v: TabKey) => void }) {
  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'main', label: 'Overview', icon: <Icons.Grid className="w-4 h-4" /> },
    { key: 'warehouse', label: 'Warehouse', icon: <Icons.Box className="w-4 h-4" /> },
    { key: 'sales', label: 'Sales', icon: <Icons.TrendingUp className="w-4 h-4" /> },
    { key: 'playground', label: 'Playground', icon: <Icons.Sparkles className="w-4 h-4" /> },
  ];

  return (
    <nav className="flex items-center gap-1" role="tablist">
      {tabs.map((tab) => (
        <motion.button
          key={tab.key}
          role="tab"
          aria-selected={value === tab.key}
          onClick={() => onChange(tab.key)}
          className={`relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 ${
            value === tab.key ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
          whileTap={{ scale: 0.97 }}
        >
          {value === tab.key && (
            <motion.div
              layoutId="tab-active"
              className="absolute inset-0 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
                border: '1px solid rgba(255,255,255,0.10)',
              }}
              transition={tokens.transition.spring}
            />
          )}
          <span className="relative z-10">{tab.icon}</span>
          <span className="relative z-10 hidden sm:inline">{tab.label}</span>
          {/* Playground badge */}
          {tab.key === 'playground' && (
            <span className="relative z-10 hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/25">
              NEW
            </span>
          )}
        </motion.button>
      ))}
    </nav>
  );
}
// ─── Toggle ─────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <span className="text-sm font-medium text-zinc-200 block">{label}</span>
        {description && <span className="text-xs text-zinc-500 block mt-0.5">{description}</span>}
      </div>
      <motion.button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
          checked ? 'bg-indigo-500/30 border-indigo-500/30' : 'bg-white/[0.06] border-white/[0.10]'
        }`}
        style={{ borderWidth: '1px' }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: 'spring' as const, damping: 20, stiffness: 400 }}
          className={`w-5 h-5 rounded-full ${
            checked ? 'bg-indigo-400 shadow-lg shadow-indigo-500/30' : 'bg-zinc-500'
          }`}
        />
      </motion.button>
    </div>
  );
}

// ─── Settings Panel ─────────────────────────────────────────────────

function SettingsPanel({
  open,
  onClose,
  settings,
  onUpdateSettings,
  onResetLayout,
  currentTab,
}: {
  open: boolean;
  onClose: () => void;
  settings: DashboardSettings;
  onUpdateSettings: (s: DashboardSettings) => void;
  onResetLayout: () => void;
  currentTab: TabKey;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          />

          <motion.aside
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring' as const, damping: 30, stiffness: 300, mass: 0.8 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-md z-[70] overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Dashboard Settings"
          >
            <div
              className="h-full flex flex-col"
              style={{
                background: 'linear-gradient(180deg, #111114 0%, #09090b 100%)',
                borderLeft: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center justify-between p-6 border-b border-white/[0.06]">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Customize your dashboard</p>
                </div>
                <IconButton
                  icon={<Icons.Close className="w-full h-full" />}
                  label="Close settings"
                  onClick={onClose}
                  variant="filled"
                />
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Layout</h3>
                    <Toggle
                      label="Grid Snapping"
                      description="Align widgets to the grid when dragging"
                      checked={settings.gridSnapping}
                      onChange={(v) => onUpdateSettings({ ...settings, gridSnapping: v })}
                    />
                    <Toggle
                      label="Compact Mode"
                      description="Reduce whitespace within widgets"
                      checked={settings.compactMode}
                      onChange={(v) => onUpdateSettings({ ...settings, compactMode: v })}
                    />
                  </div>

                  <div className="h-px bg-white/[0.06]" />

                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Appearance</h3>
                    <Toggle
                      label="Show Widget Titles"
                      description="Display titles inside chart widgets"
                      checked={settings.showWidgetTitles}
                      onChange={(v) => onUpdateSettings({ ...settings, showWidgetTitles: v })}
                    />
                  </div>

                  <div className="h-px bg-white/[0.06]" />

                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Regional</h3>
                    <GlassCard variant="default" padding="md">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-zinc-200 block">Currency</span>
                          <span className="text-xs text-zinc-500 block mt-0.5">All monetary values displayed in</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.10]">
                          <span className="text-lg font-semibold text-zinc-100">£</span>
                          <span className="text-sm font-medium text-zinc-300">GBP</span>
                        </div>
                      </div>
                    </GlassCard>
                  </div>

                  <div className="h-px bg-white/[0.06]" />

                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Danger Zone</h3>
                    <GlassCard variant="default" padding="md" className="!border-rose-500/15">
                      <p className="text-sm text-zinc-400 mb-3">
                        Reset the{' '}
                        <span className="text-zinc-200 font-medium capitalize">{currentTab}</span> tab to
                        its default widget layout.
                      </p>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          onResetLayout();
                          onClose();
                        }}
                        className="w-full"
                      >
                        Reset Layout
                      </Button>
                    </GlassCard>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-white/[0.06]">
                <Button variant="secondary" size="lg" onClick={onClose} className="w-full">
                  Done
                </Button>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Add Widget Panel ───────────────────────────────────────────────

function AddWidgetPanel({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (type: WidgetConfig['type']) => void;
}) {
  const [hoveredWidget, setHoveredWidget] = useState<string | null>(null);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          />

          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring' as const, damping: 30, stiffness: 300, mass: 0.8 }}
            className="fixed bottom-0 left-0 right-0 z-[70] max-h-[80vh] overflow-hidden rounded-t-3xl"
            style={{
              background: 'linear-gradient(180deg, #111114 0%, #09090b 100%)',
              borderTop: '1px solid rgba(255,255,255,0.10)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Add Widget"
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/[0.12]" />
            </div>

            <div className="flex items-center justify-between px-6 pb-4 border-b border-white/[0.06]">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">Add Widget</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Choose a widget to add to your dashboard</p>
              </div>
              <IconButton
                icon={<Icons.Close className="w-full h-full" />}
                label="Close"
                onClick={onClose}
                variant="filled"
              />
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {WIDGET_CATALOG.map((item, idx) => (
                  <motion.button
                    key={item.type}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03, ...tokens.transition.spring }}
                    onMouseEnter={() => setHoveredWidget(item.type)}
                    onMouseLeave={() => setHoveredWidget(null)}
                    onClick={() => {
                      onAdd(item.type);
                      onClose();
                    }}
                    className="group relative flex flex-col items-start gap-3 p-4 rounded-2xl text-left transition-all duration-200"
                    style={{
                      background: hoveredWidget === item.type ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${
                        hoveredWidget === item.type ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.06)'
                      }`,
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                      style={{
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.12) 100%)',
                        border: '1px solid rgba(99,102,241,0.25)',
                      }}
                    >
                      <span className="w-6 h-6 text-indigo-400">{widgetIcons[item.type]}</span>
                    </div>

                    <div>
                      <span className="text-sm font-semibold text-zinc-100 block">{item.label}</span>
                      <span className="text-xs text-zinc-500 block mt-0.5 line-clamp-2">{item.description}</span>
                    </div>

                    <div
                      className="absolute top-4 right-4 px-2 py-1 rounded-md text-[10px] font-mono text-zinc-400"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    >
                      {item.defaultW}×{item.defaultH}
                    </div>

                    {hoveredWidget === item.type && (
                      <motion.div
                        layoutId="widget-glow"
                        className="absolute inset-0 rounded-2xl pointer-events-none"
                        style={{ boxShadow: '0 0 40px rgba(99,102,241,0.12)' }}
                        transition={tokens.transition.spring}
                      />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Loading State ──────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <GlassCard key={i} padding="lg">
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <GlassCard key={i} padding="lg">
            <div className="space-y-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-48 w-full" />
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard Page ────────────────────────────────────────────

const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('main');
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);

  const stored = useMemo(() => loadState(), []);
  const [layouts, setLayouts] = useState<Record<string, WidgetConfig[]>>(stored.layouts);
  const [settings, setSettings] = useState<DashboardSettings>(stored.settings);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    saveState({ layouts, settings });
  }, [layouts, settings]);

  const layoutKey = `${activeTab}-${timeRange}`;

  const dashboardData = useMemo(() => {
    return getDashboardData(activeTab, timeRange);
  }, [activeTab, timeRange]);

  const demoData = useMemo(() => {
    return getDashboardData('playground', timeRange);
  }, [timeRange]);

  const gridData = useMemo(() => {
    return { ...demoData, ...dashboardData };
  }, [demoData, dashboardData]);

  const currentWidgets = useMemo(() => {
    const baseWidgets = layouts[layoutKey] || getDefaultLayout(activeTab);

    return baseWidgets.map((widget) => {
      const hasValidDataKey = !!widget.dataKey && gridData[widget.dataKey] !== undefined;
      if (hasValidDataKey) return widget;

      const fallbackEntry = CHART_REGISTRY.find((entry) => entry.widgetType === widget.type);
      if (!fallbackEntry) return widget;

      return {
        ...widget,
        title: widget.title || fallbackEntry.label,
        dataKey: fallbackEntry.key,
      };
    });
  }, [layouts, layoutKey, activeTab, gridData]);

  const handleUpdateWidgets = useCallback(
    (widgets: WidgetConfig[]) => {
      setLayouts((prev) => ({ ...prev, [layoutKey]: widgets }));
    },
    [layoutKey],
  );

  const handleRemoveWidget = useCallback(
    (id: string) => {
      setLayouts((prev) => ({
        ...prev,
        [layoutKey]: (prev[layoutKey] || currentWidgets).filter((w) => w.id !== id),
      }));
    },
    [layoutKey, currentWidgets],
  );

  const handleResetLayout = useCallback(() => {
    setLayouts((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key.startsWith(activeTab)) delete next[key];
      });
      return next;
    });
  }, [activeTab]);

  const handleAddWidget = useCallback(
    (type: WidgetConfig['type']) => {
      const catalog = WIDGET_CATALOG.find((c) => c.type === type);
      if (!catalog) return;

      const compatibleEntries = CHART_REGISTRY.filter((entry) => entry.widgetType === type);
      if (compatibleEntries.length === 0) return;

      const maxY =
        currentWidgets.length > 0 ? Math.max(...currentWidgets.map((w) => w.y + w.h)) : 0;

      const usedKeys = new Set(
        currentWidgets
          .filter((widget) => widget.type === type && widget.dataKey)
          .map((widget) => widget.dataKey),
      );

      const preferredEntry =
        compatibleEntries.find(
          (entry) =>
            Object.prototype.hasOwnProperty.call(dashboardData, entry.key) && !usedKeys.has(entry.key),
        ) ||
        compatibleEntries.find((entry) => Object.prototype.hasOwnProperty.call(dashboardData, entry.key)) ||
        compatibleEntries.find((entry) => !usedKeys.has(entry.key)) ||
        compatibleEntries[0];

      const colorOptions: WidgetColor[] = [
        'indigo', 'emerald', 'amber', 'sky', 'violet', 'rose', 'orange', 'cyan',
      ];

      const newWidget: WidgetConfig = {
        id: `${type}-${Date.now()}`,
        type,
        title: preferredEntry?.label || catalog.label,
        dataKey: preferredEntry?.key || '',
        x: 0,
        y: maxY,
        w: catalog.defaultW,
        h: catalog.defaultH,
        color: colorOptions[Math.floor(Math.random() * colorOptions.length)],
      };

      handleUpdateWidgets([...currentWidgets, newWidget]);
    },
    [currentWidgets, dashboardData, handleUpdateWidgets],
  );

  return (
    <>
      {/* Chart visibility CSS */}
      <style>{`
        .recharts-cartesian-axis-tick-value {
          fill: #9ca3af !important;
          font-size: 12px !important;
          font-weight: 500 !important;
        }
        .recharts-cartesian-axis-line,
        .recharts-cartesian-axis-tick-line {
          stroke: rgba(255,255,255,0.08) !important;
        }
        .recharts-cartesian-grid line,
        .recharts-cartesian-grid-horizontal line,
        .recharts-cartesian-grid-vertical line {
          stroke: rgba(255,255,255,0.05) !important;
        }
        .recharts-default-tooltip {
          background-color: #1e1e24 !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
          border-radius: 12px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
          padding: 12px 16px !important;
        }
        .recharts-tooltip-label {
          color: #e4e4e7 !important;
          font-weight: 600 !important;
          margin-bottom: 6px !important;
        }
        .recharts-tooltip-item {
          color: #d4d4d8 !important;
          font-size: 13px !important;
          padding: 2px 0 !important;
        }
        .recharts-tooltip-item-name {
          color: #a1a1aa !important;
        }
        .recharts-tooltip-item-value {
          color: #f4f4f5 !important;
          font-weight: 600 !important;
        }
        .recharts-legend-item-text {
          color: #d4d4d8 !important;
          font-size: 12px !important;
          font-weight: 500 !important;
        }
        .recharts-label {
          fill: #a1a1aa !important;
          font-size: 12px !important;
        }
        .recharts-reference-line line {
          stroke: rgba(255,255,255,0.12) !important;
        }
        .recharts-reference-line text {
          fill: #9ca3af !important;
        }
        .recharts-pie-label-text {
          fill: #e4e4e7 !important;
          font-size: 12px !important;
          font-weight: 500 !important;
        }
        .recharts-line-curve {
          filter: drop-shadow(0 0 4px rgba(99,102,241,0.3));
        }
        .recharts-area-curve {
          filter: drop-shadow(0 0 4px rgba(99,102,241,0.2));
        }
        .recharts-dot {
          filter: drop-shadow(0 0 3px rgba(99,102,241,0.4));
        }
        .apexcharts-text {
          fill: #9ca3af !important;
        }
        .apexcharts-gridline {
          stroke: rgba(255,255,255,0.05) !important;
        }
        .apexcharts-tooltip {
          background: #1e1e24 !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
          border-radius: 12px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
          color: #f4f4f5 !important;
        }
        .apexcharts-tooltip-title {
          background: rgba(255,255,255,0.04) !important;
          border-bottom: 1px solid rgba(255,255,255,0.06) !important;
          color: #e4e4e7 !important;
        }
        .apexcharts-legend-text {
          color: #d4d4d8 !important;
        }
        .nivo-axes text {
          fill: #9ca3af !important;
          font-size: 12px !important;
        }
        .nivo-grid line {
          stroke: rgba(255,255,255,0.05) !important;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>

      <div className="relative w-full">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Dashboard Header */}
          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...tokens.transition.spring, delay: 0.1 }}
            className="mb-8"
          >
            <div className="flex flex-col gap-6">
              {/* Title Row */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <motion.h1
                    className="text-2xl sm:text-3xl font-bold text-zinc-100 tracking-tight"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    Dashboard
                  </motion.h1>
                  <motion.p
                    className="text-sm text-zinc-400 mt-1 flex items-center gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    Your enterprise resource overview
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-xs text-zinc-500">
                      <span className="font-semibold text-zinc-400">£</span> GBP
                    </span>
                  </motion.p>
                </div>

                {/* Actions */}
                <motion.div
                  className="flex items-center gap-2 sm:gap-3"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <TimeRangeSelector value={timeRange} onChange={setTimeRange} />

                  <div className="h-6 w-px bg-white/[0.08] hidden sm:block" />

                  {/* PDF Download Button */}
                  <DownloadPDFButton
                    tab={activeTab}
                    timeRange={timeRange}
                    dashboardData={dashboardData}
                    widgets={currentWidgets}
                    settings={settings}
                    gridRef={gridRef}
                  />

                  <Button
                    variant="primary"
                    size="md"
                    icon={<Icons.Plus className="w-4 h-4" />}
                    onClick={() => setAddWidgetOpen(true)}
                    className="shadow-lg shadow-indigo-500/20"
                  >
                    <span className="hidden sm:inline">Add Widget</span>
                    <span className="sm:hidden">Add</span>
                  </Button>

                  <IconButton
                    icon={<Icons.Settings className="w-full h-full" />}
                    label="Open settings"
                    onClick={() => setSettingsOpen(true)}
                    variant="filled"
                  />
                </motion.div>
              </div>

              {/* Sub-Tabs */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <TabNav value={activeTab} onChange={setActiveTab} />
              </motion.div>
            </div>
          </motion.header>

          {/* Content */}
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <DashboardSkeleton />
              </motion.div>
            ) : (
              <motion.div
                key={layoutKey}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={tokens.transition.spring}
              >
                <div ref={gridRef}>
                  <GridLayout
                    widgets={currentWidgets}
                    data={gridData}
                    settings={settings}
                    onUpdateWidgets={handleUpdateWidgets}
                    onRemoveWidget={handleRemoveWidget}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Panels */}
        <SettingsPanel
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={setSettings}
          onResetLayout={handleResetLayout}
          currentTab={activeTab}
        />

        <AddWidgetPanel
          open={addWidgetOpen}
          onClose={() => setAddWidgetOpen(false)}
          onAdd={handleAddWidget}
        />
      </div>
    </>
  );
};

export default DashboardPage;
