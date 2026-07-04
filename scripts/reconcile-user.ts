import { Pool } from "pg";
import { reconcileAppUsersForCanonicalId } from "../src/lib/data/repository";

async function main() {
  const email = process.argv[2] ?? "jagadeep.mamidi@gmail.com";
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const auth = await pool.query(
    `select id from "user" where lower(email) = lower($1) order by "createdAt" desc limit 1`,
    [email]
  );
  const canonicalUserId = auth.rows[0]?.id as string | undefined;
  await pool.end();

  if (!canonicalUserId) {
    throw new Error(`No auth user found for ${email}`);
  }

  const result = await reconcileAppUsersForCanonicalId(canonicalUserId, email);
  console.log(`Reconciled ${email} under ${canonicalUserId}`);
  console.log("Merged duplicate user ids:", result.mergedUserIds);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
