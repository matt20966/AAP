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
  Wifi,
  WifiOff,
} from 'lucide-react';

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

interface AppSettings {
  apiEndpoint: string;
  useCorsProxy: boolean;
  enableListener: boolean;
  listenerEndpoint: string;
  pollingInterval: number;
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
  // First, try direct request
  if (!useCorsProxy) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error: any) {
      // If it's a CORS error, we'll try with proxy
      if (error.message?.includes('CORS') || error.message?.includes('Failed to fetch')) {
        console.log('Direct request failed, trying with CORS proxy...');
      } else {
        throw error;
      }
    }
  }

  // Try with CORS proxies
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

  // Last resort: try with no-cors mode
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
  text = text.replace(/[''‚‛]/g, "'");
  text = text.replace(/[•◦▪▫●○■□►▶‣⁃∙·]/g, '-');
  text = text.replace(/…/g, '...');
  text = text.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');
  text = text.replace(/\u00AD/g, '');
  text = text.replace(/-\s*[\r\n]+\s*/g, '');
  text = text.replace(/[\r\n\t]+/g, ' ');
  text = text.replace(/([!@#$%^&*()_+=\[\]{};':"\\|,.<>\/?~`-])\1+/g, '$1');
  text = text.replace(/[!@#$%^&*()_+=\[\]{};':"\\|,.<>\/?~`-]{3,}/g, ' ');
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
  text = text.replace(/([(\[])\s+/g, '$1');
  text = text.trim();

  return text;
}

// ─── Utility: Generate ID ────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── PDF.js Loader (loads from CDN once) ──────────────────────────────────────

let pdfJsLoadPromise: Promise<any> | null = null;

async function loadPdfJs(): Promise<any> {
  if (pdfJsLoadPromise) {
    return pdfJsLoadPromise;
  }

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
        if (lineText.trim()) {
          lines.push(lineText.trim());
        }
        lineText = text;
      } else {
        if (lastX !== null && text.length > 0) {
          const gap = currentX - lastX;
          if (gap > 10 && !lineText.endsWith(' ') && !text.startsWith(' ')) {
            lineText += ' ';
          }
        }
        lineText += text;
      }

      lastY = currentY;
      lastX = currentX + (textItem.width || 0);
    }

    if (lineText.trim()) {
      lines.push(lineText.trim());
    }

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
    case 'txt':
      return extractFromTxt(file);
    case 'pdf':
      return extractFromPdf(file);
    case 'docx':
      return extractFromDocx(file);
    default:
      throw new Error(`Unsupported format: .${ext}`);
  }
}

function getFileTypeLabel(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'pdf':
      return 'PDF';
    case 'docx':
      return 'DOCX';
    case 'txt':
      return 'TXT';
    default:
      return ext.toUpperCase();
  }
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'pdf':
      return FileType;
    case 'docx':
      return FileText;
    default:
      return File;
  }
}

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

const STORAGE_DOCS_KEY = 'aptean-extractor-documents';
const STORAGE_SETTINGS_KEY = 'aptean-extractor-settings';

function loadDocuments(): ExtractedDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_DOCS_KEY);
    if (!raw) return [];
    const docs = JSON.parse(raw) as ExtractedDocument[];
    return docs.map((d) => ({ ...d, sending: false }));
  } catch {
    return [];
  }
}

function saveDocuments(docs: ExtractedDocument[]) {
  const toSave = docs.map(({ sending, ...rest }) => ({ ...rest, sending: false }));
  localStorage.setItem(STORAGE_DOCS_KEY, JSON.stringify(toSave));
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (!raw)
      return {
        apiEndpoint: '',
        useCorsProxy: true,
        enableListener: false,
        listenerEndpoint: '/api/extractor-requests',
        pollingInterval: 5000,
      };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      apiEndpoint: parsed.apiEndpoint ?? '',
      useCorsProxy: parsed.useCorsProxy ?? true,
      enableListener: parsed.enableListener ?? false,
      listenerEndpoint: parsed.listenerEndpoint ?? '/api/extractor-requests',
      pollingInterval: parsed.pollingInterval ?? 5000,
    };
  } catch {
    return {
      apiEndpoint: '',
      useCorsProxy: true,
      enableListener: false,
      listenerEndpoint: '/api/extractor-requests',
      pollingInterval: 5000,
    };
  }
}

function saveSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-xl backdrop-blur-xl border transition-all duration-300 ${
            t.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
              : t.type === 'error'
                ? 'bg-red-500/10 text-red-300 border-red-500/20'
                : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
          }`}
        >
          {t.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : t.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          ) : (
            <Download className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="ml-1 hover:opacity-70 transition-opacity"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Incoming Request Modal ───────────────────────────────────────────────────

function IncomingRequestModal({
  request,
  onClose,
  onAction,
}: {
  request: IncomingRequest;
  onClose: () => void;
  onAction: () => void;
}) {
  const getFilenameFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      return filename || 'download';
    } catch {
      return 'download';
    }
  };

  const isDownload = request.type === 'download' && request.download_url;
  const filename = request.filename || (request.download_url ? getFilenameFromUrl(request.download_url) : 'Text request');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#12121a] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDownload ? 'bg-blue-500/10' : 'bg-emerald-500/10'
            }`}>
              {isDownload ? (
                <Download className="w-5 h-5 text-blue-400" />
              ) : (
                <FileText className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white/90">
                {isDownload ? 'Download Available' : 'Text Request Received'}
              </h3>
              <p className="text-xs text-white/40">
                {isDownload ? 'New file ready for download' : 'New text content received'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                isDownload ? 'bg-indigo-500/10' : 'bg-emerald-500/10'
              }`}>
                <FileText className={`w-6 h-6 ${isDownload ? 'text-indigo-400' : 'text-emerald-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/85 truncate">{filename}</p>
                {request.download_url && (
                  <p className="text-xs text-white/30 truncate mt-0.5">{request.download_url}</p>
                )}
                {request.text && !request.download_url && (
                  <p className="text-xs text-white/30 mt-0.5 line-clamp-2">
                    {request.text.length.toLocaleString()} characters
                  </p>
                )}
              </div>
            </div>

            {request.message && (
              <p className="text-xs text-white/50 mt-3 p-2 rounded-lg bg-white/[0.03]">
                {request.message}
              </p>
            )}

            {request.text && (
              <div className="mt-3 p-2 rounded-lg bg-white/[0.03] max-h-32 overflow-y-auto">
                <p className="text-xs text-white/40 whitespace-pre-wrap break-words line-clamp-6">
                  {request.text}
                </p>
              </div>
            )}
          </div>

          <div className="text-[11px] text-white/25">
            Received {new Date(request.timestamp).toLocaleTimeString()}
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white/50 bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.08] transition-colors"
          >
            Dismiss
          </button>
          {isDownload ? (
            <a
              href={request.download_url!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onAction}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-500/80 rounded-xl hover:bg-blue-500/90 transition-colors shadow-sm shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          ) : (
            <button
              onClick={onAction}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-500/80 rounded-xl hover:bg-emerald-500/90 transition-colors shadow-sm shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Copy Text
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ApteanKnowledgeExtractor() {
  const [documents, setDocuments] = useState<ExtractedDocument[]>(loadDocuments);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tempEndpoint, setTempEndpoint] = useState(settings.apiEndpoint);
  const [tempUseCorsProxy, setTempUseCorsProxy] = useState(settings.useCorsProxy);
  const [tempEnableListener, setTempEnableListener] = useState(settings.enableListener);
  const [tempListenerEndpoint, setTempListenerEndpoint] = useState(settings.listenerEndpoint);
  const [tempPollingInterval, setTempPollingInterval] = useState(settings.pollingInterval);
  const [pdfReady, setPdfReady] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [currentIncomingRequest, setCurrentIncomingRequest] = useState<IncomingRequest | null>(
    null
  );
  const [processedRequestIds, setProcessedRequestIds] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesOnlyInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPollTimeRef = useRef<number>(0);

  // Preload PDF.js on mount
  useEffect(() => {
    loadPdfJs()
      .then(() => setPdfReady(true))
      .catch((err) => console.warn('PDF.js preload failed:', err));
  }, []);

  useEffect(() => {
    saveDocuments(documents);
  }, [documents]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Polling for incoming requests
  useEffect(() => {
    if (settings.enableListener && settings.listenerEndpoint) {
      setIsListening(true);
      startPolling();
    } else {
      setIsListening(false);
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [settings.enableListener, settings.listenerEndpoint, settings.pollingInterval]);

  const startPolling = useCallback(() => {
    stopPolling();

    const poll = async () => {
      if (!settings.listenerEndpoint) return;

      try {
        // Use direct fetch for same-origin/relative URLs, CORS proxy only for external URLs
        const isSameOrigin =
          settings.listenerEndpoint.startsWith('/') ||
          settings.listenerEndpoint.startsWith(window.location.origin);
        const response = await fetchWithCorsHandling(
          settings.listenerEndpoint,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
            },
          },
          isSameOrigin ? false : settings.useCorsProxy
        );

        if (response.ok) {
          const data = await response.json();

          // Handle different response formats
          let requests: any[] = [];

          if (Array.isArray(data)) {
            requests = data;
          } else if (data.requests && Array.isArray(data.requests)) {
            requests = data.requests;
          } else if (data.download_url || data.text) {
            requests = [data];
          } else if (data.data && Array.isArray(data.data)) {
            requests = data.data;
          }

          // Process new requests
          for (const req of requests) {
            if (req.download_url || req.text) {
              const requestId = req.id || (req.download_url || req.text?.slice(0, 32)) + (req.timestamp || Date.now());

              if (!processedRequestIds.has(requestId)) {
                const incoming: IncomingRequest = {
                  id: requestId,
                  download_url: req.download_url || null,
                  filename: req.filename || null,
                  timestamp: req.timestamp || Date.now(),
                  message: req.message || null,
                  type: req.type || (req.download_url ? 'download' : 'text'),
                  text: req.text || null,
                };

                setIncomingRequests((prev) => [...prev, incoming]);
                setCurrentIncomingRequest(incoming);
                setProcessedRequestIds((prev) => new Set([...prev, requestId]));

                addToast(
                  incoming.type === 'text' ? 'New text request received!' : 'New download available!',
                  'info'
                );
              }
            }
          }
        }
      } catch (error) {
        console.log('Polling error:', error);
      }

      lastPollTimeRef.current = Date.now();
    };

    // Initial poll
    poll();

    // Set up interval
    pollingIntervalRef.current = setInterval(poll, settings.pollingInterval);
  }, [settings.listenerEndpoint, settings.pollingInterval, settings.useCorsProxy, processedRequestIds]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);

  const processFiles = useCallback(
    async (files: File[]) => {
      const validExts = ['pdf', 'docx', 'txt'];
      const valid = files.filter((f) => {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
        return validExts.includes(ext);
      });

      if (valid.length === 0) {
        addToast('No supported files. Accepts .pdf, .docx, .txt', 'error');
        return;
      }
      if (valid.length < files.length) {
        addToast(`${files.length - valid.length} unsupported file(s) skipped`, 'error');
      }

      setProcessing(true);
      const newDocs: ExtractedDocument[] = [];
      const extractedTexts: string[] = [];

      for (const file of valid) {
        try {
          const text = await extractText(file);
          extractedTexts.push(text);
          newDocs.push({
            id: generateId(),
            filename: file.name,
            fileType: getFileTypeLabel(file.name),
            text,
            timestamp: Date.now(),
            copied: true,
            sent: false,
            sending: false,
          });
        } catch (err: any) {
          console.error('Extraction error:', err);
          addToast(`Failed: "${file.name}" — ${err.message || 'Unknown error'}`, 'error');
        }
      }

      if (newDocs.length > 0) {
        const combinedText = extractedTexts.join('\n\n');
        const copySuccess = await copyToClipboard(combinedText);

        setDocuments((prev) => [...newDocs, ...prev]);

        if (copySuccess) {
          addToast(`${newDocs.length} document(s) processed & copied to clipboard`, 'success');
        } else {
          addToast(`${newDocs.length} document(s) processed (clipboard copy failed)`, 'success');
        }
      }
      setProcessing(false);
    },
    [addToast, copyToClipboard]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const items = e.dataTransfer.items;
      const files: File[] = [];

      if (items) {
        const entries: FileSystemEntry[] = [];
        for (let i = 0; i < items.length; i++) {
          const entry = items[i].webkitGetAsEntry?.();
          if (entry) entries.push(entry);
        }

        const readEntry = async (entry: FileSystemEntry): Promise<File[]> => {
          if (entry.isFile) {
            return new Promise((resolve) => {
              (entry as FileSystemFileEntry).file((f) => resolve([f]));
            });
          } else if (entry.isDirectory) {
            const dirReader = (entry as FileSystemDirectoryEntry).createReader();
            const subEntries = await new Promise<FileSystemEntry[]>((resolve) => {
              dirReader.readEntries((ents) => resolve(ents));
            });
            const allFiles: File[] = [];
            for (const sub of subEntries) {
              allFiles.push(...(await readEntry(sub)));
            }
            return allFiles;
          }
          return [];
        };

        for (const entry of entries) {
          files.push(...(await readEntry(entry)));
        }
      } else {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          files.push(e.dataTransfer.files[i]);
        }
      }

      if (files.length > 0) processFiles(files);
    },
    [processFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) processFiles(files);
      e.target.value = '';
    },
    [processFiles]
  );

  const handleCopy = useCallback(
    async (id: string) => {
      const doc = documents.find((d) => d.id === id);
      if (!doc) return;
      try {
        await navigator.clipboard.writeText(doc.text);
        setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, copied: true } : d)));
        addToast('Copied to clipboard', 'success');
      } catch {
        addToast('Failed to copy', 'error');
      }
    },
    [documents, addToast]
  );

  const handleCopyAllUncopied = useCallback(async () => {
    const uncopiedDocs = documents.filter((d) => !d.copied);

    if (uncopiedDocs.length === 0) {
      addToast('No uncopied documents to copy', 'error');
      return;
    }

    const combinedText = uncopiedDocs.map((d) => d.text).join('\n\n');

    try {
      await navigator.clipboard.writeText(combinedText);
      const uncopiedIds = new Set(uncopiedDocs.map((d) => d.id));
      setDocuments((prev) =>
        prev.map((d) => (uncopiedIds.has(d.id) ? { ...d, copied: true } : d))
      );
      addToast(`Copied ${uncopiedDocs.length} document(s) to clipboard`, 'success');
    } catch {
      addToast('Failed to copy', 'error');
    }
  }, [documents, addToast]);

  const handlePost = useCallback(
    async (id: string) => {
      if (!settings.apiEndpoint) {
        setShowSettings(true);
        addToast('Set an API endpoint first', 'error');
        return;
      }
      const doc = documents.find((d) => d.id === id);
      if (!doc) return;

      setDocuments((prev) =>
        prev.map((d) => (d.id === id ? { ...d, sending: true, error: undefined } : d))
      );

      try {
        const payload = {
          filename: doc.filename,
          fileType: doc.fileType,
          text: doc.text,
          timestamp: doc.timestamp,
        };

        const res = await fetchWithCorsHandling(
          settings.apiEndpoint,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(payload),
          },
          settings.useCorsProxy
        );

        if (res.ok || res.statusText.includes('no-cors')) {
          setDocuments((prev) =>
            prev.map((d) => (d.id === id ? { ...d, sent: true, sending: false } : d))
          );
          addToast('Sent successfully', 'success');
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch (err: any) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === id ? { ...d, sending: false, error: err.message } : d))
        );
        addToast(`Send failed: ${err.message}`, 'error');
      }
    },
    [documents, settings.apiEndpoint, settings.useCorsProxy, addToast]
  );

  const handleDelete = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const handleClearAll = useCallback(() => {
    setDocuments([]);
    addToast('All documents cleared', 'success');
  }, [addToast]);

  const handleSaveSettings = useCallback(() => {
    setSettings({
      apiEndpoint: tempEndpoint.trim(),
      useCorsProxy: tempUseCorsProxy,
      enableListener: tempEnableListener,
      listenerEndpoint: tempListenerEndpoint.trim(),
      pollingInterval: tempPollingInterval,
    });
    setShowSettings(false);
    addToast('Settings saved', 'success');
  }, [tempEndpoint, tempUseCorsProxy, tempEnableListener, tempListenerEndpoint, tempPollingInterval, addToast]);

  const handleCloseRequestModal = useCallback(() => {
    setCurrentIncomingRequest(null);
  }, []);

  const handleRequestAction = useCallback(async () => {
    if (currentIncomingRequest?.type === 'text' && currentIncomingRequest.text) {
      try {
        await navigator.clipboard.writeText(currentIncomingRequest.text);
        addToast('Text copied to clipboard', 'success');
      } catch {
        addToast('Failed to copy text', 'error');
      }
    } else {
      addToast('Download started', 'success');
    }
    setCurrentIncomingRequest(null);
  }, [currentIncomingRequest, addToast]);

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  const truncate = (text: string, len: number) =>
    text.length <= len ? text : text.slice(0, len) + '…';

  const uncopiedCount = documents.filter((d) => !d.copied).length;

  return (
    <div
      className="min-h-dvh text-white relative overflow-hidden"
      style={{
        background:
          'radial-gradient(120% 80% at 50% 0%, rgba(99,102,241, 0.09) 0%, #0a0a12 42%, #06060b 100%)',
      }}
    >
      {/* Subtle ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-indigo-500/[0.06] blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white/95 tracking-tight">
              Aptean Knowledge Extractor
            </h1>
            <p className="text-xs sm:text-sm text-white/30 mt-0.5">
              Extract &amp; clean text from PDF, DOCX &amp; TXT files
              {!pdfReady && (
                <span className="ml-2 text-yellow-400/60">(Loading PDF support...)</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Listener Status Indicator */}
            {settings.enableListener && (
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                  isListening
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}
              >
                {isListening ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 animate-pulse" />
                    <span className="hidden sm:inline">Listening</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Offline</span>
                  </>
                )}
              </div>
            )}
            <button
              onClick={() => {
                setTempEndpoint(settings.apiEndpoint);
                setTempUseCorsProxy(settings.useCorsProxy);
                setTempEnableListener(settings.enableListener);
                setTempListenerEndpoint(settings.listenerEndpoint);
                setTempPollingInterval(settings.pollingInterval);
                setShowSettings(true);
              }}
              className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] text-white/40 hover:text-white/70 hover:border-white/10 hover:bg-white/[0.06] transition-all duration-150"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => filesOnlyInputRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 backdrop-blur-sm ${
            isDragOver
              ? 'border-indigo-400/50 bg-indigo-500/[0.08] scale-[1.01]'
              : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]'
          } ${processing ? 'pointer-events-none opacity-50' : ''}`}
        >
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-6">
            {processing ? (
              <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
            ) : (
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors duration-200 ${
                  isDragOver ? 'bg-indigo-500/15' : 'bg-white/[0.05]'
                }`}
              >
                <Upload
                  className={`w-5 h-5 transition-colors duration-200 ${
                    isDragOver ? 'text-indigo-400' : 'text-white/30'
                  }`}
                />
              </div>
            )}
            <p className="text-sm font-medium text-white/70">
              {processing ? 'Processing files…' : 'Drop files or folders here'}
            </p>
            <p className="text-xs text-white/25 mt-1.5">
              {processing
                ? 'Please wait'
                : 'or click to browse • PDF, DOCX, TXT • Auto-copies to clipboard'}
            </p>
          </div>
          <input
            ref={filesOnlyInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt"
            onChange={handleFileInput}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt"
            onChange={handleFileInput}
            className="hidden"
            // @ts-ignore
            webkitdirectory=""
            directory=""
          />
        </div>

        {/* Secondary select links */}
        <div className="flex gap-2 mt-3 justify-center">
          <button
            onClick={() => filesOnlyInputRef.current?.click()}
            className="text-xs text-white/25 hover:text-white/50 transition-colors"
          >
            Select files
          </button>
          <span className="text-xs text-white/10">•</span>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-white/25 hover:text-white/50 transition-colors"
          >
            Select folder
          </button>
        </div>

        {/* Incoming Requests Queue */}
        {incomingRequests.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
              <Radio className="w-4 h-4" />
              Incoming Requests
              <span className="text-white/25 font-normal">({incomingRequests.length})</span>
            </h2>
            <div className="space-y-2">
              {incomingRequests.slice(-5).reverse().map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    req.type === 'download' ? 'bg-blue-500/10' : 'bg-emerald-500/10'
                  }`}>
                    {req.type === 'download' ? (
                      <Download className="w-4 h-4 text-blue-400" />
                    ) : (
                      <FileText className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/70 truncate">
                      {req.filename || (req.type === 'download' ? 'Download' : 'Text request')}
                    </p>
                    <p className="text-[10px] text-white/25">{formatTime(req.timestamp)}</p>
                  </div>
                  {req.type === 'download' && req.download_url ? (
                    <a
                      href={req.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 transition-colors"
                    >
                      Download
                    </a>
                  ) : req.text ? (
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(req.text!);
                          addToast('Copied to clipboard', 'success');
                        } catch {
                          addToast('Failed to copy', 'error');
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition-colors"
                    >
                      Copy
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Document List */}
        {documents.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white/60">
                Processed Documents{' '}
                <span className="text-white/25 font-normal">({documents.length})</span>
              </h2>
              <div className="flex items-center gap-2">
                {uncopiedCount > 0 && (
                  <button
                    onClick={handleCopyAllUncopied}
                    className="text-xs text-white/40 hover:text-indigo-400 transition-colors flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.08] hover:border-indigo-400/30 hover:bg-indigo-500/10"
                  >
                    <CopyPlus className="w-3.5 h-3.5" />
                    Copy all uncopied ({uncopiedCount})
                  </button>
                )}
                <button
                  onClick={handleClearAll}
                  className="text-xs text-white/25 hover:text-red-400 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear all
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {documents.map((doc) => {
                const IconComp = getFileIcon(doc.filename);
                return (
                  <div
                    key={doc.id}
                    className="group rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04] backdrop-blur-sm transition-all duration-150 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          doc.fileType === 'PDF'
                            ? 'bg-red-500/10 text-red-400'
                            : doc.fileType === 'DOCX'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-white/[0.05] text-white/30'
                        }`}
                      >
                        <IconComp className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-white/85 truncate">
                            {doc.filename}
                          </h3>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${
                              doc.fileType === 'PDF'
                                ? 'bg-red-500/10 text-red-400'
                                : doc.fileType === 'DOCX'
                                  ? 'bg-blue-500/10 text-blue-400'
                                  : 'bg-white/[0.06] text-white/35'
                            }`}
                          >
                            {doc.fileType}
                          </span>
                          {doc.copied && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 shrink-0">
                              Copied
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/25 mt-1 line-clamp-1">
                          {doc.text ? truncate(doc.text, 120) : 'No text extracted'}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-white/15">
                            {formatTime(doc.timestamp)}
                          </span>
                          <span className="text-[10px] text-white/15">
                            {doc.text.length.toLocaleString()} chars
                          </span>
                          {doc.error && (
                            <span className="text-[10px] text-red-400/70 flex items-center gap-0.5">
                              <AlertCircle className="w-2.5 h-2.5" />
                              {doc.error}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleCopy(doc.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                            doc.copied
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-white/90 text-gray-900 hover:bg-white shadow-sm'
                          }`}
                        >
                          {doc.copied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handlePost(doc.id)}
                          disabled={doc.sending}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 border ${
                            doc.sent
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : doc.sending
                                ? 'bg-white/[0.03] text-white/20 border-white/[0.06] cursor-wait'
                                : 'bg-white/[0.04] text-white/50 border-white/[0.08] hover:border-white/[0.14] hover:text-white/70'
                          }`}
                        >
                          {doc.sending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : doc.sent ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span className="hidden sm:inline">{doc.sent ? 'Sent' : 'Post'}</span>
                        </button>

                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-2 rounded-lg text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 opacity-0 group-hover:opacity-100"
                          title="Delete"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {documents.length === 0 && !processing && (
          <div className="mt-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-white/15" />
            </div>
            <p className="text-sm text-white/30">No documents yet</p>
            <p className="text-xs text-white/15 mt-1">Upload files to get started</p>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          />
          <div className="relative bg-[#12121a] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-white/90">Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Send Settings Section */}
              <div>
                <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Send className="w-3.5 h-3.5" />
                  Send Settings
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-white/45 mb-2">
                      Webhook / API Endpoint
                    </label>
                    <input
                      type="url"
                      value={tempEndpoint}
                      onChange={(e) => setTempEndpoint(e.target.value)}
                      placeholder="https://api.example.com/webhook"
                      className="w-full px-3.5 py-2.5 text-sm text-white/80 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400/40 transition-all placeholder-white/15"
                    />
                    <p className="text-[11px] text-white/20 mt-2">
                      Extracted text will be sent as a JSON POST payload to this URL.
                    </p>
                  </div>

                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={tempUseCorsProxy}
                          onChange={(e) => setTempUseCorsProxy(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:bg-indigo-500/50 transition-colors"></div>
                        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white/50 rounded-full peer-checked:translate-x-4 peer-checked:bg-white transition-all"></div>
                      </div>
                      <div>
                        <span className="text-sm text-white/70">Use CORS Proxy</span>
                        <p className="text-[11px] text-white/30">
                          Enable if you get CORS errors
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-white/[0.06]"></div>

              {/* Receive Settings Section */}
              <div>
                <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5" />
                  Receive Settings
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={tempEnableListener}
                          onChange={(e) => setTempEnableListener(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:bg-emerald-500/50 transition-colors"></div>
                        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white/50 rounded-full peer-checked:translate-x-4 peer-checked:bg-white transition-all"></div>
                      </div>
                      <div>
                        <span className="text-sm text-white/70">Enable Request Listener</span>
                        <p className="text-[11px] text-white/30">
                          Poll an endpoint for incoming download requests
                        </p>
                      </div>
                    </label>
                  </div>

                  {tempEnableListener && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-white/45 mb-2">
                          Listener Endpoint
                        </label>
                        <input
                          type="text"
                          value={tempListenerEndpoint}
                          onChange={(e) => setTempListenerEndpoint(e.target.value)}
                          placeholder="/api/extractor-requests"
                          className="w-full px-3.5 py-2.5 text-sm text-white/80 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400/40 transition-all placeholder-white/15"
                        />
                        <p className="text-[11px] text-white/20 mt-2">
                          GET requests will be made to this URL to check for new downloads.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-white/45 mb-2">
                          Polling Interval (ms)
                        </label>
                        <input
                          type="number"
                          value={tempPollingInterval}
                          onChange={(e) => setTempPollingInterval(Number(e.target.value) || 5000)}
                          min={1000}
                          max={60000}
                          step={1000}
                          className="w-full px-3.5 py-2.5 text-sm text-white/80 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400/40 transition-all placeholder-white/15"
                        />
                        <p className="text-[11px] text-white/20 mt-2">
                          How often to check for new requests (1000-60000ms)
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <p className="text-[11px] text-blue-300/80">
                          <strong>Expected Response Format:</strong>
                        </p>
                        <pre className="text-[10px] text-blue-300/60 mt-2 overflow-x-auto">
{`{
  "download_url": "https://...",
  "filename": "file.pdf",
  "message": "Optional message"
}`}
                        </pre>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-[11px] text-amber-300/80">
                  <strong>Note:</strong> If CORS proxy fails, requests will be sent in "no-cors"
                  mode. The data will be sent but you won't see the response.
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white/50 bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.08] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSettings}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-500/80 rounded-xl hover:bg-indigo-500/90 transition-colors shadow-sm shadow-indigo-500/20"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming Request Modal */}
      {currentIncomingRequest && (
        <IncomingRequestModal
          request={currentIncomingRequest}
          onClose={handleCloseRequestModal}
          onAction={handleRequestAction}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}