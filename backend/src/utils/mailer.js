import nodemailer from 'nodemailer';

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

export async function sendEmail(to, subject, text, html) {
  try {
    const transporter = await createTransporter();
    const info = await transporter.sendMail({
      from: '"Trámites Vehiculares" <noreply@tramitesvehiculares.com>',
      to,
      subject,
      text,
      html,
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
