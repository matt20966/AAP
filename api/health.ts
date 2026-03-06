import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    routes: [
      "GET  /api/health",
      "POST /api/token",
      "POST /api/aptean/chat",
      "POST /api/connect",
      "POST /api/query",
      "POST /api/webhook",
      "POST /api/webhook/query",
    ],
    config: {
      hasApiKey: !!process.env.APTEAN_API_KEY,
      hasClientId: !!process.env.APTEAN_CLIENT_ID,
      hasClientSecret: !!process.env.APTEAN_CLIENT_SECRET,
      endpoint: process.env.APTEAN_ENDPOINT || "(using default)",
    },
  });
}