import { signToken } from './src/middleware/auth.js';
import { get } from './src/db.js';

async function main() {
  const user = await get("SELECT * FROM users WHERE email = 'gestor@demo.com'");
  if(!user) { console.log("User not found"); process.exit(1); }
  
  const token = signToken(user);
  
  const res = await fetch('http://localhost:3000/api/crm/team', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", text);
  process.exit(0);
}
main();
