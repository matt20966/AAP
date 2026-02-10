// src/components/charts/BarChartComponent.tsx

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine as RechartRefLine,
} from 'recharts';
import { ChartDefinition } from '../types/charts';
import { formatValue } from '../utils/chartEngine';

interface Props {
  data: any[];
  seriesKeys: string[];
  definition: ChartDefinition;
  colors: string[];
}

export default function BarChartComponent({ data, seriesKeys, definition, colors }: Props) {
  const { xAxis, yAxis, series: seriesConfig, style, mappings, referenceLines, chartType } = definition;
  const isStacked = chartType === 'stacked-bar' || seriesConfig.stacked;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: xAxis.rotateTicks ? 60 : 5 }}>
        {style.showGridlines && (
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        )}
        <XAxis
          dataKey={mappings.x || undefined}
          hide={!xAxis.show}
          tick={{ fontSize: 10, fill: '#71717a' }}
          axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
          tickLine={false}
          angle={xAxis.rotateTicks ? -45 : 0}
          textAnchor={xAxis.rotateTicks ? 'end' : 'middle'}
        />
        <YAxis
          hide={!yAxis.show}
          tick={{ fontSize: 10, fill: '#71717a' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => formatValue(v, yAxis.tickFormat, yAxis.currency, yAxis.decimals)}
        />
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
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          />
        )}
        {seriesConfig.showLegend && seriesKeys.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 10, color: '#71717a' }} />
        )}
        {referenceLines.filter(r => r.type === 'line').map(ref => (
          <RechartRefLine
            key={ref.id}
            y={ref.value}
            stroke={ref.color}
            strokeDasharray="5 5"
            strokeWidth={1.5}
            label={{ value: ref.label, position: 'right', style: { fontSize: 9, fill: ref.color } }}
          />
        ))}
        {seriesKeys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            fill={style.seriesColors[key] || colors[i % colors.length]}
            stackId={isStacked ? 'stack' : undefined}
            radius={isStacked ? [0, 0, 0, 0] : [4, 4, 0, 0]}
            animationDuration={600}
            animationEasing="ease-out"
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
