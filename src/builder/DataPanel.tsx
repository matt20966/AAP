// src/components/builder/DataPanel.tsx

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChartDefinition,
  Dataset,
  DatasetField,
  FieldMappings,
  FilterRule,
  FilterOperator,
  TransformConfig,
  TimeGrouping,
  AggregationType,
  SortDirection,
} from '../../types/charts';
import { CHART_DATASETS } from '../../data/chartDatasets';

interface DataPanelProps {
  definition: ChartDefinition;
  onChange: (updates: Partial<ChartDefinition>) => void;
  dataset: Dataset | null;
}

// Icons
const HashIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
  </svg>
);
const TextIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
  </svg>
);
const CalendarIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const PlusIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const TrashIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);
const ChevronDown = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const XIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const DatabaseIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
  </svg>
);

const FIELD_ICONS: Record<string, React.FC> = {
  string: TextIcon,
  number: HashIcon,
  date: CalendarIcon,
};

const DROP_ZONES: { key: keyof FieldMappings; label: string; hint: string }[] = [
  { key: 'x', label: 'X Axis', hint: 'Category or time' },
  { key: 'y', label: 'Y Axis', hint: 'Numeric value' },
  { key: 'series', label: 'Series', hint: 'Split into lines/bars' },
  { key: 'group', label: 'Group', hint: 'Group by' },
  { key: 'size', label: 'Size', hint: 'Bubble size' },
  { key: 'color', label: 'Color', hint: 'Color encoding' },
  { key: 'value', label: 'Value', hint: 'Aggregated value' },
];

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: '=', label: 'equals' },
  { value: '!=', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: '>', label: 'greater than' },
  { value: '<', label: 'less than' },
  { value: '>=', label: '≥' },
  { value: '<=', label: '≤' },
  { value: 'between', label: 'between' },
];

function SectionHeader({ title, icon, children }: { title: string; icon?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.1em]">{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function DataPanel({ definition, onChange, dataset }: DataPanelProps) {
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    fields: true,
    mappings: true,
    filters: false,
    transforms: false,
  });

  const toggleSection = (key: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDatasetChange = (datasetId: string) => {
    const ds = CHART_DATASETS.find(d => d.id === datasetId);
    onChange({
      datasetId,
      mappings: ds?.defaultMappings
        ? { ...definition.mappings, ...ds.defaultMappings }
        : { x: null, y: null, series: null, group: null, size: null, color: null, value: null },
    });
  };

  const handleFieldDrop = (zone: keyof FieldMappings, fieldId: string) => {
    onChange({
      mappings: { ...definition.mappings, [zone]: fieldId },
    });
  };

  const clearMapping = (zone: keyof FieldMappings) => {
    onChange({
      mappings: { ...definition.mappings, [zone]: null },
    });
  };

  const addFilter = () => {
    if (!dataset) return;
    const newFilter: FilterRule = {
      id: crypto.randomUUID(),
      field: dataset.fields[0]?.id || '',
      operator: '=',
      value: '',
    };
    onChange({ filters: [...definition.filters, newFilter] });
  };

  const updateFilter = (id: string, updates: Partial<FilterRule>) => {
    onChange({
      filters: definition.filters.map(f => (f.id === id ? { ...f, ...updates } : f)),
    });
  };

  const removeFilter = (id: string) => {
    onChange({ filters: definition.filters.filter(f => f.id !== id) });
  };

  const updateTransform = (updates: Partial<TransformConfig>) => {
    onChange({ transform: { ...definition.transform, ...updates } });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Dataset Selector */}
      <div className="p-4 border-b border-white/[0.06]">
        <SectionHeader title="Dataset" icon={<DatabaseIcon />} />
        <div className="relative">
          <select
            value={definition.datasetId}
            onChange={e => handleDatasetChange(e.target.value)}
            className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[12px] text-zinc-200 font-medium outline-none focus:border-indigo-500/30 focus:ring-2 focus:ring-indigo-500/[0.08] transition-all cursor-pointer pr-8"
          >
            <option value="">Select a dataset...</option>
            {CHART_DATASETS.map(ds => (
              <option key={ds.id} value={ds.id}>{ds.name}</option>
            ))}
          </select>
          <ChevronDown />
        </div>
        {dataset && (
          <p className="mt-1.5 text-[10px] text-zinc-600 font-medium">
            {dataset.description} • {dataset.rows.length} rows
          </p>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {dataset && (
          <>
            {/* Schema / Fields */}
            <div className="p-4 border-b border-white/[0.06]">
              <button
                onClick={() => toggleSection('fields')}
                className="flex items-center justify-between w-full mb-2"
              >
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.1em]">
                  Fields ({dataset.fields.length})
                </span>
                <motion.div animate={{ rotate: expandedSections.fields ? 180 : 0 }}>
                  <ChevronDown />
                </motion.div>
              </button>
              <AnimatePresence>
                {expandedSections.fields && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-1 overflow-hidden"
                  >
                    {dataset.fields.map(field => {
                      const Icon = FIELD_ICONS[field.type] || TextIcon;
                      return (
                        <div
                          key={field.id}
                          draggable
                          onDragStart={() => setDraggedField(field.id)}
                          onDragEnd={() => setDraggedField(null)}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing transition-all ${
                            draggedField === field.id
                              ? 'border-indigo-500/30 bg-indigo-500/[0.06] shadow-lg shadow-indigo-500/10'
                              : 'border-transparent hover:border-white/[0.08] hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="text-zinc-500"><Icon /></div>
                          <span className="text-[11px] font-semibold text-zinc-300 flex-1">{field.name}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            field.type === 'number' ? 'text-blue-400 bg-blue-500/[0.08]' :
                            field.type === 'date' ? 'text-amber-400 bg-amber-500/[0.08]' :
                            'text-zinc-500 bg-white/[0.04]'
                          }`}>
                            {field.type}
                          </span>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Field Mappings / Drop Zones */}
            <div className="p-4 border-b border-white/[0.06]">
              <button
                onClick={() => toggleSection('mappings')}
                className="flex items-center justify-between w-full mb-2"
              >
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.1em]">
                  Field Mapping
                </span>
                <motion.div animate={{ rotate: expandedSections.mappings ? 180 : 0 }}>
                  <ChevronDown />
                </motion.div>
              </button>
              <AnimatePresence>
                {expandedSections.mappings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2 overflow-hidden"
                  >
                    {DROP_ZONES.map(zone => {
                      const mapped = definition.mappings[zone.key];
                      const mappedField = dataset.fields.find(f => f.id === mapped);

                      return (
                        <div
                          key={zone.key}
                          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-indigo-500/30'); }}
                          onDragLeave={e => { e.currentTarget.classList.remove('ring-2', 'ring-indigo-500/30'); }}
                          onDrop={e => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('ring-2', 'ring-indigo-500/30');
                            if (draggedField) handleFieldDrop(zone.key, draggedField);
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                            mapped
                              ? 'border-indigo-500/20 bg-indigo-500/[0.04]'
                              : 'border-dashed border-white/[0.08] bg-white/[0.01]'
                          }`}
                        >
                          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider w-12 flex-shrink-0">
                            {zone.key}
                          </span>
                          {mapped && mappedField ? (
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-[11px] font-semibold text-indigo-300">{mappedField.name}</span>
                              <span className="text-[9px] text-zinc-600">{mappedField.type}</span>
                              <button
                                onClick={() => clearMapping(zone.key)}
                                className="ml-auto text-zinc-600 hover:text-zinc-400 transition-colors"
                              >
                                <XIcon />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-[10px] text-zinc-600 italic">{zone.hint}</span>
                              {/* Also allow select */}
                              <select
                                value=""
                                onChange={e => {
                                  if (e.target.value) handleFieldDrop(zone.key, e.target.value);
                                }}
                                className="ml-auto appearance-none bg-transparent border-none text-[10px] text-zinc-500 outline-none cursor-pointer"
                              >
                                <option value="">+ assign</option>
                                {dataset.fields.map(f => (
                                  <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Filters */}
            <div className="p-4 border-b border-white/[0.06]">
              <button
                onClick={() => toggleSection('filters')}
                className="flex items-center justify-between w-full mb-2"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.1em]">
                    Filters
                  </span>
                  {definition.filters.length > 0 && (
                    <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/[0.08] px-1.5 py-0.5 rounded">
                      {definition.filters.length}
                    </span>
                  )}
                </div>
                <motion.div animate={{ rotate: expandedSections.filters ? 180 : 0 }}>
                  <ChevronDown />
                </motion.div>
              </button>
              <AnimatePresence>
                {expandedSections.filters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2 overflow-hidden"
                  >
                    {definition.filters.map(filter => (
                      <div key={filter.id} className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                        <div className="flex gap-1.5">
                          <select
                            value={filter.field}
                            onChange={e => updateFilter(filter.id, { field: e.target.value })}
                            className="flex-1 appearance-none bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[10px] text-zinc-300 font-medium outline-none"
                          >
                            {dataset.fields.map(f => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                          <select
                            value={filter.operator}
                            onChange={e => updateFilter(filter.id, { operator: e.target.value as FilterOperator })}
                            className="appearance-none bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[10px] text-zinc-300 font-medium outline-none w-20"
                          >
                            {OPERATORS.map(op => (
                              <option key={op.value} value={op.value}>{op.label}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => removeFilter(filter.id)}
                            className="text-zinc-600 hover:text-rose-400 transition-colors p-1"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={filter.value}
                            onChange={e => updateFilter(filter.id, { value: e.target.value })}
                            placeholder="Value..."
                            className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[10px] text-zinc-300 outline-none placeholder:text-zinc-700"
                          />
                          {filter.operator === 'between' && (
                            <input
                              type="text"
                              value={filter.value2 || ''}
                              onChange={e => updateFilter(filter.id, { value2: e.target.value })}
                              placeholder="To..."
                              className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[10px] text-zinc-300 outline-none placeholder:text-zinc-700"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={addFilter}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-white/[0.08] text-[10px] text-zinc-500 font-semibold hover:text-zinc-400 hover:border-white/[0.12] transition-all w-full justify-center"
                    >
                      <PlusIcon />
                      Add Filter
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Transforms */}
            <div className="p-4">
              <button
                onClick={() => toggleSection('transforms')}
                className="flex items-center justify-between w-full mb-2"
              >
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.1em]">
                  Transforms
                </span>
                <motion.div animate={{ rotate: expandedSections.transforms ? 180 : 0 }}>
                  <ChevronDown />
                </motion.div>
              </button>
              <AnimatePresence>
                {expandedSections.transforms && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3 overflow-hidden"
                  >
                    {/* Group By */}
                    <div>
                      <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider block mb-1">Group By Time</label>
                      <select
                        value={definition.transform.groupBy}
                        onChange={e => updateTransform({ groupBy: e.target.value as TimeGrouping })}
                        className="w-full appearance-none bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-2 text-[11px] text-zinc-300 font-medium outline-none"
                      >
                        <option value="none">None</option>
                        <option value="day">Day</option>
                        <option value="week">Week</option>
                        <option value="month">Month</option>
                        <option value="quarter">Quarter</option>
                        <option value="year">Year</option>
                      </select>
                    </div>

                    {/* Aggregation */}
                    <div>
                      <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider block mb-1">Aggregation</label>
                      <div className="flex gap-1 flex-wrap">
                        {(['sum', 'avg', 'min', 'max', 'count'] as AggregationType[]).map(agg => (
                          <button
                            key={agg}
                            onClick={() => updateTransform({ aggregation: agg })}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                              definition.transform.aggregation === agg
                                ? 'bg-indigo-500/[0.1] border-indigo-500/20 text-indigo-400'
                                : 'border-white/[0.06] text-zinc-600 hover:text-zinc-400'
                            }`}
                          >
                            {agg}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sort */}
                    <div>
                      <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider block mb-1">Sort By</label>
                      <div className="flex gap-1.5">
                        <select
                          value={definition.transform.sortField || ''}
                          onChange={e => updateTransform({ sortField: e.target.value || null })}
                          className="flex-1 appearance-none bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[10px] text-zinc-300 font-medium outline-none"
                        >
                          <option value="">None</option>
                          {dataset.fields.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                        <div className="flex rounded-lg border border-white/[0.06] overflow-hidden">
                          {(['asc', 'desc'] as SortDirection[]).map(dir => (
                            <button
                              key={dir}
                              onClick={() => updateTransform({ sortDirection: dir })}
                              className={`px-2 py-1.5 text-[9px] font-bold uppercase ${
                                definition.transform.sortDirection === dir
                                  ? 'bg-white/[0.06] text-zinc-300'
                                  : 'text-zinc-600'
                              }`}
                            >
                              {dir}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Limit */}
                    <div>
                      <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider block mb-1">Limit</label>
                      <input
                        type="number"
                        value={definition.transform.limit || ''}
                        onChange={e => updateTransform({ limit: e.target.value ? Number(e.target.value) : null })}
                        placeholder="No limit"
                        min={1}
                        className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-2 text-[11px] text-zinc-300 font-medium outline-none placeholder:text-zinc-700"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        {!dataset && (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
              <DatabaseIcon />
            </div>
            <p className="text-[12px] text-zinc-500 font-medium">Select a dataset to begin</p>
            <p className="text-[10px] text-zinc-600 mt-1">Choose from available datasets above</p>
          </div>
        )}
      </div>
    </div>
  );
}