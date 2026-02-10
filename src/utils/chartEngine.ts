// src/utils/chartEngine.ts

import type {
  Dataset,
  FilterRule,
  TransformConfig,
  FieldMappings,
  ChartType,
  ChartDefinition,
  AggregationType,
  NumberFormat,
} from '../types/charts';
import { COLOR_PALETTES } from '../types/charts';

export function applyFilters(rows: Record<string, any>[], filters: FilterRule[]): Record<string, any>[] {
  if (filters.length === 0) return rows;
  return rows.filter(row => {
    return filters.every(f => {
      const val = row[f.field];
      if (val === undefined || val === null) return false;
      const strVal = String(val).toLowerCase();
      const filterVal = f.value.toLowerCase();
      switch (f.operator) {
        case '=': return strVal === filterVal;
        case '!=': return strVal !== filterVal;
        case 'contains': return strVal.includes(filterVal);
        case '>': return Number(val) > Number(f.value);
        case '<': return Number(val) < Number(f.value);
        case '>=': return Number(val) >= Number(f.value);
        case '<=': return Number(val) <= Number(f.value);
        case 'between': return Number(val) >= Number(f.value) && Number(val) <= Number(f.value2 || f.value);
        default: return true;
      }
    });
  });
}

function getTimeBucket(dateStr: string, groupBy: TransformConfig['groupBy']): string {
  if (groupBy === 'none') return dateStr;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  switch (groupBy) {
    case 'day': return d.toISOString().slice(0, 10);
    case 'week': {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      return `W-${monday.toISOString().slice(0, 10)}`;
    }
    case 'month': return d.toISOString().slice(0, 7);
    case 'quarter': return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
    case 'year': return `${d.getFullYear()}`;
    default: return dateStr;
  }
}

function aggregate(values: number[], type: AggregationType): number {
  if (values.length === 0) return 0;
  switch (type) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    case 'count': return values.length;
    default: return values.reduce((a, b) => a + b, 0);
  }
}

export function applyTransforms(
  rows: Record<string, any>[],
  transform: TransformConfig,
  mappings: FieldMappings,
  fields: Dataset['fields']
): Record<string, any>[] {
  let result = [...rows];

  // Group by time bucketing
  if (transform.groupBy !== 'none' && mappings.x) {
    const xField = fields.find(f => f.id === mappings.x);
    if (xField && xField.type === 'date') {
      const groups = new Map<string, Record<string, any>[]>();
      result.forEach(row => {
        const bucket = getTimeBucket(String(row[mappings.x!]), transform.groupBy);
        const seriesKey = mappings.series ? String(row[mappings.series]) : '__all__';
        const key = `${bucket}|${seriesKey}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      });

      result = [];
      groups.forEach((groupRows, key) => {
        const [bucket, seriesKey] = key.split('|');
        const newRow: Record<string, any> = { [mappings.x!]: bucket };
        if (mappings.series && seriesKey !== '__all__') {
          newRow[mappings.series] = seriesKey;
        }
        // Aggregate numeric fields
        fields.forEach(f => {
          if (f.type === 'number') {
            const vals = groupRows.map(r => Number(r[f.id]) || 0);
            newRow[f.id] = Math.round(aggregate(vals, transform.aggregation) * 100) / 100;
          }
        });
        result.push(newRow);
      });
    }
  }

  // Sorting
  if (transform.sortField) {
    const sf = transform.sortField;
    const dir = transform.sortDirection === 'desc' ? -1 : 1;
    result.sort((a, b) => {
      const av = a[sf];
      const bv = b[sf];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  // Limit
  if (transform.limit && transform.limit > 0) {
    result = result.slice(0, transform.limit);
  }

  return result;
}

export function processData(
  dataset: Dataset,
  definition: ChartDefinition
): Record<string, any>[] {
  let rows = [...dataset.rows];
  rows = applyFilters(rows, definition.filters);
  rows = applyTransforms(rows, definition.transform, definition.mappings, dataset.fields);
  return rows;
}

export function formatValue(
  value: number,
  format: NumberFormat,
  currency: string = 'USD',
  decimals: number = 0
): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
    case 'percent':
      return `${value.toFixed(decimals)}%`;
    default:
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
  }
}

export function getChartColors(palette: string): string[] {
  return COLOR_PALETTES[palette] || COLOR_PALETTES.default;
}

export function getValidationErrors(definition: ChartDefinition): string[] {
  const errors: string[] = [];
  if (!definition.datasetId) errors.push('Select a dataset');
  if (!definition.chartType) errors.push('Choose a chart type');

  const info = {
    kpi: ['value'],
    line: ['x', 'y'],
    bar: ['x', 'y'],
    'stacked-bar': ['x', 'y'],
    area: ['x', 'y'],
    pie: ['x', 'value'],
    donut: ['x', 'value'],
    scatter: ['x', 'y'],
    heatmap: ['x', 'y', 'value'],
    sankey: ['x', 'y', 'value'],
  }[definition.chartType];

  if (info) {
    info.forEach(field => {
      const mapped = definition.mappings[field as keyof FieldMappings];
      if (!mapped) {
        errors.push(`Map a field to ${field.toUpperCase()}`);
      }
    });
  }

  return errors;
}

export function buildRechartsData(
  rows: Record<string, any>[],
  mappings: FieldMappings,
  chartType: ChartType
): { data: any[]; seriesKeys: string[] } {
  const { x, y, series, value } = mappings;

  if (chartType === 'kpi') {
    return { data: rows, seriesKeys: [] };
  }

  if (chartType === 'sankey') {
    return { data: rows, seriesKeys: [] };
  }

  if (chartType === 'pie' || chartType === 'donut') {
    if (!x || !value) return { data: [], seriesKeys: [] };
    const grouped = new Map<string, number>();
    rows.forEach(r => {
      const key = String(r[x]);
      grouped.set(key, (grouped.get(key) || 0) + (Number(r[value]) || 0));
    });
    const data = Array.from(grouped.entries()).map(([name, val]) => ({ name, value: val }));
    return { data, seriesKeys: data.map(d => d.name) };
  }

  if (chartType === 'heatmap') {
    return { data: rows, seriesKeys: [] };
  }

  if (!x || !y) return { data: [], seriesKeys: [] };

  if (series) {
    const seriesValues = [...new Set(rows.map(r => String(r[series])))];
    const grouped = new Map<string, Record<string, any>>();

    rows.forEach(r => {
      const xVal = String(r[x]);
      if (!grouped.has(xVal)) {
        grouped.set(xVal, { [x]: xVal });
      }
      const entry = grouped.get(xVal)!;
      const sKey = String(r[series]);
      entry[sKey] = (entry[sKey] || 0) + (Number(r[y]) || 0);
    });

    return {
      data: Array.from(grouped.values()),
      seriesKeys: seriesValues,
    };
  }

  // Simple x/y
  const grouped = new Map<string, number>();
  rows.forEach(r => {
    const xVal = String(r[x]);
    grouped.set(xVal, (grouped.get(xVal) || 0) + (Number(r[y]) || 0));
  });

  return {
    data: Array.from(grouped.entries()).map(([xVal, yVal]) => ({ [x]: xVal, [y]: yVal })),
    seriesKeys: [y],
  };
}