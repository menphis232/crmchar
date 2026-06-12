import { get, query, run } from '../db.js';
import { sendEmail } from '../utils/mailer.js';

export async function processStageChangeAutomations(dealId, newStage) {
  try {
    const deal = await get('SELECT d.*, c.name as contact_name, c.email as contact_email, u.name as gestor_name FROM crm_deals d JOIN contacts c ON d.contact_id = c.id JOIN users u ON d.user_id = u.id WHERE d.id = ?', [dealId]);
    if (!deal) return;
    if (!deal.contact_email) {
      console.log(`[Automation] Skipped deal ${dealId} because it has no contact email.`);
      return;
    }

    // Find active automations for this user, event, and stage
    const automations = await query(
      'SELECT * FROM crm_automations WHERE user_id = ? AND is_active = 1 AND trigger_event = ? AND trigger_stage = ?',
      [deal.user_id, 'stage_change', newStage]
    );

    for (const rule of automations) {
      // Check if already executed
      const log = await get('SELECT id FROM automation_logs WHERE automation_id = ? AND deal_id = ?', [rule.id, dealId]);
      if (log) continue;

      if (rule.action_type === 'send_email' && rule.action_content) {
        let content = rule.action_content
          .replace(/\{\{nombre\}\}/g, deal.contact_name)
          .replace(/\{\{gestor\}\}/g, deal.gestor_name)
          .replace(/\{\{tramite\}\}/g, deal.title);
        
        await sendEmail(deal.contact_email, rule.name, content, null, deal.user_id);
        
        // Log execution
        await run('INSERT INTO automation_logs (automation_id, deal_id) VALUES (?, ?)', [rule.id, dealId]);
        console.log(`[Automation] Triggered ${rule.name} for deal ${dealId}`);
      }
    }
  } catch(e) {
    console.error('[Automation Error]', e);
  }
}
