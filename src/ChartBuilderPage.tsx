// ChartBuilderPage.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { withHtml2CanvasColorFix } from './utils/html2canvasSafe';
import { CHART_TYPES, COLOR_SCHEMES, DATA_SOURCES, formatBuilderNumber } from './data/chartBuilderShared';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChartConfig {
  id: string;
  title: string;
  subtitle: string;
  chartType: ChartType;
  dataSource: string;
  xAxis: string;
  yAxis: string[];
  aggregation: AggregationType;
  filters: FilterConfig[];
  style: ChartStyle;
}

type ChartType = 'bar' | 'bar-stacked' | 'bar-grouped' | 'line' | 'area' | 'pie' | 'donut' | 'kpi' | 'composed';

type AggregationType = 'sum' | 'average' | 'count' | 'min' | 'max' | 'none';

interface FilterConfig {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between' | 'in';
  value: string | number | [number, number];
}

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

// ─── Dashboard Data (Simulating your existing DashboardData) ────────────────

const formatNumber = formatBuilderNumber;

function aggregateData(data: any[], field: string, aggregation: AggregationType): number {
  const values = data.map(d => Number(d[field]) || 0);
  if (values.length === 0) return 0;
  switch (aggregation) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'average': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'count': return values.length;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    default: return values.reduce((a, b) => a + b, 0);
  }
}

// ─── Icon Component ─────────────────────────────────────────────────────────

function Icon({
  name,
  className = 'w-4 h-4',
  style,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const props = {
    className,
    style,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'bar-chart':
      return (<svg {...props}><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>);
    case 'trending-up':
      return (<svg {...props}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>);
    case 'activity':
      return (<svg {...props}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>);
    case 'grid':
      return (<svg {...props}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>);
    case 'zap':
      return (<svg {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>);
    case 'users':
      return (<svg {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
    case 'check':
      return (<svg {...props}><polyline points="20 6 9 17 4 12" /></svg>);
    case 'x':
      return (<svg {...props}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>);
    case 'chevron-down':
      return (<svg {...props}><polyline points="6 9 12 15 18 9" /></svg>);
    case 'chevron-up':
      return (<svg {...props}><polyline points="18 15 12 9 6 15" /></svg>);
    case 'chevron-right':
      return (<svg {...props}><polyline points="9 18 15 12 9 6" /></svg>);
    case 'download':
      return (<svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>);
    case 'save':
      return (<svg {...props}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>);
    case 'eye':
      return (<svg {...props}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>);
    case 'settings':
      return (<svg {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>);
    case 'palette':
      return (<svg {...props}><circle cx="13.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="10.5" r="1.5" /><circle cx="8.5" cy="7.5" r="1.5" /><circle cx="6.5" cy="12.5" r="1.5" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></svg>);
    case 'type':
      return (<svg {...props}><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>);
    case 'sliders':
      return (<svg {...props}><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>);
    case 'filter':
      return (<svg {...props}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>);
    case 'database':
      return (<svg {...props}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>);
    case 'layers':
      return (<svg {...props}><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>);
    case 'maximize':
      return (<svg {...props}><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>);
    case 'minimize':
      return (<svg {...props}><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" /></svg>);
    case 'refresh':
      return (<svg {...props}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>);
    case 'copy':
      return (<svg {...props}><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>);
    case 'plus':
      return (<svg {...props}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>);
    case 'minus':
      return (<svg {...props}><line x1="5" y1="12" x2="19" y2="12" /></svg>);
    case 'info':
      return (<svg {...props}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>);
    case 'sparkles':
      return (<svg {...props}><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" /></svg>);
    case 'arrow-up':
      return (<svg {...props}><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>);
    case 'arrow-down':
      return (<svg {...props}><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>);
    default:
      return (<svg {...props}><circle cx="12" cy="12" r="10" /></svg>);
  }
}

// ─── Step Indicator ─────────────────────────────────────────────────────────

function StepIndicator({ currentStep, steps }: { currentStep: number; steps: { label: string; icon: string }[] }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;
        return (
          <React.Fragment key={step.label}>
            <motion.div
              animate={isActive ? { scale: 1.05 } : { scale: 1 }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-300 ${
                isActive ? 'bg-violet-500/15 border border-violet-500/30 text-violet-300'
                : isCompleted ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-white/[0.02] border border-white/[0.06] text-zinc-600'
              }`}
            >
              {isCompleted ? (
                <Icon name="check" className="w-3.5 h-3.5" />
              ) : (
                <Icon name={step.icon} className="w-3.5 h-3.5" />
              )}
              <span className="text-[11px] font-semibold hidden sm:block">{step.label}</span>
            </motion.div>
            {index < steps.length - 1 && (
              <div className={`w-6 h-px ${isCompleted ? 'bg-emerald-500/30' : 'bg-white/[0.06]'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Collapsible Section ────────────────────────────────────────────────────

function CollapsibleSection({
  title, icon, children, defaultOpen = true, badge,
}: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean; badge?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-white/[0.01]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon name={icon} className="w-4 h-4 text-zinc-500" />
          <span className="text-[12px] font-semibold text-zinc-300">{title}</span>
          {badge && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
              {badge}
            </span>
          )}
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <Icon name="chevron-down" className="w-3.5 h-3.5 text-zinc-600" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-white/[0.04]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Select Component ───────────────────────────────────────────────────────

function Select({
  label, value, onChange, options, placeholder = 'Select...', icon,
}: {
  label?: string; value: string; onChange: (val: string) => void;
  options: { value: string; label: string; description?: string }[];
  placeholder?: string; icon?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative">
      {label && (
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em] mb-2 block">{label}</label>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-all duration-200 ${
          isOpen ? 'border-violet-500/30 bg-violet-500/[0.04] ring-2 ring-violet-500/10'
          : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.03]'
        }`}
      >
        {icon && <Icon name={icon} className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
        <span className={`text-[13px] font-medium flex-1 truncate ${selectedOption ? 'text-zinc-200' : 'text-zinc-600'}`}>
          {selectedOption?.label || placeholder}
        </span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <Icon name="chevron-down" className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1.5 py-1.5 rounded-xl border border-white/[0.08] bg-[#0e0e16]/98 backdrop-blur-xl shadow-2xl shadow-black/60 max-h-[240px] overflow-y-auto"
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => { onChange(option.value); setIsOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-all duration-150 ${
                  value === option.value
                    ? 'bg-violet-500/10 text-violet-300'
                    : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium truncate">{option.label}</div>
                  {option.description && (
                    <div className="text-[10px] text-zinc-600 truncate mt-0.5">{option.description}</div>
                  )}
                </div>
                {value === option.value && <Icon name="check" className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Multi-Select (Y-Axis) ─────────────────────────────────────────────────

function MultiSelect({
  label, values, onChange, options, maxSelect,
}: {
  label?: string; values: string[]; onChange: (vals: string[]) => void;
  options: { value: string; label: string }[]; maxSelect?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleValue = (val: string) => {
    if (values.includes(val)) {
      onChange(values.filter(v => v !== val));
    } else if (!maxSelect || values.length < maxSelect) {
      onChange([...values, val]);
    }
  };

  return (
    <div ref={ref} className="relative">
      {label && (
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em] mb-2 block">{label}</label>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-left transition-all duration-200 min-h-[42px] ${
          isOpen ? 'border-violet-500/30 bg-violet-500/[0.04] ring-2 ring-violet-500/10'
          : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.03]'
        }`}
      >
        <div className="flex-1 flex items-center gap-1.5 flex-wrap">
          {values.length === 0 ? (
            <span className="text-[13px] font-medium text-zinc-600">Select fields...</span>
          ) : (
            values.map(v => {
              const opt = options.find(o => o.value === v);
              return (
                <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-[10px] font-semibold text-violet-300">
                  {opt?.label}
                  <button onClick={(e) => { e.stopPropagation(); onChange(values.filter(x => x !== v)); }} className="hover:text-violet-200">
                    <Icon name="x" className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })
          )}
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <Icon name="chevron-down" className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1.5 py-1.5 rounded-xl border border-white/[0.08] bg-[#0e0e16]/98 backdrop-blur-xl shadow-2xl shadow-black/60 max-h-[200px] overflow-y-auto"
          >
            {options.map((option) => {
              const isSelected = values.includes(option.value);
              const isDisabled = !isSelected && maxSelect !== undefined && values.length >= maxSelect;
              return (
                <button
                  key={option.value}
                  onClick={() => !isDisabled && toggleValue(option.value)}
                  disabled={isDisabled}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-all duration-150 ${
                    isSelected ? 'bg-violet-500/10 text-violet-300'
                    : isDisabled ? 'text-zinc-700 cursor-not-allowed'
                    : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                    isSelected ? 'bg-violet-500/20 border-violet-500/40' : 'border-white/[0.1]'
                  }`}>
                    {isSelected && <Icon name="check" className="w-2.5 h-2.5 text-violet-400" />}
                  </div>
                  <span className="text-[12px] font-medium">{option.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Toggle Component ───────────────────────────────────────────────────────

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full py-1.5 group"
    >
      <span className="text-[11px] font-medium text-zinc-400 group-hover:text-zinc-300 transition-colors">{label}</span>
      <div className={`w-8 h-4.5 rounded-full transition-all duration-200 relative ${
        checked ? 'bg-violet-500/30 border-violet-500/40' : 'bg-white/[0.06] border-white/[0.1]'
      } border`}>
        <motion.div
          animate={{ x: checked ? 14 : 2 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className={`absolute top-0.5 w-3 h-3 rounded-full ${
            checked ? 'bg-violet-400' : 'bg-zinc-500'
          }`}
        />
      </div>
    </button>
  );
}

// ─── Slider Component ───────────────────────────────────────────────────────

function Slider({
  label, value, onChange, min = 0, max = 100, step = 1, unit = '',
}: {
  label: string; value: number; onChange: (val: number) => void;
  min?: number; max?: number; step?: number; unit?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-zinc-400">{label}</span>
        <span className="text-[11px] font-mono text-zinc-500">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer bg-white/[0.06] accent-violet-500
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400 [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-violet-500/50 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-violet-500/20
          [&::-webkit-slider-thumb]:hover:bg-violet-300 [&::-webkit-slider-thumb]:transition-all"
      />
    </div>
  );
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, numberFormat }: any) {
  if (!active || !payload) return null;
  return (
    <div className="bg-[#0c0c14]/95 backdrop-blur-xl border border-white/[0.1] rounded-xl px-4 py-3 shadow-2xl shadow-black/60">
      <p className="text-[11px] font-semibold text-zinc-300 mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 py-0.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[10px] text-zinc-500 font-medium">{entry.name}:</span>
          <span className="text-[11px] text-zinc-200 font-semibold">{formatNumber(entry.value, numberFormat)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card Preview ───────────────────────────────────────────────────────

function KPICardPreview({
  data, yAxis, style, title,
}: {
  data: any[]; yAxis: string[]; style: ChartStyle; title: string;
}) {
  void title;
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
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, type: 'spring', damping: 20, stiffness: 300 }}
          className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02] relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ background: `linear-gradient(to right, ${colors[i % colors.length]}, ${colors[(i + 1) % colors.length]})` }} />
          <div className="flex items-start justify-between mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${colors[i % colors.length]}15` }}>
              <Icon name={kpi.icon} className="w-4 h-4" style={{ color: colors[i % colors.length] } as any} />
            </div>
            {i === 3 && (
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                change >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
              }`}>
                <Icon name={change >= 0 ? 'arrow-up' : 'arrow-down'} className="w-2.5 h-2.5" />
                {Math.abs(change).toFixed(1)}%
              </div>
            )}
          </div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.1em]">{kpi.label}</p>
          <p className="text-[22px] font-bold text-zinc-100 tracking-[-0.03em] mt-1">
            {formatNumber(kpi.value, style.numberFormat)}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Chart Preview Renderer ─────────────────────────────────────────────────

function ChartPreview({
  config, data,
}: {
  config: ChartConfig; data: any[];
}) {
  const colors = COLOR_SCHEMES[config.style.colorScheme]?.colors || COLOR_SCHEMES.violet.colors;
  const { style } = config;
  const legendProps = (() => {
    switch (style.legendPosition) {
      case 'top':
        return { layout: 'horizontal' as const, align: 'center' as const, verticalAlign: 'top' as const };
      case 'left':
        return { layout: 'vertical' as const, align: 'left' as const, verticalAlign: 'middle' as const };
      case 'right':
        return { layout: 'vertical' as const, align: 'right' as const, verticalAlign: 'middle' as const };
      case 'bottom':
      default:
        return { layout: 'horizontal' as const, align: 'center' as const, verticalAlign: 'bottom' as const };
    }
  })();
  const processedData = useMemo(() => {
    if (config.aggregation === 'none' || !config.xAxis || config.yAxis.length === 0) {
      return data;
    }

    const groups = new Map<string, any[]>();
    data.forEach((row) => {
      const rawKey = row[config.xAxis];
      const key = String(rawKey ?? 'Unknown');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(row);
    });

    return Array.from(groups.values()).map((rows) => {
      const aggregated: Record<string, unknown> = {
        [config.xAxis]: rows[0]?.[config.xAxis] ?? 'Unknown',
      };
      config.yAxis.forEach((field) => {
        aggregated[field] = aggregateData(rows, field, config.aggregation);
      });
      return aggregated;
    });
  }, [config.aggregation, config.xAxis, config.yAxis, data]);

  if (!config.xAxis || config.yAxis.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
          <Icon name="bar-chart" className="w-7 h-7 text-zinc-700" />
        </div>
        <div className="text-center">
          <p className="text-[14px] font-semibold text-zinc-400">Configure your chart</p>
          <p className="text-[12px] text-zinc-600 mt-1">Select data source, axes, and chart type to see a preview</p>
        </div>
      </div>
    );
  }

  if (config.chartType === 'kpi') {
    return <KPICardPreview data={processedData} yAxis={config.yAxis} style={style} title={config.title} />;
  }

  const commonAxisProps = {
    tick: { fontSize: 11, fill: '#71717a', fontWeight: 500 },
    axisLine: { stroke: 'rgba(255,255,255,0.06)' },
    tickLine: false,
  };

  const renderChart = () => {
    switch (config.chartType) {
      case 'bar':
      case 'bar-grouped':
        return (
          <BarChart data={processedData} barGap={4}>
            {style.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />}
            <XAxis dataKey={config.xAxis} {...commonAxisProps} />
            <YAxis {...commonAxisProps} tickFormatter={(v) => formatNumber(v, style.numberFormat)} />
            {style.showTooltip && <Tooltip content={<CustomTooltip numberFormat={style.numberFormat} />} />}
            {style.showLegend && <Legend {...legendProps} wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />}
            {config.yAxis.map((field, i) => (
              <Bar
                key={field}
                dataKey={field}
                fill={colors[i % colors.length]}
                radius={[style.borderRadius, style.borderRadius, 0, 0]}
                fillOpacity={style.fillOpacity}
                isAnimationActive={style.animationEnabled}
                animationDuration={style.animationEnabled ? 800 : 0}
                label={style.showLabels ? { position: 'top', fill: '#a1a1aa', fontSize: 10 } : false}
              />
            ))}
          </BarChart>
        );

      case 'bar-stacked':
        return (
          <BarChart data={processedData}>
            {style.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />}
            <XAxis dataKey={config.xAxis} {...commonAxisProps} />
            <YAxis {...commonAxisProps} tickFormatter={(v) => formatNumber(v, style.numberFormat)} />
            {style.showTooltip && <Tooltip content={<CustomTooltip numberFormat={style.numberFormat} />} />}
            {style.showLegend && <Legend {...legendProps} wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />}
            {config.yAxis.map((field, i) => (
              <Bar
                key={field}
                dataKey={field}
                stackId="stack"
                fill={colors[i % colors.length]}
                fillOpacity={style.fillOpacity}
                radius={i === config.yAxis.length - 1 ? [style.borderRadius, style.borderRadius, 0, 0] : [0, 0, 0, 0]}
                isAnimationActive={style.animationEnabled}
                animationDuration={style.animationEnabled ? 800 : 0}
                label={style.showLabels ? { position: 'top', fill: '#a1a1aa', fontSize: 10 } : false}
              />
            ))}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart data={processedData}>
            {style.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />}
            <XAxis dataKey={config.xAxis} {...commonAxisProps} />
            <YAxis {...commonAxisProps} tickFormatter={(v) => formatNumber(v, style.numberFormat)} />
            {style.showTooltip && <Tooltip content={<CustomTooltip numberFormat={style.numberFormat} />} />}
            {style.showLegend && <Legend {...legendProps} wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />}
            {config.yAxis.map((field, i) => (
              <Line
                key={field}
                type={style.curveType}
                dataKey={field}
                stroke={colors[i % colors.length]}
                strokeWidth={style.strokeWidth}
                dot={{ fill: colors[i % colors.length], r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: colors[i % colors.length], strokeWidth: 2, fill: '#0c0c14' }}
                isAnimationActive={style.animationEnabled}
                animationDuration={style.animationEnabled ? 1000 : 0}
                label={style.showLabels ? { fill: '#a1a1aa', fontSize: 10 } : false}
              />
            ))}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart data={processedData}>
            <defs>
              {config.yAxis.map((field, i) => (
                <linearGradient key={field} id={`gradient-${field}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors[i % colors.length]} stopOpacity={style.fillOpacity} />
                  <stop offset="100%" stopColor={colors[i % colors.length]} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            {style.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />}
            <XAxis dataKey={config.xAxis} {...commonAxisProps} />
            <YAxis {...commonAxisProps} tickFormatter={(v) => formatNumber(v, style.numberFormat)} />
            {style.showTooltip && <Tooltip content={<CustomTooltip numberFormat={style.numberFormat} />} />}
            {style.showLegend && <Legend {...legendProps} wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />}
            {config.yAxis.map((field, i) => (
              <Area
                key={field}
                type={style.curveType}
                dataKey={field}
                stroke={colors[i % colors.length]}
                strokeWidth={style.strokeWidth}
                fill={style.gradientFill ? `url(#gradient-${field})` : colors[i % colors.length]}
                fillOpacity={style.gradientFill ? 1 : style.fillOpacity}
                isAnimationActive={style.animationEnabled}
                animationDuration={style.animationEnabled ? 1000 : 0}
                label={style.showLabels ? { fill: '#a1a1aa', fontSize: 10 } : false}
              />
            ))}
          </AreaChart>
        );

      case 'pie':
      case 'donut':
        const pieField = config.yAxis[0];
        if (!pieField) return null;
        return (
          <PieChart>
            {style.showTooltip && <Tooltip content={<CustomTooltip numberFormat={style.numberFormat} />} />}
            {style.showLegend && <Legend {...legendProps} wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />}
            <Pie
              data={processedData}
              dataKey={pieField}
              nameKey={config.xAxis}
              cx="50%"
              cy="50%"
              outerRadius={120}
              innerRadius={config.chartType === 'donut' ? 70 : 0}
              paddingAngle={2}
              isAnimationActive={style.animationEnabled}
              animationDuration={style.animationEnabled ? 800 : 0}
              label={style.showLabels ? ({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)` : false}
              labelLine={style.showLabels}
            >
              {processedData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} fillOpacity={style.fillOpacity} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
              ))}
            </Pie>
          </PieChart>
        );

      case 'composed':
        return (
          <ComposedChart data={processedData}>
            <defs>
              {config.yAxis.length > 0 && (
                <linearGradient id={`gradient-composed-0`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors[0]} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={colors[0]} stopOpacity={0.02} />
                </linearGradient>
              )}
            </defs>
            {style.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />}
            <XAxis dataKey={config.xAxis} {...commonAxisProps} />
            <YAxis {...commonAxisProps} tickFormatter={(v) => formatNumber(v, style.numberFormat)} />
            {style.showTooltip && <Tooltip content={<CustomTooltip numberFormat={style.numberFormat} />} />}
            {style.showLegend && <Legend {...legendProps} wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />}
            {config.yAxis.map((field, i) => {
              if (i === 0) {
                return (
                  <Bar
                    key={field}
                    dataKey={field}
                    fill={colors[i]}
                    fillOpacity={style.fillOpacity}
                    radius={[style.borderRadius, style.borderRadius, 0, 0]}
                    isAnimationActive={style.animationEnabled}
                    animationDuration={style.animationEnabled ? 800 : 0}
                    label={style.showLabels ? { position: 'top', fill: '#a1a1aa', fontSize: 10 } : false}
                  />
                );
              }
              return (
                <Line
                  key={field}
                  type={style.curveType}
                  dataKey={field}
                  stroke={colors[i % colors.length]}
                  strokeWidth={style.strokeWidth}
                  dot={{ fill: colors[i % colors.length], r: 3, strokeWidth: 0 }}
                  isAnimationActive={style.animationEnabled}
                  animationDuration={style.animationEnabled ? 1000 : 0}
                  label={style.showLabels ? { fill: '#a1a1aa', fontSize: 10 } : false}
                />
              );
            })}
          </ComposedChart>
        );

      default:
        return null;
    }
  };

  const chart = renderChart();
  if (!chart) return null;

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        {chart}
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Chart Builder Page ────────────────────────────────────────────────

export default function ChartBuilderPage() {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [activeConfigTab, setActiveConfigTab] = useState<'data' | 'style' | 'advanced'>('data');
  const [savedMessage, setSavedMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [config, setConfig] = useState<ChartConfig>({
    id: `chart-${Date.now()}`,
    title: 'Monthly Revenue Overview',
    subtitle: 'Revenue, expenses, and profit trends',
    chartType: 'bar',
    dataSource: 'salesByMonth',
    xAxis: 'month',
    yAxis: ['revenue'],
    aggregation: 'none',
    filters: [],
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

  const updateConfig = useCallback((partial: Partial<ChartConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }));
  }, []);

  const updateStyle = useCallback((partial: Partial<ChartStyle>) => {
    setConfig(prev => ({
      ...prev,
      style: { ...prev.style, ...partial },
    }));
  }, []);

  // Reset axes when data source changes
  const handleDataSourceChange = useCallback((source: string) => {
    const ds = DATA_SOURCES[source];
    if (!ds) return;
    const xField = ds.fields.find(f => f.type === 'string')?.key || ds.fields[0].key;
    const yField = ds.fields.find(f => f.type === 'number')?.key || '';
    updateConfig({
      dataSource: source,
      xAxis: xField,
      yAxis: yField ? [yField] : [],
    });
  }, [updateConfig]);

  // Adjust yAxis when chart type changes
  const handleChartTypeChange = useCallback((chartType: ChartType) => {
    const ct = CHART_TYPES.find(c => c.id === chartType);
    if (ct && !ct.multiY && config.yAxis.length > 1) {
      updateConfig({ chartType, yAxis: [config.yAxis[0]] });
    } else {
      updateConfig({ chartType });
    }
  }, [config.yAxis, updateConfig]);

  // Export to PDF
  const handleExportPDF = useCallback(async () => {
    if (!chartRef.current) {
      setErrorMessage('Chart preview is not ready yet.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    const rect = chartRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      setErrorMessage('Chart preview is hidden or not sized yet.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    setSavedMessage('');
    setErrorMessage('');
    setIsExporting(true);
    try {
      const canvas = await html2canvas(chartRef.current, withHtml2CanvasColorFix({
        backgroundColor: '#0c0c14',
        scale: 2,
        useCORS: true,
        logging: false,
      }));

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2 + 80],
      });

      // Title
      pdf.setFillColor(12, 12, 20);
      pdf.rect(0, 0, canvas.width / 2, canvas.height / 2 + 80, 'F');

      pdf.setFontSize(16);
      pdf.setTextColor(244, 244, 245);
      pdf.text(config.title || 'Chart Export', 30, 35);

      if (config.subtitle) {
        pdf.setFontSize(10);
        pdf.setTextColor(161, 161, 170);
        pdf.text(config.subtitle, 30, 52);
      }

      pdf.addImage(imgData, 'PNG', 15, 60, canvas.width / 2 - 30, (canvas.height / 2) - 20);

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(113, 113, 122);
      pdf.text(`Generated: ${new Date().toLocaleString()} · Merlin ERP`, 30, canvas.height / 2 + 70);

      const safeTitle = (config.title || 'chart')
        .trim()
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
        .replace(/\s+/g, '-')
        .slice(0, 80);

      pdf.save(`${safeTitle}-${Date.now()}.pdf`);
      setSavedMessage('PDF exported successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      setErrorMessage('Export failed. Check console for details.');
      setTimeout(() => setErrorMessage(''), 4000);
    } finally {
      setIsExporting(false);
    }
  }, [config.title, config.subtitle]);

  // Save chart
  const handleSave = useCallback(() => {
    const savedCharts = JSON.parse(localStorage.getItem('merlin_charts') || '[]');
    const existingIndex = savedCharts.findIndex((c: any) => c.id === config.id);
    if (existingIndex >= 0) {
      savedCharts[existingIndex] = config;
    } else {
      savedCharts.push(config);
    }
    localStorage.setItem('merlin_charts', JSON.stringify(savedCharts));
    setSavedMessage('Chart saved successfully!');
    setTimeout(() => setSavedMessage(''), 3000);
  }, [config]);

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
            <span className="px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-[9px] font-bold text-violet-400 uppercase tracking-wide">
              Beta
            </span>
          </div>
          <p className="text-[13px] text-zinc-500 leading-relaxed">Create, customize, and export data visualizations</p>
        </div>
        <div className="flex items-center gap-2">
          <StepIndicator currentStep={currentStep} steps={steps} />
        </div>
      </div>

      {/* Saved Message */}
      <AnimatePresence>
        {savedMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[12px] font-semibold"
          >
            <Icon name="check" className="w-4 h-4" />
            {savedMessage}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[12px] font-semibold"
          >
            <Icon name="x" className="w-4 h-4" />
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Layout */}
      <div className="flex flex-col xl:flex-row gap-5">
        {/* Left Panel - Configuration */}
        <motion.div
          layout
          className={`${showFullPreview ? 'hidden' : 'w-full xl:w-[380px]'} flex-shrink-0 space-y-4`}
        >
          {/* Config Tabs */}
          <div className="flex items-center gap-1 p-1 bg-white/[0.02] border border-white/[0.06] rounded-xl">
            {[
              { id: 'data' as const, label: 'Data', icon: 'database' },
              { id: 'style' as const, label: 'Style', icon: 'palette' },
              { id: 'advanced' as const, label: 'Advanced', icon: 'settings' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveConfigTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all duration-200 ${
                  activeConfigTab === tab.id
                    ? 'bg-violet-500/[0.12] text-violet-300 border border-violet-500/20'
                    : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                }`}
              >
                <Icon name={tab.icon} className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Data Tab */}
          <AnimatePresence mode="wait">
            {activeConfigTab === 'data' && (
              <motion.div
                key="data"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Data Source Selection */}
                <CollapsibleSection title="Data Source" icon="database">
                  <div className="space-y-2 mt-2">
                    {Object.entries(DATA_SOURCES).map(([key, source]) => (
                      <motion.button
                        key={key}
                        onClick={() => handleDataSourceChange(key)}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 ${
                          config.dataSource === key
                            ? 'bg-violet-500/[0.08] border-violet-500/25 ring-1 ring-violet-500/15'
                            : 'bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03] hover:border-white/[0.1]'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          config.dataSource === key ? 'bg-violet-500/15' : 'bg-white/[0.03]'
                        }`}>
                          <Icon name={source.icon} className={`w-4 h-4 ${
                            config.dataSource === key ? 'text-violet-400' : 'text-zinc-600'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[12px] font-semibold ${
                            config.dataSource === key ? 'text-zinc-200' : 'text-zinc-400'
                          }`}>
                            {source.label}
                          </p>
                          <p className="text-[10px] text-zinc-600 truncate">{source.description}</p>
                        </div>
                        {config.dataSource === key && (
                          <Icon name="check" className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                        )}
                      </motion.button>
                    ))}
                  </div>
                </CollapsibleSection>

                {/* Chart Type */}
                <CollapsibleSection title="Chart Type" icon="layers">
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {CHART_TYPES.map((ct) => (
                      <motion.button
                        key={ct.id}
                        onClick={() => handleChartTypeChange(ct.id)}
                        whileHover={{ scale: 1.03, y: -1 }}
                        whileTap={{ scale: 0.97 }}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 ${
                          config.chartType === ct.id
                            ? 'bg-violet-500/[0.1] border-violet-500/30 ring-1 ring-violet-500/15'
                            : 'bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03] hover:border-white/[0.1]'
                        }`}
                      >
                        <Icon name={ct.icon} className={`w-5 h-5 ${
                          config.chartType === ct.id ? 'text-violet-400' : 'text-zinc-600'
                        }`} />
                        <span className={`text-[10px] font-semibold ${
                          config.chartType === ct.id ? 'text-violet-300' : 'text-zinc-500'
                        }`}>
                          {ct.label}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </CollapsibleSection>

                {/* Axis Configuration */}
                <CollapsibleSection title="Axes" icon="sliders">
                  <div className="space-y-4 mt-2">
                    <Select
                      label="X-Axis (Category)"
                      value={config.xAxis}
                      onChange={(val) => updateConfig({ xAxis: val })}
                      options={allFields.map(f => ({ value: f.key, label: f.label }))}
                      icon="chevron-right"
                    />

                    {currentChartType?.multiY ? (
                      <MultiSelect
                        label="Y-Axis (Values)"
                        values={config.yAxis}
                        onChange={(vals) => updateConfig({ yAxis: vals })}
                        options={numericFields.map(f => ({ value: f.key, label: f.label }))}
                        maxSelect={6}
                      />
                    ) : (
                      <Select
                        label="Y-Axis (Value)"
                        value={config.yAxis[0] || ''}
                        onChange={(val) => updateConfig({ yAxis: [val] })}
                        options={numericFields.map(f => ({ value: f.key, label: f.label }))}
                        icon="chevron-right"
                      />
                    )}

                    <Select
                      label="Aggregation"
                      value={config.aggregation}
                      onChange={(val) => updateConfig({ aggregation: val as AggregationType })}
                      options={[
                        { value: 'none', label: 'No Aggregation', description: 'Use raw data values' },
                        { value: 'sum', label: 'Sum', description: 'Total of all values' },
                        { value: 'average', label: 'Average', description: 'Mean of all values' },
                        { value: 'count', label: 'Count', description: 'Number of records' },
                        { value: 'min', label: 'Minimum', description: 'Lowest value' },
                        { value: 'max', label: 'Maximum', description: 'Highest value' },
                      ]}
                    />
                  </div>
                </CollapsibleSection>
              </motion.div>
            )}

            {/* Style Tab */}
            {activeConfigTab === 'style' && (
              <motion.div
                key="style"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Title & Labels */}
                <CollapsibleSection title="Titles & Labels" icon="type">
                  <div className="space-y-3 mt-2">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em] mb-1.5 block">Chart Title</label>
                      <input
                        type="text"
                        value={config.title}
                        onChange={(e) => updateConfig({ title: e.target.value })}
                        placeholder="Enter chart title..."
                        className="w-full bg-white/[0.02] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-[13px] text-zinc-200 outline-none focus:border-violet-500/30 focus:ring-2 focus:ring-violet-500/10 transition-all placeholder:text-zinc-600 font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em] mb-1.5 block">Subtitle</label>
                      <input
                        type="text"
                        value={config.subtitle}
                        onChange={(e) => updateConfig({ subtitle: e.target.value })}
                        placeholder="Enter subtitle..."
                        className="w-full bg-white/[0.02] border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-[13px] text-zinc-200 outline-none focus:border-violet-500/30 focus:ring-2 focus:ring-violet-500/10 transition-all placeholder:text-zinc-600 font-medium"
                      />
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Color Scheme */}
                <CollapsibleSection title="Color Scheme" icon="palette">
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {Object.entries(COLOR_SCHEMES).map(([key, scheme]) => (
                      <motion.button
                        key={key}
                        onClick={() => updateStyle({ colorScheme: key })}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-200 ${
                          config.style.colorScheme === key
                            ? 'bg-violet-500/[0.08] border-violet-500/25 ring-1 ring-violet-500/15'
                            : 'bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex items-center gap-0.5">
                          {scheme.colors.slice(0, 4).map((color, i) => (
                            <div
                              key={i}
                              className="w-3.5 h-3.5 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <span className={`text-[10px] font-semibold ${
                          config.style.colorScheme === key ? 'text-violet-300' : 'text-zinc-500'
                        }`}>
                          {scheme.name}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </CollapsibleSection>

                {/* Number Format */}
                <CollapsibleSection title="Number Format" icon="type" defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      { value: 'number', label: '1,234', desc: 'Standard' },
                      { value: 'currency', label: '$1,234', desc: 'Currency' },
                      { value: 'percent', label: '12%', desc: 'Percentage' },
                      { value: 'compact', label: '1.2K', desc: 'Compact' },
                    ].map((fmt) => (
                      <button
                        key={fmt.value}
                        onClick={() => updateStyle({ numberFormat: fmt.value as any })}
                        className={`p-2.5 rounded-xl border text-center transition-all duration-200 ${
                          config.style.numberFormat === fmt.value
                            ? 'bg-violet-500/[0.08] border-violet-500/25 ring-1 ring-violet-500/15'
                            : 'bg-white/[0.01] border-white/[0.05] hover:bg-white/[0.03]'
                        }`}
                      >
                        <p className={`text-[14px] font-bold ${
                          config.style.numberFormat === fmt.value ? 'text-violet-300' : 'text-zinc-400'
                        }`}>{fmt.label}</p>
                        <p className="text-[9px] text-zinc-600 mt-0.5">{fmt.desc}</p>
                      </button>
                    ))}
                  </div>
                </CollapsibleSection>

                {/* Display Options */}
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

            {/* Advanced Tab */}
            {activeConfigTab === 'advanced' && (
              <motion.div
                key="advanced"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <CollapsibleSection title="Fine-Tune" icon="sliders">
                  <div className="space-y-4 mt-2">
                    <Slider
                      label="Fill Opacity"
                      value={Math.round(config.style.fillOpacity * 100)}
                      onChange={(v) => updateStyle({ fillOpacity: v / 100 })}
                      min={10}
                      max={100}
                      unit="%"
                    />
                    <Slider
                      label="Stroke Width"
                      value={config.style.strokeWidth}
                      onChange={(v) => updateStyle({ strokeWidth: v })}
                      min={1}
                      max={5}
                      unit="px"
                    />
                    <Slider
                      label="Border Radius"
                      value={config.style.borderRadius}
                      onChange={(v) => updateStyle({ borderRadius: v })}
                      min={0}
                      max={16}
                      unit="px"
                    />
                  </div>
                </CollapsibleSection>

                {(config.chartType === 'line' || config.chartType === 'area' || config.chartType === 'composed') && (
                  <CollapsibleSection title="Curve Type" icon="activity">
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {[
                        { value: 'linear', label: 'Linear' },
                        { value: 'monotone', label: 'Smooth' },
                        { value: 'step', label: 'Step' },
                      ].map((curve) => (
                        <button
                          key={curve.value}
                          onClick={() => updateStyle({ curveType: curve.value as any })}
                          className={`py-2 px-3 rounded-lg border text-[11px] font-semibold transition-all ${
                            config.style.curveType === curve.value
                              ? 'bg-violet-500/10 border-violet-500/25 text-violet-300'
                              : 'bg-white/[0.01] border-white/[0.05] text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {curve.label}
                        </button>
                      ))}
                    </div>
                  </CollapsibleSection>
                )}

                {config.style.showLegend && (
                  <CollapsibleSection title="Legend Position" icon="layers" defaultOpen={false}>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {['top', 'bottom', 'left', 'right'].map((pos) => (
                        <button
                          key={pos}
                          onClick={() => updateStyle({ legendPosition: pos as any })}
                          className={`py-2 px-3 rounded-lg border text-[11px] font-semibold capitalize transition-all ${
                            config.style.legendPosition === pos
                              ? 'bg-violet-500/10 border-violet-500/25 text-violet-300'
                              : 'bg-white/[0.01] border-white/[0.05] text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Data Summary */}
                <CollapsibleSection title="Data Summary" icon="info" defaultOpen={false}>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-[11px] text-zinc-500">Records</span>
                      <span className="text-[11px] font-mono text-zinc-300">{currentData.length}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-[11px] text-zinc-500">Fields</span>
                      <span className="text-[11px] font-mono text-zinc-300">{allFields.length}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-[11px] text-zinc-500">Source</span>
                      <span className="text-[11px] font-mono text-zinc-300">{currentDataSource?.label}</span>
                    </div>
                    {config.yAxis.map(field => {
                      const values = currentData.map(d => Number(d[field]) || 0);
                      return (
                        <div key={field} className="border-t border-white/[0.04] pt-2 mt-2">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.1em] mb-1.5">{field}</p>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                              <p className="text-[9px] text-zinc-600">Min</p>
                              <p className="text-[11px] font-bold text-zinc-300">{formatNumber(Math.min(...values), config.style.numberFormat)}</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                              <p className="text-[9px] text-zinc-600">Avg</p>
                              <p className="text-[11px] font-bold text-zinc-300">{formatNumber(values.reduce((a, b) => a + b, 0) / values.length, config.style.numberFormat)}</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-white/[0.02]">
                              <p className="text-[9px] text-zinc-600">Max</p>
                              <p className="text-[11px] font-bold text-zinc-300">{formatNumber(Math.max(...values), config.style.numberFormat)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleSection>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Right Panel - Chart Preview */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Preview Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-[14px] font-bold text-zinc-200">Live Preview</h3>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] font-bold text-emerald-400 uppercase">Live</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowFullPreview(!showFullPreview)}
                className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:border-white/[0.12] transition-all"
              >
                <Icon name={showFullPreview ? 'minimize' : 'maximize'} className="w-3.5 h-3.5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSave}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.12] transition-all text-[11px] font-semibold"
              >
                <Icon name="save" className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleExportPDF}
                disabled={isExporting}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all text-[11px] font-semibold ${
                  isExporting
                    ? 'bg-white/[0.02] border-white/[0.04] text-zinc-600 cursor-wait'
                    : 'bg-violet-500/15 border-violet-500/25 text-violet-300 hover:bg-violet-500/25 hover:border-violet-500/40'
                }`}
              >
                {isExporting ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  </motion.div>
                ) : (
                  <Icon name="download" className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export PDF'}</span>
              </motion.button>
            </div>
          </div>

          {/* Chart Preview Card */}
          <motion.div
            ref={chartRef}
            layout
            className="rounded-2xl bg-[#0c0c14]/90 border border-white/[0.06] relative overflow-hidden backdrop-blur-sm"
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

            {/* Chart Header */}
            <div className="px-6 pt-6 pb-2">
              {config.title && (
                <h3 className="text-[16px] font-bold text-zinc-100 tracking-[-0.02em]">
                  {config.title}
                </h3>
              )}
              {config.subtitle && (
                <p className="text-[12px] text-zinc-500 mt-1">{config.subtitle}</p>
              )}
              <div className="flex items-center gap-3 mt-3">
                {config.yAxis.map((field, i) => {
                  const colors = COLOR_SCHEMES[config.style.colorScheme]?.colors || [];
                  return (
                    <div key={field} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                      <span className="text-[10px] font-medium text-zinc-500 capitalize">{field}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart Area */}
            <div className="px-4 pb-6" style={{ height: config.chartType === 'kpi' ? 'auto' : 400 }}>
              <ChartPreview config={config} data={currentData} />
            </div>
          </motion.div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Duplicate', icon: 'copy', onClick: () => { updateConfig({ id: `chart-${Date.now()}`, title: config.title + ' (Copy)' }); } },
              { label: 'Reset', icon: 'refresh', onClick: () => {
                setConfig({
                  id: `chart-${Date.now()}`,
                  title: '',
                  subtitle: '',
                  chartType: 'bar',
                  dataSource: 'salesByMonth',
                  xAxis: 'month',
                  yAxis: ['revenue'],
                  aggregation: 'none',
                  filters: [],
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
              }},
              { label: 'Preview Data', icon: 'eye', onClick: () => {} },
              { label: 'Add to Dashboard', icon: 'plus', onClick: handleSave },
            ].map((action) => (
              <motion.button
                key={action.label}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={action.onClick}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all text-[11px] font-semibold"
              >
                <Icon name={action.icon} className="w-3.5 h-3.5" />
                {action.label}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


