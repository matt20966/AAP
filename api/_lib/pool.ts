import pg, { Pool as PgPool } from "pg";

const { Pool } = pg;

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

  if (cachedPool && cachedConfig === configKey) {
    return cachedPool;
  }

  if (cachedPool) {
    cachedPool.end().catch(() => {});
  }

  cachedPool = new Pool({
    host: config.host,
    port: parseInt(config.port),
    database: config.database,
    user: config.user,
    password: config.password,
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });

  cachedConfig = configKey;
  return cachedPool;
}