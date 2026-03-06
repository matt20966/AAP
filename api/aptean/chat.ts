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

  const { input_value } = req.body;
  if (!input_value?.trim()) {
    res.status(400).json({ error: "No input_value provided" });
    return;
  }

  try {
    const token = await fetchFreshToken();

    const apteanRes = await fetch(APTEAN_ENDPOINT, {
      method: "POST",
      headers: getApteanHeaders(token),
      body: JSON.stringify({
        output_type: "chat",
        input_type: "chat",
        input_value,
      }),
    });

    const rawText = await apteanRes.text();

    if (!apteanRes.ok) {
      res.status(apteanRes.status).json({
        error: `Aptean error ${apteanRes.status}: ${rawText.slice(0, 300)}`,
      });
      return;
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
}