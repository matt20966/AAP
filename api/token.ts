import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchFreshToken } from "./_lib/token";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    console.log("ENV CHECK:", {
      hasClientId: !!process.env.APTEAN_CLIENT_ID,
      hasClientSecret: !!process.env.APTEAN_CLIENT_SECRET,
      hasApiKey: !!process.env.APTEAN_API_KEY,
      clientIdPreview: process.env.APTEAN_CLIENT_ID?.slice(0, 8),
    });

    const token = await fetchFreshToken();

    res.json({
      success: true,
      access_token: token,
      token_type: "Bearer",
      message: "Token fetched successfully",
    });
  } catch (err) {
    console.error("Token handler error:", err);
    // Return full error details temporarily for debugging
    res.status(500).json({
      error: err instanceof Error ? err.message : "Token request failed",
      stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
      env: {
        hasClientId: !!process.env.APTEAN_CLIENT_ID,
        hasClientSecret: !!process.env.APTEAN_CLIENT_SECRET,
        hasApiKey: !!process.env.APTEAN_API_KEY,
      }
    });
  }
}