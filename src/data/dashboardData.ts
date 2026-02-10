// data/dashboardData.ts

import type {
  TimeRange,
  TabKey,
  KPIData,
  ChartData,
  PieSlice,
  SankeyData,
  SalesPersonRow,
  LowStockItem,
  WidgetConfig,
} from '../types/dashboard';

// ─── Helpers ──────────────────────────────────────────────────────────

function genLabels(range: TimeRange): string[] {
  switch (range) {
    case 'day':
      return Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
    case 'week':
      return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    case 'month':
      return Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`);
    case 'quarter':
      return ['Wk 1','Wk 2','Wk 3','Wk 4','Wk 5','Wk 6',
              'Wk 7','Wk 8','Wk 9','Wk 10','Wk 11','Wk 12'];
    case 'year':
      return ['Jan','Feb','Mar','Apr','May','Jun',
              'Jul','Aug','Sep','Oct','Nov','Dec'];
  }
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function genSeries(
  count: number,
  base: number,
  variance: number,
  trend: number,
  seed: number,
): number[] {
  const rng = seeded(seed);
  return Array.from({ length: count }, (_, i) => {
    const t = trend * (i / count);
    const v = base + t + (rng() - 0.4) * variance;
    return Math.max(0, Math.round(v));
  });
}

// Generate cumulative series (useful for area charts showing totals)
function genCumulativeSeries(
  count: number,
  base: number,
  increment: number,
  seed: number,
): number[] {
  const rng = seeded(seed);
  let total = base;
  return Array.from({ length: count }, () => {
    total += increment + (rng() - 0.3) * increment * 0.5;
    return Math.max(0, Math.round(total));
  });
}

// Generate percentage series (0-100)
function genPercentSeries(count: number, center: number, variance: number, seed: number): number[] {
  const rng = seeded(seed);
  return Array.from({ length: count }, () => {
    const v = center + (rng() - 0.5) * variance;
    return Math.min(100, Math.max(0, Math.round(v * 10) / 10));
  });
}

// Generate scatter data points
function genScatterData(
  count: number,
  xBase: number,
  yBase: number,
  spread: number,
  seed: number,
): Array<{ x: number; y: number; z: number }> {
  const rng = seeded(seed);
  return Array.from({ length: count }, () => ({
    x: Math.round(xBase + (rng() - 0.5) * spread),
    y: Math.round(yBase + (rng() - 0.5) * spread),
    z: Math.round(10 + rng() * 90),
  }));
}

// Generate heatmap data
function genHeatmapData(
  rows: number,
  cols: number,
  seed: number,
): Array<{ row: number; col: number; value: number }> {
  const rng = seeded(seed);
  const data: Array<{ row: number; col: number; value: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      data.push({ row: r, col: c, value: Math.round(rng() * 100) });
    }
  }
  return data;
}

const RANGE_MULT: Record<TimeRange, number> = {
  day: 1,
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

// ─── KPI Builders ─────────────────────────────────────────────────────

function kpiOrdersToPick(range: TimeRange): KPIData {
  const m = RANGE_MULT[range];
  return {
    label: 'Orders to Pick',
    value: Math.round(42 * (m / 30) + 8),
    previousValue: Math.round(38 * (m / 30) + 5),
    format: 'number',
    color: 'amber',
    icon: 'package',
  };
}

function kpiRevenue(range: TimeRange): KPIData {
  const m = RANGE_MULT[range];
  return {
    label: 'Revenue',
    value: Math.round(19200 * (m / 30)),
    previousValue: Math.round(17300 * (m / 30)),
    format: 'currency',
    color: 'emerald',
    icon: 'pound',
  };
}

function kpiProfit(range: TimeRange): KPIData {
  const m = RANGE_MULT[range];
  return {
    label: 'Profit',
    value: Math.round(6400 * (m / 30)),
    previousValue: Math.round(5800 * (m / 30)),
    format: 'currency',
    color: 'indigo',
    icon: 'trending-up',
  };
}

function kpiProfitPct(): KPIData {
  return {
    label: 'Profit %',
    value: 33.5,
    previousValue: 31.2,
    format: 'percent',
    color: 'violet',
    icon: 'percent',
  };
}

function kpiPackedToday(range: TimeRange): KPIData {
  const m = RANGE_MULT[range];
  return {
    label: 'Orders Packed Today',
    value: Math.round(156 * (m / 30)),
    previousValue: Math.round(142 * (m / 30)),
    format: 'number',
    color: 'sky',
    icon: 'box',
  };
}

function kpiShippedToday(range: TimeRange): KPIData {
  const m = RANGE_MULT[range];
  return {
    label: 'Orders Shipped Today',
    value: Math.round(134 * (m / 30)),
    previousValue: Math.round(128 * (m / 30)),
    format: 'number',
    color: 'emerald',
    icon: 'truck',
  };
}

function kpiAvgOrderValue(): KPIData {
  return {
    label: 'Avg Order Value',
    value: 144.50,
    previousValue: 135.00,
    format: 'currency',
    color: 'orange',
    icon: 'shopping-cart',
  };
}

// ─── NEW KPI Builders ─────────────────────────────────────────────────

function kpiConversionRate(): KPIData {
  return {
    label: 'Conversion Rate',
    value: 4.8,
    previousValue: 4.2,
    format: 'percent',
    color: 'emerald',
    icon: 'target',
  };
}

function kpiActiveUsers(range: TimeRange): KPIData {
  const m = RANGE_MULT[range];
  return {
    label: 'Active Users',
    value: Math.round(2340 * (m / 30)),
    previousValue: Math.round(2180 * (m / 30)),
    format: 'number',
    color: 'sky',
    icon: 'users',
  };
}

function kpiBounceRate(): KPIData {
  return {
    label: 'Bounce Rate',
    value: 32.4,
    previousValue: 35.1,
    format: 'percent',
    color: 'rose',
    icon: 'arrow-down',
  };
}

function kpiCustomerSatisfaction(): KPIData {
  return {
    label: 'CSAT Score',
    value: 92.3,
    previousValue: 89.7,
    format: 'percent',
    color: 'emerald',
    icon: 'star',
  };
}

function kpiReturnRate(): KPIData {
  return {
    label: 'Return Rate',
    value: 3.2,
    previousValue: 4.1,
    format: 'percent',
    color: 'amber',
    icon: 'refresh',
  };
}

function kpiAvgShipTime(): KPIData {
  return {
    label: 'Avg Ship Time',
    value: 1.8,
    previousValue: 2.1,
    format: 'number',
    color: 'sky',
    icon: 'clock',
  };
}

function kpiInventoryTurnover(): KPIData {
  return {
    label: 'Inventory Turnover',
    value: 8.4,
    previousValue: 7.9,
    format: 'number',
    color: 'violet',
    icon: 'rotate',
  };
}

function kpiNewCustomers(range: TimeRange): KPIData {
  const m = RANGE_MULT[range];
  return {
    label: 'New Customers',
    value: Math.round(384 * (m / 30)),
    previousValue: Math.round(342 * (m / 30)),
    format: 'number',
    color: 'cyan',
    icon: 'user-plus',
  };
}

// ─── Chart Builders ───────────────────────────────────────────────────

function chartRevenueProfit(range: TimeRange): ChartData {
  const labels = genLabels(range);
  const n = labels.length;
  return {
    labels,
    series: [
      { name: 'Revenue', data: genSeries(n, 1880, 630, 470, 42), color: '#10b981' },
      { name: 'Profit',  data: genSeries(n, 630, 235, 196, 84),  color: '#6366f1' },
    ],
  };
}

function chartOrders(range: TimeRange): ChartData {
  const labels = genLabels(range);
  const n = labels.length;
  return {
    labels,
    series: [
      { name: 'Orders', data: genSeries(n, 45, 20, 15, 123), color: '#0ea5e9' },
    ],
  };
}

function chartPicksPerPeriod(range: TimeRange): ChartData {
  const labels = genLabels(range);
  const n = labels.length;
  return {
    labels,
    series: [
      { name: 'Picks',  data: genSeries(n, 120, 40, 30, 456), color: '#f59e0b' },
      { name: 'Target', data: Array(n).fill(140),              color: '#374151' },
    ],
  };
}

function chartSalesByCategory(range: TimeRange): ChartData {
  const labels = genLabels(range);
  const n = labels.length;
  return {
    labels,
    series: [
      { name: 'Electronics',   data: genSeries(n, 630, 157, 118, 789), color: '#6366f1' },
      { name: 'Apparel',       data: genSeries(n, 470, 118, 78,  321), color: '#10b981' },
      { name: 'Home & Garden', data: genSeries(n, 314, 78,  63,  654), color: '#f59e0b' },
    ],
  };
}

// ─── NEW Chart Builders ───────────────────────────────────────────────

// Multi-line comparison chart
function chartTrafficSources(range: TimeRange): ChartData {
  const labels = genLabels(range);
  const n = labels.length;
  return {
    labels,
    series: [
      { name: 'Organic Search',  data: genSeries(n, 450, 120, 80, 111),  color: '#10b981' },
      { name: 'Direct',          data: genSeries(n, 280, 80, 40, 222),   color: '#6366f1' },
      { name: 'Social Media',    data: genSeries(n, 180, 60, 60, 333),   color: '#f59e0b' },
      { name: 'Email',           data: genSeries(n, 120, 40, 30, 444),   color: '#ef4444' },
      { name: 'Referral',        data: genSeries(n, 90, 30, 20, 555),    color: '#8b5cf6' },
    ],
  };
}

// Area chart - cumulative revenue
function chartCumulativeRevenue(range: TimeRange): ChartData {
  const labels = genLabels(range);
  const n = labels.length;
  return {
    labels,
    series: [
      { name: 'This Period',    data: genCumulativeSeries(n, 0, 640, 101), color: '#6366f1' },
      { name: 'Previous Period', data: genCumulativeSeries(n, 0, 580, 202), color: '#374151' },
    ],
  };
}

// Conversion funnel data
function chartConversionFunnel(): ChartData {
  return {
    labels: ['Visitors', 'Product Views', 'Add to Cart', 'Checkout', 'Purchase'],
    series: [
      { name: 'Users', data: [12400, 8200, 4100, 2800, 1950], color: '#6366f1' },
    ],
  };
}

// Hourly heatmap-style data
function chartHourlyActivity(range: TimeRange): ChartData {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return {
    labels,
    series: [
      { name: '06-09', data: genSeries(7, 20, 10, 5, 601),  color: '#1e3a5f' },
      { name: '09-12', data: genSeries(7, 80, 25, 10, 602), color: '#3b82f6' },
      { name: '12-15', data: genSeries(7, 95, 20, 5, 603),  color: '#6366f1' },
      { name: '15-18', data: genSeries(7, 75, 20, 8, 604),  color: '#8b5cf6' },
      { name: '18-21', data: genSeries(7, 55, 15, -5, 605), color: '#a78bfa' },
      { name: '21-00', data: genSeries(7, 25, 10, -3, 606), color: '#312e81' },
    ],
  };
}

// Customer retention cohort
function chartRetentionCohort(): ChartData {
  return {
    labels: ['Month 0', 'Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5', 'Month 6'],
    series: [
      { name: 'Jan Cohort', data: [100, 72, 58, 48, 42, 38, 35], color: '#6366f1' },
      { name: 'Feb Cohort', data: [100, 68, 54, 44, 39, 35, 0],  color: '#10b981' },
      { name: 'Mar Cohort', data: [100, 75, 62, 52, 46, 0, 0],   color: '#f59e0b' },
      { name: 'Apr Cohort', data: [100, 70, 56, 47, 0, 0, 0],    color: '#ef4444' },
      { name: 'May Cohort', data: [100, 73, 60, 0, 0, 0, 0],     color: '#8b5cf6' },
    ],
  };
}

// Performance metrics comparison (radar/spider chart data)
function chartPerformanceRadar(): ChartData {
  return {
    labels: ['Speed', 'Quality', 'Cost', 'Delivery', 'Support', 'Innovation'],
    series: [
      { name: 'Current',  data: [85, 72, 68, 90, 78, 65], color: '#6366f1' },
      { name: 'Target',   data: [90, 85, 75, 95, 85, 80], color: '#10b981' },
      { name: 'Industry', data: [70, 68, 72, 75, 70, 60], color: '#f59e0b' },
    ],
  };
}

// Expense breakdown over time
function chartExpenseBreakdown(range: TimeRange): ChartData {
  const labels = genLabels(range);
  const n = labels.length;
  return {
    labels,
    series: [
      { name: 'COGS',       data: genSeries(n, 420, 80, 40, 701),  color: '#ef4444' },
      { name: 'Marketing',  data: genSeries(n, 180, 50, 30, 702),  color: '#f59e0b' },
      { name: 'Operations', data: genSeries(n, 240, 60, 20, 703),  color: '#0ea5e9' },
      { name: 'Salaries',   data: genSeries(n, 350, 30, 10, 704),  color: '#8b5cf6' },
      { name: 'Other',      data: genSeries(n, 90, 25, 5, 705),    color: '#6b7280' },
    ],
  };
}

// Inventory levels
function chartInventoryLevels(range: TimeRange): ChartData {
  const labels = genLabels(range);
  const n = labels.length;
  return {
    labels,
    series: [
      { name: 'In Stock',     data: genSeries(n, 2400, 300, -100, 801), color: '#10b981' },
      { name: 'Reserved',     data: genSeries(n, 450, 100, 50, 802),    color: '#f59e0b' },
      { name: 'Reorder Point', data: Array(n).fill(800),                 color: '#ef4444' },
    ],
  };
}

// Page views vs sessions
function chartWebAnalytics(range: TimeRange): ChartData {
  const labels = genLabels(range);
  const n = labels.length;
  return {
    labels,
    series: [
      { name: 'Page Views', data: genSeries(n, 3200, 800, 400, 901),  color: '#6366f1' },
      { name: 'Sessions',   data: genSeries(n, 1200, 300, 150, 902),  color: '#10b981' },
      { name: 'Unique Users', data: genSeries(n, 800, 200, 100, 903), color: '#f59e0b' },
    ],
  };
}

// Order status distribution over time
function chartOrderStatus(range: TimeRange): ChartData {
  const labels = genLabels(range);
  const n = labels.length;
  return {
    labels,
    series: [
      { name: 'Completed',  data: genSeries(n, 85, 15, 10, 1001),  color: '#10b981' },
      { name: 'Processing', data: genSeries(n, 35, 10, 5, 1002),   color: '#f59e0b' },
      { name: 'Pending',    data: genSeries(n, 20, 8, -3, 1003),    color: '#6366f1' },
      { name: 'Cancelled',  data: genSeries(n, 5, 3, 0, 1004),     color: '#ef4444' },
    ],
  };
}

// Shipping carrier performance
function chartCarrierPerformance(): ChartData {
  return {
    labels: ['DHL', 'FedEx', 'UPS', 'Royal Mail', 'DPD', 'Hermes'],
    series: [
      { name: 'On Time %',   data: [94, 91, 89, 86, 92, 78], color: '#10b981' },
      { name: 'Cost Index',  data: [72, 85, 80, 45, 65, 38], color: '#6366f1' },
      { name: 'Damage Rate', data: [2, 3, 4, 5, 2, 8],       color: '#ef4444' },
    ],
  };
}

// Revenue by region
function chartRevenueByRegion(range: TimeRange): ChartData {
  const labels = genLabels(range);
  const n = labels.length;
  return {
    labels,
    series: [
      { name: 'UK',     data: genSeries(n, 800, 200, 100, 1101), color: '#6366f1' },
      { name: 'EU',     data: genSeries(n, 520, 150, 80, 1102),  color: '#10b981' },
      { name: 'US',     data: genSeries(n, 380, 120, 60, 1103),  color: '#f59e0b' },
      { name: 'Asia',   data: genSeries(n, 200, 80, 50, 1104),   color: '#0ea5e9' },
      { name: 'Other',  data: genSeries(n, 100, 40, 20, 1105),   color: '#8b5cf6' },
    ],
  };
}

// Customer acquisition cost
function chartCAC(range: TimeRange): ChartData {
  const labels = genLabels(range);
  const n = labels.length;
  return {
    labels,
    series: [
      { name: 'CAC',      data: genSeries(n, 42, 12, -5, 1201),  color: '#ef4444' },
      { name: 'LTV',      data: genSeries(n, 380, 80, 40, 1202), color: '#10b981' },
      { name: 'LTV:CAC',  data: genSeries(n, 9, 2, 1, 1203),     color: '#6366f1' },
    ],
  };
}

// Support tickets
function chartSupportTickets(range: TimeRange): ChartData {
  const labels = genLabels(range);
  const n = labels.length;
  return {
    labels,
    series: [
      { name: 'Opened',   data: genSeries(n, 45, 15, 5, 1301),   color: '#ef4444' },
      { name: 'Resolved', data: genSeries(n, 42, 12, 8, 1302),   color: '#10b981' },
      { name: 'Backlog',  data: genSeries(n, 18, 8, -3, 1303),    color: '#f59e0b' },
    ],
  };
}

// ─── Pie Builders ─────────────────────────────────────────────────────

function pieRevenueByChannel(): PieSlice[] {
  return [
    { name: 'Online Store', value: 35400, color: '#6366f1' },
    { name: 'Marketplace',  value: 22200, color: '#10b981' },
    { name: 'Wholesale',    value: 14600, color: '#f59e0b' },
    { name: 'Retail',       value: 10000, color: '#0ea5e9' },
    { name: 'Other',        value: 4100,  color: '#8b5cf6' },
  ];
}

function pieRevenueByProduct(): PieSlice[] {
  return [
    { name: 'Electronics',   value: 29800, color: '#6366f1' },
    { name: 'Apparel',       value: 18800, color: '#10b981' },
    { name: 'Home & Garden', value: 14100, color: '#f59e0b' },
    { name: 'Sports',        value: 9400,  color: '#ef4444' },
    { name: 'Books',         value: 6300,  color: '#0ea5e9' },
  ];
}

// ─── NEW Pie Builders ─────────────────────────────────────────────────

function pieCustomerSegments(): PieSlice[] {
  return [
    { name: 'Enterprise',   value: 42000, color: '#6366f1' },
    { name: 'SMB',           value: 28000, color: '#10b981' },
    { name: 'Startup',       value: 15000, color: '#f59e0b' },
    { name: 'Individual',    value: 9000,  color: '#0ea5e9' },
    { name: 'Government',    value: 6000,  color: '#8b5cf6' },
  ];
}

function pieDeviceBreakdown(): PieSlice[] {
  return [
    { name: 'Desktop',  value: 52, color: '#6366f1' },
    { name: 'Mobile',   value: 38, color: '#10b981' },
    { name: 'Tablet',   value: 8,  color: '#f59e0b' },
    { name: 'Other',    value: 2,  color: '#6b7280' },
  ];
}

function piePaymentMethods(): PieSlice[] {
  return [
    { name: 'Credit Card',  value: 45, color: '#6366f1' },
    { name: 'PayPal',       value: 22, color: '#0ea5e9' },
    { name: 'Bank Transfer', value: 18, color: '#10b981' },
    { name: 'Apple Pay',    value: 10, color: '#374151' },
    { name: 'Google Pay',   value: 5,  color: '#f59e0b' },
  ];
}

function pieOrdersByRegion(): PieSlice[] {
  return [
    { name: 'England',   value: 62, color: '#6366f1' },
    { name: 'Scotland',  value: 12, color: '#10b981' },
    { name: 'Wales',     value: 8,  color: '#f59e0b' },
    { name: 'N. Ireland', value: 5,  color: '#0ea5e9' },
    { name: 'International', value: 13, color: '#8b5cf6' },
  ];
}

function pieExpenseCategories(): PieSlice[] {
  return [
    { name: 'COGS',        value: 42, color: '#ef4444' },
    { name: 'Marketing',   value: 18, color: '#f59e0b' },
    { name: 'Operations',  value: 15, color: '#0ea5e9' },
    { name: 'Salaries',    value: 20, color: '#8b5cf6' },
    { name: 'Other',       value: 5,  color: '#6b7280' },
  ];
}

function pieAgeDistribution(): PieSlice[] {
  return [
    { name: '18-24', value: 15, color: '#22d3ee' },
    { name: '25-34', value: 32, color: '#6366f1' },
    { name: '35-44', value: 25, color: '#10b981' },
    { name: '45-54', value: 18, color: '#f59e0b' },
    { name: '55+',   value: 10, color: '#ef4444' },
  ];
}

// ─── Sankey Builders ──────────────────────────────────────────────────

function sankeyOrderFlow(): SankeyData {
  return {
    nodes: [
      { id: 'received', label: 'Received', color: '#6366f1' },
      { id: 'pick',     label: 'Pick',     color: '#f59e0b' },
      { id: 'pack',     label: 'Pack',     color: '#0ea5e9' },
      { id: 'ship',     label: 'Ship',     color: '#10b981' },
      { id: 'returned', label: 'Returned', color: '#ef4444' },
    ],
    links: [
      { source: 'received', target: 'pick', value: 450, color: 'rgba(99,102,241,0.3)' },
      { source: 'pick',     target: 'pack', value: 420, color: 'rgba(245,158,11,0.3)' },
      { source: 'pack',     target: 'ship', value: 400, color: 'rgba(14,165,233,0.3)' },
      { source: 'ship',     target: 'returned', value: 28, color: 'rgba(239,68,68,0.3)' },
    ],
  };
}

// NEW: Marketing funnel sankey
function sankeyMarketingFunnel(): SankeyData {
  return {
    nodes: [
      { id: 'awareness',    label: 'Awareness',    color: '#6366f1' },
      { id: 'interest',     label: 'Interest',     color: '#8b5cf6' },
      { id: 'consideration', label: 'Consideration', color: '#f59e0b' },
      { id: 'intent',       label: 'Intent',       color: '#0ea5e9' },
      { id: 'purchase',     label: 'Purchase',     color: '#10b981' },
      { id: 'loyalty',      label: 'Loyalty',      color: '#22d3ee' },
      { id: 'churned',      label: 'Churned',      color: '#ef4444' },
    ],
    links: [
      { source: 'awareness',    target: 'interest',     value: 8000,  color: 'rgba(99,102,241,0.25)' },
      { source: 'awareness',    target: 'churned',      value: 4000,  color: 'rgba(239,68,68,0.15)' },
      { source: 'interest',     target: 'consideration', value: 5500,  color: 'rgba(139,92,246,0.25)' },
      { source: 'interest',     target: 'churned',      value: 2500,  color: 'rgba(239,68,68,0.15)' },
      { source: 'consideration', target: 'intent',      value: 3800,  color: 'rgba(245,158,11,0.25)' },
      { source: 'consideration', target: 'churned',     value: 1700,  color: 'rgba(239,68,68,0.15)' },
      { source: 'intent',       target: 'purchase',     value: 2900,  color: 'rgba(14,165,233,0.25)' },
      { source: 'intent',       target: 'churned',      value: 900,   color: 'rgba(239,68,68,0.15)' },
      { source: 'purchase',     target: 'loyalty',      value: 2200,  color: 'rgba(16,185,129,0.25)' },
      { source: 'purchase',     target: 'churned',      value: 700,   color: 'rgba(239,68,68,0.15)' },
    ],
  };
}

// NEW: Revenue flow sankey
function sankeyRevenueFlow(): SankeyData {
  return {
    nodes: [
      { id: 'online',     label: 'Online',     color: '#6366f1' },
      { id: 'retail',     label: 'Retail',     color: '#10b981' },
      { id: 'wholesale',  label: 'Wholesale',  color: '#f59e0b' },
      { id: 'electronics', label: 'Electronics', color: '#0ea5e9' },
      { id: 'apparel',    label: 'Apparel',    color: '#8b5cf6' },
      { id: 'home',       label: 'Home',       color: '#22d3ee' },
      { id: 'uk',         label: 'UK',         color: '#10b981' },
      { id: 'eu',         label: 'EU',         color: '#f59e0b' },
      { id: 'intl',       label: 'International', color: '#6366f1' },
    ],
    links: [
      { source: 'online',    target: 'electronics', value: 3200, color: 'rgba(99,102,241,0.25)' },
      { source: 'online',    target: 'apparel',     value: 2100, color: 'rgba(99,102,241,0.20)' },
      { source: 'online',    target: 'home',        value: 1400, color: 'rgba(99,102,241,0.15)' },
      { source: 'retail',    target: 'electronics', value: 1800, color: 'rgba(16,185,129,0.25)' },
      { source: 'retail',    target: 'apparel',     value: 1200, color: 'rgba(16,185,129,0.20)' },
      { source: 'wholesale', target: 'electronics', value: 900,  color: 'rgba(245,158,11,0.25)' },
      { source: 'wholesale', target: 'home',        value: 700,  color: 'rgba(245,158,11,0.20)' },
      { source: 'electronics', target: 'uk',        value: 3500, color: 'rgba(14,165,233,0.25)' },
      { source: 'electronics', target: 'eu',        value: 1600, color: 'rgba(14,165,233,0.20)' },
      { source: 'electronics', target: 'intl',      value: 800,  color: 'rgba(14,165,233,0.15)' },
      { source: 'apparel',  target: 'uk',           value: 2200, color: 'rgba(139,92,246,0.25)' },
      { source: 'apparel',  target: 'eu',           value: 1100, color: 'rgba(139,92,246,0.20)' },
      { source: 'home',     target: 'uk',           value: 1500, color: 'rgba(34,211,238,0.25)' },
      { source: 'home',     target: 'intl',         value: 600,  color: 'rgba(34,211,238,0.15)' },
    ],
  };
}

// ─── Table Builders ───────────────────────────────────────────────────

function tableTopSales(): SalesPersonRow[] {
  return [
    { rank: 1, name: 'Sarah Chen',       avatar: 'SC', revenue: 111600, profit: 37700, winRate: 78, deals: 34 },
    { rank: 2, name: 'Marcus Johnson',   avatar: 'MJ', revenue: 100900, profit: 32700, winRate: 72, deals: 29 },
    { rank: 3, name: 'Emily Rodriguez',  avatar: 'ER', revenue: 92600,  profit: 30900, winRate: 69, deals: 31 },
    { rank: 4, name: 'David Kim',        avatar: 'DK', revenue: 77300,  profit: 25100, winRate: 65, deals: 26 },
    { rank: 5, name: 'Lisa Thompson',    avatar: 'LT', revenue: 68400,  profit: 22600, winRate: 71, deals: 22 },
    { rank: 6, name: 'James Wilson',     avatar: 'JW', revenue: 59700,  profit: 18900, winRate: 63, deals: 19 },
    { rank: 7, name: 'Anna Petrov',      avatar: 'AP', revenue: 53900,  profit: 17500, winRate: 67, deals: 18 },
    { rank: 8, name: 'Robert Chang',     avatar: 'RC', revenue: 42500,  profit: 13900, winRate: 58, deals: 15 },
  ];
}

function tableLowStock(): LowStockItem[] {
  return [
    { sku: 'ELC-001', name: 'Wireless Mouse Pro', currentStock: 3,  reorderPoint: 25, category: 'Electronics', status: 'critical' },
    { sku: 'ELC-045', name: 'USB-C Hub 7-Port',   currentStock: 8,  reorderPoint: 30, category: 'Electronics', status: 'critical' },
    { sku: 'APP-112', name: 'Cotton T-Shirt XL',  currentStock: 12, reorderPoint: 40, category: 'Apparel',     status: 'low' },
    { sku: 'HOM-089', name: 'LED Desk Lamp',      currentStock: 15, reorderPoint: 35, category: 'Home',        status: 'low' },
    { sku: 'SPT-034', name: 'Yoga Mat Premium',   currentStock: 18, reorderPoint: 30, category: 'Sports',      status: 'warning' },
    { sku: 'ELC-078', name: 'Bluetooth Speaker',  currentStock: 20, reorderPoint: 35, category: 'Electronics', status: 'warning' },
    { sku: 'APP-056', name: 'Running Shoes 10',   currentStock: 22, reorderPoint: 30, category: 'Apparel',     status: 'warning' },
  ];
}

// ─── NEW Table Builders ───────────────────────────────────────────────

function tableRecentOrders(): Array<Record<string, any>> {
  return [
    { orderId: 'ORD-4521', customer: 'Acme Corp', items: 5, total: 1245.00, status: 'shipped', date: '2024-01-15' },
    { orderId: 'ORD-4520', customer: 'Tech Solutions', items: 3, total: 890.50, status: 'processing', date: '2024-01-15' },
    { orderId: 'ORD-4519', customer: 'Green Living', items: 8, total: 2340.00, status: 'shipped', date: '2024-01-14' },
    { orderId: 'ORD-4518', customer: 'Daily Goods', items: 2, total: 456.75, status: 'pending', date: '2024-01-14' },
    { orderId: 'ORD-4517', customer: 'Fresh Foods', items: 12, total: 3120.00, status: 'shipped', date: '2024-01-14' },
    { orderId: 'ORD-4516', customer: 'Style Hub', items: 6, total: 1680.25, status: 'completed', date: '2024-01-13' },
    { orderId: 'ORD-4515', customer: 'Home Plus', items: 4, total: 920.00, status: 'completed', date: '2024-01-13' },
    { orderId: 'ORD-4514', customer: 'Sport Zone', items: 7, total: 1890.50, status: 'returned', date: '2024-01-12' },
  ];
}

function tableTopProducts(): Array<Record<string, any>> {
  return [
    { rank: 1, product: 'Wireless Earbuds Pro', sku: 'ELC-201', unitsSold: 1240, revenue: 62000, margin: 42, trend: 'up' },
    { rank: 2, product: 'Smart Watch X1', sku: 'ELC-089', unitsSold: 890, revenue: 53400, margin: 38, trend: 'up' },
    { rank: 3, product: 'Organic Cotton Tee', sku: 'APP-045', unitsSold: 2100, revenue: 42000, margin: 55, trend: 'stable' },
    { rank: 4, product: 'LED Panel Light', sku: 'HOM-156', unitsSold: 780, revenue: 39000, margin: 44, trend: 'up' },
    { rank: 5, product: 'Running Shoes V3', sku: 'SPT-078', unitsSold: 650, revenue: 32500, margin: 40, trend: 'down' },
    { rank: 6, product: 'Yoga Mat Premium', sku: 'SPT-034', unitsSold: 920, revenue: 27600, margin: 52, trend: 'up' },
    { rank: 7, product: 'Phone Case Ultra', sku: 'ELC-312', unitsSold: 3400, revenue: 23800, margin: 65, trend: 'stable' },
    { rank: 8, product: 'Bamboo Water Bottle', sku: 'HOM-201', unitsSold: 1100, revenue: 22000, margin: 48, trend: 'up' },
  ];
}

function tableCustomerActivity(): Array<Record<string, any>> {
  return [
    { customer: 'Acme Corp', segment: 'Enterprise', orders: 45, ltv: 128000, lastOrder: '2 hours ago', health: 'excellent' },
    { customer: 'Tech Solutions', segment: 'SMB', orders: 28, ltv: 64000, lastOrder: '1 day ago', health: 'good' },
    { customer: 'Green Living', segment: 'SMB', orders: 34, ltv: 52000, lastOrder: '3 hours ago', health: 'excellent' },
    { customer: 'Style Hub', segment: 'Enterprise', orders: 62, ltv: 186000, lastOrder: '5 hours ago', health: 'excellent' },
    { customer: 'Daily Goods', segment: 'Startup', orders: 12, ltv: 18000, lastOrder: '3 days ago', health: 'at-risk' },
    { customer: 'Fresh Foods', segment: 'SMB', orders: 21, ltv: 42000, lastOrder: '1 day ago', health: 'good' },
  ];
}

// ═══════════════════════════════════════════════════════════════════════
// ─── CHART REGISTRY ───────────────────────────────────────────────────
// This is the key to easily adding new charts. Register any new chart
// builder here and it automatically becomes available everywhere.
// ═══════════════════════════════════════════════════════════════════════

export interface ChartRegistryEntry {
  key: string;
  label: string;
  description: string;
  category: 'kpi' | 'line' | 'bar' | 'stacked' | 'area' | 'pie' | 'sankey' | 'table' | 'funnel' | 'radar';
  widgetType: WidgetConfig['type'];
  defaultColor: string;
  defaultW: number;
  defaultH: number;
  builder: (range: TimeRange) => any;
}

export const CHART_REGISTRY: ChartRegistryEntry[] = [
  // ── KPIs ──
  { key: 'ordersToPick',     label: 'Orders to Pick',      description: 'Orders awaiting picking',        category: 'kpi',     widgetType: 'kpi',        defaultColor: 'amber',   defaultW: 3, defaultH: 2, builder: kpiOrdersToPick },
  { key: 'revenue',          label: 'Revenue',              description: 'Total revenue',                  category: 'kpi',     widgetType: 'kpi',        defaultColor: 'emerald', defaultW: 3, defaultH: 2, builder: kpiRevenue },
  { key: 'profit',           label: 'Profit',               description: 'Net profit',                     category: 'kpi',     widgetType: 'kpi',        defaultColor: 'indigo',  defaultW: 3, defaultH: 2, builder: kpiProfit },
  { key: 'profitPct',        label: 'Profit %',             description: 'Profit margin percentage',       category: 'kpi',     widgetType: 'kpi',        defaultColor: 'violet',  defaultW: 3, defaultH: 2, builder: () => kpiProfitPct() },
  { key: 'packedToday',      label: 'Orders Packed',        description: 'Orders packed in period',        category: 'kpi',     widgetType: 'kpi',        defaultColor: 'sky',     defaultW: 3, defaultH: 2, builder: kpiPackedToday },
  { key: 'shippedToday',     label: 'Orders Shipped',       description: 'Orders shipped in period',       category: 'kpi',     widgetType: 'kpi',        defaultColor: 'emerald', defaultW: 3, defaultH: 2, builder: kpiShippedToday },
  { key: 'avgOrderValue',    label: 'Avg Order Value',      description: 'Average order value',            category: 'kpi',     widgetType: 'kpi',        defaultColor: 'orange',  defaultW: 3, defaultH: 2, builder: () => kpiAvgOrderValue() },
  { key: 'conversionRate',   label: 'Conversion Rate',      description: 'Visitor to customer conversion', category: 'kpi',     widgetType: 'kpi',        defaultColor: 'emerald', defaultW: 3, defaultH: 2, builder: () => kpiConversionRate() },
  { key: 'activeUsers',      label: 'Active Users',         description: 'Active users in period',         category: 'kpi',     widgetType: 'kpi',        defaultColor: 'sky',     defaultW: 3, defaultH: 2, builder: kpiActiveUsers },
  { key: 'bounceRate',       label: 'Bounce Rate',          description: 'Site bounce rate',               category: 'kpi',     widgetType: 'kpi',        defaultColor: 'rose',    defaultW: 3, defaultH: 2, builder: () => kpiBounceRate() },
  { key: 'csatScore',        label: 'CSAT Score',           description: 'Customer satisfaction score',    category: 'kpi',     widgetType: 'kpi',        defaultColor: 'emerald', defaultW: 3, defaultH: 2, builder: () => kpiCustomerSatisfaction() },
  { key: 'returnRate',       label: 'Return Rate',          description: 'Product return percentage',      category: 'kpi',     widgetType: 'kpi',        defaultColor: 'amber',   defaultW: 3, defaultH: 2, builder: () => kpiReturnRate() },
  { key: 'avgShipTime',      label: 'Avg Ship Time',        description: 'Average shipping time (days)',   category: 'kpi',     widgetType: 'kpi',        defaultColor: 'sky',     defaultW: 3, defaultH: 2, builder: () => kpiAvgShipTime() },
  { key: 'inventoryTurnover', label: 'Inventory Turnover',  description: 'Inventory turnover ratio',       category: 'kpi',     widgetType: 'kpi',        defaultColor: 'violet',  defaultW: 3, defaultH: 2, builder: () => kpiInventoryTurnover() },
  { key: 'newCustomers',     label: 'New Customers',        description: 'New customers acquired',         category: 'kpi',     widgetType: 'kpi',        defaultColor: 'cyan',    defaultW: 3, defaultH: 2, builder: kpiNewCustomers },

  // ── Line Charts ──
  { key: 'revenueProfit',    label: 'Revenue & Profit',     description: 'Revenue vs profit trend',        category: 'line',    widgetType: 'line-chart', defaultColor: 'emerald', defaultW: 8, defaultH: 5, builder: chartRevenueProfit },
  { key: 'orders',           label: 'Orders',               description: 'Order volume over time',         category: 'line',    widgetType: 'line-chart', defaultColor: 'sky',     defaultW: 6, defaultH: 5, builder: chartOrders },
  { key: 'trafficSources',   label: 'Traffic Sources',      description: 'Website traffic by source',      category: 'line',    widgetType: 'line-chart', defaultColor: 'indigo',  defaultW: 8, defaultH: 5, builder: chartTrafficSources },
  { key: 'cumulativeRevenue', label: 'Cumulative Revenue',  description: 'Running total revenue',          category: 'line',    widgetType: 'line-chart', defaultColor: 'violet',  defaultW: 6, defaultH: 5, builder: chartCumulativeRevenue },
  { key: 'retentionCohort',  label: 'Retention Cohorts',    description: 'Customer retention by cohort',   category: 'line',    widgetType: 'line-chart', defaultColor: 'emerald', defaultW: 8, defaultH: 5, builder: chartRetentionCohort },
  { key: 'webAnalytics',     label: 'Web Analytics',        description: 'Page views, sessions, users',    category: 'line',    widgetType: 'line-chart', defaultColor: 'indigo',  defaultW: 8, defaultH: 5, builder: chartWebAnalytics },
  { key: 'cacMetrics',       label: 'CAC & LTV',            description: 'Customer acquisition metrics',   category: 'line',    widgetType: 'line-chart', defaultColor: 'emerald', defaultW: 6, defaultH: 5, builder: chartCAC },
  { key: 'supportTickets',   label: 'Support Tickets',      description: 'Support ticket volume',          category: 'line',    widgetType: 'line-chart', defaultColor: 'amber',   defaultW: 6, defaultH: 5, builder: chartSupportTickets },

  // ── Bar Charts ──
  { key: 'picksPerPeriod',   label: 'Picks per Period',     description: 'Warehouse picking rate',         category: 'bar',     widgetType: 'bar-chart',  defaultColor: 'amber',   defaultW: 7, defaultH: 5, builder: chartPicksPerPeriod },
  { key: 'carrierPerformance', label: 'Carrier Performance', description: 'Shipping carrier comparison',   category: 'bar',     widgetType: 'bar-chart',  defaultColor: 'sky',     defaultW: 6, defaultH: 5, builder: () => chartCarrierPerformance() },
  { key: 'conversionFunnel', label: 'Conversion Funnel',    description: 'Sales conversion funnel',        category: 'bar',     widgetType: 'bar-chart',  defaultColor: 'indigo',  defaultW: 6, defaultH: 5, builder: () => chartConversionFunnel() },
  { key: 'performanceRadar', label: 'Performance Metrics',  description: 'Multi-axis performance',         category: 'bar',     widgetType: 'bar-chart',  defaultColor: 'violet',  defaultW: 6, defaultH: 5, builder: () => chartPerformanceRadar() },

  // ── Stacked Charts ──
  { key: 'salesByCategory',  label: 'Sales by Category',    description: 'Sales breakdown by category',    category: 'stacked', widgetType: 'stacked-bar', defaultColor: 'emerald', defaultW: 6, defaultH: 5, builder: chartSalesByCategory },
  { key: 'expenseBreakdown', label: 'Expense Breakdown',    description: 'Expenses by type over time',     category: 'stacked', widgetType: 'stacked-bar', defaultColor: 'rose',    defaultW: 8, defaultH: 5, builder: chartExpenseBreakdown },
  { key: 'revenueByRegion',  label: 'Revenue by Region',    description: 'Regional revenue distribution',  category: 'stacked', widgetType: 'stacked-bar', defaultColor: 'indigo',  defaultW: 8, defaultH: 5, builder: chartRevenueByRegion },
  { key: 'orderStatus',      label: 'Order Status',         description: 'Order status distribution',      category: 'stacked', widgetType: 'stacked-bar', defaultColor: 'emerald', defaultW: 7, defaultH: 5, builder: chartOrderStatus },
  { key: 'inventoryLevels',  label: 'Inventory Levels',     description: 'Stock levels over time',         category: 'stacked', widgetType: 'stacked-bar', defaultColor: 'amber',   defaultW: 7, defaultH: 5, builder: chartInventoryLevels },
  { key: 'hourlyActivity',   label: 'Hourly Activity',      description: 'Activity heatmap by time',       category: 'stacked', widgetType: 'stacked-bar', defaultColor: 'indigo',  defaultW: 8, defaultH: 5, builder: chartHourlyActivity },

  // ── Pie Charts ──
  { key: 'revenueByChannel', label: 'Revenue by Channel',   description: 'Channel revenue split',          category: 'pie',     widgetType: 'pie-chart',  defaultColor: 'indigo',  defaultW: 4, defaultH: 5, builder: () => pieRevenueByChannel() },
  { key: 'revenueByProduct', label: 'Revenue by Product',   description: 'Product revenue split',          category: 'pie',     widgetType: 'pie-chart',  defaultColor: 'violet',  defaultW: 4, defaultH: 5, builder: () => pieRevenueByProduct() },
  { key: 'customerSegments', label: 'Customer Segments',    description: 'Customer type breakdown',        category: 'pie',     widgetType: 'pie-chart',  defaultColor: 'emerald', defaultW: 4, defaultH: 5, builder: () => pieCustomerSegments() },
  { key: 'deviceBreakdown',  label: 'Device Breakdown',     description: 'Traffic by device type',         category: 'pie',     widgetType: 'pie-chart',  defaultColor: 'sky',     defaultW: 4, defaultH: 5, builder: () => pieDeviceBreakdown() },
  { key: 'paymentMethods',   label: 'Payment Methods',      description: 'Payment method distribution',    category: 'pie',     widgetType: 'pie-chart',  defaultColor: 'indigo',  defaultW: 4, defaultH: 5, builder: () => piePaymentMethods() },
  { key: 'ordersByRegion',   label: 'Orders by Region',     description: 'Geographic order distribution',  category: 'pie',     widgetType: 'pie-chart',  defaultColor: 'amber',   defaultW: 4, defaultH: 5, builder: () => pieOrdersByRegion() },
  { key: 'expenseCategories', label: 'Expense Categories',  description: 'Spending category split',        category: 'pie',     widgetType: 'pie-chart',  defaultColor: 'rose',    defaultW: 4, defaultH: 5, builder: () => pieExpenseCategories() },
  { key: 'ageDistribution',  label: 'Age Distribution',     description: 'Customer age groups',            category: 'pie',     widgetType: 'pie-chart',  defaultColor: 'cyan',    defaultW: 4, defaultH: 5, builder: () => pieAgeDistribution() },

  // ── Sankey Diagrams ──
  { key: 'orderFlow',        label: 'Order Flow',           description: 'Order processing pipeline',      category: 'sankey',  widgetType: 'sankey',     defaultColor: 'sky',     defaultW: 12, defaultH: 5, builder: () => sankeyOrderFlow() },
  { key: 'marketingFunnel',  label: 'Marketing Funnel',     description: 'Marketing to purchase flow',     category: 'sankey',  widgetType: 'sankey',     defaultColor: 'violet',  defaultW: 12, defaultH: 6, builder: () => sankeyMarketingFunnel() },
  { key: 'revenueFlow',      label: 'Revenue Flow',         description: 'Revenue channel to region flow', category: 'sankey',  widgetType: 'sankey',     defaultColor: 'indigo',  defaultW: 12, defaultH: 6, builder: () => sankeyRevenueFlow() },

  // ── Tables ──
  { key: 'topSales',         label: 'Top Sales People',     description: 'Sales leaderboard',              category: 'table',   widgetType: 'table',      defaultColor: 'indigo',  defaultW: 7, defaultH: 6, builder: () => tableTopSales() },
  { key: 'lowStock',         label: 'Low Stock Items',      description: 'Items below reorder point',      category: 'table',   widgetType: 'table',      defaultColor: 'rose',    defaultW: 5, defaultH: 5, builder: () => tableLowStock() },
  { key: 'recentOrders',     label: 'Recent Orders',        description: 'Latest order activity',          category: 'table',   widgetType: 'table',      defaultColor: 'sky',     defaultW: 7, defaultH: 5, builder: () => tableRecentOrders() },
  { key: 'topProducts',      label: 'Top Products',         description: 'Best selling products',          category: 'table',   widgetType: 'table',      defaultColor: 'emerald', defaultW: 7, defaultH: 6, builder: () => tableTopProducts() },
  { key: 'customerActivity', label: 'Customer Activity',    description: 'Customer health overview',       category: 'table',   widgetType: 'table',      defaultColor: 'violet',  defaultW: 7, defaultH: 5, builder: () => tableCustomerActivity() },
];

// Helper to get registry entry by key
export function getRegistryEntry(key: string): ChartRegistryEntry | undefined {
  return CHART_REGISTRY.find((e) => e.key === key);
}

// Helper to get all entries of a category
export function getRegistryByCategory(category: ChartRegistryEntry['category']): ChartRegistryEntry[] {
  return CHART_REGISTRY.filter((e) => e.category === category);
}

// ─── FLAT DATA RESOLVER ───────────────────────────────────────────────

export function getDashboardData(
  tab: TabKey,
  range: TimeRange,
): Record<string, any> {
  switch (tab) {
    case 'main':
      return {
        ordersToPick:     kpiOrdersToPick(range),
        revenue:          kpiRevenue(range),
        profit:           kpiProfit(range),
        profitPct:        kpiProfitPct(),
        revenueProfit:    chartRevenueProfit(range),
        orders:           chartOrders(range),
        revenueByChannel: pieRevenueByChannel(),
        orderFlow:        sankeyOrderFlow(),
      };

    case 'warehouse':
      return {
        ordersToPick:     kpiOrdersToPick(range),
        packedToday:      kpiPackedToday(range),
        shippedToday:     kpiShippedToday(range),
        picksPerPeriod:   chartPicksPerPeriod(range),
        lowStock:         tableLowStock(),
      };

    case 'sales':
      return {
        revenue:          kpiRevenue(range),
        profit:           kpiProfit(range),
        profitPct:        kpiProfitPct(),
        avgOrderValue:    kpiAvgOrderValue(),
        salesByCategory:  chartSalesByCategory(range),
        revenueByProduct: pieRevenueByProduct(),
        topSales:         tableTopSales(),
      };

    // ★ NEW: Playground tab loads ALL available data
    case 'playground':
      return buildPlaygroundData(range);

    default:
      return {
        ordersToPick:     kpiOrdersToPick(range),
        revenue:          kpiRevenue(range),
        profit:           kpiProfit(range),
        profitPct:        kpiProfitPct(),
      };
  }
}

// Build data for ALL registered charts at once
function buildPlaygroundData(range: TimeRange): Record<string, any> {
  const data: Record<string, any> = {};
  for (const entry of CHART_REGISTRY) {
    data[entry.key] = entry.builder(range);
  }
  return data;
}

// ─── Default Layouts ──────────────────────────────────────────────────

export function getDefaultLayout(tab: TabKey): WidgetConfig[] {
  switch (tab) {
    case 'main':
      return [
        { id: 'kpi-orders',    type: 'kpi',        title: 'Orders to Pick',     dataKey: 'ordersToPick',     x: 0,  y: 0, w: 3,  h: 2, color: 'amber' },
        { id: 'kpi-revenue',   type: 'kpi',        title: 'Revenue',            dataKey: 'revenue',          x: 3,  y: 0, w: 3,  h: 2, color: 'emerald' },
        { id: 'kpi-profit',    type: 'kpi',        title: 'Profit',             dataKey: 'profit',           x: 6,  y: 0, w: 3,  h: 2, color: 'indigo' },
        { id: 'kpi-profitpct', type: 'kpi',        title: 'Profit %',           dataKey: 'profitPct',        x: 9,  y: 0, w: 3,  h: 2, color: 'violet' },
        { id: 'chart-revenue', type: 'line-chart', title: 'Revenue & Profit',   dataKey: 'revenueProfit',    x: 0,  y: 2, w: 8,  h: 5, color: 'emerald' },
        { id: 'pie-channel',   type: 'pie-chart',  title: 'Revenue by Channel', dataKey: 'revenueByChannel', x: 8,  y: 2, w: 4,  h: 5, color: 'indigo' },
        { id: 'sankey-flow',   type: 'sankey',     title: 'Order Flow',         dataKey: 'orderFlow',        x: 0,  y: 7, w: 12, h: 5, color: 'sky' },
      ];

    case 'warehouse':
      return [
        { id: 'wh-kpi-pick',    type: 'kpi',       title: 'Orders to Pick',    dataKey: 'ordersToPick',   x: 0, y: 0, w: 4, h: 2, color: 'amber' },
        { id: 'wh-kpi-packed',  type: 'kpi',       title: 'Orders Packed',     dataKey: 'packedToday',    x: 4, y: 0, w: 4, h: 2, color: 'sky' },
        { id: 'wh-kpi-shipped', type: 'kpi',       title: 'Orders Shipped',    dataKey: 'shippedToday',   x: 8, y: 0, w: 4, h: 2, color: 'emerald' },
        { id: 'wh-chart-picks', type: 'bar-chart', title: 'Picks per Period',  dataKey: 'picksPerPeriod', x: 0, y: 2, w: 7, h: 5, color: 'amber' },
        { id: 'wh-table-stock', type: 'table',     title: 'Items Low in Stock',dataKey: 'lowStock',       x: 7, y: 2, w: 5, h: 5, color: 'rose' },
      ];

    case 'sales':
      return [
        { id: 'sl-kpi-rev',     type: 'kpi',          title: 'Revenue',            dataKey: 'revenue',          x: 0, y: 0, w: 3,  h: 2, color: 'emerald' },
        { id: 'sl-kpi-profit',  type: 'kpi',          title: 'Profit',             dataKey: 'profit',           x: 3, y: 0, w: 3,  h: 2, color: 'indigo' },
        { id: 'sl-kpi-pct',     type: 'kpi',          title: 'Profit %',           dataKey: 'profitPct',        x: 6, y: 0, w: 3,  h: 2, color: 'violet' },
        { id: 'sl-kpi-aov',     type: 'kpi',          title: 'Avg Order Value',    dataKey: 'avgOrderValue',    x: 9, y: 0, w: 3,  h: 2, color: 'orange' },
        { id: 'sl-table-sales', type: 'table',        title: 'Top Sales People',   dataKey: 'topSales',         x: 0, y: 2, w: 7,  h: 6, color: 'indigo' },
        { id: 'sl-chart-cat',   type: 'stacked-bar',  title: 'Sales by Category',  dataKey: 'salesByCategory',  x: 7, y: 2, w: 5,  h: 6, color: 'emerald' },
        { id: 'sl-pie-product', type: 'pie-chart',    title: 'Revenue by Product', dataKey: 'revenueByProduct', x: 0, y: 8, w: 12, h: 5, color: 'violet' },
      ];

    // ★ NEW: Playground layout — a showcase of everything
    case 'playground':
      return buildPlaygroundLayout();
  }
}

// Automatically build a layout from the entire registry
function buildPlaygroundLayout(): WidgetConfig[] {
  const widgets: WidgetConfig[] = [];
  let currentY = 0;

  // Group by category for organized layout
  const categories: Array<{ cat: ChartRegistryEntry['category']; label: string }> = [
    { cat: 'kpi',     label: 'KPI Cards' },
    { cat: 'line',    label: 'Line Charts' },
    { cat: 'bar',     label: 'Bar Charts' },
    { cat: 'stacked', label: 'Stacked Bar Charts' },
    { cat: 'pie',     label: 'Pie Charts' },
    { cat: 'sankey',  label: 'Sankey Diagrams' },
    { cat: 'table',   label: 'Data Tables' },
  ];

  for (const { cat } of categories) {
    const entries = getRegistryByCategory(cat);
    if (entries.length === 0) continue;

    if (cat === 'kpi') {
      // Lay out KPIs in rows of 4
      let kpiX = 0;
      for (const entry of entries) {
        if (kpiX + entry.defaultW > 12) {
          kpiX = 0;
          currentY += entry.defaultH;
        }
        widgets.push({
          id: `pg-${entry.key}`,
          type: entry.widgetType,
          title: entry.label,
          dataKey: entry.key,
          x: kpiX,
          y: currentY,
          w: entry.defaultW,
          h: entry.defaultH,
          color: entry.defaultColor as any,
        });
        kpiX += entry.defaultW;
      }
      currentY += entries[0].defaultH;
    } else {
      // Standard: 2 per row for medium widgets, 1 per row for full-width
      let rowX = 0;
      for (const entry of entries) {
        if (rowX + entry.defaultW > 12) {
          rowX = 0;
          currentY += entry.defaultH;
        }
        widgets.push({
          id: `pg-${entry.key}`,
          type: entry.widgetType,
          title: entry.label,
          dataKey: entry.key,
          x: rowX,
          y: currentY,
          w: entry.defaultW,
          h: entry.defaultH,
          color: entry.defaultColor as any,
        });
        rowX += entry.defaultW;
      }
      currentY += entries[entries.length - 1].defaultH;
    }

    // Add spacing between categories
    currentY += 1;
  }

  return widgets;
}

// ─── Widget Catalog ───────────────────────────────────────────────────

export const WIDGET_CATALOG: Array<{
  type: WidgetConfig['type'];
  label: string;
  description: string;
  icon: string;
  defaultW: number;
  defaultH: number;
}> = [
  { type: 'kpi',         label: 'KPI Card',     description: 'Single metric with trend indicator',   icon: 'hash',        defaultW: 3,  defaultH: 2 },
  { type: 'line-chart',  label: 'Line Chart',   description: 'Trend visualization over time',        icon: 'trending-up', defaultW: 6,  defaultH: 5 },
  { type: 'bar-chart',   label: 'Bar Chart',    description: 'Categorical comparison bars',          icon: 'bar-chart',   defaultW: 6,  defaultH: 5 },
  { type: 'stacked-bar', label: 'Stacked Bar',  description: 'Multi-series stacked comparison',      icon: 'layers',      defaultW: 6,  defaultH: 5 },
  { type: 'pie-chart',   label: 'Pie / Donut',  description: 'Proportional breakdown visualization', icon: 'pie-chart',   defaultW: 4,  defaultH: 5 },
  { type: 'sankey',      label: 'Sankey Diagram',description: 'Flow and relationship visualization', icon: 'git-merge',   defaultW: 12, defaultH: 5 },
  { type: 'table',       label: 'Data Table',   description: 'Sortable tabular data display',        icon: 'table',       defaultW: 6,  defaultH: 5 },
];

// ─── Data Source Catalog (for "Add Widget" with data selection) ──────

export const DATA_SOURCE_CATALOG: Array<{
  key: string;
  label: string;
  description: string;
  category: string;
  compatibleTypes: WidgetConfig['type'][];
}> = CHART_REGISTRY.map((entry) => ({
  key: entry.key,
  label: entry.label,
  description: entry.description,
  category: entry.category,
  compatibleTypes: [entry.widgetType],
}));