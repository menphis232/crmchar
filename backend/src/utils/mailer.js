import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { get } from '../db.js';

/** Logo oficial de Trámites Vehiculares de México (correos globales y fallback) */
export const GLOBAL_EMAIL_LOGO_URL =
  process.env.GLOBAL_EMAIL_LOGO_URL
  || 'https://lirp.cdn-website.com/33edf426/dms3rep/multi/opt/LOGO+SITIO+WEB-1920w.png';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'uploads');

const SPARTAN = "'Spartan', 'League Spartan', Helvetica, Arial, sans-serif";
const EMAIL_LOGO_CID = 'email-logo@tramites';

function getEmailPublicBase() {
  const raw =
    process.env.API_PUBLIC_URL
    || process.env.PUBLIC_SITE_URL
    || process.env.FRONTEND_URL
    || 'https://central.tramitesvehicularesdemexico.com';
  const base = raw.replace(/\/$/, '');
  if (/localhost|127\.0\.0\.1/i.test(base)) {
    return 'https://central.tramitesvehicularesdemexico.com';
  }
  return base;
}

function resolveUploadPath(logoUrl) {
  if (!logoUrl) return null;

  if (logoUrl.startsWith('/uploads/')) {
    return path.join(uploadDir, path.basename(logoUrl));
  }

  if (/^https?:\/\//i.test(logoUrl)) {
    try {
      const { pathname } = new URL(logoUrl);
      if (pathname.startsWith('/uploads/')) {
        return path.join(uploadDir, path.basename(pathname));
      }
    } catch {
      return null;
    }
  }

  return null;
}

function mimeForPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

function toPublicAssetUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      if (/localhost|127\.0\.0\.1/i.test(parsed.origin)) {
        return `${getEmailPublicBase()}${parsed.pathname}`;
      }
    } catch {
      return url;
    }
    return url;
  }
  const assetPath = url.startsWith('/') ? url : `/${url}`;
  return `${getEmailPublicBase()}${assetPath}`;
}

/** Incrusta logos locales como CID; URLs externas se dejan absolutas. */
export async function resolveLogoForEmail(logoUrl, isBranded) {
  if (!isBranded) {
    return {
      htmlSrc: GLOBAL_EMAIL_LOGO_URL,
      attachments: [],
    };
  }

  const localPath = resolveUploadPath(logoUrl);
  if (localPath && fs.existsSync(localPath)) {
    return {
      htmlSrc: `cid:${EMAIL_LOGO_CID}`,
      attachments: [{
        filename: path.basename(localPath),
        path: localPath,
        cid: EMAIL_LOGO_CID,
        contentType: mimeForPath(localPath),
      }],
    };
  }

  if (logoUrl && /^https?:\/\//i.test(logoUrl)) {
    return { htmlSrc: logoUrl, attachments: [] };
  }

  return {
    htmlSrc: toPublicAssetUrl(logoUrl) || GLOBAL_EMAIL_LOGO_URL,
    attachments: [],
  };
}

function buildLogoHtml(htmlSrc, isBranded = false) {
  const alt = isBranded ? 'Logo' : 'Trámites Vehiculares de México';

  if (isBranded) {
    return `
      <div style="display:inline-block; padding:8px 0;">
        <img src="${htmlSrc}" alt="${alt}" style="max-height:72px; max-width:240px; display:block; margin:0 auto; object-fit:contain;">
      </div>`;
  }

  return `
    <div style="display:inline-block; padding:4px 0;">
      <img src="${htmlSrc}" alt="${alt}" style="max-height:64px; max-width:280px; display:block; margin:0 auto; object-fit:contain;">
    </div>`;
}

/** userId = gestor/concesionaria que envía al cliente; sin userId = correo global de la plataforma */
export async function resolveEmailLogo(userId = null) {
  const branding = await resolveEmailBranding(userId);
  return branding.logoUrl;
}

export async function resolveEmailBranding(userId = null) {
  if (userId) {
    const user = await get('SELECT logo_url, name, role FROM users WHERE id = ?', [userId]);
    if (user?.logo_url) {
      const logo = await resolveLogoForEmail(user.logo_url, true);
      return {
        logoUrl: user.logo_url,
        logoHtmlSrc: logo.htmlSrc,
        logoAttachments: logo.attachments,
        isBranded: true,
        companyName: user.name || 'Tu empresa',
        role: user.role,
      };
    }
  }

  const logo = await resolveLogoForEmail(GLOBAL_EMAIL_LOGO_URL, false);
  return {
    logoUrl: GLOBAL_EMAIL_LOGO_URL,
    logoHtmlSrc: logo.htmlSrc,
    logoAttachments: logo.attachments,
    isBranded: false,
    companyName: 'Trámites Vehiculares de México',
    role: null,
  };
}

export function wrapEmailHtml(bodyHtml, branding) {
  const footerName = branding.isBranded
    ? branding.companyName
    : 'Trámites Vehiculares de México';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background-color:#000000;">
  <div style="font-family:${SPARTAN};max-width:600px;margin:0 auto;background-color:#000000;padding:36px 28px 32px;">
    <div style="text-align:center;margin-bottom:28px;">
      ${buildLogoHtml(branding.logoHtmlSrc, branding.isBranded)}
    </div>

    <div style="font-family:${SPARTAN};color:#ffffff;">
      ${bodyHtml}
    </div>

    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.12);margin:32px 0 20px;">
    <p style="color:rgba(255,255,255,0.42);font-size:11px;text-align:center;margin:0;letter-spacing:0.06em;text-transform:uppercase;font-family:${SPARTAN};">
      &copy; ${new Date().getFullYear()} ${footerName}. Todos los derechos reservados.
    </p>
  </div>
</body>
</html>`;
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
    const branding = await resolveEmailBranding(userId);

    const bodyHtml = html || `<p style="color:rgba(255,255,255,0.78);font-size:15px;line-height:1.65;white-space:pre-wrap;margin:0;font-family:${SPARTAN};">${text}</p>`;

    const finalHtml = wrapEmailHtml(bodyHtml, branding);

    const transporter = await createTransporter();
    const from = process.env.SMTP_FROM
      || `"Trámites Vehiculares de México" <${process.env.SMTP_USER || 'noreply@tramitesvehicularesdemexico.com'}>`;
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html: finalHtml,
      attachments: branding.logoAttachments,
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
