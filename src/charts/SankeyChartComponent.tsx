// src/components/charts/SankeyChartComponent.tsx

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChartDefinition } from '../types/charts';

interface Props {
  data: any[];
  definition: ChartDefinition;
  colors: string[];
}

interface SankeyNode {
  id: string;
  name: string;
  x: number;
  y: number;
  height: number;
  value: number;
  color: string;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
  sourceY: number;
  targetY: number;
  thickness: number;
  color: string;
}

export default function SankeyChartComponent({ data, definition, colors }: Props) {
  const { mappings } = definition;

  const { nodes, links, width, height } = useMemo(() => {
    if (!mappings.x || !mappings.y || !mappings.value || data.length === 0) {
      return { nodes: [], links: [], width: 0, height: 0 };
    }

    // Build node list and levels
    const nodeSet = new Set<string>();
    const rawLinks = data.map(r => ({
      source: String(r[mappings.x!]),
      target: String(r[mappings.y!]),
      value: Number(r[mappings.value!]) || 0,
    }));

    rawLinks.forEach(l => {
      nodeSet.add(l.source);
      nodeSet.add(l.target);
    });

    // Determine levels using topological approach
    const nodeNames = Array.from(nodeSet);
    const sources = new Set(rawLinks.map(l => l.source));
    const targets = new Set(rawLinks.map(l => l.target));

    const levels: string[][] = [];
    const assigned = new Set<string>();

    // Level 0: nodes that are sources but not targets
    const roots = nodeNames.filter(n => sources.has(n) && !targets.has(n));
    if (roots.length > 0) {
      levels.push(roots);
      roots.forEach(r => assigned.add(r));
    }

    // Iteratively assign remaining
    let maxIter = 10;
    while (assigned.size < nodeNames.length && maxIter-- > 0) {
      const next = nodeNames.filter(n => {
        if (assigned.has(n)) return false;
        const incomingSources = rawLinks.filter(l => l.target === n).map(l => l.source);
        return incomingSources.every(s => assigned.has(s));
      });
      if (next.length === 0) {
        // Add remaining
        const remaining = nodeNames.filter(n => !assigned.has(n));
        if (remaining.length > 0) levels.push(remaining);
        remaining.forEach(r => assigned.add(r));
        break;
      }
      levels.push(next);
      next.forEach(n => assigned.add(n));
    }

    const W = 600;
    const H = 320;
    const nodeWidth = 16;
    const nodePadding = 20;

    // Calculate node values
    const nodeValues: Record<string, number> = {};
    nodeNames.forEach(n => {
      const incoming = rawLinks.filter(l => l.target === n).reduce((s, l) => s + l.value, 0);
      const outgoing = rawLinks.filter(l => l.source === n).reduce((s, l) => s + l.value, 0);
      nodeValues[n] = Math.max(incoming, outgoing);
    });

    // Position nodes
    const sankeyNodes: SankeyNode[] = [];
    levels.forEach((levelNodes, li) => {
      const x = (li / Math.max(levels.length - 1, 1)) * (W - nodeWidth);
      const totalValue = levelNodes.reduce((s, n) => s + nodeValues[n], 0);
      const availableHeight = H - (levelNodes.length - 1) * nodePadding;
      let currentY = 0;

      levelNodes.forEach((n, ni) => {
        const nodeHeight = Math.max((nodeValues[n] / Math.max(totalValue, 1)) * availableHeight, 8);
        sankeyNodes.push({
          id: n,
          name: n,
          x,
          y: currentY,
          height: nodeHeight,
          value: nodeValues[n],
          color: colors[sankeyNodes.length % colors.length],
        });
        currentY += nodeHeight + nodePadding;
      });
    });

    // Build links with positions
    const nodeMap = new Map(sankeyNodes.map(n => [n.id, n]));
    const sourceOffsets: Record<string, number> = {};
    const targetOffsets: Record<string, number> = {};

    const sankeyLinks: SankeyLink[] = rawLinks.map(l => {
      const sNode = nodeMap.get(l.source);
      const tNode = nodeMap.get(l.target);
      if (!sNode || !tNode) return null;

      const maxVal = Math.max(sNode.value, 1);
      const thickness = Math.max((l.value / maxVal) * sNode.height, 2);

      if (!sourceOffsets[l.source]) sourceOffsets[l.source] = 0;
      if (!targetOffsets[l.target]) targetOffsets[l.target] = 0;

      const sourceY = sNode.y + sourceOffsets[l.source] + thickness / 2;
      const targetY = tNode.y + targetOffsets[l.target] + thickness / 2;

      sourceOffsets[l.source] += thickness + 2;
      targetOffsets[l.target] += thickness + 2;

      return {
        source: l.source,
        target: l.target,
        value: l.value,
        sourceY,
        targetY,
        thickness,
        color: sNode.color,
      };
    }).filter(Boolean) as SankeyLink[];

    return { nodes: sankeyNodes, links: sankeyLinks, width: W, height: H };
  }, [data, mappings, colors]);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
        Configure Source (X), Target (Y), and Value fields
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full p-4">
      <svg viewBox={`-10 -10 ${width + 20} ${height + 20}`} className="w-full h-full max-w-[600px]">
        {/* Links */}
        {links.map((link, i) => {
          const sNode = nodes.find(n => n.id === link.source);
          const tNode = nodes.find(n => n.id === link.target);
          if (!sNode || !tNode) return null;

          const x1 = sNode.x + 16;
          const x2 = tNode.x;
          const midX = (x1 + x2) / 2;

          return (
            <motion.path
              key={i}
              initial={{ opacity: 0, pathLength: 0 }}
              animate={{ opacity: 0.4, pathLength: 1 }}
              transition={{ duration: 0.8, delay: i * 0.05 }}
              d={`M${x1},${link.sourceY} C${midX},${link.sourceY} ${midX},${link.targetY} ${x2},${link.targetY}`}
              fill="none"
              stroke={link.color}
              strokeWidth={link.thickness}
              strokeOpacity={0.35}
              className="hover:stroke-opacity-60 transition-all cursor-pointer"
            >
              <title>{`${link.source} → ${link.target}: ${link.value}`}</title>
            </motion.path>
          );
        })}

        {/* Nodes */}
        {nodes.map((node, i) => (
          <g key={node.id}>
            <motion.rect
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              x={node.x}
              y={node.y}
              width={16}
              height={node.height}
              fill={node.color}
              rx={4}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            >
              <title>{`${node.name}: ${node.value}`}</title>
            </motion.rect>
            <text
              x={node.x + 8}
              y={node.y + node.height / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#a1a1aa"
              fontSize={8}
              fontWeight={600}
              className="pointer-events-none"
              transform={`translate(${node.x < width / 2 ? -20 : 20}, 0)`}
            >
              {node.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
