// src/components/charts/AreaChartComponent.tsx

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartDefinition } from '../types/charts';
import { formatValue } from '../utils/chartEngine';

interface Props {
  data: any[];
  seriesKeys: string[];
  definition: ChartDefinition;
  colors: string[];
}

export default function AreaChartComponent({ data, seriesKeys, definition, colors }: Props) {
  const { xAxis, yAxis, series: seriesConfig, style, mappings } = definition;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: xAxis.rotateTicks ? 60 : 5 }}>
        <defs>
          {seriesKeys.map((key, i) => {
            const color = style.seriesColors[key] || colors[i % colors.length];
            return (
              <linearGradient key={key} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            );
          })}
        </defs>
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
          />
        )}
        {seriesConfig.showLegend && seriesKeys.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 10, color: '#71717a' }} />
        )}
        {seriesKeys.map((key, i) => (
          <Area
            key={key}
            type={seriesConfig.smooth ? 'monotone' : 'linear'}
            dataKey={key}
            stroke={style.seriesColors[key] || colors[i % colors.length]}
            fill={`url(#gradient-${i})`}
            strokeWidth={2}
            stackId={seriesConfig.stacked ? 'stack' : undefined}
            animationDuration={800}
            animationEasing="ease-out"
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
