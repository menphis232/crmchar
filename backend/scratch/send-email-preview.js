import dotenv from 'dotenv';
import { get } from '../src/db.js';
import { sendEmail, resolveEmailBranding } from '../src/utils/mailer.js';

dotenv.config();

const recipients = process.argv.slice(2);
const targets = recipients.length
  ? recipients
  : ['menphisj@gmail.com', 'charveelraffit@gmail.com'];

const SPARTAN = "'Spartan', 'League Spartan', Helvetica, Arial, sans-serif";

const sampleBody = `
  <h2 style="color:#ffffff;font-size:20px;font-weight:600;margin:0 0 16px;font-family:${SPARTAN};letter-spacing:0.04em;text-transform:uppercase;">Plantilla de correo</h2>
  <p style="color:rgba(255,255,255,0.78);font-size:15px;line-height:1.65;margin:0 0 16px;font-family:${SPARTAN};">
    Correo de prueba con fondo negro, tipografía Spartan y logo embebido correctamente.
  </p>
  <div style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:20px;margin:24px 0;">
    <p style="color:rgba(255,255,255,0.55);font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.1em;font-family:${SPARTAN};">Detalle</p>
    <p style="color:#ffffff;font-size:16px;margin:0;font-family:${SPARTAN};">Mensaje de ejemplo del sistema.</p>
  </div>
`;

const dealer = await get(
  "SELECT id, name, logo_url FROM users WHERE role = 'concesionaria' AND logo_url IS NOT NULL AND logo_url != '' LIMIT 1",
);

for (const to of targets) {
  await sendEmail(
    to,
    'Prueba — correo global Trámites Vehiculares',
    'Correo global de prueba',
    sampleBody,
    null,
  );
  console.log('✅ Global →', to);

  if (dealer) {
    const branding = await resolveEmailBranding(dealer.id);
    console.log('   Branded logo:', branding.logoHtmlSrc, dealer.logo_url);
    await sendEmail(
      to,
      `Prueba — correo de ${dealer.name}`,
      `Correo de ${dealer.name}`,
      sampleBody,
      dealer.id,
    );
    console.log('✅ Branded →', to, `(${dealer.name})`);
  }
}
