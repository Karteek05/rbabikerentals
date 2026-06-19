import { NextResponse } from "next/server";
import { Pool } from "pg";

export async function GET() {
  const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) return NextResponse.json({ error: "No DB config found" }, { status: 500 });
  
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes("supabase.co") ? { rejectUnauthorized: false } : undefined
  });
  
  const email = "cherukupallikarteek05@gmail.com";
  try {
    const res = await pool.query("UPDATE \"user\" SET role = $1 WHERE email = $2 RETURNING id", ["admin", email]);
    if (res.rowCount && res.rowCount > 0) {
      const userId = res.rows[0].id;
      await pool.query("UPDATE app_users SET role = $1 WHERE id = $2", ["admin", userId]);
      return NextResponse.json({ success: true, message: `Promoted ${email} to admin!` });
    }
    return NextResponse.json({ success: false, message: `User ${email} not found` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    pool.end();
  }
}
