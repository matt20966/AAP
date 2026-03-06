import type { VercelRequest, VercelResponse } from "@vercel/node";

const APTEAN_TOKEN_URL =
  "https://appcentral-int.aptean.com/iam/auth/realms/aptean/protocol/openid-connect/token";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  // Log env check immediately
  const clientId = process.env.APTEAN_CLIENT_ID || "";
  const clientSecret = process.env.APTEAN_CLIENT_SECRET || "";

  console.log("ENV CHECK:", {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    clientIdPreview: clientId.slice(0, 8),
  });

  if (!clientId || !clientSecret) {
    res.status(500).json({
      error: "Missing environment variables",
      env: {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
      },
    });
    return;
  }

  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    });

    const tokenRes = await fetch(APTEAN_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const rawText = await tokenRes.text();
    console.log("Token response status:", tokenRes.status);
    console.log("Token response preview:", rawText.slice(0, 200));

    if (!tokenRes.ok) {
      res.status(500).json({
        error: `Token fetch failed: ${tokenRes.status}`,
        details: rawText.slice(0, 300),
      });
      return;
    }

    const data = JSON.parse(rawText);

    if (!data.access_token) {
      res.status(500).json({
        error: "No access_token in response",
        keys: Object.keys(data),
      });
      return;
    }

    res.json({
      success: true,
      access_token: data.access_token,
      token_type: "Bearer",
      expires_in: data.expires_in,
    });
  } catch (err) {
    console.error("Token handler crash:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
      stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
    });
  }
}