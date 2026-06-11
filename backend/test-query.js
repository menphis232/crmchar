import { query } from './src/db.js';

async function main() {
  try {
    const parentId = 'some-uuid-here'; // We can just test the query syntax
    const team = await query(
      'SELECT id, email, name, permissions, created_at FROM users WHERE parent_id = ? ORDER BY created_at DESC',
      [parentId]
    );
    console.log("Query success");
  } catch(e) { console.log(e); }
  process.exit(0);
}
main();
