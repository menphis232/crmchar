import { Router } from 'express';
import Stripe from 'stripe';
import { get, run } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import {
  getPlatformStripeAdmin,
  createActivationCheckout,
} from '../utils/subscription-lifecycle.js';
import {
  tsToIso,
  subscriptionPeriodEnd,
  subscriptionPeriodStart,
  invoiceDisplayDate,
} from '../utils/stripe-dates.js';

const router = Router();

async function getPlatformStripe() {
  const admin = await get(`
    SELECT stripe_secret_key, stripe_public_key
    FROM users
    WHERE role IN ('admin', 'super_admin')
      AND stripe_secret_key IS NOT NULL AND stripe_secret_key != ''
    LIMIT 1
  `);
  if (!admin?.stripe_secret_key) return null;
  return {
    stripe: new Stripe(admin.stripe_secret_key),
    publicKey: admin.stripe_public_key || '',
  };
}

function billingRoles(req, res, next) {
  if (!['gestor', 'concesionaria'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  if (req.user.parent_id) {
    return res.status(403).json({ error: 'Solo el titular de la cuenta puede gestionar la suscripción' });
  }
  next();
}

async function getOrgUser(req) {
  return get(`
    SELECT id, name, email, status, payment_failed_count, stripe_customer_id, stripe_subscription_id
    FROM users WHERE id = ?
  `, [req.user.id]);
}

async function resolveSubscription(platform, user) {
  if (user.stripe_subscription_id) {
    try {
      return await platform.stripe.subscriptions.retrieve(user.stripe_subscription_id, {
        expand: ['latest_invoice', 'items.data.price'],
      });
    } catch {
      // subscription id stale
    }
  }

  if (user.stripe_customer_id) {
    const subs = await platform.stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: 'all',
      limit: 5,
    });
    const subscription = subs.data.find((s) => ['active', 'trialing', 'past_due'].includes(s.status))
      || subs.data[0];
    if (subscription) {
      await run('UPDATE users SET stripe_subscription_id = ? WHERE id = ?', [subscription.id, user.id]);
      return platform.stripe.subscriptions.retrieve(subscription.id, {
        expand: ['latest_invoice', 'items.data.price'],
      });
    }
  }

  return null;
}

async function ensureStripeCustomer(platform, user) {
  if (user.stripe_customer_id) return user.stripe_customer_id;
  if (!user.email) return null;
  const customers = await platform.stripe.customers.list({ email: user.email, limit: 1 });
  if (customers.data[0]) {
    await run('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customers.data[0].id, user.id]);
    user.stripe_customer_id = customers.data[0].id;
    return customers.data[0].id;
  }
  return null;
}

function mapInvoice(inv) {
  const displayDate = invoiceDisplayDate(inv);
  return {
    id: inv.id,
    number: inv.number,
    amount: (inv.amount_paid ?? inv.amount_due ?? 0) / 100,
    currency: inv.currency,
    status: inv.status,
    paidAt: tsToIso(inv.status_transitions?.paid_at) || displayDate,
    createdAt: displayDate || tsToIso(inv.created),
    periodStart: tsToIso(inv.period_start),
    periodEnd: tsToIso(inv.period_end),
    pdfUrl: inv.invoice_pdf || null,
    hostedUrl: inv.hosted_invoice_url || null,
  };
}

function buildSummaryResponse(user, subscription) {
  const periodEnd = subscriptionPeriodEnd(subscription);
  const cancelAtPeriodEnd = subscription?.cancel_at_period_end || false;
  const stripeStatus = subscription?.status || null;

  let lastPaymentDate = null;
  if (subscription?.latest_invoice && typeof subscription.latest_invoice !== 'string') {
    const inv = subscription.latest_invoice;
    if (inv.status === 'paid') {
      lastPaymentDate = invoiceDisplayDate(inv);
    }
  }
  if (!lastPaymentDate) {
    lastPaymentDate = subscriptionPeriodStart(subscription);
  }

  const price = subscription?.items?.data?.[0]?.price;
  const isActiveStripe = stripeStatus === 'active' || stripeStatus === 'trialing';

  return {
    hasSubscription: !!subscription,
    status: user.status || stripeStatus,
    stripeSubscriptionStatus: stripeStatus,
    paymentFailedCount: user.payment_failed_count || 0,
    planAmount: price?.unit_amount != null ? price.unit_amount / 100 : null,
    planCurrency: price?.currency || 'mxn',
    planInterval: price?.recurring?.interval || null,
    lastPaymentDate,
    nextInvoiceDate: cancelAtPeriodEnd ? null : periodEnd,
    accessUntilDate: cancelAtPeriodEnd ? periodEnd : null,
    cancelAtPeriodEnd,
    canCancel: isActiveStripe && !cancelAtPeriodEnd,
    canReactivate: isActiveStripe && cancelAtPeriodEnd,
    canResubscribe: !subscription || ['canceled', 'incomplete_expired', 'unpaid'].includes(stripeStatus || '')
      || user.status === 'deactivated' || user.status === 'pending_payment',
  };
}

router.use(authRequired, billingRoles);

router.get('/summary', async (req, res) => {
  try {
    const platform = await getPlatformStripe();
    if (!platform) {
      return res.status(400).json({ error: 'Stripe no está configurado en la plataforma' });
    }

    const user = await getOrgUser(req);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    await ensureStripeCustomer(platform, user);

    if (!user.stripe_subscription_id && !user.stripe_customer_id) {
      return res.json({
        hasSubscription: false,
        status: user.status,
        stripeSubscriptionStatus: null,
        paymentFailedCount: user.payment_failed_count || 0,
        planAmount: null,
        planCurrency: 'mxn',
        planInterval: null,
        lastPaymentDate: null,
        nextInvoiceDate: null,
        accessUntilDate: null,
        cancelAtPeriodEnd: false,
        canCancel: false,
        canReactivate: false,
        canResubscribe: user.status === 'deactivated' || user.status === 'pending_payment',
      });
    }

    const subscription = await resolveSubscription(platform, user);
    const summary = buildSummaryResponse(user, subscription);

    if (!summary.lastPaymentDate && user.stripe_customer_id) {
      const paidInvoices = await platform.stripe.invoices.list({
        customer: user.stripe_customer_id,
        status: 'paid',
        limit: 1,
      });
      if (paidInvoices.data[0]) {
        summary.lastPaymentDate = invoiceDisplayDate(paidInvoices.data[0]);
      }
    }

    res.json(summary);
  } catch (err) {
    console.error('Billing summary error:', err);
    res.status(500).json({ error: 'Error al obtener información de suscripción' });
  }
});

router.get('/invoices', async (req, res) => {
  try {
    const platform = await getPlatformStripe();
    if (!platform) {
      return res.status(400).json({ error: 'Stripe no está configurado en la plataforma' });
    }

    const user = await getOrgUser(req);
    if (!user?.stripe_customer_id) {
      return res.json({ invoices: [] });
    }

    const result = await platform.stripe.invoices.list({
      customer: user.stripe_customer_id,
      limit: 24,
    });

    res.json({ invoices: result.data.map(mapInvoice) });
  } catch (err) {
    console.error('Billing invoices error:', err);
    res.status(500).json({ error: 'Error al obtener facturas' });
  }
});

router.get('/payment-methods', async (req, res) => {
  try {
    const platform = await getPlatformStripe();
    if (!platform) {
      return res.status(400).json({ error: 'Stripe no está configurado en la plataforma' });
    }

    const user = await getOrgUser(req);
    if (!user?.stripe_customer_id) {
      return res.json({ methods: [], defaultPaymentMethodId: null });
    }

    const customer = await platform.stripe.customers.retrieve(user.stripe_customer_id);
    const defaultPm = customer.invoice_settings?.default_payment_method;
    const defaultId = typeof defaultPm === 'string' ? defaultPm : defaultPm?.id || null;

    const pms = await platform.stripe.paymentMethods.list({
      customer: user.stripe_customer_id,
      type: 'card',
    });

    res.json({
      methods: pms.data.map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand || 'card',
        last4: pm.card?.last4 || '****',
        expMonth: pm.card?.exp_month || 0,
        expYear: pm.card?.exp_year || 0,
        isDefault: pm.id === defaultId,
      })),
      defaultPaymentMethodId: defaultId,
    });
  } catch (err) {
    console.error('Billing payment methods error:', err);
    res.status(500).json({ error: 'Error al obtener métodos de pago' });
  }
});

router.post('/setup-intent', async (req, res) => {
  try {
    const platform = await getPlatformStripe();
    if (!platform) {
      return res.status(400).json({ error: 'Stripe no está configurado en la plataforma' });
    }
    if (!platform.publicKey) {
      return res.status(400).json({ error: 'Falta la clave pública de Stripe en la plataforma' });
    }

    const user = await getOrgUser(req);
    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await platform.stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await run('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customerId, user.id]);
    }

    const setupIntent = await platform.stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });

    res.json({
      clientSecret: setupIntent.client_secret,
      publishableKey: platform.publicKey,
    });
  } catch (err) {
    console.error('Billing setup-intent error:', err);
    res.status(500).json({ error: 'Error al preparar el formulario de pago' });
  }
});

router.delete('/payment-methods/:id', async (req, res) => {
  try {
    const platform = await getPlatformStripe();
    if (!platform) {
      return res.status(400).json({ error: 'Stripe no está configurado en la plataforma' });
    }

    const user = await getOrgUser(req);
    if (!user?.stripe_customer_id) {
      return res.status(404).json({ error: 'Sin métodos de pago registrados' });
    }

    const pm = await platform.stripe.paymentMethods.retrieve(req.params.id);
    if (pm.customer !== user.stripe_customer_id) {
      return res.status(403).json({ error: 'Método de pago no encontrado' });
    }

    await platform.stripe.paymentMethods.detach(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Billing delete PM error:', err);
    res.status(500).json({ error: err.message || 'Error al eliminar método de pago' });
  }
});

router.put('/payment-methods/:id/default', async (req, res) => {
  try {
    const platform = await getPlatformStripe();
    if (!platform) {
      return res.status(400).json({ error: 'Stripe no está configurado en la plataforma' });
    }

    const user = await getOrgUser(req);
    if (!user?.stripe_customer_id) {
      return res.status(404).json({ error: 'Sin métodos de pago registrados' });
    }

    const pm = await platform.stripe.paymentMethods.retrieve(req.params.id);
    if (pm.customer !== user.stripe_customer_id) {
      return res.status(403).json({ error: 'Método de pago no encontrado' });
    }

    await platform.stripe.customers.update(user.stripe_customer_id, {
      invoice_settings: { default_payment_method: req.params.id },
    });

    if (user.stripe_subscription_id) {
      await platform.stripe.subscriptions.update(user.stripe_subscription_id, {
        default_payment_method: req.params.id,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Billing default PM error:', err);
    res.status(500).json({ error: 'Error al establecer método predeterminado' });
  }
});

router.post('/cancel-subscription', async (req, res) => {
  try {
    const platform = await getPlatformStripe();
    if (!platform) {
      return res.status(400).json({ error: 'Stripe no está configurado en la plataforma' });
    }

    const user = await getOrgUser(req);
    const subscription = await resolveSubscription(platform, user);
    if (!subscription) {
      return res.status(404).json({ error: 'No tienes una suscripción activa' });
    }
    if (subscription.cancel_at_period_end) {
      return res.json({ success: true, message: 'La suscripción ya está programada para cancelarse' });
    }

    const updated = await platform.stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });

    res.json({
      success: true,
      ...buildSummaryResponse(user, updated),
    });
  } catch (err) {
    console.error('Billing cancel-subscription error:', err);
    res.status(500).json({ error: err.message || 'Error al cancelar la suscripción' });
  }
});

router.post('/reactivate-subscription', async (req, res) => {
  try {
    const platform = await getPlatformStripe();
    if (!platform) {
      return res.status(400).json({ error: 'Stripe no está configurado en la plataforma' });
    }

    const user = await getOrgUser(req);
    const subscription = await resolveSubscription(platform, user);
    if (!subscription) {
      return res.status(404).json({ error: 'No tienes una suscripción activa' });
    }
    if (!subscription.cancel_at_period_end) {
      return res.json({ success: true, message: 'La suscripción ya está activa' });
    }

    const updated = await platform.stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: false,
    });

    await run("UPDATE users SET status = 'active' WHERE id = ?", [user.id]);

    res.json({
      success: true,
      ...buildSummaryResponse(user, updated),
    });
  } catch (err) {
    console.error('Billing reactivate-subscription error:', err);
    res.status(500).json({ error: err.message || 'Error al reactivar la suscripción' });
  }
});

router.post('/resubscribe', async (req, res) => {
  try {
    const admin = await getPlatformStripeAdmin();
    if (!admin) {
      return res.status(400).json({ error: 'Stripe no está configurado en la plataforma' });
    }

    const user = await getOrgUser(req);
    if (user.status === 'active') {
      const platform = await getPlatformStripe();
      const sub = platform ? await resolveSubscription(platform, user) : null;
      if (sub && ['active', 'trialing'].includes(sub.status) && !sub.cancel_at_period_end) {
        return res.json({ success: true, message: 'Tu suscripción ya está activa' });
      }
    }

    if (user.status !== 'pending_payment') {
      await run("UPDATE users SET status = 'pending_payment' WHERE id = ?", [user.id]);
    }

    const stripe = new Stripe(admin.stripe_secret_key);
    const checkoutUrl = await createActivationCheckout(user, stripe, admin.stripe_price_id);
    res.json({ success: true, checkoutUrl });
  } catch (err) {
    console.error('Billing resubscribe error:', err);
    res.status(500).json({ error: err.message || 'Error al generar enlace de suscripción' });
  }
});

export default router;
