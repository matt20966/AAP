// src/components/charts/HeatmapChart.tsx

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChartDefinition } from '../types/charts';
import { formatValue } from '../utils/chartEngine';

interface Props {
  data: any[];
  definition: ChartDefinition;
  colors: string[];
}

export default function HeatmapChart({ data, definition, colors }: Props) {
  const { mappings, yAxis } = definition;

  const { grid, xLabels, yLabels, minVal, maxVal } = useMemo(() => {
    if (!mappings.x || !mappings.y || !mappings.value) {
      return { grid: [], xLabels: [], yLabels: [], minVal: 0, maxVal: 1 };
    }

    const xSet = [...new Set(data.map(r => String(r[mappings.x!])))];
    const ySet = [...new Set(data.map(r => String(r[mappings.y!])))];

    const grid: { x: string; y: string; value: number }[] = [];
    let min = Infinity, max = -Infinity;

    xSet.forEach(xv => {
      ySet.forEach(yv => {
        const matching = data.filter(r => String(r[mappings.x!]) === xv && String(r[mappings.y!]) === yv);
        const val = matching.reduce((s, r) => s + (Number(r[mappings.value!]) || 0), 0);
        grid.push({ x: xv, y: yv, value: val });
        if (val < min) min = val;
        if (val > max) max = val;
      });
    });

    return { grid, xLabels: xSet, yLabels: ySet, minVal: min, maxVal: max };
  }, [data, mappings]);

  if (xLabels.length === 0 || yLabels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
        Configure X, Y, and Value fields
      </div>
    );
  }

  const getIntensity = (val: number) => {
    if (maxVal === minVal) return 0.5;
    return (val - minVal) / (maxVal - minVal);
  };

  const cellSize = Math.min(
    Math.floor(500 / Math.max(xLabels.length, 1)),
    Math.floor(300 / Math.max(yLabels.length, 1)),
    60
  );

  return (
    <div className="flex flex-col items-center justify-center h-full overflow-auto p-4">
      <div className="inline-block">
        {/* X headers */}
        <div className="flex" style={{ marginLeft: 80 }}>
          {xLabels.map(x => (
            <div
              key={x}
              className="text-[9px] text-zinc-500 font-medium text-center truncate"
              style={{ width: cellSize, padding: '0 2px' }}
            >
              {x}
            </div>
          ))}
        </div>

        {yLabels.map(yv => (
          <div key={yv} className="flex items-center">
            <div className="text-[9px] text-zinc-500 font-medium text-right pr-3 truncate" style={{ width: 80 }}>
              {yv}
            </div>
            {xLabels.map(xv => {
              const cell = grid.find(g => g.x === xv && g.y === yv);
              const intensity = cell ? getIntensity(cell.value) : 0;
              return (
                <motion.div
                  key={`${xv}-${yv}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.random() * 0.3 }}
                  className="border border-white/[0.04] rounded-sm flex items-center justify-center cursor-pointer hover:ring-1 hover:ring-white/20 transition-all"
                  style={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: `rgba(99, 102, 241, ${0.08 + intensity * 0.7})`,
                  }}
                  title={`${xv} × ${yv}: ${cell ? formatValue(cell.value, yAxis.tickFormat, yAxis.currency, yAxis.decimals) : '—'}`}
                >
                  <span className="text-[8px] font-mono text-zinc-300" style={{ opacity: 0.5 + intensity * 0.5 }}>
                    {cell ? Math.round(cell.value) : ''}
                  </span>
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
