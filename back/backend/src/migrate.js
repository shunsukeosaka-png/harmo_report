import fs from "fs";
import path from "path";
import pg from "pg";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function isApplied(id) {
  const r = await pool.query("SELECT 1 FROM schema_migrations WHERE id=$1", [id]);
  return r.rowCount > 0;
}

async function markApplied(id) {
  await pool.query("INSERT INTO schema_migrations(id) VALUES($1)", [id]);
}

async function run() {
  await ensureMigrationsTable();

  const migrationsDir = path.resolve("migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // 000..., 001..., 002... の順

  for (const file of files) {
    const id = file;
    if (await isApplied(id)) {
      console.log(`skip  ${file}`);
      continue;
    }
    console.log(`apply ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    // 1ファイルを1トランザクションで適用
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
      await markApplied(id);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(`FAILED ${file}`, e);
      process.exit(1);
    } finally {
      client.release();
    }
  }

  console.log("migrations done");
  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
