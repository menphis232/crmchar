import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: 'tramites_vehiculares',
  multipleStatements: true,
});

try {
  await c.query(`
    CREATE TABLE IF NOT EXISTS auto_private_documents (
      id VARCHAR(36) PRIMARY KEY,
      auto_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      label VARCHAR(120) NOT NULL,
      file_url VARCHAR(1000) NOT NULL,
      file_name VARCHAR(255) DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (auto_id) REFERENCES autos(id) ON DELETE CASCADE,
      INDEX idx_auto_private_docs_auto (auto_id),
      INDEX idx_auto_private_docs_user (user_id)
    )
  `);
  console.log('✅ auto_private_documents creada');
} catch (e) {
  console.log('auto_private_documents:', e.message);
}

await c.end();
console.log('✅ Migración v30 (documentos privados de autos) completada');
