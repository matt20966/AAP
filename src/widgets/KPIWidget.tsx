// components/widgets/KPIWidget.tsx

import React from 'react';
import { motion } from 'framer-motion';

interface KPIData {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  prefix?: string;
  suffix?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

interface KPIWidgetProps {
  data: KPIData;
  showTitle?: boolean;
  title?: string;
  color?: string;
}

const KPIWidget: React.FC<KPIWidgetProps> = ({ data, showTitle, title, color = 'indigo' }) => {
  const trendColors = {
    up: 'text-emerald-400 bg-emerald-500/10',
    down: 'text-rose-400 bg-rose-500/10',
    neutral: 'text-zinc-400 bg-zinc-500/10',
  };

  const trend = data.trend || (data.change && data.change > 0 ? 'up' : data.change && data.change < 0 ? 'down' : 'neutral');
  const trendClass = trendColors[trend];

  return (
    <div className="h-full flex flex-col justify-between">
      {showTitle && title && (
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
          {title}
        </span>
      )}
      
      <div className="flex-1 flex flex-col justify-center">
        {/* Label */}
        <span className="text-sm text-zinc-400 font-medium mb-1">
          {data.label}
        </span>
        
        {/* Value */}
        <div className="flex items-baseline gap-1">
          {data.prefix && (
            <span className="text-lg text-zinc-500">{data.prefix}</span>
          )}
          <motion.span
            key={data.value}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-zinc-100 tracking-tight"
          >
            {typeof data.value === 'number' 
              ? data.value.toLocaleString() 
              : data.value
            }
          </motion.span>
          {data.suffix && (
            <span className="text-lg text-zinc-500">{data.suffix}</span>
          )}
        </div>

        {/* Change indicator */}
        {data.change !== undefined && (
          <div className="flex items-center gap-2 mt-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${trendClass}`}>
              {trend === 'up' && (
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              )}
              {trend === 'down' && (
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              )}
              {Math.abs(data.change)}%
            </span>
            {data.changeLabel && (
              <span className="text-xs text-zinc-500">{data.changeLabel}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default KPIWidget;