import cron from 'node-cron';
import { query, get, run } from '../db.js';
import { sendEmail } from '../utils/mailer.js';

export function startAutomationsCron() {
  // Run every hour to check for time_in_stage automations
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('[Cron] Checking time_in_stage automations...');
      const automations = await query("SELECT * FROM crm_automations WHERE is_active = 1 AND trigger_event = 'time_in_stage'");
      
      for (const rule of automations) {
        if (!rule.trigger_delay_days || rule.trigger_delay_days <= 0) continue;
        
        // Find deals in the trigger_stage that haven't been updated in trigger_delay_days
        // and haven't triggered this automation yet.
        const deals = await query(`
          SELECT d.*, c.name as contact_name, c.email as contact_email, u.name as gestor_name 
          FROM crm_deals d 
          JOIN contacts c ON d.contact_id = c.id 
          JOIN users u ON d.user_id = u.id 
          WHERE d.user_id = ? AND d.stage = ? 
            AND d.updated_at <= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND NOT EXISTS (SELECT 1 FROM automation_logs al WHERE al.automation_id = ? AND al.deal_id = d.id)
        `, [rule.user_id, rule.trigger_stage, rule.trigger_delay_days, rule.id]);

        for (const deal of deals) {
          if (!deal.contact_email) continue;

          if (rule.action_type === 'send_email' && rule.action_content) {
            let content = rule.action_content
              .replace(/\{\{nombre\}\}/g, deal.contact_name)
              .replace(/\{\{gestor\}\}/g, deal.gestor_name)
              .replace(/\{\{tramite\}\}/g, deal.title);
            
            await sendEmail(deal.contact_email, rule.name, content, null, deal.user_id);
            
            // Log execution to avoid spamming
            await run('INSERT INTO automation_logs (automation_id, deal_id) VALUES (?, ?)', [rule.id, deal.id]);
            console.log(`[Automation Time] Triggered ${rule.name} for deal ${deal.id}`);
          }
        }
      }
    } catch(e) {
      console.error('[Cron Error] automations', e);
    }
  });
}
