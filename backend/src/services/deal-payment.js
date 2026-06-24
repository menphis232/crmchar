import { v4 as uuid } from 'uuid';
import { get, run } from '../db.js';
import { generateInvoicePdfFile } from '../crm/invoice-pdf.js';
import { sendEmail } from '../utils/mailer.js';
import { emitDealPaymentPaid } from '../utils/socket-events.js';
import { isPaymentStageId, paymentMethodLabel } from '../crm/payment-stage.js';
async function nextInvoiceNumber(userId) {
  const year = new Date().getFullYear();
  const row = await get(
    'SELECT COUNT(*) AS n FROM deal_invoices WHERE user_id = ? AND YEAR(created_at) = ?',
    [userId, year],
  );
  const seq = String(Number(row?.n || 0) + 1).padStart(4, '0');
  return `FAC-${year}-${seq}`;
}

async function loadDealForPayment(dealId) {
  return get(
    `SELECT d.*, c.name AS contact_name, c.email AS contact_email, c.phone AS contact_phone
     FROM crm_deals d
     JOIN contacts c ON c.id = d.contact_id
     WHERE d.id = ?`,
    [dealId],
  );
}

/**
 * Marca trámite como pagado, registra ingreso, genera factura PDF y envía email al cliente.
 * Idempotente: si ya existe factura para el deal, no duplica.
 */
export async function finalizeDealPayment(dealId, {
  amount,
  mpOrderId = null,
  paymentMethod = 'mercadopago',
  keepStage = null,
  notes = null,
} = {}) {
  const deal = await loadDealForPayment(dealId);
  if (!deal) throw new Error('Trámite no encontrado');

  const orgUserRow = await get('SELECT crm_stages FROM users WHERE id = ?', [deal.user_id]);
  const shouldKeepStage = keepStage ?? isPaymentStageId(deal.stage, orgUserRow?.crm_stages);

  const existingInvoice = await get('SELECT * FROM deal_invoices WHERE deal_id = ?', [dealId]);
  if (existingInvoice) {
    if (deal.payment_status !== 'paid') {
      if (shouldKeepStage) {
        await run("UPDATE crm_deals SET payment_status = 'paid' WHERE id = ?", [dealId]);
      } else {
        await run(
          "UPDATE crm_deals SET payment_status = 'paid', stage = 'completado', stage_changed_at = NOW() WHERE id = ?",
          [dealId],
        );
      }
      const refreshed = await get('SELECT stage FROM crm_deals WHERE id = ?', [dealId]);
      emitDealPaymentPaid({
        dealId,
        userId: deal.user_id,
        paymentStatus: 'paid',
        stage: refreshed?.stage || deal.stage,
      });
    }
    return existingInvoice;
  }

  const paidAmount = Number(amount ?? deal.estimated_value ?? 0);
  if (!paidAmount || paidAmount <= 0) {
    throw new Error('Monto de pago inválido');
  }

  if (shouldKeepStage) {
    await run(
      `UPDATE crm_deals
       SET payment_status = 'paid', mp_order_id = COALESCE(?, mp_order_id), mp_payment_token = NULL
       WHERE id = ?`,
      [mpOrderId, dealId],
    );
  } else {
    await run(
      `UPDATE crm_deals
       SET payment_status = 'paid', stage = 'completado', stage_changed_at = NOW(),
           mp_order_id = COALESCE(?, mp_order_id), mp_payment_token = NULL
       WHERE id = ?`,
      [mpOrderId, dealId],
    );
  }

  const methodLabel = paymentMethodLabel(paymentMethod);
  const finExists = await get(
    "SELECT id FROM fin_transactions WHERE deal_id = ? AND category = 'pago_tramite' LIMIT 1",
    [dealId],
  );
  if (!finExists) {
    const ref = mpOrderId ? mpOrderId.slice(-8) : `PAGO-${Date.now().toString().slice(-6)}`;
    const description = notes?.trim()
      ? `${methodLabel} - ${deal.title || 'Trámite'} (${notes.trim()})`
      : `${methodLabel} - ${deal.title || 'Trámite'}`;
    await run(
      `INSERT INTO fin_transactions (id, user_id, deal_id, type, amount, description, date, category, payment_method, referencia)
       VALUES (?, ?, ?, 'income', ?, ?, NOW(), 'pago_tramite', ?, ?)`,
      [
        uuid(),
        deal.user_id,
        dealId,
        paidAmount,
        description,
        paymentMethod,
        ref,
      ],
    );
  }

  const orgUser = await get(
    'SELECT id, name, email, logo_url, pdf_settings, role FROM users WHERE id = ?',
    [deal.user_id],
  );
  if (orgUser?.pdf_settings && typeof orgUser.pdf_settings === 'string') {
    try { orgUser.pdf_settings = JSON.parse(orgUser.pdf_settings); } catch { orgUser.pdf_settings = {}; }
  }

  const invoiceNumber = await nextInvoiceNumber(deal.user_id);
  const { filePath, pdfUrl } = await generateInvoicePdfFile({
    deal,
    orgUser,
    amount: paidAmount,
    invoiceNumber,
    paymentMethod,
    mpOrderId,
  });

  const invoiceId = uuid();
  await run(
    `INSERT INTO deal_invoices (id, deal_id, user_id, contact_email, invoice_number, amount, pdf_url, payment_method, mp_order_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      invoiceId,
      dealId,
      deal.user_id,
      deal.contact_email || '',
      invoiceNumber,
      paidAmount,
      pdfUrl,
      paymentMethod,
      mpOrderId,
    ],
  );

  if (deal.contact_email) {
    const panelUrl = (process.env.FRONTEND_URL || 'https://central.tramitesvehicularesdemexico.com').replace(/\/$/, '');
    const subject = `Comprobante de pago — ${deal.title || 'Trámite vehicular'}`;
    const text = `Tu pago de ${paidAmount} MXN fue recibido. Folio: ${invoiceNumber}. Consulta tu factura en ${panelUrl}/panel/cliente`;
    const html = `
      <p>Tu pago de <strong>${paidAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN</strong> fue recibido correctamente.</p>
      <p><strong>Trámite:</strong> ${deal.title || 'Trámite vehicular'}<br>
      <strong>Folio:</strong> ${invoiceNumber}</p>
      <p>Puedes ver y descargar tu comprobante en tu panel de cliente:</p>
      <p><a href="${panelUrl}/panel/cliente" style="color:#009ee3;font-weight:600;">Ir a mi panel</a></p>
    `;
    try {
      await sendEmail(
        deal.contact_email,
        subject,
        text,
        html,
        deal.user_id,
        [{ filename: `${invoiceNumber}.pdf`, path: filePath, contentType: 'application/pdf' }],
      );
    } catch (mailErr) {
      console.error('Invoice email error:', mailErr);
    }
  }

  emitDealPaymentPaid({
    dealId,
    userId: deal.user_id,
    paymentStatus: 'paid',
    stage: shouldKeepStage ? deal.stage : 'completado',
  });

  return get('SELECT * FROM deal_invoices WHERE id = ?', [invoiceId]);
}

/** Resuelve dealId desde mp_order_id o external_reference deal_{uuid} */
export async function resolveDealIdFromMpOrder(orderData) {
  const orderId = orderData?.id;
  if (orderId) {
    const byOrder = await get('SELECT id FROM crm_deals WHERE mp_order_id = ?', [orderId]);
    if (byOrder) return byOrder.id;
  }
  const ext = orderData?.external_reference || '';
  if (ext.startsWith('deal_')) {
    return ext.slice(5);
  }
  return null;
}

export async function isOrderPaid(orderData) {
  const status = orderData?.status;
  const statusDetail = orderData?.status_detail;
  const payment = orderData?.transactions?.payments?.[0];
  return status === 'processed'
    || status === 'approved'
    || statusDetail === 'accredited'
    || payment?.status_detail === 'accredited'
    || payment?.status === 'processed';
}
