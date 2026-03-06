import pg, { Pool as PgPool } from "pg";

const { Pool } = pg;

// In serverless, we reuse the pool across warm invocations
// but don't rely on it persisting — always pass config per request
let cachedPool: PgPool | null = null;
let cachedConfig: string = "";

export function getPool(config: {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
}): PgPool {
  const configKey = JSON.stringify(config);

  // Reuse pool if same config and still exists (warm lambda)
  if (cachedPool && cachedConfig === configKey) {
    return cachedPool;
  }

  // End old pool if config changed
  if (cachedPool) {
    cachedPool.end().catch(() => {});
  }

  cachedPool = new Pool({
    host: config.host,
    port: parseInt(config.port),
    database: config.database,
    user: config.user,
    password: config.password,
    max: 2, // keep low for serverless
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });

  cachedConfig = configKey;
  return cachedPool;
}