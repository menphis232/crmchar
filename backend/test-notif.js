import { run, get } from './src/db.js';
import { v4 as uuid } from 'uuid';

async function main() {
  const user = await get("SELECT id FROM users WHERE email = 'gestor@demo.com'");
  if (user) {
    await run(
      "INSERT INTO notifications (id, user_id, type, title, body) VALUES (?, ?, ?, ?, ?)",
      [uuid(), user.id, 'nuevo_lead', 'Nueva Solicitud Recibida', 'Tienes un nuevo trámite de Alta de Placas esperando revisión.']
    );
    console.log("Notificación insertada para gestor@demo.com");
  }
  process.exit(0);
}
main();
