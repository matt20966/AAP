// src/components/builder/PreviewPanel.tsx

import React, { useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  ChartDefinition,
  Dataset,
  ChartType,
} from '../types/charts';
import {
  processData,
  buildRechartsData,
  getChartColors,
  getValidationErrors,
} from '../utils/chartEngine';

import KPIChart from '../charts/KPIChart';
import LineChartComponent from '../charts/LineChartComponent';
import BarChartComponent from '../charts/BarChartComponent';
import AreaChartComponent from '../charts/AreaChartComponent';
import PieChartComponent from '../charts/PieChartComponent';
import ScatterChartComponent from '../charts/ScatterChartComponent';
import HeatmapChart from '../charts/HeatmapChart';
import SankeyChartComponent from '../charts/SankeyChartComponent';

interface PreviewPanelProps {
  definition: ChartDefinition;
  dataset: Dataset | null;
  zoomMode: 'fit' | '1:1';
  onZoomToggle: () => void;
}

// Icons
const ZoomFitIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
  </svg>
);
const ZoomActualIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
  </svg>
);
const AlertIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const BarChartIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>
  </svg>
);

export default function PreviewPanel({ definition, dataset, zoomMode, onZoomToggle }: PreviewPanelProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const colors = getChartColors(definition.style.colorPalette);
  const errors = getValidationErrors(definition);

  const { processedData, chartData, seriesKeys } = useMemo(() => {
    if (!dataset || errors.length > 0) {
      return { processedData: [], chartData: [], seriesKeys: [] };
    }
    const processed = processData(dataset, definition);
    const { data, seriesKeys } = buildRechartsData(processed, definition.mappings, definition.chartType);
    return { processedData: processed, chartData: data, seriesKeys };
  }, [dataset, definition, errors]);

  const renderChart = () => {
    if (!dataset) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
            <BarChartIcon />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-zinc-400">No chart configured</p>
            <p className="text-[11px] text-zinc-600 mt-1">Select a dataset and map fields to get started</p>
          </div>
        </div>
      );
    }

    if (errors.length > 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/[0.06] border border-amber-500/15 flex items-center justify-center">
            <AlertIcon />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-zinc-400">Configuration needed</p>
            <div className="mt-2 space-y-1">
              {errors.map((err, i) => (
                <p key={i} className="text-[11px] text-amber-400/70 flex items-center gap-1.5 justify-center">
                  <span className="w-1 h-1 rounded-full bg-amber-500/50 flex-shrink-0" />
                  {err}
                </p>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (chartData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
          <p className="text-[12px] text-zinc-500">No data after applying filters</p>
        </div>
      );
    }

    const props = { data: chartData, seriesKeys, definition, colors };

    switch (definition.chartType) {
      case 'kpi': return <KPIChart data={processedData} definition={definition} colors={colors} />;
      case 'line': return <LineChartComponent {...props} />;
      case 'bar':
      case 'stacked-bar': return <BarChartComponent {...props} />;
      case 'area': return <AreaChartComponent {...props} />;
      case 'pie':
      case 'donut': return <PieChartComponent data={chartData} definition={definition} colors={colors} />;
      case 'scatter': return <ScatterChartComponent data={processedData} definition={definition} colors={colors} />;
      case 'heatmap': return <HeatmapChart data={processedData} definition={definition} colors={colors} />;
      case 'sankey': return <SankeyChartComponent data={processedData} definition={definition} colors={colors} />;
      default: return <p className="text-zinc-500 text-sm text-center">Unsupported chart type</p>;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div>
          <h3 className="text-[13px] font-bold text-zinc-200 tracking-[-0.01em]">
            {definition.title || 'Chart Preview'}
          </h3>
          {definition.subtitle && (
            <p className="text-[10px] text-zinc-500 font-medium mt-0.5">{definition.subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {processedData.length > 0 && (
            <span className="text-[9px] font-bold text-zinc-600 bg-white/[0.04] px-2 py-1 rounded-lg">
              {processedData.length} rows
            </span>
          )}
          <button
            onClick={onZoomToggle}
            className={`p-1.5 rounded-lg border transition-all ${
              zoomMode === '1:1'
                ? 'border-indigo-500/20 bg-indigo-500/[0.06] text-indigo-400'
                : 'border-white/[0.06] text-zinc-500 hover:text-zinc-400'
            }`}
            title={zoomMode === 'fit' ? 'Switch to 1:1' : 'Switch to fit'}
          >
            {zoomMode === 'fit' ? <ZoomFitIcon /> : <ZoomActualIcon />}
          </button>
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 p-4 overflow-hidden">
        <div
          ref={chartRef}
          className={`w-full h-full rounded-2xl border transition-all ${
            definition.style.showBorder ? 'border-white/[0.08]' : 'border-transparent'
          } ${
            definition.style.showShadow ? 'shadow-xl shadow-black/20' : ''
          } ${
            definition.style.compactPadding ? 'p-3' : 'p-5'
          } bg-[#0c0c12]`}
          style={zoomMode === '1:1' ? { minWidth: 600, minHeight: 400 } : undefined}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`${definition.chartType}-${definition.datasetId}-${JSON.stringify(definition.mappings)}`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full"
            >
              {renderChart()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
