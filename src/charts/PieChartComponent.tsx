// src/components/charts/PieChartComponent.tsx

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartDefinition } from '../types/charts';
import { formatValue } from '../utils/chartEngine';

interface Props {
  data: any[];
  definition: ChartDefinition;
  colors: string[];
}

export default function PieChartComponent({ data, definition, colors }: Props) {
  const { yAxis, series: seriesConfig, style, chartType } = definition;
  const isDonut = chartType === 'donut';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={isDonut ? '55%' : 0}
          outerRadius="80%"
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          animationDuration={800}
          animationEasing="ease-out"
          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
          labelLine={{ stroke: 'rgba(255,255,255,0.15)' }}
        >
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={colors[i % colors.length]}
              stroke="rgba(0,0,0,0.3)"
              strokeWidth={1}
            />
          ))}
        </Pie>
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
            formatter={(value: any) => formatValue(Number(value), yAxis.tickFormat, yAxis.currency, yAxis.decimals)}
          />
        )}
        {seriesConfig.showLegend && (
          <Legend
            wrapperStyle={{ fontSize: 10, color: '#71717a' }}
            layout="vertical"
            align="right"
            verticalAlign="middle"
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}
