import { query, run } from '../db.js';
import { v4 as uuid } from 'uuid';

/**
 * Función que busca tratos que llevan más de 48 horas sin cambiar de etapa
 * y que no estén en estado completado o perdido.
 */
export async function checkStalledDeals() {
  try {
    // 1. Buscamos trámites atascados (más de 48h desde su último cambio de etapa)
    const stalledDeals = await query(`
      SELECT d.id, d.title, d.user_id, d.stage, d.stage_changed_at 
      FROM crm_deals d
      WHERE d.stage NOT IN ('completado', 'perdido', 'vendido')
        AND d.stage_changed_at < DATE_SUB(NOW(), INTERVAL 48 HOUR)
    `);

    if (stalledDeals.length === 0) return;

    for (const deal of stalledDeals) {
      // 2. Verificamos si ya notificamos sobre este estancamiento
      // Usamos el ref_id y el tipo para evitar spam
      const existingNotif = await query(`
        SELECT id FROM notifications 
        WHERE ref_id = ? AND type = 'alerta_estancado' AND created_at > ?
      `, [deal.id, deal.stage_changed_at]);

      if (existingNotif.length === 0) {
        // 3. Si no hemos notificado desde que se atascó, insertamos notificación
        const notifId = uuid();
        const title = 'Trámite Estancado';
        const body = `El trámite "${deal.title}" lleva más de 48h en la etapa "${deal.stage}".`;
        
        await run(
          'INSERT INTO notifications (id, user_id, type, title, body, ref_id) VALUES (?, ?, ?, ?, ?, ?)',
          [notifId, deal.user_id, 'alerta_estancado', title, body, deal.id]
        );
        console.log(`[Automatización] Alerta de estancamiento generada para trámite: ${deal.title}`);
      }
    }
  } catch (err) {
    console.error('[Automatización] Error al revisar trámites estancados:', err);
  }
}
