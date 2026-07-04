import { Pool } from "pg";

async function main() {
  const email = process.argv[2] ?? "jagadeep.mamidi@gmail.com";
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const users = await pool.query(
    `select id, name, email, kyc_status, created_at from app_users
     where lower(email) = lower($1) order by created_at`,
    [email]
  );
  const ids = users.rows.map((row) => row.id);
  const kyc = ids.length
    ? await pool.query(
        `select user_id, status, aadhaar_verified, dl_verified from kyc_records
         where user_id = any($1::text[])`,
        [ids]
      )
    : { rows: [] };
  const auth = await pool.query(
    `select id, email, name from "user" where lower(email) = lower($1)`,
    [email]
  );

  console.log("app_users:", JSON.stringify(users.rows, null, 2));
  console.log("kyc_records:", JSON.stringify(kyc.rows, null, 2));
  console.log("auth users:", JSON.stringify(auth.rows, null, 2));

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
