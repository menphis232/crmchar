import { query } from '../db.js';
import { createDealFromInquiry, createDealFromSolicitud } from './helpers.js';

export async function backfillCrmDeals() {
  const solicitudes = await query(`
    SELECT s.*, g.user_id as gestor_user_id
    FROM solicitudes s
    JOIN gestores g ON g.id = s.gestor_id
    LEFT JOIN crm_deals d ON d.ref_type = 'solicitud' AND d.ref_id = s.id
    WHERE d.id IS NULL
  `);

  for (const s of solicitudes) {
    await createDealFromSolicitud(s, s.gestor_user_id);
  }

  const inquiries = await query(`
    SELECT i.*, a.make, a.model
    FROM auto_inquiries i
    JOIN autos a ON a.id = i.auto_id
    LEFT JOIN crm_deals d ON d.ref_type = 'auto_inquiry' AND d.ref_id = i.id
    WHERE d.id IS NULL
  `);

  for (const i of inquiries) {
    await createDealFromInquiry(i, i.user_id);
  }

  console.log(`CRM backfill: ${solicitudes.length} solicitudes, ${inquiries.length} inquiries`);
}
