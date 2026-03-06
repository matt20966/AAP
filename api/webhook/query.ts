import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchFreshToken } from "../_lib/token";
import { getApteanHeaders, sanitizeSQL } from "../_lib/headers";
import { extractTextFromApteanResponse } from "../_lib/extract";

const APTEAN_WEBHOOK_URL =
  process.env.APTEAN_WEBHOOK_URL ||
  "https://appcentral-int.aptean.com/ais/api/v1/run/880716fe-3d8b-4f3b-963d-0fec2625814a?stream=false";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { input_value } = req.body;

  if (!input_value?.trim()) {
    res.status(400).json({ error: "No input_value provided" });
    return;
  }

  const targetUrl = APTEAN_WEBHOOK_URL;

  try {
    const token = await fetchFreshToken();

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: getApteanHeaders(token),
      body: JSON.stringify({
        input_value,
        output_type: "chat",
        input_type: "chat",
        tweaks: {},
      }),
    });

    const rawText = await response.text();

    if (!response.ok) {
      res.status(response.status).json({
        error: `Webhook returned ${response.status}: ${rawText.slice(0, 300)}`,
      });
      return;
    }

    let responseData: any;
    try {
      responseData = JSON.parse(rawText);
    } catch {
      responseData = { raw: rawText };
    }

    const rawExtracted = extractTextFromApteanResponse(responseData);
    const text = sanitizeSQL(rawExtracted);

    res.json({ text, response: text, fullResponse: responseData });
  } catch (err) {
    console.error("❌ /api/webhook/query error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Webhook query failed",
    });
  }
}