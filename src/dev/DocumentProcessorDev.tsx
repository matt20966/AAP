import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { useReserveProcessor, ReserveResult } from './ReserveProcessor';

// ─── PDF.js Worker Setup ─────────────────────────────────────────────────────

const pdfjsVersion = pdfjsLib.version || '3.11.174'; 
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// ─── Utils ───────────────────────────────────────────────────────────────────

const uid = (): string =>
  Math.random().toString(36).substring(2, 11) + Date.now().toString(36);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function fileHash(file: File): string {
  return `${file.name}_${file.size}_${file.lastModified}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(msg)), ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function editDistance(a: string, b: string): number {
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  if (a === b) return 0;
  const row: number[] = Array.from({ length: lb + 1 }, (_, i) => i);
  for (let i = 1; i <= la; i++) {
    let prev = i;
    for (let j = 1; j <= lb; j++) {
      const val = a[i - 1] === b[j - 1]
        ? row[j - 1]
        : 1 + Math.min(row[j - 1], prev, row[j]);
      row[j - 1] = prev;
      prev = val;
    }
    row[lb] = prev;
  }
  return row[lb];
}

function normalizeText(text: string): string {
  let t = text;
  t = t.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
  t = t.replace(/\u00a3/g, '£');
  t = t.replace(/\u20ac/g, '€');
  t = t.replace(/\u0024/g, '$');
  t = t.replace(/ﬁ/g, 'fi');
  t = t.replace(/ﬂ/g, 'fl');
  t = t.replace(/ﬀ/g, 'ff');
  t = t.replace(/ﬃ/g, 'ffi');
  t = t.replace(/ﬄ/g, 'ffl');
  t = t.replace(/[\u2010-\u2015\u2212]/g, '-');
  t = t.replace(/[\u2018\u2019\u201A\u201B]/g, "'");
  t = t.replace(/[\u201C\u201D\u201E\u201F]/g, '"');
  t = t.replace(/([0-9])O/g, '$10');
  t = t.replace(/O([0-9])/g, '0$1');
  t = t.replace(/([0-9])[lI]/g, '$11');
  t = t.replace(/\t/g, ' ');
  return t;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type TargetType = 'money' | 'date' | 'number' | 'text' | 'percent';
type CurrencyPref = 'Any' | 'GBP' | 'USD' | 'EUR';

interface ExtractionTarget {
  id: string;
  label: string;
  synonyms: string;
  type: TargetType;
  currency: CurrencyPref;
}

interface Candidate {
  value: string;
  rawValue: string;
  score: number;
  confidence: number;
  evidence: string;
  reason: string;
  position: number;
}

interface ExtractionResult {
  targetId: string;
  targetLabel: string;
  value: string;
  confidence: number;
  evidence: string;
  reason: string;
  alternatives: Candidate[];
  position: number;
}

interface CorrectionEntry {
  targetLabel: string;
  correctedValue: string;
  evidenceFingerprint: string;
  timestamp: number;
}

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

type DocStatus = 'queued' | 'parsing' | 'extracting' | 'done' | 'error';

interface DocEntry {
  id: string;
  file: File;
  previewUrl: string | null;
  status: DocStatus;
  progress: number;
  progressMsg: string;
  text: string;
  results: ExtractionResult[];
  error: string | null;
  expanded: boolean;
}

// ─── Design Tokens ───────────────────────────────────────────────────────────

const T = Object.freeze({
  bg: Object.freeze({
    primary: '#08090d',
    secondary: '#0d0e14',
    elevated: '#12131b',
    surface: '#161722',
    overlay: 'rgba(0, 0, 0, 0.85)',
  }),
  border: Object.freeze({
    subtle: 'rgba(255,255,255,0.05)',
    default: 'rgba(255,255,255,0.07)',
    hover: 'rgba(255,255,255,0.12)',
  }),
  text: Object.freeze({
    primary: '#f0f0f3',
    secondary: '#a1a1b5',
    tertiary: '#5a5b72',
    muted: '#3d3e52',
  }),
  accent: Object.freeze({
    indigo: '#818cf8',
    indigoBg: 'rgba(129,140,248,0.08)',
    indigoBorder: 'rgba(129,140,248,0.15)',
    rose: '#fb7185',
    roseBg: 'rgba(251,113,133,0.08)',
    roseBorder: 'rgba(251,113,133,0.15)',
    amber: '#fbbf24',
    amberBg: 'rgba(251,191,36,0.08)',
    amberBorder: 'rgba(251,191,36,0.15)',
    green: '#34d399',
    greenBg: 'rgba(52,211,153,0.08)',
    greenBorder: 'rgba(52,211,153,0.15)',
    cyan: '#22d3ee',
    cyanBg: 'rgba(34,211,238,0.08)',
    cyanBorder: 'rgba(34,211,238,0.15)',
  }),
});

const globalCSS = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'); *::-webkit-scrollbar{width:5px;height:5px} *::-webkit-scrollbar-track{background:transparent} *::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.05);border-radius:10px} *::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.1)} *{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.05) transparent} html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility} *:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(129,140,248,0.3);border-radius:8px} @keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}} @keyframes progressBar{0%{width:0%}50%{width:70%}100%{width:100%}}`;

// ─── PDF Text Extraction ─────────────────────────────────────────────────────

async function extractTextFromPDF(
  file: File,
  onProgress?: (p: number, msg: string) => void
): Promise<string> {
  onProgress?.(5, 'Loading PDF Worker...');
  const arrayBuffer = await file.arrayBuffer();
  
  let pdf;
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    pdf = await withTimeout(
      loadingTask.promise, 
      10000, 
      "PDF Worker timed out. Check internet connection or CORS settings."
    );
  } catch (e: any) {
    console.error("PDF Load Error:", e);
    throw new Error("Failed to initialize PDF engine. " + (e.message || ""));
  }

  const totalPages = pdf.numPages;
  const allText: string[] = [];

  onProgress?.(15, `Parsing ${totalPages} page${totalPages > 1 ? 's' : ''}...`);

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    if (items.length === 0) {
      allText.push(`[Page ${pageNum}: No text layer - may need OCR]`);
      onProgress?.(15 + ((pageNum / totalPages) * 70), `Page ${pageNum}/${totalPages} (no text layer)`);
      continue;
    }

    const lineItems = items
      .filter(item => item.str.trim() !== '' || item.str === ' ')
      .map(item => ({
        x: item.transform[4],
        y: Math.round(item.transform[5] * 10) / 10,
        text: item.str,
        width: item.width,
        fontSize: Math.abs(item.transform[0]) || Math.abs(item.transform[3]) || 12,
      }));

    const yThreshold = 3;
    const lineGroups = new Map<number, any[]>();

    for (const item of lineItems) {
      let foundY: number | null = null;
      for (const existingY of lineGroups.keys()) {
        if (Math.abs(existingY - item.y) < yThreshold) {
          foundY = existingY;
          break;
        }
      }
      const key = foundY ?? item.y;
      if (!lineGroups.has(key)) lineGroups.set(key, []);
      lineGroups.get(key)!.push(item);
    }

    const sortedYs = Array.from(lineGroups.keys()).sort((a, b) => b - a);
    const pageLines: string[] = [];

    for (const y of sortedYs) {
      const groupItems = lineGroups.get(y)!;
      groupItems.sort((a, b) => a.x - b.x);

      let lineText = '';
      let lastX = 0;
      let lastWidth = 0;

      for (let i = 0; i < groupItems.length; i++) {
        const item = groupItems[i];
        if (i > 0) {
          const gap = item.x - (lastX + lastWidth);
          const avgCharWidth = item.fontSize * 0.5;
          if (gap > avgCharWidth * 2) {
            lineText += '    ';
          } else if (gap > avgCharWidth * 0.3) {
            lineText += ' ';
          }
        }
        lineText += item.text;
        lastX = item.x;
        lastWidth = item.width;
      }
      const trimmed = lineText.trim();
      if (trimmed) pageLines.push(trimmed);
    }

    if (totalPages > 1 && pageNum > 1) allText.push(`\n--- Page ${pageNum} ---\n`);
    allText.push(pageLines.join('\n'));

    onProgress?.(15 + ((pageNum / totalPages) * 70), `Page ${pageNum}/${totalPages} extracted`);
  }

  onProgress?.(90, 'Finalizing...');
  return allText.join('\n').trim();
}

async function extractTextFromImage(
  file: File,
  onProgress?: (p: number, msg: string) => void
): Promise<string> {
  onProgress?.(5, 'Initializing OCR engine...');
  const result = await Tesseract.recognize(file, 'eng', {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') {
        onProgress?.(10 + m.progress * 80, `OCR: ${Math.round(m.progress * 100)}%`);
      } else if (m.status === 'loading language traineddata') {
        onProgress?.(5, 'Loading OCR language data...');
      } else if (m.status === 'initializing api') {
        onProgress?.(8, 'Starting OCR engine...');
      }
    },
  });
  onProgress?.(100, 'Done!');
  return result.data.text.trim();
}

async function extractTextFromFile(
  file: File,
  onProgress?: (p: number, msg: string) => void
): Promise<string> {
  if (file.type === 'application/pdf') {
    const pdfText = await extractTextFromPDF(file, onProgress);
    const meaningful = pdfText
      .replace(/\[Page \d+: No text layer.*?\]/g, '')
      .replace(/--- Page \d+ ---/g, '')
      .trim();

    if (meaningful.length < 20) {
      onProgress?.(10, 'PDF appears to be scanned, running OCR...');
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
      const imageFile = new File([blob], 'page.png', { type: 'image/png' });
      return extractTextFromImage(imageFile, onProgress);
    }
    return pdfText;
  }
  if (file.type.startsWith('image/')) return extractTextFromImage(file, onProgress);
  throw new Error(`Unsupported file type: ${file.type}`);
}

// ─── Value Finding Regex ─────────────────────────────────────────────────────

const UNIVERSAL_VALUE_RE =
  /(?:[£$€¥]\s*-?\s*\d[\d,.\s]*\d(?:\.\d{1,2})?|[£$€¥]\s*\d+(?:\.\d{1,2})?|\d[\d,.\s]*\d\s*[£$€¥]|(?:GBP|USD|EUR|CHF)\s*-?\s*\d[\d,.\s]*(?:\.\d{1,2})?|\d[\d,.\s]*(?:\.\d{1,2})?\s*(?:GBP|USD|EUR|CHF)|\d+(?:\.\d+)?\s*%|\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*,?\s*\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}\s*,?\s*\d{2,4}|\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{1,2}|\d+)/gi;

function isValueValidForType(value: string, type: TargetType): boolean {
  const v = value.trim();
  if (!v) return false;
  switch (type) {
    case 'money':
      if (!/\d/.test(v)) return false;
      const digits = v.replace(/[^0-9]/g, '');
      if (digits.length === 0 || /^0+$/.test(digits)) return false;
      return true;
    case 'number': return /\d/.test(v);
    case 'percent': return /\d/.test(v) && /%/.test(v);
    case 'date': return /\d/.test(v) && (/[/\-.]/.test(v) || /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(v));
    case 'text': return v.length > 0;
    default: return true;
  }
}

function parseMoneyValue(str: string): number {
  let s = str.replace(/[£$€¥\s]/g, '').replace(/[A-Za-z]/g, '').replace(/[()]/g, '');
  if (/\d{1,3}(?:\.\d{3})+,\d{1,2}/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const val = parseFloat(s);
  return isNaN(val) ? 0 : Math.abs(val);
}

function getCurrencySymbol(pref: CurrencyPref): string | null {
  switch (pref) { case 'GBP': return '£'; case 'USD': return '$'; case 'EUR': return '€'; default: return null; }
}

function findAllValues(text: string, type: TargetType): Array<{ value: string; index: number }> {
  if (type === 'text') {
    const t = text.replace(/^[\s:=\-–—>|]+/, '').trim();
    if (t && t.length <= 200) return [{ value: t, index: 0 }];
    return [];
  }
  const results: Array<{ value: string; index: number }> = [];
  const re = new RegExp(UNIVERSAL_VALUE_RE.source, UNIVERSAL_VALUE_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const val = match[0].trim();
    if (val && isValueValidForType(val, type)) results.push({ value: val, index: match.index });
  }
  return results;
}

// ─── Label Finding ───────────────────────────────────────────────────────────

interface LabelMatch {
  lineIndex: number;
  charIndex: number;
  matchLength: number;
  score: number;
  labelUsed: string;
}

function findLabelsInText(allLabels: string[], lowerLines: string[]): LabelMatch[] {
  const matches: LabelMatch[] = [];
  for (const rawLabel of allLabels) {
    const lbl = rawLabel.toLowerCase().trim();
    if (!lbl || lbl.length < 2) continue;

    for (let li = 0; li < lowerLines.length; li++) {
      const line = lowerLines[li];
      let idx = line.indexOf(lbl);
      while (idx !== -1) {
        matches.push({ lineIndex: li, charIndex: idx, matchLength: lbl.length, score: 1.0, labelUsed: rawLabel });
        idx = line.indexOf(lbl, idx + 1);
      }
      if (idx === -1) {
        const labelWords = lbl.split(/\s+/).filter(w => w.length > 1);
        if (labelWords.length >= 2) {
          const lineWords = line.split(/\s+/);
          let found = 0;
          for (const lw of labelWords) {
            if (lineWords.some(w => w.includes(lw) || lw.includes(w))) found++;
          }
          const ratio = found / labelWords.length;
          if (ratio >= 0.75) {
            const firstIdx = line.indexOf(labelWords[0]);
            matches.push({ lineIndex: li, charIndex: firstIdx >= 0 ? firstIdx : 0, matchLength: lbl.length, score: ratio * 0.85, labelUsed: rawLabel });
          }
        }
      }
      if (idx === -1 && lbl.length <= 25 && line.trim().length > 0 && line.trim().length < lbl.length * 4) {
        const words = line.split(/\s+/);
        const labelWordCount = lbl.split(/\s+/).length;
        for (let wi = 0; wi <= words.length - labelWordCount; wi++) {
          const segment = words.slice(wi, wi + labelWordCount).join(' ');
          const maxLen = Math.max(segment.length, lbl.length);
          const dist = editDistance(segment, lbl);
          const similarity = 1 - dist / maxLen;
          if (similarity >= 0.75) {
            const segIdx = line.indexOf(words[wi]);
            matches.push({ lineIndex: li, charIndex: segIdx >= 0 ? segIdx : 0, matchLength: segment.length, score: similarity * 0.7, labelUsed: rawLabel });
          }
        }
      }
    }
  }
  matches.sort((a, b) => b.score - a.score);
  return matches;
}

// ─── Main Extraction Engine ──────────────────────────────────────────────────

function extractValues(text: string, targets: ExtractionTarget[], corrections: CorrectionEntry[], debugMode: boolean): ExtractionResult[] {
  if (!text.trim()) return targets.map(t => ({ targetId: t.id, targetLabel: t.label, value: '', confidence: 0, evidence: '', reason: 'No text available.', alternatives: [], position: -1 }));

  const normalized = normalizeText(text);
  const lines = normalized.split('\n');
  const lowerLines = lines.map(l => l.toLowerCase());
  const lineOffsets: number[] = [];
  let offset = 0;
  for (const line of lines) { lineOffsets.push(offset); offset += line.length + 1; }

  const results: ExtractionResult[] = [];
  for (const target of targets) {
    const allLabels = [target.label, ...target.synonyms.split(',').map(s => s.trim()).filter(Boolean)];
    const candidates: Candidate[] = [];
    const debugLog: string[] = [];
    if (debugMode) { debugLog.push(`🔍 "${target.label}" (type: ${target.type})`); debugLog.push(`   Labels: ${allLabels.join(', ')}`); }

    const labelMatches = findLabelsInText(allLabels, lowerLines);
    for (const lm of labelMatches) {
      const sameLine = lines[lm.lineIndex];
      const afterLabelPos = lm.charIndex + lm.matchLength;
      const afterLabel = sameLine.substring(afterLabelPos);
      const cleaned = afterLabel.replace(/^[\s:=\-–—>|]+/, '');
      if (cleaned.trim()) {
        const values = findAllValues(cleaned, target.type);
        for (const v of values) {
          let score = 50 * lm.score;
          const reasons: string[] = [`"${v.value}" after "${lm.labelUsed}"`];
          if (/[:=]/.test(afterLabel.substring(0, (v.index || 0) + 5))) { score += 15; reasons.push('separator'); }
          if (target.type === 'money') {
             if (/[£$€¥]/.test(v.value)) { score += 5; reasons.push('has currency'); }
          }
          candidates.push({ value: v.value, rawValue: v.value, score, confidence: 0, evidence: sameLine.trim(), reason: reasons.join('; '), position: lineOffsets[lm.lineIndex] + afterLabelPos + v.index });
        }
      }
      const fullLineValues = findAllValues(sameLine, target.type);
      for (const v of fullLineValues) {
        const valEnd = v.index + v.value.length;
        if (v.index >= lm.charIndex && v.index < afterLabelPos) continue;
        if (valEnd > lm.charIndex && valEnd <= afterLabelPos) continue;
        const isAfter = v.index >= afterLabelPos;
        let score = isAfter ? 40 * lm.score : 25 * lm.score;
        const isDupe = candidates.some(c => c.value === v.value && Math.abs(c.position - (lineOffsets[lm.lineIndex] + v.index)) < 5);
        if (!isDupe) candidates.push({ value: v.value, rawValue: v.value, score, confidence: 0, evidence: sameLine.trim(), reason: 'Same line', position: lineOffsets[lm.lineIndex] + v.index });
      }
      for (let off = 1; off <= 4; off++) {
        const li = lm.lineIndex + off;
        if (li >= lines.length) break;
        const belowLine = lines[li];
        if (!belowLine.trim()) continue;
        if (off > 1 && /[a-zA-Z]{3,}\s*[:=]/.test(belowLine)) break;
        const values = findAllValues(belowLine, target.type);
        for (const v of values) {
          let score = Math.max(5, (35 - off * 7) * lm.score);
          candidates.push({ value: v.value, rawValue: v.value, score, confidence: 0, evidence: `${sameLine.trim()} → ${belowLine.trim()}`, reason: `Below label`, position: lineOffsets[li] + v.index });
        }
      }
    }

    if (candidates.length === 0 && target.type !== 'text') {
       for (let li = 0; li < lines.length; li++) {
        const values = findAllValues(lines[li], target.type);
        for (const v of values) {
           candidates.push({ value: v.value, rawValue: v.value, score: 5, confidence: 0, evidence: lines[li].trim(), reason: 'Global scan', position: lineOffsets[li] + v.index });
        }
       }
    }

    const deduped = new Map<string, Candidate>();
    for (const c of candidates) {
      const key = target.type === 'money' ? (parseMoneyValue(c.value) > 0 ? parseMoneyValue(c.value).toFixed(2) : c.value.trim()) : c.value.trim().toLowerCase();
      const existing = deduped.get(key);
      if (!existing || c.score > existing.score) deduped.set(key, c);
    }
    const sorted = Array.from(deduped.values()).sort((a, b) => b.score - a.score);
    for (const c of sorted) c.confidence = Math.round(Math.min(100, Math.max(0, (c.score / 70) * 100)));
    const best = sorted[0] || null;
    results.push({ targetId: target.id, targetLabel: target.label, value: best?.value || '', confidence: best?.confidence || 0, evidence: best?.evidence || '', reason: debugMode && debugLog.length > 0 ? debugLog.join('\n') : (best?.reason || 'Not found.'), alternatives: sorted.slice(1, 4), position: best?.position ?? -1 });
  }
  return results;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

const TARGETS_KEY = 'kv-extract-targets-v4';
const TEXT_CACHE_KEY = 'kv-extract-text-cache-v4';
const CORRECTIONS_KEY = 'kv-extract-corrections-v4';

function loadTargets(): ExtractionTarget[] {
  try { const r = localStorage.getItem(TARGETS_KEY); if (r) return JSON.parse(r); } catch {}
  return [
    { id: uid(), label: 'Total Invoice Amount', synonyms: 'Invoice Total, Total due, Balance due, Amount due, Grand total', type: 'money', currency: 'Any' },
    { id: uid(), label: 'Invoice Date', synonyms: 'Date, Issue date, Date of issue, Dated', type: 'date', currency: 'Any' },
    { id: uid(), label: 'Invoice Number', synonyms: 'Invoice #, Invoice no, Inv no, Reference', type: 'text', currency: 'Any' },
  ];
}
function saveTargets(t: ExtractionTarget[]) { localStorage.setItem(TARGETS_KEY, JSON.stringify(t)); }
function loadTextCache(): Record<string, string> { try { const r = localStorage.getItem(TEXT_CACHE_KEY); if (r) return JSON.parse(r); } catch {} return {}; }
function saveTextCache(c: Record<string, string>) { localStorage.setItem(TEXT_CACHE_KEY, JSON.stringify(c)); }
function loadCorrections(): CorrectionEntry[] { try { const r = localStorage.getItem(CORRECTIONS_KEY); if (r) return JSON.parse(r); } catch {} return []; }
function saveCorrections(c: CorrectionEntry[]) { localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(c)); }

// ─── Icons ───────────────────────────────────────────────────────────────────

const Icons = {
  upload: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>)),
  fileText: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>)),
  plus: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>)),
  trash: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>)),
  edit: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>)),
  search: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>)),
  x: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>)),
  check: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>)),
  download: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>)),
  copy: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>)),
  zap: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>)),
  target: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>)),
  chevDown: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>)),
  image: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>)),
  alertCircle: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>)),
  brain: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z" /><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z" /></svg>)),
  bug: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m8 2 1.88 1.88" /><path d="M14.12 3.88 16 2" /><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" /><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" /><path d="M12 20v-9" /><path d="M6.53 9C4.6 8.8 3 7.1 3 5" /><path d="M6 13H2" /><path d="M3 21c0-2.1 1.7-3.9 3.8-4" /><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" /><path d="M22 13h-4" /><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" /></svg>)),
  refresh: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>)),
  layers: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>)),
  eye: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>)),
};

// ─── Toast ───────────────────────────────────────────────────────────────────

const ToastContainer = memo(function ToastContainer({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: string) => void }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div key={toast.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            style={{ padding: '12px 20px', borderRadius: 12, border: `1px solid ${toast.type === 'success' ? T.accent.greenBorder : toast.type === 'error' ? T.accent.roseBorder : T.accent.indigoBorder}`, background: T.bg.elevated, color: toast.type === 'success' ? T.accent.green : toast.type === 'error' ? T.accent.rose : T.accent.indigo, fontSize: 13, fontWeight: 500, fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', cursor: 'pointer', maxWidth: 340 }}
            onClick={() => onRemove(toast.id)}>
            {toast.type === 'success' && <Icons.check style={{ width: 16, height: 16, flexShrink: 0 }} />}
            {toast.type === 'error' && <Icons.alertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />}
            {toast.type === 'info' && <Icons.zap style={{ width: 16, height: 16, flexShrink: 0 }} />}
            <span>{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});

// ─── Document Preview Modal ──────────────────────────────────────────────────

const PreviewModal = memo(function PreviewModal({ doc, onClose }: { doc: DocEntry; onClose: () => void }) {
  const isImage = doc.file.type.startsWith('image/');
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 40,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 1000, height: '85vh',
          background: T.bg.elevated,
          borderRadius: 16,
          border: `1px solid ${T.border.default}`,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '12px 20px',
          borderBottom: `1px solid ${T.border.subtle}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: T.bg.surface,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isImage ? <Icons.image style={{ width: 16, height: 16, color: T.accent.cyan }} /> : <Icons.fileText style={{ width: 16, height: 16, color: T.accent.indigo }} />}
            <span style={{ fontWeight: 600, color: T.text.primary }}>{doc.file.name}</span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: T.text.secondary, cursor: 'pointer', padding: 4, display: 'flex' }}>
            <Icons.x style={{ width: 20, height: 20 }} />
          </button>
        </div>
        
        <div style={{ flex: 1, overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isImage ? (
            <img 
              src={doc.previewUrl || ''} 
              alt="Preview" 
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
            />
          ) : (
            <iframe 
              src={doc.previewUrl || ''} 
              type="application/pdf"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
});

// ─── Confidence helpers ──────────────────────────────────────────────────────

const confColor = (c: number) => c >= 70 ? T.accent.green : c >= 40 ? T.accent.amber : T.accent.rose;
const confBg = (c: number) => c >= 70 ? T.accent.greenBg : c >= 40 ? T.accent.amberBg : T.accent.roseBg;
const confBorder = (c: number) => c >= 70 ? T.accent.greenBorder : c >= 40 ? T.accent.amberBorder : T.accent.roseBorder;

// ─── Compact Doc Result Card ─────────────────────────────────────────────────

const DocResultCard = memo(function DocResultCard({
  doc, targets, corrections, debugMode, onRemove, onUpdate, onRetry, onPreview, addToast
}: {
  doc: DocEntry;
  targets: ExtractionTarget[];
  corrections: CorrectionEntry[];
  debugMode: boolean;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<DocEntry>) => void;
  onRetry: (id: string) => void;
  onPreview: (doc: DocEntry) => void;
  addToast: (msg: string, type: ToastItem['type']) => void;
}) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingField && editRef.current) editRef.current.focus();
  }, [editingField]);

  const foundCount = doc.results.filter(r => r.value).length;
  const totalTargets = targets.length;
  const avgConf = doc.results.length > 0
    ? Math.round(doc.results.reduce((s, r) => s + r.confidence, 0) / doc.results.length)
    : 0;

  const isProcessing = doc.status === 'queued' || doc.status === 'parsing' || doc.status === 'extracting';
  const isImage = doc.file.type.startsWith('image/');

  const statusIcon = () => {
    if (doc.status === 'done') return <Icons.check style={{ width: 14, height: 14, color: T.accent.green }} />;
    if (doc.status === 'error') return <Icons.alertCircle style={{ width: 14, height: 14, color: T.accent.rose }} />;
    return (
      <div style={{
        width: 14, height: 14,
        border: `2px solid ${T.accent.indigo}`,
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        flexShrink: 0,
      }} />
    );
  };

  const statusLabel = () => {
    switch (doc.status) {
      case 'queued': return 'Queued';
      case 'parsing': return doc.progressMsg || 'Reading...';
      case 'extracting': return 'Extracting values...';
      case 'done': return `${foundCount}/${totalTargets} found`;
      case 'error': return doc.error || 'Error';
    }
  };

  const handleSave = (targetId: string) => {
    const newResults = doc.results.map(r =>
      r.targetId === targetId ? { ...r, value: editVal } : r
    );
    onUpdate(doc.id, { results: newResults });
    setEditingField(null);
  };

  const handleSelectAlt = (targetId: string, cand: Candidate) => {
    const newResults = doc.results.map(r => {
      if (r.targetId !== targetId) return r;
      const old: Candidate = {
        value: r.value, rawValue: r.value, score: r.confidence,
        confidence: r.confidence, evidence: r.evidence, reason: r.reason, position: r.position,
      };
      return {
        ...r, value: cand.value, confidence: cand.confidence,
        evidence: cand.evidence, reason: cand.reason, position: cand.position,
        alternatives: [old, ...r.alternatives.filter(a => a.value !== cand.value)].slice(0, 3),
      };
    });
    onUpdate(doc.id, { results: newResults });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
      layout
      style={{
        borderRadius: 14,
        border: `1px solid ${doc.status === 'error' ? T.accent.roseBorder : doc.status === 'done' ? T.border.subtle : T.accent.indigoBorder}`,
        background: T.bg.surface,
        overflow: 'hidden',
      }}
    >
      {/* ── Header row ── */}
      <div
        onClick={() => doc.status === 'done' && onUpdate(doc.id, { expanded: !doc.expanded })}
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: doc.status === 'done' ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        {/* File icon */}
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: isImage ? T.accent.cyanBg : T.accent.indigoBg,
          border: `1px solid ${isImage ? T.accent.cyanBorder : T.accent.indigoBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {isImage
            ? <Icons.image style={{ width: 15, height: 15, color: T.accent.cyan }} />
            : <Icons.fileText style={{ width: 15, height: 15, color: T.accent.indigo }} />
          }
        </div>

        {/* File name + status */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 13, fontWeight: 600, margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: T.text.primary,
          }}>
            {doc.file.name}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            {statusIcon()}
            <span style={{
              fontSize: 11, fontWeight: 500,
              color: doc.status === 'done' ? T.accent.green : doc.status === 'error' ? T.accent.rose : T.accent.indigo,
            }}>
              {statusLabel()}
            </span>
            <span style={{ fontSize: 10, color: T.text.muted }}>
              {formatFileSize(doc.file.size)}
            </span>
          </div>
        </div>

        {/* Progress bar for parsing */}
        {isProcessing && (
          <div style={{ width: 60, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', flexShrink: 0 }}>
            <motion.div
              animate={{ width: `${doc.progress}%` }}
              transition={{ duration: 0.3 }}
              style={{ height: '100%', borderRadius: 3, background: T.accent.indigo }}
            />
          </div>
        )}

        {/* Confidence summary badge */}
        {doc.status === 'done' && doc.results.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            padding: '4px 10px', borderRadius: 8,
            background: confBg(avgConf), border: `1px solid ${confBorder(avgConf)}`,
          }}>
            <div style={{ width: 32, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ width: `${avgConf}%`, height: '100%', borderRadius: 2, background: confColor(avgConf) }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: confColor(avgConf) }}>{avgConf}%</span>
          </div>
        )}

        {/* Expand chevron */}
        {doc.status === 'done' && (
          <Icons.chevDown style={{
            width: 16, height: 16, color: T.text.muted, flexShrink: 0,
            transform: doc.expanded ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s',
          }} />
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {/* Eye Icon for Preview */}
           <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); onPreview(doc); }}
            style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.accent.cyan }}>
            <Icons.eye style={{ width: 14, height: 14 }} />
          </motion.button>

          {doc.status === 'error' && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); onRetry(doc.id); }}
              style={{ width: 26, height: 26, borderRadius: 7, background: T.accent.amberBg, border: `1px solid ${T.accent.amberBorder}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.accent.amber }}>
              <Icons.refresh style={{ width: 12, height: 12 }} />
            </motion.button>
          )}
          <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); onRemove(doc.id); }}
            style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text.muted }}>
            <Icons.x style={{ width: 12, height: 12 }} />
          </motion.button>
        </div>
      </div>

      {/* ── Compact results when collapsed ── */}
      {doc.status === 'done' && !doc.expanded && doc.results.length > 0 && (
        <div style={{
          padding: '0 16px 12px',
          display: 'flex', flexWrap: 'wrap', gap: 6,
        }}>
          {doc.results.map(r => (
            <div key={r.targetId} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 8px', borderRadius: 6,
              background: r.value ? 'rgba(255,255,255,0.025)' : T.accent.roseBg,
              border: `1px solid ${r.value ? T.border.subtle : T.accent.roseBorder}`,
              fontSize: 11,
            }}>
              <span style={{ color: T.text.tertiary, fontWeight: 500 }}>{r.targetLabel}:</span>
              <span style={{ color: r.value ? T.text.primary : T.accent.rose, fontWeight: 600 }}>
                {r.value || '—'}
              </span>
              {r.value && (
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  color: confColor(r.confidence),
                  padding: '1px 4px', borderRadius: 3,
                  background: confBg(r.confidence),
                }}>
                  {r.confidence}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Expanded detail view ── */}
      <AnimatePresence>
        {doc.status === 'done' && doc.expanded && doc.results.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              borderTop: `1px solid ${T.border.subtle}`,
              padding: '12px 16px',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              {doc.results.map(r => {
                const isEditing = editingField === `${doc.id}-${r.targetId}`;
                return (
                  <div key={r.targetId} style={{
                    padding: '10px 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.015)',
                    border: `1px solid ${T.border.subtle}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {/* Label */}
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.text.tertiary, minWidth: 90 }}>
                        {r.targetLabel}
                      </span>

                      {/* Value */}
                      <div style={{ flex: 1, minWidth: 80 }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input
                              ref={editRef}
                              value={editVal}
                              onChange={e => setEditVal(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSave(r.targetId);
                                if (e.key === 'Escape') setEditingField(null);
                              }}
                              style={{
                                flex: 1, padding: '4px 8px', borderRadius: 6,
                                border: `1px solid ${T.accent.indigoBorder}`,
                                background: T.accent.indigoBg, color: T.text.primary,
                                fontSize: 12, fontWeight: 600, outline: 'none',
                                fontFamily: "'Inter', sans-serif",
                              }}
                            />
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleSave(r.targetId)}
                              style={{ width: 24, height: 24, borderRadius: 5, background: T.accent.greenBg, border: `1px solid ${T.accent.greenBorder}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.accent.green }}>
                              <Icons.check style={{ width: 10, height: 10 }} />
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditingField(null)}
                              style={{ width: 24, height: 24, borderRadius: 5, background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border.subtle}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text.muted }}>
                              <Icons.x style={{ width: 10, height: 10 }} />
                            </motion.button>
                          </div>
                        ) : (
                          <div
                            onClick={() => { setEditingField(`${doc.id}-${r.targetId}`); setEditVal(r.value); }}
                            style={{
                              padding: '4px 8px', borderRadius: 6,
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid transparent',
                              cursor: 'text', fontSize: 12, fontWeight: 600,
                              color: r.value ? T.text.primary : T.text.muted,
                              minHeight: 24, display: 'flex', alignItems: 'center',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = T.border.hover)}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                          >
                            {r.value || 'Click to enter…'}
                          </div>
                        )}
                      </div>

                      {/* Confidence bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                          <div style={{ width: `${r.confidence}%`, height: '100%', borderRadius: 2, background: confColor(r.confidence), transition: 'width 0.5s' }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: confColor(r.confidence), minWidth: 26, textAlign: 'right' }}>
                          {r.confidence}%
                        </span>
                      </div>
                    </div>

                    {/* Evidence */}
                    {r.evidence && (
                      <div style={{
                        marginTop: 6, padding: '5px 8px', borderRadius: 6,
                        background: 'rgba(255,255,255,0.015)',
                        border: `1px solid ${T.border.subtle}`,
                        fontSize: 10, color: T.text.muted,
                        fontFamily: 'monospace', lineHeight: 1.4,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        <span style={{ color: T.text.tertiary, fontWeight: 500, marginRight: 4 }}>Evidence:</span>
                        {r.evidence}
                      </div>
                    )}

                    {/* Debug reason */}
                    {debugMode && r.reason && (
                      <div style={{
                        marginTop: 4, padding: '5px 8px', borderRadius: 6,
                        background: T.accent.indigoBg,
                        border: `1px solid ${T.accent.indigoBorder}`,
                        fontSize: 10, color: T.accent.indigo,
                        lineHeight: 1.5, whiteSpace: 'pre-wrap', fontFamily: 'monospace',
                      }}>
                        {r.reason}
                      </div>
                    )}

                    {/* Alternatives */}
                    {r.alternatives.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {r.alternatives.map((alt, ai) => (
                          <motion.div
                            key={ai}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => handleSelectAlt(r.targetId, alt)}
                            style={{
                              padding: '3px 8px', borderRadius: 5,
                              border: `1px solid ${T.border.subtle}`,
                              background: 'rgba(255,255,255,0.02)',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                              fontSize: 10,
                            }}
                          >
                            <span style={{ color: T.text.secondary, fontWeight: 500 }}>{alt.value}</span>
                            <span style={{
                              fontWeight: 700, color: confColor(alt.confidence),
                              padding: '0 3px', borderRadius: 3, background: confBg(alt.confidence),
                            }}>
                              {alt.confidence}%
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────

function DocumentProcessorDev() {
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // New state for Preview Modal
  const [previewDoc, setPreviewDoc] = useState<DocEntry | null>(null);

  const [targets, setTargets] = useState<ExtractionTarget[]>(loadTargets);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [newTarget, setNewTarget] = useState<Omit<ExtractionTarget, 'id'>>({ label: '', synonyms: '', type: 'money', currency: 'Any' });

  const [debugMode, setDebugMode] = useState(false);
  const [corrections, setCorrections] = useState<CorrectionEntry[]>(loadCorrections);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const textCacheRef = useRef(loadTextCache());
  const processingRef = useRef(false);
  const queueRef = useRef<string[]>([]);

  useEffect(() => { saveTargets(targets); }, [targets]);
  useEffect(() => { saveCorrections(corrections); }, [corrections]);

  // ─── Reserve Processor ─────────────────────────────────────────────
const reserve = useReserveProcessor(
  useCallback((docId: string, results: ReserveResult[]) => {
    // Merge improved reserve results back into the doc's results
    setDocs(prev => prev.map(doc => {
      if (doc.id !== docId) return doc;
      const mergedResults = doc.results.map(original => {
        const reserveResult = results.find(r => r.targetId === original.targetId);
        if (!reserveResult || !reserveResult.improved) return original;
        // Replace with the improved result
        return {
          ...original,
          value: reserveResult.value,
          confidence: reserveResult.confidence,
          evidence: reserveResult.evidence,
          reason: `[Reserve: ${reserveResult.technique}] ${reserveResult.reason}`,
          alternatives: [
            // Keep original as first alternative
            {
              value: original.value,
              rawValue: original.value,
              score: original.confidence,
              confidence: original.confidence,
              evidence: original.evidence,
              reason: `[Original] ${original.reason}`,
              position: original.position,
            },
            ...reserveResult.alternatives,
          ].slice(0, 5),
          position: reserveResult.position,
        };
      });
      return { ...doc, results: mergedResults };
    }));
    addToast(
      `Reserve improved ${results.filter(r => r.improved).length} value(s)`,
      'success'
    );
  }, [addToast])
);

  const addToast = useCallback((message: string, type: ToastItem['type'] = 'success') => {
    const id = uid();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);
  const removeToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const processDoc = useCallback(async (docId: string) => {
    let fileToProcess: File | null = null;
    
    setDocs(prev => {
      const doc = prev.find(d => d.id === docId);
      if (doc) {
        fileToProcess = doc.file;
        return prev.map(d => d.id === docId ? { 
          ...d, status: 'parsing', progress: 0, progressMsg: 'Starting...' 
        } : d);
      }
      return prev;
    });

    await new Promise(r => setTimeout(r, 10));

    if (!fileToProcess) return;

    const key = fileHash(fileToProcess);
    const cached = textCacheRef.current[key];
    let text = '';

    try {
      if (cached) {
        text = cached;
        setDocs(prev => prev.map(d => d.id === docId ? { ...d, progress: 100, progressMsg: 'Cached', text: cached } : d));
      } else {
        text = await extractTextFromFile(fileToProcess, (p, msg) => {
          setDocs(prev => prev.map(d => d.id === docId ? { ...d, progress: p, progressMsg: msg } : d));
        });
        textCacheRef.current[key] = text;
        saveTextCache(textCacheRef.current);
      }

      setDocs(prev => prev.map(d => d.id === docId ? { ...d, status: 'extracting', progress: 95, progressMsg: 'Extracting...' } : d));
      const results = extractValues(text, targets, corrections, debugMode);

      setDocs(prev => prev.map(d => d.id === docId ? {
  ...d, status: 'done', progress: 100, progressMsg: 'Done', results, text, expanded: false,
} : d));

// ── Auto-trigger Reserve Processor for low-confidence results ──
const hasWeakResults = results.some(r => !r.value || r.confidence < 50);
if (hasWeakResults) {
  reserve.submitJob(
    docId,
    fileToProcess!.name,
    text,
    targets,
    results
  );
}

    } catch (err: any) {
      console.error('Extraction error:', err);
      setDocs(prev => prev.map(d => d.id === docId ? {
        ...d, status: 'error', error: err.message || 'Failed to extract text',
      } : d));
    }
  }, [targets, corrections, debugMode]);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    while (queueRef.current.length > 0) {
      const docId = queueRef.current[0];
      await processDoc(docId);
      queueRef.current.shift();
    }
    processingRef.current = false;
  }, [processDoc]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const newDocs: DocEntry[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!validTypes.includes(f.type)) continue;
      const docId = uid();
      const url = URL.createObjectURL(f);
      newDocs.push({
        id: docId,
        file: f,
        previewUrl: url,
        status: 'queued',
        progress: 0,
        progressMsg: 'Queued',
        text: '',
        results: [],
        error: null,
        expanded: false,
      });
      queueRef.current.push(docId);
    }

    if (newDocs.length === 0) {
      addToast('Please upload PDF, PNG, or JPG files.', 'error');
      return;
    }

    setDocs(prev => [...prev, ...newDocs]);
    addToast(`${newDocs.length} document${newDocs.length > 1 ? 's' : ''} queued`, 'info');
    setTimeout(() => processQueue(), 100);
  }, [addToast, processQueue]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeDoc = useCallback((id: string) => {
    setDocs(prev => {
      const doc = prev.find(d => d.id === id);
      if (doc?.previewUrl) URL.revokeObjectURL(doc.previewUrl);
      return prev.filter(d => d.id !== id);
    });
    queueRef.current = queueRef.current.filter(qid => qid !== id);
  }, []);

  const updateDoc = useCallback((id: string, updates: Partial<DocEntry>) => {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  }, []);

  const retryDoc = useCallback((id: string) => {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, status: 'queued' as DocStatus, error: null, progress: 0, results: [] } : d));
    queueRef.current.push(id);
    setTimeout(() => processQueue(), 100);
  }, [processQueue]);

  const reExtractAll = useCallback(() => {
    const doneDocs = docs.filter(d => d.status === 'done' && d.text);
    if (doneDocs.length === 0) return;
    for (const d of doneDocs) {
      const results = extractValues(d.text, targets, corrections, debugMode);
      setDocs(prev => prev.map(doc => doc.id === d.id ? { ...doc, results } : doc));
    }
    addToast(`Re-extracted ${doneDocs.length} document${doneDocs.length > 1 ? 's' : ''}`, 'success');
  }, [docs, targets, corrections, debugMode, addToast]);

  const addTarget = useCallback(() => {
    if (!newTarget.label.trim()) return;
    setTargets(prev => [...prev, { id: uid(), ...newTarget, label: newTarget.label.trim() }]);
    setNewTarget({ label: '', synonyms: '', type: 'money', currency: 'Any' });
    setShowAddTarget(false);
    addToast('Target added', 'success');
  }, [newTarget, addToast]);

  const updateTarget = useCallback((id: string, u: Partial<ExtractionTarget>) => setTargets(prev => prev.map(t => t.id === id ? { ...t, ...u } : t)), []);
  const deleteTarget = useCallback((id: string) => { setTargets(prev => prev.filter(t => t.id !== id)); addToast('Removed', 'info'); }, [addToast]);

  const exportAll = useCallback(() => {
    const doneDocs = docs.filter(d => d.status === 'done');
    if (doneDocs.length === 0) { addToast('No results to export', 'error'); return; }
    const data = doneDocs.map(d => ({
      filename: d.file.name,
      results: d.results.map(r => ({ target: r.targetLabel, value: r.value, confidence: r.confidence, evidence: r.evidence })),
    }));
    const b = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a'); a.href = u; a.download = `extraction-results-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(u);
    addToast('Exported all results', 'success');
  }, [docs, addToast]);

  const copyAll = useCallback(() => {
    const doneDocs = docs.filter(d => d.status === 'done');
    if (doneDocs.length === 0) return;
    const data = doneDocs.map(d => ({
      filename: d.file.name,
      results: d.results.map(r => ({ target: r.targetLabel, value: r.value, confidence: r.confidence })),
    }));
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      .then(() => addToast('Copied!', 'success'))
      .catch(() => addToast('Failed to copy', 'error'));
  }, [docs, addToast]);

  const doneCount = docs.filter(d => d.status === 'done').length;
  const processingCount = docs.filter(d => d.status === 'queued' || d.status === 'parsing' || d.status === 'extracting').length;
  const errorCount = docs.filter(d => d.status === 'error').length;
  const typeOptions: TargetType[] = ['money', 'date', 'number', 'text', 'percent'];
  const currencyOptions: CurrencyPref[] = ['Any', 'GBP', 'USD', 'EUR'];
  const typeEmoji: Record<TargetType, string> = { money: '💰', date: '📅', number: '#️⃣', text: '📝', percent: '%' };
  const typeDesc: Record<TargetType, string> = { money: '£1,234.56, $500, €99', date: '01/02/2024, Jan 5 2024', number: 'Plain: 1234, 56.78', text: 'Any text value', percent: '15%, 3.5%' };

  return (
    <>
      <style>{globalCSS}</style>
      <div style={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${T.bg.primary} 0%, ${T.bg.secondary} 100%)`,
        fontFamily: "'Inter', sans-serif",
        color: T.text.primary,
        padding: 24,
      }}>
        {/* Render Preview Modal if active */}
        <AnimatePresence>
          {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
        </AnimatePresence>

        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* ── Header ── */}
          <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `linear-gradient(135deg, ${T.accent.indigo}, ${T.accent.cyan})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 20px ${T.accent.indigoBg}`,
              }}>
                <Icons.brain style={{ width: 22, height: 22, color: '#fff' }} />
              </div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>Document Extractor</h1>
                <p style={{ fontSize: 12, color: T.text.tertiary, margin: 0 }}>Intelligent data extraction from PDFs & images</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setDebugMode(!debugMode)}
                style={{
                  padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                  background: debugMode ? T.accent.amberBg : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${debugMode ? T.accent.amberBorder : T.border.subtle}`,
                  color: debugMode ? T.accent.amber : T.text.secondary,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <Icons.bug style={{ width: 14, height: 14 }} />
                Debug
              </motion.button>
              {doneCount > 0 && (
                <>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={reExtractAll}
                    style={{
                      padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                      background: T.accent.cyanBg, border: `1px solid ${T.accent.cyanBorder}`,
                      color: T.accent.cyan, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    <Icons.refresh style={{ width: 14, height: 14 }} />
                    Re-extract
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={copyAll}
                    style={{
                      padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                      background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border.subtle}`,
                      color: T.text.secondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    <Icons.copy style={{ width: 14, height: 14 }} />
                    Copy
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={exportAll}
                    style={{
                      padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                      background: T.accent.greenBg, border: `1px solid ${T.accent.greenBorder}`,
                      color: T.accent.green, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    <Icons.download style={{ width: 14, height: 14 }} />
                    Export
                  </motion.button>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
            {/* ── Left Panel: Targets ── */}
            <div style={{
              borderRadius: 16, border: `1px solid ${T.border.subtle}`,
              background: T.bg.surface, overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 16px',
                borderBottom: `1px solid ${T.border.subtle}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icons.target style={{ width: 16, height: 16, color: T.accent.indigo }} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Extraction Targets</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: T.accent.indigo,
                    background: T.accent.indigoBg, padding: '2px 6px', borderRadius: 6,
                  }}>
                    {targets.length}
                  </span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowAddTarget(true)}
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: T.accent.indigoBg, border: `1px solid ${T.accent.indigoBorder}`,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: T.accent.indigo,
                  }}
                >
                  <Icons.plus style={{ width: 14, height: 14 }} />
                </motion.button>
              </div>

              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                <AnimatePresence>
                  {targets.map(t => (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }}
                      style={{
                        padding: 12, borderRadius: 10,
                        border: `1px solid ${T.border.subtle}`,
                        background: 'rgba(255,255,255,0.015)',
                      }}
                    >
                      {editingTargetId === t.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <input
                            value={t.label}
                            onChange={e => updateTarget(t.id, { label: e.target.value })}
                            placeholder="Label"
                            style={{
                              padding: '8px 10px', borderRadius: 8,
                              border: `1px solid ${T.accent.indigoBorder}`,
                              background: T.accent.indigoBg, color: T.text.primary,
                              fontSize: 12, fontWeight: 600, outline: 'none',
                              fontFamily: "'Inter', sans-serif",
                            }}
                          />
                          <input
                            value={t.synonyms}
                            onChange={e => updateTarget(t.id, { synonyms: e.target.value })}
                            placeholder="Synonyms (comma-separated)"
                            style={{
                              padding: '8px 10px', borderRadius: 8,
                              border: `1px solid ${T.border.subtle}`,
                              background: 'rgba(255,255,255,0.03)', color: T.text.secondary,
                              fontSize: 11, outline: 'none',
                              fontFamily: "'Inter', sans-serif",
                            }}
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <select
                              value={t.type}
                              onChange={e => updateTarget(t.id, { type: e.target.value as TargetType })}
                              style={{
                                flex: 1, padding: '6px 8px', borderRadius: 6,
                                border: `1px solid ${T.border.subtle}`,
                                background: T.bg.elevated, color: T.text.primary,
                                fontSize: 11, outline: 'none', cursor: 'pointer',
                                fontFamily: "'Inter', sans-serif",
                              }}
                            >
                              {typeOptions.map(opt => (
                                <option key={opt} value={opt}>{typeEmoji[opt]} {opt}</option>
                              ))}
                            </select>
                            {t.type === 'money' && (
                              <select
                                value={t.currency}
                                onChange={e => updateTarget(t.id, { currency: e.target.value as CurrencyPref })}
                                style={{
                                  padding: '6px 8px', borderRadius: 6,
                                  border: `1px solid ${T.border.subtle}`,
                                  background: T.bg.elevated, color: T.text.primary,
                                  fontSize: 11, outline: 'none', cursor: 'pointer',
                                  fontFamily: "'Inter', sans-serif",
                                }}
                              >
                                {currencyOptions.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            )}
                          </div>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setEditingTargetId(null)}
                            style={{
                              padding: '8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                              background: T.accent.greenBg, border: `1px solid ${T.accent.greenBorder}`,
                              color: T.accent.green, cursor: 'pointer',
                              fontFamily: "'Inter', sans-serif",
                            }}
                          >
                            Done
                          </motion.button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 16 }}>{typeEmoji[t.type]}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, margin: 0, color: T.text.primary }}>{t.label}</p>
                            {t.synonyms && (
                              <p style={{
                                fontSize: 10, color: T.text.muted, margin: '2px 0 0',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {t.synonyms}
                              </p>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditingTargetId(t.id)}
                              style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text.muted }}>
                              <Icons.edit style={{ width: 11, height: 11 }} />
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => deleteTarget(t.id)}
                              style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text.muted }}>
                              <Icons.trash style={{ width: 11, height: 11 }} />
                            </motion.button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                <AnimatePresence>
                  {showAddTarget && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{
                        padding: 12, borderRadius: 10,
                        border: `1px solid ${T.accent.indigoBorder}`,
                        background: T.accent.indigoBg,
                        display: 'flex', flexDirection: 'column', gap: 8,
                        overflow: 'hidden',
                      }}
                    >
                      <input
                        value={newTarget.label}
                        onChange={e => setNewTarget(p => ({ ...p, label: e.target.value }))}
                        placeholder="Label (e.g. Invoice Total)"
                        style={{
                          padding: '8px 10px', borderRadius: 8,
                          border: `1px solid ${T.accent.indigoBorder}`,
                          background: 'rgba(0,0,0,0.2)', color: T.text.primary,
                          fontSize: 12, fontWeight: 600, outline: 'none',
                          fontFamily: "'Inter', sans-serif",
                        }}
                      />
                      <input
                        value={newTarget.synonyms}
                        onChange={e => setNewTarget(p => ({ ...p, synonyms: e.target.value }))}
                        placeholder="Synonyms (comma-separated)"
                        style={{
                          padding: '8px 10px', borderRadius: 8,
                          border: `1px solid ${T.border.subtle}`,
                          background: 'rgba(0,0,0,0.15)', color: T.text.secondary,
                          fontSize: 11, outline: 'none',
                          fontFamily: "'Inter', sans-serif",
                        }}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select
                          value={newTarget.type}
                          onChange={e => setNewTarget(p => ({ ...p, type: e.target.value as TargetType }))}
                          style={{
                            flex: 1, padding: '6px 8px', borderRadius: 6,
                            border: `1px solid ${T.border.subtle}`,
                            background: T.bg.elevated, color: T.text.primary,
                            fontSize: 11, outline: 'none', cursor: 'pointer',
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          {typeOptions.map(opt => (
                            <option key={opt} value={opt}>{typeEmoji[opt]} {opt}</option>
                          ))}
                        </select>
                        {newTarget.type === 'money' && (
                          <select
                            value={newTarget.currency}
                            onChange={e => setNewTarget(p => ({ ...p, currency: e.target.value as CurrencyPref }))}
                            style={{
                              padding: '6px 8px', borderRadius: 6,
                              border: `1px solid ${T.border.subtle}`,
                              background: T.bg.elevated, color: T.text.primary,
                              fontSize: 11, outline: 'none', cursor: 'pointer',
                              fontFamily: "'Inter', sans-serif",
                            }}
                          >
                            {currencyOptions.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <p style={{ fontSize: 10, color: T.text.muted, margin: 0 }}>
                        {typeDesc[newTarget.type]}
                      </p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={addTarget}
                          disabled={!newTarget.label.trim()}
                          style={{
                            flex: 1, padding: '8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                            background: newTarget.label.trim() ? T.accent.green : T.text.muted,
                            border: 'none', color: '#fff', cursor: newTarget.label.trim() ? 'pointer' : 'not-allowed',
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          Add Target
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { setShowAddTarget(false); setNewTarget({ label: '', synonyms: '', type: 'money', currency: 'Any' }); }}
                          style={{
                            padding: '8px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                            background: 'rgba(255,255,255,0.05)', border: 'none',
                            color: T.text.secondary, cursor: 'pointer',
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          Cancel
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* ── Right Panel: Upload + Results ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <motion.div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                animate={{ scale: dragOver ? 1.01 : 1 }}
                style={{
                  padding: 32, borderRadius: 16,
                  border: `2px dashed ${dragOver ? T.accent.indigo : T.border.default}`,
                  background: dragOver ? T.accent.indigoBg : T.bg.surface,
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  textAlign: 'center',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/jpg"
                  multiple
                  onChange={e => handleFiles(e.target.files)}
                  style={{ display: 'none' }}
                />
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: T.accent.indigoBg, border: `1px solid ${T.accent.indigoBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 12,
                }}>
                  <Icons.upload style={{ width: 24, height: 24, color: T.accent.indigo }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: T.text.primary }}>
                  Drop files here or click to upload
                </p>
                <p style={{ fontSize: 12, color: T.text.tertiary, margin: '6px 0 0' }}>
                  PDF, PNG, JPG • Multiple files supported
                </p>
              </motion.div>

              {docs.length > 0 && (
                <div style={{
                  display: 'flex', gap: 12, flexWrap: 'wrap',
                  padding: '12px 16px', borderRadius: 12,
                  background: T.bg.surface, border: `1px solid ${T.border.subtle}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icons.layers style={{ width: 14, height: 14, color: T.text.tertiary }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text.secondary }}>
                      {docs.length} document{docs.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {processingCount > 0 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 6,
                      background: T.accent.indigoBg, border: `1px solid ${T.accent.indigoBorder}`,
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        border: `2px solid ${T.accent.indigo}`,
                        borderTopColor: 'transparent',
                        animation: 'spin 0.8s linear infinite',
                      }} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: T.accent.indigo }}>
                        {processingCount} processing
                      </span>
                    </div>
                  )}
                  {doneCount > 0 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 6,
                      background: T.accent.greenBg, border: `1px solid ${T.accent.greenBorder}`,
                    }}>
                      <Icons.check style={{ width: 10, height: 10, color: T.accent.green }} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: T.accent.green }}>
                        {doneCount} complete
                      </span>
                    </div>
                  )}
                  {errorCount > 0 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 6,
                      background: T.accent.roseBg, border: `1px solid ${T.accent.roseBorder}`,
                    }}>
                      <Icons.alertCircle style={{ width: 10, height: 10, color: T.accent.rose }} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: T.accent.rose }}>
                        {errorCount} error{errorCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <AnimatePresence>
                  {docs.map(doc => (
                    <DocResultCard
                      key={doc.id}
                      doc={doc}
                      targets={targets}
                      corrections={corrections}
                      debugMode={debugMode}
                      onRemove={removeDoc}
                      onUpdate={updateDoc}
                      onRetry={retryDoc}
                      onPreview={setPreviewDoc} // Pass the preview handler
                      addToast={addToast}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {docs.length === 0 && (
                <div style={{
                  padding: 48, textAlign: 'center',
                  borderRadius: 16, border: `1px solid ${T.border.subtle}`,
                  background: T.bg.surface,
                }}>
                  <Icons.fileText style={{ width: 40, height: 40, color: T.text.muted, margin: '0 auto 12px' }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: T.text.secondary, margin: 0 }}>
                    No documents yet
                  </p>
                  <p style={{ fontSize: 12, color: T.text.muted, margin: '6px 0 0' }}>
                    Upload PDFs or images to extract data
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    </>
  );
}

export default DocumentProcessorDev;