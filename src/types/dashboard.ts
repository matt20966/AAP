// types/dashboard.ts

export type TimeRange = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type TabKey = 'main' | 'warehouse' | 'sales' | 'analytics' | 'inventory' | 'playground';

export type WidgetType =
  | 'kpi'
  | 'line-chart'
  | 'bar-chart'
  | 'stacked-bar'
  | 'pie-chart'
  | 'sankey'
  | 'table'
  | 'cheese-expiry-table'
  | 'area-chart'
  | 'scatter-plot'
  | 'heatmap'
  | 'gauge'
  | 'funnel'
  | 'radar'
  | 'treemap'
  | 'sparkline'
  | 'stat-card'
  | 'progress-ring'
  | 'timeline'
  | 'map'
  | 'waterfall';

export type WidgetColor =
  | 'indigo'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'sky'
  | 'violet'
  | 'orange'
  | 'cyan'
  | 'teal'
  | 'fuchsia'
  | 'lime'
  | 'red'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'pink'
  | 'slate'
  | 'zinc';

export type WidgetSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical' | 'success';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'png' | 'json';

export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'median' | 'p95' | 'p99';

export type SortDirection = 'asc' | 'desc';

export type ComparisonMode = 'previous_period' | 'same_period_last_year' | 'custom' | 'none';

export type ThemeMode = 'light' | 'dark' | 'system';

export type RefreshInterval = 'off' | '10s' | '30s' | '1m' | '5m' | '15m' | '30m' | '1h';

// ─── KPI & Metrics ─────────────────────────────────────────────────

export interface KPIData {
  label: string;
  value: number;
  previousValue: number;
  format: 'currency' | 'number' | 'percent' | 'duration' | 'compact';
  color: WidgetColor;
  icon: string;
  target?: number;
  unit?: string;
  sparklineData?: number[];
  description?: string;
  lastUpdated?: string;
}

export interface KPIThreshold {
  min: number;
  max: number;
  color: WidgetColor;
  label: string;
}

export interface MetricGoal {
  id: string;
  metricKey: string;
  targetValue: number;
  currentValue: number;
  deadline: string;
  status: 'on_track' | 'at_risk' | 'behind' | 'achieved';
}

// ─── Chart Types ────────────────────────────────────────────────────

export interface ChartSeries {
  name: string;
  data: number[];
  color: string;
  type?: 'line' | 'bar' | 'area';
  yAxisIndex?: number;
  dashStyle?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
  stack?: string;
  visible?: boolean;
}

export interface ChartData {
  labels: string[];
  series: ChartSeries[];
  annotations?: ChartAnnotation[];
  yAxisConfig?: YAxisConfig[];
}

export interface ChartAnnotation {
  type: 'line' | 'band' | 'point';
  value?: number;
  from?: number;
  to?: number;
  label: string;
  color: string;
  axis: 'x' | 'y';
}

export interface YAxisConfig {
  id: string;
  position: 'left' | 'right';
  label: string;
  format: 'currency' | 'number' | 'percent';
  min?: number;
  max?: number;
}

export interface PieSlice {
  name: string;
  value: number;
  color: string;
  percentage?: number;
  highlighted?: boolean;
}

export interface ScatterPoint {
  x: number;
  y: number;
  z?: number; // bubble size
  label: string;
  category: string;
  color: string;
}

export interface ScatterData {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  zLabel?: string;
}

export interface HeatmapCell {
  x: string;
  y: string;
  value: number;
  label?: string;
}

export interface HeatmapData {
  xLabels: string[];
  yLabels: string[];
  cells: HeatmapCell[];
  colorScale: { min: string; mid: string; max: string };
}

export interface GaugeData {
  value: number;
  min: number;
  max: number;
  thresholds: GaugeThreshold[];
  label: string;
  unit: string;
}

export interface GaugeThreshold {
  value: number;
  color: string;
  label: string;
}

export interface FunnelStage {
  name: string;
  value: number;
  color: string;
  conversionRate?: number;
  dropoff?: number;
}

export interface FunnelData {
  stages: FunnelStage[];
  totalConversion: number;
}

export interface RadarAxis {
  name: string;
  max: number;
}

export interface RadarSeries {
  name: string;
  values: number[];
  color: string;
  fillOpacity?: number;
}

export interface RadarData {
  axes: RadarAxis[];
  series: RadarSeries[];
}

export interface TreemapNode {
  name: string;
  value: number;
  color: string;
  children?: TreemapNode[];
  percentage?: number;
}

export interface TreemapData {
  nodes: TreemapNode[];
  totalValue: number;
}

export interface WaterfallSegment {
  name: string;
  value: number;
  type: 'increase' | 'decrease' | 'total';
  color: string;
  runningTotal?: number;
}

export interface WaterfallData {
  segments: WaterfallSegment[];
}

export interface SparklineData {
  values: number[];
  color: string;
  fillColor?: string;
  showMinMax?: boolean;
  showLast?: boolean;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  type: 'milestone' | 'event' | 'alert' | 'update';
  color: WidgetColor;
  icon?: string;
  metadata?: Record<string, unknown>;
}

export interface TimelineData {
  events: TimelineEvent[];
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  value: number;
  color: string;
  category: string;
}

export interface MapRegion {
  id: string;
  name: string;
  value: number;
  color: string;
}

export interface MapData {
  markers?: MapMarker[];
  regions?: MapRegion[];
  center: { lat: number; lng: number };
  zoom: number;
}

// ─── Sankey ─────────────────────────────────────────────────────────

export interface SankeyNode {
  id: string;
  label: string;
  color: string;
  value?: number;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  color: string;
  label?: string;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

// ─── Table Types ────────────────────────────────────────────────────

export interface ColumnDef {
  key: string;
  label: string;
  type: 'string' | 'number' | 'currency' | 'percent' | 'date' | 'badge' | 'avatar' | 'progress' | 'actions';
  sortable?: boolean;
  filterable?: boolean;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: string;
  badgeColors?: Record<string, WidgetColor>;
  frozen?: boolean;
  visible?: boolean;
}

export interface TableConfig {
  columns: ColumnDef[];
  pageSize: number;
  sortBy?: string;
  sortDirection?: SortDirection;
  searchable?: boolean;
  exportable?: boolean;
  selectable?: boolean;
  striped?: boolean;
  dense?: boolean;
}

export interface SalesPersonRow {
  rank: number;
  name: string;
  avatar: string;
  revenue: number;
  profit: number;
  winRate: number;
  deals: number;
  region?: string;
  trend?: number[];
  lastActive?: string;
  quota?: number;
  quotaAttainment?: number;
}

export interface LowStockItem {
  sku: string;
  name: string;
  currentStock: number;
  reorderPoint: number;
  category: string;
  status: 'critical' | 'low' | 'warning';
  supplier?: string;
  leadTimeDays?: number;
  lastRestocked?: string;
  demandRate?: number;
  estimatedStockout?: string;
  unitCost?: number;
  totalValue?: number;
}

export interface OrderRow {
  orderId: string;
  customer: string;
  date: string;
  status: 'pending' | 'processing' | 'picked' | 'packed' | 'shipped' | 'delivered' | 'returned' | 'cancelled';
  total: number;
  items: number;
  channel: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assignedTo?: string;
  trackingNumber?: string;
  shippingMethod?: string;
}

export interface ProductPerformanceRow {
  sku: string;
  name: string;
  category: string;
  revenue: number;
  unitsSold: number;
  returnRate: number;
  avgRating: number;
  margin: number;
  velocity: 'fast' | 'medium' | 'slow' | 'dead';
  trend: number[];
}

export interface CustomerRow {
  id: string;
  name: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  lastOrderDate: string;
  segment: 'vip' | 'regular' | 'new' | 'at_risk' | 'churned';
  lifetimeValue: number;
  acquisitionChannel: string;
}

export interface ShipmentRow {
  trackingId: string;
  carrier: string;
  status: 'label_created' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception' | 'returned';
  origin: string;
  destination: string;
  estimatedDelivery: string;
  actualDelivery?: string;
  weight: number;
  cost: number;
}

// ─── Widget Config ──────────────────────────────────────────────────

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  dataKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: WidgetColor;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  locked?: boolean;
  visible?: boolean;
  refreshInterval?: RefreshInterval;
  drillDown?: DrillDownConfig;
  filters?: WidgetFilter[];
  comparison?: ComparisonMode;
  aggregation?: AggregationType;
  chartOptions?: ChartOptions;
  tableConfig?: TableConfig;
  description?: string;
  helpText?: string;
  lastUpdated?: string;
  errorState?: WidgetError;
  loading?: boolean;
}

export interface ChartOptions {
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  showGrid?: boolean;
  showTooltip?: boolean;
  animate?: boolean;
  stacked?: boolean;
  curved?: boolean;
  filled?: boolean;
  showDataLabels?: boolean;
  showAxis?: boolean;
  horizontal?: boolean;
  aspectRatio?: number;
}

export interface WidgetError {
  code: string;
  message: string;
  retryable: boolean;
  timestamp: string;
}

// ─── Filters ────────────────────────────────────────────────────────

export interface WidgetFilter {
  id: string;
  field: string;
  operator: FilterOperator;
  value: FilterValue;
  label?: string;
}

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in'
  | 'between'
  | 'is_null'
  | 'is_not_null';

export type FilterValue = string | number | boolean | string[] | number[] | [number, number] | null;

export interface GlobalFilter {
  id: string;
  label: string;
  type: 'select' | 'multi-select' | 'date-range' | 'search' | 'toggle';
  field: string;
  options?: FilterOption[];
  value: FilterValue;
  appliesTo: string[]; // widget IDs or '*' for all
}

export interface FilterOption {
  label: string;
  value: string | number;
  count?: number;
  icon?: string;
}

export interface DateRange {
  start: string;
  end: string;
  label?: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: GlobalFilter[];
  createdAt: string;
  isDefault?: boolean;
}

// ─── Drill-Down ─────────────────────────────────────────────────────

export interface DrillDownConfig {
  enabled: boolean;
  levels: DrillDownLevel[];
  currentLevel: number;
  breadcrumb: DrillDownBreadcrumb[];
}

export interface DrillDownLevel {
  field: string;
  label: string;
  widgetType: WidgetType;
  aggregation: AggregationType;
}

export interface DrillDownBreadcrumb {
  level: number;
  label: string;
  filterValue: string;
}

export interface DrillDownEvent {
  widgetId: string;
  level: number;
  value: string;
  field: string;
  parentFilters: Record<string, string>;
}

// ─── Alerts & Notifications ────────────────────────────────────────

export interface DashboardAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  condition: 'above' | 'below' | 'equals' | 'change_pct';
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  autoResolve?: boolean;
  resolvedAt?: string;
  widgetId?: string;
  actions?: AlertAction[];
}

export interface AlertAction {
  id: string;
  label: string;
  type: 'link' | 'api' | 'dismiss' | 'snooze';
  payload: Record<string, unknown>;
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  metric: string;
  condition: 'above' | 'below' | 'equals' | 'change_pct';
  threshold: number;
  windowMinutes: number;
  severity: AlertSeverity;
  notifyChannels: NotifyChannel[];
  cooldownMinutes: number;
  lastTriggered?: string;
}

export interface NotifyChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'in_app';
  target: string;
  enabled: boolean;
}

export interface Notification {
  id: string;
  type: 'alert' | 'info' | 'achievement' | 'system' | 'report';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  icon?: string;
  color?: WidgetColor;
}

// ─── Dashboard Settings & State ─────────────────────────────────────

export interface DashboardSettings {
  gridSnapping: boolean;
  compactMode: boolean;
  showWidgetTitles: boolean;
  theme: ThemeMode;
  refreshInterval: RefreshInterval;
  defaultTimeRange: TimeRange;
  defaultTab: TabKey;
  gridColumns: number;
  rowHeight: number;
  margin: [number, number];
  containerPadding: [number, number];
  animationsEnabled: boolean;
  showBorders: boolean;
  currency: string;
  locale: string;
  timezone: string;
  dateFormat: string;
  numberFormat: 'us' | 'eu' | 'in';
  densityMode: 'comfortable' | 'compact' | 'spacious';
}

export interface DashboardState {
  layouts: Record<string, WidgetConfig[]>;
  settings: DashboardSettings;
  activeTab: TabKey;
  activeTimeRange: TimeRange;
  globalFilters: GlobalFilter[];
  filterPresets: FilterPreset[];
  alerts: DashboardAlert[];
  alertRules: AlertRule[];
  notifications: Notification[];
  comparison: ComparisonConfig;
  editMode: boolean;
  selectedWidgets: string[];
  clipboard?: WidgetConfig[];
  undoStack: DashboardAction[];
  redoStack: DashboardAction[];
  lastSaved?: string;
  version: number;
  favorites: string[]; // widget IDs
}

export interface ComparisonConfig {
  enabled: boolean;
  mode: ComparisonMode;
  customRange?: DateRange;
}

// ─── Undo/Redo ──────────────────────────────────────────────────────

export type DashboardAction =
  | { type: 'ADD_WIDGET'; payload: WidgetConfig }
  | { type: 'REMOVE_WIDGET'; payload: { id: string; config: WidgetConfig } }
  | { type: 'MOVE_WIDGET'; payload: { id: string; from: { x: number; y: number }; to: { x: number; y: number } } }
  | { type: 'RESIZE_WIDGET'; payload: { id: string; from: { w: number; h: number }; to: { w: number; h: number } } }
  | { type: 'UPDATE_WIDGET'; payload: { id: string; from: Partial<WidgetConfig>; to: Partial<WidgetConfig> } }
  | { type: 'REORDER_WIDGETS'; payload: { from: string[]; to: string[] } }
  | { type: 'BULK_UPDATE'; payload: { from: WidgetConfig[]; to: WidgetConfig[] } }
  | { type: 'UPDATE_SETTINGS'; payload: { from: Partial<DashboardSettings>; to: Partial<DashboardSettings> } };

// ─── Tab Data ───────────────────────────────────────────────────────

export interface TabData {
  kpis: Record<string, KPIData>;
  charts: Record<string, ChartData>;
  pieData: Record<string, PieSlice[]>;
  sankeyData?: SankeyData;
  tableData?: Record<string, SalesPersonRow[] | LowStockItem[] | OrderRow[] | ProductPerformanceRow[] | CustomerRow[] | ShipmentRow[]>;
  gaugeData?: Record<string, GaugeData>;
  funnelData?: Record<string, FunnelData>;
  radarData?: Record<string, RadarData>;
  heatmapData?: Record<string, HeatmapData>;
  scatterData?: Record<string, ScatterData>;
  treemapData?: Record<string, TreemapData>;
  waterfallData?: Record<string, WaterfallData>;
  timelineData?: Record<string, TimelineData>;
  mapData?: Record<string, MapData>;
  sparklines?: Record<string, SparklineData>;
}

export interface TabConfig {
  key: TabKey;
  label: string;
  icon: string;
  description: string;
  color: WidgetColor;
  order: number;
  visible: boolean;
  requiredPermission?: string;
}

// ─── Export & Sharing ───────────────────────────────────────────────

export interface ExportConfig {
  format: ExportFormat;
  includeCharts: boolean;
  includeData: boolean;
  dateRange: DateRange;
  widgets: string[]; // widget IDs, empty = all
  paperSize?: 'a4' | 'letter' | 'a3';
  orientation?: 'portrait' | 'landscape';
  title?: string;
  includeTimestamp?: boolean;
}

export interface SharedDashboard {
  id: string;
  dashboardId: string;
  shareToken: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  accessLevel: 'view' | 'interact' | 'edit';
  password?: string;
  allowedEmails?: string[];
  viewCount: number;
  lastViewedAt?: string;
}

export interface ScheduledReport {
  id: string;
  name: string;
  dashboardId: string;
  schedule: ReportSchedule;
  exportConfig: ExportConfig;
  recipients: string[];
  enabled: boolean;
  lastSent?: string;
  nextSend?: string;
}

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number; // 0-6
  dayOfMonth?: number; // 1-31
  time: string; // HH:mm
  timezone: string;
}

// ─── Real-Time ──────────────────────────────────────────────────────

export interface RealtimeUpdate {
  widgetId: string;
  dataKey: string;
  timestamp: string;
  value: number | Record<string, unknown>;
  type: 'replace' | 'append' | 'increment';
}

export interface WebSocketMessage {
  event: 'data_update' | 'alert' | 'notification' | 'layout_sync' | 'heartbeat';
  payload: unknown;
  timestamp: string;
  correlationId?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  lastHeartbeat?: string;
  reconnectAttempts: number;
  latencyMs?: number;
}

// ─── User Preferences & Permissions ────────────────────────────────

export interface UserDashboardPrefs {
  userId: string;
  pinnedTabs: TabKey[];
  recentSearches: string[];
  favoriteWidgets: string[];
  customLayouts: Record<string, WidgetConfig[]>;
  lastVisited: Record<TabKey, string>; // timestamps
  tourCompleted: boolean;
  notificationPrefs: NotificationPrefs;
}

export interface NotificationPrefs {
  inApp: boolean;
  email: boolean;
  slack: boolean;
  alertSeverityThreshold: AlertSeverity;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export interface DashboardPermission {
  role: 'viewer' | 'editor' | 'admin' | 'owner';
  canEditLayout: boolean;
  canEditData: boolean;
  canExport: boolean;
  canShare: boolean;
  canManageAlerts: boolean;
  canManageUsers: boolean;
  accessibleTabs: TabKey[];
}

// ─── Search & Command Palette ───────────────────────────────────────

export interface SearchResult {
  type: 'widget' | 'metric' | 'filter' | 'tab' | 'action' | 'help';
  id: string;
  label: string;
  description: string;
  icon: string;
  action: () => void;
  keywords: string[];
}

export interface CommandAction {
  id: string;
  label: string;
  shortcut?: string;
  category: 'navigation' | 'widget' | 'filter' | 'export' | 'settings' | 'help';
  icon: string;
  action: () => void;
  disabled?: boolean;
}

// ─── Audit Log ──────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  target: string;
  targetType: 'widget' | 'layout' | 'filter' | 'alert' | 'settings' | 'share';
  details: Record<string, unknown>;
  timestamp: string;
  ip?: string;
}

// ─── Widget Catalog ─────────────────────────────────────────────────

export interface WidgetCatalogItem {
  type: WidgetType;
  label: string;
  description: string;
  icon: string;
  defaultW: number;
  defaultH: number;
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
  category: 'metrics' | 'charts' | 'data' | 'flow' | 'geographic' | 'advanced';
  tags: string[];
  preview?: string; // preview image URL
  availableOn: TabKey[];
  requiresData: string[];
  beta?: boolean;
}

// ─── API Types ──────────────────────────────────────────────────────

export interface DashboardApiResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    cached: boolean;
    ttl: number;
    queryTimeMs: number;
  };
  errors?: ApiError[];
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
  severity: 'warning' | 'error';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface DataQuery {
  tab: TabKey;
  timeRange: TimeRange;
  filters: WidgetFilter[];
  aggregation?: AggregationType;
  groupBy?: string[];
  orderBy?: { field: string; direction: SortDirection };
  limit?: number;
  offset?: number;
  comparison?: ComparisonMode;
}

// ─── Theme & Styling ────────────────────────────────────────────────

export interface DashboardTheme {
  mode: ThemeMode;
  primaryColor: WidgetColor;
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  fontFamily: string;
  fontSize: 'sm' | 'base' | 'lg';
  cardShadow: 'none' | 'sm' | 'md' | 'lg';
  headerStyle: 'default' | 'gradient' | 'minimal';
  colorPalette: string[];
  customCSS?: string;
}

// ─── Annotations & Comments ─────────────────────────────────────────

export interface WidgetAnnotation {
  id: string;
  widgetId: string;
  userId: string;
  userName: string;
  text: string;
  dataPoint?: { x: string | number; y: number };
  position?: { x: number; y: number };
  createdAt: string;
  updatedAt?: string;
  resolved: boolean;
  replies: AnnotationReply[];
}

export interface AnnotationReply {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

// ─── Conditional Formatting ─────────────────────────────────────────

export interface ConditionalRule {
  id: string;
  field: string;
  condition: FilterOperator;
  value: FilterValue;
  style: ConditionalStyle;
  priority: number;
}

export interface ConditionalStyle {
  backgroundColor?: string;
  textColor?: string;
  fontWeight?: 'normal' | 'bold';
  icon?: string;
  iconColor?: string;
  badge?: string;
  badgeColor?: WidgetColor;
}

// ─── Calculated Fields ──────────────────────────────────────────────

export interface CalculatedField {
  id: string;
  name: string;
  formula: string;
  format: 'currency' | 'number' | 'percent';
  dependencies: string[];
  description?: string;
}

// ─── Forecasting ────────────────────────────────────────────────────

export interface ForecastConfig {
  enabled: boolean;
  method: 'linear' | 'exponential' | 'seasonal' | 'auto';
  periods: number;
  confidenceInterval: number; // 0-1
}

export interface ForecastData {
  actual: number[];
  predicted: number[];
  upperBound: number[];
  lowerBound: number[];
  labels: string[];
  accuracy: number;
  method: string;
}

// ─── Data Source ─────────────────────────────────────────────────────

export interface DataSource {
  id: string;
  name: string;
  type: 'api' | 'database' | 'csv' | 'webhook' | 'manual';
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  lastSync: string;
  syncInterval: RefreshInterval;
  schema?: Record<string, string>;
  errorMessage?: string;
  recordCount?: number;
}
