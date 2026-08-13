import { Pool } from "pg";
import nodemailer from "nodemailer";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const REQUIRED_TABLES = [
  "user",
  "session",
  "account",
  "verification",
  "app_users",
  "vehicles",
  "bookings",
  "payment_orders",
  "payment_events",
  "notification_jobs",
  "vehicle_live_locations",
  "kyc_records",
  "damage_incidents",
  "vehicle_documents",
  "vehicle_block_windows",
  "audit_events"
];

function mask(value: string | undefined, visible = 4) {
  if (!value) return "(missing)";
  if (value.length <= visible) return "*".repeat(value.length);
  return `${value.slice(0, visible)}…${value.slice(-2)}`;
}

function envStatus(key: string) {
  const value = process.env[key];
  return value ? `ok (${mask(value)})` : "missing";
}

async function tableExists(pool: Pool, table: string) {
  const result = await pool.query(
    `select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = $1
    ) as exists`,
    [table]
  );
  return Boolean(result.rows[0]?.exists);
}

async function countRows(pool: Pool, table: string) {
  try {
    const quoted = table === "user" ? `"user"` : table;
    const result = await pool.query(`select count(*)::int as count from ${quoted}`);
    return result.rows[0]?.count ?? 0;
  } catch (error) {
    return `error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function verifySmtp() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM;

  if (!host || !user || !pass || !from) {
    return { ok: false, message: "SMTP env incomplete" };
  }

  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_PORT === "465",
    auth: { user, pass }
  });

  try {
    await transporter.verify();
    return { ok: true, message: `SMTP verified for ${from} via ${host}` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

async function main() {
  console.log("RBA environment and database check\n");

  console.log("App");
  console.log(`  APP_BASE_URL: ${process.env.APP_BASE_URL ?? "missing"}`);
  console.log(`  BETTER_AUTH_URL: ${process.env.BETTER_AUTH_URL ?? "missing"}`);
  console.log(`  BETTER_AUTH_SECRET: ${envStatus("BETTER_AUTH_SECRET")}`);

  console.log("\nDatabase");
  console.log(`  DATABASE_URL: ${envStatus("DATABASE_URL")}`);
  console.log(`  SUPABASE_DB_URL: ${envStatus("SUPABASE_DB_URL")}`);
  console.log(`  SUPABASE_URL: ${envStatus("SUPABASE_URL")}`);

  console.log("\nPayments");
  console.log(`  RAZORPAY_KEY_ID: ${envStatus("RAZORPAY_KEY_ID")}`);
  console.log(`  RAZORPAY_KEY_SECRET: ${envStatus("RAZORPAY_KEY_SECRET")}`);
  console.log(`  RAZORPAY_WEBHOOK_SECRET: ${envStatus("RAZORPAY_WEBHOOK_SECRET")}`);
  console.log(`  NEXT_PUBLIC_RAZORPAY_KEY_ID: ${envStatus("NEXT_PUBLIC_RAZORPAY_KEY_ID")}`);

  console.log("\nEmail");
  console.log(`  SMTP_HOST: ${process.env.SMTP_HOST ?? "missing"}`);
  console.log(`  SMTP_PORT: ${process.env.SMTP_PORT ?? "587"}`);
  console.log(`  SMTP_USER: ${process.env.SMTP_USER ?? "missing"}`);
  console.log(`  EMAIL_FROM: ${process.env.EMAIL_FROM ?? "missing"}`);
  console.log(`  ADMIN_EMAIL: ${process.env.ADMIN_EMAIL ?? "missing"}`);

  const databaseUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("\nSUPABASE_DB_URL or DATABASE_URL is required to inspect tables.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("supabase") ? { rejectUnauthorized: false } : undefined
  });

  try {
    const version = await pool.query("select version()");
    console.log(`\nConnected: ${version.rows[0]?.version?.split(",")[0] ?? "postgres"}`);

    console.log("\nSchema");
    let missingTables = 0;
    for (const table of REQUIRED_TABLES) {
      const exists = await tableExists(pool, table);
      const count = exists ? await countRows(pool, table) : "-";
      if (!exists) missingTables += 1;
      console.log(`  ${exists ? "ok" : "MISSING"} ${table.padEnd(24)} ${exists ? `rows=${count}` : ""}`);
    }

    const fleet = await pool.query(
      `select id, brand, model, is_active from vehicles order by id`
    );
    console.log("\nFleet");
    if (!fleet.rows.length) {
      console.log("  No vehicles found. Run: npm run seed");
    } else {
      for (const row of fleet.rows) {
        console.log(
          `  ${row.id} | ${row.brand} ${row.model} | ${row.is_active ? "active" : "inactive"}`
        );
      }
    }

    const bookingStats = await pool.query(
      `select status, count(*)::int as count from bookings group by status order by status`
    );
    console.log("\nBookings by status");
    if (!bookingStats.rows.length) {
      console.log("  none");
    } else {
      for (const row of bookingStats.rows) {
        console.log(`  ${row.status}: ${row.count}`);
      }
    }

    const smtp = await verifySmtp();
    console.log(`\nSMTP verify: ${smtp.ok ? "ok" : "failed"} — ${smtp.message}`);

    if (missingTables > 0) {
      console.log(`\n${missingTables} required table(s) missing. Run: npm run migrate`);
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
