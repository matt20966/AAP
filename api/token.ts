import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchFreshToken } from "./_lib/token";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const token = await fetchFreshToken();

    res.json({
      success: true,
      access_token: token,
      token_type: "Bearer",
      message: "Token fetched fresh on each serverless call",
    });
  } catch (err) {
    console.error("❌ /api/token error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Token request failed",
    });
  }
}