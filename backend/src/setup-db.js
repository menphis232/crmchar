import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');

async function setup() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  const sql = fs.readFileSync(schemaPath, 'utf8');
  await conn.query(sql);
  await conn.end();
  console.log('Base de datos tramites_vehiculares creada/actualizada.');
}

setup().catch(err => {
  console.error('Error al crear la BD:', err.message);
  process.exit(1);
});
