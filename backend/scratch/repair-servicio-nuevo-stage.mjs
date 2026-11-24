/**
 * Corrige SERVICIO NUEVO que quedó en "completado" solo por el cobro MP.
 * Debe seguir en embudo activo con payment_status=paid.
 */
import { get, run } from '../src/db.js';
import { firstStageForGestor } from '../src/crm/stages.js';

const dealId = '95ca31f9-1190-47ac-9fd4-e4730f29a359';
const deal = await get('SELECT id, user_id, title, stage, payment_status FROM crm_deals WHERE id = ?', [dealId]);
if (!deal) {
  console.log('Deal no encontrado');
  process.exit(0);
}

const user = await get('SELECT crm_stages FROM users WHERE id = ?', [deal.user_id]);
const first = firstStageForGestor(user?.crm_stages);
console.log('Antes:', deal);
if (deal.payment_status === 'paid' && deal.stage === 'completado' && first) {
  await run('UPDATE crm_deals SET stage = ?, stage_changed_at = NOW() WHERE id = ?', [first, dealId]);
  const after = await get('SELECT id, title, stage, payment_status FROM crm_deals WHERE id = ?', [dealId]);
  console.log('Después:', after);
} else {
  console.log('No requiere reparación');
}
process.exit(0);
