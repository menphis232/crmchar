import Stripe from 'stripe';
import { get, run } from '../db.js';
import { sendEmail } from './mailer.js';
import { getFrontendBase } from './frontend-url.js';

const MAX_PAYMENT_FAILURES = 3;

export function stripeRefId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.id || null;
}

export async function getPlatformStripeAdmin() {
  return get(`
    SELECT stripe_secret_key, stripe_price_id, stripe_public_key
    FROM users
    WHERE role IN ('admin', 'super_admin')
      AND stripe_secret_key IS NOT NULL AND stripe_secret_key != ''
      AND stripe_price_id IS NOT NULL AND stripe_price_id != ''
    ORDER BY CASE role WHEN 'super_admin' THEN 0 ELSE 1 END
    LIMIT 1
  `);
}

export function roleDisplayName(role) {
  if (role === 'gestor') return 'Gestoría';
  if (role === 'concesionaria') return 'Concesionaria';
  return 'Tu cuenta';
}

export async function createActivationCheckout(user, stripe, priceId) {
  const origin = getFrontendBase();
  const params = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/registro-pendiente?email=${encodeURIComponent(user.email)}`,
    metadata: { user_id: user.id, role: user.role },
  };
  if (user.stripe_customer_id) {
    params.customer = user.stripe_customer_id;
  } else {
    params.customer_email = user.email;
  }
  const session = await stripe.checkout.sessions.create(params);
  await run('UPDATE users SET stripe_checkout_session_id = ? WHERE id = ?', [session.id, user.id]);
  return session.url;
}

async function sendActivationEmail(toEmail, name, roleName, checkoutUrl) {
  const subject = `💳 Activa tu cuenta de ${roleName} en Trámites Vehiculares`;
  const html = `
      <h2 style="color: #ffffff; font-size: 20px; font-weight: 500;">Hola, ${name}</h2>
      <p style="color: #a0aec0; font-size: 15px; line-height: 1.6;">Tu cuenta de <strong>${roleName}</strong> está registrada pero aún no activa.</p>
      <p style="color: #a0aec0; font-size: 15px; line-height: 1.6;">Completa tu suscripción mensual para acceder a tu panel:</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${checkoutUrl}" style="background: linear-gradient(135deg, #c8a94a, #d4af37); color: #000; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Activar mi cuenta &rarr;</a>
      </div>
      <p style="color: #888; font-size: 13px;">Si el botón no funciona, copia este enlace:<br><a href="${checkoutUrl}" style="color: #c8a94a;">${checkoutUrl}</a></p>
  `;
  await sendEmail(toEmail, subject, `Activa tu cuenta: ${checkoutUrl}`, html);
}

async function sendPaymentFailedEmail(toEmail, name, roleName, checkoutUrl, attempt, maxAttempts) {
  const remaining = maxAttempts - attempt;
  const subject = `⚠️ Pago rechazado (${attempt}/${maxAttempts}) — ${roleName}`;
  const html = `
      <h2 style="color: #ffffff; font-size: 20px; font-weight: 500;">Pago no procesado</h2>
      <p style="color: #a0aec0; font-size: 15px; line-height: 1.6;">Hola ${name}, intentamos cobrar tu suscripción de <strong>${roleName}</strong> pero el pago fue rechazado.</p>
      <p style="color: #a0aec0; font-size: 15px; line-height: 1.6;">Intento <strong>${attempt} de ${maxAttempts}</strong>. ${remaining > 0 ? `Te quedan ${remaining} intento(s) antes de que tu cuenta se desactive.` : 'Tu cuenta ha sido desactivada.'}</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${checkoutUrl}" style="background: linear-gradient(135deg, #c8a94a, #d4af37); color: #000; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Actualizar pago &rarr;</a>
      </div>
  `;
  await sendEmail(toEmail, subject, `Pago rechazado — intento ${attempt}/${maxAttempts}`, html);
}

/** Envía correo de activación si el usuario sigue pendiente de pago. */
export async function sendActivationEmailForUser(userId) {
  const user = await get('SELECT id, email, name, role, status FROM users WHERE id = ?', [userId]);
  if (!user || user.status !== 'pending_payment') return { sent: false, reason: 'not_pending' };

  const admin = await getPlatformStripeAdmin();
  if (!admin) return { sent: false, reason: 'no_stripe' };

  const stripe = new Stripe(admin.stripe_secret_key);
  const checkoutUrl = await createActivationCheckout(user, stripe, admin.stripe_price_id);
  await sendActivationEmail(user.email, user.name, roleDisplayName(user.role), checkoutUrl);
  return { sent: true, checkoutUrl };
}

export async function sendActivationEmailByEmail(email) {
  const user = await get(
    "SELECT id, email, name, role, status FROM users WHERE email = ? AND role IN ('gestor', 'concesionaria')",
    [email.toLowerCase()],
  );
  if (!user) return { sent: false, reason: 'not_found' };
  if (user.status === 'active') return { sent: false, reason: 'already_active' };

  const admin = await getPlatformStripeAdmin();
  if (!admin) return { sent: false, reason: 'no_stripe' };

  if (user.status !== 'pending_payment') {
    await run("UPDATE users SET status = 'pending_payment' WHERE id = ?", [user.id]);
  }

  const stripe = new Stripe(admin.stripe_secret_key);
  const checkoutUrl = await createActivationCheckout(user, stripe, admin.stripe_price_id);
  await sendActivationEmail(user.email, user.name, roleDisplayName(user.role), checkoutUrl);
  return { sent: true };
}

export async function activateUserSubscription(userId, customerId, subscriptionId) {
  const customer = stripeRefId(customerId);
  const subscription = stripeRefId(subscriptionId);
  await run(
    `UPDATE users SET status = 'active', payment_failed_count = 0,
     stripe_customer_id = COALESCE(?, stripe_customer_id),
     stripe_subscription_id = COALESCE(?, stripe_subscription_id) WHERE id = ?`,
    [customer, subscription, userId],
  );
}

export async function handlePaymentFailed(subscriptionId) {
  const user = await get(
    'SELECT id, email, name, role, payment_failed_count, status FROM users WHERE stripe_subscription_id = ?',
    [subscriptionId],
  );
  if (!user) return;

  const newCount = (user.payment_failed_count || 0) + 1;
  const admin = await getPlatformStripeAdmin();
  if (!admin) return;

  const stripe = new Stripe(admin.stripe_secret_key);
  const checkoutUrl = await createActivationCheckout(user, stripe, admin.stripe_price_id);

  if (newCount >= MAX_PAYMENT_FAILURES) {
    await run(
      "UPDATE users SET status = 'deactivated', payment_failed_count = ? WHERE id = ?",
      [newCount, user.id],
    );
    await sendPaymentFailedEmail(user.email, user.name, roleDisplayName(user.role), checkoutUrl, newCount, MAX_PAYMENT_FAILURES);
    console.log(`Usuario ${user.id} desactivado tras ${newCount} pagos fallidos.`);
    return;
  }

  await run(
    "UPDATE users SET status = 'pending_payment', payment_failed_count = ? WHERE id = ?",
    [newCount, user.id],
  );
  await sendPaymentFailedEmail(user.email, user.name, roleDisplayName(user.role), checkoutUrl, newCount, MAX_PAYMENT_FAILURES);
  console.log(`Pago fallido ${newCount}/${MAX_PAYMENT_FAILURES} para usuario ${user.id}`);
}

export async function getOrgSubscriptionStatus(userId, parentId) {
  const orgId = parentId || userId;
  const org = await get('SELECT status FROM users WHERE id = ?', [orgId]);
  return org?.status || 'active';
}

export { MAX_PAYMENT_FAILURES };
