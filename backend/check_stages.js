import { query } from './src/db.js';

async function check() {
  const users = await query(`
    SELECT id, name, crm_stages 
    FROM users 
    WHERE name LIKE '%López%' OR name LIKE '%Lopez%'
  `);
  console.log(users);
  process.exit(0);
}

check();
