import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchFreshToken } from "../_lib/token";
import { getApteanHeaders } from "../_lib/headers";
import { extractTextFromApteanResponse } from "../_lib/extract";

const APTEAN_ENDPOINT =
  process.env.APTEAN_ENDPOINT ||
  "https://appcentral-int.aptean.com/ais/api/v1/run/880716fe-3d8b-4f3b-963d-0fec2625814a?stream=false";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { queryResult, metadata, source = "knowledge-extractor" } = req.body;

  try {
    const token = await fetchFreshToken();

    const columns: string[] = metadata?.columns || [];
    const data: Record<string, unknown>[] = queryResult?.data || [];

    const lines: string[] = [
      `Source: ${metadata?.source || source}`,
      `Query: ${metadata?.query || ""}`,
      `SQL: ${metadata?.sql || ""}`,
      `Command: ${metadata?.command || ""}`,
      `Row Count: ${metadata?.rowCount ?? data.length}`,
      `Duration: ${metadata?.duration ?? 0}ms`,
      `Timestamp: ${metadata?.sentAt || new Date().toISOString()}`,
    ];

    if (metadata?.filename) lines.push(`Filename: ${metadata.filename}`);
    if (metadata?.fileType) lines.push(`File Type: ${metadata.fileType}`);

    lines.push("", "--- Data ---");

    if (columns.length > 0 && data.length > 0) {
      lines.push(columns.join(" | "));
      lines.push(columns.map(() => "---").join(" | "));
      for (const row of data) {
        lines.push(
          columns
            .map((col) => {
              const v = row[col];
              if (v === null || v === undefined) return "NULL";
              if (typeof v === "object") return JSON.stringify(v);
              return String(v);
            })
            .join(" | ")
        );
      }
    } else if (data.length > 0) {
      for (const row of data) lines.push(JSON.stringify(row));
    } else {
      lines.push("(no data)");
    }

    const input_value = lines.join("\n");

    const response = await fetch(APTEAN_ENDPOINT, {
      method: "POST",
      headers: getApteanHeaders(token),
      body: JSON.stringify({
        output_type: "chat",
        input_type: "chat",
        input_value,
      }),
    });

    const rawText = await response.text();

    let responseData: unknown;
    try {
      responseData = JSON.parse(rawText);
    } catch {
      responseData = { raw: rawText };
    }

    if (!response.ok) {
      res.status(response.status).json({
        success: false,
        error: `Aptean returned ${response.status}: ${response.statusText}`,
        details: responseData,
      });
      return;
    }

    const json = responseData as any;
    const text = extractTextFromApteanResponse(json);

    res.json({
      success: true,
      webhookStatus: response.status,
      text,
      webhookResponse: responseData,
      _debug: {
        apteanResponseStructure: {
          hasOutputs: !!json?.outputs,
          outputsLength: json?.outputs?.length,
          firstOutputKeys: Object.keys(json?.outputs?.[0] || {}).slice(0, 5),
        },
      },
    });
  } catch (err) {
    console.error("❌ /api/webhook error:", err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Webhook failed",
    });
  }
}