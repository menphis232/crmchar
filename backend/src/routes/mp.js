import express from 'express';
import { MercadoPagoConfig, Order } from 'mercadopago';
import { v4 as uuid } from 'uuid';
import { get, run } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMpClient(accessToken) {
  return new MercadoPagoConfig({ accessToken, options: { timeout: 10000 } });
}

// ─── Generate payment link for a deal ────────────────────────────────────────
// POST /api/mp/generate-link/:dealId  (authenticated)
router.post('/generate-link/:dealId', authRequired, async (req, res) => {
  try {
    const dealId = req.params.dealId;
    if (!dealId) return res.status(400).json({ error: 'dealId inválido' });

    const deal = await get(
      `SELECT d.id, d.title, d.estimated_value, d.user_id, d.stage
       FROM crm_deals d WHERE d.id = ? AND d.user_id = ?`,
      [dealId, req.orgId],
    );
    if (!deal) return res.status(404).json({ error: 'Trámite no encontrado' });
    if (!deal.estimated_value || deal.estimated_value <= 0) {
      return res.status(400).json({ error: 'El trámite no tiene un valor válido para cobrar' });
    }

    const owner = await get(
      'SELECT mp_access_token, mp_public_key FROM users WHERE id = ?',
      [req.orgId],
    );
    if (!owner?.mp_access_token) {
      return res.status(400).json({
        error: 'Configura tu Access Token de MercadoPago en la pestaña Perfil',
      });
    }

    const token = uuid();
    await run(
      'UPDATE crm_deals SET mp_payment_token = ? WHERE id = ?',
      [token, dealId],
    );

    const frontendBase = process.env.FRONTEND_URL || 'https://tramitesvehiculares.mx';
    res.json({ url: `${frontendBase}/pay/mp/${token}` });
  } catch (err) {
    console.error('MP generate-link error:', err);
    res.status(500).json({ error: 'Error al generar link de MercadoPago: ' + err.message });
  }
});

// ─── Get public payment info (no auth – for the client's checkout page) ──────
// GET /api/mp/payment-info/:token
router.get('/payment-info/:token', async (req, res) => {
  try {
    const row = await get(
      `SELECT d.id, d.title, d.estimated_value, d.stage,
              u.mp_public_key, u.name AS gestor_name
       FROM crm_deals d
       JOIN users u ON u.id = d.user_id
       WHERE d.mp_payment_token = ?`,
      [req.params.token],
    );

    if (!row) return res.status(404).json({ error: 'Link de pago no encontrado o expirado' });
    if (!row.mp_public_key) {
      return res.status(400).json({ error: 'El gestor no ha configurado MercadoPago' });
    }
    if (row.stage === 'completado') {
      return res.status(409).json({ error: 'Este trámite ya fue pagado' });
    }

    res.json({
      publicKey: row.mp_public_key,
      amount: Number(row.estimated_value),
      description: row.title || 'Trámite Vehicular',
      gestorName: row.gestor_name,
    });
  } catch (err) {
    console.error('MP payment-info error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ─── Process payment (no auth – called from client's checkout page) ───────────
// POST /api/mp/process-payment/:token
router.post('/process-payment/:token', async (req, res) => {
  try {
    const { cardToken, payerEmail, installments, identificationType, identificationNumber } = req.body;

    if (!cardToken || !payerEmail) {
      return res.status(400).json({ error: 'Faltan datos del pago (token de tarjeta o email)' });
    }

    const row = await get(
      `SELECT d.id, d.title, d.estimated_value, d.stage, d.user_id,
              u.mp_access_token
       FROM crm_deals d
       JOIN users u ON u.id = d.user_id
       WHERE d.mp_payment_token = ?`,
      [req.params.token],
    );

    if (!row) return res.status(404).json({ error: 'Link de pago no encontrado o expirado' });
    if (row.stage === 'completado') {
      return res.status(409).json({ error: 'Este trámite ya fue pagado' });
    }
    if (!row.mp_access_token) {
      return res.status(400).json({ error: 'El gestor no tiene configurado MercadoPago' });
    }

    const mpClient = getMpClient(row.mp_access_token);
    const orderApi = new Order(mpClient);

    const totalAmount = Number(row.estimated_value).toFixed(2);

    const body = {
      type: 'online',
      processing_mode: 'automatic',
      total_amount: totalAmount,
      external_reference: `deal_${row.id}`,
      description: row.title || 'Trámite Vehicular',
      payer: {
        email: payerEmail,
        ...(identificationType && identificationNumber
          ? { identification: { type: identificationType, number: identificationNumber } }
          : {}),
      },
      transactions: {
        payments: [
          {
            amount: totalAmount,
            payment_method: {
              id: 'master', // will be overridden by the card token
              type: 'credit_card',
              token: cardToken,
              installments: Number(installments) || 1,
              statement_descriptor: 'Tramites Vehiculares',
            },
          },
        ],
      },
    };

    const requestOptions = { idempotencyKey: `deal_${row.id}_${req.params.token}` };

    const orderResult = await orderApi.create({ body, requestOptions });

    const status = orderResult?.status;
    const orderId = orderResult?.id;

    // Store the order ID on the deal
    await run(
      'UPDATE crm_deals SET mp_order_id = ?, mp_payment_token = NULL WHERE id = ?',
      [orderId || null, row.id],
    );

    if (status === 'processed' || status === 'approved') {
      // Mark the deal as paid
      await run(
        "UPDATE crm_deals SET payment_status = 'paid', stage = 'completado' WHERE id = ?",
        [row.id],
      );
      return res.json({ success: true, status, orderId });
    }

    if (status === 'requires_action') {
      const txn = orderResult?.transactions?.payments?.[0];
      const actionUrl = txn?.payment_method?.transaction_security?.url;
      return res.json({ success: false, status, requiresAction: true, actionUrl });
    }

    res.json({ success: false, status, orderId, message: 'Pago no aprobado. Intenta con otra tarjeta.' });
  } catch (err) {
    console.error('MP process-payment error:', err);
    const mpError = err?.cause?.[0]?.description || err?.message || 'Error al procesar el pago';
    res.status(500).json({ error: mpError });
  }
});

// ─── IPN / Webhook from MercadoPago ──────────────────────────────────────────
// POST /api/mp/webhook
router.post('/webhook', async (req, res) => {
  try {
    const { type, data } = req.body || {};
    if (type === 'order' && data?.id) {
      // Find the deal by mp_order_id
      const deal = await get('SELECT id FROM crm_deals WHERE mp_order_id = ?', [data.id]);
      if (deal) {
        await run(
          "UPDATE crm_deals SET payment_status = 'paid', stage = 'completado' WHERE id = ?",
          [deal.id],
        );
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('MP webhook error:', err);
    res.sendStatus(500);
  }
});

export default router;
