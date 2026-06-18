import { Router } from 'express';
import Stripe from 'stripe';
import { get, run } from '../db.js';
import {
  getPlatformStripeAdmin,
  activateUserSubscription,
  handlePaymentFailed,
  stripeRefId,
} from '../utils/subscription-lifecycle.js';

const router = Router();

async function getStripeInstance() {
  const admin = await getPlatformStripeAdmin();
  if (!admin?.stripe_secret_key) return null;
  return new Stripe(admin.stripe_secret_key);
}

router.post('/stripe', async (req, res) => {
  const stripe = await getStripeInstance();
  if (!stripe) {
    console.error('Webhook Error: Stripe not configured');
    return res.status(400).send('Webhook Error: Stripe not configured');
  }

  let event;
  try {
    event = JSON.parse(req.body.toString());
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.metadata?.user_id && session.payment_status === 'paid') {
          await activateUserSubscription(
            session.metadata.user_id,
            session.customer,
            session.subscription,
          );
          console.log(`Usuario ${session.metadata.user_id} activado tras pago de suscripción.`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await run(
          "UPDATE users SET status = 'deactivated', stripe_subscription_id = NULL WHERE stripe_subscription_id = ?",
          [subscription.id],
        );
        console.log(`Suscripción ${subscription.id} terminada. Usuario desactivado.`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const subId = subscription.id;
        if (['canceled', 'incomplete_expired', 'unpaid'].includes(subscription.status)) {
          await run(
            "UPDATE users SET status = 'deactivated' WHERE stripe_subscription_id = ?",
            [subId],
          );
          console.log(`Suscripción ${subId} en estado ${subscription.status}. Usuario desactivado.`);
        } else if (subscription.status === 'active' && !subscription.cancel_at_period_end) {
          await run(
            "UPDATE users SET status = 'active', payment_failed_count = 0 WHERE stripe_subscription_id = ?",
            [subId],
          );
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subId = stripeRefId(invoice.subscription);
        if (subId) {
          await handlePaymentFailed(subId);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subId = stripeRefId(invoice.subscription);
        if (subId) {
          await run(
            "UPDATE users SET status = 'active', payment_failed_count = 0 WHERE stripe_subscription_id = ?",
            [subId],
          );
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Error procesando webhook de Stripe:', err);
    res.status(500).end();
  }
});

export default router;
