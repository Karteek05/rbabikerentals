import { loadEnvConfig } from "@next/env";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { auth } from "@/lib/auth/better-auth";
import { getUserOrThrow, upsertUser } from "@/lib/data/repository";

loadEnvConfig(process.cwd());

async function markEmailVerified(pool: Pool, email: string) {
  await pool.query(
    `update "user" set "emailVerified" = true, "updatedAt" = now() where lower(email) = lower($1)`,
    [email]
  );
}

async function updateCredentialPassword(pool: Pool, userId: string, password: string) {
  const hashed = await hashPassword(password);
  const result = await pool.query(
    `update account
     set password = $1, "updatedAt" = now()
     where "userId" = $2 and "providerId" = 'credential'
     returning id`,
    [hashed, userId]
  );
  return result.rowCount ?? 0;
}

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  const password = process.argv[3] ?? "";
  const name = process.argv[4]?.trim() || "RBA Admin";

  if (!email || !password) {
    console.error("Usage: npm run bootstrap:admin -- <email> <password> [name]");
    console.error("Example: npm run bootstrap:admin -- adminuser@rbabikerentals.com 'YourSecurePass123!'");
    process.exit(1);
  }

  if (!email.endsWith("@rbabikerentals.com")) {
    console.error("Admin bootstrap requires an @rbabikerentals.com email.");
    process.exit(1);
  }

  const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is required to bootstrap admin accounts.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes("supabase") ? { rejectUnauthorized: false } : undefined
  });

  try {
    const existing = await pool.query(`select id from "user" where lower(email) = lower($1) limit 1`, [
      email
    ]);

    let userId = existing.rows[0]?.id as string | undefined;

    if (!userId) {
      const result = await auth.api.signUpEmail({
        body: {
          email,
          password,
          name
        }
      });

      userId = result.user?.id;
      if (!userId) {
        throw new Error("Sign-up did not return a user id.");
      }
      console.log(`Created auth account for ${email}`);
    } else {
      console.log(`Auth account already exists for ${email}; promoting to admin.`);
      const updated = await updateCredentialPassword(pool, userId, password);
      if (updated > 0) {
        console.log("Updated credential password for existing admin account.");
      } else {
        console.warn(
          "No credential account found to update password. If login fails, reset via forgot-password or create a new account."
        );
      }
    }

    await markEmailVerified(pool, email);

    const appUser = await upsertUser({
      id: userId,
      role: "admin",
      name,
      city: "bengaluru",
      kyc_status: "verified",
      email
    });

    await getUserOrThrow(appUser.id);
    console.log(`Admin ready: ${email} (user id: ${appUser.id})`);
    console.log("Sign in at /admin-login or /staff-login");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
