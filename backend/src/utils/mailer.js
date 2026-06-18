import nodemailer from 'nodemailer';
import { get } from '../db.js';

/** Logo oficial de Trámites Vehiculares de México (correos globales y fallback) */
export const GLOBAL_EMAIL_LOGO_URL =
  process.env.GLOBAL_EMAIL_LOGO_URL
  || 'https://lirp.cdn-website.com/33edf426/dms3rep/multi/opt/LOGO+SITIO+WEB-1920w.png';

const API_PUBLIC_BASE = (process.env.API_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

function toAbsoluteUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${API_PUBLIC_BASE}${path}`;
}

function buildLogoHtml(logoUrl) {
  const src = toAbsoluteUrl(logoUrl) || GLOBAL_EMAIL_LOGO_URL;
  return `
    <div style="display:inline-block; background:#ffffff; padding:14px 24px; border-radius:10px;">
      <img src="${src}" alt="Trámites Vehiculares de México" style="max-height:52px; max-width:220px; display:block; margin:0 auto;">
    </div>`;
}

/** userId = gestor/concesionaria que envía al cliente; sin userId = correo global de la plataforma */
export async function resolveEmailLogo(userId = null) {
  if (userId) {
    const user = await get('SELECT logo_url FROM users WHERE id = ?', [userId]);
    if (user?.logo_url) return user.logo_url;
  }
  return GLOBAL_EMAIL_LOGO_URL;
}

export async function createTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    const port = Number(process.env.SMTP_PORT || 587);
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return nodemailer.createTransport({
    host: 'sandbox.smtp.mailtrap.io',
    port: 2525,
    auth: {
      user: '0e03374eb334f8',
      pass: '9edf41cb2254e7',
    },
  });
}

export async function sendEmail(to, subject, text, html, userId = null) {
  try {
    const logoUrl = await resolveEmailLogo(userId);
    const headerLogo = buildLogoHtml(logoUrl);

    const bodyHtml = html || `<p style="color: #a0aec0; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${text}</p>`;

    const finalHtml = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #1e2638; padding: 40px; border-radius: 12px; border: 1px solid #333;">
      <div style="text-align: center; margin-bottom: 30px;">
        ${headerLogo}
      </div>
      
      ${bodyHtml}

      <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 30px 0;">
      <p style="color: #718096; font-size: 12px; text-align: center; margin: 10px 0 0 0;">&copy; ${new Date().getFullYear()} Trámites Vehiculares de México. Todos los derechos reservados.</p>
    </div>
    `;

    const transporter = await createTransporter();
    const from = process.env.SMTP_FROM
      || `"Trámites Vehiculares de México" <${process.env.SMTP_USER || 'noreply@tramitesvehicularesdemexico.com'}>`;
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html: finalHtml,
    });

    console.log('Message sent: %s', info.messageId);
    if (!process.env.SMTP_HOST) {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}
