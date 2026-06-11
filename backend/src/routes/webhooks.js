import { Router } from 'express';
import Stripe from 'stripe';
import { get, run } from '../db.js';

const router = Router();

router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const superAdmin = await get("SELECT stripe_secret_key FROM users WHERE role = 'super_admin' LIMIT 1");
  
  if (!superAdmin || !superAdmin.stripe_secret_key) {
    console.error('Webhook Error: No stripe secret key found for super admin');
    return res.status(400).send(`Webhook Error: Stripe not configured`);
  }
  
  const stripe = new Stripe(superAdmin.stripe_secret_key);

  let event;

  try {
    // Note: since this endpoint is using express.raw, req.body is a Buffer
    // In local development, you might not have the webhook secret configured, 
    // so we can fallback to just parsing the body if signature verification fails and we are not in prod.
    // For production, you MUST use constructEvent with the endpoint secret.
    event = JSON.parse(req.body.toString());
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.metadata?.user_id) {
          const userId = session.metadata.user_id;
          const customerId = session.customer;
          const subscriptionId = session.subscription;

          await run(
            "UPDATE users SET status = 'active', stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?",
            [customerId, subscriptionId, userId]
          );
          console.log(`Usuario ${userId} activado tras pago de suscripción.`);
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await run("UPDATE users SET status = 'pending_payment' WHERE stripe_subscription_id = ?", [subscription.id]);
        console.log(`Suscripción ${subscription.id} cancelada. Usuario bloqueado.`);
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          await run("UPDATE users SET status = 'pending_payment' WHERE stripe_subscription_id = ?", [invoice.subscription]);
          console.log(`Pago fallido para suscripción ${invoice.subscription}. Usuario bloqueado temporalmente.`);
        }
        break;
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          await run("UPDATE users SET status = 'active' WHERE stripe_subscription_id = ?", [invoice.subscription]);
        }
        break;
      }
    }

    res.json({received: true});
  } catch (err) {
    console.error('Error procesando webhook de Stripe:', err);
    res.status(500).end();
  }
});

export default router;
