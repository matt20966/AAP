// src/components/charts/KPIChart.tsx

import React from 'react';
import { motion } from 'framer-motion';
import { ChartDefinition } from '../types/charts';
import { formatValue } from '../utils/chartEngine';

interface KPIChartProps {
  data: Record<string, any>[];
  definition: ChartDefinition;
  colors: string[];
}

export default function KPIChart({ data, definition, colors }: KPIChartProps) {
  const { mappings, yAxis } = definition;
  const valueField = mappings.value || mappings.y;

  if (!valueField || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
        No data
      </div>
    );
  }

  const total = data.reduce((s, r) => s + (Number(r[valueField]) || 0), 0);
  const halfLen = Math.floor(data.length / 2);
  const currentHalf = data.slice(halfLen);
  const previousHalf = data.slice(0, halfLen);
  const currentVal = currentHalf.reduce((s, r) => s + (Number(r[valueField]) || 0), 0);
  const previousVal = previousHalf.reduce((s, r) => s + (Number(r[valueField]) || 0), 0);

  const delta = previousVal > 0 ? ((currentVal - previousVal) / previousVal) * 100 : 0;
  const isPositive = delta >= 0;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20 }}
        className="text-4xl font-bold text-zinc-100 tracking-tight"
      >
        {formatValue(total, yAxis.tickFormat, yAxis.currency, yAxis.decimals)}
      </motion.div>
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
          isPositive
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
        }`}
      >
        <svg
          className={`w-3.5 h-3.5 ${isPositive ? '' : 'rotate-180'}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
        <span>{Math.abs(delta).toFixed(1)}% vs previous period</span>
      </motion.div>
      {mappings.x && (
        <span className="text-xs text-zinc-600 font-medium">
          {data.length} data points
        </span>
      )}
    </div>
  );
}
