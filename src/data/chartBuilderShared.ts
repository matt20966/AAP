export type BuilderChartType =
  | 'bar'
  | 'bar-stacked'
  | 'bar-grouped'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'kpi'
  | 'composed';

export type BuilderAggregationType = 'sum' | 'average' | 'count' | 'min' | 'max' | 'none';

export interface BuilderDataField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date';
}

export interface BuilderDataSource {
  label: string;
  description: string;
  icon: string;
  data: Record<string, any>[];
  fields: BuilderDataField[];
}

export interface BuilderColorScheme {
  name: string;
  colors: string[];
  gradient: [string, string];
}

export interface BuilderChartTypeConfig {
  id: BuilderChartType;
  label: string;
  icon: string;
  description: string;
  multiY: boolean;
}

const DASHBOARD_DATA = {
  salesByMonth: [
    { month: 'Jan', revenue: 42000, expenses: 28000, profit: 14000, orders: 156, customers: 89 },
    { month: 'Feb', revenue: 38000, expenses: 25000, profit: 13000, orders: 142, customers: 78 },
    { month: 'Mar', revenue: 51000, expenses: 32000, profit: 19000, orders: 189, customers: 102 },
    { month: 'Apr', revenue: 47000, expenses: 29000, profit: 18000, orders: 175, customers: 95 },
    { month: 'May', revenue: 53000, expenses: 34000, profit: 19000, orders: 198, customers: 110 },
    { month: 'Jun', revenue: 59000, expenses: 36000, profit: 23000, orders: 215, customers: 125 },
    { month: 'Jul', revenue: 62000, expenses: 38000, profit: 24000, orders: 228, customers: 132 },
    { month: 'Aug', revenue: 58000, expenses: 35000, profit: 23000, orders: 210, customers: 118 },
    { month: 'Sep', revenue: 65000, expenses: 40000, profit: 25000, orders: 245, customers: 140 },
    { month: 'Oct', revenue: 71000, expenses: 42000, profit: 29000, orders: 268, customers: 155 },
    { month: 'Nov', revenue: 68000, expenses: 41000, profit: 27000, orders: 252, customers: 148 },
    { month: 'Dec', revenue: 78000, expenses: 45000, profit: 33000, orders: 295, customers: 170 },
  ],
  salesByCategory: [
    { category: 'Electronics', sales: 125000, units: 3400, returns: 120, margin: 18 },
    { category: 'Clothing', sales: 89000, units: 5600, returns: 340, margin: 32 },
    { category: 'Home & Garden', sales: 67000, units: 2100, returns: 85, margin: 25 },
    { category: 'Sports', sales: 45000, units: 1800, returns: 62, margin: 22 },
    { category: 'Books', sales: 23000, units: 8900, returns: 45, margin: 35 },
    { category: 'Food & Beverage', sales: 156000, units: 12000, returns: 230, margin: 15 },
    { category: 'Automotive', sales: 98000, units: 890, returns: 35, margin: 20 },
    { category: 'Health', sales: 72000, units: 4200, returns: 110, margin: 28 },
  ],
  salesByRegion: [
    { region: 'North America', revenue: 280000, growth: 12, marketShare: 35, employees: 450 },
    { region: 'Europe', revenue: 220000, growth: 8, marketShare: 28, employees: 380 },
    { region: 'Asia Pacific', revenue: 185000, growth: 22, marketShare: 23, employees: 520 },
    { region: 'Latin America', revenue: 65000, growth: 15, marketShare: 8, employees: 120 },
    { region: 'Middle East', revenue: 48000, growth: 18, marketShare: 6, employees: 85 },
  ],
  employeePerformance: [
    { name: 'Sarah Chen', department: 'Sales', score: 95, deals: 42, revenue: 520000, tenure: 5 },
    { name: 'James Wilson', department: 'Sales', score: 88, deals: 35, revenue: 410000, tenure: 3 },
    { name: 'Maria Garcia', department: 'Marketing', score: 92, deals: 28, revenue: 380000, tenure: 4 },
    { name: 'David Kim', department: 'Engineering', score: 90, deals: 15, revenue: 290000, tenure: 6 },
    { name: 'Emma Thompson', department: 'Sales', score: 85, deals: 31, revenue: 360000, tenure: 2 },
    { name: 'Alex Patel', department: 'Marketing', score: 87, deals: 22, revenue: 310000, tenure: 3 },
    { name: 'Lisa Wang', department: 'Engineering', score: 93, deals: 18, revenue: 340000, tenure: 7 },
    { name: 'Tom Brown', department: 'Support', score: 78, deals: 12, revenue: 180000, tenure: 1 },
  ],
  inventoryStatus: [
    { product: 'Widget A', stock: 1250, reorderPoint: 500, leadTime: 7, cost: 12.5, status: 'In Stock' },
    { product: 'Widget B', stock: 320, reorderPoint: 400, leadTime: 14, cost: 28, status: 'Low Stock' },
    { product: 'Widget C', stock: 2100, reorderPoint: 800, leadTime: 5, cost: 8.75, status: 'In Stock' },
    { product: 'Widget D', stock: 45, reorderPoint: 200, leadTime: 21, cost: 45, status: 'Critical' },
    { product: 'Widget E', stock: 890, reorderPoint: 300, leadTime: 10, cost: 15.25, status: 'In Stock' },
    { product: 'Widget F', stock: 150, reorderPoint: 250, leadTime: 12, cost: 32, status: 'Low Stock' },
  ],
};

export const DATA_SOURCES: Record<string, BuilderDataSource> = {
  salesByMonth: {
    label: 'Sales by Month',
    description: 'Monthly revenue, expenses, profit, orders and customers',
    icon: 'trending-up',
    data: DASHBOARD_DATA.salesByMonth,
    fields: [
      { key: 'month', label: 'Month', type: 'string' },
      { key: 'revenue', label: 'Revenue', type: 'number' },
      { key: 'expenses', label: 'Expenses', type: 'number' },
      { key: 'profit', label: 'Profit', type: 'number' },
      { key: 'orders', label: 'Orders', type: 'number' },
      { key: 'customers', label: 'Customers', type: 'number' },
    ],
  },
  salesByCategory: {
    label: 'Sales by Category',
    description: 'Product category performance metrics',
    icon: 'bar-chart',
    data: DASHBOARD_DATA.salesByCategory,
    fields: [
      { key: 'category', label: 'Category', type: 'string' },
      { key: 'sales', label: 'Sales', type: 'number' },
      { key: 'units', label: 'Units Sold', type: 'number' },
      { key: 'returns', label: 'Returns', type: 'number' },
      { key: 'margin', label: 'Margin %', type: 'number' },
    ],
  },
  salesByRegion: {
    label: 'Sales by Region',
    description: 'Regional revenue and growth data',
    icon: 'grid',
    data: DASHBOARD_DATA.salesByRegion,
    fields: [
      { key: 'region', label: 'Region', type: 'string' },
      { key: 'revenue', label: 'Revenue', type: 'number' },
      { key: 'growth', label: 'Growth %', type: 'number' },
      { key: 'marketShare', label: 'Market Share %', type: 'number' },
      { key: 'employees', label: 'Employees', type: 'number' },
    ],
  },
  employeePerformance: {
    label: 'Employee Performance',
    description: 'Employee scores, deals, and revenue',
    icon: 'users',
    data: DASHBOARD_DATA.employeePerformance,
    fields: [
      { key: 'name', label: 'Employee Name', type: 'string' },
      { key: 'department', label: 'Department', type: 'string' },
      { key: 'score', label: 'Performance Score', type: 'number' },
      { key: 'deals', label: 'Deals Closed', type: 'number' },
      { key: 'revenue', label: 'Revenue Generated', type: 'number' },
      { key: 'tenure', label: 'Years Tenure', type: 'number' },
    ],
  },
  inventoryStatus: {
    label: 'Inventory Status',
    description: 'Current stock levels and reorder points',
    icon: 'activity',
    data: DASHBOARD_DATA.inventoryStatus,
    fields: [
      { key: 'product', label: 'Product', type: 'string' },
      { key: 'stock', label: 'Current Stock', type: 'number' },
      { key: 'reorderPoint', label: 'Reorder Point', type: 'number' },
      { key: 'leadTime', label: 'Lead Time (days)', type: 'number' },
      { key: 'cost', label: 'Unit Cost', type: 'number' },
      { key: 'status', label: 'Status', type: 'string' },
    ],
  },
};

export const COLOR_SCHEMES: Record<string, BuilderColorScheme> = {
  violet: { name: 'Violet', colors: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#7c3aed', '#6d28d9', '#5b21b6'], gradient: ['#8b5cf6', '#6d28d9'] },
  ocean: { name: 'Ocean', colors: ['#06b6d4', '#22d3ee', '#67e8f9', '#0891b2', '#0e7490', '#155e75'], gradient: ['#06b6d4', '#0e7490'] },
  emerald: { name: 'Emerald', colors: ['#10b981', '#34d399', '#6ee7b7', '#059669', '#047857', '#065f46'], gradient: ['#10b981', '#047857'] },
  sunset: { name: 'Sunset', colors: ['#f59e0b', '#f97316', '#ef4444', '#eab308', '#d97706', '#b91c1c'], gradient: ['#f59e0b', '#ef4444'] },
  rose: { name: 'Rose', colors: ['#f43f5e', '#fb7185', '#fda4af', '#e11d48', '#be123c', '#9f1239'], gradient: ['#f43f5e', '#be123c'] },
  slate: { name: 'Slate', colors: ['#64748b', '#94a3b8', '#cbd5e1', '#475569', '#334155', '#1e293b'], gradient: ['#64748b', '#334155'] },
  rainbow: { name: 'Rainbow', colors: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#ec4899'], gradient: ['#8b5cf6', '#ec4899'] },
};

export const CHART_TYPES: BuilderChartTypeConfig[] = [
  { id: 'bar', label: 'Bar', icon: 'bar-chart', description: 'Compare categories side by side', multiY: true },
  { id: 'bar-stacked', label: 'Stacked Bar', icon: 'bar-chart', description: 'Show composition of totals', multiY: true },
  { id: 'bar-grouped', label: 'Grouped Bar', icon: 'bar-chart', description: 'Compare multiple metrics', multiY: true },
  { id: 'line', label: 'Line', icon: 'trending-up', description: 'Show trends over time', multiY: true },
  { id: 'area', label: 'Area', icon: 'trending-up', description: 'Visualize volume trends', multiY: true },
  { id: 'pie', label: 'Pie', icon: 'activity', description: 'Part-to-whole relationships', multiY: false },
  { id: 'donut', label: 'Donut', icon: 'activity', description: 'Proportional breakdown', multiY: false },
  { id: 'kpi', label: 'KPI Card', icon: 'zap', description: 'Single metric highlight', multiY: false },
  { id: 'composed', label: 'Combined', icon: 'grid', description: 'Mix bar and line charts', multiY: true },
];

export function formatBuilderNumber(value: number, format: string): string {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
    case 'percent':
      return `${value}%`;
    case 'compact':
      return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
    default:
      return new Intl.NumberFormat('en-US').format(value);
  }
}
