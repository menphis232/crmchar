import { query } from './src/db.js';

async function check() {
  const deals = await query(`
    SELECT d.id, d.title, d.stage, d.deal_type, c.name 
    FROM crm_deals d 
    JOIN users u ON u.id = d.user_id 
    JOIN contacts c ON c.id = d.contact_id 
    WHERE u.name LIKE '%López%' OR u.name LIKE '%Lopez%'
  `);
  console.log(deals);
  process.exit(0);
}

check();
