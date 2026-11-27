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
import { emitChatMessage, emitUserNotification } from '../utils/socket-events.js';

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
    // El perito no debe ver el costo cobrado al cliente.
    estimatedValue: null,
    internalNotes: row.internal_notes || null,
    peritoPolizaStatus: row.perito_poliza_status || 'pendiente',
    peritoServiceCost: row.perito_service_cost != null ? Number(row.perito_service_cost) : null,
    peritoServicePaid: row.perito_service_paid === 'pagado' ? 'pagado' : 'pendiente',
    peritoServiceReceiptUrl: row.perito_service_receipt_url || null,
    peritoServiceReceiptName: row.perito_service_receipt_name || null,
    peritoAssignedAt: row.perito_assigned_at,
    peritoCompletedAt: row.perito_completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    contactName: row.contact_name || null,
  };
}

async function loadStaffMessages(dealId) {
  return query(
    `SELECT m.id, m.sender_id, m.message, m.file_url, m.created_at, m.channel,
            u.name AS sender_name, u.role AS sender_role
     FROM chat_messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.deal_id = ? AND m.channel = 'staff'
     ORDER BY m.created_at ASC`,
    [dealId],
  );
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

/** Papeles precargados en la cartera del vehículo (o de todos los autos del contacto). */
async function loadVehicleDocsForPeritoDeal(deal, orgId) {
  let vehicles = [];
  if (deal.vehicle_id) {
    const v = await get(
      `SELECT id, contact_id, plate, make, model, year
       FROM contact_vehicles WHERE id = ? AND user_id = ?`,
      [deal.vehicle_id, orgId],
    );
    if (v) vehicles = [v];
  }
  if (!vehicles.length && deal.contact_id) {
    vehicles = await query(
      `SELECT id, contact_id, plate, make, model, year
       FROM contact_vehicles WHERE contact_id = ? AND user_id = ? ORDER BY plate ASC`,
      [deal.contact_id, orgId],
    );
  }
  if (!vehicles.length) return [];

  // Trae papeles que estén en otra copia del mismo auto (misma placa / MMY) del cliente.
  for (const vehicle of vehicles) {
    try {
      const contact = await get(
        'SELECT email, phone, whatsapp FROM contacts WHERE id = ?',
        [vehicle.contact_id],
      );
      if (!contact) continue;
      const email = String(contact.email || '').trim().toLowerCase();
      const phoneDigits = String(contact.phone || contact.whatsapp || '').replace(/\D/g, '');
      if (!email && phoneDigits.length < 7) continue;

      const plate = String(vehicle.plate || '').trim().toUpperCase();
      const identityClauses = [];
      const identityParams = [];
      if (email) {
        identityClauses.push('LOWER(IFNULL(c.email,\'\')) = ?');
        identityParams.push(email);
      }
      if (phoneDigits.length >= 7) {
        identityClauses.push(
          `REPLACE(REPLACE(REPLACE(IFNULL(c.phone, c.whatsapp), ' ', ''), '-', ''), '+', '') LIKE ?`,
        );
        identityParams.push(`%${phoneDigits.slice(-10)}`);
      }

      let vehicleMatchSql;
      const vehicleMatchParams = [];
      if (plate) {
        vehicleMatchSql = `UPPER(IFNULL(cv.plate,'')) = ?`;
        vehicleMatchParams.push(plate);
      } else {
        vehicleMatchSql = `IFNULL(cv.plate,'') = '' AND IFNULL(cv.make,'') = ? AND IFNULL(cv.model,'') = ? AND IFNULL(cv.year,0) = ?`;
        vehicleMatchParams.push(vehicle.make || '', vehicle.model || '', Number(vehicle.year) || 0);
      }

      const siblings = await query(
        `SELECT cv.id, cv.user_id
         FROM contact_vehicles cv
         JOIN contacts c ON c.id = cv.contact_id
         WHERE (${identityClauses.join(' OR ')})
           AND ${vehicleMatchSql}`,
        [...identityParams, ...vehicleMatchParams],
      );
      if (siblings.length < 2) continue;

      const ids = siblings.map((s) => s.id);
      const placeholders = ids.map(() => '?').join(',');
      const docs = await query(
        `SELECT * FROM contact_vehicle_documents WHERE vehicle_id IN (${placeholders})`,
        ids,
      );
      const localUrls = new Set(
        docs.filter((d) => d.vehicle_id === vehicle.id).map((d) => String(d.file_url || '')),
      );
      for (const doc of docs) {
        const url = String(doc.file_url || '');
        if (!url || doc.vehicle_id === vehicle.id || localUrls.has(url)) continue;
        const docId = uuid();
        await run(
          `INSERT INTO contact_vehicle_documents (id, vehicle_id, user_id, uploaded_by_user_id, label, file_name, file_url)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            docId,
            vehicle.id,
            orgId,
            doc.uploaded_by_user_id || null,
            doc.label,
            doc.file_name,
            doc.file_url,
          ],
        );
        localUrls.add(url);
      }
    } catch (err) {
      console.error('perito vehicle doc sync', vehicle.id, err);
    }
  }

  const vehicleIds = vehicles.map((v) => v.id);
  const placeholders = vehicleIds.map(() => '?').join(',');
  const rows = await query(
    `SELECT cvd.id,
            COALESCE(NULLIF(cvd.label, ''), cvd.file_name) AS documentType,
            cvd.file_url AS fileUrl,
            cvd.file_name AS fileName,
            cvd.created_at AS createdAt,
            cv.plate AS vehiclePlate,
            cv.make AS vehicleMake,
            cv.model AS vehicleModel,
            cv.year AS vehicleYear
     FROM contact_vehicle_documents cvd
     JOIN contact_vehicles cv ON cv.id = cvd.vehicle_id
     WHERE cvd.vehicle_id IN (${placeholders}) AND cvd.user_id = ?
     ORDER BY cvd.created_at DESC`,
    [...vehicleIds, orgId],
  );

  // Deduplicar por URL por si el sync dejó copias equivalentes.
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = String(row.fileUrl || '');
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(row);
  }
  return out;
}

peritoRouter.get('/deals/:id', async (req, res) => {
  try {
    const deal = await loadPeritoDeal(req.user.id, req.params.id);
    if (!deal) return res.status(404).json({ error: 'Trámite no encontrado' });

    const orgId = req.user.parent_id;
    const [crmDocs, clientDocs, vehicleDocs, uploads, notes] = await Promise.all([
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
      loadVehicleDocsForPeritoDeal(deal, orgId),
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

    // Unifica docs del trámite + cartera del auto para que el perito vea lo precargado.
    const clientUrlSeen = new Set(clientDocs.map((d) => String(d.fileUrl || '')));
    const mergedClient = [
      ...clientDocs,
      ...vehicleDocs
        .filter((d) => {
          const url = String(d.fileUrl || '');
          if (url && clientUrlSeen.has(url)) return false;
          if (url) clientUrlSeen.add(url);
          return true;
        })
        .map((d) => ({
          id: d.id,
          documentType: d.documentType || d.fileName || 'Documento',
          fileUrl: d.fileUrl,
          status: 'vehicle',
          createdAt: d.createdAt,
          source: 'vehicle',
          vehiclePlate: d.vehiclePlate || null,
        })),
    ];

    res.json({
      deal: peritoDealRow(deal),
      documents: { gestor: crmDocs, client: mergedClient, vehicle: vehicleDocs },
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

peritoRouter.patch('/deals/:id/service-cost', async (req, res) => {
  try {
    const raw = req.body?.cost;
    const cost = raw === null || raw === '' || raw === undefined ? null : Number(raw);
    if (cost != null && (!Number.isFinite(cost) || cost < 0)) {
      return res.status(400).json({ error: 'Costo inválido' });
    }
    const deal = await loadPeritoDeal(req.user.id, req.params.id);
    if (!deal) return res.status(404).json({ error: 'Trámite no encontrado' });

    await run(
      'UPDATE crm_deals SET perito_service_cost = ?, updated_at = NOW() WHERE id = ? AND perito_id = ?',
      [cost, req.params.id, req.user.id],
    );

    notifyGestorPeritoUpdate(req.user.parent_id, {
      dealId: req.params.id,
      title: 'Costo de servicio',
      body: `${req.user.name || 'El perito'} actualizó el costo de servicio de "${deal.title}"`,
    });

    res.json({ ok: true, peritoServiceCost: cost });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar el costo' });
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
    const allowed = ['poliza_pago', 'tramite_listo'];
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

peritoRouter.get('/deals/:id/staff-messages', async (req, res) => {
  try {
    const deal = await loadPeritoDeal(req.user.id, req.params.id);
    if (!deal) return res.status(404).json({ error: 'Trámite no encontrado' });
    res.json(await loadStaffMessages(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

peritoRouter.post('/deals/:id/staff-messages', async (req, res) => {
  try {
    const deal = await loadPeritoDeal(req.user.id, req.params.id);
    if (!deal) return res.status(404).json({ error: 'Trámite no encontrado' });
    const { message, fileUrl } = req.body;
    if (!message && !fileUrl) return res.status(400).json({ error: 'Mensaje vacío' });

    const id = uuid();
    await run(
      `INSERT INTO chat_messages (id, deal_id, sender_id, message, file_url, channel)
       VALUES (?, ?, ?, ?, ?, 'staff')`,
      [id, req.params.id, req.user.id, message || null, fileUrl || null],
    );
    const saved = (await loadStaffMessages(req.params.id)).find((m) => m.id === id);
    emitChatMessage(req.params.id, { ...saved, channel: 'staff' });

    if (req.user.parent_id) {
      notifyGestorPeritoUpdate(req.user.parent_id, {
        dealId: req.params.id,
        title: 'Mensaje del perito',
        body: `${req.user.name || 'El perito'}: ${(message || 'Envió un archivo').substring(0, 100)}`,
      });
    }

    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

router.use('/', peritoRouter);

export default router;
