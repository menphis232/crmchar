import { query } from './src/db.js';

async function migrate() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS deal_documents (
        id VARCHAR(36) PRIMARY KEY,
        deal_id VARCHAR(36) NOT NULL,
        document_type VARCHAR(100) NOT NULL,
        file_url VARCHAR(1000) NOT NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        extracted_data JSON DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE CASCADE
      )
    `);
    console.log('Created deal_documents table');
  } catch(e) { console.error(e); }
  
  process.exit();
}
migrate();
