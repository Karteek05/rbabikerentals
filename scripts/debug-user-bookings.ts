import { Pool } from "pg";

const email = (process.argv[2] ?? "jagadeep.mamidi@gmail.com").toLowerCase();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const authUsers = await pool.query(
      `select id, name, email from "user" where lower(email) = $1`,
      [email]
    );
    const appUsers = await pool.query(
      `select id, name, email, role from app_users where lower(email) = $1`,
      [email]
    );

    console.log(`\nLookup for: ${email}\n`);

    console.log("Better Auth users:");
    if (!authUsers.rows.length) {
      console.log("  none");
    } else {
      for (const row of authUsers.rows) {
        console.log(`  id=${row.id} | name=${row.name}`);
      }
    }

    console.log("\nApp users:");
    if (!appUsers.rows.length) {
      console.log("  none");
    } else {
      for (const row of appUsers.rows) {
        console.log(`  id=${row.id} | role=${row.role} | name=${row.name}`);
      }
    }

    const ids = new Set<string>([
      ...authUsers.rows.map((row) => row.id as string),
      ...appUsers.rows.map((row) => row.id as string)
    ]);

    console.log("\nBookings for matching user ids:");
    if (!ids.size) {
      console.log("  no user ids to match");
    } else {
      const bookings = await pool.query(
        `select id, user_id, vehicle_id, status, created_at
         from bookings
         where user_id = any($1::text[])
         order by created_at desc`,
        [[...ids]]
      );
      if (!bookings.rows.length) {
        console.log("  none for this email's user ids");
      } else {
        for (const row of bookings.rows) {
          console.log(
            `  ${row.id} | user=${row.user_id} | ${row.vehicle_id} | ${row.status} | ${row.created_at}`
          );
        }
      }
    }

    const orphanCheck = await pool.query(
      `select b.id, b.user_id, b.vehicle_id, b.status, u.email as app_email, au.email as auth_email
       from bookings b
       left join app_users u on u.id = b.user_id
       left join "user" au on au.id = b.user_id
       order by b.created_at desc
       limit 10`
    );
    console.log("\nAll recent bookings (last 10):");
    for (const row of orphanCheck.rows) {
      console.log(
        `  ${row.id} | user=${row.user_id} | ${row.status} | app_email=${row.app_email ?? "-"} | auth_email=${row.auth_email ?? "-"}`
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
