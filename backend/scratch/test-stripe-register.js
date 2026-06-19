import dotenv from 'dotenv';
import Stripe from 'stripe';
import { get } from '../src/db.js';

dotenv.config();

const admin = await get(
  "SELECT stripe_secret_key, stripe_price_id FROM users WHERE role IN ('admin', 'super_admin') AND stripe_secret_key IS NOT NULL LIMIT 1",
);

if (!admin) {
  console.log('No admin stripe config');
  process.exit(0);
}

const stripe = new Stripe(admin.stripe_secret_key);

try {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: admin.stripe_price_id, quantity: 1 }],
    success_url: 'http://localhost:4201/subscription/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'http://localhost:4201/registro-pendiente',
    customer_email: 'stripe-test@example.com',
    metadata: { user_id: 'test', role: 'gestor' },
  });
  console.log('OK', session.url?.slice(0, 60));
} catch (err) {
  console.error('STRIPE FAIL:', err.type, err.message);
}
