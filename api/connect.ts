import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "./_lib/pool";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const p = getPool(req.body);
    const client = await p.connect();
    const { rows } = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
    );
    client.release();

    res.json({
      connected: true,
      tables: rows.map((r: { tablename: string }) => r.tablename),
    });
  } catch (err) {
    res.json({
      connected: false,
      tables: [],
      error: err instanceof Error ? err.message : "Connection failed",
    });
  }
}