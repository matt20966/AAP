const APTEAN_TOKEN_URL =
  "https://appcentral-int.aptean.com/iam/auth/realms/aptean/protocol/openid-connect/token";

export async function fetchFreshToken(): Promise<string> {
  const clientId = process.env.APTEAN_CLIENT_ID || "";
  const clientSecret = process.env.APTEAN_CLIENT_SECRET || "";

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const res = await fetch(APTEAN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const rawText = await res.text();

  if (!res.ok) {
    throw new Error(
      `Token fetch failed ${res.status}: ${rawText.slice(0, 300)}`
    );
  }

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`Token response not JSON: ${rawText.slice(0, 200)}`);
  }

  if (!data.access_token) {
    throw new Error(
      `No access_token in response: ${JSON.stringify(data).slice(0, 200)}`
    );
  }

  return data.access_token;
}