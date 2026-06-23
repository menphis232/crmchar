import { Router } from 'express';
import Stripe from 'stripe';
import { get, run } from '../db.js';
import {
  getPlatformStripeAdmin,
  activateUserSubscription,
  isSubscriptionSessionComplete,
} from '../utils/subscription-lifecycle.js';
import { finalizeDealPayment } from '../services/deal-payment.js';

const router = Router();

router.post('/confirm', async (req, res) => {
  try {
    const { session_id, deal_id } = req.body;
    if (!session_id || !deal_id) {
      return res.status(400).json({ error: 'Faltan parámetros' });
    }

    // 1. Get the deal and verify it hasn't been paid already
    const deal = await get('SELECT * FROM crm_deals WHERE id = ?', [deal_id]);
    if (!deal) return res.status(404).json({ error: 'Trámite no encontrado' });
    if (deal.payment_status === 'paid') {
      return res.json({ success: true, alreadyPaid: true });
    }

    // 2. Get the owner's Stripe Secret Key
    const owner = await get('SELECT stripe_secret_key FROM users WHERE id = ?', [deal.user_id]);
    if (!owner || !owner.stripe_secret_key) {
      return res.status(400).json({ error: 'El vendedor no tiene configurado Stripe' });
    }

    // 3. Verify the session with Stripe
    const stripe = new Stripe(owner.stripe_secret_key);
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status === 'paid') {
      const amountPaid = session.amount_total / 100;
      try {
        await finalizeDealPayment(deal_id, {
          amount: amountPaid,
          mpOrderId: session_id,
          paymentMethod: 'stripe',
        });
      } catch (finalizeErr) {
        console.error('Stripe finalizeDealPayment error:', finalizeErr);
        await run("UPDATE crm_deals SET payment_status = 'paid', stage = 'completado', stage_changed_at = NOW() WHERE id = ?", [deal_id]);
      }
      return res.json({ success: true });
    } else {
      return res.status(400).json({ error: 'El pago no ha sido completado en Stripe' });
    }
  } catch (err) {
    console.error('Stripe Confirm Error:', err);
    res.status(500).json({ error: 'Error interno al confirmar pago' });
  }
});

router.post('/confirm-subscription', async (req, res) => {
  try {
    const { session_id } = req.body;
    if (!session_id) {
      return res.status(400).json({ error: 'Falta session_id' });
    }

    const admin = await getPlatformStripeAdmin();
    if (!admin?.stripe_secret_key) {
      return res.status(400).json({ error: 'El sistema no tiene Stripe configurado' });
    }

    const stripe = new Stripe(admin.stripe_secret_key);
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (isSubscriptionSessionComplete(session)) {
      const userId = session.metadata?.user_id;
      if (userId) {
        await activateUserSubscription(userId, session.customer, session.subscription);
        return res.json({ success: true, trial: session.payment_status === 'no_payment_required' });
      }
      return res.status(400).json({ error: 'Sesión sin metadata de usuario' });
    }
    return res.status(400).json({ error: 'La suscripción no se ha completado' });
  } catch (err) {
    console.error('Stripe Subscription Confirm Error:', err);
    res.status(500).json({ error: 'Error interno al confirmar la suscripción' });
  }
});

export default router;
