const APTEAN_API_KEY = process.env.APTEAN_API_KEY || "";
const APTEAN_COID = process.env.APTEAN_COID || "";

export function getApteanHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (APTEAN_API_KEY) {
    headers["x-api-key"] = APTEAN_API_KEY;
  }
  if (APTEAN_COID) {
    headers["X-APTEAN-COID"] = APTEAN_COID;
  }

  return headers;
}

export function sanitizeSQL(raw: string): string {
  return raw
    .replace(/```[\w]*\n?/gi, "")
    .replace(/`/g, "")
    .replace(/\\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\r/g, "")
    .trim();
}