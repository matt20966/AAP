// Enhanced AddWidgetPanel with data source selection from the registry

import { CHART_REGISTRY, DATA_SOURCE_CATALOG, getRegistryByCategory } from './data/dashboardData';

function AddWidgetPanel({
  open,
  onClose,
  onAdd,
  currentTab,
  timeRange,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (type: WidgetConfig['type'], dataKey?: string, title?: string) => void;
  currentTab: TabKey;
  timeRange: TimeRange;
}) {
  const [hoveredWidget, setHoveredWidget] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { key: 'all',     label: 'All',          count: CHART_REGISTRY.length },
    { key: 'kpi',     label: 'KPIs',         count: getRegistryByCategory('kpi').length },
    { key: 'line',    label: 'Line Charts',  count: getRegistryByCategory('line').length },
    { key: 'bar',     label: 'Bar Charts',   count: getRegistryByCategory('bar').length },
    { key: 'stacked', label: 'Stacked',      count: getRegistryByCategory('stacked').length },
    { key: 'pie',     label: 'Pie Charts',   count: getRegistryByCategory('pie').length },
    { key: 'sankey',  label: 'Sankey',        count: getRegistryByCategory('sankey').length },
    { key: 'table',   label: 'Tables',        count: getRegistryByCategory('table').length },
  ];

  const filteredEntries = useMemo(() => {
    let entries = activeCategory === 'all'
      ? CHART_REGISTRY
      : CHART_REGISTRY.filter((e) => e.category === activeCategory);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.label.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.key.toLowerCase().includes(q),
      );
    }

    return entries;
  }, [activeCategory, searchQuery]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          />

          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring' as const, damping: 30, stiffness: 300, mass: 0.8 }}
            className="fixed bottom-0 left-0 right-0 z-[70] max-h-[85vh] overflow-hidden rounded-t-3xl"
            style={{
              background: 'linear-gradient(180deg, #111114 0%, #09090b 100%)',
              borderTop: '1px solid rgba(255,255,255,0.10)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Add Widget"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/[0.12]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-4 border-b border-white/[0.06]">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">Add Widget</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {filteredEntries.length} widgets available • Pick one to add to your dashboard
                </p>
              </div>
              <IconButton
                icon={<Icons.Close className="w-full h-full" />}
                label="Close"
                onClick={onClose}
                variant="filled"
              />
            </div>

            {/* Search + Category Filter */}
            <div className="px-6 py-3 border-b border-white/[0.06] space-y-3">
              {/* Search */}
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
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
                  placeholder="Search widgets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              {/* Category pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {categories.map((cat) => (
                  <button
                    key={cat.key}
                    onClick={() => setActiveCategory(cat.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      activeCategory === cat.key
                        ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25'
                        : 'bg-white/[0.04] text-zinc-400 border border-white/[0.06] hover:bg-white/[0.06]'
                    }`}
                  >
                    {cat.label}
                    <span
                      className={`text-[10px] px-1 py-0.5 rounded ${
                        activeCategory === cat.key
                          ? 'bg-indigo-500/20 text-indigo-300'
                          : 'bg-white/[0.06] text-zinc-500'
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Widget Grid */}
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-200px)]">
              {filteredEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                  <p className="text-sm text-zinc-400 font-medium">No widgets found</p>
                  <p className="text-xs text-zinc-600 mt-1">Try a different search or category</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredEntries.map((entry, idx) => {
                    const categoryColors: Record<string, string> = {
                      kpi: 'from-amber-500/20 to-orange-500/10 border-amber-500/25',
                      line: 'from-indigo-500/20 to-violet-500/10 border-indigo-500/25',
                      bar: 'from-sky-500/20 to-blue-500/10 border-sky-500/25',
                      stacked: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/25',
                      pie: 'from-violet-500/20 to-purple-500/10 border-violet-500/25',
                      sankey: 'from-cyan-500/20 to-sky-500/10 border-cyan-500/25',
                      table: 'from-rose-500/20 to-pink-500/10 border-rose-500/25',
                    };

                    const categoryTextColors: Record<string, string> = {
                      kpi: 'text-amber-400',
                      line: 'text-indigo-400',
                      bar: 'text-sky-400',
                      stacked: 'text-emerald-400',
                      pie: 'text-violet-400',
                      sankey: 'text-cyan-400',
                      table: 'text-rose-400',
                    };

                    return (
                      <motion.button
                        key={entry.key}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02, ...tokens.transition.spring }}
                        onMouseEnter={() => setHoveredWidget(entry.key)}
                        onMouseLeave={() => setHoveredWidget(null)}
                        onClick={() => {
                          onAdd(entry.widgetType, entry.key, entry.label);
                          onClose();
                        }}
                        className="group relative flex flex-col items-start gap-3 p-4 rounded-2xl text-left transition-all duration-200"
                        style={{
                          background: hoveredWidget === entry.key
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${
                            hoveredWidget === entry.key
                              ? 'rgba(99,102,241,0.35)'
                              : 'rgba(255,255,255,0.06)'
                          }`,
                        }}
                      >
                        {/* Icon */}
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 bg-gradient-to-br border ${
                            categoryColors[entry.category] || ''
                          }`}
                        >
                          <span className={`w-5 h-5 ${categoryTextColors[entry.category] || 'text-indigo-400'}`}>
                            {widgetIcons[entry.widgetType]}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1">
                          <span className="text-sm font-semibold text-zinc-100 block">{entry.label}</span>
                          <span className="text-xs text-zinc-500 block mt-0.5 line-clamp-2">
                            {entry.description}
                          </span>
                        </div>

                        {/* Metadata badges */}
                        <div className="flex items-center gap-1.5 w-full">
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              categoryTextColors[entry.category] || 'text-zinc-400'
                            } bg-white/[0.04]`}
                          >
                            {entry.category}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded">
                            {entry.defaultW}×{entry.defaultH}
                          </span>
                        </div>

                        {/* Hover glow */}
                        {hoveredWidget === entry.key && (
                          <motion.div
                            layoutId="widget-add-glow"
                            className="absolute inset-0 rounded-2xl pointer-events-none"
                            style={{ boxShadow: '0 0 40px rgba(99,102,241,0.12)' }}
                            transition={tokens.transition.spring}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}