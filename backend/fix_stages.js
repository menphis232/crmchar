import { run } from './src/db.js';

async function fix() {
  const json = '[{"id":"nuevo","label":"Nuevo"},{"id":"contactado","label":"Contactado"},{"id":"en_tramite","label":"En trámite"},{"id":"documentacion","label":"Documentación"},{"id":"completado","label":"Completado"},{"id":"perdido","label":"Perdido"}]';
  const result = await run(`
    UPDATE users 
    SET crm_stages = ? 
    WHERE name LIKE '%López%' OR name LIKE '%Lopez%'
  `, [json]);
  console.log('Fixed', result);
  process.exit(0);
}

fix();
