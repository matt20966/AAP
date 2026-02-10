import React from 'react';
import { ChartDefinition, ChartSettings, FieldMappings } from '../../types/charts';
import { CHART_DATASETS } from '../../data/chartDatasets';
import { processChartData } from '../../utils/chartEngine';
import { KPIChart } from './KPIChart';
import { LineChartComponent } from './LineChartComponent';
import { BarChartComponent } from './BarChartComponent';
import { AreaChartComponent } from './AreaChartComponent';
import { PieChartComponent } from './PieChartComponent';
import { ScatterChartComponent } from './ScatterChartComponent';
import { HeatmapChart } from './HeatmapChart';
import { SankeyChartComponent } from './SankeyChartComponent';

interface Props {
  definition: ChartDefinition;
}

export function ChartRenderer({ definition }: Props) {
  const dataset = CHART_DATASETS.find(d => d.id === definition.datasetId);
  if (!dataset) return null;

  const data = processChartData(
    dataset,
    definition.mappings,
    definition.filters,
    definition.transform,
    definition.settings
  );

  return (
    <ChartByType
      data={data}
      mappings={definition.mappings}
      settings={definition.settings}
    />
  );
}

interface ChartByTypeProps {
  data: Record<string, any>[];
  mappings: FieldMappings;
  settings: ChartSettings;
}

export function ChartByType({ data, mappings, settings }: ChartByTypeProps) {
  switch (settings.chartType) {
    case 'kpi':
      return <KPIChart data={data} mappings={mappings} settings={settings} />;
    case 'line':
      return <LineChartComponent data={data} mappings={mappings} settings={settings} />;
    case 'bar':
      return <BarChartComponent data={data} mappings={mappings} settings={settings} />;
    case 'stacked-bar':
      return <BarChartComponent data={data} mappings={mappings} settings={settings} stacked />;
    case 'area':
      return <AreaChartComponent data={data} mappings={mappings} settings={settings} />;
    case 'pie':
      return <PieChartComponent data={data} mappings={mappings} settings={settings} />;
    case 'donut':
      return <PieChartComponent data={data} mappings={mappings} settings={settings} isDonut />;
    case 'scatter':
      return <ScatterChartComponent data={data} mappings={mappings} settings={settings} />;
    case 'heatmap':
      return <HeatmapChart data={data} mappings={mappings} settings={settings} />;
    case 'sankey':
      return <SankeyChartComponent data={data} mappings={mappings} settings={settings} />;
    default:
      return <div className="flex items-center justify-center h-full text-zinc-500">Unsupported chart type</div>;
  }
}