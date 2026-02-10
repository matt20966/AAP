// src/components/charts/LineChartComponent.tsx

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine as RechartRefLine,
} from 'recharts';
import { ChartDefinition } from '../types/charts';
import { formatValue, getChartColors } from '../utils/chartEngine';

interface Props {
  data: any[];
  seriesKeys: string[];
  definition: ChartDefinition;
  colors: string[];
}

export default function LineChartComponent({ data, seriesKeys, definition, colors }: Props) {
  const { xAxis, yAxis, series: seriesConfig, style, mappings, referenceLines } = definition;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: xAxis.rotateTicks ? 60 : 5 }}>
        {style.showGridlines && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
        )}
        <XAxis
          dataKey={mappings.x || undefined}
          hide={!xAxis.show}
          tick={{ fontSize: 10, fill: '#71717a' }}
          axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
          tickLine={false}
          angle={xAxis.rotateTicks ? -45 : 0}
          textAnchor={xAxis.rotateTicks ? 'end' : 'middle'}
          label={xAxis.label ? { value: xAxis.label, position: 'insideBottom', offset: -5, style: { fontSize: 10, fill: '#71717a' } } : undefined}
        />
        <YAxis
          hide={!yAxis.show}
          tick={{ fontSize: 10, fill: '#71717a' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => formatValue(v, yAxis.tickFormat, yAxis.currency, yAxis.decimals)}
          label={yAxis.label ? { value: yAxis.label, angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#71717a' } } : undefined}
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
          />
        )}
        {seriesConfig.showLegend && seriesKeys.length > 1 && (
          <Legend
            wrapperStyle={{ fontSize: 10, color: '#71717a' }}
          />
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
          <Line
            key={key}
            type={seriesConfig.smooth ? 'monotone' : 'linear'}
            dataKey={key}
            stroke={style.seriesColors[key] || colors[i % colors.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            animationDuration={800}
            animationEasing="ease-out"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
