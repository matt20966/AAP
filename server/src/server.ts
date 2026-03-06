import express from "express";
import cors from "cors";
import pg from "../node_modules/@types/pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ── Constants ─────────────────────────────────────────────────────────────────
const APTEAN_ENDPOINT = process.env.APTEAN_ENDPOINT || "https://appcentral-int.aptean.com/ais/api/v1/run/880716fe-3d8b-4f3b-963d-0fec2625814a?stream=false";

const APTEAN_WEBHOOK_URL = process.env.APTEAN_WEBHOOK_URL || "https://appcentral-int.aptean.com/ais/api/v1/run/880716fe-3d8b-4f3b-963d-0fec2625814a?stream=false";

const APTEAN_API_KEY  = process.env.APTEAN_API_KEY  || "sk-15B4geGcWPAtU6Vh2YedAZnuGhnEiUipO74KAwLOGDE-C2E3O01PIHLI79OMT";
const APTEAN_COID     = process.env.APTEAN_COID;

const APTEAN_TOKEN_URL           = "https://appcentral-int.aptean.com/iam/auth/realms/aptean/protocol/openid-connect/token";
const APTEAN_TOKEN_CLIENT_ID     = process.env.APTEAN_CLIENT_ID     || "PXK96UTIIQ7935FP1-SERVICE";
const APTEAN_TOKEN_CLIENT_SECRET = process.env.APTEAN_CLIENT_SECRET || "xdNBlj3EAecKALhoH8Af3sSwScOxpn7u";

// ── Token state ───────────────────────────────────────────────────────────────
let currentBearerToken: string = "";
let tokenExpiresAt: number = 0;
let tokenRefreshPromise: Promise<void> | null = null;

// ── Token Management ──────────────────────────────────────────────────────────
async function refreshToken(): Promise<void> {
  console.log("🔄 Refreshing Aptean token...");

  const params = new URLSearchParams({
    client_id:     APTEAN_TOKEN_CLIENT_ID,
    client_secret: APTEAN_TOKEN_CLIENT_SECRET,
    grant_type:    "client_credentials",
  });

  const res = await fetch(APTEAN_TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    params.toString(),
  });

  const rawText = await res.text();

  if (!res.ok) {
    throw new Error(`Token fetch failed ${res.status}: ${rawText.slice(0, 300)}`);
  }

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`Token response not JSON: ${rawText.slice(0, 200)}`);
  }

  if (!data.access_token) {
    throw new Error(`No access_token in response: ${JSON.stringify(data).slice(0, 200)}`);
  }

  currentBearerToken = data.access_token;

  // Expire 2 minutes early to avoid edge cases
  const expiresIn = (data.expires_in ?? 1800) - 120;
  tokenExpiresAt = Date.now() + expiresIn * 1000;

  console.log(`✅ Token refreshed — valid for ${data.expires_in}s (refresh in ${expiresIn}s)`);
  console.log(`   Preview: ${currentBearerToken.slice(0, 20)}...${currentBearerToken.slice(-10)}`);
}

// Prevent concurrent refresh calls (token stampede guard)
async function ensureValidToken(): Promise<void> {
  const isExpired = Date.now() >= tokenExpiresAt;
  const isEmpty   = !currentBearerToken;

  if (!isEmpty && !isExpired) return;

  if (!tokenRefreshPromise) {
    tokenRefreshPromise = refreshToken().finally(() => {
      tokenRefreshPromise = null;
    });
  }

  await tokenRefreshPromise;
}

// Fetch token immediately on startup
refreshToken().catch((err) => {
  console.error("⚠️  Initial token fetch failed:", err.message);
  console.error("    Will retry automatically on first request.");
});

// Auto-refresh every 25 minutes (tokens last 30 min)
setInterval(() => {
  refreshToken().catch((err) => {
    console.error("⚠️  Token auto-refresh failed:", err.message);
  });
}, 25 * 60 * 1000);

// ── DB Pool ───────────────────────────────────────────────────────────────────
let pool: pg.Pool | null = null;

function getPool(config: {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
}): pg.Pool {
  if (pool) pool.end();
  pool = new Pool({
    host:                   config.host,
    port:                   parseInt(config.port),
    database:               config.database,
    user:                   config.user,
    password:               config.password,
    max:                    5,
    idleTimeoutMillis:      30000,
    connectionTimeoutMillis: 5000,
  });
  return pool;
}

// ── Build Aptean headers ──────────────────────────────────────────────────────
// Always call ensureValidToken() before this so the token is fresh
function getApteanHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (currentBearerToken) {
    headers["Authorization"] = `Bearer ${currentBearerToken}`;
  }
  if (APTEAN_API_KEY) {
    headers["x-api-key"] = APTEAN_API_KEY;
  }
  if (APTEAN_COID) {
    headers["X-APTEAN-COID"] = APTEAN_COID;
  }

  return headers;
}

// ── SQL Sanitizer ─────────────────────────────────────────────────────────────
function sanitizeSQL(raw: string): string {
  return raw
    .replace(/```[\w]*\n?/gi, "")
    .replace(/`/g, "")
    .replace(/\\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\r/g, "")
    .trim();
}

// ── Extract text from Aptean response JSON ────────────────────────────────────
function extractTextFromApteanResponse(json: any): string {
  if (typeof json === "string") return json;

  // Path 1
  const p1 = json?.outputs?.[0]?.outputs?.[0]?.results?.output_value?.response?.text;
  if (p1 && typeof p1 === "string") return p1;

  // Path 2
  const p2 = json?.outputs?.[0]?.outputs?.[0]?.results?.output_value?.structured_response?.data?.content;
  if (p2 && typeof p2 === "string") return p2;

  // Path 3 — matches the actual curl response structure
  const p3 = json?.outputs?.[0]?.outputs?.[0]?.results?.message?.text;
  if (p3 && typeof p3 === "string") return p3;

  // Path 3b
  const p3b = json?.outputs?.[0]?.outputs?.[0]?.results?.message?.data?.text;
  if (p3b && typeof p3b === "string") return p3b;

  // Path 4
  const p4 = json?.outputs?.[0]?.outputs?.[0]?.messages?.[0]?.message;
  if (p4 && typeof p4 === "string") return p4;

  // Path 5
  const p5 = json?.outputs?.[0]?.outputs?.[0]?.artifacts?.message;
  if (p5 && typeof p5 === "string") return p5;

  // Path 6 — top-level fallbacks
  const p6 =
    json?.outputs?.[0]?.message ||
    json?.result ||
    json?.output ||
    json?.text ||
    json?.response ||
    json?.message ||
    null;
  if (p6 && typeof p6 === "string") return p6;
  if (p6 && typeof p6 === "object") return JSON.stringify(p6, null, 2);

  // Path 7 — deep search
  if (Array.isArray(json?.outputs)) {
    for (const output of json.outputs) {
      if (!Array.isArray(output?.outputs)) continue;

      for (const inner of output.outputs) {
        const ovText = inner?.results?.output_value?.response?.text;
        if (ovText && typeof ovText === "string") return ovText;

        const ovContent = inner?.results?.output_value?.structured_response?.data?.content;
        if (ovContent && typeof ovContent === "string") return ovContent;

        // content_blocks on output_value
        const blocks = inner?.results?.output_value?.response?.content_blocks;
        if (Array.isArray(blocks)) {
          for (const block of blocks) {
            for (const content of block?.contents ?? []) {
              if (content?.text && typeof content.text === "string") return content.text;
            }
          }
        }

        // content_blocks on message
        const msgBlocks = inner?.results?.message?.content_blocks;
        if (Array.isArray(msgBlocks)) {
          for (const block of msgBlocks) {
            for (const content of block?.contents ?? []) {
              if (content?.text && typeof content.text === "string") return content.text;
            }
          }
        }

        if (inner?.results?.message?.text) return inner.results.message.text;

        for (const msg of inner?.messages ?? []) {
          if (msg?.message && typeof msg.message === "string") return msg.message;
          if (msg?.text   && typeof msg.text    === "string") return msg.text;
        }

        if (inner?.artifacts?.message) return inner.artifacts.message;
      }
    }
  }

  return JSON.stringify(json, null, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  const msRemaining = tokenExpiresAt - Date.now();

  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    token: {
      hasToken:        !!currentBearerToken,
      isExpired:       Date.now() >= tokenExpiresAt,
      expiresAt:       tokenExpiresAt ? new Date(tokenExpiresAt).toISOString() : null,
      secondsRemaining: Math.max(0, Math.floor(msRemaining / 1000)),
      preview: currentBearerToken
        ? `${currentBearerToken.slice(0, 20)}...${currentBearerToken.slice(-10)}`
        : "(none)",
    },
    config: {
      endpoint:   APTEAN_ENDPOINT,
      webhookUrl: APTEAN_WEBHOOK_URL,
      coid:       APTEAN_COID,
      hasApiKey:  !!APTEAN_API_KEY,
    },
    routes: [
      "GET  /api/health",
      "POST /api/token",
      "POST /api/aptean/chat",
      "POST /api/connect",
      "POST /api/query",
      "POST /api/webhook",
      "POST /api/webhook/query",
    ],
  });
});

// ── Token endpoint ────────────────────────────────────────────────────────────
app.post("/api/token", async (_req, res) => {
  console.log("\n=== POST /api/token ===");

  try {
    // Force refresh by resetting expiry
    tokenExpiresAt = 0;
    await ensureValidToken();

    console.log("✓ Token refreshed via /api/token");

    res.json({
      success:      true,
      access_token: currentBearerToken,
      token_type:   "Bearer",
      expires_at:   new Date(tokenExpiresAt).toISOString(),
      message:      "Token refreshed — all subsequent API calls will use this token",
    });
  } catch (err) {
    console.error("❌ /api/token error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Token request failed",
    });
  }
});

// ── Aptean chat ───────────────────────────────────────────────────────────────
app.post("/api/aptean/chat", async (req, res) => {
  console.log("\n=== POST /api/aptean/chat ===");

  const { input_value } = req.body;
  if (!input_value?.trim()) {
    return res.status(400).json({ error: "No input_value provided" });
  }

  try {
    await ensureValidToken(); // ← auto-refresh before every call

    console.log("→ input_value:", input_value.slice(0, 100));
    console.log("→ token preview:", currentBearerToken.slice(0, 20) + "...");

    const apteanRes = await fetch(APTEAN_ENDPOINT, {
      method:  "POST",
      headers: getApteanHeaders(),
      body:    JSON.stringify({
        output_type: "chat",
        input_type:  "chat",
        input_value,
      }),
    });

    const rawText = await apteanRes.text();
    console.log("← status:", apteanRes.status);
    console.log("← body preview:", rawText.slice(0, 300));

    if (!apteanRes.ok) {
      if (apteanRes.status === 401 || apteanRes.status === 403) {
        // Force a refresh on next call
        tokenExpiresAt = 0;
        return res.status(apteanRes.status).json({
          error: `Authentication failed (${apteanRes.status}). Retrying token on next request.`,
          details: rawText.slice(0, 300),
        });
      }
      return res.status(apteanRes.status).json({
        error: `Aptean error ${apteanRes.status}: ${rawText.slice(0, 300)}`,
      });
    }

    const json = JSON.parse(rawText);
    const text = extractTextFromApteanResponse(json);

    res.json({ text });
  } catch (err) {
    console.error("❌ /api/aptean/chat error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Aptean chat failed",
    });
  }
});

// ── DB connect ────────────────────────────────────────────────────────────────
app.post("/api/connect", async (req, res) => {
  try {
    const p      = getPool(req.body);
    const client = await p.connect();
    const { rows } = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
    );
    client.release();
    res.json({
      connected: true,
      tables:    rows.map((r: { tablename: string }) => r.tablename),
    });
  } catch (err) {
    res.json({
      connected: false,
      tables:    [],
      error:     err instanceof Error ? err.message : "Connection failed",
    });
  }
});

// ── DB query ──────────────────────────────────────────────────────────────────
app.post("/api/query", async (req, res) => {
  const { sql, dbConfig } = req.body;
  const cleanSql = sanitizeSQL(sql ?? "");

  if (!cleanSql) {
    return res.status(400).json({ success: false, error: "No SQL provided" });
  }

  try {
    const p     = getPool(dbConfig);
    const start = Date.now();
    const result = await p.query(cleanSql);

    res.json({
      success:  true,
      data:     result.rows || [],
      columns:  result.fields?.map((f: pg.FieldDef) => f.name) || [],
      rowCount: result.rowCount ?? 0,
      command:  result.command,
      duration: Date.now() - start,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error:   err instanceof Error ? err.message : "Query failed",
    });
  }
});

// ── Webhook Query (Natural Language → SQL) ────────────────────────────────────
app.post("/api/webhook/query", async (req, res) => {
  console.log("\n=== POST /api/webhook/query ===");

  const { input_value, webhook_url } = req.body;

  if (!input_value?.trim()) {
    return res.status(400).json({ error: "No input_value provided" });
  }

  const targetUrl = webhook_url || APTEAN_WEBHOOK_URL;

  try {
    await ensureValidToken(); // ← auto-refresh before every call

    console.log("→ URL:", targetUrl);
    console.log("→ input_value:", input_value.slice(0, 200));
    console.log("→ token preview:", currentBearerToken.slice(0, 20) + "...");

    const response = await fetch(targetUrl, {
      method:  "POST",
      headers: getApteanHeaders(),
      body:    JSON.stringify({
        input_value,
        output_type: "chat",
        input_type:  "chat",
        tweaks:      {},
      }),
    });

    const rawText = await response.text();
    console.log("← status:", response.status);
    console.log("← body preview:", rawText.slice(0, 400));

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        tokenExpiresAt = 0; // force refresh next time
        return res.status(response.status).json({
          error: `Authentication failed (${response.status}). Token invalidated — will refresh on next request.`,
        });
      }
      return res.status(response.status).json({
        error: `Webhook returned ${response.status}: ${rawText.slice(0, 300)}`,
      });
    }

    let responseData: any;
    try {
      responseData = JSON.parse(rawText);
    } catch {
      responseData = { raw: rawText };
    }

    const rawExtracted = extractTextFromApteanResponse(responseData);
    const text         = sanitizeSQL(rawExtracted);

    console.log("✓ Extracted:", rawExtracted.slice(0, 200));
    console.log("✓ Sanitized:", text.slice(0, 200));

    res.json({ text, response: text, fullResponse: responseData });
  } catch (err) {
    console.error("❌ /api/webhook/query error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Webhook query failed",
    });
  }
});

// ── Webhook (Knowledge Extractor) ─────────────────────────────────────────────
app.post("/api/webhook", async (req, res) => {
  console.log("\n=== POST /api/webhook ===");

  const { queryResult, metadata, source = "knowledge-extractor" } = req.body;

  try {
    await ensureValidToken(); // ← auto-refresh before every call

    const columns: string[]                    = metadata?.columns || [];
    const data: Record<string, unknown>[]      = queryResult?.data || [];

    // Build the input_value string sent to the AI
    const lines: string[] = [
      `Source: ${metadata?.source || source}`,
      `Query: ${metadata?.query   || ""}`,
      `SQL: ${metadata?.sql       || ""}`,
      `Command: ${metadata?.command || ""}`,
      `Row Count: ${metadata?.rowCount ?? data.length}`,
      `Duration: ${metadata?.duration  ?? 0}ms`,
      `Timestamp: ${metadata?.sentAt   || new Date().toISOString()}`,
    ];

    if (metadata?.filename) lines.push(`Filename: ${metadata.filename}`);
    if (metadata?.fileType) lines.push(`File Type: ${metadata.fileType}`);

    lines.push("", "--- Data ---");

    if (columns.length > 0 && data.length > 0) {
      lines.push(columns.join(" | "));
      lines.push(columns.map(() => "---").join(" | "));
      for (const row of data) {
        lines.push(
          columns.map((col) => {
            const v = row[col];
            if (v === null || v === undefined) return "NULL";
            if (typeof v === "object")          return JSON.stringify(v);
            return String(v);
          }).join(" | ")
        );
      }
    } else if (data.length > 0) {
      for (const row of data) lines.push(JSON.stringify(row));
    } else {
      lines.push("(no data)");
    }

    const input_value = lines.join("\n");

    console.log("→ Aptean URL:", APTEAN_ENDPOINT);
    console.log("→ input_value length:", input_value.length);
    console.log("→ preview:", input_value.slice(0, 200));
    console.log("→ token preview:", currentBearerToken.slice(0, 20) + "...");
    console.log("→ header keys:", Object.keys(getApteanHeaders()));

    const response = await fetch(APTEAN_ENDPOINT, {
      method:  "POST",
      headers: getApteanHeaders(),
      body:    JSON.stringify({
        output_type: "chat",
        input_type:  "chat",
        input_value,
      }),
    });

    const rawText = await response.text();
    console.log("← status:", response.status);
    console.log("← body preview:", rawText.slice(0, 300));

    let responseData: unknown;
    try {
      responseData = JSON.parse(rawText);
    } catch {
      responseData = { raw: rawText };
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        tokenExpiresAt = 0; // force refresh next time
        return res.status(response.status).json({
          success: false,
          error:   `Authentication failed (${response.status}). Token invalidated — will refresh on next request.`,
          details: responseData,
        });
      }
      return res.status(response.status).json({
        success: false,
        error:   `Aptean returned ${response.status}: ${response.statusText}`,
        details: responseData,
      });
    }

    const json = responseData as any;
    const text = extractTextFromApteanResponse(json);

    console.log("✓ Extracted text length:", text?.length || 0);
    console.log("✓ Extracted text preview:", String(text).slice(0, 200));

    res.json({
      success:         true,
      webhookStatus:   response.status,
      text,
      webhookResponse: responseData,
      _debug: {
        apteanResponseStructure: {
          hasOutputs:      !!json?.outputs,
          outputsLength:   json?.outputs?.length,
          firstOutputKeys: Object.keys(json?.outputs?.[0] || {}).slice(0, 5),
        },
      },
    });
  } catch (err) {
    console.error("❌ /api/webhook error:", err);
    res.status(500).json({
      success: false,
      error:   err instanceof Error ? err.message : "Webhook failed",
    });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`   Has API Key     : ${!!APTEAN_API_KEY}`);
  console.log(`   Token URL       : ${APTEAN_TOKEN_URL}\n`);
});