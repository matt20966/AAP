import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types (shared with DocumentProcessor) ───────────────────────────────────

// In ReserveProcessor.tsx — add "export" to each type that DocumentProcessorDev.tsx imports

export type TargetType = 'money' | 'date' | 'number' | 'text' | 'percent';
export type CurrencyPref = 'Any' | 'GBP' | 'USD' | 'EUR';

export interface ExtractionTarget {
  id: string;
  label: string;
  synonyms: string;
  type: TargetType;
  currency: CurrencyPref;
}

export interface Candidate {
  value: string;
  rawValue: string;
  score: number;
  confidence: number;
  evidence: string;
  reason: string;
  position: number;
}

export interface ExtractionResult {
  targetId: string;
  targetLabel: string;
  value: string;
  confidence: number;
  evidence: string;
  reason: string;
  alternatives: Candidate[];
  position: number;
}

export interface ReserveResult {
  targetId: string;
  targetLabel: string;
  value: string;
  confidence: number;
  evidence: string;
  reason: string;
  technique: string;
  alternatives: Candidate[];
  position: number;
  improved: boolean;
}

export interface ReserveProcessorJob {
  id: string;
  docId: string;
  fileName: string;
  text: string;
  targets: ExtractionTarget[];
  originalResults: ExtractionResult[];
  status: 'queued' | 'processing' | 'done' | 'failed';
  progress: number;
  progressMsg: string;
  reserveResults: ReserveResult[];
  error: string | null;
  startedAt: number | null;
  completedAt: number | null;
}

// ─── Design Tokens (matching DocumentProcessor) ──────────────────────────────

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
    violet: '#a78bfa',
    violetBg: 'rgba(167,139,250,0.08)',
    violetBorder: 'rgba(167,139,250,0.15)',
    orange: '#fb923c',
    orangeBg: 'rgba(251,146,60,0.08)',
    orangeBorder: 'rgba(251,146,60,0.15)',
  }),
});

// ─── Utility Functions ───────────────────────────────────────────────────────

const uid = (): string =>
  Math.random().toString(36).substring(2, 11) + Date.now().toString(36);

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
  t = t.replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬀ/g, 'ff').replace(/ﬃ/g, 'ffi').replace(/ﬄ/g, 'ffl');
  t = t.replace(/[\u2010-\u2015\u2212]/g, '-');
  t = t.replace(/[\u2018\u2019\u201A\u201B]/g, "'");
  t = t.replace(/[\u201C\u201D\u201E\u201F]/g, '"');
  t = t.replace(/([0-9])O/g, '$10').replace(/O([0-9])/g, '0$1').replace(/([0-9])[lI]/g, '$11');
  t = t.replace(/\t/g, ' ');
  return t;
}

function parseMoneyValue(str: string): number {
  let s = str.replace(/[£$€¥\s]/g, '').replace(/[A-Za-z]/g, '').replace(/[()]/g, '');
  if (/\d{1,3}(?:\.\d{3})+,\d{1,2}/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const val = parseFloat(s);
  return isNaN(val) ? 0 : Math.abs(val);
}

// ─── Technique Registry ──────────────────────────────────────────────────────

const TECHNIQUES: TechniqueInfo[] = [
  { id: 'fuzzy_label', name: 'Fuzzy Label Matching', description: 'Aggressive fuzzy matching with lower similarity thresholds and character transposition tolerance', icon: '🔀' },
  { id: 'context_window', name: 'Context Window Expansion', description: 'Expands search radius to ±10 lines from any label match instead of default ±4', icon: '🔭' },
  { id: 'pattern_relaxation', name: 'Pattern Relaxation', description: 'Relaxes value format constraints — allows partial matches and non-standard formats', icon: '🧩' },
  { id: 'structural_analysis', name: 'Structural Analysis', description: 'Detects table/grid layouts and uses column/row alignment to find values', icon: '📊' },
  { id: 'reverse_lookup', name: 'Reverse Value Lookup', description: 'Finds all values first, then searches backwards for the nearest matching label', icon: '🔄' },
  { id: 'ngram_proximity', name: 'N-Gram Proximity Search', description: 'Breaks labels into character n-grams and scores proximity to candidate values', icon: '🧬' },
  { id: 'multiline_merge', name: 'Multi-Line Merge', description: 'Merges fragmented text across line breaks to reconstruct split labels and values', icon: '🔗' },
  { id: 'ocr_correction', name: 'OCR Error Correction', description: 'Applies common OCR error patterns (0↔O, 1↔l, S↔5) to both labels and values', icon: '🔧' },
];

// ─── Reserve Extraction Techniques ───────────────────────────────────────────

const UNIVERSAL_VALUE_RE =
  /(?:[£$€¥]\s*-?\s*\d[\d,.\s]*\d(?:\.\d{1,2})?|[£$€¥]\s*\d+(?:\.\d{1,2})?|\d[\d,.\s]*\d\s*[£$€¥]|(?:GBP|USD|EUR|CHF)\s*-?\s*\d[\d,.\s]*(?:\.\d{1,2})?|\d[\d,.\s]*(?:\.\d{1,2})?\s*(?:GBP|USD|EUR|CHF)|\d+(?:\.\d+)?\s*%|\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*,?\s*\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}\s*,?\s*\d{2,4}|\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{1,2}|\d+)/gi;

function isValueValidForType(value: string, type: TargetType): boolean {
  const v = value.trim();
  if (!v) return false;
  switch (type) {
    case 'money': {
      if (!/\d/.test(v)) return false;
      const digits = v.replace(/[^0-9]/g, '');
      return digits.length > 0 && !/^0+$/.test(digits);
    }
    case 'number': return /\d/.test(v);
    case 'percent': return /\d/.test(v) && /%/.test(v);
    case 'date': return /\d/.test(v) && (/[/\-.]/.test(v) || /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(v));
    case 'text': return v.length > 0;
    default: return true;
  }
}

function findAllValues(text: string, type: TargetType): Array<{ value: string; index: number }> {
  if (type === 'text') {
    const t = text.replace(/^[\s:=\-–—>|]+/, '').trim();
    if (t && t.length <= 300) return [{ value: t, index: 0 }];
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

// ── OCR correction maps ──

const OCR_CHAR_MAP: Record<string, string[]> = {
  '0': ['O', 'o', 'D', 'Q'],
  'O': ['0'],
  'o': ['0'],
  '1': ['l', 'I', '|', 'i', '!'],
  'l': ['1', 'I', '|'],
  'I': ['1', 'l', '|'],
  '5': ['S', 's'],
  'S': ['5'],
  's': ['5'],
  '8': ['B'],
  'B': ['8'],
  '6': ['G', 'b'],
  'G': ['6'],
  '2': ['Z', 'z'],
  'Z': ['2'],
  'g': ['9', 'q'],
  '9': ['g', 'q'],
  'n': ['m', 'ri'],
  'm': ['rn', 'nn'],
  'rn': ['m'],
  'cl': ['d'],
  'd': ['cl'],
};

function generateOCRVariants(text: string, maxVariants: number = 8): string[] {
  const variants: Set<string> = new Set();
  variants.add(text);

  for (let i = 0; i < text.length && variants.size < maxVariants; i++) {
    const ch = text[i];
    const replacements = OCR_CHAR_MAP[ch];
    if (replacements) {
      for (const rep of replacements) {
        if (variants.size >= maxVariants) break;
        variants.add(text.substring(0, i) + rep + text.substring(i + 1));
      }
    }
  }

  // Two-char substitutions
  for (let i = 0; i < text.length - 1 && variants.size < maxVariants; i++) {
    const pair = text.substring(i, i + 2);
    const replacements = OCR_CHAR_MAP[pair];
    if (replacements) {
      for (const rep of replacements) {
        if (variants.size >= maxVariants) break;
        variants.add(text.substring(0, i) + rep + text.substring(i + 2));
      }
    }
  }

  return Array.from(variants);
}

// ── Technique 1: Fuzzy Label Matching ──

function techniqueFuzzyLabel(
  text: string, lines: string[], lowerLines: string[], lineOffsets: number[],
  target: ExtractionTarget
): Candidate[] {
  const candidates: Candidate[] = [];
  const allLabels = [target.label, ...target.synonyms.split(',').map(s => s.trim()).filter(Boolean)];

  for (const rawLabel of allLabels) {
    const lbl = rawLabel.toLowerCase().trim();
    if (!lbl || lbl.length < 2) continue;

    for (let li = 0; li < lowerLines.length; li++) {
      const line = lowerLines[li];
      const words = line.split(/\s+/);
      const labelWords = lbl.split(/\s+/).filter(w => w.length > 1);

      // Aggressive: match if 50% of label words found (vs 75% in main)
      if (labelWords.length >= 2) {
        let found = 0;
        for (const lw of labelWords) {
          if (words.some(w => {
            if (w.includes(lw) || lw.includes(w)) return true;
            const maxL = Math.max(w.length, lw.length);
            if (maxL > 0 && editDistance(w, lw) / maxL <= 0.4) return true;
            return false;
          })) found++;
        }
        const ratio = found / labelWords.length;
        if (ratio >= 0.5) {
          const afterIdx = line.indexOf(labelWords[0]);
          const afterText = afterIdx >= 0 ? lines[li].substring(afterIdx + labelWords[0].length) : lines[li];
          const values = findAllValues(afterText, target.type);
          for (const v of values) {
            candidates.push({
              value: v.value, rawValue: v.value,
              score: 25 * ratio,
              confidence: 0,
              evidence: lines[li].trim(),
              reason: `Fuzzy label match (${Math.round(ratio * 100)}% words)`,
              position: lineOffsets[li] + v.index,
            });
          }
        }
      }

      // Very aggressive edit distance: threshold 0.55 similarity (vs 0.75 in main)
      if (lbl.length <= 30) {
        const lineClean = line.trim();
        if (lineClean.length > 0 && lineClean.length < lbl.length * 5) {
          const segWords = line.split(/\s+/);
          const lblWordCount = lbl.split(/\s+/).length;
          for (let wi = 0; wi <= segWords.length - lblWordCount; wi++) {
            const segment = segWords.slice(wi, wi + lblWordCount + 1).join(' ');
            const maxLen = Math.max(segment.length, lbl.length);
            const dist = editDistance(segment, lbl);
            const similarity = 1 - dist / maxLen;
            if (similarity >= 0.55) {
              const afterSeg = lines[li].substring(lines[li].toLowerCase().indexOf(segment) + segment.length);
              const values = findAllValues(afterSeg, target.type);
              for (const v of values) {
                candidates.push({
                  value: v.value, rawValue: v.value,
                  score: 20 * similarity,
                  confidence: 0,
                  evidence: lines[li].trim(),
                  reason: `Fuzzy edit distance (${Math.round(similarity * 100)}% similar)`,
                  position: lineOffsets[li] + v.index,
                });
              }
              // Also check next few lines
              for (let off = 1; off <= 3; off++) {
                const nli = li + off;
                if (nli >= lines.length || !lines[nli].trim()) continue;
                const vals = findAllValues(lines[nli], target.type);
                for (const v of vals) {
                  candidates.push({
                    value: v.value, rawValue: v.value,
                    score: Math.max(5, (18 - off * 4) * similarity),
                    confidence: 0,
                    evidence: `${lines[li].trim()} → ${lines[nli].trim()}`,
                    reason: `Fuzzy label +${off} line`,
                    position: lineOffsets[nli] + v.index,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  return candidates;
}

// ── Technique 2: Context Window Expansion ──

function techniqueContextWindow(
  text: string, lines: string[], lowerLines: string[], lineOffsets: number[],
  target: ExtractionTarget
): Candidate[] {
  const candidates: Candidate[] = [];
  const allLabels = [target.label, ...target.synonyms.split(',').map(s => s.trim()).filter(Boolean)];

  for (const rawLabel of allLabels) {
    const lbl = rawLabel.toLowerCase().trim();
    if (!lbl) continue;

    for (let li = 0; li < lowerLines.length; li++) {
      if (!lowerLines[li].includes(lbl)) continue;

      // Expanded window: ±10 lines instead of ±4
      for (let off = -10; off <= 10; off++) {
        const targetLine = li + off;
        if (targetLine < 0 || targetLine >= lines.length || targetLine === li) continue;
        if (!lines[targetLine].trim()) continue;

        const values = findAllValues(lines[targetLine], target.type);
        const distance = Math.abs(off);
        for (const v of values) {
          const score = Math.max(3, (25 - distance * 2));
          candidates.push({
            value: v.value, rawValue: v.value,
            score,
            confidence: 0,
            evidence: `${lines[li].trim()} ↔ [${off > 0 ? '+' : ''}${off}] ${lines[targetLine].trim()}`,
            reason: `Context window ±${distance} lines`,
            position: lineOffsets[targetLine] + v.index,
          });
        }
      }
    }
  }

  return candidates;
}

// ── Technique 3: Pattern Relaxation ──

function techniquePatternRelaxation(
  text: string, lines: string[], lowerLines: string[], lineOffsets: number[],
  target: ExtractionTarget
): Candidate[] {
  const candidates: Candidate[] = [];
  const allLabels = [target.label, ...target.synonyms.split(',').map(s => s.trim()).filter(Boolean)];

  // Relaxed patterns for money — accept bare numbers near labels
  if (target.type === 'money') {
    const relaxedMoneyRe = /\d[\d,.\s]*\d(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?/g;

    for (const rawLabel of allLabels) {
      const lbl = rawLabel.toLowerCase().trim();
      if (!lbl) continue;

      for (let li = 0; li < lowerLines.length; li++) {
        if (!lowerLines[li].includes(lbl)) continue;

        // Check same line and nearby for bare numbers
        for (let off = 0; off <= 3; off++) {
          const tli = li + off;
          if (tli >= lines.length) break;
          const lineText = lines[tli];

          let match: RegExpExecArray | null;
          const re = new RegExp(relaxedMoneyRe.source, relaxedMoneyRe.flags);
          while ((match = re.exec(lineText)) !== null) {
            const val = match[0].trim();
            const numVal = parseMoneyValue(val);
            if (numVal > 0 && numVal < 1e9) {
              candidates.push({
                value: val, rawValue: val,
                score: Math.max(5, 20 - off * 5),
                confidence: 0,
                evidence: lineText.trim(),
                reason: `Relaxed pattern (bare number ${numVal.toFixed(2)})`,
                position: lineOffsets[tli] + match.index,
              });
            }
          }
        }
      }
    }
  }

  // Relaxed patterns for dates — accept more formats
  if (target.type === 'date') {
    const relaxedDateRe = /\d{1,2}\s*[/\-.]\s*\d{1,2}\s*[/\-.]\s*\d{2,4}|\d{4}\s*[/\-.]\s*\d{1,2}\s*[/\-.]\s*\d{1,2}|\d{1,2}\s+\w{3,9}\s+\d{2,4}|\w{3,9}\s+\d{1,2}\s*,?\s*\d{2,4}|\d{1,2}\s+\w{3,9}/gi;

    for (let li = 0; li < lines.length; li++) {
      let match: RegExpExecArray | null;
      const re = new RegExp(relaxedDateRe.source, relaxedDateRe.flags);
      while ((match = re.exec(lines[li])) !== null) {
        candidates.push({
          value: match[0].trim(), rawValue: match[0].trim(),
          score: 8,
          confidence: 0,
          evidence: lines[li].trim(),
          reason: 'Relaxed date pattern',
          position: lineOffsets[li] + match.index,
        });
      }
    }
  }

  // Relaxed text — capture longer segments after labels
  if (target.type === 'text') {
    for (const rawLabel of allLabels) {
      const lbl = rawLabel.toLowerCase().trim();
      if (!lbl) continue;

      for (let li = 0; li < lowerLines.length; li++) {
        const idx = lowerLines[li].indexOf(lbl);
        if (idx === -1) continue;

        const afterLabel = lines[li].substring(idx + lbl.length);
        const cleaned = afterLabel.replace(/^[\s:=\-–—>|]+/, '').trim();

        // Accept longer text segments (up to 500 chars vs 200 in main)
        if (cleaned && cleaned.length <= 500 && cleaned.length > 0) {
          candidates.push({
            value: cleaned, rawValue: cleaned,
            score: 22,
            confidence: 0,
            evidence: lines[li].trim(),
            reason: 'Relaxed text capture',
            position: lineOffsets[li] + idx + lbl.length,
          });
        }

        // Also grab next non-empty line as text value
        for (let off = 1; off <= 2; off++) {
          const nli = li + off;
          if (nli >= lines.length) break;
          const nextLine = lines[nli].trim();
          if (nextLine && nextLine.length <= 300) {
            candidates.push({
              value: nextLine, rawValue: nextLine,
              score: 15 - off * 3,
              confidence: 0,
              evidence: `${lines[li].trim()} → ${nextLine}`,
              reason: 'Relaxed text (next line)',
              position: lineOffsets[nli],
            });
          }
        }
      }
    }
  }

  return candidates;
}

// ── Technique 4: Structural / Table Analysis ──

function techniqueStructuralAnalysis(
  text: string, lines: string[], lowerLines: string[], lineOffsets: number[],
  target: ExtractionTarget
): Candidate[] {
  const candidates: Candidate[] = [];
  const allLabels = [target.label, ...target.synonyms.split(',').map(s => s.trim()).filter(Boolean)];

  // Detect table-like patterns: lines with consistent spacing/separators
  const tableLines: number[] = [];
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const tabCount = (line.match(/\t/g) || []).length;
    const multiSpaceCount = (line.match(/\s{3,}/g) || []).length;
    const pipeCount = (line.match(/\|/g) || []).length;
    if (tabCount >= 1 || multiSpaceCount >= 2 || pipeCount >= 2) {
      tableLines.push(li);
    }
  }

  // For table lines, try column alignment
  for (const li of tableLines) {
    const line = lines[li];
    const lowerLine = lowerLines[li];

    for (const rawLabel of allLabels) {
      const lbl = rawLabel.toLowerCase().trim();
      if (!lbl) continue;

      // Check if this line or nearby lines contain the label
      let labelLineIdx = -1;
      for (let off = -5; off <= 5; off++) {
        const checkLi = li + off;
        if (checkLi >= 0 && checkLi < lowerLines.length && lowerLines[checkLi].includes(lbl)) {
          labelLineIdx = checkLi;
          break;
        }
      }

      if (labelLineIdx >= 0) {
        // Find the column position of the label
        const labelPos = lowerLines[labelLineIdx].indexOf(lbl);

        // Find values in the current line near that column position
        const values = findAllValues(line, target.type);
        for (const v of values) {
          // Score based on column alignment
          const colDistance = Math.abs(v.index - labelPos);
          if (colDistance < 50) {
            candidates.push({
              value: v.value, rawValue: v.value,
              score: Math.max(5, 25 - colDistance * 0.5),
              confidence: 0,
              evidence: `[Table] ${lines[labelLineIdx].trim()} | ${line.trim()}`,
              reason: `Structural alignment (col offset: ${colDistance})`,
              position: lineOffsets[li] + v.index,
            });
          }
        }
      }
    }
  }

  // Detect key-value pairs with various separators
  const kvPatterns = [
    /^(.+?)\s*[:=]\s*(.+)$/,          // "Key: Value" or "Key = Value"
    /^(.+?)\s{3,}(.+)$/,               // "Key    Value" (3+ spaces)
    /^(.+?)\t+(.+)$/,                   // "Key\tValue"
    /^(.+?)\s*\|\s*(.+)$/,             // "Key | Value"
    /^(.+?)\s*[-–—]{2,}\s*(.+)$/,      // "Key -- Value"
  ];

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].trim();
    if (!line) continue;

    for (const pattern of kvPatterns) {
      const match = line.match(pattern);
      if (!match) continue;

      const key = match[1].trim().toLowerCase();
      const val = match[2].trim();

      for (const rawLabel of allLabels) {
        const lbl = rawLabel.toLowerCase().trim();
        if (!lbl) continue;

        const maxLen = Math.max(key.length, lbl.length);
        if (maxLen === 0) continue;

        const similarity = 1 - editDistance(key, lbl) / maxLen;
        if (similarity >= 0.5 || key.includes(lbl) || lbl.includes(key)) {
          const values = findAllValues(val, target.type);
          if (values.length > 0) {
            for (const v of values) {
              candidates.push({
                value: v.value, rawValue: v.value,
                score: 30 * Math.max(similarity, 0.5),
                confidence: 0,
                evidence: line,
                reason: `Structural KV pair (${Math.round(similarity * 100)}% match)`,
                position: lineOffsets[li] + lines[li].indexOf(val) + v.index,
              });
            }
          } else if (target.type === 'text' && val.length <= 300) {
            candidates.push({
              value: val, rawValue: val,
              score: 25 * Math.max(similarity, 0.5),
              confidence: 0,
              evidence: line,
              reason: 'Structural KV text',
              position: lineOffsets[li] + lines[li].indexOf(val),
            });
          }
        }
      }
    }
  }

  return candidates;
}

// ── Technique 5: Reverse Value Lookup ──

function techniqueReverseLookup(
  text: string, lines: string[], lowerLines: string[], lineOffsets: number[],
  target: ExtractionTarget
): Candidate[] {
  const candidates: Candidate[] = [];
  const allLabels = [target.label, ...target.synonyms.split(',').map(s => s.trim()).filter(Boolean)];

  // First, find ALL values of the target type in the document
  const allValues: Array<{ value: string; lineIdx: number; charIdx: number }> = [];
  for (let li = 0; li < lines.length; li++) {
    const vals = findAllValues(lines[li], target.type);
    for (const v of vals) {
      allValues.push({ value: v.value, lineIdx: li, charIdx: v.index });
    }
  }

  // For each value, look backwards for the nearest label
  for (const vInfo of allValues) {
    let bestLabelDist = Infinity;
    let bestLabel = '';
    let bestLabelLine = -1;

    for (const rawLabel of allLabels) {
      const lbl = rawLabel.toLowerCase().trim();
      if (!lbl) continue;

      // Search backwards up to 10 lines
      for (let off = 0; off <= 10; off++) {
        const checkLi = vInfo.lineIdx - off;
        if (checkLi < 0) break;

        if (lowerLines[checkLi].includes(lbl)) {
          if (off < bestLabelDist) {
            bestLabelDist = off;
            bestLabel = rawLabel;
            bestLabelLine = checkLi;
          }
          break;
        }

        // Fuzzy check
        const words = lowerLines[checkLi].split(/\s+/);
        const lblWords = lbl.split(/\s+/);
        let wordMatches = 0;
        for (const lw of lblWords) {
          if (words.some(w => editDistance(w, lw) <= Math.max(1, Math.floor(lw.length * 0.35)))) {
            wordMatches++;
          }
        }
        if (lblWords.length > 0 && wordMatches / lblWords.length >= 0.6) {
          const dist = off + 0.5; // slightly penalize fuzzy
          if (dist < bestLabelDist) {
            bestLabelDist = dist;
            bestLabel = rawLabel;
            bestLabelLine = checkLi;
          }
          break;
        }
      }
    }

    if (bestLabelLine >= 0) {
      const score = Math.max(5, 28 - bestLabelDist * 3);
      candidates.push({
        value: vInfo.value, rawValue: vInfo.value,
        score,
        confidence: 0,
        evidence: `${lines[bestLabelLine].trim()} → [${bestLabelDist > 0 ? '+' + Math.round(bestLabelDist) : 'same'}] ${lines[vInfo.lineIdx].trim()}`,
        reason: `Reverse lookup from "${bestLabel}" (dist: ${Math.round(bestLabelDist)})`,
        position: lineOffsets[vInfo.lineIdx] + vInfo.charIdx,
      });
    }
  }

  return candidates;
}

// ── Technique 6: N-Gram Proximity ──

function techniqueNgramProximity(
  text: string, lines: string[], lowerLines: string[], lineOffsets: number[],
  target: ExtractionTarget
): Candidate[] {
  const candidates: Candidate[] = [];
  const allLabels = [target.label, ...target.synonyms.split(',').map(s => s.trim()).filter(Boolean)];

  // Generate n-grams for labels
  function getNgrams(str: string, n: number): Set<string> {
    const grams = new Set<string>();
    const s = str.toLowerCase();
    for (let i = 0; i <= s.length - n; i++) {
      grams.add(s.substring(i, i + n));
    }
    return grams;
  }

  function ngramSimilarity(a: string, b: string, n: number = 3): number {
    const ga = getNgrams(a, n);
    const gb = getNgrams(b, n);
    if (ga.size === 0 || gb.size === 0) return 0;
    let intersection = 0;
    for (const g of ga) if (gb.has(g)) intersection++;
    return intersection / Math.max(ga.size, gb.size);
  }

  for (let li = 0; li < lines.length; li++) {
    // Score each line against all labels using n-grams
    let bestNgramScore = 0;
    let bestNgramLabel = '';

    for (const rawLabel of allLabels) {
      const similarity = ngramSimilarity(lowerLines[li], rawLabel.toLowerCase(), 3);
      if (similarity > bestNgramScore) {
        bestNgramScore = similarity;
        bestNgramLabel = rawLabel;
      }
    }

    if (bestNgramScore >= 0.3) {
      // Look for values on same line and nearby
      for (let off = 0; off <= 4; off++) {
        const tli = li + off;
        if (tli >= lines.length) break;
        const vals = findAllValues(lines[tli], target.type);
        for (const v of vals) {
          candidates.push({
            value: v.value, rawValue: v.value,
            score: Math.max(3, (20 * bestNgramScore) - off * 3),
            confidence: 0,
            evidence: `${lines[li].trim()}${off > 0 ? ` → ${lines[tli].trim()}` : ''}`,
            reason: `N-gram proximity (${Math.round(bestNgramScore * 100)}% match to "${bestNgramLabel}")`,
            position: lineOffsets[tli] + v.index,
          });
        }
      }
    }
  }

  return candidates;
}

// ── Technique 7: Multi-Line Merge ──

function techniqueMultilineMerge(
  text: string, lines: string[], lowerLines: string[], lineOffsets: number[],
  target: ExtractionTarget
): Candidate[] {
  const candidates: Candidate[] = [];
  const allLabels = [target.label, ...target.synonyms.split(',').map(s => s.trim()).filter(Boolean)];

  // Merge consecutive short lines and re-search
  for (let li = 0; li < lines.length - 1; li++) {
    const line1 = lines[li].trim();
    const line2 = lines[li + 1]?.trim() || '';
    const line3 = lines[li + 2]?.trim() || '';

    if (!line1) continue;

    // Merge 2 lines
    const merged2 = `${line1} ${line2}`;
    const merged2Lower = merged2.toLowerCase();

    for (const rawLabel of allLabels) {
      const lbl = rawLabel.toLowerCase().trim();
      if (!lbl) continue;

      // Check if the merged text contains the label that individual lines didn't
      if (merged2Lower.includes(lbl) && !lowerLines[li].includes(lbl) && !(lowerLines[li + 1] || '').includes(lbl)) {
        const afterIdx = merged2Lower.indexOf(lbl) + lbl.length;
        const afterText = merged2.substring(afterIdx);
        const values = findAllValues(afterText, target.type);
        for (const v of values) {
          candidates.push({
            value: v.value, rawValue: v.value,
            score: 22,
            confidence: 0,
            evidence: `[Merged] ${merged2}`,
            reason: `Multi-line merge (2 lines, label split across)`,
            position: lineOffsets[li] + afterIdx + v.index,
          });
        }
      }

      // Merge 3 lines
      if (line3) {
        const merged3 = `${line1} ${line2} ${line3}`;
        const merged3Lower = merged3.toLowerCase();
        if (merged3Lower.includes(lbl) && !merged2Lower.includes(lbl)) {
          const afterIdx = merged3Lower.indexOf(lbl) + lbl.length;
          const afterText = merged3.substring(afterIdx);
          const values = findAllValues(afterText, target.type);
          for (const v of values) {
            candidates.push({
              value: v.value, rawValue: v.value,
              score: 15,
              confidence: 0,
              evidence: `[Merged 3] ${merged3.substring(0, 120)}...`,
              reason: 'Multi-line merge (3 lines)',
              position: lineOffsets[li] + afterIdx + v.index,
            });
          }
        }
      }
    }

    // Also check if a value is split across lines (e.g., "£1," on one line, "234.56" on next)
    if (target.type === 'money') {
      const combined = `${line1}${line2}`;
      const vals = findAllValues(combined, target.type);
      for (const v of vals) {
        // Only care about values that span the boundary
        if (v.index + v.value.length > line1.length && v.index < line1.length) {
          candidates.push({
            value: v.value, rawValue: v.value,
            score: 18,
            confidence: 0,
            evidence: `[Split value] ${line1} | ${line2}`,
            reason: 'Multi-line value merge',
            position: lineOffsets[li] + v.index,
          });
        }
      }
    }
  }

  return candidates;
}

// ── Technique 8: OCR Error Correction ──

function techniqueOCRCorrection(
  text: string, lines: string[], lowerLines: string[], lineOffsets: number[],
  target: ExtractionTarget
): Candidate[] {
  const candidates: Candidate[] = [];
  const allLabels = [target.label, ...target.synonyms.split(',').map(s => s.trim()).filter(Boolean)];

  for (const rawLabel of allLabels) {
    const lbl = rawLabel.toLowerCase().trim();
    if (!lbl || lbl.length < 3) continue;

    const variants = generateOCRVariants(lbl, 12);

    for (const variant of variants) {
      if (variant === lbl) continue; // skip original (already tried by main)

      for (let li = 0; li < lowerLines.length; li++) {
        if (!lowerLines[li].includes(variant)) continue;

        const idx = lowerLines[li].indexOf(variant);
        const afterText = lines[li].substring(idx + variant.length);
        const cleaned = afterText.replace(/^[\s:=\-–—>|]+/, '');

        if (cleaned.trim()) {
          const values = findAllValues(cleaned, target.type);
          for (const v of values) {
            candidates.push({
              value: v.value, rawValue: v.value,
              score: 20,
              confidence: 0,
              evidence: lines[li].trim(),
              reason: `OCR correction: "${lbl}" → "${variant}"`,
              position: lineOffsets[li] + idx + variant.length + v.index,
            });
          }
        }

        // Check next lines too
        for (let off = 1; off <= 3; off++) {
          const nli = li + off;
          if (nli >= lines.length || !lines[nli].trim()) continue;
          const vals = findAllValues(lines[nli], target.type);
          for (const v of vals) {
            candidates.push({
              value: v.value, rawValue: v.value,
              score: Math.max(5, 15 - off * 3),
              confidence: 0,
              evidence: `${lines[li].trim()} → ${lines[nli].trim()}`,
              reason: `OCR correction +${off}line`,
              position: lineOffsets[nli] + v.index,
            });
          }
        }
      }
    }
  }

  return candidates;
}

// ─── Master Reserve Extraction Engine ────────────────────────────────────────

function runReserveExtraction(
  text: string,
  targets: ExtractionTarget[],
  originalResults: ExtractionResult[],
  onProgress?: (progress: number, msg: string) => void,
): ReserveResult[] {
  const normalized = normalizeText(text);
  const lines = normalized.split('\n');
  const lowerLines = lines.map(l => l.toLowerCase());
  const lineOffsets: number[] = [];
  let offset = 0;
  for (const line of lines) { lineOffsets.push(offset); offset += line.length + 1; }

  const results: ReserveResult[] = [];
  const totalTargets = targets.length;

  // Determine which targets need reserve processing
  const needsReserve = targets.filter(target => {
    const original = originalResults.find(r => r.targetId === target.id);
    if (!original) return true;
    if (!original.value) return true;
    if (original.confidence < 50) return true;
    return false;
  });

  onProgress?.(5, `Analyzing ${needsReserve.length} targets needing reserve processing...`);

  const techniques: Array<{
    id: TechniqueId;
    fn: (text: string, lines: string[], lowerLines: string[], lineOffsets: number[], target: ExtractionTarget) => Candidate[];
  }> = [
    { id: 'fuzzy_label', fn: techniqueFuzzyLabel },
    { id: 'context_window', fn: techniqueContextWindow },
    { id: 'pattern_relaxation', fn: techniquePatternRelaxation },
    { id: 'structural_analysis', fn: techniqueStructuralAnalysis },
    { id: 'reverse_lookup', fn: techniqueReverseLookup },
    { id: 'ngram_proximity', fn: techniqueNgramProximity },
    { id: 'multiline_merge', fn: techniqueMultilineMerge },
    { id: 'ocr_correction', fn: techniqueOCRCorrection },
  ];

  for (let ti = 0; ti < targets.length; ti++) {
    const target = targets[ti];
    const original = originalResults.find(r => r.targetId === target.id);
    const isReserveTarget = needsReserve.some(t => t.id === target.id);

    if (!isReserveTarget) {
      // Pass through original result
      results.push({
        targetId: target.id,
        targetLabel: target.label,
        value: original?.value || '',
        confidence: original?.confidence || 0,
        evidence: original?.evidence || '',
        reason: original?.reason || '',
        technique: 'original',
        alternatives: original?.alternatives || [],
        position: original?.position ?? -1,
        improved: false,
      });
      continue;
    }

    onProgress?.(
      5 + ((ti / totalTargets) * 85),
      `Reserve processing: "${target.label}" (${ti + 1}/${totalTargets})`
    );

    // Run all techniques and collect candidates
    const allCandidates: Array<Candidate & { technique: TechniqueId }> = [];

    for (const tech of techniques) {
      try {
        const techCandidates = tech.fn(text, lines, lowerLines, lineOffsets, target);
        for (const c of techCandidates) {
          allCandidates.push({ ...c, technique: tech.id });
        }
      } catch (err) {
        console.warn(`Reserve technique ${tech.id} failed for "${target.label}":`, err);
      }
    }

    // Deduplicate and score
    const deduped = new Map<string, Candidate & { technique: TechniqueId; techniqueCount: number }>();
    for (const c of allCandidates) {
      const key = target.type === 'money'
        ? (parseMoneyValue(c.value) > 0 ? parseMoneyValue(c.value).toFixed(2) : c.value.trim())
        : c.value.trim().toLowerCase();

      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, { ...c, techniqueCount: 1 });
      } else {
        // Boost score when multiple techniques agree
        existing.score = Math.max(existing.score, c.score) + 5;
        existing.techniqueCount++;
        if (c.evidence.length > existing.evidence.length) {
          existing.evidence = c.evidence;
        }
        existing.reason = `${existing.techniqueCount} techniques agree`;
      }
    }

    const sorted = Array.from(deduped.values()).sort((a, b) => b.score - a.score);

    // Calculate confidence with multi-technique boost
    for (const c of sorted) {
      let conf = (c.score / 50) * 100;
      if (c.techniqueCount >= 3) conf = Math.min(100, conf + 15);
      else if (c.techniqueCount >= 2) conf = Math.min(100, conf + 8);
      c.confidence = Math.round(Math.min(100, Math.max(0, conf)));
    }

    const best = sorted[0] || null;
    const originalConf = original?.confidence || 0;
    const improved = best !== null && best.confidence > originalConf;

    // If reserve found something better, use it; otherwise keep original
    if (improved && best) {
      results.push({
        targetId: target.id,
        targetLabel: target.label,
        value: best.value,
        confidence: best.confidence,
        evidence: best.evidence,
        reason: best.reason,
        technique: best.technique,
        alternatives: sorted.slice(1, 5).map(c => ({
          value: c.value, rawValue: c.rawValue, score: c.score,
          confidence: c.confidence, evidence: c.evidence,
          reason: c.reason, position: c.position,
        })),
        position: best.position,
        improved: true,
      });
    } else if (best && (!original || !original.value)) {
      // Original had nothing, reserve found something
      results.push({
        targetId: target.id,
        targetLabel: target.label,
        value: best.value,
        confidence: best.confidence,
        evidence: best.evidence,
        reason: best.reason,
        technique: best.technique,
        alternatives: sorted.slice(1, 5).map(c => ({
          value: c.value, rawValue: c.rawValue, score: c.score,
          confidence: c.confidence, evidence: c.evidence,
          reason: c.reason, position: c.position,
        })),
        position: best.position,
        improved: true,
      });
    } else {
      // Keep original
      results.push({
        targetId: target.id,
        targetLabel: target.label,
        value: original?.value || '',
        confidence: original?.confidence || 0,
        evidence: original?.evidence || '',
        reason: original?.reason || 'Reserve processing did not improve result',
        technique: 'original',
        alternatives: [
          ...(best ? [{
            value: best.value, rawValue: best.rawValue, score: best.score,
            confidence: best.confidence, evidence: best.evidence,
            reason: `[Reserve: ${best.technique}] ${best.reason}`, position: best.position,
          }] : []),
          ...(original?.alternatives || []),
        ].slice(0, 5),
        position: original?.position ?? -1,
        improved: false,
      });
    }
  }

  onProgress?.(100, 'Reserve processing complete');
  return results;
}

// ─── Confidence / Status Helpers ─────────────────────────────────────────────

const confColor = (c: number) => c >= 70 ? T.accent.green : c >= 40 ? T.accent.amber : T.accent.rose;
const confBg = (c: number) => c >= 70 ? T.accent.greenBg : c >= 40 ? T.accent.amberBg : T.accent.roseBg;
const confBorder = (c: number) => c >= 70 ? T.accent.greenBorder : c >= 40 ? T.accent.amberBorder : T.accent.roseBorder;

// ─── Icons ───────────────────────────────────────────────────────────────────

const Icons = {
  x: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>)),
  check: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>)),
  zap: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>)),
  alertCircle: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>)),
  chevDown: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>)),
  arrowUp: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>)),
  refresh: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>)),
  shield: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>)),
  cpu: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></svg>)),
  layers: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>)),
  target: memo((p: React.SVGProps<SVGSVGElement>) => (<svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>)),
};

// ─── Reserve Processor Panel Component ───────────────────────────────────────

interface ReserveProcessorProps {
  /** Whether the reserve panel is visible */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Jobs to display / run */
  jobs: ReserveProcessorJob[];
  /** Callback when reserve results are ready to merge back */
  onApplyResults: (docId: string, results: ReserveResult[]) => void;
  /** Callback to update job state */
  onUpdateJob: (jobId: string, updates: Partial<ReserveProcessorJob>) => void;
}

const ReserveProcessorPanel = memo(function ReserveProcessorPanel({
  isOpen, onClose, jobs, onApplyResults, onUpdateJob,
}: ReserveProcessorProps) {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [expandedTechniques, setExpandedTechniques] = useState(false);
  const [autoApply, setAutoApply] = useState(true);

  const processingRef = useRef(false);

  // Process queued jobs
  useEffect(() => {
    const processNext = async () => {
      if (processingRef.current) return;
      const nextJob = jobs.find(j => j.status === 'queued');
      if (!nextJob) return;

      processingRef.current = true;

      onUpdateJob(nextJob.id, {
        status: 'processing',
        progress: 0,
        progressMsg: 'Starting reserve analysis...',
        startedAt: Date.now(),
      });

      try {
        // Small delay to allow UI to update
        await new Promise(r => setTimeout(r, 50));

        const reserveResults = runReserveExtraction(
          nextJob.text,
          nextJob.targets,
          nextJob.originalResults,
          (progress, msg) => {
            onUpdateJob(nextJob.id, { progress, progressMsg: msg });
          }
        );

        onUpdateJob(nextJob.id, {
          status: 'done',
          progress: 100,
          progressMsg: 'Complete',
          reserveResults,
          completedAt: Date.now(),
        });

        // Auto-apply improved results
        if (autoApply) {
          const improved = reserveResults.filter(r => r.improved);
          if (improved.length > 0) {
            onApplyResults(nextJob.docId, reserveResults);
          }
        }
      } catch (err: any) {
        onUpdateJob(nextJob.id, {
          status: 'failed',
          error: err.message || 'Reserve processing failed',
          completedAt: Date.now(),
        });
      }

      processingRef.current = false;

      // Check for more
      setTimeout(processNext, 100);
    };

    if (jobs.some(j => j.status === 'queued')) {
      processNext();
    }
  }, [jobs, onUpdateJob, onApplyResults, autoApply]);

  const doneJobs = jobs.filter(j => j.status === 'done');
  const processingJobs = jobs.filter(j => j.status === 'processing');
  const queuedJobs = jobs.filter(j => j.status === 'queued');
  const failedJobs = jobs.filter(j => j.status === 'failed');

  const totalImproved = doneJobs.reduce((sum, j) => sum + j.reserveResults.filter(r => r.improved).length, 0);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
            width: '100%', maxWidth: 860, maxHeight: '92vh',
            background: T.bg.elevated,
            borderRadius: 20,
            border: `1px solid ${T.border.default}`,
            boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.6)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* ── Header ── */}
          <div style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${T.border.subtle}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: `linear-gradient(135deg, rgba(167,139,250,0.06), rgba(34,211,238,0.06))`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: `linear-gradient(135deg, ${T.accent.violet}, ${T.accent.cyan})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 20px rgba(167,139,250,0.25)`,
              }}>
                <Icons.shield style={{ width: 22, height: 22, color: '#fff' }} />
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: T.text.primary, letterSpacing: '-0.3px' }}>
                  Reserve Processor
                </h2>
                <p style={{ fontSize: 12, color: T.text.tertiary, margin: '2px 0 0' }}>
                  Advanced fallback extraction with {TECHNIQUES.length} techniques
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Status badges */}
              {processingJobs.length > 0 && (
                <span style={{
                  padding: '4px 10px', borderRadius: 8,
                  background: T.accent.violetBg, border: `1px solid ${T.accent.violetBorder}`,
                  fontSize: 11, fontWeight: 600, color: T.accent.violet,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.accent.violet, animation: 'pulse 1.5s infinite' }} />
                  {processingJobs.length} running
                </span>
              )}
              {totalImproved > 0 && (
                <span style={{
                  padding: '4px 10px', borderRadius: 8,
                  background: T.accent.greenBg, border: `1px solid ${T.accent.greenBorder}`,
                  fontSize: 11, fontWeight: 600, color: T.accent.green,
                }}>
                  ↑ {totalImproved} improved
                </span>
              )}

              <button onClick={onClose} style={{
                background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border.subtle}`,
                borderRadius: 8, color: T.text.secondary, cursor: 'pointer', padding: 6, display: 'flex',
              }}>
                <Icons.x style={{ width: 18, height: 18 }} />
              </button>
            </div>
          </div>

          {/* ── Info / Auto-apply toggle ── */}
          <div style={{
            padding: '12px 24px',
            borderBottom: `1px solid ${T.border.subtle}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: T.accent.violetBg,
              border: `1px solid ${T.accent.violetBorder}`,
              display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1, marginRight: 16,
            }}>
              <Icons.cpu style={{ width: 16, height: 16, color: T.accent.violet, flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 11, color: T.text.secondary, margin: 0, lineHeight: 1.5 }}>
                The Reserve Processor automatically runs when the main extractor produces low-confidence results ({'<'}50%) or
                missing values. It applies {TECHNIQUES.length} different extraction techniques and merges improved results back.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.text.tertiary }}>Auto-apply</span>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setAutoApply(!autoApply)}
                style={{
                  width: 40, height: 22, borderRadius: 11,
                  background: autoApply ? T.accent.green : 'rgba(255,255,255,0.08)',
                  border: 'none', cursor: 'pointer', position: 'relative',
                  transition: 'background 0.2s',
                }}
              >
                <motion.div
                  animate={{ x: autoApply ? 20 : 2 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  style={{
                    width: 18, height: 18, borderRadius: 9,
                    background: '#fff', position: 'absolute', top: 2,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
                />
              </motion.button>
            </div>
          </div>

          {/* ── Techniques accordion ── */}
          <div style={{
            borderBottom: `1px solid ${T.border.subtle}`,
          }}>
            <div
              onClick={() => setExpandedTechniques(!expandedTechniques)}
              style={{
                padding: '10px 24px',
                display: 'flex', alignItems: 'center', gap: 8,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <Icons.layers style={{ width: 14, height: 14, color: T.accent.cyan }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: T.text.secondary }}>
                {TECHNIQUES.length} Extraction Techniques
              </span>
              <Icons.chevDown style={{
                width: 14, height: 14, color: T.text.muted,
                transform: expandedTechniques ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s',
              }} />
            </div>
            <AnimatePresence>
              {expandedTechniques && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    padding: '0 24px 14px',
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
                  }}>
                    {TECHNIQUES.map(tech => (
                      <div key={tech.id} style={{
                        padding: '8px 10px', borderRadius: 8,
                        background: 'rgba(255,255,255,0.015)',
                        border: `1px solid ${T.border.subtle}`,
                        display: 'flex', gap: 8, alignItems: 'flex-start',
                      }}>
                        <span style={{ fontSize: 14, lineHeight: 1 }}>{tech.icon}</span>
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 600, color: T.text.primary, margin: 0 }}>{tech.name}</p>
                          <p style={{ fontSize: 9, color: T.text.muted, margin: '2px 0 0', lineHeight: 1.4 }}>{tech.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Jobs list ── */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
            {jobs.length === 0 ? (
              <div style={{
                padding: 48, textAlign: 'center',
                borderRadius: 14, border: `1px solid ${T.border.subtle}`,
                background: 'rgba(255,255,255,0.015)',
              }}>
                <Icons.shield style={{ width: 40, height: 40, color: T.text.muted, margin: '0 auto 12px', display: 'block' }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: T.text.secondary, margin: 0 }}>No reserve jobs</p>
                <p style={{ fontSize: 12, color: T.text.muted, margin: '6px 0 0' }}>
                  Reserve processing triggers automatically for documents with low-confidence or missing extractions.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {jobs.map(job => {
                  const isExpanded = expandedJobId === job.id;
                  const improvedCount = job.reserveResults.filter(r => r.improved).length;
                  const elapsed = job.completedAt && job.startedAt
                    ? ((job.completedAt - job.startedAt) / 1000).toFixed(1)
                    : null;

                  return (
                    <motion.div
                      key={job.id}
                      layout
                      style={{
                        borderRadius: 14,
                        border: `1px solid ${
                          job.status === 'failed' ? T.accent.roseBorder
                          : job.status === 'done' && improvedCount > 0 ? T.accent.greenBorder
                          : job.status === 'processing' ? T.accent.violetBorder
                          : T.border.subtle
                        }`,
                        background: T.bg.surface,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Job header */}
                      <div
                        onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                        style={{
                          padding: '12px 16px',
                          display: 'flex', alignItems: 'center', gap: 10,
                          cursor: 'pointer', userSelect: 'none',
                        }}
                      >
                        {/* Status indicator */}
                        <div style={{
                          width: 34, height: 34, borderRadius: 9,
                          background: job.status === 'done' ? (improvedCount > 0 ? T.accent.greenBg : 'rgba(255,255,255,0.03)')
                            : job.status === 'processing' ? T.accent.violetBg
                            : job.status === 'failed' ? T.accent.roseBg
                            : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${
                            job.status === 'done' ? (improvedCount > 0 ? T.accent.greenBorder : T.border.subtle)
                            : job.status === 'processing' ? T.accent.violetBorder
                            : job.status === 'failed' ? T.accent.roseBorder
                            : T.border.subtle
                          }`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          {job.status === 'done' && improvedCount > 0 && <Icons.arrowUp style={{ width: 16, height: 16, color: T.accent.green }} />}
                          {job.status === 'done' && improvedCount === 0 && <Icons.check style={{ width: 14, height: 14, color: T.text.muted }} />}
                          {job.status === 'processing' && (
                            <div style={{
                              width: 14, height: 14,
                              border: `2px solid ${T.accent.violet}`,
                              borderTopColor: 'transparent',
                              borderRadius: '50%',
                              animation: 'spin 0.8s linear infinite',
                            }} />
                          )}
                          {job.status === 'queued' && <Icons.cpu style={{ width: 14, height: 14, color: T.text.muted }} />}
                          {job.status === 'failed' && <Icons.alertCircle style={{ width: 14, height: 14, color: T.accent.rose }} />}
                        </div>

                        {/* File info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: 13, fontWeight: 600, margin: 0, color: T.text.primary,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {job.fileName}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                            <span style={{
                              fontSize: 11, fontWeight: 500,
                              color: job.status === 'done' ? (improvedCount > 0 ? T.accent.green : T.text.tertiary)
                                : job.status === 'processing' ? T.accent.violet
                                : job.status === 'failed' ? T.accent.rose
                                : T.text.muted,
                            }}>
                              {job.status === 'processing' ? job.progressMsg
                                : job.status === 'done' ? (improvedCount > 0 ? `${improvedCount} value${improvedCount > 1 ? 's' : ''} improved` : 'No improvements found')
                                : job.status === 'failed' ? (job.error || 'Failed')
                                : 'Queued'}
                            </span>
                            {elapsed && (
                              <span style={{ fontSize: 10, color: T.text.muted }}>({elapsed}s)</span>
                            )}
                          </div>
                        </div>

                        {/* Progress */}
                        {job.status === 'processing' && (
                          <div style={{ width: 60, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', flexShrink: 0 }}>
                            <motion.div
                              animate={{ width: `${job.progress}%` }}
                              transition={{ duration: 0.3 }}
                              style={{ height: '100%', borderRadius: 3, background: T.accent.violet }}
                            />
                          </div>
                        )}

                        {/* Apply button for manual apply */}
                        {job.status === 'done' && improvedCount > 0 && !autoApply && (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onApplyResults(job.docId, job.reserveResults);
                            }}
                            style={{
                              padding: '6px 12px', borderRadius: 8,
                              background: T.accent.greenBg, border: `1px solid ${T.accent.greenBorder}`,
                              color: T.accent.green, fontSize: 11, fontWeight: 700,
                              cursor: 'pointer', flexShrink: 0,
                              fontFamily: "'Inter', sans-serif",
                              display: 'flex', alignItems: 'center', gap: 5,
                            }}
                          >
                            <Icons.check style={{ width: 12, height: 12 }} />
                            Apply
                          </motion.button>
                        )}

                        <Icons.chevDown style={{
                          width: 16, height: 16, color: T.text.muted, flexShrink: 0,
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                          transition: 'transform 0.2s',
                        }} />
                      </div>

                      {/* Expanded results */}
                      <AnimatePresence>
                        {isExpanded && job.status === 'done' && job.reserveResults.length > 0 && (
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
                              {job.reserveResults.map(r => {
                                const original = job.originalResults.find(o => o.targetId === r.targetId);
                                const techInfo = TECHNIQUES.find(t => t.id === r.technique);

                                return (
                                  <div key={r.targetId} style={{
                                    padding: '10px 12px', borderRadius: 10,
                                    background: r.improved ? T.accent.greenBg : 'rgba(255,255,255,0.015)',
                                    border: `1px solid ${r.improved ? T.accent.greenBorder : T.border.subtle}`,
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                      {/* Label */}
                                      <span style={{ fontSize: 11, fontWeight: 600, color: T.text.tertiary, minWidth: 90 }}>
                                        {r.targetLabel}
                                      </span>

                                      {/* Improvement arrow */}
                                      {r.improved && original && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                                          <div style={{
                                            display: 'flex', alignItems: 'center', gap: 3,
                                            padding: '2px 6px', borderRadius: 5,
                                            background: 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${T.border.subtle}`,
                                          }}>
                                            <span style={{ fontSize: 11, color: T.text.muted, textDecoration: 'line-through' }}>
                                              {original.value || '—'}
                                            </span>
                                            <span style={{ fontSize: 9, fontWeight: 700, color: confColor(original.confidence) }}>
                                              {original.confidence}%
                                            </span>
                                          </div>

                                          <span style={{ color: T.accent.green, fontSize: 12 }}>→</span>

                                          <div style={{
                                            display: 'flex', alignItems: 'center', gap: 3,
                                            padding: '2px 6px', borderRadius: 5,
                                            background: T.accent.greenBg,
                                            border: `1px solid ${T.accent.greenBorder}`,
                                          }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: T.accent.green }}>
                                              {r.value}
                                            </span>
                                            <span style={{ fontSize: 9, fontWeight: 700, color: T.accent.green }}>
                                              {r.confidence}%
                                            </span>
                                          </div>
                                        </div>
                                      )}

                                      {!r.improved && (
                                        <div style={{ flex: 1 }}>
                                          <span style={{ fontSize: 11, color: T.text.secondary }}>
                                            {r.value || '—'}
                                          </span>
                                          <span style={{ fontSize: 9, fontWeight: 700, color: T.text.muted, marginLeft: 4 }}>
                                            (unchanged)
                                          </span>
                                        </div>
                                      )}

                                      {/* Technique badge */}
                                      {r.improved && techInfo && (
                                        <span style={{
                                          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                                          background: T.accent.violetBg, border: `1px solid ${T.accent.violetBorder}`,
                                          color: T.accent.violet, whiteSpace: 'nowrap', flexShrink: 0,
                                        }}>
                                          {techInfo.icon} {techInfo.name}
                                        </span>
                                      )}
                                    </div>

                                    {/* Evidence */}
                                    {r.improved && r.evidence && (
                                      <div style={{
                                        marginTop: 6, padding: '5px 8px', borderRadius: 6,
                                        background: 'rgba(0,0,0,0.15)',
                                        border: `1px solid ${T.border.subtle}`,
                                        fontSize: 10, color: T.text.muted,
                                        fontFamily: 'monospace', lineHeight: 1.4,
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                      }}>
                                        <span style={{ color: T.text.tertiary, fontWeight: 500, marginRight: 4 }}>Evidence:</span>
                                        {r.evidence}
                                      </div>
                                    )}

                                    {/* Reason */}
                                    {r.improved && r.reason && (
                                      <div style={{
                                        marginTop: 4, fontSize: 10, color: T.accent.violet,
                                        fontStyle: 'italic',
                                      }}>
                                        {r.reason}
                                      </div>
                                    )}

                                    {/* Alternatives from reserve */}
                                    {r.improved && r.alternatives.length > 0 && (
                                      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {r.alternatives.slice(0, 3).map((alt, i) => (
                                          <div key={i} style={{
                                            padding: '2px 6px', borderRadius: 4,
                                            background: 'rgba(255,255,255,0.02)',
                                            border: `1px solid ${T.border.subtle}`,
                                            fontSize: 9, color: T.text.muted,
                                            display: 'flex', alignItems: 'center', gap: 3,
                                          }}>
                                            <span>{alt.value}</span>
                                            <span style={{ fontWeight: 700, color: confColor(alt.confidence) }}>
                                              {alt.confidence}%
                                            </span>
                                          </div>
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
                })}
              </div>
            )}
          </div>

          {/* ── Footer summary ── */}
          <div style={{
            padding: '12px 24px',
            borderTop: `1px solid ${T.border.subtle}`,
            background: T.bg.surface,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 11, color: T.text.muted }}>
                {doneJobs.length} complete
              </span>
              {queuedJobs.length > 0 && (
                <span style={{ fontSize: 11, color: T.accent.violet }}>
                  {queuedJobs.length} queued
                </span>
              )}
              {processingJobs.length > 0 && (
                <span style={{ fontSize: 11, color: T.accent.violet }}>
                  {processingJobs.length} running
                </span>
              )}
              {failedJobs.length > 0 && (
                <span style={{ fontSize: 11, color: T.accent.rose }}>
                  {failedJobs.length} failed
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: totalImproved > 0 ? T.accent.green : T.text.muted }}>
                {totalImproved > 0 ? `${totalImproved} values improved` : 'No improvements yet'}
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

// ─── Hook: useReserveProcessor ───────────────────────────────────────────────
// This hook is what the main DocumentProcessor integrates with.

export interface UseReserveProcessorReturn {
  /** Current reserve jobs */
  jobs: ReserveProcessorJob[];
  /** Whether the panel is visible */
  isOpen: boolean;
  /** Open the reserve panel */
  openPanel: () => void;
  /** Close the reserve panel */
  closePanel: () => void;
  /** Submit a document for reserve processing */
  submitJob: (
    docId: string,
    fileName: string,
    text: string,
    targets: ExtractionTarget[],
    originalResults: ExtractionResult[]
  ) => void;
  /** Apply reserve results callback (provided by consumer) */
  onApplyResults: (docId: string, results: ReserveResult[]) => void;
  /** Update a job */
  updateJob: (jobId: string, updates: Partial<ReserveProcessorJob>) => void;
  /** Number of improved results across all done jobs */
  totalImproved: number;
  /** Whether any jobs are currently processing */
  isProcessing: boolean;
  /** The panel component to render */
  PanelComponent: React.ReactNode;
}
// ─── Hook: useReserveProcessor ───────────────────────────────────────────────

export interface UseReserveProcessorReturn {
  jobs: ReserveProcessorJob[];
  isOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  submitJob: (
    docId: string,
    fileName: string,
    text: string,
    targets: ExtractionTarget[],
    originalResults: ExtractionResult[]
  ) => void;
  onApplyResults: (docId: string, results: ReserveResult[]) => void;
  updateJob: (jobId: string, updates: Partial<ReserveProcessorJob>) => void;
  totalImproved: number;
  isProcessing: boolean;
  PanelComponent: React.ReactNode;
}

export function useReserveProcessor(
  applyResultsCallback: (docId: string, results: ReserveResult[]) => void
): UseReserveProcessorReturn {
  const [jobs, setJobs] = useState<ReserveProcessorJob[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // ── FIX 1: Use refs for stable references in async processing ──
  const processingRef = useRef(false);
  const jobsRef = useRef(jobs);
  const applyCallbackRef = useRef(applyResultsCallback);

  // Keep refs in sync
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);
  useEffect(() => { applyCallbackRef.current = applyResultsCallback; }, [applyResultsCallback]);

  const updateJob = useCallback((jobId: string, updates: Partial<ReserveProcessorJob>) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...updates } : j));
  }, []);

  // ── FIX 2: submitJob uses functional setState to avoid stale closure ──
  const submitJob = useCallback((
    docId: string,
    fileName: string,
    text: string,
    targets: ExtractionTarget[],
    originalResults: ExtractionResult[]
  ) => {
    const job: ReserveProcessorJob = {
      id: uid(),
      docId,
      fileName,
      text,
      targets,
      originalResults,
      status: 'queued',
      progress: 0,
      progressMsg: '',
      reserveResults: [],
      error: null,
      startedAt: null,
      completedAt: null,
    };

    setJobs(prev => {
      // Check inside functional update to avoid stale closure
      const exists = prev.some(
        j => j.docId === docId && (j.status === 'queued' || j.status === 'processing')
      );
      if (exists) {
        console.log(`[Reserve] Skipping duplicate job for doc ${docId}`);
        return prev;
      }
      console.log(`[Reserve] Queued job for "${fileName}" (doc: ${docId})`);
      return [job, ...prev];
    });
  }, []); // No dependencies needed — uses functional setState

  const openPanel = useCallback(() => setIsOpen(true), []);
  const closePanel = useCallback(() => setIsOpen(false), []);

  const onApplyResults = useCallback(
    (docId: string, results: ReserveResult[]) => {
      console.log(`[Reserve] Applying ${results.filter(r => r.improved).length} improved results for doc ${docId}`);
      applyCallbackRef.current(docId, results);
    },
    []
  );

  // ── FIX 3: Completely rewritten job processor with proper async handling ──
  useEffect(() => {
    const processNext = async () => {
      if (processingRef.current) return;

      // Find next queued job from current state
      const currentJobs = jobsRef.current;
      const nextJob = currentJobs.find(j => j.status === 'queued');
      if (!nextJob) return;

      processingRef.current = true;
      console.log(`[Reserve] Starting processing: "${nextJob.fileName}"`);

      // Mark as processing
      setJobs(prev => prev.map(j =>
        j.id === nextJob.id
          ? { ...j, status: 'processing' as const, progress: 0, progressMsg: 'Starting reserve analysis...', startedAt: Date.now() }
          : j
      ));

      try {
        // Give React time to render the processing state
        await new Promise(r => setTimeout(r, 100));

        // Create a progress updater that batches updates
        let lastProgressUpdate = 0;
        const progressUpdater = (progress: number, msg: string) => {
          const now = Date.now();
          // Throttle progress updates to every 200ms
          if (now - lastProgressUpdate > 200 || progress >= 100) {
            lastProgressUpdate = now;
            setJobs(prev => prev.map(j =>
              j.id === nextJob.id
                ? { ...j, progress, progressMsg: msg }
                : j
            ));
          }
        };

        // Run the actual extraction
        const reserveResults = runReserveExtraction(
          nextJob.text,
          nextJob.targets,
          nextJob.originalResults,
          progressUpdater
        );

        const improvedCount = reserveResults.filter(r => r.improved).length;
        console.log(`[Reserve] Completed "${nextJob.fileName}": ${improvedCount} improved out of ${reserveResults.length}`);

        // Log what was improved for debugging
        for (const r of reserveResults) {
          if (r.improved) {
            const orig = nextJob.originalResults.find(o => o.targetId === r.targetId);
            console.log(`[Reserve] ✓ "${r.targetLabel}": "${orig?.value || '—'}" (${orig?.confidence || 0}%) → "${r.value}" (${r.confidence}%) via ${r.technique}`);
          }
        }

        // Mark as done
        setJobs(prev => prev.map(j =>
          j.id === nextJob.id
            ? {
                ...j,
                status: 'done' as const,
                progress: 100,
                progressMsg: 'Complete',
                reserveResults,
                completedAt: Date.now(),
              }
            : j
        ));

        // Auto-apply: call the callback with improved results
        if (improvedCount > 0) {
          // Small delay to ensure state is committed
          await new Promise(r => setTimeout(r, 50));
          console.log(`[Reserve] Auto-applying ${improvedCount} improvements for doc ${nextJob.docId}`);
          applyCallbackRef.current(nextJob.docId, reserveResults);
        }

      } catch (err: any) {
        console.error(`[Reserve] Failed for "${nextJob.fileName}":`, err);
        setJobs(prev => prev.map(j =>
          j.id === nextJob.id
            ? {
                ...j,
                status: 'failed' as const,
                error: err.message || 'Reserve processing failed',
                completedAt: Date.now(),
              }
            : j
        ));
      }

      processingRef.current = false;

      // Check for more queued jobs after a small delay
      setTimeout(processNext, 200);
    };

    // Trigger processing whenever jobs change and there's something queued
    const hasQueued = jobs.some(j => j.status === 'queued');
    if (hasQueued && !processingRef.current) {
      processNext();
    }
  }, [jobs]); // Only depend on jobs — callbacks use refs

  const totalImproved = jobs.reduce(
    (sum, j) => sum + (j.status === 'done' ? j.reserveResults.filter(r => r.improved).length : 0),
    0
  );

  const isProcessing = jobs.some(j => j.status === 'processing' || j.status === 'queued');

  const PanelComponent = (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
      `}</style>
      <ReserveProcessorPanel
        isOpen={isOpen}
        onClose={closePanel}
        jobs={jobs}
        onApplyResults={onApplyResults}
        onUpdateJob={updateJob}
      />
    </>
  );

  return {
    jobs,
    isOpen,
    openPanel,
    closePanel,
    submitJob,
    onApplyResults,
    updateJob,
    totalImproved,
    isProcessing,
    PanelComponent,
  };
}