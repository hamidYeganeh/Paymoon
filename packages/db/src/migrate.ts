import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { database, transaction } from "./index";
export async function migrate(url: string) {
  const { pool } = database(url);
  try {
    await transaction(pool, async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(71004201)");
      await c.query("CREATE SCHEMA IF NOT EXISTS commerce");
      await c.query(
        "CREATE TABLE IF NOT EXISTS commerce.schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
      );
      const folder = join(__dirname, "../migrations");
      for (const file of readdirSync(folder)
        .filter((f) => f.endsWith(".sql"))
        .sort()) {
        const sql = readFileSync(join(folder, file), "utf8");
        const hash = createHash("sha256").update(sql).digest("hex");
        const old = await c.query(
          "SELECT checksum FROM commerce.schema_migrations WHERE name=$1",
          [file],
        );
        if (old.rowCount) {
          if (old.rows[0].checksum !== hash)
            throw new Error("Migration checksum mismatch: " + file);
          continue;
        }
        await c.query(sql);
        await c.query(
          "INSERT INTO commerce.schema_migrations(name,checksum) VALUES($1,$2)",
          [file, hash],
        );
      }
    });
  } finally {
    await pool.end();
  }
}
if (require.main === module) {
  const url = process.env.COMMERCE_DATABASE_URL;
  if (!url) throw new Error("COMMERCE_DATABASE_URL required");
  void migrate(url).catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
