// src/components/charts/ScatterChartComponent.tsx

import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
} from 'recharts';
import { ChartDefinition } from '../types/charts';
import { formatValue } from '../utils/chartEngine';

interface Props {
  data: any[];
  definition: ChartDefinition;
  colors: string[];
}

export default function ScatterChartComponent({ data, definition, colors }: Props) {
  const { xAxis, yAxis, style, mappings } = definition;

  const scatterData = data.map(r => ({
    x: Number(r[mappings.x!]) || 0,
    y: Number(r[mappings.y!]) || 0,
    z: mappings.size ? Number(r[mappings.size]) || 50 : 50,
    name: mappings.group ? r[mappings.group] : undefined,
  }));

  // Group by series/color if applicable
  const groups = new Map<string, typeof scatterData>();
  if (mappings.series || mappings.color) {
    const groupField = mappings.series || mappings.color;
    data.forEach((r, i) => {
      const key = String(r[groupField!] || 'All');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(scatterData[i]);
    });
  } else {
    groups.set('All', scatterData);
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
        {style.showGridlines && (
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        )}
        <XAxis
          type="number"
          dataKey="x"
          name={mappings.x || 'X'}
          hide={!xAxis.show}
          tick={{ fontSize: 10, fill: '#71717a' }}
          axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
          tickLine={false}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={mappings.y || 'Y'}
          hide={!yAxis.show}
          tick={{ fontSize: 10, fill: '#71717a' }}
          axisLine={false}
          tickLine={false}
        />
        <ZAxis type="number" dataKey="z" range={[30, 200]} />
        {style.showTooltip && (
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              fontSize: 11,
              color: '#e4e4e7',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
            cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.1)' }}
          />
        )}
        {Array.from(groups.entries()).map(([key, points], i) => (
          <Scatter
            key={key}
            name={key}
            data={points}
            fill={colors[i % colors.length]}
            fillOpacity={0.7}
            animationDuration={600}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
