// components/widgets/SankeyWidget.tsx

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SankeyData } from '../types/dashboard';

interface SankeyWidgetProps {
  data: SankeyData;
  showTitle: boolean;
  title: string;
}

const SankeyWidget: React.FC<SankeyWidgetProps> = ({ data, showTitle, title }) => {
  const [hoverLink, setHoverLink] = useState<number | null>(null);
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

  const chartW = dims.w;
  const chartH = dims.h;
  const nodeW = Math.max(6, chartW * 0.02);
  const padding = { x: 20, y: 16 };

  const nodeCount = data.nodes.length;
  const xSpacing =
    (chartW - 2 * padding.x - nodeW) / Math.max(nodeCount - 1, 1);

  const nodePositions = data.nodes.map((node, i) => ({
    ...node,
    x: padding.x + i * xSpacing,
    y: padding.y,
    h: chartH - 2 * padding.y - 16, // leave room for labels
  }));

  const maxLinkVal = Math.max(...data.links.map((l) => l.value), 1);
  const getNodeByID = (id: string) => nodePositions.find((n) => n.id === id);

  return (
    <div className="h-full flex flex-col min-h-0">
      {showTitle && (
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-sky-400" />
          <span className="text-xs font-bold text-zinc-300 truncate">{title}</span>
        </div>
      )}

      <div ref={containerRef} className="flex-1 relative min-h-0">
        {chartW > 40 && chartH > 40 && (
          <svg
            width={chartW}
            height={chartH}
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="absolute inset-0 overflow-visible"
          >
            {/* Links */}
            {data.links.map((link, i) => {
              const source = getNodeByID(link.source);
              const target = getNodeByID(link.target);
              if (!source || !target) return null;

              const linkH =
                (link.value / maxLinkVal) * source.h * 0.6;
              const sy = source.y + (source.h - linkH) / 2;
              const ty = target.y + (target.h - linkH) / 2;

              const sx = source.x + nodeW;
              const tx = target.x;
              const cx1 = sx + (tx - sx) * 0.4;
              const cx2 = tx - (tx - sx) * 0.4;

              const isHovered = hoverLink === i;

              const pathD = `
                M ${sx} ${sy}
                C ${cx1} ${sy} ${cx2} ${ty} ${tx} ${ty}
                L ${tx} ${ty + linkH}
                C ${cx2} ${ty + linkH} ${cx1} ${sy + linkH} ${sx} ${sy + linkH}
                Z
              `;

              return (
                <path
                  key={i}
                  d={pathD}
                  fill={link.color}
                  opacity={isHovered ? 0.7 : 0.35}
                  onMouseEnter={() => setHoverLink(i)}
                  onMouseLeave={() => setHoverLink(null)}
                  className="cursor-pointer"
                  style={{ transition: 'opacity 0.2s ease' }}
                />
              );
            })}

            {/* Nodes */}
            {nodePositions.map((node, i) => (
              <g key={i}>
                <rect
                  x={node.x}
                  y={node.y + 4}
                  width={nodeW}
                  height={node.h - 8}
                  rx={3}
                  fill={node.color}
                  opacity={0.7}
                />
                <text
                  x={node.x + nodeW / 2}
                  y={node.y + node.h + 12}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.45)"
                  fontSize="10"
                  fontFamily="Inter, system-ui, sans-serif"
                  fontWeight="600"
                >
                  {node.label}
                </text>
              </g>
            ))}
          </svg>
        )}

        {/* Tooltip */}
        <AnimatePresence>
          {hoverLink !== null && (
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
              <div className="text-[10px] text-zinc-400">
                {data.links[hoverLink].source} → {data.links[hoverLink].target}
              </div>
              <div className="text-[11px] font-bold text-zinc-200 tabular-nums mt-0.5">
                {data.links[hoverLink].value} orders
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 flex-shrink-0 flex-wrap">
        {data.nodes.map((node, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 text-[10px] text-zinc-500"
          >
            <div
              className="w-2.5 h-2.5 rounded"
              style={{ backgroundColor: node.color, opacity: 0.7 }}
            />
            <span className="font-medium">{node.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SankeyWidget;