// components/widgets/TableWidget.tsx
// (Minor fixes for overflow handling - mostly fine as-is)

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { SalesPersonRow, LowStockItem } from '../types/dashboard';

interface TableWidgetProps {
  data: SalesPersonRow[] | LowStockItem[];
  dataKey: string;
  showTitle: boolean;
  title: string;
}

function isSalesData(data: any[], key: string): data is SalesPersonRow[] {
  return key === 'topSales';
}

function isStockData(data: any[], key: string): data is LowStockItem[] {
  return key === 'lowStock';
}

const TableWidget: React.FC<TableWidgetProps> = ({
  data,
  dataKey,
  showTitle,
  title,
}) => {
  const [sortCol, setSortCol] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const headerClass = (col: string) =>
    `text-left text-[9px] font-bold uppercase tracking-[0.08em] cursor-pointer select-none transition-colors whitespace-nowrap ${
      sortCol === col
        ? 'text-indigo-400'
        : 'text-zinc-600 hover:text-zinc-400'
    }`;

  if (isSalesData(data, dataKey)) {
    const sorted = [...data].sort((a, b) => {
      if (!sortCol) return 0;
      const aVal = (a as any)[sortCol];
      const bVal = (b as any)[sortCol];
      const cmp =
        typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal;
      return sortDir === 'desc' ? -cmp : cmp;
    });

    const badgeColors = [
      'bg-amber-500/15 text-amber-300',
      'bg-zinc-400/10 text-zinc-300',
      'bg-amber-700/10 text-amber-500',
    ];

    return (
      <div className="h-full flex flex-col min-h-0">
        {showTitle && (
          <div className="flex items-center gap-2 mb-2 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-indigo-400" />
            <span className="text-xs font-bold text-zinc-300 truncate">
              {title}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full">
            <thead className="sticky top-0 bg-[#131316]">
              <tr className="border-b border-white/[0.05]">
                <th className="pb-2 pr-2 w-8 text-[9px] font-bold text-zinc-600 uppercase tracking-[0.08em]">
                  #
                </th>
                <th
                  className={`pb-2 pr-2 ${headerClass('name')}`}
                  onClick={() => toggleSort('name')}
                >
                  Name {sortCol === 'name' && (sortDir === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className={`pb-2 pr-2 text-right ${headerClass('revenue')}`}
                  onClick={() => toggleSort('revenue')}
                >
                  Revenue{' '}
                  {sortCol === 'revenue' && (sortDir === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className={`pb-2 pr-2 text-right ${headerClass('profit')}`}
                  onClick={() => toggleSort('profit')}
                >
                  Profit{' '}
                  {sortCol === 'profit' && (sortDir === 'desc' ? '↓' : '↑')}
                </th>
                <th
                  className={`pb-2 text-right ${headerClass('winRate')}`}
                  onClick={() => toggleSort('winRate')}
                >
                  Win Rate{' '}
                  {sortCol === 'winRate' && (sortDir === 'desc' ? '↓' : '↑')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((person, i) => (
                <motion.tr
                  key={person.name}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group"
                >
                  <td className="py-2 pr-2">
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[8px] font-extrabold ${
                        i < 3
                          ? badgeColors[i]
                          : 'bg-white/[0.03] text-zinc-600'
                      }`}
                    >
                      {person.rank}
                    </span>
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500/10 to-violet-500/5 border border-indigo-500/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[7px] font-bold text-indigo-300">
                          {person.avatar}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-zinc-200 truncate">
                        {person.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <span className="text-[11px] font-bold text-emerald-400 tabular-nums">
                      ${(person.revenue / 1000).toFixed(1)}K
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <span className="text-[11px] font-bold text-zinc-300 tabular-nums">
                      ${(person.profit / 1000).toFixed(1)}K
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <span
                      className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                        person.winRate >= 70
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : person.winRate >= 60
                          ? 'text-amber-400 bg-amber-500/10'
                          : 'text-rose-400 bg-rose-500/10'
                      }`}
                    >
                      {person.winRate}%
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (isStockData(data, dataKey)) {
    const statusColors: Record<string, string> = {
      critical: 'text-rose-400 bg-rose-500/10 border-rose-500/15',
      low: 'text-amber-400 bg-amber-500/10 border-amber-500/15',
      warning: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/15',
    };

    return (
      <div className="h-full flex flex-col min-h-0">
        {showTitle && (
          <div className="flex items-center gap-2 mb-2 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-rose-400" />
            <span className="text-xs font-bold text-zinc-300 truncate">
              {title}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-auto min-h-0">
          <table className="w-full">
            <thead className="sticky top-0 bg-[#131316]">
              <tr className="border-b border-white/[0.05]">
                <th className="pb-2 pr-2 text-left text-[9px] font-bold text-zinc-600 uppercase tracking-[0.08em]">
                  SKU
                </th>
                <th className="pb-2 pr-2 text-left text-[9px] font-bold text-zinc-600 uppercase tracking-[0.08em]">
                  Item
                </th>
                <th className="pb-2 pr-2 text-right text-[9px] font-bold text-zinc-600 uppercase tracking-[0.08em]">
                  Stock
                </th>
                <th className="pb-2 text-right text-[9px] font-bold text-zinc-600 uppercase tracking-[0.08em]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => (
                <motion.tr
                  key={item.sku}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-2 pr-2">
                    <span className="text-[10px] font-mono text-zinc-500">
                      {item.sku}
                    </span>
                  </td>
                  <td className="py-2 pr-2">
                    <div>
                      <span className="text-[11px] font-semibold text-zinc-200 block truncate">
                        {item.name}
                      </span>
                      <span className="text-[9px] text-zinc-600">
                        {item.category}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <div>
                      <span className="text-[11px] font-bold text-zinc-300 tabular-nums">
                        {item.currentStock}
                      </span>
                      <span className="text-[9px] text-zinc-600 ml-1">
                        / {item.reorderPoint}
                      </span>
                    </div>
                    <div
                      className="w-full h-1 mt-1 rounded-full overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.04)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(
                            (item.currentStock / item.reorderPoint) * 100,
                            100
                          )}%`,
                          background:
                            item.status === 'critical'
                              ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                              : item.status === 'low'
                              ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                              : 'linear-gradient(90deg, #eab308, #ca8a04)',
                        }}
                      />
                    </div>
                  </td>
                  <td className="py-2 text-right">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-[0.05em] px-2 py-1 rounded-md border ${
                        statusColors[item.status] || statusColors.warning
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return <div className="text-zinc-500 text-sm">No data available</div>;
};

export default TableWidget;