// components/widgets/PieChartWidget.tsx

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PieSlice } from '../types/dashboard';

interface PieChartWidgetProps {
  data: PieSlice[];
  showTitle: boolean;
  title: string;
}

const PieChartWidget: React.FC<PieChartWidgetProps> = ({
  data,
  showTitle,
  title,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 300, h: 200 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setContainerSize({ w: Math.round(width), h: Math.round(height) });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const total = data.reduce((s, d) => s + d.value, 0);

  // Size the donut to fit the available height
  const chartSize = Math.min(containerSize.h, containerSize.w * 0.45, 160);
  const outerR = chartSize / 2 - 4;
  const innerR = outerR * 0.65;
  const cx = chartSize / 2;
  const cy = chartSize / 2;

  const slices = data.map((slice, i) => {
    const startAngle = data
      .slice(0, i)
      .reduce((s, d) => s + (d.value / total) * 360, -90);
    const sweepAngle = (slice.value / total) * 360;
    return { ...slice, startAngle, sweepAngle, pct: (slice.value / total) * 100 };
  });

  function describeArc(
    x: number,
    y: number,
    outerRadius: number,
    innerRadius: number,
    startAngle: number,
    endAngle: number
  ): string {
    const toRad = (a: number) => (a * Math.PI) / 180;
    const outerStart = {
      x: x + outerRadius * Math.cos(toRad(startAngle)),
      y: y + outerRadius * Math.sin(toRad(startAngle)),
    };
    const outerEnd = {
      x: x + outerRadius * Math.cos(toRad(endAngle)),
      y: y + outerRadius * Math.sin(toRad(endAngle)),
    };
    const innerStart = {
      x: x + innerRadius * Math.cos(toRad(endAngle)),
      y: y + innerRadius * Math.sin(toRad(endAngle)),
    };
    const innerEnd = {
      x: x + innerRadius * Math.cos(toRad(startAngle)),
      y: y + innerRadius * Math.sin(toRad(startAngle)),
    };
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerStart.x} ${innerStart.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
      'Z',
    ].join(' ');
  }

  // Decide layout: side-by-side if wide enough, stacked if narrow
  const isWide = containerSize.w > 280;

  return (
    <div className="h-full flex flex-col min-h-0">
      {showTitle && (
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-indigo-400" />
          <span className="text-xs font-bold text-zinc-300 truncate">{title}</span>
        </div>
      )}

      <div
        ref={containerRef}
        className={`flex-1 flex min-h-0 ${
          isWide ? 'flex-row items-center gap-4' : 'flex-col items-center gap-2'
        }`}
      >
        {/* Donut */}
        <div
          className="flex-shrink-0 relative"
          style={{ width: chartSize, height: chartSize }}
        >
          <svg
            width={chartSize}
            height={chartSize}
            viewBox={`0 0 ${chartSize} ${chartSize}`}
            className="overflow-visible"
          >
            {slices.map((slice, i) => {
              const isHovered = hoverIdx === i;
              const midAngle = slice.startAngle + slice.sweepAngle / 2;
              const rad = (midAngle * Math.PI) / 180;
              const offset = isHovered ? 3 : 0;
              const tx = Math.cos(rad) * offset;
              const ty = Math.sin(rad) * offset;

              return (
                <path
                  key={i}
                  d={describeArc(
                    cx,
                    cy,
                    outerR,
                    innerR,
                    slice.startAngle,
                    slice.startAngle + slice.sweepAngle
                  )}
                  fill={slice.color}
                  opacity={hoverIdx === null || isHovered ? 0.8 : 0.3}
                  transform={`translate(${tx}, ${ty})`}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                  className="cursor-pointer"
                  style={{ transition: 'all 0.2s ease' }}
                />
              );
            })}
            {/* Center text */}
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              fill="rgba(255,255,255,0.8)"
              fontSize={Math.max(outerR * 0.3, 12)}
              fontWeight="800"
              fontFamily="Inter, system-ui, sans-serif"
            >
              {hoverIdx !== null
                ? `${slices[hoverIdx].pct.toFixed(1)}%`
                : `$${(total / 1000).toFixed(0)}K`}
            </text>
            <text
              x={cx}
              y={cy + Math.max(outerR * 0.15, 8)}
              textAnchor="middle"
              fill="rgba(255,255,255,0.35)"
              fontSize={Math.max(outerR * 0.15, 9)}
              fontFamily="Inter, system-ui, sans-serif"
            >
              {hoverIdx !== null ? slices[hoverIdx].name : 'Total'}
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div
          className={`min-w-0 overflow-auto ${
            isWide ? 'flex-1 space-y-1' : 'w-full flex flex-wrap gap-x-4 gap-y-1 justify-center'
          }`}
        >
          {slices.map((slice, i) => (
            <motion.div
              key={i}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              whileHover={{ x: isWide ? 2 : 0 }}
              className={`flex items-center gap-2 py-1 px-2 rounded-lg cursor-pointer transition-colors duration-150 ${
                hoverIdx === i ? 'bg-white/[0.04]' : ''
              }`}
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: slice.color, opacity: 0.8 }}
              />
              <span className="text-[10px] text-zinc-400 truncate">
                {slice.name}
              </span>
              <span className="text-[10px] font-bold text-zinc-300 tabular-nums ml-auto">
                {slice.pct.toFixed(1)}%
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PieChartWidget;