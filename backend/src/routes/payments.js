import { Router } from 'express';
import Stripe from 'stripe';
import { get, run } from '../db.js';
import { v4 as uuid } from 'uuid';

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
      // 4. Mark deal as paid and moved to completado
      await run("UPDATE crm_deals SET payment_status = 'paid', stage = 'completado', stage_changed_at = NOW() WHERE id = ?", [deal_id]);

      // 5. Add income to fin_transactions
      const amountPaid = session.amount_total / 100; // Convert from cents
      await run(`
        INSERT INTO fin_transactions (id, user_id, deal_id, type, amount, description, date, category)
        VALUES (?, ?, ?, 'income', ?, ?, NOW(), 'Venta/Trámite Pagado')
      `, [uuid(), deal.user_id, deal_id, amountPaid, `Stripe (Ref: ${session_id.slice(-8)}) - ${deal.title || 'Trámite'}`]);

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

    const admin = await get("SELECT stripe_secret_key FROM users WHERE role = 'admin' LIMIT 1");
    if (!admin || !admin.stripe_secret_key) {
      return res.status(400).json({ error: 'El sistema no tiene Stripe configurado' });
    }

    const stripe = new Stripe(admin.stripe_secret_key);
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status === 'paid' && session.mode === 'subscription') {
      const userId = session.metadata?.user_id;
      if (userId) {
        await run(
          "UPDATE users SET status = 'active', stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?",
          [session.customer, session.subscription, userId]
        );
        return res.json({ success: true });
      } else {
        return res.status(400).json({ error: 'Sesión sin metadata de usuario' });
      }
    } else {
      return res.status(400).json({ error: 'El pago de la suscripción no se ha completado' });
    }
  } catch (err) {
    console.error('Stripe Subscription Confirm Error:', err);
    res.status(500).json({ error: 'Error interno al confirmar la suscripción' });
  }
});

export default router;
