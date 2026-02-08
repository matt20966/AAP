import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

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

// ─── Troubleshooting Types ───────────────────────────────────────────────────

interface TroubleshootIssue {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  suggestion: string;
  autoFixable: boolean;
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

const globalCSS = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'); *::-webkit-scrollbar{width:5px;height:5px} *::-webkit-scrollbar-track{background:transparent} *::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.05);border-radius:10px} *::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.1)} *{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.05) transparent} html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility} *:focus-visible{outline:none;box-shadow:0 0 0 2px rgba(129,140,248,0.3);border-radius:8px} @keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}} @keyframes progressBar{0%{width:0%}50%{width:70%}100%{width:100%}} @keyframes fadeInUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`;

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

// ─── Troubleshooting Engine ──────────────────────────────────────────────────

function diagnoseParsing(doc: DocEntry, targets: ExtractionTarget[]): TroubleshootIssue[] {
  const issues: TroubleshootIssue[] = [];

  if (!doc.text || doc.text.trim().length === 0) {
    issues.push({
      id: uid(),
      title: 'No text extracted',
      description: 'The document produced zero text. This usually means the PDF is image-only or the file is corrupt.',
      severity: 'critical',
      suggestion: 'Try re-uploading as a high-resolution image (PNG/JPG). If it\'s a scanned PDF, the OCR fallback should kick in automatically — if it didn\'t, the image quality may be too low.',
      autoFixable: false,
    });
    return issues;
  }

  // Check text length
  if (doc.text.trim().length < 50) {
    issues.push({
      id: uid(),
      title: 'Very little text extracted',
      description: `Only ${doc.text.trim().length} characters were found. The document may be mostly images or heavily formatted.`,
      severity: 'warning',
      suggestion: 'Try scanning the document at a higher DPI (300+), or crop and upload individual pages as images for better OCR results.',
      autoFixable: false,
    });
  }

  // Check for OCR artifacts
  const ocrGarbageRatio = (doc.text.match(/[^\x20-\x7E\n\r\t£€$¥°±²³µ¶·¸¹º»¼½¾¿×÷]/g) || []).length / Math.max(doc.text.length, 1);
  if (ocrGarbageRatio > 0.15) {
    issues.push({
      id: uid(),
      title: 'High OCR noise detected',
      description: `${Math.round(ocrGarbageRatio * 100)}% of extracted text appears to be garbled characters. OCR quality is low.`,
      severity: 'warning',
      suggestion: 'Improve image quality: increase contrast, ensure text is not rotated, remove watermarks/backgrounds. Re-upload with a cleaner scan.',
      autoFixable: false,
    });
  }

  // Check for "No text layer" pages
  const noTextPages = (doc.text.match(/\[Page \d+: No text layer/g) || []).length;
  if (noTextPages > 0) {
    issues.push({
      id: uid(),
      title: `${noTextPages} page(s) missing text layer`,
      description: 'Some PDF pages are image-only and couldn\'t be read directly. OCR was attempted but may not capture everything.',
      severity: 'warning',
      suggestion: 'For best results, use a PDF with selectable text. If you have the original Word/Excel file, export as PDF with text preservation enabled.',
      autoFixable: false,
    });
  }

  // Check each target for missing results
  for (const target of targets) {
    const result = doc.results.find(r => r.targetId === target.id);
    if (!result || !result.value) {
      // Try to figure out why
      const allLabels = [target.label, ...target.synonyms.split(',').map(s => s.trim()).filter(Boolean)];
      const lowerText = doc.text.toLowerCase();
      const anyLabelFound = allLabels.some(l => lowerText.includes(l.toLowerCase()));

      if (!anyLabelFound) {
        issues.push({
          id: uid(),
          title: `Label not found: "${target.label}"`,
          description: `None of the labels/synonyms [${allLabels.join(', ')}] were found in the document text.`,
          severity: 'warning',
          suggestion: `Add more synonyms that match how this field appears in your document. Check the raw text (Debug mode) to see exact wording used in the document.`,
          autoFixable: false,
        });
      } else {
        issues.push({
          id: uid(),
          title: `Label found but no value: "${target.label}"`,
          description: `The label was found in the text, but no matching ${target.type} value was detected nearby.`,
          severity: 'info',
          suggestion: `The value might be on a different line or in an unexpected format. Try switching the type (e.g., from "money" to "text") or check if the value uses an unusual format.`,
          autoFixable: false,
        });
      }
    } else if (result.confidence < 40) {
      issues.push({
        id: uid(),
        title: `Low confidence: "${target.label}" (${result.confidence}%)`,
        description: `The extracted value "${result.value}" has low confidence. It might be incorrect.`,
        severity: 'info',
        suggestion: 'Review the extracted value and alternatives. Add more specific synonyms or adjust the extraction type for better matching.',
        autoFixable: false,
      });
    }
  }

  // Check for common formatting issues
  const lines = doc.text.split('\n');
  const veryLongLines = lines.filter(l => l.length > 500).length;
  if (veryLongLines > 3) {
    issues.push({
      id: uid(),
      title: 'Unusual text formatting detected',
      description: `${veryLongLines} lines are extremely long (500+ chars). The document layout may not be parsing correctly.`,
      severity: 'info',
      suggestion: 'This can happen with multi-column layouts. Try uploading individual pages as images for better OCR text flow.',
      autoFixable: false,
    });
  }

  if (issues.length === 0) {
    issues.push({
      id: uid(),
      title: 'No issues detected',
      description: 'Document parsing appears to be working correctly. All targets have values.',
      severity: 'info',
      suggestion: 'If results still look wrong, try enabling Debug mode for detailed extraction logs, or add more synonyms to your targets.',
      autoFixable: false,
    });
  }

  return issues;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

const TARGETS_KEY = 'kv-extract-targets-v4';
const TEXT_CACHE_KEY = 'kv-extract-text-cache-v4';
const CORRECTIONS_KEY = 'kv-extract-corrections-v4';

function loadTargets(): ExtractionTarget[] {
  try { const r = localStorage.getItem(TARGETS_KEY); if (r) return JSON.parse(r); } catch { }
  return [
    { id: uid(), label: 'Total Invoice Amount', synonyms: 'Invoice Total, Total due, Balance due, Amount due, Grand total', type: 'money', currency: 'Any' },
    { id: uid(), label: 'Invoice Date', synonyms: 'Date, Issue date, Date of issue, Dated', type: 'date', currency: 'Any' },
    { id: uid(), label: 'Invoice Number', synonyms: 'Invoice #, Invoice no, Inv no, Reference', type: 'text', currency: 'Any' },
  ];
}
function saveTargets(t: ExtractionTarget[]) { localStorage.setItem(TARGETS_KEY, JSON.stringify(t)); }
function loadTextCache(): Record<string, string> { try { const r = localStorage.getItem(TEXT_CACHE_KEY); if (r) return JSON.parse(r); } catch { } return {}; }
function saveTextCache(c: Record<string, string>) { localStorage.setItem(TEXT_CACHE_KEY, JSON.stringify(c)); }
function loadCorrections(): CorrectionEntry[] { try { const r = localStorage.getItem(CORRECTIONS_KEY); if (r) return JSON.parse(r); } catch { } return []; }
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
  helpCircle: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>)),
  tool: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>)),
  bookOpen: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>)),
  chevRight: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>)),
  info: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>)),
  shield: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>)),
  terminal: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>)),
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
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
});

// ─── How-To Mode Panel ───────────────────────────────────────────────────────

interface HowToStep {
  number: number;
  title: string;
  description: string;
  icon: keyof typeof Icons;
  tip?: string;
}

const howToSteps: HowToStep[] = [
  {
    number: 1,
    title: 'Configure Extraction Targets',
    description: 'In the left panel, define what data you want to extract. Each target needs a label (e.g., "Invoice Total"), a type (money, date, text, number, percent), and optional synonyms — alternative names the field might appear as in your documents.',
    icon: 'target',
    tip: 'Add multiple synonyms separated by commas. For example, for "Invoice Total" add: "Total due, Balance due, Amount due, Grand total". The more synonyms you add, the better the matching.',
  },
  {
    number: 2,
    title: 'Upload Documents',
    description: 'Drag and drop PDF files or images (PNG, JPG) into the upload area, or click to browse. You can upload multiple files at once. PDFs with selectable text work best; scanned PDFs and images will use OCR (optical character recognition) automatically.',
    icon: 'upload',
    tip: 'For best OCR results, use high-resolution scans (300 DPI+), ensure text is horizontal, and minimize background noise/watermarks.',
  },
  {
    number: 3,
    title: 'Review Extracted Results',
    description: 'Each document card shows extracted values with confidence scores. Green (70%+) means high confidence, amber (40-69%) means moderate, and red (<40%) means low confidence. Click a card to expand and see full details, evidence text, and alternative candidates.',
    icon: 'search',
    tip: 'Click on any extracted value to manually edit it. Click alternative candidates to swap them in as the primary value.',
  },
  {
    number: 4,
    title: 'Use Debug Mode for Transparency',
    description: 'Toggle Debug mode (the bug icon in the header) to see detailed extraction reasoning — which labels were found, how values were scored, and why a particular match was chosen. This is invaluable for understanding and improving extraction accuracy.',
    icon: 'bug',
    tip: 'Debug mode shows the full scoring breakdown for each target. Use this to understand why a value has low confidence and how to fix it.',
  },
  {
    number: 5,
    title: 'Troubleshoot Problem Documents',
    description: 'If a document doesn\'t parse correctly or values are missing, use the Troubleshoot mode (wrench icon in the header). It analyzes each document and provides specific, actionable suggestions for fixing extraction issues.',
    icon: 'tool',
    tip: 'Common fixes: add more synonyms, switch target types, ensure PDFs have text layers, and use high-quality scans for OCR.',
  },
  {
    number: 6,
    title: 'Export Your Results',
    description: 'Once you\'re satisfied with the extracted data, use the Export button to download results as JSON, or the Copy button to copy to clipboard. All completed documents are included in the export.',
    icon: 'download',
    tip: 'You can also use Re-extract to reprocess all documents after changing targets or synonyms — no need to re-upload.',
  },
];

const HowToPanel = memo(function HowToPanel({ onClose }: { onClose: () => void }) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 720, maxHeight: '90vh',
          background: T.bg.elevated,
          borderRadius: 20,
          border: `1px solid ${T.border.default}`,
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.6)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${T.border.subtle}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: `linear-gradient(135deg, ${T.accent.indigoBg}, ${T.accent.cyanBg})`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: `linear-gradient(135deg, ${T.accent.indigo}, ${T.accent.cyan})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 16px ${T.accent.indigoBg}`,
            }}>
              <Icons.bookOpen style={{ width: 20, height: 20, color: '#fff' }} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: T.text.primary, letterSpacing: '-0.3px' }}>How to Use Document Extractor</h2>
              <p style={{ fontSize: 12, color: T.text.tertiary, margin: '2px 0 0' }}>Step-by-step setup & usage guide</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border.subtle}`, borderRadius: 8, color: T.text.secondary, cursor: 'pointer', padding: 6, display: 'flex' }}>
            <Icons.x style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Quick Overview Info Box */}
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.border.subtle}` }}>
          <div style={{
            padding: '14px 16px', borderRadius: 12,
            background: T.accent.indigoBg,
            border: `1px solid ${T.accent.indigoBorder}`,
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <Icons.info style={{ width: 18, height: 18, color: T.accent.indigo, flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: T.accent.indigo, margin: 0 }}>Quick Overview</p>
              <p style={{ fontSize: 11, color: T.text.secondary, margin: '4px 0 0', lineHeight: 1.5 }}>
                This tool extracts structured data (amounts, dates, text) from PDF documents and images using intelligent pattern matching.
                Define what you're looking for → upload documents → get extracted values with confidence scores. No API keys or cloud services needed — everything runs in your browser.
              </p>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 24px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {howToSteps.map((step) => {
              const IconComp = Icons[step.icon];
              const isExpanded = expandedStep === step.number;
              return (
                <motion.div
                  key={step.number}
                  layout
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${isExpanded ? T.accent.indigoBorder : T.border.subtle}`,
                    background: isExpanded ? T.accent.indigoBg : 'rgba(255,255,255,0.015)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                  onClick={() => setExpandedStep(isExpanded ? null : step.number)}
                >
                  <div style={{
                    padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9,
                      background: isExpanded ? T.accent.indigo : 'rgba(255,255,255,0.05)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'background 0.2s',
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: isExpanded ? '#fff' : T.text.tertiary }}>
                        {step.number}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconComp style={{ width: 14, height: 14, color: isExpanded ? T.accent.indigo : T.text.muted }} />
                        <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: T.text.primary }}>{step.title}</p>
                      </div>
                    </div>
                    <Icons.chevDown style={{
                      width: 16, height: 16, color: T.text.muted, flexShrink: 0,
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                      transition: 'transform 0.2s',
                    }} />
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ padding: '0 16px 14px', paddingLeft: 60 }}>
                          <p style={{ fontSize: 12, color: T.text.secondary, margin: 0, lineHeight: 1.6 }}>
                            {step.description}
                          </p>
                          {step.tip && (
                            <div style={{
                              marginTop: 10, padding: '10px 12px', borderRadius: 8,
                              background: T.accent.greenBg,
                              border: `1px solid ${T.accent.greenBorder}`,
                              display: 'flex', gap: 8, alignItems: 'flex-start',
                            }}>
                              <Icons.zap style={{ width: 14, height: 14, color: T.accent.green, flexShrink: 0, marginTop: 1 }} />
                              <p style={{ fontSize: 11, color: T.accent.green, margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                                <strong>Pro Tip:</strong> {step.tip}
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

         
          {/* Keyboard Shortcuts */}
          <div style={{
            marginTop: 12, padding: '14px 16px', borderRadius: 12,
            background: 'rgba(255,255,255,0.015)',
            border: `1px solid ${T.border.subtle}`,
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: T.text.primary, margin: '0 0 8px' }}>
              <Icons.terminal style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 6, color: T.accent.cyan }} />
              Quick Actions
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                ['Click value', 'Edit inline'],
                ['Click alternative', 'Swap to primary'],
                ['Click card header', 'Expand/collapse'],
                ['Eye icon', 'Preview document'],
              ].map(([key, desc]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                    background: 'rgba(255,255,255,0.06)', color: T.text.secondary, whiteSpace: 'nowrap',
                  }}>
                    {key}
                  </span>
                  <span style={{ fontSize: 10, color: T.text.muted }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});

// ─── Troubleshoot Panel ──────────────────────────────────────────────────────

const TroubleshootPanel = memo(function TroubleshootPanel({
  docs, targets, onClose, addToast,
}: {
  docs: DocEntry[];
  targets: ExtractionTarget[];
  onClose: () => void;
  addToast: (msg: string, type: ToastItem['type']) => void;
}) {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [issues, setIssues] = useState<TroubleshootIssue[]>([]);
  const [showRawText, setShowRawText] = useState(false);

  const doneDocs = docs.filter(d => d.status === 'done' || d.status === 'error');
  const selectedDoc = doneDocs.find(d => d.id === selectedDocId) || null;

  useEffect(() => {
    if (selectedDoc) {
      const diag = diagnoseParsing(selectedDoc, targets);
      setIssues(diag);
    } else {
      setIssues([]);
    }
  }, [selectedDocId, selectedDoc, targets]);

  const severityColor = (s: TroubleshootIssue['severity']) => {
    switch (s) {
      case 'critical': return T.accent.rose;
      case 'warning': return T.accent.amber;
      case 'info': return T.accent.cyan;
    }
  };
  const severityBg = (s: TroubleshootIssue['severity']) => {
    switch (s) {
      case 'critical': return T.accent.roseBg;
      case 'warning': return T.accent.amberBg;
      case 'info': return T.accent.cyanBg;
    }
  };
  const severityBorder = (s: TroubleshootIssue['severity']) => {
    switch (s) {
      case 'critical': return T.accent.roseBorder;
      case 'warning': return T.accent.amberBorder;
      case 'info': return T.accent.cyanBorder;
    }
  };
  const severityIcon = (s: TroubleshootIssue['severity']) => {
    switch (s) {
      case 'critical': return <Icons.alertCircle style={{ width: 16, height: 16, color: severityColor(s), flexShrink: 0 }} />;
      case 'warning': return <Icons.alertCircle style={{ width: 16, height: 16, color: severityColor(s), flexShrink: 0 }} />;
      case 'info': return <Icons.info style={{ width: 16, height: 16, color: severityColor(s), flexShrink: 0 }} />;
    }
  };

  const copyRawText = () => {
    if (selectedDoc?.text) {
      navigator.clipboard.writeText(selectedDoc.text)
        .then(() => addToast('Raw text copied to clipboard', 'success'))
        .catch(() => addToast('Failed to copy', 'error'));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 800, maxHeight: '90vh',
          background: T.bg.elevated,
          borderRadius: 20,
          border: `1px solid ${T.border.default}`,
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.6)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${T.border.subtle}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: `linear-gradient(135deg, ${T.accent.amberBg}, ${T.accent.roseBg})`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: `linear-gradient(135deg, ${T.accent.amber}, ${T.accent.rose})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 16px ${T.accent.amberBg}`,
            }}>
              <Icons.tool style={{ width: 20, height: 20, color: '#fff' }} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: T.text.primary, letterSpacing: '-0.3px' }}>Troubleshoot Extraction</h2>
              <p style={{ fontSize: 12, color: T.text.tertiary, margin: '2px 0 0' }}>Diagnose & fix document parsing issues</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border.subtle}`, borderRadius: 8, color: T.text.secondary, cursor: 'pointer', padding: 6, display: 'flex' }}>
            <Icons.x style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {doneDocs.length === 0 ? (
            <div style={{
              padding: 48, textAlign: 'center',
              borderRadius: 14, border: `1px solid ${T.border.subtle}`,
              background: 'rgba(255,255,255,0.015)',
            }}>
              <Icons.fileText style={{ width: 40, height: 40, color: T.text.muted, margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: T.text.secondary, margin: 0 }}>No processed documents</p>
              <p style={{ fontSize: 12, color: T.text.muted, margin: '6px 0 0' }}>Upload and process documents first, then come back here to troubleshoot.</p>
            </div>
          ) : (
            <>
              {/* Document Selector */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: T.text.tertiary, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Select document to diagnose
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {doneDocs.map(d => {
                    const isSelected = d.id === selectedDocId;
                    const hasErrors = d.status === 'error';
                    const missingValues = d.results.filter(r => !r.value).length;
                    const lowConf = d.results.filter(r => r.value && r.confidence < 40).length;

                    return (
                      <motion.button
                        key={d.id}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setSelectedDocId(isSelected ? null : d.id)}
                        style={{
                          padding: '8px 14px', borderRadius: 10,
                          border: `1px solid ${isSelected ? T.accent.amberBorder : hasErrors ? T.accent.roseBorder : T.border.subtle}`,
                          background: isSelected ? T.accent.amberBg : hasErrors ? T.accent.roseBg : 'rgba(255,255,255,0.02)',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 8,
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        {hasErrors
                          ? <Icons.alertCircle style={{ width: 14, height: 14, color: T.accent.rose }} />
                          : <Icons.fileText style={{ width: 14, height: 14, color: isSelected ? T.accent.amber : T.text.muted }} />
                        }
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          color: isSelected ? T.accent.amber : T.text.secondary,
                          maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {d.file.name}
                        </span>
                        {(missingValues > 0 || lowConf > 0) && !hasErrors && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                            background: missingValues > 0 ? T.accent.roseBg : T.accent.amberBg,
                            color: missingValues > 0 ? T.accent.rose : T.accent.amber,
                            border: `1px solid ${missingValues > 0 ? T.accent.roseBorder : T.accent.amberBorder}`,
                          }}>
                            {missingValues > 0 ? `${missingValues} missing` : `${lowConf} low`}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Diagnosis Results */}
              {selectedDoc && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Stats bar */}
                  <div style={{
                    padding: '12px 16px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.015)',
                    border: `1px solid ${T.border.subtle}`,
                    display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center',
                  }}>
                    <div>
                      <span style={{ fontSize: 10, color: T.text.muted }}>Text Length</span>
                      <p style={{ fontSize: 13, fontWeight: 700, margin: '2px 0 0', color: T.text.primary }}>{selectedDoc.text.length.toLocaleString()} chars</p>
                    </div>
                    <div style={{ width: 1, height: 28, background: T.border.subtle }} />
                    <div>
                      <span style={{ fontSize: 10, color: T.text.muted }}>Lines</span>
                      <p style={{ fontSize: 13, fontWeight: 700, margin: '2px 0 0', color: T.text.primary }}>{selectedDoc.text.split('\n').filter(l => l.trim()).length}</p>
                    </div>
                    <div style={{ width: 1, height: 28, background: T.border.subtle }} />
                    <div>
                      <span style={{ fontSize: 10, color: T.text.muted }}>Results</span>
                      <p style={{ fontSize: 13, fontWeight: 700, margin: '2px 0 0', color: T.text.primary }}>
                        {selectedDoc.results.filter(r => r.value).length}/{selectedDoc.results.length}
                      </p>
                    </div>
                    <div style={{ flex: 1 }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowRawText(!showRawText)}
                        style={{
                          padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                          background: showRawText ? T.accent.cyanBg : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${showRawText ? T.accent.cyanBorder : T.border.subtle}`,
                          color: showRawText ? T.accent.cyan : T.text.secondary,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        <Icons.eye style={{ width: 12, height: 12 }} />
                        Raw Text
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={copyRawText}
                        style={{
                          padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                          background: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${T.border.subtle}`,
                          color: T.text.secondary,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        <Icons.copy style={{ width: 12, height: 12 }} />
                        Copy Text
                      </motion.button>
                    </div>
                  </div>

                  {/* Raw text viewer */}
                  <AnimatePresence>
                    {showRawText && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{
                          padding: 14, borderRadius: 12,
                          background: T.bg.primary,
                          border: `1px solid ${T.border.subtle}`,
                          maxHeight: 250, overflow: 'auto',
                        }}>
                          <pre style={{
                            fontSize: 10, color: T.text.secondary, margin: 0,
                            fontFamily: "'Courier New', monospace",
                            lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                          }}>
                            {selectedDoc.text || '(empty)'}
                          </pre>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Issues */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: T.text.tertiary, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Diagnostic Results ({issues.length} issue{issues.length !== 1 ? 's' : ''})
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {issues.map(issue => (
                        <div
                          key={issue.id}
                          style={{
                            padding: '14px 16px', borderRadius: 12,
                            background: severityBg(issue.severity),
                            border: `1px solid ${severityBorder(issue.severity)}`,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            {severityIcon(issue.severity)}
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: T.text.primary }}>{issue.title}</p>
                                <span style={{
                                  fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                                  background: 'rgba(0,0,0,0.2)', color: severityColor(issue.severity),
                                  textTransform: 'uppercase', letterSpacing: '0.5px',
                                }}>
                                  {issue.severity}
                                </span>
                              </div>
                              <p style={{ fontSize: 11, color: T.text.secondary, margin: '0 0 8px', lineHeight: 1.5 }}>
                                {issue.description}
                              </p>
                              <div style={{
                                padding: '8px 10px', borderRadius: 8,
                                background: 'rgba(0,0,0,0.15)',
                                border: `1px solid rgba(255,255,255,0.03)`,
                              }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                  <Icons.zap style={{ width: 12, height: 12, color: T.accent.green, flexShrink: 0, marginTop: 2 }} />
                                  <p style={{ fontSize: 11, color: T.accent.green, margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                                    <strong>Fix:</strong> {issue.suggestion}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick checklist */}
                  <div style={{
                    marginTop: 8, padding: '14px 16px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.015)',
                    border: `1px solid ${T.border.subtle}`,
                  }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: T.text.primary, margin: '0 0 10px' }}>
                      ✅ Quick Troubleshooting Checklist
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[
                        { check: selectedDoc.text.length > 100, label: 'Document has extractable text' },
                        { check: selectedDoc.results.some(r => r.value), label: 'At least one value was found' },
                        { check: !selectedDoc.text.includes('[No text layer'), label: 'All pages have text layers' },
                        { check: selectedDoc.results.every(r => r.confidence >= 40 || !r.value), label: 'All found values have decent confidence' },
                        { check: targets.every(t => t.synonyms.split(',').filter(s => s.trim()).length >= 2), label: 'All targets have 2+ synonyms' },
                      ].map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: 5,
                            background: item.check ? T.accent.greenBg : T.accent.roseBg,
                            border: `1px solid ${item.check ? T.accent.greenBorder : T.accent.roseBorder}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            {item.check
                              ? <Icons.check style={{ width: 10, height: 10, color: T.accent.green }} />
                              : <Icons.x style={{ width: 10, height: 10, color: T.accent.rose }} />
                            }
                          </div>
                          <span style={{ fontSize: 11, color: item.check ? T.text.secondary : T.accent.rose, fontWeight: item.check ? 400 : 600 }}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
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
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.text.tertiary, minWidth: 90 }}>
                        {r.targetLabel}
                      </span>

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

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                          <div style={{ width: `${r.confidence}%`, height: '100%', borderRadius: 2, background: confColor(r.confidence), transition: 'width 0.5s' }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: confColor(r.confidence), minWidth: 26, textAlign: 'right' }}>
                          {r.confidence}%
                        </span>
                      </div>
                    </div>

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

function DocumentProcessor() {
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewDoc, setPreviewDoc] = useState<DocEntry | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

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

  const addToast = useCallback((message: string, type: ToastItem['type'] = 'success') => {
    const id = uid();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);
  const removeToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const processDoc = useCallback(async (docId: string) => {
    let doc = docs.find(d => d.id === docId);
    if (!doc || doc.status !== 'queued') return;

    setDocs(prev => prev.map(d => d.id === docId ? { ...d, status: 'parsing', progress: 0, progressMsg: 'Starting...' } : d));

    try {
      const hash = fileHash(doc.file);
      let text = textCacheRef.current[hash];

      if (!text) {
        text = await extractTextFromFile(doc.file, (p, msg) => {
          setDocs(prev => prev.map(d => d.id === docId ? { ...d, progress: p, progressMsg: msg } : d));
        });
        textCacheRef.current[hash] = text;
        saveTextCache(textCacheRef.current);
      }

      setDocs(prev => prev.map(d => d.id === docId ? { ...d, status: 'extracting', progress: 95, progressMsg: 'Extracting values...' } : d));

      const results = extractValues(text, targets, corrections, debugMode);

      setDocs(prev => prev.map(d => d.id === docId ? {
        ...d,
        status: 'done',
        progress: 100,
        progressMsg: 'Complete',
        text,
        results,
        error: null,
      } : d));

    } catch (err: any) {
      console.error('Processing error:', err);
      setDocs(prev => prev.map(d => d.id === docId ? {
        ...d,
        status: 'error',
        progress: 0,
        progressMsg: '',
        error: err.message || 'Unknown error occurred',
      } : d));
    }
  }, [docs, targets, corrections, debugMode]);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    while (queueRef.current.length > 0) {
      const docId = queueRef.current.shift()!;
      await processDoc(docId);
    }

    processingRef.current = false;
  }, [processDoc]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(f =>
      f.type === 'application/pdf' || f.type.startsWith('image/')
    );

    if (validFiles.length === 0) {
      addToast('Please upload PDF or image files', 'error');
      return;
    }

    const newDocs: DocEntry[] = validFiles.map(file => ({
      id: uid(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'queued',
      progress: 0,
      progressMsg: '',
      text: '',
      results: [],
      error: null,
      expanded: false,
    }));

    setDocs(prev => [...prev, ...newDocs]);
    queueRef.current.push(...newDocs.map(d => d.id));
    addToast(`${validFiles.length} file${validFiles.length > 1 ? 's' : ''} added`, 'info');

    setTimeout(() => processQueue(), 50);
  }, [addToast, processQueue]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  }, [addFiles]);

  const removeDoc = useCallback((id: string) => {
    setDocs(prev => {
      const doc = prev.find(d => d.id === id);
      if (doc?.previewUrl) URL.revokeObjectURL(doc.previewUrl);
      return prev.filter(d => d.id !== id);
    });
    queueRef.current = queueRef.current.filter(qId => qId !== id);
  }, []);

  const updateDoc = useCallback((id: string, updates: Partial<DocEntry>) => {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  }, []);

  const retryDoc = useCallback((id: string) => {
    setDocs(prev => prev.map(d => d.id === id ? {
      ...d,
      status: 'queued',
      progress: 0,
      progressMsg: '',
      error: null,
    } : d));
    queueRef.current.push(id);
    setTimeout(() => processQueue(), 50);
  }, [processQueue]);

  const reExtractAll = useCallback(() => {
    const doneDocs = docs.filter(d => d.status === 'done' && d.text);
    if (doneDocs.length === 0) {
      addToast('No processed documents to re-extract', 'info');
      return;
    }

    setDocs(prev => prev.map(d => {
      if (d.status === 'done' && d.text) {
        const results = extractValues(d.text, targets, corrections, debugMode);
        return { ...d, results };
      }
      return d;
    }));

    addToast(`Re-extracted ${doneDocs.length} document${doneDocs.length > 1 ? 's' : ''}`, 'success');
  }, [docs, targets, corrections, debugMode, addToast]);

  const addTarget = useCallback(() => {
    if (!newTarget.label.trim()) {
      addToast('Label is required', 'error');
      return;
    }
    const target: ExtractionTarget = { ...newTarget, id: uid() };
    setTargets(prev => [...prev, target]);
    setNewTarget({ label: '', synonyms: '', type: 'money', currency: 'Any' });
    setShowAddTarget(false);
    addToast(`Target "${target.label}" added`, 'success');
  }, [newTarget, addToast]);

  const updateTarget = useCallback((id: string, updates: Partial<ExtractionTarget>) => {
    setTargets(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const deleteTarget = useCallback((id: string) => {
    setTargets(prev => prev.filter(t => t.id !== id));
    setEditingTargetId(null);
    addToast('Target deleted', 'info');
  }, [addToast]);

  const exportResults = useCallback(() => {
    const doneDocs = docs.filter(d => d.status === 'done');
    if (doneDocs.length === 0) {
      addToast('No completed documents to export', 'error');
      return;
    }

    const exportData = doneDocs.map(d => ({
      filename: d.file.name,
      fileSize: d.file.size,
      extractedAt: new Date().toISOString(),
      results: Object.fromEntries(d.results.map(r => [r.targetLabel, {
        value: r.value,
        confidence: r.confidence,
        evidence: r.evidence,
      }])),
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extraction-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    addToast(`Exported ${doneDocs.length} document${doneDocs.length > 1 ? 's' : ''}`, 'success');
  }, [docs, addToast]);

  const copyResults = useCallback(() => {
    const doneDocs = docs.filter(d => d.status === 'done');
    if (doneDocs.length === 0) {
      addToast('No completed documents to copy', 'error');
      return;
    }

    const lines = doneDocs.flatMap(d => [
      `📄 ${d.file.name}`,
      ...d.results.map(r => `   ${r.targetLabel}: ${r.value || '—'} (${r.confidence}%)`),
      '',
    ]);

    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => addToast('Results copied to clipboard', 'success'))
      .catch(() => addToast('Failed to copy', 'error'));
  }, [docs, addToast]);

  const clearAll = useCallback(() => {
    docs.forEach(d => { if (d.previewUrl) URL.revokeObjectURL(d.previewUrl); });
    setDocs([]);
    queueRef.current = [];
    addToast('All documents cleared', 'info');
  }, [docs, addToast]);

  const doneCount = docs.filter(d => d.status === 'done').length;
  const processingCount = docs.filter(d => d.status === 'parsing' || d.status === 'extracting' || d.status === 'queued').length;
  const errorCount = docs.filter(d => d.status === 'error').length;

  return (
    <>
      <style>{globalCSS}</style>
      <div style={{
        minHeight: '100vh',
        background: T.bg.primary,
        fontFamily: "'Inter', sans-serif",
        color: T.text.primary,
      }}>
        {/* ── Header ── */}
        <header style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${T.border.subtle}`,
          background: T.bg.secondary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: `linear-gradient(135deg, ${T.accent.indigo}, ${T.accent.cyan})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 16px ${T.accent.indigoBg}`,
            }}>
              <Icons.brain style={{ width: 20, height: 20, color: '#fff' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>Document Extractor</h1>
              <p style={{ fontSize: 11, color: T.text.tertiary, margin: 0 }}>Intelligent PDF & Image Data Extraction</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Stats badges */}
            {docs.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginRight: 8 }}>
                {processingCount > 0 && (
                  <span style={{
                    padding: '4px 10px', borderRadius: 8,
                    background: T.accent.indigoBg, border: `1px solid ${T.accent.indigoBorder}`,
                    fontSize: 11, fontWeight: 600, color: T.accent.indigo,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent.indigo, animation: 'pulse 1.5s infinite' }} />
                    {processingCount} processing
                  </span>
                )}
                {doneCount > 0 && (
                  <span style={{
                    padding: '4px 10px', borderRadius: 8,
                    background: T.accent.greenBg, border: `1px solid ${T.accent.greenBorder}`,
                    fontSize: 11, fontWeight: 600, color: T.accent.green,
                  }}>
                    {doneCount} complete
                  </span>
                )}
                {errorCount > 0 && (
                  <span style={{
                    padding: '4px 10px', borderRadius: 8,
                    background: T.accent.roseBg, border: `1px solid ${T.accent.roseBorder}`,
                    fontSize: 11, fontWeight: 600, color: T.accent.rose,
                  }}>
                    {errorCount} error{errorCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}

            {/* Action buttons */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowHowTo(true)}
              style={{
                width: 34, height: 34, borderRadius: 9,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${T.border.subtle}`,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: T.text.secondary,
              }}
              title="How to use"
            >
              <Icons.helpCircle style={{ width: 16, height: 16 }} />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowTroubleshoot(true)}
              style={{
                width: 34, height: 34, borderRadius: 9,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${T.border.subtle}`,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: T.text.secondary,
              }}
              title="Troubleshoot"
            >
              <Icons.tool style={{ width: 16, height: 16 }} />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setDebugMode(!debugMode)}
              style={{
                width: 34, height: 34, borderRadius: 9,
                background: debugMode ? T.accent.amberBg : 'rgba(255,255,255,0.03)',
                border: `1px solid ${debugMode ? T.accent.amberBorder : T.border.subtle}`,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: debugMode ? T.accent.amber : T.text.secondary,
              }}
              title="Debug mode"
            >
              <Icons.bug style={{ width: 16, height: 16 }} />
            </motion.button>

            <div style={{ width: 1, height: 24, background: T.border.subtle, margin: '0 4px' }} />

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={reExtractAll}
              disabled={doneCount === 0}
              style={{
                padding: '8px 14px', borderRadius: 9,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${T.border.subtle}`,
                cursor: doneCount === 0 ? 'not-allowed' : 'pointer',
                opacity: doneCount === 0 ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: 6,
                color: T.text.secondary,
                fontSize: 12, fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
              }}
              title="Re-extract all"
            >
              <Icons.refresh style={{ width: 14, height: 14 }} />
              Re-extract
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={copyResults}
              disabled={doneCount === 0}
              style={{
                padding: '8px 14px', borderRadius: 9,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${T.border.subtle}`,
                cursor: doneCount === 0 ? 'not-allowed' : 'pointer',
                opacity: doneCount === 0 ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: 6,
                color: T.text.secondary,
                fontSize: 12, fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
              }}
              title="Copy results"
            >
              <Icons.copy style={{ width: 14, height: 14 }} />
              Copy
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={exportResults}
              disabled={doneCount === 0}
              style={{
                padding: '8px 14px', borderRadius: 9,
                background: T.accent.indigoBg,
                border: `1px solid ${T.accent.indigoBorder}`,
                cursor: doneCount === 0 ? 'not-allowed' : 'pointer',
                opacity: doneCount === 0 ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: 6,
                color: T.accent.indigo,
                fontSize: 12, fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
              }}
              title="Export JSON"
            >
              <Icons.download style={{ width: 14, height: 14 }} />
              Export
            </motion.button>
          </div>
        </header>

        {/* ── Main content ── */}
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 73px)' }}>
          {/* ── Left Sidebar: Extraction Targets ── */}
          <aside style={{
            width: 320,
            borderRight: `1px solid ${T.border.subtle}`,
            background: T.bg.secondary,
            padding: '20px 16px',
            overflowY: 'auto',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icons.target style={{ width: 16, height: 16, color: T.accent.indigo }} />
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Extraction Targets</h2>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAddTarget(!showAddTarget)}
                style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: showAddTarget ? T.accent.indigoBg : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${showAddTarget ? T.accent.indigoBorder : T.border.subtle}`,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: showAddTarget ? T.accent.indigo : T.text.secondary,
                }}
              >
                <Icons.plus style={{ width: 14, height: 14, transform: showAddTarget ? 'rotate(45deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
              </motion.button>
            </div>

            {/* Add target form */}
            <AnimatePresence>
              {showAddTarget && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: 'hidden', marginBottom: 12 }}
                >
                  <div style={{
                    padding: 14, borderRadius: 12,
                    background: T.accent.indigoBg,
                    border: `1px solid ${T.accent.indigoBorder}`,
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}>
                    <input
                      placeholder="Label (e.g., Invoice Total)"
                      value={newTarget.label}
                      onChange={e => setNewTarget(prev => ({ ...prev, label: e.target.value }))}
                      style={{
                        padding: '8px 12px', borderRadius: 8,
                        border: `1px solid ${T.border.subtle}`,
                        background: T.bg.elevated, color: T.text.primary,
                        fontSize: 12, outline: 'none',
                        fontFamily: "'Inter', sans-serif",
                      }}
                    />
                    <input
                      placeholder="Synonyms (comma-separated)"
                      value={newTarget.synonyms}
                      onChange={e => setNewTarget(prev => ({ ...prev, synonyms: e.target.value }))}
                      style={{
                        padding: '8px 12px', borderRadius: 8,
                        border: `1px solid ${T.border.subtle}`,
                        background: T.bg.elevated, color: T.text.primary,
                        fontSize: 12, outline: 'none',
                        fontFamily: "'Inter', sans-serif",
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        value={newTarget.type}
                        onChange={e => setNewTarget(prev => ({ ...prev, type: e.target.value as TargetType }))}
                        style={{
                          flex: 1, padding: '8px 12px', borderRadius: 8,
                          border: `1px solid ${T.border.subtle}`,
                          background: T.bg.elevated, color: T.text.primary,
                          fontSize: 12, outline: 'none', cursor: 'pointer',
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        <option value="money">Money</option>
                        <option value="date">Date</option>
                        <option value="number">Number</option>
                        <option value="percent">Percent</option>
                        <option value="text">Text</option>
                      </select>
                      {newTarget.type === 'money' && (
                        <select
                          value={newTarget.currency}
                          onChange={e => setNewTarget(prev => ({ ...prev, currency: e.target.value as CurrencyPref }))}
                          style={{
                            width: 80, padding: '8px', borderRadius: 8,
                            border: `1px solid ${T.border.subtle}`,
                            background: T.bg.elevated, color: T.text.primary,
                            fontSize: 12, outline: 'none', cursor: 'pointer',
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          <option value="Any">Any</option>
                          <option value="GBP">£ GBP</option>
                          <option value="USD">$ USD</option>
                          <option value="EUR">€ EUR</option>
                        </select>
                      )}
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={addTarget}
                      style={{
                        padding: '10px', borderRadius: 8,
                        background: T.accent.indigo, border: 'none',
                        color: '#fff', fontSize: 12, fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      Add Target
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Target list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <AnimatePresence>
                {targets.map(target => {
                  const isEditing = editingTargetId === target.id;
                  return (
                    <motion.div
                      key={target.id}
                      layout
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                      style={{
                        borderRadius: 12,
                        border: `1px solid ${isEditing ? T.accent.indigoBorder : T.border.subtle}`,
                        background: isEditing ? T.accent.indigoBg : 'rgba(255,255,255,0.015)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        onClick={() => setEditingTargetId(isEditing ? null : target.id)}
                        style={{
                          padding: '12px 14px',
                          display: 'flex', alignItems: 'center', gap: 10,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: target.type === 'money' ? T.accent.greenBg
                            : target.type === 'date' ? T.accent.cyanBg
                            : target.type === 'percent' ? T.accent.amberBg
                            : T.accent.indigoBg,
                          border: `1px solid ${target.type === 'money' ? T.accent.greenBorder
                            : target.type === 'date' ? T.accent.cyanBorder
                            : target.type === 'percent' ? T.accent.amberBorder
                            : T.accent.indigoBorder}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <span style={{
                            fontSize: 11, fontWeight: 800,
                            color: target.type === 'money' ? T.accent.green
                              : target.type === 'date' ? T.accent.cyan
                              : target.type === 'percent' ? T.accent.amber
                              : T.accent.indigo,
                          }}>
                            {target.type === 'money' ? '£' : target.type === 'date' ? '📅' : target.type === 'percent' ? '%' : target.type === 'number' ? '#' : 'T'}
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: 12, fontWeight: 600, margin: 0, color: T.text.primary,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {target.label}
                          </p>
                          <p style={{ fontSize: 10, color: T.text.muted, margin: '2px 0 0' }}>
                            {target.type.charAt(0).toUpperCase() + target.type.slice(1)}
                            {target.synonyms ? ` • ${target.synonyms.split(',').length} synonyms` : ''}
                          </p>
                        </div>
                        <Icons.chevRight style={{
                          width: 14, height: 14, color: T.text.muted, flexShrink: 0,
                          transform: isEditing ? 'rotate(90deg)' : 'rotate(0)',
                          transition: 'transform 0.2s',
                        }} />
                      </div>

                      <AnimatePresence>
                        {isEditing && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div style={{
                              padding: '0 14px 14px',
                              display: 'flex', flexDirection: 'column', gap: 8,
                            }}>
                              <input
                                value={target.label}
                                onChange={e => updateTarget(target.id, { label: e.target.value })}
                                placeholder="Label"
                                style={{
                                  padding: '8px 12px', borderRadius: 8,
                                  border: `1px solid ${T.border.subtle}`,
                                  background: T.bg.elevated, color: T.text.primary,
                                  fontSize: 12, outline: 'none',
                                  fontFamily: "'Inter', sans-serif",
                                }}
                              />
                              <input
                                value={target.synonyms}
                                onChange={e => updateTarget(target.id, { synonyms: e.target.value })}
                                placeholder="Synonyms (comma-separated)"
                                style={{
                                  padding: '8px 12px', borderRadius: 8,
                                  border: `1px solid ${T.border.subtle}`,
                                  background: T.bg.elevated, color: T.text.primary,
                                  fontSize: 12, outline: 'none',
                                  fontFamily: "'Inter', sans-serif",
                                }}
                              />
                              <div style={{ display: 'flex', gap: 8 }}>
                                <select
                                  value={target.type}
                                  onChange={e => updateTarget(target.id, { type: e.target.value as TargetType })}
                                  style={{
                                    flex: 1, padding: '8px 12px', borderRadius: 8,
                                    border: `1px solid ${T.border.subtle}`,
                                    background: T.bg.elevated, color: T.text.primary,
                                    fontSize: 12, outline: 'none', cursor: 'pointer',
                                    fontFamily: "'Inter', sans-serif",
                                  }}
                                >
                                  <option value="money">Money</option>
                                  <option value="date">Date</option>
                                  <option value="number">Number</option>
                                  <option value="percent">Percent</option>
                                  <option value="text">Text</option>
                                </select>
                                <motion.button
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => deleteTarget(target.id)}
                                  style={{
                                    width: 36, height: 36, borderRadius: 8,
                                    background: T.accent.roseBg, border: `1px solid ${T.accent.roseBorder}`,
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: T.accent.rose,
                                  }}
                                >
                                  <Icons.trash style={{ width: 14, height: 14 }} />
                                </motion.button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {targets.length === 0 && (
                <div style={{
                  padding: 24, textAlign: 'center',
                  borderRadius: 12, border: `1px dashed ${T.border.subtle}`,
                }}>
                  <Icons.target style={{ width: 24, height: 24, color: T.text.muted, margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 12, color: T.text.muted, margin: 0 }}>No targets defined</p>
                  <p style={{ fontSize: 11, color: T.text.muted, margin: '4px 0 0' }}>Add targets to extract data from documents</p>
                </div>
              )}
            </div>
          </aside>

          {/* ── Main Content Area ── */}
          <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
            {/* Upload zone */}
            <motion.div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              animate={{
                borderColor: dragOver ? T.accent.indigo : T.border.subtle,
                background: dragOver ? T.accent.indigoBg : 'rgba(255,255,255,0.015)',
              }}
              style={{
                padding: 40,
                borderRadius: 16,
                border: `2px dashed ${T.border.subtle}`,
                cursor: 'pointer',
                textAlign: 'center',
                marginBottom: 20,
                transition: 'border-color 0.2s, background 0.2s',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: `linear-gradient(135deg, ${T.accent.indigoBg}, ${T.accent.cyanBg})`,
                border: `1px solid ${T.accent.indigoBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px',
              }}>
                <Icons.upload style={{ width: 24, height: 24, color: T.accent.indigo }} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: T.text.primary, margin: '0 0 4px' }}>
                Drop files or click to upload
              </p>
              <p style={{ fontSize: 12, color: T.text.muted, margin: 0 }}>
                Supports PDF files and images (PNG, JPG, JPEG)
              </p>
            </motion.div>

            {/* Documents list */}
            {docs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icons.layers style={{ width: 16, height: 16, color: T.accent.cyan }} />
                    <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                      Documents ({docs.length})
                    </h2>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={clearAll}
                    style={{
                      padding: '6px 12px', borderRadius: 7,
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${T.border.subtle}`,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5,
                      color: T.text.muted,
                      fontSize: 11, fontWeight: 500,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    <Icons.trash style={{ width: 12, height: 12 }} />
                    Clear all
                  </motion.button>
                </div>

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
                      onPreview={setPreviewDoc}
                      addToast={addToast}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Empty state */}
            {docs.length === 0 && (
              <div style={{
                padding: 60, textAlign: 'center',
                borderRadius: 16,
                border: `1px solid ${T.border.subtle}`,
                background: 'rgba(255,255,255,0.01)',
              }}>
                <Icons.fileText style={{ width: 48, height: 48, color: T.text.muted, margin: '0 auto 16px' }} />
                <p style={{ fontSize: 16, fontWeight: 600, color: T.text.secondary, margin: '0 0 6px' }}>
                  No documents yet
                </p>
                <p style={{ fontSize: 13, color: T.text.muted, margin: 0 }}>
                  Upload PDFs or images to start extracting data
                </p>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowHowTo(true)}
                  style={{
                    marginTop: 16,
                    padding: '10px 20px', borderRadius: 10,
                    background: T.accent.indigoBg,
                    border: `1px solid ${T.accent.indigoBorder}`,
                    cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    color: T.accent.indigo,
                    fontSize: 13, fontWeight: 600,
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  <Icons.helpCircle style={{ width: 16, height: 16 }} />
                  Learn how to use
                </motion.button>
              </div>
            )}
          </main>
        </div>

        {/* ── Modals ── */}
        <AnimatePresence>
          {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
        </AnimatePresence>

        <AnimatePresence>
          {showHowTo && <HowToPanel onClose={() => setShowHowTo(false)} />}
        </AnimatePresence>

        <AnimatePresence>
          {showTroubleshoot && (
            <TroubleshootPanel
              docs={docs}
              targets={targets}
              onClose={() => setShowTroubleshoot(false)}
              addToast={addToast}
            />
          )}
        </AnimatePresence>

        {/* ── Toast notifications ── */}
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    </>
  );
}

export default DocumentProcessor;