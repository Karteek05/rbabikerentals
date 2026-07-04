import { Pool } from "pg";

let pool: Pool | null = null;

export function resolvePgConnectionString() {
  return process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
}

function createPgPool(connectionString: string) {
  return new Pool({
    connectionString,
    ssl: connectionString.includes("supabase.co")
      ? { rejectUnauthorized: false }
      : undefined
  });
}

export function getPgPool(): Pool {
  const connectionString = resolvePgConnectionString();
  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL or DATABASE_URL is required for transactional database access.");
  }

  if (!pool) {
    pool = createPgPool(connectionString);
  }

  return pool;
}

export async function closePgPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
