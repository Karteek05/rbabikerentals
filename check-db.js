const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const email = 'chkarteek05@gmail.com';
  console.log('Checking for email:', email);
  
  const userRes = await pool.query('SELECT * FROM "user" WHERE email = $1', [email]);
  console.log('Users:', userRes.rows);
  
  if (userRes.rows.length > 0) {
    const accRes = await pool.query('SELECT * FROM account WHERE "userId" = $1', [userRes.rows[0].id]);
    console.log('Accounts:', accRes.rows);
  } else {
    console.log('No user found');
  }
  pool.end();
}
check();
