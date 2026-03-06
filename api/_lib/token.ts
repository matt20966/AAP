const APTEAN_TOKEN_URL =
  "https://appcentral-int.aptean.com/iam/auth/realms/aptean/protocol/openid-connect/token";

const APTEAN_TOKEN_CLIENT_ID =
  process.env.APTEAN_CLIENT_ID || "";

const APTEAN_TOKEN_CLIENT_SECRET =
  process.env.APTEAN_CLIENT_SECRET || "";

export async function fetchFreshToken(): Promise<string> {
  const params = new URLSearchParams({
    client_id: APTEAN_TOKEN_CLIENT_ID,
    client_secret: APTEAN_TOKEN_CLIENT_SECRET,
    grant_type: "client_credentials",
  });

  const res = await fetch(APTEAN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
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

  return data.access_token;
}