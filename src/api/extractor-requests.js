// In-memory store for extractor requests (resets on cold start)
const requests = [];
const MAX_REQUESTS = 100;

export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'POST') {
    const body = req.body ?? {};
    const { download_url, filename, message, type, text } = body;

    if (!download_url && !text) {
      return res.status(400).json({
        error: 'Must provide either "download_url" or "text"',
      });
    }

    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      download_url: download_url || null,
      filename: filename || null,
      message: message || null,
      type: type || (download_url ? 'download' : 'text'),
      text: text || null,
      timestamp: Date.now(),
      fetched: false,
    };

    requests.unshift(entry);

    // Trim old entries
    if (requests.length > MAX_REQUESTS) {
      requests.length = MAX_REQUESTS;
    }

    return res.status(201).json({ success: true, id: entry.id });
  }

  if (req.method === 'GET') {
    // Return only unfetched requests, then mark them as fetched
    const unfetched = requests.filter((r) => !r.fetched);
    unfetched.forEach((r) => {
      r.fetched = true;
    });

    return res.status(200).json({ requests: unfetched });
  }

  if (req.method === 'DELETE') {
    requests.length = 0;
    return res.status(200).json({ success: true, message: 'All requests cleared' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
