import { Pool } from "pg";

let pool: Pool | null = null;

export function getPgPool(): Pool {
  const connectionString = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or SUPABASE_DB_URL is required for transactional database access.");
  }

  if (!pool) {
    pool = new Pool({ connectionString });
  }

  return pool;
}

export async function closePgPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
