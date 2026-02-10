// components/widgets/BarChartWidget.tsx

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChartData } from '../types/dashboard';

interface BarChartWidgetProps {
  data: ChartData;
  showTitle: boolean;
  title: string;
  stacked?: boolean;
}

const BarChartWidget: React.FC<BarChartWidgetProps> = ({
  data,
  showTitle,
  title,
  stacked = false,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 400, h: 200 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDims({ w: Math.round(width), h: Math.round(height) });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const padding = { top: 12, right: 16, bottom: 28, left: 50 };
  const chartW = dims.w;
  const chartH = dims.h;
  const innerW = chartW - padding.left - padding.right;
  const innerH = chartH - padding.top - padding.bottom;

  let maxVal: number;
  if (stacked && data.series.length > 1) {
    maxVal =
      Math.max(
        ...data.labels.map((_, i) =>
          data.series.reduce((sum, s) => sum + s.data[i], 0)
        )
      ) * 1.1;
  } else {
    maxVal = Math.max(...data.series.flatMap((s) => s.data)) * 1.1;
  }

  const barGroupW = innerW / data.labels.length;
  const gapRatio = 0.3;
  const gap = barGroupW * gapRatio;
  const barW = stacked
    ? barGroupW - gap
    : (barGroupW - gap) / data.series.length;

  const labelInterval = Math.max(
    1,
    Math.ceil(data.labels.length / Math.floor(innerW / 50))
  );
  const yTickCount = Math.max(3, Math.min(6, Math.floor(innerH / 40)));

  return (
    <div className="h-full flex flex-col min-h-0">
      {showTitle && (
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-xs font-bold text-zinc-300 truncate">{title}</span>
        </div>
      )}

      <div ref={containerRef} className="flex-1 relative min-h-0">
        {innerW > 10 && innerH > 10 && (
          <svg
            width={chartW}
            height={chartH}
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="absolute inset-0"
            onMouseLeave={() => setHoverIdx(null)}
          >
            {/* Y grid */}
            {Array.from({ length: yTickCount }, (_, i) => {
              const val = (maxVal * i) / (yTickCount - 1);
              const y = padding.top + innerH - (val / maxVal) * innerH;
              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={chartW - padding.right}
                    y2={y}
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    fill="rgba(255,255,255,0.3)"
                    fontSize="10"
                    fontFamily="Inter, system-ui, sans-serif"
                  >
                    {val >= 1000
                      ? `${(val / 1000).toFixed(0)}K`
                      : val.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/* X labels */}
            {data.labels.map((label, i) => {
              if (i % labelInterval !== 0) return null;
              const x = padding.left + i * barGroupW + barGroupW / 2;
              return (
                <text
                  key={i}
                  x={x}
                  y={chartH - 8}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.3)"
                  fontSize="10"
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {label}
                </text>
              );
            })}

            {/* Bars */}
            {data.labels.map((_, i) => {
              const groupX = padding.left + i * barGroupW + gap / 2;
              const isHovered = hoverIdx === i;

              if (stacked) {
                let accH = 0;
                return (
                  <g
                    key={i}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                    className="cursor-pointer"
                  >
                    {data.series.map((s, si) => {
                      const barH = (s.data[i] / maxVal) * innerH;
                      const y = padding.top + innerH - accH - barH;
                      accH += barH;
                      const cornerR = Math.min(barW / 3, 4);
                      return (
                        <rect
                          key={si}
                          x={groupX}
                          y={y}
                          width={Math.max(barW, 2)}
                          height={Math.max(barH, 1)}
                          rx={cornerR}
                          fill={s.color}
                          opacity={isHovered ? 0.9 : 0.55}
                          style={{ transition: 'opacity 0.15s ease' }}
                        />
                      );
                    })}
                    <rect
                      x={groupX}
                      y={padding.top}
                      width={barW}
                      height={innerH}
                      fill="transparent"
                    />
                  </g>
                );
              }

              return (
                <g
                  key={i}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                  className="cursor-pointer"
                >
                  {data.series.map((s, si) => {
                    const barH = (s.data[i] / maxVal) * innerH;
                    const x = groupX + si * barW;
                    const y = padding.top + innerH - barH;
                    const cornerR = Math.min(barW / 3, 4);
                    return (
                      <rect
                        key={si}
                        x={x}
                        y={y}
                        width={Math.max(barW - 1, 2)}
                        height={Math.max(barH, 1)}
                        rx={cornerR}
                        fill={s.color}
                        opacity={isHovered ? 0.9 : 0.55}
                        style={{ transition: 'opacity 0.15s ease' }}
                      />
                    );
                  })}
                  <rect
                    x={groupX}
                    y={padding.top}
                    width={barGroupW - gap}
                    height={innerH}
                    fill="transparent"
                  />
                </g>
              );
            })}
          </svg>
        )}

        {/* Tooltip */}
        <AnimatePresence>
          {hoverIdx !== null && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="absolute top-2 right-2 z-20 pointer-events-none"
              style={{
                background:
                  'linear-gradient(135deg, rgba(20,20,30,0.97), rgba(15,15,25,0.97))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '8px 12px',
                boxShadow: '0 12px 40px -8px rgba(0,0,0,0.6)',
              }}
            >
              <div className="text-[10px] text-zinc-500 font-mono mb-1">
                {data.labels[hoverIdx]}
              </div>
              {data.series.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-zinc-400">{s.name}:</span>
                  <span className="font-bold text-zinc-200 tabular-nums">
                    {s.data[hoverIdx!].toLocaleString()}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      {data.series.length > 1 && (
        <div className="flex items-center gap-4 mt-2 flex-shrink-0 flex-wrap">
          {data.series.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 text-[10px] text-zinc-500"
            >
              <div
                className="w-3 h-1.5 rounded-full"
                style={{ backgroundColor: s.color, opacity: 0.7 }}
              />
              <span className="font-medium">{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BarChartWidget;