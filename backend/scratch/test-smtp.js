import dotenv from 'dotenv';
import { createTransporter } from '../src/utils/mailer.js';

dotenv.config();

const to = process.argv[2] || process.env.SMTP_USER;

try {
  const transporter = await createTransporter();
  await transporter.verify();
  console.log('✅ SMTP conectado:', process.env.SMTP_HOST, process.env.SMTP_USER);

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Prueba SMTP — Trámites Vehiculares',
    text: 'Correo de prueba. Si lo recibes, SMTP está configurado correctamente.',
    html: '<p>Correo de prueba. Si lo recibes, <strong>SMTP está configurado correctamente</strong>.</p>',
  });

  console.log('✅ Enviado:', info.messageId);
  console.log('   Para:', to);
} catch (err) {
  console.error('❌ Error SMTP:', err.message);
  process.exit(1);
}
