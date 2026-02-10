// components/widgets/LineChartWidget.tsx

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChartData } from '../types/dashboard';

interface LineChartWidgetProps {
  data: ChartData;
  showTitle: boolean;
  title: string;
}

const LineChartWidget: React.FC<LineChartWidgetProps> = ({ data, showTitle, title }) => {
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

  const padding = { top: 20, right: 16, bottom: 28, left: 50 };
  const chartW = dims.w;
  const chartH = dims.h;
  const innerW = chartW - padding.left - padding.right;
  const innerH = chartH - padding.top - padding.bottom;

  const allValues = useMemo(() => data.series.flatMap((s) => s.data), [data]);
  const minVal = Math.min(...allValues) * 0.85;
  const maxVal = Math.max(...allValues) * 1.1;
  const range = maxVal - minVal || 1;

  const getY = (v: number) => padding.top + (1 - (v - minVal) / range) * innerH;
  const getX = (i: number) =>
    padding.left + (i / Math.max(data.labels.length - 1, 1)) * innerW;

  const buildPath = (values: number[]) => {
    return values
      .map((v, i) => {
        const x = getX(i);
        const y = getY(v);
        if (i === 0) return `M ${x} ${y}`;
        const px = getX(i - 1);
        const py = getY(values[i - 1]);
        const cx1 = px + (x - px) * 0.4;
        const cx2 = x - (x - px) * 0.4;
        return `C ${cx1} ${py} ${cx2} ${y} ${x} ${y}`;
      })
      .join(' ');
  };

  const yTicks = useMemo(() => {
    const tickCount = Math.max(3, Math.min(6, Math.floor(innerH / 40)));
    return Array.from({ length: tickCount }, (_, i) => {
      const val = minVal + (range * i) / (tickCount - 1);
      return { value: val, y: getY(val) };
    });
  }, [minVal, range, innerH]);

  const labelInterval = Math.max(1, Math.ceil(data.labels.length / Math.floor(innerW / 50)));

  return (
    <div className="h-full flex flex-col min-h-0">
      {showTitle && (
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
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
            {/* Grid lines */}
            {yTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={tick.y}
                  x2={chartW - padding.right}
                  y2={tick.y}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  fill="rgba(255,255,255,0.3)"
                  fontSize="10"
                  fontFamily="Inter, system-ui, sans-serif"
                >
                  {tick.value >= 1000
                    ? `$${(tick.value / 1000).toFixed(0)}K`
                    : `$${tick.value.toFixed(0)}`}
                </text>
              </g>
            ))}

            {/* X labels */}
            {data.labels.map((label, i) => {
              if (i % labelInterval !== 0) return null;
              return (
                <text
                  key={i}
                  x={getX(i)}
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

            {/* Hover line */}
            {hoverIdx !== null && (
              <line
                x1={getX(hoverIdx)}
                y1={padding.top}
                x2={getX(hoverIdx)}
                y2={chartH - padding.bottom}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            )}

            {/* Lines + area fills */}
            {data.series.map((series, si) => {
              const pathD = buildPath(series.data);
              const gradId = `line-grad-${si}-${title.replace(/\s/g, '')}`;
              const lastX = getX(series.data.length - 1);
              const firstX = getX(0);
              const bottomY = chartH - padding.bottom;
              const fillD = `${pathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

              return (
                <g key={si}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={series.color} stopOpacity="0.15" />
                      <stop offset="100%" stopColor={series.color} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={fillD} fill={`url(#${gradId})`} />
                  <path
                    d={pathD}
                    fill="none"
                    stroke={series.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.85"
                  />
                  {series.data.map((v, i) => (
                    <circle
                      key={i}
                      cx={getX(i)}
                      cy={getY(v)}
                      r={hoverIdx === i ? 5 : 0}
                      fill="#fff"
                      stroke={series.color}
                      strokeWidth={2}
                      opacity={hoverIdx === i ? 1 : 0}
                      style={{ transition: 'all 0.15s ease' }}
                    />
                  ))}
                </g>
              );
            })}

            {/* Hit areas */}
            {data.labels.map((_, i) => {
              const sliceW = innerW / data.labels.length;
              return (
                <rect
                  key={`hit-${i}`}
                  x={getX(i) - sliceW / 2}
                  y={0}
                  width={sliceW}
                  height={chartH}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                  className="cursor-crosshair"
                />
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
                    ${s.data[hoverIdx!].toLocaleString()}
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
            <div key={i} className="flex items-center gap-1.5 text-[10px] text-zinc-500">
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

export default LineChartWidget;