// components/layout/GridLayout.tsx

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WidgetConfig, DashboardSettings } from '../types/dashboard';
import LineChartWidget from '../widgets/LineChartWidget';
import BarChartWidget from '../widgets/BarChartWidget';
import PieChartWidget from '../widgets/PieChartWidget';
import SankeyWidget from '../widgets/SankeyWidget';
import TableWidget from '../widgets/TableWidget';

interface GridLayoutProps {
  widgets: WidgetConfig[];
  data: Record<string, any>;
  settings: DashboardSettings;
  onUpdateWidgets: (widgets: WidgetConfig[]) => void;
  onRemoveWidget: (id: string) => void;
}

const COLS = 12;
const ROW_H = 48;
const GAP = 12;

// ─── Color Utilities ──────────────────────────────────────────────────

const COLOR_MAP: Record<string, { border: string; accent: string; bg: string }> = {
  indigo:  { border: 'border-indigo-500/15',  accent: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
  emerald: { border: 'border-emerald-500/15', accent: '#10b981', bg: 'rgba(16,185,129,0.08)' },
  amber:   { border: 'border-amber-500/15',   accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  rose:    { border: 'border-rose-500/15',     accent: '#f43f5e', bg: 'rgba(244,63,94,0.08)' },
  sky:     { border: 'border-sky-500/15',      accent: '#0ea5e9', bg: 'rgba(14,165,233,0.08)' },
  violet:  { border: 'border-violet-500/15',   accent: '#8b5cf6', bg: 'rgba(139,92,246,0.08)' },
  orange:  { border: 'border-orange-500/15',   accent: '#f97316', bg: 'rgba(249,115,22,0.08)' },
  cyan:    { border: 'border-cyan-500/15',     accent: '#06b6d4', bg: 'rgba(6,182,212,0.08)' },
};

// ─── KPI Formatting ───────────────────────────────────────────────────

function formatKPIValue(value: number, format: string): string {
  switch (format) {
    case 'currency':
      if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `£${(value / 1_000).toFixed(1)}K`;
      return `£${value.toLocaleString()}`;
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'number':
    default:
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
      return value.toLocaleString();
  }
}

function getChangePercent(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

// ─── Expiry Status Helpers ────────────────────────────────────────────

function getExpiryStatus(expiryDate: string): { label: string; className: string } {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: 'Expired', className: 'text-rose-400 bg-rose-500/10' };
  } else if (diffDays <= 7) {
    return { label: `${diffDays}d left`, className: 'text-amber-400 bg-amber-500/10' };
  } else if (diffDays <= 30) {
    return { label: `${diffDays}d left`, className: 'text-yellow-400 bg-yellow-500/10' };
  } else {
    return { label: `${diffDays}d left`, className: 'text-emerald-400 bg-emerald-500/10' };
  }
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `£${(value / 1_000).toFixed(2)}K`;
  return `£${value.toFixed(2)}`;
}

// ─── Cheese Expiry Table Component ────────────────────────────────────

interface CheeseExpiryRow {
  id: string;
  cheese: string;
  variety?: string;
  batchId: string;
  expiryDate: string;
  customer: string;
  customerEmail?: string;
  orderId: string;
  orderValue: number;
  quantity: number;
  unit: string;
}

interface CheeseExpiryTableProps {
  data: CheeseExpiryRow[];
  showTitle: boolean;
  title?: string;
}

const CheeseExpiryTable: React.FC<CheeseExpiryTableProps> = ({ data, showTitle, title }) => {
  const [sortField, setSortField] = useState<keyof CheeseExpiryRow>('expiryDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterText, setFilterText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 8;

  const handleSort = (field: keyof CheeseExpiryRow) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filtered = data.filter((row) => {
    if (!filterText) return true;
    const search = filterText.toLowerCase();
    return (
      row.cheese.toLowerCase().includes(search) ||
      row.customer.toLowerCase().includes(search) ||
      row.orderId.toLowerCase().includes(search) ||
      row.batchId.toLowerCase().includes(search) ||
      (row.variety && row.variety.toLowerCase().includes(search))
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    let comparison = 0;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal);
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const totalPages = Math.ceil(sorted.length / rowsPerPage);
  const paginatedRows = sorted.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const totalValue = filtered.reduce((sum, row) => sum + row.orderValue, 0);
  const expiredCount = filtered.filter((row) => {
    const diffDays = Math.ceil(
      (new Date(row.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
    );
    return diffDays < 0;
  }).length;
  const expiringCount = filtered.filter((row) => {
    const diffDays = Math.ceil(
      (new Date(row.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
    );
    return diffDays >= 0 && diffDays <= 7;
  }).length;

  const SortIcon = ({ field }: { field: keyof CheeseExpiryRow }) => (
    <span className="ml-1 inline-flex flex-col leading-none">
      {sortField === field ? (
        sortDirection === 'asc' ? (
          <svg className="w-3 h-3 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        ) : (
          <svg className="w-3 h-3 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )
      ) : (
        <svg className="w-3 h-3 text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      )}
    </span>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header area */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          {showTitle && (
            <h3 className="text-sm font-semibold text-zinc-200">
              {title || 'Cheese Expiry Tracker'}
            </h3>
          )}
          {/* Summary badges */}
          <div className="flex items-center gap-2">
            {expiredCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-rose-400 bg-rose-500/10 border border-rose-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                {expiredCount} expired
              </span>
            )}
            {expiringCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-amber-400 bg-amber-500/10 border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {expiringCount} expiring soon
              </span>
            )}
          </div>
        </div>

        {/* Search + Total */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-zinc-500">
            Total: <span className="text-zinc-300 font-semibold">{formatCurrency(totalValue)}</span>
          </span>
          <div className="relative">
            <svg
              className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search cheese, customer..."
              value={filterText}
              onChange={(e) => {
                setFilterText(e.target.value);
                setCurrentPage(1);
              }}
              className="w-48 pl-7 pr-3 py-1.5 text-[11px] bg-white/[0.03] border border-white/[0.06] rounded-lg text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-white/[0.04] bg-white/[0.01]">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10">
            <tr className="bg-white/[0.03] backdrop-blur-sm border-b border-white/[0.06]">
              <th
                className="px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                onClick={() => handleSort('cheese')}
              >
                <span className="inline-flex items-center">
                  Cheese <SortIcon field="cheese" />
                </span>
              </th>
              <th
                className="px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                onClick={() => handleSort('batchId')}
              >
                <span className="inline-flex items-center">
                  Batch <SortIcon field="batchId" />
                </span>
              </th>
              <th
                className="px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                onClick={() => handleSort('expiryDate')}
              >
                <span className="inline-flex items-center">
                  Expiry Date <SortIcon field="expiryDate" />
                </span>
              </th>
              <th className="px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Status
              </th>
              <th
                className="px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                onClick={() => handleSort('customer')}
              >
                <span className="inline-flex items-center">
                  Customer <SortIcon field="customer" />
                </span>
              </th>
              <th
                className="px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                onClick={() => handleSort('orderId')}
              >
                <span className="inline-flex items-center">
                  Order ID <SortIcon field="orderId" />
                </span>
              </th>
              <th
                className="px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                onClick={() => handleSort('quantity')}
              >
                <span className="inline-flex items-center">
                  Qty <SortIcon field="quantity" />
                </span>
              </th>
              <th
                className="px-4 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors text-right"
                onClick={() => handleSort('orderValue')}
              >
                <span className="inline-flex items-center justify-end w-full">
                  Order Value <SortIcon field="orderValue" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <svg
                      className="w-8 h-8 text-zinc-700"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <span className="text-xs text-zinc-600">No matching records found</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, idx) => {
                const status = getExpiryStatus(row.expiryDate);
                const formattedDate = new Date(row.expiryDate).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <tr
                    key={row.id || idx}
                    className="hover:bg-white/[0.02] transition-colors group/row"
                  >
                    {/* Cheese name */}
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-zinc-200">{row.cheese}</span>
                        {row.variety && (
                          <span className="text-[10px] text-zinc-500">{row.variety}</span>
                        )}
                      </div>
                    </td>

                    {/* Batch ID */}
                    <td className="px-4 py-2.5">
                      <span className="text-[11px] font-mono text-zinc-400 bg-white/[0.03] px-1.5 py-0.5 rounded">
                        {row.batchId}
                      </span>
                    </td>

                    {/* Expiry Date */}
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-zinc-300">{formattedDate}</span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col">
                        <span className="text-xs text-zinc-200">{row.customer}</span>
                        {row.customerEmail && (
                          <span className="text-[10px] text-zinc-600">{row.customerEmail}</span>
                        )}
                      </div>
                    </td>

                    {/* Order ID */}
                    <td className="px-4 py-2.5">
                      <span className="text-[11px] font-mono text-indigo-400/80">
                        {row.orderId}
                      </span>
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-zinc-300">
                        {row.quantity} {row.unit}
                      </span>
                    </td>

                    {/* Order Value */}
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-xs font-semibold text-emerald-400">
                        {formatCurrency(row.orderValue)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2.5 flex-shrink-0">
          <span className="text-[10px] text-zinc-600">
            Showing {(currentPage - 1) * rowsPerPage + 1}–
            {Math.min(currentPage * rowsPerPage, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 text-[10px] rounded-md bg-white/[0.03] border border-white/[0.06] text-zinc-400 hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-6 h-6 text-[10px] rounded-md transition-all ${
                    currentPage === pageNum
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                      : 'bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:bg-white/[0.06]'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-[10px] rounded-md bg-white/[0.03] border border-white/[0.06] text-zinc-400 hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────

const GridLayout: React.FC<GridLayoutProps> = ({
  widgets,
  data,
  settings,
  onUpdateWidgets,
  onRemoveWidget,
}) => {
  const [dragging, setDragging] = useState<string | null>(null);
  const [resizing, setResizing] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setContainerWidth(w);
      }
    });

    observer.observe(el);
    if (el.offsetWidth > 0) setContainerWidth(el.offsetWidth);

    return () => observer.disconnect();
  }, []);

  const getCellWidth = useCallback(() => {
    if (containerWidth <= 0) return 80;
    return (containerWidth - GAP * (COLS - 1)) / COLS;
  }, [containerWidth]);

  const snapToGrid = useCallback(
    (px: number, py: number): { x: number; y: number } => {
      const cellW = getCellWidth();
      return {
        x: Math.max(0, Math.min(COLS - 1, Math.round(px / (cellW + GAP)))),
        y: Math.max(0, Math.round(py / (ROW_H + GAP))),
      };
    },
    [getCellWidth],
  );

  // ── Drag handling ───────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent, widgetId: string) => {
      e.preventDefault();
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget || !gridRef.current) return;

      const rect = gridRef.current.getBoundingClientRect();
      const cellW = getCellWidth();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const widgetPxX = widget.x * (cellW + GAP);
      const widgetPxY = widget.y * (ROW_H + GAP);

      const offsetX = clientX - rect.left - widgetPxX;
      const offsetY = clientY - rect.top - widgetPxY;

      setDragging(widgetId);

      const handleMove = (ev: MouseEvent | TouchEvent) => {
        const cx = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
        const cy = 'touches' in ev ? ev.touches[0].clientY : ev.clientY;
        const px = cx - rect.left - offsetX;
        const py = cy - rect.top - offsetY;
        const snapped = snapToGrid(px, py);

        onUpdateWidgets(
          widgets.map((w) =>
            w.id === widgetId
              ? { ...w, x: Math.min(snapped.x, COLS - w.w), y: snapped.y }
              : w,
          ),
        );
      };

      const handleUp = () => {
        setDragging(null);
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleUp);
    },
    [widgets, getCellWidth, snapToGrid, onUpdateWidgets],
  );

  // ── Resize handling ─────────────────────────────────────────────────

  const handleResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent, widgetId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const widget = widgets.find((w) => w.id === widgetId);
      if (!widget || !gridRef.current) return;

      const rect = gridRef.current.getBoundingClientRect();
      const cellW = getCellWidth();
      setResizing(widgetId);

      const handleMove = (ev: MouseEvent | TouchEvent) => {
        const cx = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
        const cy = 'touches' in ev ? ev.touches[0].clientY : ev.clientY;
        const relX = cx - rect.left;
        const relY = cy - rect.top;

        const newW = Math.max(
          2,
          Math.min(
            COLS - widget.x,
            Math.round((relX - widget.x * (cellW + GAP)) / (cellW + GAP)) + 1,
          ),
        );
        const newH = Math.max(
          2,
          Math.round((relY - widget.y * (ROW_H + GAP)) / (ROW_H + GAP)) + 1,
        );

        onUpdateWidgets(
          widgets.map((w) => (w.id === widgetId ? { ...w, w: newW, h: newH } : w)),
        );
      };

      const handleUp = () => {
        setResizing(null);
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleUp);
    },
    [widgets, getCellWidth, onUpdateWidgets],
  );

  // ── Widget content renderer ─────────────────────────────────────────

  const renderWidgetContent = (widget: WidgetConfig) => {
    const widgetData = widget.dataKey ? data[widget.dataKey] : undefined;

    switch (widget.type) {
      // ── KPI Card ──────────────────────────────────────────────────
      case 'kpi': {
        if (!widgetData) return <EmptyState message={`No data for "${widget.dataKey}"`} />;

        const kpi = widgetData as {
          label: string;
          value: number;
          previousValue: number;
          format: string;
          color: string;
          icon: string;
        };

        const change = getChangePercent(kpi.value, kpi.previousValue);
        const isPositive = change >= 0;
        const colorInfo = COLOR_MAP[widget.color] || COLOR_MAP.indigo;

        return (
          <div className="flex flex-col h-full px-1 min-h-0">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              {widget.title || kpi.label}
            </span>
            <span className="text-2xl sm:text-3xl font-bold text-zinc-100 leading-none">
              {formatKPIValue(kpi.value, kpi.format)}
            </span>
            <div className="flex items-center gap-1.5 mt-2.5">
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                  isPositive
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-rose-400 bg-rose-500/10'
                }`}
              >
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {isPositive ? (
                    <polyline points="18 15 12 9 6 15" />
                  ) : (
                    <polyline points="6 9 12 15 18 9" />
                  )}
                </svg>
                {Math.abs(change).toFixed(1)}%
              </span>
              <span className="text-[10px] text-zinc-600">vs prior period</span>
            </div>
            <div className="mt-auto pt-3">
              <div
                className="h-0.5 rounded-full opacity-40"
                style={{ backgroundColor: colorInfo.accent }}
              />
            </div>
          </div>
        );
      }

      // ── Line Chart ────────────────────────────────────────────────
      case 'line-chart': {
        if (!widgetData) return <EmptyState message={`No data for "${widget.dataKey}"`} />;
        return (
          <LineChartWidget
            data={widgetData}
            showTitle={settings.showWidgetTitles}
            title={widget.title}
          />
        );
      }

      // ── Bar Chart ─────────────────────────────────────────────────
      case 'bar-chart': {
        if (!widgetData) return <EmptyState message={`No data for "${widget.dataKey}"`} />;
        return (
          <BarChartWidget
            data={widgetData}
            showTitle={settings.showWidgetTitles}
            title={widget.title}
          />
        );
      }

      // ── Stacked Bar Chart ─────────────────────────────────────────
      case 'stacked-bar': {
        if (!widgetData) return <EmptyState message={`No data for "${widget.dataKey}"`} />;
        return (
          <BarChartWidget
            data={widgetData}
            showTitle={settings.showWidgetTitles}
            title={widget.title}
            stacked
          />
        );
      }

      // ── Pie / Donut Chart ─────────────────────────────────────────
      case 'pie-chart': {
        if (!widgetData) return <EmptyState message={`No data for "${widget.dataKey}"`} />;
        return (
          <PieChartWidget
            data={widgetData}
            showTitle={settings.showWidgetTitles}
            title={widget.title}
          />
        );
      }

      // ── Sankey Diagram ────────────────────────────────────────────
      case 'sankey': {
        if (!widgetData) return <EmptyState message={`No data for "${widget.dataKey}"`} />;
        return (
          <SankeyWidget
            data={widgetData}
            showTitle={settings.showWidgetTitles}
            title={widget.title}
          />
        );
      }

      // ── Cheese Expiry Table (NEW) ─────────────────────────────────
      case 'cheese-expiry-table': {
        if (!widgetData) return <EmptyState message={`No data for "${widget.dataKey}"`} />;
        return (
          <CheeseExpiryTable
            data={widgetData}
            showTitle={settings.showWidgetTitles}
            title={widget.title}
          />
        );
      }

      // ── Generic Data Table ────────────────────────────────────────
      case 'table': {
        if (!widgetData) return <EmptyState message={`No data for "${widget.dataKey}"`} />;
        return (
          <TableWidget
            data={widgetData}
            dataKey={widget.dataKey}
            showTitle={settings.showWidgetTitles}
            title={widget.title}
          />
        );
      }

      default:
        return <EmptyState message={`Unknown widget type: ${widget.type}`} />;
    }
  };

  // ── Layout calculations ─────────────────────────────────────────────

  const maxY = widgets.length > 0 ? Math.max(...widgets.map((w) => w.y + w.h)) : 6;
  const gridH = maxY * (ROW_H + GAP) + GAP;
  const cellW = getCellWidth();
  const ready = containerWidth > 0;

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div ref={gridRef} className="relative w-full" style={{ minHeight: gridH }}>
      {ready && (
        <AnimatePresence mode="popLayout">
          {widgets.map((widget) => {
            const padding = settings.compactMode ? 12 : 16;
            const left = widget.x * (cellW + GAP);
            const top = widget.y * (ROW_H + GAP);
            const widthPx = widget.w * (cellW + GAP) - GAP;
            const heightPx = widget.h * (ROW_H + GAP) - GAP;
            const isDragging = dragging === widget.id;
            const isResizing = resizing === widget.id;
            const dragHandleH = 24;
            const contentH = heightPx - padding * 2 - dragHandleH;
            const colorInfo = COLOR_MAP[widget.color] || COLOR_MAP.indigo;

            return (
              <motion.div
                key={widget.id}
                layout={!isDragging && !isResizing}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  left,
                  top,
                  width: widthPx,
                  height: heightPx,
                  zIndex: isDragging || isResizing ? 50 : 1,
                }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{
                  type: 'spring',
                  damping: isDragging ? 40 : 28,
                  stiffness: isDragging ? 500 : 350,
                  mass: 0.6,
                }}
                className={`absolute rounded-2xl border ${colorInfo.border} bg-[#131316] group ${
                  isDragging ? 'shadow-2xl ring-1 ring-indigo-500/20' : ''
                }`}
                style={{
                  padding,
                  boxShadow: isDragging
                    ? '0 20px 60px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.15)'
                    : '0 2px 16px -4px rgba(0,0,0,0.15)',
                }}
              >
                {/* Top shine */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

                {/* Drag handle */}
                <div
                  className="absolute top-0 left-0 right-0 h-6 cursor-grab active:cursor-grabbing z-10 flex items-center justify-center"
                  onMouseDown={(e) => handleDragStart(e, widget.id)}
                  onTouchStart={(e) => handleDragStart(e, widget.id)}
                >
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-30 transition-opacity">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-1 h-1 rounded-full bg-white" />
                    ))}
                  </div>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => onRemoveWidget(widget.id)}
                  className="absolute top-2 right-2 w-5 h-5 rounded-md bg-white/[0.04] hover:bg-rose-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20"
                  aria-label="Remove widget"
                >
                  <svg
                    className="w-3 h-3 text-zinc-500 hover:text-rose-400 transition-colors"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>

                {/* Widget content */}
                <div className="w-full mt-4 relative" style={{ height: Math.max(contentH, 60) }}>
                  {renderWidgetContent(widget)}
                </div>

                {/* Resize handle */}
                <div
                  className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-20 opacity-0 group-hover:opacity-60 transition-opacity"
                  onMouseDown={(e) => handleResizeStart(e, widget.id)}
                  onTouchStart={(e) => handleResizeStart(e, widget.id)}
                >
                  <svg className="w-full h-full text-zinc-600" viewBox="0 0 20 20" fill="currentColor">
                    <circle cx="14" cy="14" r="1.5" />
                    <circle cx="14" cy="8" r="1.5" />
                    <circle cx="8" cy="14" r="1.5" />
                  </svg>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}

      {/* Loading placeholder */}
      {!ready && widgets.length > 0 && (
        <div className="flex items-center justify-center py-24">
          <div className="text-sm text-zinc-500">Loading layout…</div>
        </div>
      )}

      {/* Empty state */}
      {widgets.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-zinc-700"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-zinc-400 mb-1">No widgets yet</h3>
          <p className="text-sm text-zinc-600 max-w-sm">
            Click "Add Widget" to start building your dashboard.
          </p>
        </motion.div>
      )}
    </div>
  );
};

// ─── Empty State Component ────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-2">
          <svg
            className="w-5 h-5 text-zinc-700"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <span className="text-[11px] text-zinc-600">{message}</span>
      </div>
    </div>
  );
}

export default GridLayout;
