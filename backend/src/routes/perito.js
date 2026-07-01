/**
 * Panel del perito + gestión de peritos (rutas del titular gestor bajo /gestor/*)
 */
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { get, query, run } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { requireActiveSubscription } from '../middleware/subscription.js';
import {
  PERITO_STAGES, PERITO_STAGE_LABELS, isValidPeritoStage, peritoStagesForApi, PERITO_SUCCESS_STAGE,
} from '../crm/perito-stages.js';
import { emitUserNotification } from '../utils/socket-events.js';

/** Avisa al gestor (in-app, sin correo) que un perito actualizó un trámite. */
async function notifyGestorPeritoUpdate(gestorUserId, { dealId, title, body }) {
  try {
    const id = uuid();
    await run(
      'INSERT INTO notifications (id, user_id, type, title, body, ref_id) VALUES (?, ?, ?, ?, ?, ?)',
      [id, gestorUserId, 'perito_update', title, body, dealId],
    );
    emitUserNotification(gestorUserId, {
      id,
      type: 'perito_update',
      title,
      body,
      ref_id: dealId,
      is_read: 0,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error notificando actualización de perito:', err);
  }
}

const router = Router();

function peritoDealRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    stage: row.perito_stage || 'tramite',
    peritoStage: row.perito_stage || 'tramite',
    estimatedValue: Number(row.estimated_value || 0),
    internalNotes: row.internal_notes || null,
    peritoPolizaStatus: row.perito_poliza_status || 'pendiente',
    peritoAssignedAt: row.perito_assigned_at,
    peritoCompletedAt: row.perito_completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    contactName: row.contact_name || null,
  };
}

async function loadPeritoDeal(peritoUserId, dealId) {
  return get(
    `SELECT d.*, c.name AS contact_name
     FROM crm_deals d
     JOIN contacts c ON c.id = d.contact_id
     WHERE d.id = ? AND d.perito_id = ?`,
    [dealId, peritoUserId],
  );
}

async function orgSubscriptionOk(orgId) {
  const org = await get('SELECT status FROM users WHERE id = ?', [orgId]);
  return org && org.status === 'active';
}

// ── PERITO: panel ─────────────────────────────────────────

const peritoRouter = Router();
peritoRouter.use(authRequired, requireRole('perito'));

peritoRouter.use(async (req, res, next) => {
  if (!req.user.parent_id) {
    return res.status(403).json({ error: 'Cuenta de perito mal configurada' });
  }
  if (!await orgSubscriptionOk(req.user.parent_id)) {
    return res.status(402).json({ error: 'La gestoría no tiene suscripción activa', code: 'PENDING_PAYMENT' });
  }
  next();
});

peritoRouter.get('/stages', (_req, res) => {
  res.json(peritoStagesForApi());
});

peritoRouter.get('/deals', async (req, res) => {
  try {
    const rows = await query(
      `SELECT d.*, c.name AS contact_name
       FROM crm_deals d
       JOIN contacts c ON c.id = d.contact_id
       WHERE d.perito_id = ?
       ORDER BY d.updated_at DESC`,
      [req.user.id],
    );
    res.json({
      stages: peritoStagesForApi(),
      deals: rows.map(peritoDealRow),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar trámites' });
  }
});

peritoRouter.get('/deals/:id', async (req, res) => {
  try {
    const deal = await loadPeritoDeal(req.user.id, req.params.id);
    if (!deal) return res.status(404).json({ error: 'Trámite no encontrado' });

    const orgId = req.user.parent_id;
    const [crmDocs, clientDocs, uploads, notes] = await Promise.all([
      query(
        `SELECT id, file_name AS fileName, file_url AS fileUrl, notes, doc_kind AS docKind, created_at AS createdAt
         FROM crm_documents WHERE deal_id = ? AND user_id = ? ORDER BY created_at DESC`,
        [req.params.id, orgId],
      ),
      query(
        `SELECT id, document_type AS documentType, file_url AS fileUrl, status, created_at AS createdAt
         FROM deal_documents WHERE deal_id = ? ORDER BY created_at DESC`,
        [req.params.id],
      ),
      query(
        `SELECT id, doc_type AS docType, file_url AS fileUrl, file_name AS fileName, created_at AS createdAt
         FROM perito_deal_uploads WHERE deal_id = ? ORDER BY created_at DESC`,
        [req.params.id],
      ),
      query(
        `SELECT id, note, created_at AS createdAt FROM perito_deal_notes
         WHERE deal_id = ? ORDER BY created_at DESC`,
        [req.params.id],
      ),
    ]);

    res.json({
      deal: peritoDealRow(deal),
      documents: { gestor: crmDocs, client: clientDocs },
      uploads,
      notes,
      stageLabels: PERITO_STAGE_LABELS,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar trámite' });
  }
});

peritoRouter.patch('/deals/:id/stage', async (req, res) => {
  try {
    const { stage } = req.body;
    if (!isValidPeritoStage(stage)) return res.status(400).json({ error: 'Etapa inválida' });

    const deal = await loadPeritoDeal(req.user.id, req.params.id);
    if (!deal) return res.status(404).json({ error: 'Trámite no encontrado' });

    // La etapa «Póliza pagada» y las posteriores implican que la póliza ya se pagó;
    // sincronizamos el estatus de póliza con la etapa para que el gestor no vea
    // "pendiente" en el kanban cuando el perito ya avanzó más allá de ese punto.
    const polizaPagadaIdx = PERITO_STAGES.indexOf('poliza_pagada');
    const newStageIdx = PERITO_STAGES.indexOf(stage);
    const polizaStatus = newStageIdx >= polizaPagadaIdx ? 'pagado' : 'pendiente';

    const completedAt = stage === PERITO_SUCCESS_STAGE ? new Date() : null;
    await run(
      `UPDATE crm_deals SET perito_stage = ?, perito_poliza_status = ?, perito_completed_at = COALESCE(?, perito_completed_at), updated_at = NOW()
       WHERE id = ? AND perito_id = ?`,
      [stage, polizaStatus, completedAt, req.params.id, req.user.id],
    );

    notifyGestorPeritoUpdate(req.user.parent_id, {
      dealId: req.params.id,
      title: 'Actualización de perito',
      body: `${req.user.name || 'El perito'} movió "${deal.title}" (${deal.contact_name || 'cliente'}) a: ${PERITO_STAGE_LABELS[stage]}`,
    });

    res.json({ ok: true, peritoStage: stage, peritoPolizaStatus: polizaStatus, label: PERITO_STAGE_LABELS[stage] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar etapa' });
  }
});

peritoRouter.patch('/deals/:id/poliza-status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pendiente', 'pagado'].includes(status)) {
      return res.status(400).json({ error: 'Estatus inválido' });
    }
    const deal = await loadPeritoDeal(req.user.id, req.params.id);
    if (!deal) return res.status(404).json({ error: 'Trámite no encontrado' });

    await run(
      'UPDATE crm_deals SET perito_poliza_status = ?, updated_at = NOW() WHERE id = ? AND perito_id = ?',
      [status, req.params.id, req.user.id],
    );

    notifyGestorPeritoUpdate(req.user.parent_id, {
      dealId: req.params.id,
      title: 'Actualización de perito',
      body: `${req.user.name || 'El perito'} marcó la póliza de "${deal.title}" (${deal.contact_name || 'cliente'}) como ${status === 'pagado' ? 'pagada' : 'pendiente'}`,
    });

    res.json({ ok: true, peritoPolizaStatus: status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar póliza' });
  }
});

peritoRouter.post('/deals/:id/notes', async (req, res) => {
  try {
    const note = (req.body.note || '').trim();
    if (!note) return res.status(400).json({ error: 'Nota vacía' });
    const deal = await loadPeritoDeal(req.user.id, req.params.id);
    if (!deal) return res.status(404).json({ error: 'Trámite no encontrado' });

    const id = uuid();
    await run(
      'INSERT INTO perito_deal_notes (id, deal_id, perito_id, note) VALUES (?, ?, ?, ?)',
      [id, req.params.id, req.user.id, note],
    );
    res.status(201).json({ id, note, createdAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar nota' });
  }
});

peritoRouter.post('/deals/:id/uploads', async (req, res) => {
  try {
    const { docType, fileUrl, fileName } = req.body;
    const allowed = ['poliza_pago', 'tramite_listo', 'guia_paqueteria'];
    if (!allowed.includes(docType) || !fileUrl) {
      return res.status(400).json({ error: 'Tipo o archivo inválido' });
    }
    const deal = await loadPeritoDeal(req.user.id, req.params.id);
    if (!deal) return res.status(404).json({ error: 'Trámite no encontrado' });

    const id = uuid();
    await run(
      `INSERT INTO perito_deal_uploads (id, deal_id, perito_id, doc_type, file_url, file_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, req.params.id, req.user.id, docType, fileUrl, fileName || null],
    );
    res.status(201).json({ id, docType, fileUrl, fileName: fileName || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al subir archivo' });
  }
});

peritoRouter.delete('/uploads/:id', async (req, res) => {
  try {
    const result = await run(
      'DELETE FROM perito_deal_uploads WHERE id = ? AND perito_id = ?',
      [req.params.id, req.user.id],
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Archivo no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

router.use('/', peritoRouter);

export default router;
