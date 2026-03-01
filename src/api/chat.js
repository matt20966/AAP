export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const base = String(process.env.LLM_TUNNEL_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.LLM_GATEWAY_KEY || '').trim();
  if (!base || !key) {
    return res.status(500).json({ error: 'LLM_TUNNEL_URL or LLM_GATEWAY_KEY is not configured' });
  }

  try {
    const upstream = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-llm-key': key,
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const text = await upstream.text();
    res
      .status(upstream.status)
      .setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upstream request failed';
    return res.status(502).json({ error: message });
  }
}
