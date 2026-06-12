import nodemailer from 'nodemailer';
import { get } from '../db.js'; // Need to import DB to query the logo

export async function createTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_PORT == 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Fallback to Mailtrap for testing
  return nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: "0e03374eb334f8",
      pass: "9edf41cb2254e7"
    }
  });
}

export async function sendEmail(to, subject, text, html, userId = null) {
  try {
    let logoUrl = null;

    if (userId) {
      const user = await get('SELECT logo_url FROM users WHERE id = ?', [userId]);
      if (user && user.logo_url) logoUrl = user.logo_url;
    }

    if (!logoUrl) {
      const admin = await get("SELECT logo_url FROM users WHERE role = 'admin' AND logo_url IS NOT NULL LIMIT 1");
      if (admin && admin.logo_url) logoUrl = admin.logo_url;
    }

    const headerLogo = logoUrl
      ? `<img src="${logoUrl.startsWith('http') ? logoUrl : 'http://localhost:3001' + logoUrl}" alt="Logo" style="max-height: 50px; border-radius: 4px;">`
      : `<h1 style="color: #c8a94a; margin: 0; font-size: 24px; letter-spacing: 1px;">TRÁMITES<span style="color: #fff;">VEHICULARES</span>.mx</h1>`;

    const bodyHtml = html || `<p style="color: #a0aec0; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${text}</p>`;

    const finalHtml = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #1e2638; padding: 40px; border-radius: 12px; border: 1px solid #333;">
      <div style="text-align: center; margin-bottom: 30px;">
        ${headerLogo}
      </div>
      
      ${bodyHtml}

      <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 30px 0;">
      <p style="color: #718096; font-size: 12px; text-align: center; margin: 10px 0 0 0;">&copy; ${new Date().getFullYear()} Trámites Vehiculares. Todos los derechos reservados.</p>
    </div>
    `;

    const transporter = await createTransporter();
    const info = await transporter.sendMail({
      from: '"Trámites Vehiculares" <noreply@tramitesvehiculares.com>',
      to,
      subject,
      text,
      html: finalHtml,
    });

    console.log("Message sent: %s", info.messageId);
    if (!process.env.SMTP_HOST) {
      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    }
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}
