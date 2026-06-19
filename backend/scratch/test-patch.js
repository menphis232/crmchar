import { query, run, get } from '../src/db.js';

async function test() {
  try {
    const deals = await query('SELECT * FROM crm_deals LIMIT 1');
    if (deals.length === 0) {
      console.log('No deals');
      return;
    }
    const deal = deals[0];
    console.log('Deal:', deal.id, deal.stage);
    
    const uid = deal.user_id;
    const user = await get('SELECT crm_stages FROM users WHERE id = ?', [uid]);
    console.log('User stages:', user?.crm_stages);
    
    // Simulate updating stage to a custom stage
    const customStage = 'etapa_12345';
    
    const isCustom = customStage && customStage.startsWith('etapa_');
    console.log('isCustom?', isCustom);
    
    // Attempt the actual backend logic
    let allowedStages = ['lead_nuevo', 'contactado', 'vendido', 'perdido'];
    if (user && user.crm_stages) {
      const parsed = JSON.parse(user.crm_stages);
      allowedStages = parsed.map(s => s.id);
    }
    
    if (customStage && !allowedStages.includes(customStage) && !isCustom && !['completado', 'perdido'].includes(customStage)) {
       console.log('ERROR: Etapa invalida');
    } else {
       console.log('SUCCESS: Etapa valida');
       await run('UPDATE crm_deals SET stage = ? WHERE id = ?', [customStage, deal.id]);
       console.log('Updated deal in DB');
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
test();
