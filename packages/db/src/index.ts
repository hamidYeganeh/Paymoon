import { Pool, type PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
export * from "./schema";
export type { PoolClient } from "pg";
export function database(url: string) {
  const pool = new Pool({
    connectionString: url,
    max: 10,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
  });
  return { pool, orm: drizzle(pool, { schema }) };
}
export async function transaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
