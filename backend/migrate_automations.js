import { query } from './src/db.js';

async function migrate() {
  try {
    await query(`CREATE TABLE IF NOT EXISTS crm_automations (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      trigger_event VARCHAR(50) NOT NULL,
      trigger_stage VARCHAR(100) NOT NULL,
      trigger_delay_days INT DEFAULT 0,
      action_type VARCHAR(50) NOT NULL,
      action_content TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    console.log('crm_automations created');
    
    await query(`CREATE TABLE IF NOT EXISTS automation_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      automation_id VARCHAR(36) NOT NULL,
      deal_id VARCHAR(36) NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (automation_id) REFERENCES crm_automations(id) ON DELETE CASCADE,
      FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE CASCADE,
      UNIQUE KEY unique_exec (automation_id, deal_id)
    )`);
    console.log('automation_logs created');
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

migrate();
