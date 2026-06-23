import express from 'express';
import { MercadoPagoConfig, Order } from 'mercadopago';
import { v4 as uuid } from 'uuid';
import { get, run } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { orgId } from '../utils/org-access.js';

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMpClient(accessToken) {
  return new MercadoPagoConfig({ accessToken, options: { timeout: 10000 } });
}

function translateMpCode(code) {
  const map = {
    cc_rejected_bad_filled_security_code: 'CVV incorrecto.',
    cc_rejected_bad_filled_date: 'Fecha de vencimiento incorrecta.',
    cc_rejected_bad_filled_card_number: 'Número de tarjeta incorrecto.',
    cc_rejected_bad_filled_other: 'Revisa los datos de la tarjeta.',
    cc_rejected_insufficient_amount: 'Fondos insuficientes.',
    cc_rejected_call_for_authorize: 'Debes autorizar el pago con tu banco.',
    cc_rejected_high_risk: 'Pago rechazado por seguridad.',
    cc_rejected_other_reason: 'Pago rechazado. Prueba con otra tarjeta.',
    invalid_card_token: 'Token de tarjeta inválido o ya usado. Recarga la página e intenta de nuevo.',
    invalid_users_email: 'En pruebas usa un email que termine en @testuser.com',
    required_properties: 'Faltan datos obligatorios para el pago.',
    failed: 'La transacción falló.',
  };
  return map[code] || code;
}

function extractMpError(err) {
  const parts = [];

  if (Array.isArray(err?.errors)) {
    for (const e of err.errors) {
      if (e?.message && e.message !== 'The following transactions failed') {
        parts.push(e.message);
      }
      if (Array.isArray(e?.details)) {
        for (const d of e.details) {
          if (d?.description) parts.push(d.description);
          else if (d?.message) parts.push(d.message);
          else if (d?.code) parts.push(translateMpCode(d.code));
        }
      }
    }
  }

  const payment = err?.data?.transactions?.payments?.[0];
  if (payment?.status_detail) {
    parts.push(translateMpCode(payment.status_detail));
  }

  const causes = err?.cause;
  if (Array.isArray(causes)) {
    for (const c of causes) {
      if (c?.description) parts.push(c.description);
      else if (c?.message) parts.push(c.message);
      else if (c?.code) parts.push(translateMpCode(c.code));
    }
  }

  if (err?.message && !parts.length && err.message !== 'failed') {
    parts.push(err.message);
  }

  return [...new Set(parts.filter(Boolean))].join('. ') || 'Error al procesar el pago';
}

function handleOrderResponse(orderResult, row, res, mpErr) {
  const status = orderResult?.status;
  const orderId = orderResult?.id;
  const statusDetail = orderResult?.status_detail;
  const payment = orderResult?.transactions?.payments?.[0];
  const paymentDetail = payment?.status_detail;

  if (status === 'processed' || status === 'approved' || statusDetail === 'accredited' || paymentDetail === 'accredited') {
    return run(
      `UPDATE crm_deals
       SET mp_order_id = ?, mp_payment_token = NULL, payment_status = 'paid', stage = 'completado'
       WHERE id = ?`,
      [orderId || null, row.id],
    ).then(() => res.json({ success: true, status, orderId }));
  }

  if (status === 'requires_action') {
    const actionUrl = payment?.payment_method?.transaction_security?.url;
    return run('UPDATE crm_deals SET mp_order_id = ? WHERE id = ?', [orderId || null, row.id])
      .then(() => res.json({ success: false, status, requiresAction: true, actionUrl }));
  }

  const msg = translateMpCode(paymentDetail)
    || translateMpCode(statusDetail)
    || extractMpError(mpErr || { data: orderResult });

  return res.status(402).json({
    success: false,
    status,
    orderId,
    error: msg,
    message: msg,
  });
}

// ─── Generate payment link for a deal ────────────────────────────────────────
// POST /api/mp/generate-link/:dealId  (authenticated)
router.post('/generate-link/:dealId', authRequired, async (req, res) => {
  try {
    const dealId = req.params.dealId;
    if (!dealId) return res.status(400).json({ error: 'dealId inválido' });

    const uid = orgId(req);
    const deal = await get(
      `SELECT d.id, d.title, d.estimated_value, d.user_id, d.stage
       FROM crm_deals d WHERE d.id = ? AND d.user_id = ?`,
      [dealId, uid],
    );
    if (!deal) return res.status(404).json({ error: 'Trámite no encontrado' });
    if (!deal.estimated_value || deal.estimated_value <= 0) {
      return res.status(400).json({ error: 'El trámite no tiene un valor válido para cobrar' });
    }

    const owner = await get(
      'SELECT mp_access_token, mp_public_key FROM users WHERE id = ?',
      [uid],
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
    const {
      cardToken,
      paymentMethodId,
      payerEmail,
      installments,
      identificationType,
      identificationNumber,
    } = req.body;

    if (!cardToken || !payerEmail) {
      return res.status(400).json({ error: 'Faltan datos del pago (token de tarjeta o email)' });
    }
    if (!paymentMethodId) {
      return res.status(400).json({ error: 'No se recibió el tipo de tarjeta. Intenta de nuevo.' });
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
    const title = (row.title || 'Trámite Vehicular').slice(0, 150);

    const body = {
      type: 'online',
      processing_mode: 'automatic',
      capture_mode: 'automatic',
      total_amount: totalAmount,
      external_reference: `deal_${row.id}`.slice(0, 150),
      description: title,
      payer: {
        email: payerEmail,
        entity_type: 'individual',
        ...(identificationType && identificationNumber
          ? { identification: { type: identificationType, number: String(identificationNumber) } }
          : {}),
      },
      items: [
        {
          title,
          unit_price: totalAmount,
          quantity: 1,
          description: title,
        },
      ],
      transactions: {
        payments: [
          {
            amount: totalAmount,
            payment_method: {
              id: paymentMethodId,
              type: 'credit_card',
              token: cardToken,
              installments: Number(installments) || 1,
              statement_descriptor: 'TRAMITESVEH',
            },
          },
        ],
      },
    };

    const requestOptions = { idempotencyKey: uuid() };

    try {
      const orderResult = await orderApi.create({ body, requestOptions });
      return handleOrderResponse(orderResult, row, res);
    } catch (mpErr) {
      console.error('MP process-payment error:', JSON.stringify(mpErr, null, 2));
      if (mpErr?.data) {
        return handleOrderResponse(mpErr.data, row, res, mpErr);
      }
      return res.status(500).json({ error: extractMpError(mpErr) });
    }
  } catch (err) {
    console.error('MP process-payment fatal:', err);
    res.status(500).json({ error: extractMpError(err) });
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
