import { query } from '../src/db.js';
query("SELECT role, email, ai_provider, ai_api_key FROM users WHERE role = 'admin'").then(console.log).then(() => process.exit(0));
