// src/utils/exportChart.ts

import { ChartDefinition } from '../types/charts';

const STORAGE_KEY = 'chart-creator-saved-charts';

export function saveChart(def: ChartDefinition): void {
  const charts = getSavedCharts();
  const idx = charts.findIndex(c => c.id === def.id);
  const updated = { ...def, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    charts[idx] = updated;
  } else {
    charts.push(updated);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(charts));
}

export function getSavedCharts(): ChartDefinition[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function deleteChart(id: string): void {
  const charts = getSavedCharts().filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(charts));
}

export function duplicateChart(id: string): ChartDefinition | null {
  const charts = getSavedCharts();
  const source = charts.find(c => c.id === id);
  if (!source) return null;
  const copy: ChartDefinition = {
    ...JSON.parse(JSON.stringify(source)),
    id: crypto.randomUUID(),
    name: `${source.name} (Copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  charts.push(copy);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(charts));
  return copy;
}

export function exportConfigJSON(def: ChartDefinition): void {
  const blob = new Blob([JSON.stringify(def, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${def.name.replace(/\s+/g, '_')}_config.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function copyConfigJSON(def: ChartDefinition): Promise<void> {
  return navigator.clipboard.writeText(JSON.stringify(def, null, 2));
}

export function exportChartImage(
  element: HTMLElement | null,
  name: string,
  format: 'png' | 'svg' = 'png'
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!element) {
      reject(new Error('No chart element'));
      return;
    }

    // Simple canvas-based export using SVG serialization
    const svgEl = element.querySelector('svg');
    if (!svgEl) {
      reject(new Error('No SVG found'));
      return;
    }

    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgEl);

    if (format === 'svg') {
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      resolve();
      return;
    }

    // PNG
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('Canvas not supported')); return; }

    const img = new Image();
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const urlObj = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
      ctx.fillStyle = '#0a0a10';
      ctx.fillRect(0, 0, img.width, img.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Blob failed')); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${name}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
        URL.revokeObjectURL(urlObj);
        resolve();
      }, 'image/png');
    };
    img.onerror = reject;
    img.src = urlObj;
  });
}

export function generateEmbedCode(def: ChartDefinition): string {
  return `import React from 'react';
import { ChartRenderer } from './components/ChartRenderer';

const chartConfig = ${JSON.stringify(def, null, 2)};

export function ${def.name.replace(/[^a-zA-Z0-9]/g, '')}Chart() {
  return (
    <ChartRenderer
      config={chartConfig}
      className="w-full h-[400px]"
    />
  );
}`;
}

export function copyEmbedCode(def: ChartDefinition): Promise<void> {
  return navigator.clipboard.writeText(generateEmbedCode(def));
}