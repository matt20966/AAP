export const config = {
  runtime: "nodejs20.x",
};

const APTEAN_TOKEN_URL =
  "https://appcentral-int.aptean.com/iam/auth/realms/aptean/protocol/openid-connect/token";

module.exports = async function handler(req: any, res: any) {
  const clientId = process.env.APTEAN_CLIENT_ID || "";
  const clientSecret = process.env.APTEAN_CLIENT_SECRET || "";

  console.log("api/token invoked");
  console.log("hasClientId:", !!clientId);
  console.log("hasClientSecret:", !!clientSecret);

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: "Missing env vars",
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
    });
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

    console.log("token status:", tokenRes.status);
    console.log("token preview:", rawText.slice(0, 100));

    if (!tokenRes.ok) {
      return res.status(500).json({
        error: `Token endpoint returned ${tokenRes.status}`,
        body: rawText.slice(0, 300),
      });
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      return res.status(500).json({
        error: "Token response was not JSON",
        raw: rawText.slice(0, 200),
      });
    }

    if (!data.access_token) {
      return res.status(500).json({
        error: "No access_token field in response",
        keys: Object.keys(data),
      });
    }

    return res.json({
      success: true,
      access_token: data.access_token,
      token_type: "Bearer",
      expires_in: data.expires_in,
    });
  } catch (err: any) {
    console.error("CRASH in api/token:", err);
    return res.status(500).json({
      error: err?.message || "Unknown crash",
      stack: err?.stack?.slice(0, 500),
    });
  }
};