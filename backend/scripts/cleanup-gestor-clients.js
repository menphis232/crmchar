/**
 * Borra solicitudes, trámites (deals), contactos y usuarios cliente de un gestor.
 * Uso: node scripts/cleanup-gestor-clients.js [slug]
 */
import { query, get, run } from '../src/db.js';

const slug = process.argv[2] || 'tramites-vehiculares-de-mexico';

async function main() {
  const gestor = await get(
    'SELECT id, user_id, slug, name FROM gestores WHERE slug = ? OR id = ?',
    [slug, slug],
  );
  if (!gestor) {
    console.error('Gestor no encontrado:', slug);
    process.exit(1);
  }
  console.log('Gestor:', gestor.name, `(${gestor.slug})`, 'user_id:', gestor.user_id);

  const contacts = await query(
    'SELECT id, email, name FROM contacts WHERE user_id = ?',
    [gestor.user_id],
  );
  const emails = contacts.map(c => c.email).filter(Boolean);
  console.log('Contactos:', contacts.length);

  const deals = await query(
    `SELECT id, title, tracking_code FROM crm_deals WHERE user_id = ? AND deal_type = 'tramite'`,
    [gestor.user_id],
  );
  console.log('Trámites (deals):', deals.length);

  const solicitudes = await query(
    'SELECT id, client_name, service_name FROM solicitudes WHERE gestor_id = ?',
    [gestor.id],
  );
  console.log('Solicitudes:', solicitudes.length);

  const dealIds = deals.map(d => d.id);

  if (dealIds.length) {
    const placeholders = dealIds.map(() => '?').join(',');
    await run(`DELETE FROM chat_messages WHERE deal_id IN (${placeholders})`, dealIds);
    await run(`DELETE FROM deal_documents WHERE deal_id IN (${placeholders})`, dealIds);
    await run(`DELETE FROM deal_invoices WHERE deal_id IN (${placeholders})`, dealIds);
    await run(`DELETE FROM crm_activities WHERE deal_id IN (${placeholders})`, dealIds);
    await run(`DELETE FROM crm_tasks WHERE deal_id IN (${placeholders})`, dealIds);
    await run(`DELETE FROM crm_documents WHERE deal_id IN (${placeholders})`, dealIds);
    await run(`DELETE FROM notifications WHERE ref_id IN (${placeholders})`, dealIds);
    await run(`DELETE FROM crm_deals WHERE id IN (${placeholders})`, dealIds);
    console.log('Deals y datos relacionados eliminados:', dealIds.length);
  }

  const solResult = await run('DELETE FROM solicitudes WHERE gestor_id = ?', [gestor.id]);
  console.log('Solicitudes eliminadas:', solResult.affectedRows ?? solicitudes.length);

  if (contacts.length) {
    const contactIds = contacts.map(c => c.id);
    const ph = contactIds.map(() => '?').join(',');
    await run(`DELETE FROM contact_vehicles WHERE contact_id IN (${ph})`, contactIds);
    await run('DELETE FROM contacts WHERE user_id = ?', [gestor.user_id]);
    console.log('Contactos eliminados:', contacts.length);
  }

  if (emails.length) {
    const clientUsers = await query(
      `SELECT id, email FROM users WHERE role = 'cliente' AND email IN (${emails.map(() => '?').join(',')})`,
      emails,
    );
    for (const u of clientUsers) {
      await run('DELETE FROM client_wallet_documents WHERE user_id = ?', [u.id]);
      await run('DELETE FROM users WHERE id = ? AND role = ?', [u.id, 'cliente']);
    }
    console.log('Usuarios cliente eliminados:', clientUsers.length);
  }

  await run(
    `DELETE FROM notifications WHERE user_id = ? AND type IN ('nuevo_lead', 'new_message')`,
    [gestor.user_id],
  );

  console.log('Limpieza completada.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
