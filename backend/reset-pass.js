import { get, run } from './src/db.js';
import { sendEmail } from './src/utils/mailer.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

async function main() {
  const email = 'menphisj@gmail.com';
  const user = await get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    console.log('Usuario no encontrado');
    process.exit(1);
  }
  const tempPass = crypto.randomBytes(4).toString('hex');
  const hash = bcrypt.hashSync(tempPass, 10);
  await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
  await sendEmail(email, 'Tu nueva contraseña provisional', 'Tu contraseña provisional para el panel es: ' + tempPass, '<h1>Bienvenido</h1><p>Tu contraseña provisional es: <b>' + tempPass + '</b></p>');
  console.log('OK. Pass: ' + tempPass);
  process.exit(0);
}

main().catch(console.error);
