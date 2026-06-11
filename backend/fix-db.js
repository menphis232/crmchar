import { run } from './src/db.js';

async function main() {
  try {
    await run("ALTER TABLE users ADD COLUMN parent_id VARCHAR(36) NULL DEFAULT NULL AFTER id");
    console.log("Added parent_id");
  } catch(e) { console.log(e.message); }

  try {
    await run("ALTER TABLE users ADD COLUMN permissions JSON NULL DEFAULT NULL AFTER role");
    console.log("Added permissions");
  } catch(e) { console.log(e.message); }
  
  try {
    await run("CREATE INDEX idx_users_parent_id ON users(parent_id)");
    console.log("Added index");
  } catch(e) { console.log(e.message); }

  console.log("Done");
  process.exit(0);
}
main();
