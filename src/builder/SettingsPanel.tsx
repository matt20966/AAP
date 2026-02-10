// src/components/builder/SettingsPanel.tsx

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  ChartDefinition,
  ChartType,
  CHART_TYPE_INFO,
  NumberFormat,
  ThemePreset,
  StyleConfig,
  ReferenceLine,
  COLOR_PALETTES,
} from '../types/charts';

interface SettingsPanelProps {
  definition: ChartDefinition;
  onChange: (updates: Partial<ChartDefinition>) => void;
}

// Chart type icons
const CHART_ICONS: Record<ChartType, React.ReactNode> = {
  kpi: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v4l2.5 1.5"/><circle cx="12" cy="12" r="1"/>
    </svg>
  ),
  line: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 18 8 12 12 15 16 8 20 10"/>
    </svg>
  ),
  bar: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="6" y1="20" x2="6" y2="12"/><line x1="10" y1="20" x2="10" y2="8"/><line x1="14" y1="20" x2="14" y2="14"/><line x1="18" y1="20" x2="18" y2="6"/>
    </svg>
  ),
  'stacked-bar': (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="4" y="12" width="4" height="8" rx="1"/><rect x="4" y="8" width="4" height="4" rx="0" opacity="0.5"/><rect x="10" y="8" width="4" height="12" rx="1"/><rect x="10" y="4" width="4" height="4" rx="0" opacity="0.5"/><rect x="16" y="10" width="4" height="10" rx="1"/><rect x="16" y="6" width="4" height="4" rx="0" opacity="0.5"/>
    </svg>
  ),
  area: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 18l4-6 4 3 4-7 4 2v8H4z" fill="currentColor" opacity="0.15"/><polyline points="4 18 8 12 12 15 16 8 20 10" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  pie: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2a10 10 0 0 1 10 10h-10z"/><circle cx="12" cy="12" r="10"/>
    </svg>
  ),
  donut: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5"/><path d="M12 2a10 10 0 0 1 7.07 2.93l-3.54 3.54A5 5 0 0 0 12 7z"/>
    </svg>
  ),
  scatter: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="14" r="2" fill="currentColor" opacity="0.4"/><circle cx="12" cy="8" r="2" fill="currentColor" opacity="0.4"/><circle cx="17" cy="16" r="2" fill="currentColor" opacity="0.4"/><circle cx="15" cy="10" r="1.5" fill="currentColor" opacity="0.4"/><circle cx="9" cy="18" r="1.5" fill="currentColor" opacity="0.4"/>
    </svg>
  ),
  heatmap: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
      <rect x="3" y="3" width="5" height="5" rx="1" fill="currentColor" opacity="0.2"/><rect x="10" y="3" width="5" height="5" rx="1" fill="currentColor" opacity="0.5"/><rect x="17" y="3" width="4" height="5" rx="1" fill="currentColor" opacity="0.8"/><rect x="3" y="10" width="5" height="5" rx="1" fill="currentColor" opacity="0.6"/><rect x="10" y="10" width="5" height="5" rx="1" fill="currentColor" opacity="0.3"/><rect x="17" y="10" width="4" height="5" rx="1" fill="currentColor" opacity="0.7"/><rect x="3" y="17" width="5" height="4" rx="1" fill="currentColor" opacity="0.4"/><rect x="10" y="17" width="5" height="4" rx="1" fill="currentColor" opacity="0.9"/><rect x="17" y="17" width="4" height="4" rx="1" fill="currentColor" opacity="0.1"/>
    </svg>
  ),
  sankey: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="4" width="3" height="6" rx="1" fill="currentColor" opacity="0.4"/><rect x="2" y="14" width="3" height="6" rx="1" fill="currentColor" opacity="0.4"/><rect x="19" y="6" width="3" height="5" rx="1" fill="currentColor" opacity="0.4"/><rect x="19" y="14" width="3" height="4" rx="1" fill="currentColor" opacity="0.4"/><path d="M5 7c5 0 9 2 14 2" opacity="0.3"/><path d="M5 17c5 0 9-2 14-1" opacity="0.3"/>
    </svg>
  ),
};

const ChevronDown = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const PlusIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const TrashIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-[11px] text-zinc-400 font-medium group-hover:text-zinc-300 transition-colors">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-8 h-[18px] rounded-full transition-colors duration-200 ${
          checked ? 'bg-indigo-500' : 'bg-white/[0.08]'
        }`}
      >
        <motion.div
          animate={{ x: checked ? 14 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm"
        />
      </button>
    </label>
  );
}

function SectionAccordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/[0.06]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.1em] hover:text-zinc-400 transition-colors"
      >
        {title}
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SettingsPanel({ definition, onChange }: SettingsPanelProps) {
  const updateStyle = (updates: Partial<StyleConfig>) => {
    onChange({ style: { ...definition.style, ...updates } });
  };

  const addReferenceLine = () => {
    const newRef: ReferenceLine = {
      id: crypto.randomUUID(),
      label: 'Target',
      value: 0,
      color: '#f97316',
      type: 'line',
    };
    onChange({ referenceLines: [...definition.referenceLines, newRef] });
  };

  const updateReferenceLine = (id: string, updates: Partial<ReferenceLine>) => {
    onChange({
      referenceLines: definition.referenceLines.map(r => r.id === id ? { ...r, ...updates } : r),
    });
  };

  const removeReferenceLine = (id: string) => {
    onChange({ referenceLines: definition.referenceLines.filter(r => r.id !== id) });
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Chart Type Picker */}
      <SectionAccordion title="Chart Type" defaultOpen>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(CHART_TYPE_INFO) as ChartType[]).map(type => {
            const info = CHART_TYPE_INFO[type];
            const active = definition.chartType === type;
            return (
              <motion.button
                key={type}
                whileTap={{ scale: 0.96 }}
                onClick={() => onChange({ chartType: type })}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left transition-all ${
                  active
                    ? 'border-indigo-500/30 bg-indigo-500/[0.08] text-indigo-300'
                    : 'border-white/[0.06] text-zinc-500 hover:text-zinc-400 hover:border-white/[0.1]'
                }`}
              >
                <span className="flex-shrink-0">{CHART_ICONS[type]}</span>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold block truncate">{info.label}</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </SectionAccordion>

      {/* Title & Subtitle */}
      <SectionAccordion title="Labels" defaultOpen>
        <div>
          <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider block mb-1">Title</label>
          <input
            type="text"
            value={definition.title}
            onChange={e => onChange({ title: e.target.value })}
            placeholder="Chart title..."
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-2 text-[11px] text-zinc-300 font-medium outline-none focus:border-indigo-500/30 placeholder:text-zinc-700"
          />
        </div>
        <div>
          <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider block mb-1">Subtitle</label>
          <input
            type="text"
            value={definition.subtitle}
            onChange={e => onChange({ subtitle: e.target.value })}
            placeholder="Optional subtitle..."
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-2 text-[11px] text-zinc-300 font-medium outline-none focus:border-indigo-500/30 placeholder:text-zinc-700"
          />
        </div>
      </SectionAccordion>

      {/* X Axis */}
      <SectionAccordion title="X Axis">
        <Toggle checked={definition.xAxis.show} onChange={v => onChange({ xAxis: { ...definition.xAxis, show: v } })} label="Show axis" />
        <div>
          <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider block mb-1">Label</label>
          <input
            type="text"
            value={definition.xAxis.label}
            onChange={e => onChange({ xAxis: { ...definition.xAxis, label: e.target.value } })}
            placeholder="Axis label..."
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-2 text-[11px] text-zinc-300 font-medium outline-none placeholder:text-zinc-700"
          />
        </div>
        <Toggle checked={definition.xAxis.rotateTicks} onChange={v => onChange({ xAxis: { ...definition.xAxis, rotateTicks: v } })} label="Rotate tick labels" />
      </SectionAccordion>

      {/* Y Axis */}
      <SectionAccordion title="Y Axis">
        <Toggle checked={definition.yAxis.show} onChange={v => onChange({ yAxis: { ...definition.yAxis, show: v } })} label="Show axis" />
        <div>
          <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider block mb-1">Label</label>
          <input
            type="text"
            value={definition.yAxis.label}
            onChange={e => onChange({ yAxis: { ...definition.yAxis, label: e.target.value } })}
            placeholder="Axis label..."
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-2 text-[11px] text-zinc-300 font-medium outline-none placeholder:text-zinc-700"
          />
        </div>
        <div>
          <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider block mb-1">Format</label>
          <div className="flex gap-1">
            {(['number', 'currency', 'percent'] as NumberFormat[]).map(fmt => (
              <button
                key={fmt}
                onClick={() => onChange({ yAxis: { ...definition.yAxis, tickFormat: fmt } })}
                className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold capitalize border transition-all ${
                  definition.yAxis.tickFormat === fmt
                    ? 'bg-indigo-500/[0.1] border-indigo-500/20 text-indigo-400'
                    : 'border-white/[0.06] text-zinc-600 hover:text-zinc-400'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>
        {definition.yAxis.tickFormat === 'currency' && (
          <div>
            <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider block mb-1">Currency</label>
            <select
              value={definition.yAxis.currency}
              onChange={e => onChange({ yAxis: { ...definition.yAxis, currency: e.target.value } })}
              className="w-full appearance-none bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-2 text-[11px] text-zinc-300 font-medium outline-none"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="JPY">JPY (¥)</option>
            </select>
          </div>
        )}
        <div>
          <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider block mb-1">Decimals</label>
          <input
            type="number"
            min={0}
            max={4}
            value={definition.yAxis.decimals}
            onChange={e => onChange({ yAxis: { ...definition.yAxis, decimals: Number(e.target.value) } })}
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-2 text-[11px] text-zinc-300 font-medium outline-none"
          />
        </div>
      </SectionAccordion>

      {/* Series */}
    </div>
  );
}

