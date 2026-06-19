import dotenv from 'dotenv';
import { get } from '../src/db.js';

dotenv.config();

const admin = await get(
  "SELECT role, LEFT(stripe_secret_key, 12) AS sk, stripe_price_id FROM users WHERE stripe_secret_key IS NOT NULL AND stripe_secret_key != '' LIMIT 1",
);
console.log('admin stripe:', admin);

const cols = await get("SHOW COLUMNS FROM users LIKE 'status'");
console.log('status column:', cols);
