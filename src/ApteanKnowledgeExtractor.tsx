import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  Copy,
  Check,
  Send,
  Settings,
  FileText,
  FileType,
  File,
  X,
  Trash2,
  AlertCircle,
  CheckCircle,
  Loader2,
  CopyPlus,
  Download,
  Radio,
  WifiOff,
  ClipboardPaste,
  FileDown,
  PlayCircle,
  SkipForward,
  RefreshCw,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:3001/api";

const TOKEN_ENDPOINT = "https://appcentral-int.aptean.com/iam/auth/realms/aptean/protocol/openid-connect/token";
const TOKEN_CLIENT_ID = "PXK96UTIIQ7935FP1-SERVICE";
const TOKEN_CLIENT_SECRET = "xdNBlj3EAecKALhoH8Af3sSwScOxpn7u";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedDocument {
  id: string;
  filename: string;
  fileType: string;
  text: string;
  timestamp: number;
  copied: boolean;
  sent: boolean;
  sending: boolean;
  error?: string;
}

interface IncomingRequest {
  id: string;
  download_url: string | null;
  filename: string | null;
  timestamp: number;
  message: string | null;
  type: 'download' | 'text';
  text: string | null;
}

// ─── Batch send state ─────────────────────────────────────────────────────────

interface BatchSendState {
  active: boolean;
  total: number;
  current: number;
  currentFilename: string;
  succeeded: number;
  failed: number;
  skipped: number;
}

// ─── CORS Proxy helpers ───────────────────────────────────────────────────────

const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://cors-anywhere.herokuapp.com/',
];

async function fetchWithCorsHandling(
  url: string,
  options: RequestInit,
  useCorsProxy: boolean
): Promise<Response> {
  if (!useCorsProxy) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error: any) {
      if (error.message?.includes('CORS') || error.message?.includes('Failed to fetch')) {
        console.log('Direct request failed, trying with CORS proxy...');
      } else {
        throw error;
      }
    }
  }

  for (const proxy of CORS_PROXIES) {
    try {
      const proxyUrl = `${proxy}${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl, {
        ...options,
        credentials: 'omit',
      });
      return response;
    } catch (error) {
      console.log(`Proxy ${proxy} failed, trying next...`);
      continue;
    }
  }

  try {
    await fetch(url, {
      ...options,
      mode: 'no-cors',
    });
    return new Response(null, { status: 200, statusText: 'OK (no-cors mode)' });
  } catch (error) {
    throw new Error('All request methods failed. Check the endpoint URL.');
  }
}

// ─── Utility: Clean whitespace and special characters ─────────────────────────

function cleanText(raw: string): string {
  let text = raw;
  text = text.replace(/ﬁ/g, 'fi');
  text = text.replace(/ﬂ/g, 'fl');
  text = text.replace(/ﬀ/g, 'ff');
  text = text.replace(/ﬃ/g, 'ffi');
  text = text.replace(/ﬄ/g, 'ffl');
  text = text.replace(/[—–―‐‑‒­]/g, '-');
  text = text.replace(/[""„‟]/g, '"');
  text = text.replace(/[''‚]/g, "'");
  text = text.replace(/[•◦▪▫●○■□►▶‣⁃∙·]/g, '-');
  text = text.replace(/…/g, '...');
  text = text.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');
  text = text.replace(/\u00AD/g, '');
  text = text.replace(/-\s*[\r\n]+\s*/g, '');
  text = text.replace(/[\r\n\t]+/g, ' ');
  text = text.replace(/([!@#%^&*()_+=\[\]{};':"\\|,.<>\/?~`-])\1+/g, '$1');
  text = text.replace(/[!@#%^&*()_+=[\]{};':"\\|,.<>/?~`-]{3,}/g, ' ');
  text = text.replace(/\b(\w)\s+(?=\w\b)/g, (match, char, offset, string) => {
    const ahead = string.slice(offset, offset + 20);
    const singleCharPattern = /^(\w\s+){2,}\w\b/;
    if (singleCharPattern.test(ahead)) {
      return char;
    }
    return match;
  });
  text = text.replace(
    /\b([a-zA-Z])\s+([a-zA-Z])\s+([a-zA-Z])\s+([a-zA-Z])\s+([a-zA-Z])\b/g,
    '$1$2$3$4$5'
  );
  text = text.replace(
    /\b([a-zA-Z])\s+([a-zA-Z])\s+([a-zA-Z])\s+([a-zA-Z])\b/g,
    '$1$2$3$4'
  );
  text = text.replace(/\b([a-zA-Z])\s+([a-zA-Z])\s+([a-zA-Z])\b/g, '$1$2$3');
  text = text.replace(/\s{2,}/g, ' ');
  text = text.replace(/\s+([.,;:!?)])/g, '$1');
  text = text.replace(/([([])\s+/g, '$1');
  text = text.trim();
  return text;
}

// ─── Utility: Generate ID ────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── PDF.js Loader ────────────────────────────────────────────────────────────

let pdfJsLoadPromise: Promise<any> | null = null;

async function loadPdfJs(): Promise<any> {
  if (pdfJsLoadPromise) return pdfJsLoadPromise;

  pdfJsLoadPromise = new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }
    const version = '3.11.174';
    const script = document.createElement('script');
    script.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.min.js`;
    script.async = true;
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
        resolve(pdfjsLib);
      } else {
        reject(new Error('PDF.js failed to load'));
      }
    };
    script.onerror = () => {
      pdfJsLoadPromise = null;
      reject(new Error('Failed to load PDF.js from CDN'));
    };
    document.head.appendChild(script);
  });

  return pdfJsLoadPromise;
}

// ─── Text extraction helpers ──────────────────────────────────────────────────

async function extractFromTxt(file: File): Promise<string> {
  return cleanText(await file.text());
}

async function extractFromPdf(file: File): Promise<string> {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
    cMapPacked: true,
  });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let lastX: number | null = null;
    let lineText = '';
    const lines: string[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const textItem = item as any;
      const currentY = textItem.transform[5];
      const currentX = textItem.transform[4];
      const text = textItem.str;
      if (lastY !== null && Math.abs(currentY - lastY) > 5) {
        if (lineText.trim()) lines.push(lineText.trim());
        lineText = text;
      } else {
        if (lastX !== null && text.length > 0) {
          const gap = currentX - lastX;
          if (gap > 10 && !lineText.endsWith(' ') && !text.startsWith(' ')) lineText += ' ';
        }
        lineText += text;
      }
      lastY = currentY;
      lastX = currentX + (textItem.width || 0);
    }
    if (lineText.trim()) lines.push(lineText.trim());
    pages.push(lines.join(' '));
  }
  return cleanText(pages.join(' '));
}

async function extractFromDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return cleanText(result.value);
}

async function extractText(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'txt': return extractFromTxt(file);
    case 'pdf': return extractFromPdf(file);
    case 'docx': return extractFromDocx(file);
    default: throw new Error(`Unsupported format: .${ext}`);
  }
}

function getFileTypeLabel(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'pdf': return 'PDF';
    case 'docx': return 'DOCX';
    case 'txt': return 'TXT';
    default: return ext.toUpperCase();
  }
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'pdf': return FileType;
    case 'docx': return FileText;
    default: return File;
  }
}

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

const STORAGE_DOCS_KEY = 'aptean-extractor-documents';
const STORAGE_TOKEN_KEY = 'aptean-extractor-bearer-token';

function loadDocuments(): ExtractedDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_DOCS_KEY);
    if (!raw) return [];
    const docs = JSON.parse(raw) as ExtractedDocument[];
    return docs.map((d) => ({ ...d, sending: false }));
  } catch { return []; }
}

function saveDocuments(docs: ExtractedDocument[]) {
  const toSave = docs.map(({ sending, ...rest }) => ({ ...rest, sending: false }));
  localStorage.setItem(STORAGE_DOCS_KEY, JSON.stringify(toSave));
}

function loadBearerToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_TOKEN_KEY);
  } catch { return null; }
}

function saveBearerToken(token: string) {
  localStorage.setItem(STORAGE_TOKEN_KEY, token);
}

// ─── Save as Markdown helper ──────────────────────────────────────────────────

function triggerMarkdownSave(text: string) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function triggerMarkdownSaveAs(text: string): Promise<boolean> {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: '.md',
        types: [{ description: 'Markdown File', accept: { 'text/markdown': ['.md'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return true;
    } catch (err: any) {
      if (err.name === 'AbortError') return false;
    }
  }
  triggerMarkdownSave(text);
  return true;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2.5 pointer-events-none">
      {toasts.map((t, index) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium shadow-2xl backdrop-blur-2xl border transition-all duration-200 animate-in slide-in-from-right-5 fade-in ${
            t.type === 'success' ? 'bg-emerald-950/80 text-emerald-200 border-emerald-500/25 shadow-emerald-500/10'
            : t.type === 'error' ? 'bg-red-950/80 text-red-200 border-red-500/25 shadow-red-500/10'
            : 'bg-blue-950/80 text-blue-200 border-blue-500/25 shadow-blue-500/10'
          }`}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          {t.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            : t.type === 'error' ? <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            : <Download className="w-4 h-4 text-blue-400 shrink-0" />}
          <span className="flex-1 text-[13px]">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="ml-1 p-0.5 rounded-md hover:bg-white/10 transition-colors">
            <X className="w-3.5 h-3.5 opacity-50 hover:opacity-100 transition-opacity" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────

function DocumentSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/[0.06]" />
        <div className="flex-1 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="h-4 w-36 rounded-md bg-white/[0.06]" />
            <div className="h-4 w-10 rounded-md bg-white/[0.04]" />
          </div>
          <div className="h-3 w-full rounded-md bg-white/[0.04]" />
          <div className="h-2.5 w-24 rounded-md bg-white/[0.03]" />
        </div>
        <div className="flex gap-1.5">
          <div className="h-8 w-16 rounded-lg bg-white/[0.04]" />
          <div className="h-8 w-16 rounded-lg bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}

// ─── Batch Progress Banner ────────────────────────────────────────────────────

function BatchProgressBanner({ batch }: { batch: BatchSendState }) {
  const pct = batch.total > 0 ? Math.round((batch.current / batch.total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] backdrop-blur-sm p-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-200">
              Sending batch… {batch.current} / {batch.total}
            </p>
            <p className="text-[11px] text-indigo-300/50 truncate max-w-[280px]">
              {batch.currentFilename || 'Preparing…'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] shrink-0">
          {batch.succeeded > 0 && (
            <span className="flex items-center gap-1 text-emerald-400">
              <Check className="w-3 h-3" />{batch.succeeded}
            </span>
          )}
          {batch.skipped > 0 && (
            <span className="flex items-center gap-1 text-yellow-400">
              <SkipForward className="w-3 h-3" />{batch.skipped}
            </span>
          )}
          {batch.failed > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <AlertCircle className="w-3 h-3" />{batch.failed}
            </span>
          )}
        </div>
      </div>
      <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-indigo-300/30 mt-1.5 text-right">{pct}%</p>
    </div>
  );
}

// ─── Incoming Request Modal ───────────────────────────────────────────────────

function IncomingRequestModal({ request, onClose, onAction }: { request: IncomingRequest; onClose: () => void; onAction: () => void }) {
  const getFilenameFromUrl = (url: string): string => {
    try { const urlObj = new URL(url); return urlObj.pathname.split('/').pop() || 'download'; }
    catch { return 'download'; }
  };
  const isDownload = request.type === 'download' && request.download_url;
  const filename = request.filename || (request.download_url ? getFilenameFromUrl(request.download_url) : 'Text request');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative bg-[#111118] border border-white/[0.08] rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200 shadow-black/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${isDownload ? 'bg-blue-500/10 ring-1 ring-blue-500/20' : 'bg-emerald-500/10 ring-1 ring-emerald-500/20'}`}>
              {isDownload ? <Download className="w-5 h-5 text-blue-400" /> : <FileText className="w-5 h-5 text-emerald-400" />}
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-white/90">{isDownload ? 'Download Available' : 'Text Request Received'}</h3>
              <p className="text-xs text-white/35 mt-0.5">{isDownload ? 'New file ready for download' : 'New text content received'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-all duration-150"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isDownload ? 'bg-indigo-500/10' : 'bg-emerald-500/10'}`}>
                <FileText className={`w-6 h-6 ${isDownload ? 'text-indigo-400' : 'text-emerald-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/85 truncate">{filename}</p>
                {request.download_url && <p className="text-xs text-white/25 truncate mt-0.5">{request.download_url}</p>}
                {request.text && !request.download_url && <p className="text-xs text-white/25 mt-0.5 line-clamp-2">{request.text.length.toLocaleString()} characters</p>}
              </div>
            </div>
            {request.message && <p className="text-xs text-white/45 mt-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04]">{request.message}</p>}
            {request.text && (
              <div className="mt-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04] max-h-32 overflow-y-auto">
                <p className="text-xs text-white/35 whitespace-pre-wrap break-words line-clamp-6 font-mono">{request.text}</p>
              </div>
            )}
          </div>
          <div className="text-[11px] text-white/20 px-1">Received {new Date(request.timestamp).toLocaleTimeString()}</div>
        </div>
        <div className="flex gap-2.5 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-white/50 bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.08] transition-all duration-150">Dismiss</button>
          {isDownload ? (
            <a href={request.download_url!} target="_blank" rel="noopener noreferrer" onClick={onAction} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-500/80 rounded-xl hover:bg-blue-500 transition-all duration-150 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"><Download className="w-4 h-4" />Download</a>
          ) : (
            <button onClick={onAction} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-500/80 rounded-xl hover:bg-emerald-500 transition-all duration-150 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"><Copy className="w-4 h-4" />Copy Text</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Paste-to-Markdown Panel ──────────────────────────────────────────────────

function PasteToMarkdownPanel({ onSaved, onError }: { onSaved: () => void; onError: (msg: string) => void }) {
  const [pasteText, setPasteText] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const clipboardText = e.clipboardData.getData('text/plain');
      if (!clipboardText.trim()) return;
      setTimeout(async () => {
        setSaving(true);
        try {
          const success = await triggerMarkdownSaveAs(clipboardText.trim());
          if (success) { onSaved(); setPasteText(''); }
        } catch (err: any) { onError(err.message || 'Failed to save markdown file'); }
        finally { setSaving(false); }
      }, 50);
    },
    [onSaved, onError]
  );

  const handleManualSave = useCallback(async () => {
    if (!pasteText.trim()) return;
    setSaving(true);
    try {
      const success = await triggerMarkdownSaveAs(pasteText.trim());
      if (success) { onSaved(); setPasteText(''); }
    } catch (err: any) { onError(err.message || 'Failed to save markdown file'); }
    finally { setSaving(false); }
  }, [pasteText, onSaved, onError]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleManualSave(); }
    },
    [handleManualSave]
  );

  return (
    <div className="flex flex-col h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden transition-all duration-200 hover:border-white/[0.1]">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.04] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 ring-1 ring-violet-500/15 flex items-center justify-center">
            <ClipboardPaste className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-white/70">Paste to Markdown</h3>
            <p className="text-[11px] text-white/25">Paste text — instantly save as .md</p>
          </div>
        </div>
        {pasteText.trim() && (
          <button onClick={handleManualSave} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-violet-500/80 hover:bg-violet-500 transition-all duration-150 shadow-lg shadow-violet-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-wait">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            Save .md
          </button>
        )}
      </div>

      <div className="relative flex-1 min-h-0">
        <textarea
          ref={textareaRef}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          placeholder="Paste text here (Ctrl/Cmd+V)&#10;&#10;File save dialog opens immediately…"
          className="w-full h-full px-4 py-3.5 text-sm text-white/80 bg-transparent border-none resize-none focus:outline-none placeholder-white/15 leading-relaxed"
        />
        {saving && (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <div className="flex items-center gap-2.5 text-sm text-violet-300 font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              Opening save dialog…
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-white/[0.03] flex items-center justify-between shrink-0">
        <span className="text-[11px] text-white/15">
          {pasteText.length > 0 ? `${pasteText.length.toLocaleString()} chars` : 'Waiting for paste…'}
        </span>
        <span className="text-[11px] text-white/15">
          {pasteText.trim() ? '⌘/Ctrl+Enter to save' : '⌘/Ctrl+V to paste'}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ApteanKnowledgeExtractor() {
  const [documents, setDocuments] = useState<ExtractedDocument[]>(loadDocuments);
  const [isDragOver, setIsDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pdfReady, setPdfReady] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [currentIncomingRequest, setCurrentIncomingRequest] = useState<IncomingRequest | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookResponse, setWebhookResponse] = useState<any>(null);
  const [resettingToken, setResettingToken] = useState(false);
  const [bearerToken, setBearerToken] = useState<string | null>(loadBearerToken);

  const WEBHOOK_TIMEOUT = 420000;

  // ─── Batch send state ──────────────────────────────────────────────────────
  const [batchSend, setBatchSend] = useState<BatchSendState>({
    active: false,
    total: 0,
    current: 0,
    currentFilename: '',
    succeeded: 0,
    failed: 0,
    skipped: 0,
  });
  const batchAbortRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesOnlyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const timer = setTimeout(() => setMounted(true), 50); return () => clearTimeout(timer); }, []);
  useEffect(() => { loadPdfJs().then(() => setPdfReady(true)).catch((err) => console.warn('PDF.js preload failed:', err)); }, []);
  useEffect(() => { saveDocuments(documents); }, [documents]);

  // ─── Reset Bearer Token ─────────────────────────────────────────────────

  const handleResetBearerToken = useCallback(async () => {
    setResettingToken(true);
    try {
      const body = new URLSearchParams();
      body.append('client_id', TOKEN_CLIENT_ID);
      body.append('client_secret', TOKEN_CLIENT_SECRET);
      body.append('grant_type', 'client_credentials');

      // Try via backend proxy first to avoid CORS
      let response: Response;
      try {
        response = await fetch(`${API_BASE}/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenUrl: TOKEN_ENDPOINT,
            clientId: TOKEN_CLIENT_ID,
            clientSecret: TOKEN_CLIENT_SECRET,
          }),
        });
      } catch {
        // Fallback: direct call (may fail due to CORS in browser)
        response = await fetch(TOKEN_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Token request failed (${response.status}): ${errText}`);
      }

      const data = await response.json();
      const token = data.access_token;

      if (!token) {
        throw new Error('No access_token in response');
      }

      setBearerToken(token);
      saveBearerToken(token);
      addToast('Bearer token reset successfully', 'success');
    } catch (err: any) {
      console.error('Token reset failed:', err);
      addToast(`Token reset failed: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setResettingToken(false);
    }
  }, []);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const dismissToast = useCallback((id: string) => { setToasts((prev) => prev.filter((t) => t.id !== id)); }, []);

  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }, []);

  const processFiles = useCallback(async (files: File[]) => {
    const validExts = ['pdf', 'docx', 'txt'];
    const valid = files.filter((f) => { const ext = f.name.split('.').pop()?.toLowerCase() ?? ''; return validExts.includes(ext); });
    if (valid.length === 0) { addToast('No supported files. Accepts .pdf, .docx, .txt', 'error'); return; }
    if (valid.length < files.length) addToast(`${files.length - valid.length} unsupported file(s) skipped`, 'error');
    setProcessing(true);
    const newDocs: ExtractedDocument[] = [];
    const extractedTexts: string[] = [];
    for (const file of valid) {
      try {
        const text = await extractText(file);
        extractedTexts.push(text);
        newDocs.push({ id: generateId(), filename: file.name, fileType: getFileTypeLabel(file.name), text, timestamp: Date.now(), copied: true, sent: false, sending: false });
      } catch (err: any) { console.error('Extraction error:', err); addToast(`Failed: "${file.name}" — ${err.message || 'Unknown error'}`, 'error'); }
    }
    if (newDocs.length > 0) {
      const combinedText = extractedTexts.join('\n\n');
      const copySuccess = await copyToClipboard(combinedText);
      setDocuments((prev) => [...newDocs, ...prev]);
      if (copySuccess) addToast(`${newDocs.length} document(s) processed & copied to clipboard`, 'success');
      else addToast(`${newDocs.length} document(s) processed (clipboard copy failed)`, 'success');
    }
    setProcessing(false);
  }, [addToast, copyToClipboard]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
    const items = e.dataTransfer.items;
    const files: File[] = [];
    if (items) {
      const entries: FileSystemEntry[] = [];
      for (let i = 0; i < items.length; i++) { const entry = items[i].webkitGetAsEntry?.(); if (entry) entries.push(entry); }
      const readEntry = async (entry: FileSystemEntry): Promise<File[]> => {
        if (entry.isFile) return new Promise((resolve) => { (entry as FileSystemFileEntry).file((f) => resolve([f])); });
        else if (entry.isDirectory) {
          const dirReader = (entry as FileSystemDirectoryEntry).createReader();
          const subEntries = await new Promise<FileSystemEntry[]>((resolve) => { dirReader.readEntries((ents) => resolve(ents)); });
          const allFiles: File[] = [];
          for (const sub of subEntries) allFiles.push(...(await readEntry(sub)));
          return allFiles;
        }
        return [];
      };
      for (const entry of entries) files.push(...(await readEntry(entry)));
    } else { for (let i = 0; i < e.dataTransfer.files.length; i++) files.push(e.dataTransfer.files[i]); }
    if (files.length > 0) processFiles(files);
  }, [processFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) processFiles(files);
    e.target.value = '';
  }, [processFiles]);

  const handleCopy = useCallback(async (id: string) => {
    const doc = documents.find((d) => d.id === id);
    if (!doc) return;
    try { await navigator.clipboard.writeText(doc.text); setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, copied: true } : d))); addToast('Copied to clipboard', 'success'); }
    catch { addToast('Failed to copy', 'error'); }
  }, [documents, addToast]);

  const handleCopyAllUncopied = useCallback(async () => {
    const uncopiedDocs = documents.filter((d) => !d.copied);
    if (uncopiedDocs.length === 0) { addToast('No uncopied documents to copy', 'error'); return; }
    const combinedText = uncopiedDocs.map((d) => d.text).join('\n\n');
    try { await navigator.clipboard.writeText(combinedText); const uncopiedIds = new Set(uncopiedDocs.map((d) => d.id)); setDocuments((prev) => prev.map((d) => (uncopiedIds.has(d.id) ? { ...d, copied: true } : d))); addToast(`Copied ${uncopiedDocs.length} document(s) to clipboard`, 'success'); }
    catch { addToast('Failed to copy', 'error'); }
  }, [documents, addToast]);

  // ─── Core single-doc send ─────────────────────────────────────────────────

  const sendOneDocument = useCallback(async (doc: ExtractedDocument): Promise<boolean> => {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), WEBHOOK_TIMEOUT);

    try {
      const res = await fetch(`${API_BASE}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text_key: 'text',
          data: { text: JSON.stringify({ payload: doc.text }) },
          queryResult: {
            success: true,
            data: [{ text: doc.text, filename: doc.filename, fileType: doc.fileType }],
            columns: ['text', 'filename', 'fileType'],
            rowCount: 1,
            command: 'extract key details and upload to sharepoint',
          },
          metadata: {
            query: `Extract the key text in this and upload to sharepoint. The document is: ${doc.filename}`,
            sql: '',
            duration: 0,
            rowCount: 1,
            columns: ['text', 'filename', 'fileType'],
            command: 'extract the key details from the text and upload to sharepoint',
            filename: doc.filename,
            fileType: doc.fileType,
            source: 'knowledge-extractor',
            sentAt: new Date().toISOString(),
          },
        }),
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (res.status === 504) {
        console.log(`[batch] 504 on "${doc.filename}" — treating as success`);
        return true;
      }

      const result = await res.json();
      if (result.success) {
        setWebhookResponse(result);
        return true;
      }
      throw new Error(result.error || 'Webhook returned failure');
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Timeout after ${WEBHOOK_TIMEOUT / 1000}s`);
      }
      throw err;
    }
  }, []);

  // ─── Individual "Post" button handler ──────────────────────────────────────

  const handlePost = useCallback(async (id: string) => {
    const doc = documents.find((d) => d.id === id);
    if (!doc) return;

    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, sending: true, error: undefined } : d)));

    try {
      const ok = await sendOneDocument(doc);
      if (ok) {
        setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, sent: true, sending: false } : d)));
        setShowWebhookModal(true);
        addToast('Document sent successfully', 'success');
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error';
      setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, sending: false, error: errorMsg } : d)));
      addToast(`Send failed: ${errorMsg}`, 'error');
    }
  }, [documents, sendOneDocument, addToast]);

  // ─── Batch send all unsent docs ─────────────────────────────────────────────

  const handleSendAll = useCallback(async () => {
    const unsent = documents.filter((d) => !d.sent && !d.sending);
    if (unsent.length === 0) { addToast('No unsent documents', 'error'); return; }

    batchAbortRef.current = false;
    setBatchSend({ active: true, total: unsent.length, current: 0, currentFilename: '', succeeded: 0, failed: 0, skipped: 0 });

    let succeeded = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < unsent.length; i++) {
      if (batchAbortRef.current) break;

      const doc = unsent[i];

      setBatchSend((prev) => ({ ...prev, current: i + 1, currentFilename: doc.filename }));
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, sending: true, error: undefined } : d)));

      try {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), WEBHOOK_TIMEOUT);

        try {
          const res = await fetch(`${API_BASE}/webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text_key: 'text',
              data: { text: JSON.stringify({ payload: doc.text }) },
              queryResult: {
                success: true,
                data: [{ text: doc.text, filename: doc.filename, fileType: doc.fileType }],
                columns: ['text', 'filename', 'fileType'],
                rowCount: 1,
                command: 'extract key details and upload to sharepoint',
              },
              metadata: {
                query: `Extract the key text in this and upload to sharepoint. The document is: ${doc.filename}`,
                sql: '',
                duration: 0,
                rowCount: 1,
                columns: ['text', 'filename', 'fileType'],
                command: 'extract the key details from the text and upload to sharepoint',
                filename: doc.filename,
                fileType: doc.fileType,
                source: 'knowledge-extractor',
                sentAt: new Date().toISOString(),
              },
            }),
            signal: abortController.signal,
          });

          clearTimeout(timeoutId);

          if (res.status === 504) {
            skipped++;
            setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, sent: true, sending: false } : d)));
            setBatchSend((prev) => ({ ...prev, skipped }));
            addToast(`"${doc.filename}" — 504 (treated as success)`, 'info');
          } else {
            const result = await res.json();
            if (result.success) {
              succeeded++;
              setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, sent: true, sending: false } : d)));
              setBatchSend((prev) => ({ ...prev, succeeded }));
            } else {
              throw new Error(result.error || 'Webhook returned failure');
            }
          }
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          if (fetchErr.name === 'AbortError') {
            throw new Error(`Timeout after ${WEBHOOK_TIMEOUT / 1000}s`);
          }
          throw fetchErr;
        }
      } catch (err: any) {
        failed++;
        const errorMsg = err.message || 'Unknown error';
        setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, sending: false, error: errorMsg } : d)));
        setBatchSend((prev) => ({ ...prev, failed }));
        addToast(`Failed: "${doc.filename}" — ${errorMsg}`, 'error');
      }

      if (i < unsent.length - 1 && !batchAbortRef.current) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    setBatchSend((prev) => ({ ...prev, active: false }));

    const parts: string[] = [];
    if (succeeded > 0) parts.push(`${succeeded} sent`);
    if (skipped > 0) parts.push(`${skipped} accepted (504)`);
    if (failed > 0) parts.push(`${failed} failed`);
    addToast(`Batch complete — ${parts.join(', ')}`, failed > 0 ? 'error' : 'success');
  }, [documents, addToast]);

  const handleDelete = useCallback((id: string) => { setDocuments((prev) => prev.filter((d) => d.id !== id)); }, []);
  const handleClearAll = useCallback(() => { setDocuments([]); addToast('All documents cleared', 'success'); }, [addToast]);

  const handleCloseRequestModal = useCallback(() => { setCurrentIncomingRequest(null); }, []);

  const handleRequestAction = useCallback(async () => {
    if (currentIncomingRequest?.type === 'text' && currentIncomingRequest.text) {
      try { await navigator.clipboard.writeText(currentIncomingRequest.text); addToast('Text copied to clipboard', 'success'); }
      catch { addToast('Failed to copy text', 'error'); }
    } else { addToast('Download started', 'success'); }
    setCurrentIncomingRequest(null);
  }, [currentIncomingRequest, addToast]);

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  const truncate = (text: string, len: number) => text.length <= len ? text : text.slice(0, len) + '…';
  const uncopiedCount = documents.filter((d) => !d.copied).length;
  const unsentCount = documents.filter((d) => !d.sent).length;

  return (
    <div className="min-h-dvh text-white relative overflow-hidden selection:bg-indigo-500/30 bg-[#0a0a12]">

      <div className={`relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>

        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <h1 className="text-[22px] sm:text-2xl font-bold text-white/95 tracking-tight leading-tight">Aptean Knowledge Extractor</h1>
            <p className="text-[13px] text-white/30 leading-relaxed">
              Extract &amp; clean text from PDF, DOCX &amp; TXT files
              {!pdfReady && <span className="ml-2 inline-flex items-center gap-1 text-yellow-400/60"><Loader2 className="w-3 h-3 animate-spin" />Loading PDF support…</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Bearer Token Status */}
            {bearerToken && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Check className="w-3 h-3" />
                <span className="hidden sm:inline">Token Active</span>
              </div>
            )}
            {/* Reset Bearer Token Button */}
            <button
              onClick={handleResetBearerToken}
              disabled={resettingToken}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-95 border ${
                resettingToken
                  ? 'bg-white/[0.03] text-white/20 border-white/[0.06] cursor-wait'
                  : 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20 hover:border-orange-500/30 hover:text-orange-300'
              }`}
              title="Reset Bearer Token"
              aria-label="Reset Bearer Token"
            >
              {resettingToken ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{resettingToken ? 'Resetting…' : 'Reset Token'}</span>
            </button>
          </div>
        </header>

        {/* Drop Zone + Paste to Markdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Left: Drop Zone */}
          <div className="flex flex-col">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => filesOnlyInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload files by clicking or dropping"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); filesOnlyInputRef.current?.click(); } }}
              className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a12] flex-1 min-h-[220px] flex items-center justify-center ${
                isDragOver ? 'border-indigo-400/50 bg-indigo-500/[0.08] scale-[1.005] shadow-lg shadow-indigo-500/5' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]'
              } ${processing ? 'pointer-events-none opacity-50' : ''}`}
            >
              <div className="flex flex-col items-center justify-center py-10 sm:py-14 px-6">
                {processing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
                    <p className="text-sm font-medium text-white/70">Processing files…</p>
                    <p className="text-xs text-white/25 mt-1.5">Please wait</p>
                  </div>
                ) : (
                  <>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-200 ${isDragOver ? 'bg-indigo-500/15 scale-110' : 'bg-white/[0.04] border border-white/[0.06]'}`}>
                      <Upload className={`w-6 h-6 transition-colors duration-200 ${isDragOver ? 'text-indigo-400' : 'text-white/25'}`} />
                    </div>
                    <p className="text-[15px] font-medium text-white/70">Drop files or folders here</p>
                    <p className="text-xs text-white/25 mt-2 text-center leading-relaxed max-w-xs">or click to browse · PDF, DOCX, TXT · Auto-copies to clipboard</p>
                  </>
                )}
              </div>
              <input ref={filesOnlyInputRef} type="file" multiple accept=".pdf,.docx,.txt" onChange={handleFileInput} className="hidden" />
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.txt" onChange={handleFileInput} className="hidden"
                // @ts-ignore
                webkitdirectory="" directory=""
              />
            </div>
            <div className="flex gap-3 mt-3 justify-center items-center">
              <button onClick={() => filesOnlyInputRef.current?.click()} className="text-xs text-white/25 hover:text-white/50 transition-colors duration-150 py-1 px-1">Select files</button>
              <span className="text-white/10 text-[10px]">·</span>
              <button onClick={() => fileInputRef.current?.click()} className="text-xs text-white/25 hover:text-white/50 transition-colors duration-150 py-1 px-1">Select folder</button>
            </div>
          </div>

          {/* Right: Paste to Markdown */}
          <div className="min-h-[220px]">
            <PasteToMarkdownPanel
              onSaved={() => addToast('Markdown file saved successfully', 'success')}
              onError={(msg) => addToast(msg, 'error')}
            />
          </div>
        </div>

        {/* Batch Progress Banner */}
        {batchSend.active && (
          <div className="mt-6">
            <BatchProgressBanner batch={batchSend} />
          </div>
        )}

        {/* Incoming Requests Queue */}
        {incomingRequests.length > 0 && (
          <section className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-[13px] font-semibold text-white/50 mb-3 flex items-center gap-2">
              <Radio className="w-4 h-4 text-white/30" />
              Incoming Requests
              <span className="text-white/20 font-normal text-xs">({incomingRequests.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {incomingRequests.slice(-6).reverse().map((req) => (
                <div key={req.id} className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.035] transition-all duration-150">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${req.type === 'download' ? 'bg-blue-500/10' : 'bg-emerald-500/10'}`}>
                    {req.type === 'download' ? <Download className="w-4 h-4 text-blue-400" /> : <FileText className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/70 truncate font-medium">{req.filename || (req.type === 'download' ? 'Download' : 'Text request')}</p>
                    <p className="text-[11px] text-white/20 mt-0.5">{formatTime(req.timestamp)}</p>
                  </div>
                  {req.type === 'download' && req.download_url ? (
                    <a href={req.download_url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 transition-colors duration-150">Download</a>
                  ) : req.text ? (
                    <button onClick={async () => { try { await navigator.clipboard.writeText(req.text!); addToast('Copied to clipboard', 'success'); } catch { addToast('Failed to copy', 'error'); } }} className="px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition-colors duration-150">Copy</button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Document List */}
        {documents.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[13px] font-semibold text-white/50 flex items-center gap-1.5">
                Processed Documents
                <span className="text-white/20 font-normal ml-0.5">({documents.length})</span>
              </h2>
              <div className="flex items-center gap-2.5 flex-wrap justify-end">
                {unsentCount > 0 && !batchSend.active && (
                  <button
                    onClick={handleSendAll}
                    className="text-xs font-semibold text-white/80 hover:text-white transition-all duration-150 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 hover:border-indigo-500/50 active:scale-[0.97]"
                  >
                    <PlayCircle className="w-3.5 h-3.5 text-indigo-400" />
                    Send all ({unsentCount})
                  </button>
                )}
                {batchSend.active && (
                  <button
                    onClick={() => { batchAbortRef.current = true; }}
                    className="text-xs font-semibold text-red-400 hover:text-red-300 transition-all duration-150 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] hover:bg-red-500/10 active:scale-[0.97]"
                  >
                    <X className="w-3.5 h-3.5" />
                    Stop batch
                  </button>
                )}
                {uncopiedCount > 0 && (
                  <button onClick={handleCopyAllUncopied} className="text-xs text-white/40 hover:text-indigo-400 transition-all duration-150 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.08] hover:border-indigo-400/30 hover:bg-indigo-500/10 active:scale-[0.97]">
                    <CopyPlus className="w-3.5 h-3.5" />
                    Copy all uncopied ({uncopiedCount})
                  </button>
                )}
                <button onClick={handleClearAll} className="text-xs text-white/20 hover:text-red-400 transition-all duration-150 flex items-center gap-1.5 py-2 px-1.5 rounded-lg hover:bg-red-500/5">
                  <Trash2 className="w-3 h-3" />
                  Clear all
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {processing && <DocumentSkeleton />}
              {documents.map((doc, index) => {
                const IconComp = getFileIcon(doc.filename);
                return (
                  <div
                    key={doc.id}
                    className="group rounded-2xl border border-white/[0.05] bg-white/[0.015] hover:border-white/[0.1] hover:bg-white/[0.035] backdrop-blur-sm transition-all duration-150 p-4 animate-in fade-in slide-in-from-bottom-1 duration-200"
                    style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-150 ${
                        doc.fileType === 'PDF' ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/10'
                        : doc.fileType === 'DOCX' ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/10'
                        : 'bg-white/[0.05] text-white/30 ring-1 ring-white/[0.06]'
                      }`}>
                        <IconComp className="w-[18px] h-[18px]" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-medium text-white/85 truncate max-w-[180px] sm:max-w-[240px] xl:max-w-[200px] 2xl:max-w-none">{doc.filename}</h3>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 uppercase tracking-wider ${
                            doc.fileType === 'PDF' ? 'bg-red-500/10 text-red-400/80'
                            : doc.fileType === 'DOCX' ? 'bg-blue-500/10 text-blue-400/80'
                            : 'bg-white/[0.06] text-white/30'
                          }`}>{doc.fileType}</span>
                          {doc.copied && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400/80 shrink-0 flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" />Copied
                            </span>
                          )}
                          {doc.sent && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400/80 shrink-0 flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" />Sent
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] text-white/20 line-clamp-1 leading-relaxed">{doc.text ? truncate(doc.text, 100) : 'No text extracted'}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-white/15">{formatTime(doc.timestamp)}</span>
                          <span className="text-[11px] text-white/15">{doc.text.length.toLocaleString()} chars</span>
                          {doc.error && <span className="text-[11px] text-red-400/70 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{doc.error}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                        <button
                          onClick={() => handleCopy(doc.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 active:scale-95 ${
                            doc.copied ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/90 text-gray-900 hover:bg-white shadow-sm shadow-white/10'
                          }`}
                          aria-label={doc.copied ? 'Already copied' : 'Copy to clipboard'}
                        >
                          {doc.copied ? <><Check className="w-3.5 h-3.5" /><span className="hidden sm:inline">Copied</span></> : <><Copy className="w-3.5 h-3.5" /><span className="hidden sm:inline">Copy</span></>}
                        </button>
                        <button
                          onClick={() => handlePost(doc.id)}
                          disabled={doc.sending || batchSend.active}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 border active:scale-95 ${
                            doc.sent ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : doc.sending ? 'bg-white/[0.03] text-white/20 border-white/[0.06] cursor-wait'
                            : 'bg-white/[0.04] text-white/50 border-white/[0.08] hover:border-white/[0.14] hover:text-white/70 hover:bg-white/[0.06]'
                          }`}
                          aria-label={doc.sent ? 'Already sent' : doc.sending ? 'Sending...' : 'Post to API'}
                        >
                          {doc.sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : doc.sent ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                          <span className="hidden sm:inline">{doc.sent ? 'Sent' : 'Post'}</span>
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-2 rounded-xl text-white/10 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 opacity-0 group-hover:opacity-100 active:scale-90"
                          title="Delete" aria-label="Delete document"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {documents.length === 0 && !processing && (
          <div className="mt-20 text-center animate-in fade-in duration-500">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-5">
              <FileText className="w-7 h-7 text-white/10" />
            </div>
            <p className="text-sm font-medium text-white/25">No documents yet</p>
            <p className="text-xs text-white/15 mt-1.5">Upload files or paste text to get started</p>
          </div>
        )}
      </div>

      {currentIncomingRequest && (
        <IncomingRequestModal request={currentIncomingRequest} onClose={handleCloseRequestModal} onAction={handleRequestAction} />
      )}

      {/* Webhook Response Modal */}
      {showWebhookModal && webhookResponse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowWebhookModal(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Webhook Response</h2>
                <p className="text-sm text-slate-400 mt-1">Status: <span className="text-green-400 font-semibold">{webhookResponse.webhookStatus}</span></p>
              </div>
              <button onClick={() => setShowWebhookModal(false)} className="text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-6">
              {webhookResponse.text && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Extracted Response:</h3>
                  <div className="bg-slate-950 border border-slate-700 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <div className="text-sm text-slate-200 whitespace-pre-wrap break-words leading-relaxed">{webhookResponse.text}</div>
                  </div>
                </div>
              )}
              {webhookResponse._debug && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Response Structure:</h3>
                  <div className="bg-slate-950 border border-slate-700 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <div className="text-xs text-slate-300 font-mono">{JSON.stringify(webhookResponse._debug, null, 2)}</div>
                  </div>
                </div>
              )}
              <details>
                <summary className="text-sm font-semibold text-slate-300 cursor-pointer hover:text-slate-100 transition-colors">Full Response JSON</summary>
                <div className="mt-3 bg-slate-950 border border-slate-700 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <div className="text-xs text-slate-300 font-mono">{JSON.stringify(webhookResponse, null, 2)}</div>
                </div>
              </details>
            </div>
            <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-6 flex gap-3 justify-end">
              <button onClick={() => setShowWebhookModal(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors font-medium text-sm">Close</button>
              <button onClick={() => { navigator.clipboard.writeText(webhookResponse.text || JSON.stringify(webhookResponse)); addToast('Response copied to clipboard', 'success'); }} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors font-medium text-sm flex items-center gap-2"><Copy size={16} />Copy Response</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}