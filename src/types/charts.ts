// src/types/charts.ts

export type FieldType = 'string' | 'number' | 'date';

export interface DatasetField {
  id: string;
  name: string;
  type: FieldType;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  fields: DatasetField[];
  rows: Record<string, any>[];
  defaultMappings?: Partial<FieldMappings>;
}

export type ChartType =
  | 'kpi'
  | 'line'
  | 'bar'
  | 'stacked-bar'
  | 'area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'heatmap'
  | 'sankey';

export interface FieldMappings {
  x: string | null;
  y: string | null;
  series: string | null;
  group: string | null;
  size: string | null;
  color: string | null;
  value: string | null;
}

export type FilterOperator = '=' | '!=' | 'contains' | '>' | '<' | '>=' | '<=' | 'between';

export interface FilterRule {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
  value2?: string; // for 'between'
}

export type TimeGrouping = 'none' | 'day' | 'week' | 'month' | 'quarter' | 'year';
export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count';
export type SortDirection = 'asc' | 'desc';

export interface TransformConfig {
  groupBy: TimeGrouping;
  aggregation: AggregationType;
  sortField: string | null;
  sortDirection: SortDirection;
  limit: number | null;
}

export type NumberFormat = 'number' | 'currency' | 'percent';

export interface AxisConfig {
  label: string;
  show: boolean;
  tickFormat: NumberFormat;
  currency: string;
  decimals: number;
  rotateTicks: boolean;
}

export interface SeriesConfig {
  showLegend: boolean;
  stacked: boolean;
  smooth: boolean;
}

export type ThemePreset = 'light' | 'dark';

export interface ReferenceLine {
  id: string;
  label: string;
  value: number;
  color: string;
  type: 'line' | 'band';
  value2?: number; // for bands
}

export interface StyleConfig {
  theme: ThemePreset;
  compactPadding: boolean;
  showBorder: boolean;
  showShadow: boolean;
  showTooltip: boolean;
  showGridlines: boolean;
  colorPalette: 'default' | 'warm' | 'cool' | 'monochrome' | 'vivid';
  seriesColors: Record<string, string>;
}

export interface ChartDefinition {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  datasetId: string;
  chartType: ChartType;
  mappings: FieldMappings;
  filters: FilterRule[];
  transform: TransformConfig;
  title: string;
  subtitle: string;
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  series: SeriesConfig;
  style: StyleConfig;
  referenceLines: ReferenceLine[];
}

export const DEFAULT_FIELD_MAPPINGS: FieldMappings = {
  x: null,
  y: null,
  series: null,
  group: null,
  size: null,
  color: null,
  value: null,
};

export const DEFAULT_TRANSFORM: TransformConfig = {
  groupBy: 'none',
  aggregation: 'sum',
  sortField: null,
  sortDirection: 'asc',
  limit: null,
};

export const DEFAULT_AXIS: AxisConfig = {
  label: '',
  show: true,
  tickFormat: 'number',
  currency: 'USD',
  decimals: 0,
  rotateTicks: false,
};

export const DEFAULT_SERIES: SeriesConfig = {
  showLegend: true,
  stacked: false,
  smooth: false,
};

export const DEFAULT_STYLE: StyleConfig = {
  theme: 'dark',
  compactPadding: false,
  showBorder: true,
  showShadow: true,
  showTooltip: true,
  showGridlines: true,
  colorPalette: 'default',
  seriesColors: {},
};

export function createDefaultChartDefinition(): ChartDefinition {
  return {
    id: crypto.randomUUID(),
    name: 'Untitled Chart',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    datasetId: '',
    chartType: 'bar',
    mappings: { ...DEFAULT_FIELD_MAPPINGS },
    filters: [],
    transform: { ...DEFAULT_TRANSFORM },
    title: '',
    subtitle: '',
    xAxis: { ...DEFAULT_AXIS },
    yAxis: { ...DEFAULT_AXIS },
    series: { ...DEFAULT_SERIES },
    style: { ...DEFAULT_STYLE },
    referenceLines: [],
  };
}

export const COLOR_PALETTES: Record<string, string[]> = {
  default: ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#6d28d9'],
  warm: ['#f97316', '#ef4444', '#eab308', '#f59e0b', '#dc2626', '#ea580c'],
  cool: ['#06b6d4', '#3b82f6', '#8b5cf6', '#0ea5e9', '#6366f1', '#0891b2'],
  monochrome: ['#e4e4e7', '#a1a1aa', '#71717a', '#52525b', '#3f3f46', '#27272a'],
  vivid: ['#f43f5e', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308', '#f97316'],
};

export const CHART_TYPE_INFO: Record<ChartType, { label: string; description: string; requiredFields: string[] }> = {
  kpi: { label: 'KPI / Stat', description: 'Single value with delta', requiredFields: ['value'] },
  line: { label: 'Line', description: 'Multi-series line chart', requiredFields: ['x', 'y'] },
  bar: { label: 'Bar', description: 'Grouped bar chart', requiredFields: ['x', 'y'] },
  'stacked-bar': { label: 'Stacked Bar', description: 'Stacked bar chart', requiredFields: ['x', 'y'] },
  area: { label: 'Area', description: 'Area chart with fill', requiredFields: ['x', 'y'] },
  pie: { label: 'Pie', description: 'Pie chart', requiredFields: ['x', 'value'] },
  donut: { label: 'Donut', description: 'Donut chart', requiredFields: ['x', 'value'] },
  scatter: { label: 'Scatter', description: 'Scatter plot', requiredFields: ['x', 'y'] },
  heatmap: { label: 'Heatmap', description: 'Value heatmap grid', requiredFields: ['x', 'y', 'value'] },
  sankey: { label: 'Sankey', description: 'Flow diagram', requiredFields: ['x', 'y', 'value'] },
};