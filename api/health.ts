module.exports = async function handler(_req: any, res: any) {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    env: {
      hasClientId: !!process.env.APTEAN_CLIENT_ID,
      hasClientSecret: !!process.env.APTEAN_CLIENT_SECRET,
      hasApiKey: !!process.env.APTEAN_API_KEY,
      nodeVersion: process.version,
    },
  });
};