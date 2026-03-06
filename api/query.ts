import type { VercelRequest, VercelResponse } from "@vercel/node";
import { FieldDef } from "pg";
import { getPool } from "./_lib/pool";
import { sanitizeSQL } from "./_lib/headers";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { sql, dbConfig } = req.body;
  const cleanSql = sanitizeSQL(sql ?? "");

  if (!cleanSql) {
    res.status(400).json({ success: false, error: "No SQL provided" });
    return;
  }

  try {
    const p = getPool(dbConfig);
    const start = Date.now();
    const result = await p.query(cleanSql);

    res.json({
      success: true,
      data: result.rows || [],
      columns: result.fields?.map((f: FieldDef) => f.name) || [],
      rowCount: result.rowCount ?? 0,
      command: result.command,
      duration: Date.now() - start,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : "Query failed",
    });
  }
}