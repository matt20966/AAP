import React, { useState, useCallback, useRef, useEffect } from "react";
import { Routes, Route, Link} from "react-router-dom";
import {
  Copy,
  X,
  Play,
  Send,
  Database,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Edit3,
  Wrench,
  Save,
  Zap,
  GripVertical,
  FileText,
  ArrowLeft,
} from "lucide-react";
import ApteanKnowledgeExtractor from "./ApteanKnowledgeExtractor";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueryResult {
  success: boolean;
  data?: Record<string, unknown>[];
  columns?: string[];
  rowCount?: number;
  command?: string;
  error?: string;
  duration?: number;
}

interface QueryHistoryItem {
  id: string;
  query: string;
  sql: string;
  result: QueryResult | null;
  timestamp: Date;
  webhookResponse?: string;
}

interface ModalState {
  isOpen: boolean;
  stage: "loading" | "sql-preview" | "executing" | "results" | "error";
  naturalQuery: string;
  sql: string;
  fullWebhookResponse: string;
  queryResult: QueryResult | null;
  error: string;
}

interface MCPToolSQL {
  id: string;
  label: string;
  sql: string;
  order: number;
}

interface MCPTool {
  id: string;
  name: string;
  description: string;
  sqls: MCPToolSQL[];
  createdAt: string;
  updatedAt: string;
}

interface MCPToolExecutionResult {
  sqlId: string;
  label: string;
  sql: string;
  result: QueryResult | null;
  status: "pending" | "running" | "success" | "error";
}

// Shared DB config type
interface DBConfig {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:3001/api";
const APTEAN_WEBHOOK_URL =
  "https://appcentral-int.aptean.com/ais/api/v1/run/2877ed9a-8e1a-4336-b703-c942d9195ff0";
const MCP_TOOLS_STORAGE_KEY = "mcp_tools_v1";

// Default DB config — database set to "kes"
const DEFAULT_DB_CONFIG: DBConfig = {
  host: "localhost",
  port: "5432",
  database: "kes",
  user: "postgres",
  password: "mbsmbs",
};

// ─── Local Storage Helpers ────────────────────────────────────────────────────

function loadToolsFromStorage(): MCPTool[] {
  try {
    const raw = localStorage.getItem(MCP_TOOLS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveToolsToStorage(tools: MCPTool[]): void {
  localStorage.setItem(MCP_TOOLS_STORAGE_KEY, JSON.stringify(tools));
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function sendToWebhook(inputValue: string): Promise<{
  text: string;
  sql: string;
  fullResponse: any;
}> {
  const res = await fetch(`${API_BASE}/webhook/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input_value: inputValue,
      webhook_url: APTEAN_WEBHOOK_URL,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Network error" }));
    throw new Error(err.error || `Webhook error ${res.status}`);
  }

  const json = await res.json();
  const responseText = json.text || json.response || "";
  const sql = extractSQL(responseText);

  return { text: responseText, sql, fullResponse: json };
}

function extractSQL(text: string): string {
  if (!text) return "";
  const sqlBlockMatch = text.match(/```sql\s*\n?([\s\S]*?)```/i);
  if (sqlBlockMatch) return sqlBlockMatch[1].trim();
  const codeBlockMatch = text.match(/```\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    const content = codeBlockMatch[1].trim();
    if (
      /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|EXPLAIN)/i.test(
        content
      )
    )
      return content;
  }
  const sqlStatementMatch = text.match(
    /(SELECT\s[\s\S]*?;|INSERT\s[\s\S]*?;|UPDATE\s[\s\S]*?;|DELETE\s[\s\S]*?;|CREATE\s[\s\S]*?;|ALTER\s[\s\S]*?;|DROP\s[\s\S]*?;|WITH\s[\s\S]*?;)/i
  );
  if (sqlStatementMatch) return sqlStatementMatch[1].trim();
  const trimmed = text.trim();
  if (
    /^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|EXPLAIN)\s/i.test(
      trimmed
    )
  )
    return trimmed;
  return "";
}

async function executeSQL(
  sql: string,
  dbConfig: DBConfig
): Promise<QueryResult> {
  const res = await fetch(`${API_BASE}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql, dbConfig }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Network error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

async function checkDBConnection(dbConfig: DBConfig): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dbConfig),
    });
    const json = await res.json();
    return json.connected === true;
  } catch {
    return false;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Spinner: React.FC<{ size?: "sm" | "md" | "lg" }> = ({ size = "md" }) => {
  const sz =
    size === "sm" ? "w-3.5 h-3.5" : size === "lg" ? "w-6 h-6" : "w-4 h-4";
  return <Loader2 className={`animate-spin ${sz}`} />;
};

const StatusPill: React.FC<{ connected: boolean; checking: boolean }> = ({
  connected,
  checking,
}) => (
  <div
    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide"
    style={{
      background: checking
        ? "rgba(251,191,36,0.08)"
        : connected
        ? "rgba(34,197,94,0.08)"
        : "rgba(239,68,68,0.08)",
      border: `1px solid ${
        checking
          ? "rgba(251,191,36,0.25)"
          : connected
          ? "rgba(34,197,94,0.25)"
          : "rgba(239,68,68,0.25)"
      }`,
      color: checking ? "#fbbf24" : connected ? "#4ade80" : "#f87171",
    }}
  >
    <span
      className={`w-1.5 h-1.5 rounded-full ${
        checking
          ? "bg-yellow-400 animate-pulse"
          : connected
          ? "bg-green-400"
          : "bg-red-400"
      }`}
    />
    {checking ? "Connecting…" : connected ? "DB Connected" : "DB Disconnected"}
  </div>
);

const ResultTable: React.FC<{
  columns: string[];
  data: Record<string, unknown>[];
}> = ({ columns, data }) => (
  <div
    className="overflow-auto rounded-xl"
    style={{
      maxHeight: "400px",
      border: "1px solid rgba(148,163,184,0.07)",
      background: "rgba(2,6,18,0.7)",
    }}
  >
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          <th
            className="sticky top-0 z-20 px-4 py-3 text-left"
            style={{
              background: "rgba(10,15,35,0.98)",
              borderBottom: "1px solid rgba(148,163,184,0.08)",
              width: 44,
            }}
          >
            <span
              className="font-mono text-xs"
              style={{ color: "rgba(100,116,139,0.4)" }}
            >
              #
            </span>
          </th>
          {columns.map((col) => (
            <th
              key={col}
              className="sticky top-0 z-10 px-4 py-3 text-left whitespace-nowrap"
              style={{
                background: "rgba(10,15,35,0.98)",
                borderBottom: "1px solid rgba(148,163,184,0.08)",
              }}
            >
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "rgba(148,163,184,0.55)" }}
              >
                {col}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr
            key={i}
            style={{ borderBottom: "1px solid rgba(148,163,184,0.03)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(99,102,241,0.04)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <td
              className="px-4 py-2.5 font-mono"
              style={{ color: "rgba(100,116,139,0.35)", fontSize: 11 }}
            >
              {i + 1}
            </td>
            {columns.map((col) => (
              <td
                key={col}
                className="px-4 py-2.5"
                title={String(row[col] ?? "")}
              >
                {row[col] === null ? (
                  <span
                    className="font-mono text-xs italic px-1.5 py-0.5 rounded"
                    style={{
                      color: "rgba(100,116,139,0.5)",
                      background: "rgba(100,116,139,0.07)",
                    }}
                  >
                    NULL
                  </span>
                ) : typeof row[col] === "boolean" ? (
                  <span
                    className="font-mono text-xs px-1.5 py-0.5 rounded"
                    style={{
                      color: row[col] ? "#4ade80" : "#f87171",
                      background: row[col]
                        ? "rgba(34,197,94,0.08)"
                        : "rgba(239,68,68,0.08)",
                    }}
                  >
                    {String(row[col])}
                  </span>
                ) : typeof row[col] === "number" ? (
                  <span
                    className="font-mono text-xs"
                    style={{ color: "#a78bfa" }}
                  >
                    {String(row[col])}
                  </span>
                ) : typeof row[col] === "object" ? (
                  <span
                    className="font-mono text-xs truncate block max-w-xs"
                    style={{ color: "#fb923c" }}
                  >
                    {JSON.stringify(row[col])}
                  </span>
                ) : (
                  <span
                    className="text-xs truncate block max-w-xs"
                    style={{ color: "rgba(226,232,240,0.8)" }}
                  >
                    {String(row[col])}
                  </span>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── SQL Response Modal ───────────────────────────────────────────────────────

const SQLResponseModal: React.FC<{
  modal: ModalState;
  onClose: () => void;
  onExecute: () => void;
  dbConnected: boolean;
}> = ({ modal, onClose, onExecute, dbConnected }) => {
  const [showFullResponse, setShowFullResponse] = useState(false);
  const [copiedSQL, setCopiedSQL] = useState(false);
  const [copiedResults, setCopiedResults] = useState(false);

  const handleCopySQL = () => {
    navigator.clipboard.writeText(modal.sql);
    setCopiedSQL(true);
    setTimeout(() => setCopiedSQL(false), 2000);
  };

  const handleCopyResults = () => {
    const text = modal.queryResult?.data
      ? JSON.stringify(modal.queryResult.data, null, 2)
      : "";
    navigator.clipboard.writeText(text);
    setCopiedResults(true);
    setTimeout(() => setCopiedResults(false), 2000);
  };

  if (!modal.isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl flex flex-col"
        style={{
          background:
            "linear-gradient(to bottom, rgba(15,23,42,0.98), rgba(10,15,35,0.98))",
          border: "1px solid rgba(148,163,184,0.1)",
          boxShadow:
            "0 25px 80px rgba(0,0,0,0.6), 0 0 40px rgba(99,102,241,0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                background:
                  modal.stage === "error"
                    ? "rgba(239,68,68,0.1)"
                    : modal.stage === "results"
                    ? "rgba(34,197,94,0.1)"
                    : "rgba(99,102,241,0.1)",
              }}
            >
              {modal.stage === "loading" || modal.stage === "executing" ? (
                <Loader2
                  className="w-4 h-4 animate-spin"
                  style={{ color: "#a5b4fc" }}
                />
              ) : modal.stage === "error" ? (
                <AlertCircle className="w-4 h-4 text-red-400" />
              ) : modal.stage === "results" ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : (
                <Database className="w-4 h-4" style={{ color: "#a5b4fc" }} />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-200">
                {modal.stage === "loading"
                  ? "Processing Your Query…"
                  : modal.stage === "sql-preview"
                  ? "Generated SQL Query"
                  : modal.stage === "executing"
                  ? "Executing SQL…"
                  : modal.stage === "results"
                  ? "Query Results"
                  : "Error"}
              </h2>
              <p
                className="text-xs mt-0.5 truncate max-w-md"
                style={{ color: "rgba(148,163,184,0.5)" }}
              >
                {modal.naturalQuery}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-all"
            style={{ color: "rgba(148,163,184,0.5)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(148,163,184,0.08)";
              (e.currentTarget as HTMLElement).style.color = "#e2e8f0";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color =
                "rgba(148,163,184,0.5)";
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {modal.stage === "loading" && (
            <div className="flex flex-col items-center justify-center py-16">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                style={{
                  background: "rgba(99,102,241,0.08)",
                  border: "1px solid rgba(99,102,241,0.15)",
                }}
              >
                <Loader2
                  className="w-7 h-7 animate-spin"
                  style={{ color: "#6366f1" }}
                />
              </div>
              <p className="text-sm font-semibold text-slate-300 mb-2">
                Sending to Aptean AIS…
              </p>
              <p
                className="text-xs text-center max-w-sm"
                style={{ color: "rgba(148,163,184,0.4)" }}
              >
                Your natural language query is being processed by the webhook to
                generate SQL
              </p>
              <div className="flex items-center gap-1.5 mt-6">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{
                      background: "#6366f1",
                      animationDelay: `${i * 200}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {modal.stage === "error" && (
            <div
              className="rounded-xl p-5"
              style={{
                background: "rgba(239,68,68,0.05)",
                border: "1px solid rgba(239,68,68,0.15)",
              }}
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-300 mb-1">
                    Error
                  </p>
                  <pre
                    className="text-sm whitespace-pre-wrap break-words"
                    style={{
                      color: "#fca5a5",
                      fontFamily: "'JetBrains Mono','Fira Code',monospace",
                    }}
                  >
                    {modal.error}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {(modal.stage === "sql-preview" ||
            modal.stage === "executing" ||
            modal.stage === "results") &&
            modal.sql && (
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  border: "1px solid rgba(99,102,241,0.15)",
                  background: "rgba(99,102,241,0.03)",
                }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: "1px solid rgba(99,102,241,0.08)" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "#6366f1" }}
                    />
                    <span
                      className="text-xs font-bold uppercase tracking-widest"
                      style={{ color: "rgba(99,102,241,0.7)" }}
                    >
                      SQL Query
                    </span>
                  </div>
                  <button
                    onClick={handleCopySQL}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all"
                    style={{
                      color: copiedSQL ? "#4ade80" : "rgba(148,163,184,0.5)",
                      background: copiedSQL
                        ? "rgba(34,197,94,0.08)"
                        : "transparent",
                    }}
                  >
                    <Copy className="w-3 h-3" />
                    {copiedSQL ? "Copied!" : "Copy"}
                  </button>
                </div>
                <pre
                  className="px-4 py-4 text-sm leading-relaxed overflow-auto"
                  style={{
                    color: "#a5b4fc",
                    fontFamily: "'JetBrains Mono','Fira Code',monospace",
                    maxHeight: modal.stage === "results" ? 120 : 240,
                  }}
                >
                  {modal.sql}
                </pre>
              </div>
            )}

          {(modal.stage === "sql-preview" || modal.stage === "results") &&
            modal.fullWebhookResponse && (
              <div>
                <button
                  onClick={() => setShowFullResponse((p) => !p)}
                  className="flex items-center gap-2 text-xs font-semibold transition-colors"
                  style={{ color: "rgba(148,163,184,0.5)" }}
                >
                  {showFullResponse ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                  {showFullResponse
                    ? "Hide Full Response"
                    : "Show Full Webhook Response"}
                </button>
                {showFullResponse && (
                  <div
                    className="mt-2 rounded-xl p-4 overflow-auto"
                    style={{
                      maxHeight: 200,
                      background: "rgba(2,6,18,0.7)",
                      border: "1px solid rgba(148,163,184,0.06)",
                    }}
                  >
                    <pre
                      className="text-xs whitespace-pre-wrap break-words"
                      style={{
                        color: "rgba(148,163,184,0.6)",
                        fontFamily: "'JetBrains Mono','Fira Code',monospace",
                      }}
                    >
                      {modal.fullWebhookResponse}
                    </pre>
                  </div>
                )}
              </div>
            )}

          {modal.stage === "executing" && (
            <div
              className="rounded-xl px-5 py-4 flex items-center gap-3"
              style={{
                background: "rgba(34,197,94,0.04)",
                border: "1px solid rgba(34,197,94,0.12)",
              }}
            >
              <Loader2
                className="w-4 h-4 animate-spin"
                style={{ color: "#4ade80" }}
              />
              <span
                className="text-sm font-medium"
                style={{ color: "rgba(74,222,128,0.8)" }}
              >
                Executing SQL against your database…
              </span>
            </div>
          )}

          {modal.stage === "results" && modal.queryResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {modal.queryResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  )}
                  <span className="text-sm font-semibold text-slate-200">
                    {modal.queryResult.success
                      ? "Execution Successful"
                      : "Execution Failed"}
                  </span>
                  {modal.queryResult.success &&
                    modal.queryResult.rowCount !== undefined && (
                      <span
                        className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                        style={{
                          background: "rgba(34,197,94,0.08)",
                          color: "#4ade80",
                          border: "1px solid rgba(34,197,94,0.15)",
                        }}
                      >
                        {modal.queryResult.rowCount}{" "}
                        {modal.queryResult.rowCount === 1 ? "row" : "rows"}
                      </span>
                    )}
                  {modal.queryResult.duration !== undefined && (
                    <span
                      className="text-xs"
                      style={{ color: "rgba(100,116,139,0.5)" }}
                    >
                      {modal.queryResult.duration}ms
                    </span>
                  )}
                </div>
                {modal.queryResult.success &&
                  modal.queryResult.data &&
                  modal.queryResult.data.length > 0 && (
                    <button
                      onClick={handleCopyResults}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all"
                      style={{
                        color: copiedResults
                          ? "#4ade80"
                          : "rgba(148,163,184,0.5)",
                        background: copiedResults
                          ? "rgba(34,197,94,0.08)"
                          : "transparent",
                      }}
                    >
                      <Copy className="w-3 h-3" />
                      {copiedResults ? "Copied!" : "Copy Results"}
                    </button>
                  )}
              </div>

              {modal.queryResult.error && (
                <div
                  className="rounded-xl p-4 flex items-start gap-3"
                  style={{
                    background: "rgba(239,68,68,0.05)",
                    border: "1px solid rgba(239,68,68,0.13)",
                  }}
                >
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <pre
                    className="text-sm whitespace-pre-wrap break-words"
                    style={{
                      color: "#fca5a5",
                      fontFamily: "'JetBrains Mono','Fira Code',monospace",
                    }}
                  >
                    {modal.queryResult.error}
                  </pre>
                </div>
              )}

              {modal.queryResult.success &&
                modal.queryResult.columns &&
                modal.queryResult.data &&
                modal.queryResult.data.length > 0 && (
                  <ResultTable
                    columns={modal.queryResult.columns}
                    data={modal.queryResult.data}
                  />
                )}

              {modal.queryResult.success &&
                modal.queryResult.data?.length === 0 && (
                  <div
                    className="py-10 text-center rounded-xl"
                    style={{
                      background: "rgba(2,6,18,0.5)",
                      border: "1px solid rgba(148,163,184,0.05)",
                    }}
                  >
                    <p
                      className="text-sm font-medium"
                      style={{ color: "rgba(148,163,184,0.5)" }}
                    >
                      Query returned no rows
                    </p>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}
        >
          <div className="flex items-center gap-2">
            {modal.stage === "sql-preview" && !dbConnected && (
              <span className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Database not connected
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                color: "rgba(148,163,184,0.7)",
                background: "rgba(148,163,184,0.05)",
                border: "1px solid rgba(148,163,184,0.08)",
              }}
            >
              Close
            </button>

            {modal.stage === "sql-preview" && modal.sql && (
              <button
                onClick={onExecute}
                disabled={!dbConnected}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: dbConnected
                    ? "linear-gradient(135deg, #059669, #10b981)"
                    : "rgba(100,116,139,0.2)",
                  color: "white",
                  boxShadow: dbConnected
                    ? "0 0 20px rgba(16,185,129,0.3), 0 4px 12px rgba(0,0,0,0.3)"
                    : "none",
                }}
              >
                <Play className="w-3.5 h-3.5" />
                Execute SQL
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MCP Tool Editor Modal ────────────────────────────────────────────────────

const MCPToolEditor: React.FC<{
  tool: MCPTool | null;
  onSave: (tool: MCPTool) => void;
  onClose: () => void;
}> = ({ tool, onSave, onClose }) => {
  const [name, setName] = useState(tool?.name || "");
  const [description, setDescription] = useState(tool?.description || "");
  const [sqls, setSqls] = useState<MCPToolSQL[]>(
    tool?.sqls || [
      { id: crypto.randomUUID(), label: "Query 1", sql: "", order: 0 },
    ]
  );

  const addSQL = () => {
    setSqls((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: `Query ${prev.length + 1}`,
        sql: "",
        order: prev.length,
      },
    ]);
  };

  const removeSQL = (id: string) => {
    if (sqls.length <= 1) return;
    setSqls((prev) =>
      prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i }))
    );
  };

  const updateSQL = (id: string, field: "label" | "sql", value: string) => {
    setSqls((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    const savedTool: MCPTool = {
      id: tool?.id || crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      sqls: sqls.filter((s) => s.sql.trim()),
      createdAt: tool?.createdAt || now,
      updatedAt: now,
    };
    if (savedTool.sqls.length === 0) return;
    onSave(savedTool);
  };

  const canSave = name.trim() && sqls.some((s) => s.sql.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl flex flex-col"
        style={{
          background:
            "linear-gradient(to bottom, rgba(15,23,42,0.98), rgba(10,15,35,0.98))",
          border: "1px solid rgba(148,163,184,0.1)",
          boxShadow:
            "0 25px 80px rgba(0,0,0,0.6), 0 0 40px rgba(99,102,241,0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(99,102,241,0.1)" }}
            >
              <Wrench className="w-4 h-4" style={{ color: "#a5b4fc" }} />
            </div>
            <h2 className="text-sm font-bold text-slate-200">
              {tool ? "Edit Tool" : "Create New Tool"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-all"
            style={{ color: "rgba(148,163,184,0.5)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(148,163,184,0.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label
              className="block text-xs font-bold uppercase tracking-widest mb-2"
              style={{ color: "rgba(148,163,184,0.6)" }}
            >
              Tool Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Get Active Users"
              className="w-full rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none transition-all"
              style={{
                background: "rgba(2,6,18,0.9)",
                border: "1px solid rgba(148,163,184,0.09)",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "rgba(99,102,241,0.5)";
                e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.08)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "rgba(148,163,184,0.09)";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          <div>
            <label
              className="block text-xs font-bold uppercase tracking-widest mb-2"
              style={{ color: "rgba(148,163,184,0.6)" }}
            >
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this tool does"
              className="w-full rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none transition-all"
              style={{
                background: "rgba(2,6,18,0.9)",
                border: "1px solid rgba(148,163,184,0.09)",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "rgba(99,102,241,0.5)";
                e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.08)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "rgba(148,163,184,0.09)";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "rgba(148,163,184,0.6)" }}
              >
                SQL Queries *
              </label>
              <button
                onClick={addSQL}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: "rgba(99,102,241,0.08)",
                  color: "#a5b4fc",
                  border: "1px solid rgba(99,102,241,0.15)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(99,102,241,0.15)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    "rgba(99,102,241,0.08)";
                }}
              >
                <Plus className="w-3 h-3" />
                Add SQL
              </button>
            </div>

            <div className="space-y-4">
              {sqls.map((sqlItem, idx) => (
                <div
                  key={sqlItem.id}
                  className="rounded-xl overflow-hidden"
                  style={{
                    border: "1px solid rgba(148,163,184,0.07)",
                    background: "rgba(2,6,18,0.5)",
                  }}
                >
                  <div
                    className="flex items-center gap-3 px-4 py-3"
                    style={{
                      borderBottom: "1px solid rgba(148,163,184,0.05)",
                    }}
                  >
                    <GripVertical
                      className="w-3.5 h-3.5 flex-shrink-0"
                      style={{ color: "rgba(100,116,139,0.3)" }}
                    />
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{
                        background: "rgba(99,102,241,0.1)",
                        color: "#a5b4fc",
                      }}
                    >
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      value={sqlItem.label}
                      onChange={(e) =>
                        updateSQL(sqlItem.id, "label", e.target.value)
                      }
                      placeholder="Query label"
                      className="flex-1 bg-transparent text-sm text-slate-300 focus:outline-none"
                    />
                    {sqls.length > 1 && (
                      <button
                        onClick={() => removeSQL(sqlItem.id)}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ color: "rgba(239,68,68,0.5)" }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.color =
                            "#f87171";
                          (e.currentTarget as HTMLElement).style.background =
                            "rgba(239,68,68,0.08)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.color =
                            "rgba(239,68,68,0.5)";
                          (e.currentTarget as HTMLElement).style.background =
                            "transparent";
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <textarea
                    value={sqlItem.sql}
                    onChange={(e) =>
                      updateSQL(sqlItem.id, "sql", e.target.value)
                    }
                    placeholder="SELECT * FROM users WHERE active = true;"
                    className="w-full px-4 py-3 text-sm text-slate-200 bg-transparent resize-none focus:outline-none"
                    style={{
                      fontFamily: "'JetBrains Mono','Fira Code',monospace",
                      minHeight: 100,
                      color: "#a5b4fc",
                    }}
                    rows={4}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}
        >
          <p className="text-xs" style={{ color: "rgba(100,116,139,0.4)" }}>
            {sqls.filter((s) => s.sql.trim()).length} SQL{" "}
            {sqls.filter((s) => s.sql.trim()).length === 1 ? "query" : "queries"}{" "}
            defined
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                color: "rgba(148,163,184,0.7)",
                background: "rgba(148,163,184,0.05)",
                border: "1px solid rgba(148,163,184,0.08)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: canSave
                  ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                  : "rgba(100,116,139,0.2)",
                color: "white",
                boxShadow: canSave
                  ? "0 0 20px rgba(99,102,241,0.3), 0 4px 12px rgba(0,0,0,0.3)"
                  : "none",
              }}
            >
              <Save className="w-3.5 h-3.5" />
              {tool ? "Update Tool" : "Create Tool"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MCP Tool Execution Modal ─────────────────────────────────────────────────

const MCPToolExecutionModal: React.FC<{
  tool: MCPTool;
  dbConfig: DBConfig;
  dbConnected: boolean;
  onClose: () => void;
}> = ({ tool, dbConfig, dbConnected, onClose }) => {
  const [results, setResults] = useState<MCPToolExecutionResult[]>(
    tool.sqls.map((s) => ({
      sqlId: s.id,
      label: s.label,
      sql: s.sql,
      result: null,
      status: "pending",
    }))
  );
  const [running, setRunning] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(
    new Set()
  );

  const toggleExpanded = (id: string) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runAll = async () => {
    if (!dbConnected || running) return;
    setRunning(true);

    for (let i = 0; i < results.length; i++) {
      setResults((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "running" } : r))
      );

      try {
        const result = await executeSQL(results[i].sql, dbConfig);
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, result, status: result.success ? "success" : "error" }
              : r
          )
        );
        setExpandedResults((prev) => {
          const next = new Set(prev);
          next.add(results[i].sqlId);
          return next;
        });
      } catch (err) {
        setResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  result: {
                    success: false,
                    error:
                      err instanceof Error ? err.message : "Execution failed",
                  },
                  status: "error",
                }
              : r
          )
        );
        setExpandedResults((prev) => {
          const next = new Set(prev);
          next.add(results[i].sqlId);
          return next;
        });
      }
    }

    setRunning(false);
  };

  const allDone = results.every(
    (r) => r.status === "success" || r.status === "error"
  );
  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl flex flex-col"
        style={{
          background:
            "linear-gradient(to bottom, rgba(15,23,42,0.98), rgba(10,15,35,0.98))",
          border: "1px solid rgba(148,163,184,0.1)",
          boxShadow:
            "0 25px 80px rgba(0,0,0,0.6), 0 0 40px rgba(99,102,241,0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                background: allDone
                  ? errorCount > 0
                    ? "rgba(251,191,36,0.1)"
                    : "rgba(34,197,94,0.1)"
                  : "rgba(99,102,241,0.1)",
              }}
            >
              {running ? (
                <Loader2
                  className="w-4 h-4 animate-spin"
                  style={{ color: "#a5b4fc" }}
                />
              ) : allDone && errorCount === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : allDone && errorCount > 0 ? (
                <AlertCircle className="w-4 h-4 text-yellow-400" />
              ) : (
                <Zap className="w-4 h-4" style={{ color: "#a5b4fc" }} />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-200">
                {running
                  ? `Running "${tool.name}"…`
                  : allDone
                  ? `"${tool.name}" Complete`
                  : `Run "${tool.name}"`}
              </h2>
              <p
                className="text-xs mt-0.5"
                style={{ color: "rgba(148,163,184,0.5)" }}
              >
                {tool.sqls.length} SQL{" "}
                {tool.sqls.length === 1 ? "query" : "queries"} to execute
                {allDone && (
                  <span className="ml-2">
                    • {successCount} passed
                    {errorCount > 0 && `, ${errorCount} failed`}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-all"
            style={{ color: "rgba(148,163,184,0.5)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "rgba(148,163,184,0.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {results.map((r, idx) => (
            <div
              key={r.sqlId}
              className="rounded-xl overflow-hidden transition-all"
              style={{
                border: `1px solid ${
                  r.status === "running"
                    ? "rgba(99,102,241,0.3)"
                    : r.status === "success"
                    ? "rgba(34,197,94,0.15)"
                    : r.status === "error"
                    ? "rgba(239,68,68,0.15)"
                    : "rgba(148,163,184,0.07)"
                }`,
                background:
                  r.status === "running"
                    ? "rgba(99,102,241,0.03)"
                    : "rgba(2,6,18,0.5)",
              }}
            >
              <button
                onClick={() => toggleExpanded(r.sqlId)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0"
                  style={{
                    background:
                      r.status === "success"
                        ? "rgba(34,197,94,0.1)"
                        : r.status === "error"
                        ? "rgba(239,68,68,0.1)"
                        : r.status === "running"
                        ? "rgba(99,102,241,0.1)"
                        : "rgba(148,163,184,0.08)",
                    color:
                      r.status === "success"
                        ? "#4ade80"
                        : r.status === "error"
                        ? "#f87171"
                        : r.status === "running"
                        ? "#a5b4fc"
                        : "rgba(148,163,184,0.5)",
                  }}
                >
                  #{idx + 1}
                </span>
                <span className="text-sm text-slate-300 flex-1 truncate">
                  {r.label}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.status === "running" && (
                    <Loader2
                      className="w-3.5 h-3.5 animate-spin"
                      style={{ color: "#a5b4fc" }}
                    />
                  )}
                  {r.status === "success" && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  )}
                  {r.status === "error" && (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                  )}
                  {r.status === "pending" && (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: "rgba(148,163,184,0.2)" }}
                    />
                  )}
                  {r.result &&
                    r.result.success &&
                    r.result.rowCount !== undefined && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: "rgba(34,197,94,0.08)",
                          color: "#4ade80",
                        }}
                      >
                        {r.result.rowCount} rows
                      </span>
                    )}
                  {r.result && r.result.duration !== undefined && (
                    <span
                      className="text-xs"
                      style={{ color: "rgba(100,116,139,0.4)" }}
                    >
                      {r.result.duration}ms
                    </span>
                  )}
                  {expandedResults.has(r.sqlId) ? (
                    <ChevronUp
                      className="w-3.5 h-3.5"
                      style={{ color: "rgba(148,163,184,0.4)" }}
                    />
                  ) : (
                    <ChevronDown
                      className="w-3.5 h-3.5"
                      style={{ color: "rgba(148,163,184,0.4)" }}
                    />
                  )}
                </div>
              </button>

              {expandedResults.has(r.sqlId) && (
                <div style={{ borderTop: "1px solid rgba(148,163,184,0.05)" }}>
                  <pre
                    className="px-4 py-3 text-xs overflow-auto"
                    style={{
                      color: "#818cf8",
                      fontFamily: "'JetBrains Mono','Fira Code',monospace",
                      maxHeight: 120,
                      background: "rgba(99,102,241,0.02)",
                      borderBottom: "1px solid rgba(148,163,184,0.04)",
                    }}
                  >
                    {r.sql}
                  </pre>
                  {r.result && (
                    <div className="p-4">
                      {r.result.error && (
                        <div
                          className="rounded-lg p-3 flex items-start gap-2"
                          style={{
                            background: "rgba(239,68,68,0.05)",
                            border: "1px solid rgba(239,68,68,0.1)",
                          }}
                        >
                          <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                          <pre
                            className="text-xs whitespace-pre-wrap break-words"
                            style={{
                              color: "#fca5a5",
                              fontFamily:
                                "'JetBrains Mono','Fira Code',monospace",
                            }}
                          >
                            {r.result.error}
                          </pre>
                        </div>
                      )}
                      {r.result.success &&
                        r.result.columns &&
                        r.result.data &&
                        r.result.data.length > 0 && (
                          <ResultTable
                            columns={r.result.columns}
                            data={r.result.data}
                          />
                        )}
                      {r.result.success && r.result.data?.length === 0 && (
                        <p
                          className="text-xs text-center py-4"
                          style={{ color: "rgba(148,163,184,0.4)" }}
                        >
                          No rows returned
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}
        >
          <div>
            {!dbConnected && (
              <span className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Database not connected
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                color: "rgba(148,163,184,0.7)",
                background: "rgba(148,163,184,0.05)",
                border: "1px solid rgba(148,163,184,0.08)",
              }}
            >
              Close
            </button>
            {!allDone && (
              <button
                onClick={runAll}
                disabled={!dbConnected || running}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background:
                    dbConnected && !running
                      ? "linear-gradient(135deg, #059669, #10b981)"
                      : "rgba(100,116,139,0.2)",
                  color: "white",
                  boxShadow:
                    dbConnected && !running
                      ? "0 0 20px rgba(16,185,129,0.3), 0 4px 12px rgba(0,0,0,0.3)"
                      : "none",
                }}
              >
                {running ? (
                  <>
                    <Spinner size="sm" />
                    Running…
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    Run All Queries
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MCP Tools Page ───────────────────────────────────────────────────────────
// Now receives dbConfig, connected, checking as props — no local DB state

interface MCPToolsPageProps {
  dbConfig: DBConfig;
  connected: boolean;
  checking: boolean;
  onCheckConnection: () => void;
}

const MCPToolsPage: React.FC<MCPToolsPageProps> = ({
  dbConfig,
  connected,
  checking,
}) => {
  const [tools, setTools] = useState<MCPTool[]>(loadToolsFromStorage);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTool, setEditingTool] = useState<MCPTool | null>(null);
  const [executingTool, setExecutingTool] = useState<MCPTool | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Persist tools
  useEffect(() => {
    saveToolsToStorage(tools);
  }, [tools]);

  const handleSaveTool = (tool: MCPTool) => {
    setTools((prev) => {
      const exists = prev.findIndex((t) => t.id === tool.id);
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = tool;
        return updated;
      }
      return [tool, ...prev];
    });
    setShowEditor(false);
    setEditingTool(null);
  };

  const handleDeleteTool = (id: string) => {
    setTools((prev) => prev.filter((t) => t.id !== id));
    setDeleteConfirm(null);
  };

  const handleEditTool = (tool: MCPTool) => {
    setEditingTool(tool);
    setShowEditor(true);
  };

  const handleCreateNew = () => {
    setEditingTool(null);
    setShowEditor(true);
  };

  const filteredTools = tools.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className="min-h-screen text-white antialiased"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.1), transparent), linear-gradient(to bottom, #020817, #04091a)",
      }}
    >
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 700,
            height: 700,
            background:
              "radial-gradient(circle, rgba(99,102,241,0.15), transparent 70%)",
            top: -300,
            left: "25%",
          }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 400,
            height: 400,
            background:
              "radial-gradient(circle, rgba(168,85,247,0.1), transparent 70%)",
            bottom: "5%",
            right: "5%",
          }}
        />
      </div>

      {/* Header */}
      <header
        className="sticky top-0 z-30 backdrop-blur-xl"
        style={{
          background: "rgba(2,8,23,0.75)",
          borderBottom: "1px solid rgba(148,163,184,0.05)",
        }}
      >
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-2 rounded-xl transition-all mr-1"
              style={{ color: "rgba(148,163,184,0.55)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(148,163,184,0.07)";
                (e.currentTarget as HTMLElement).style.color = "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(148,163,184,0.55)";
              }}
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(245,158,11,0.9), rgba(249,115,22,0.9))",
                boxShadow: "0 0 20px rgba(245,158,11,0.35)",
              }}
            >
              <Wrench className="w-4 h-4 text-white" />
            </div>
            <div>
              <p
                className="text-sm font-bold tracking-tight"
                style={{
                  background: "linear-gradient(to right, #e2e8f0, #94a3b8)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                MCP Tools
              </p>
              <p
                className="text-xs"
                style={{ color: "rgba(100,116,139,0.7)" }}
              >
                Create & run SQL tool kits
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Shows the shared connection status */}
            <StatusPill connected={connected} checking={checking} />
            <div
              className="w-px h-5"
              style={{ background: "rgba(148,163,184,0.08)" }}
            />
            <Link
              to="/"
              className="p-2 rounded-xl transition-colors"
              style={{ color: "rgba(148,163,184,0.55)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(148,163,184,0.07)";
                (e.currentTarget as HTMLElement).style.color = "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(148,163,184,0.55)";
              }}
              title="Back to QueryLens"
            >
              <Database className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6 relative z-10">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tools…"
              className="w-full rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none transition-all"
              style={{
                background: "rgba(10,15,35,0.95)",
                border: "1px solid rgba(148,163,184,0.09)",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "rgba(99,102,241,0.5)";
                e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.08)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "rgba(148,163,184,0.09)";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "white",
              boxShadow:
                "0 0 20px rgba(99,102,241,0.3), 0 4px 12px rgba(0,0,0,0.3)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                "0 0 30px rgba(99,102,241,0.5), 0 4px 16px rgba(0,0,0,0.4)";
              (e.currentTarget as HTMLElement).style.transform =
                "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                "0 0 20px rgba(99,102,241,0.3), 0 4px 12px rgba(0,0,0,0.3)";
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
            }}
          >
            <Plus className="w-4 h-4" />
            New Tool
          </button>
        </div>

        {/* Tools grid */}
        {filteredTools.length === 0 ? (
          <div className="text-center py-20">
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{
                background: "rgba(99,102,241,0.07)",
                border: "1px solid rgba(99,102,241,0.14)",
              }}
            >
              <Wrench className="w-7 h-7" style={{ color: "#6366f1" }} />
            </div>
            <h2 className="text-base font-semibold text-slate-300 mb-2">
              {searchQuery ? "No tools found" : "No tools yet"}
            </h2>
            <p
              className="text-sm mb-5"
              style={{ color: "rgba(100,116,139,0.55)" }}
            >
              {searchQuery
                ? "Try a different search term"
                : "Create your first tool to get started. Each tool can contain multiple SQL queries."}
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreateNew}
                className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: "white",
                  boxShadow: "0 0 20px rgba(99,102,241,0.3)",
                }}
              >
                Create First Tool
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTools.map((tool) => (
              <div
                key={tool.id}
                className="group rounded-2xl overflow-hidden transition-all duration-200"
                style={{
                  background: "rgba(10,15,35,0.95)",
                  border: "1px solid rgba(148,163,184,0.07)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "rgba(99,102,241,0.2)";
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 10px 40px rgba(0,0,0,0.3)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "rgba(148,163,184,0.07)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(249,115,22,0.15))",
                          border: "1px solid rgba(245,158,11,0.1)",
                        }}
                      >
                        <Wrench
                          className="w-5 h-5"
                          style={{ color: "#f59e0b" }}
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-200 truncate">
                          {tool.name}
                        </h3>
                        {tool.description && (
                          <p
                            className="text-xs mt-0.5 truncate"
                            style={{ color: "rgba(148,163,184,0.5)" }}
                          >
                            {tool.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEditTool(tool)}
                        className="p-2 rounded-lg transition-all"
                        style={{ color: "rgba(148,163,184,0.5)" }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background =
                            "rgba(148,163,184,0.08)";
                          (e.currentTarget as HTMLElement).style.color =
                            "#e2e8f0";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background =
                            "transparent";
                          (e.currentTarget as HTMLElement).style.color =
                            "rgba(148,163,184,0.5)";
                        }}
                        title="Edit"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {deleteConfirm === tool.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteTool(tool.id)}
                            className="px-2 py-1 rounded-lg text-xs font-semibold transition-all"
                            style={{
                              background: "rgba(239,68,68,0.15)",
                              color: "#f87171",
                            }}
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 rounded-lg text-xs transition-all"
                            style={{ color: "rgba(148,163,184,0.5)" }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(tool.id)}
                          className="p-2 rounded-lg transition-all"
                          style={{ color: "rgba(239,68,68,0.4)" }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background =
                              "rgba(239,68,68,0.08)";
                            (e.currentTarget as HTMLElement).style.color =
                              "#f87171";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background =
                              "transparent";
                            (e.currentTarget as HTMLElement).style.color =
                              "rgba(239,68,68,0.4)";
                          }}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {tool.sqls.map((s, i) => (
                      <span
                        key={s.id}
                        className="text-xs px-2.5 py-1 rounded-lg truncate max-w-[200px]"
                        style={{
                          background: "rgba(99,102,241,0.06)",
                          color: "rgba(165,180,252,0.7)",
                          border: "1px solid rgba(99,102,241,0.08)",
                        }}
                        title={s.sql}
                      >
                        <span style={{ color: "rgba(99,102,241,0.5)" }}>
                          {i + 1}.
                        </span>{" "}
                        {s.label}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => setExecutingTool(tool)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
                    style={{
                      background: connected
                        ? "linear-gradient(135deg, rgba(5,150,105,0.9), rgba(16,185,129,0.9))"
                        : "rgba(100,116,139,0.15)",
                      color: connected ? "white" : "rgba(148,163,184,0.5)",
                      boxShadow: connected
                        ? "0 0 15px rgba(16,185,129,0.2), 0 3px 8px rgba(0,0,0,0.2)"
                        : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (connected) {
                        (e.currentTarget as HTMLElement).style.boxShadow =
                          "0 0 25px rgba(16,185,129,0.4), 0 4px 12px rgba(0,0,0,0.3)";
                        (e.currentTarget as HTMLElement).style.transform =
                          "translateY(-1px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        connected
                          ? "0 0 15px rgba(16,185,129,0.2), 0 3px 8px rgba(0,0,0,0.2)"
                          : "none";
                      (e.currentTarget as HTMLElement).style.transform =
                        "translateY(0)";
                    }}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Run Tool
                  </button>
                </div>

                <div
                  className="px-5 py-2.5 flex items-center justify-between"
                  style={{
                    borderTop: "1px solid rgba(148,163,184,0.04)",
                    background: "rgba(2,6,18,0.3)",
                  }}
                >
                  <span
                    className="text-xs flex items-center gap-1.5"
                    style={{ color: "rgba(100,116,139,0.4)" }}
                  >
                    <FileText className="w-3 h-3" />
                    {tool.sqls.length}{" "}
                    {tool.sqls.length === 1 ? "query" : "queries"}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "rgba(100,116,139,0.3)" }}
                  >
                    {new Date(tool.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showEditor && (
        <MCPToolEditor
          tool={editingTool}
          onSave={handleSaveTool}
          onClose={() => {
            setShowEditor(false);
            setEditingTool(null);
          }}
        />
      )}

      {executingTool && (
        <MCPToolExecutionModal
          tool={executingTool}
          dbConfig={dbConfig}
          dbConnected={connected}
          onClose={() => setExecutingTool(null)}
        />
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

interface MainPageProps {
  dbConfig: DBConfig;
  setDbConfig: React.Dispatch<React.SetStateAction<DBConfig>>;
  connected: boolean;
  checking: boolean;
  onCheckConnection: () => void;
}

const MainPage: React.FC<MainPageProps> = ({
  dbConfig,
  setDbConfig,
  connected,
  checking,
  onCheckConnection,
}) => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    stage: "loading",
    naturalQuery: "",
    sql: "",
    fullWebhookResponse: "",
    queryResult: null,
    error: "",
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 260) + "px";
    }
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const query = input.trim();
    setLoading(true);

    setModal({
      isOpen: true,
      stage: "loading",
      naturalQuery: query,
      sql: "",
      fullWebhookResponse: "",
      queryResult: null,
      error: "",
    });

    try {
      const { text, sql } = await sendToWebhook(query);

      if (!sql) {
        setModal((prev) => ({
          ...prev,
          stage: "error",
          fullWebhookResponse: text,
          error: `No SQL query could be extracted from the webhook response.\n\nFull response:\n${text}`,
        }));
      } else {
        setModal((prev) => ({
          ...prev,
          stage: "sql-preview",
          sql,
          fullWebhookResponse: text,
        }));
      }

      setHistory((prev) =>
        [
          {
            id: crypto.randomUUID(),
            query,
            sql: sql || "",
            result: null,
            timestamp: new Date(),
            webhookResponse: text,
          },
          ...prev,
        ].slice(0, 50)
      );
    } catch (err) {
      setModal((prev) => ({
        ...prev,
        stage: "error",
        error: err instanceof Error ? err.message : "Unknown error occurred",
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteFromModal = async () => {
    if (!modal.sql || !connected) return;

    setModal((prev) => ({ ...prev, stage: "executing" }));

    try {
      const result = await executeSQL(modal.sql, dbConfig);

      setModal((prev) => ({
        ...prev,
        stage: "results",
        queryResult: result,
      }));

      setHistory((prev) => {
        const updated = [...prev];
        const idx = updated.findIndex((h) => h.sql === modal.sql);
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], result };
        }
        return updated;
      });
    } catch (err) {
      setModal((prev) => ({
        ...prev,
        stage: "results",
        queryResult: {
          success: false,
          error: err instanceof Error ? err.message : "Execution failed",
        },
      }));
    }
  };

  const handleCloseModal = () => {
    setModal({
      isOpen: false,
      stage: "loading",
      naturalQuery: "",
      sql: "",
      fullWebhookResponse: "",
      queryResult: null,
      error: "",
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const toolCount = loadToolsFromStorage().length;

  return (
    <div
      className="min-h-screen text-white antialiased"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.1), transparent), linear-gradient(to bottom, #020817, #04091a)",
      }}
    >
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 700,
            height: 700,
            background:
              "radial-gradient(circle, rgba(99,102,241,0.15), transparent 70%)",
            top: -300,
            left: "25%",
          }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 400,
            height: 400,
            background:
              "radial-gradient(circle, rgba(168,85,247,0.1), transparent 70%)",
            bottom: "5%",
            right: "5%",
          }}
        />
      </div>

      {/* Header */}
      <header
        className="sticky top-0 z-30 backdrop-blur-xl"
        style={{
          background: "rgba(2,8,23,0.75)",
          borderBottom: "1px solid rgba(148,163,184,0.05)",
        }}
      >
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(99,102,241,0.9), rgba(168,85,247,0.9))",
                boxShadow: "0 0 20px rgba(99,102,241,0.35)",
              }}
            >
              <Database className="w-4 h-4 text-white" />
            </div>
            <div>
              <p
                className="text-sm font-bold tracking-tight"
                style={{
                  background: "linear-gradient(to right, #e2e8f0, #94a3b8)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                MerlinTools
              </p>
              <p
                className="text-xs"
                style={{ color: "rgba(100,116,139,0.7)" }}
              >
                Powered by Aptean AIS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StatusPill connected={connected} checking={checking} />

            <div
              className="w-px h-5"
              style={{ background: "rgba(148,163,184,0.08)" }}
            />

            <Link
              to="/tools"
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.15)",
                color: "#f59e0b",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(245,158,11,0.15)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(245,158,11,0.08)";
              }}
              title="MCP Tools"
            >
              <Wrench className="w-3.5 h-3.5" />
              Tools
              {toolCount > 0 && (
                <span
                  className="w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
                  style={{ background: "#f59e0b", fontSize: 9 }}
                >
                  {toolCount > 9 ? "9+" : toolCount}
                </span>
              )}
            </Link>

           

            <button
              onClick={() => {
                setShowConfig((p) => !p);
                setShowHistory(false);
              }}
              className="p-2 rounded-xl transition-colors"
              style={{ color: "rgba(148,163,184,0.55)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(148,163,184,0.07)";
                (e.currentTarget as HTMLElement).style.color = "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(148,163,184,0.55)";
              }}
              title="DB Settings"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-5 relative z-10">
        {/* DB Config Panel */}
        {showConfig && (
          <div
            className="rounded-2xl p-6"
            style={{
              background: "rgba(10,15,35,0.95)",
              border: "1px solid rgba(148,163,184,0.07)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            <p className="text-sm font-semibold text-slate-200 mb-4">
              PostgreSQL Connection
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(Object.keys(dbConfig) as Array<keyof DBConfig>).map((key) => (
                <div key={key}>
                  <label
                    className="block text-xs font-semibold uppercase tracking-widest mb-1.5"
                    style={{ color: "rgba(100,116,139,0.7)" }}
                  >
                    {key}
                  </label>
                  <input
                    type={key === "password" ? "password" : "text"}
                    value={dbConfig[key]}
                    onChange={(e) =>
                      setDbConfig((p) => ({ ...p, [key]: e.target.value }))
                    }
                    className="w-full rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none transition-all"
                    style={{
                      background: "rgba(2,6,18,0.9)",
                      border: "1px solid rgba(148,163,184,0.09)",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "rgba(99,102,241,0.5)";
                      e.target.style.boxShadow =
                        "0 0 0 3px rgba(99,102,241,0.08)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "rgba(148,163,184,0.09)";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={onCheckConnection}
                disabled={checking}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{
                  background: "rgba(99,102,241,0.12)",
                  border: "1px solid rgba(99,102,241,0.2)",
                  color: "#a5b4fc",
                }}
              >
                {checking ? (
                  <>
                    <Spinner size="sm" /> Testing…
                  </>
                ) : (
                  "Test Connection"
                )}
              </button>
              {!checking && (
                <span
                  className="text-xs font-medium"
                  style={{ color: connected ? "#4ade80" : "#f87171" }}
                >
                  {connected ? "✓ Connected" : "✗ Failed"}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Main Query Card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(10,15,35,0.95)",
            border: "1px solid rgba(148,163,184,0.07)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          }}
        >
          <div
            className="flex items-center px-5 py-3"
            style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}
          >
            <div className="flex items-center gap-2">
              <svg
                className="w-3.5 h-3.5"
                style={{ color: "#a5b4fc" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "rgba(99,102,241,0.7)" }}
              >
                Natural Language Query
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "#6366f1" }}
              />
              <span
                className="text-xs font-semibold"
                style={{ color: "rgba(99,102,241,0.7)" }}
              >
                Aptean AIS Webhook
              </span>
            </div>
          </div>

          <div className="p-5">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder='Ask anything — e.g. "Show all users who signed up this month"'
              className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none leading-relaxed disabled:opacity-50"
              style={{ lineHeight: 1.75 }}
              rows={3}
            />
          </div>

          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderTop: "1px solid rgba(148,163,184,0.05)" }}
          >
            <div className="flex items-center gap-2">
              <kbd
                className="text-xs px-2 py-1 rounded-lg font-mono"
                style={{
                  background: "rgba(148,163,184,0.05)",
                  border: "1px solid rgba(148,163,184,0.09)",
                  color: "rgba(100,116,139,0.6)",
                }}
              >
                ⌘ Enter
              </kbd>
              <span
                className="text-xs"
                style={{ color: "rgba(100,116,139,0.4)" }}
              >
                to send
              </span>
            </div>
            <div className="flex items-center gap-2">
              {input && !loading && (
                <button
                  onClick={() => {
                    setInput("");
                    textareaRef.current?.focus();
                  }}
                  className="px-3 py-1.5 text-xs rounded-xl transition-all"
                  style={{ color: "rgba(100,116,139,0.5)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(148,163,184,0.06)";
                    (e.currentTarget as HTMLElement).style.color = "#e2e8f0";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                    (e.currentTarget as HTMLElement).style.color =
                      "rgba(100,116,139,0.5)";
                  }}
                >
                  Clear
                </button>
              )}
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  color: "white",
                  boxShadow:
                    "0 0 20px rgba(99,102,241,0.3), 0 4px 12px rgba(0,0,0,0.3)",
                }}
                onMouseEnter={(e) => {
                  if (!loading && input.trim()) {
                    (e.currentTarget as HTMLElement).style.boxShadow =
                      "0 0 30px rgba(99,102,241,0.5), 0 4px 16px rgba(0,0,0,0.4)";
                    (e.currentTarget as HTMLElement).style.transform =
                      "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 0 20px rgba(99,102,241,0.3), 0 4px 12px rgba(0,0,0,0.3)";
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(0)";
                }}
              >
                {loading ? (
                  <>
                    <Spinner size="sm" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {!connected && !checking && (
          <div className="text-center py-16">
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{
                background: "rgba(251,191,36,0.07)",
                border: "1px solid rgba(251,191,36,0.14)",
              }}
            >
              <Database className="w-7 h-7" style={{ color: "#fbbf24" }} />
            </div>
            <h2 className="text-base font-semibold text-slate-300 mb-2">
              Database not connected
            </h2>
            <p
              className="text-sm mb-2"
              style={{ color: "rgba(100,116,139,0.55)" }}
            >
              You can still send queries to the webhook, but SQL execution
              requires a database connection.
            </p>
            <p
              className="text-sm mb-5"
              style={{ color: "rgba(100,116,139,0.55)" }}
            >
              Configure your PostgreSQL connection to enable execution.
            </p>
            <button
              onClick={() => setShowConfig(true)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "white",
                boxShadow: "0 0 20px rgba(99,102,241,0.3)",
              }}
            >
              Open Settings
            </button>
          </div>
        )}
      </main>

      <SQLResponseModal
        modal={modal}
        onClose={handleCloseModal}
        onExecute={handleExecuteFromModal}
        dbConnected={connected}
      />
    </div>
  );
};

// ─── App Router — owns ALL shared DB state ────────────────────────────────────

const App: React.FC = () => {
  // Single source of truth for DB config — defaults to "kes"
  const [dbConfig, setDbConfig] = useState<DBConfig>(DEFAULT_DB_CONFIG);
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);

  const doCheckConnection = useCallback(async () => {
    setChecking(true);
    const ok = await checkDBConnection(dbConfig);
    setConnected(ok);
    setChecking(false);
  }, [dbConfig]);

  // Check on mount and whenever dbConfig changes
  useEffect(() => {
    doCheckConnection();
  }, [doCheckConnection]);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <MainPage
            dbConfig={dbConfig}
            setDbConfig={setDbConfig}
            connected={connected}
            checking={checking}
            onCheckConnection={doCheckConnection}
          />
        }
      />
      <Route
        path="/tools"
        element={
          <MCPToolsPage
            dbConfig={dbConfig}
            connected={connected}
            checking={checking}
            onCheckConnection={doCheckConnection}
          />
        }
      />
      <Route
        path="/knowledgeExtractor"
        element={<ApteanKnowledgeExtractor />}
      />
    </Routes>
  );
};

export default App;