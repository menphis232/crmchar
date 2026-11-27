import { Router } from 'express';
import { get, query, run } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { v4 as uuid } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
const router = Router();

import { pipelineStagesForUser } from '../crm/stages.js';
import { isDealClosed } from '../crm/deal-status.js';
import { emitChatMessage, emitUserNotification } from '../utils/socket-events.js';
import { maybeAutoReplyClientChat } from '../services/chat-auto-reply.js';
import {
  normalizeNextVerificationDate,
  normalizeVerificationHologram,
  vehicleRowWithVerification,
} from '../crm/verification-utils.js';
import { ensureClientUser, ensureClientVehicleContacts, empresaPrincipalUserId, isEmpresaSubuser } from '../crm/helpers.js';
import { clientContactPredicate, clientVehiclePredicate } from '../crm/client-match.js';
import { normalizeMxPhone } from '../utils/phone.js';
import {
  bannerToClientDto,
  filterBannersForAudience,
  loadPanelClienteSettings,
  promoBannersFromSettings,
  resolveClientPromoAudience,
} from '../utils/client-promo-banners.js';

async function hydrateClientUser(user) {
  if (!user?.id) return user;
  const needsPhone = !normalizeMxPhone(user.phone);
  const needsProfile = user.profile_type === undefined || user.parent_id === undefined;
  if (!needsPhone && !needsProfile) return user;
  const row = await get(
    'SELECT email, phone, profile_type, parent_id, name FROM users WHERE id = ?',
    [user.id],
  );
  if (!row) return user;
  return {
    ...user,
    email: row.email || user.email,
    phone: row.phone || user.phone,
    profile_type: row.profile_type ?? user.profile_type,
    parent_id: row.parent_id ?? user.parent_id,
    name: row.name || user.name,
  };
}

async function predicateFor(user) {
  user = await hydrateClientUser(user);
  return clientContactPredicate(user);
}

async function vehiclePredicateFor(user) {
  user = await hydrateClientUser(user);
  return clientVehiclePredicate(user);
}

async function isEmpresaPrincipal(user) {
  user = await hydrateClientUser(user);
  if (user?.parent_id) return false;
  const principalId = empresaPrincipalUserId(user);
  if (!principalId) return false;
  const empresa = await get(
    `SELECT id FROM contacts
     WHERE empresa_user_id = ? AND IFNULL(person_type, 'fisica') = 'moral'
     LIMIT 1`,
    [principalId],
  ).catch(() => null);
  return !!empresa;
}

const DEFAULT_REQUIRED_DOCS = ['INE', 'Tarjeta de Circulación', 'Factura de Origen'];

/** Match servicio↔deal aunque el título sea más corto (ej. "BAJA DE PLACAS" vs "BAJA DE PLACAS CDMX | …").
 *  Prefiere el catálogo del gestor dueño; si el deal es de concesionaria sin gestor, busca por título global. */
const SERVICE_TITLE_MATCH = `
  (
    TRIM(gs2.name) = TRIM(d.title)
    OR TRIM(gs2.name) LIKE CONCAT(TRIM(d.title), ' %')
    OR TRIM(gs2.name) LIKE CONCAT(TRIM(d.title), '|%')
    OR TRIM(gs2.name) LIKE CONCAT(TRIM(d.title), ' |%')
    OR TRIM(d.title) LIKE CONCAT(TRIM(gs2.name), '%')
  )
`;

const SERVICE_MATCH_SQL = `
  SELECT gs2.id FROM gestor_services gs2
  WHERE ${SERVICE_TITLE_MATCH}
    AND (
      (g.id IS NOT NULL AND gs2.gestor_id = g.id)
      OR (g.id IS NULL AND gs2.image_url IS NOT NULL AND gs2.image_url <> '')
    )
  ORDER BY
    (g.id IS NOT NULL AND gs2.gestor_id = g.id) DESC,
    (TRIM(gs2.name) = TRIM(d.title)) DESC,
    (gs2.image_url IS NOT NULL AND gs2.image_url <> '') DESC,
    LENGTH(TRIM(gs2.name)) ASC
  LIMIT 1
`;

const DEALS_SELECT = `
  SELECT d.id, d.title, d.stage, d.estimated_value as price, d.created_at, d.updated_at,
         COALESCE(g.name, u.name) as gestor_name, d.deal_type, d.tracking_code,
         d.payment_status, gs.required_documents, gs.image_url as service_image_url,
         u.role as owner_role, u.crm_stages,
         di.id as invoice_id, di.invoice_number, di.pdf_url as invoice_pdf_url,
         di.amount as invoice_amount, di.created_at as invoice_date
  FROM crm_deals d
  JOIN contacts c ON c.id = d.contact_id
  LEFT JOIN users u ON u.id = d.user_id
  LEFT JOIN gestores g ON g.user_id = COALESCE(u.parent_id, u.id)
  LEFT JOIN gestor_services gs ON gs.id = (${SERVICE_MATCH_SQL})
  LEFT JOIN deal_invoices di ON di.deal_id = d.id
`;

function mapDealRow(d) {
  try {
    d.required_documents = typeof d.required_documents === 'string'
      ? JSON.parse(d.required_documents)
      : (d.required_documents || DEFAULT_REQUIRED_DOCS);
  } catch {
    d.required_documents = DEFAULT_REQUIRED_DOCS;
  }
  d.pipeline_stages = pipelineStagesForUser(d.owner_role || 'gestor', d.crm_stages);
  d.is_closed = isDealClosed(d);
  delete d.crm_stages;
  delete d.owner_role;
  return d;
}

async function fetchClientDeals(user) {
  const match = await predicateFor(user);
  const rows = await query(`${DEALS_SELECT} WHERE ${match.sql} ORDER BY d.updated_at DESC`, match.params);
  return rows.map(mapDealRow);
}

async function clientOwnsDeal(user, dealId) {
  const match = await predicateFor(user);
  const row = await get(
    `SELECT d.id FROM crm_deals d
     JOIN contacts c ON c.id = d.contact_id
     WHERE d.id = ? AND ${match.sql}`,
    [dealId, ...match.params],
  );
  return !!row;
}

// Stats for dashboard
router.get('/deals/stats', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const deals = await fetchClientDeals(req.user);
    const active = deals.filter(d => !d.is_closed).length;
    const closed = deals.filter(d => d.is_closed).length;
    res.json({ total: deals.length, active, closed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Get deals — supports ?status=active|closed|all&page=1&limit=10&q=search
router.get('/deals', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const { status = 'all', q = '' } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const search = String(q).trim().toLowerCase();

    let deals = await fetchClientDeals(req.user);

    if (status === 'active') deals = deals.filter(d => !d.is_closed);
    else if (status === 'closed') deals = deals.filter(d => d.is_closed);

    if (search) {
      deals = deals.filter(d =>
        (d.title || '').toLowerCase().includes(search)
        || (d.gestor_name || '').toLowerCase().includes(search)
        || (d.tracking_code || '').toLowerCase().includes(search)
        || (d.stage || '').toLowerCase().includes(search),
      );
    }

    const total = deals.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const items = deals.slice(offset, offset + limit);

    res.json({ items, total, page, limit, totalPages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener trámites' });
  }
});

// Get chat messages for a deal
router.get('/deals/:id/messages', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    if (!await clientOwnsDeal(req.user, req.params.id)) {
      return res.status(404).json({ error: 'Trámite no encontrado' });
    }
    const messages = await query(`
      SELECT m.id, m.sender_id, m.message, m.file_url, m.created_at, m.channel,
             u.name as sender_name, u.role as sender_role
      FROM chat_messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.deal_id = ? AND COALESCE(m.channel, 'client') = 'client'
      ORDER BY m.created_at ASC
    `, [req.params.id]);
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

// Send a chat message
router.post('/deals/:id/messages', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    if (!await clientOwnsDeal(req.user, req.params.id)) {
      return res.status(404).json({ error: 'Trámite no encontrado' });
    }
    const { message, fileUrl } = req.body;
    if (!message && !fileUrl) {
      return res.status(400).json({ error: 'Mensaje vacío' });
    }
    
    const id = uuid();
    await run(`
      INSERT INTO chat_messages (id, deal_id, sender_id, message, file_url, channel)
      VALUES (?, ?, ?, ?, ?, 'client')
    `, [id, req.params.id, req.user.id, message || null, fileUrl || null]);
    
    const saved = await get(`
      SELECT m.id, m.sender_id, m.message, m.file_url, m.created_at, m.channel,
             u.name as sender_name, u.role as sender_role
      FROM chat_messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.id = ?
    `, [id]);
    
    // Notificar al gestor y actualizar chat en tiempo real
    const deal = await get('SELECT user_id, title FROM crm_deals WHERE id = ?', [req.params.id]);
    if (deal?.user_id) {
      const notifId = uuid();
      const title = 'Nuevo mensaje del Cliente';
      const body = message ? message.substring(0, 100) : 'El cliente envió un archivo.';
      await run(`INSERT INTO notifications (id, user_id, type, title, body, ref_id) VALUES (?, ?, 'new_message', ?, ?, ?)`,
        [notifId, deal.user_id, title, body, req.params.id]);

      emitUserNotification(deal.user_id, {
        id: notifId,
        type: 'new_message',
        title,
        body,
        ref_id: req.params.id,
        is_read: 0,
        created_at: new Date().toISOString(),
      });
    }
    emitChatMessage(req.params.id, saved);

    if (deal?.user_id) {
      setImmediate(() => {
        maybeAutoReplyClientChat(req.params.id, deal.user_id, req.user.id).catch(() => {});
      });
    }

    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

// List all invoices for the client
router.get('/invoices', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const match = await predicateFor(req.user);
    const invoices = await query(`
      SELECT i.id, i.invoice_number, i.amount, i.pdf_url, i.payment_method, i.created_at,
             d.id as deal_id, d.title as deal_title, g.name as gestor_name
      FROM deal_invoices i
      JOIN crm_deals d ON d.id = i.deal_id
      JOIN contacts c ON c.id = d.contact_id
      LEFT JOIN gestores g ON g.user_id = d.user_id
      WHERE ${match.sql}
      ORDER BY i.created_at DESC
    `, match.params);
    res.json(invoices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener facturas' });
  }
});

// Download invoice PDF (authenticated)
router.get('/invoices/:id/download', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const match = await predicateFor(req.user);
    const invoice = await get(
      `SELECT i.*, d.title as deal_title
       FROM deal_invoices i
       JOIN crm_deals d ON d.id = i.deal_id
       JOIN contacts c ON c.id = d.contact_id
       WHERE i.id = ? AND ${match.sql}`,
      [req.params.id, ...match.params],
    );
    if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' });

    const filename = path.basename(invoice.pdf_url);
    const filePath = path.join(uploadDir, 'invoices', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo PDF no encontrado' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al descargar factura' });
  }
});

// Invoice for a specific deal
router.get('/deals/:id/invoice', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    if (!await clientOwnsDeal(req.user, req.params.id)) {
      return res.status(404).json({ error: 'Trámite no encontrado' });
    }
    const invoice = await get(
      `SELECT id, invoice_number, amount, pdf_url, payment_method, created_at
       FROM deal_invoices WHERE deal_id = ?`,
      [req.params.id],
    );
    if (!invoice) return res.status(404).json({ error: 'Sin factura' });
    res.json(invoice);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener factura' });
  }
});

// Get documents for a deal
router.get('/deals/:id/documents', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    if (!await clientOwnsDeal(req.user, req.params.id)) {
      return res.status(404).json({ error: 'Trámite no encontrado' });
    }
    const clientDocs = await query('SELECT * FROM deal_documents WHERE deal_id = ? ORDER BY created_at DESC', [req.params.id]);
    const deliveryDocs = await query(
      `SELECT id, deal_id, file_name, file_url, notes, doc_kind, created_at
       FROM crm_documents
       WHERE deal_id = ? AND doc_kind IN ('entrega', 'envio')
       ORDER BY created_at DESC`,
      [req.params.id],
    );
    const mappedGestorDocs = deliveryDocs.map((d) => ({
      id: d.id,
      deal_id: d.deal_id,
      document_type: d.doc_kind === 'envio' ? (d.file_name || 'Guía de envío') : d.file_name,
      file_url: d.file_url,
      status: 'approved',
      source: d.doc_kind === 'envio' ? 'gestor_envio' : 'gestor_entrega',
      doc_kind: d.doc_kind,
      notes: d.notes,
      created_at: d.created_at,
    }));
    res.json([...mappedGestorDocs, ...clientDocs]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener documentos' });
  }
});

// Upload a document and perform OCR
router.post('/deals/:id/documents', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    if (!await clientOwnsDeal(req.user, req.params.id)) {
      return res.status(404).json({ error: 'Trámite no encontrado' });
    }
    const { documentType, fileUrl } = req.body;
    if (!documentType || !fileUrl) return res.status(400).json({ error: 'Datos incompletos' });

    const docId = uuid();
    let extractedData = null;

    // OCR Logic
    const deal = await get('SELECT user_id FROM crm_deals WHERE id = ?', [req.params.id]);
    if (deal) {
      const user = await get('SELECT ai_provider, ai_api_key FROM users WHERE id = ?', [deal.user_id]);
      const admin = await get("SELECT ai_provider, ai_api_key FROM users WHERE role = 'admin' LIMIT 1");
      
      const provider = user?.ai_provider || admin?.ai_provider || 'gemini';
      const apiKey = user?.ai_api_key || admin?.ai_api_key;

      if (provider === 'gemini' && apiKey) {
        try {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const genAI = new GoogleGenerativeAI(apiKey);
          const modelsToTry = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-pro-latest'];
          
          const filename = fileUrl.split('/').pop();
          const filePath = path.join(__dirname, '..', '..', 'uploads', filename);
          
          if (fs.existsSync(filePath)) {
            const fileData = fs.readFileSync(filePath);
            const ext = filename.split('.').pop().toLowerCase();
            const mimeType = ext === 'pdf' ? 'application/pdf' :
                             (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' :
                             ext === 'webp' ? 'image/webp' : 'image/png';

            const imagePart = {
              inlineData: { data: fileData.toString('base64'), mimeType }
            };
            
            const prompt = `Extrae la información principal de este documento (${documentType}). Adicionalmente, analiza detalladamente la imagen para determinar si parece un documento físico real y auténtico (evalúa textura, bordes, iluminación natural, hologramas, reflejos) o si parece falso, alterado digitalmente o una captura de pantalla.
Devuelve SOLO un JSON válido con las claves en formato camelCase (ej: nombre, fechaNacimiento, curp, rfc, numeroIdentificacion, placas, niv, marca, modelo). INCLUYE obligatoriamente dos campos extras:
"esDocumentoFalso": (boolean) true si parece falso, captura de pantalla o montaje; false si parece un documento físico legítimo.
"analisisAutenticidad": (string) Breve explicación de por qué consideras que la imagen es de un documento real o falso.
No incluyas markdown como \`\`\`json.`;
            
            let resultObj = null;
            let lastError;
            for (const modelName of modelsToTry) {
              try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent([prompt, imagePart]);
                const responseText = result.response.text().trim().replace(/^```json/g, '').replace(/```$/g, '').trim();
                resultObj = JSON.parse(responseText);
                break;
              } catch (err) {
                lastError = err;
                continue;
              }
            }
            
            if (!resultObj && lastError) throw lastError;
            extractedData = resultObj;
          }
        } catch (ocrErr) {
          console.error('OCR Error:', ocrErr);
        }
      }
    }

    await run(`
      INSERT INTO deal_documents (id, deal_id, document_type, file_url, status, extracted_data)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `, [docId, req.params.id, documentType, fileUrl, extractedData ? JSON.stringify(extractedData) : null]);

    // También a la cartera del vehículo del trámite (todas las copias del mismo auto).
    try {
      const dealVehicle = await get(
        'SELECT vehicle_id FROM crm_deals WHERE id = ?',
        [req.params.id],
      );
      if (dealVehicle?.vehicle_id && await clientOwnsVehicle(req.user, dealVehicle.vehicle_id)) {
        const siblings = await siblingVehiclesForClient(req.user, dealVehicle.vehicle_id);
        if (siblings.length) {
          const ext = (fileUrl || '').match(/\.[a-z0-9]{2,5}($|\?)/i)?.[0]?.replace('?', '') || '';
          await insertVehicleDocumentCopies({
            siblings,
            uploadedByUserId: req.user.id,
            label: String(documentType || 'Documento').trim() || 'Documento',
            fileName: `${String(documentType || 'documento').trim()}${ext}`,
            fileUrl,
          });
        }
      }
    } catch (syncErr) {
      console.error('No se pudo copiar documento del trámite a la cartera del vehículo:', syncErr);
    }

    const newDoc = await get('SELECT * FROM deal_documents WHERE id = ?', [docId]);
    res.status(201).json(newDoc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar documento' });
  }
});

// ── Billetera de documentos personales ──────────────────

function unifiedWalletRow(row) {
  return {
    id: row.id,
    source: 'wallet',
    label: row.label,
    category: row.category,
    file_url: row.file_url,
    notes: row.notes,
    created_at: row.created_at,
    vehicleId: null,
    vehiclePlate: null,
    vehicleName: null,
  };
}

function unifiedVehicleWalletRow(row) {
  const vehicleName = [row.make, row.model, row.year].filter(Boolean).join(' ');
  return {
    id: row.id,
    source: 'vehicle',
    label: row.label || row.file_name,
    category: 'Vehículo',
    file_url: row.file_url,
    notes: null,
    created_at: row.created_at,
    vehicleId: row.vehicle_id,
    vehiclePlate: row.plate,
    vehicleName: vehicleName || null,
  };
}

async function unifiedWalletDocuments(user) {
  const match = await vehiclePredicateFor(user);
  const personal = await query(
    'SELECT * FROM client_wallet_documents WHERE user_id = ? ORDER BY created_at DESC',
    [user.id],
  );
  const vehicleDocs = await query(
    `SELECT cvd.*, cv.plate, cv.make, cv.model, cv.year
     FROM contact_vehicle_documents cvd
     JOIN contact_vehicles cv ON cv.id = cvd.vehicle_id
     JOIN contacts c ON c.id = cv.contact_id
     WHERE ${match.sql}
     ORDER BY cvd.created_at DESC`,
    match.params,
  );

  const items = [
    ...personal.map(unifiedWalletRow),
    ...vehicleDocs.map(unifiedVehicleWalletRow),
  ];
  items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return items;
}

router.get('/wallet', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    res.json(await unifiedWalletDocuments(req.user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener documentos' });
  }
});

router.post('/wallet', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const { label, category, fileUrl, notes } = req.body;
    if (!label?.trim() || !fileUrl) {
      return res.status(400).json({ error: 'Nombre y archivo requeridos' });
    }
    const id = uuid();
    await run(
      `INSERT INTO client_wallet_documents (id, user_id, label, category, file_url, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, label.trim(), category?.trim() || 'Otro', fileUrl, notes?.trim() || null],
    );
    const doc = await get('SELECT * FROM client_wallet_documents WHERE id = ?', [id]);
    res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar documento' });
  }
});

router.delete('/wallet/:id', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const doc = await get(
      'SELECT id FROM client_wallet_documents WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id],
    );
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
    await run('DELETE FROM client_wallet_documents WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar documento' });
  }
});

router.post('/wallet/:id/associate', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const { vehicleId } = req.body;
    if (!vehicleId) {
      return res.status(400).json({ error: 'Selecciona un vehículo' });
    }
    if (!await clientOwnsVehicle(req.user, vehicleId)) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const walletDoc = await get(
      'SELECT * FROM client_wallet_documents WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id],
    );
    if (!walletDoc) return res.status(404).json({ error: 'Documento no encontrado' });

    const siblings = await siblingVehiclesForClient(req.user, vehicleId);
    if (!siblings.length) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    const ext = (walletDoc.file_url || '').match(/\.[a-z0-9]{2,5}($|\?)/i)?.[0]?.replace('?', '') || '';
    const fileName = `${walletDoc.label}${ext}`;

    const inserted = await insertVehicleDocumentCopies({
      siblings,
      uploadedByUserId: req.user.id,
      label: walletDoc.label,
      fileName,
      fileUrl: walletDoc.file_url,
    });
    await run('DELETE FROM client_wallet_documents WHERE id = ?', [req.params.id]);

    const row = await get(
      `SELECT cvd.*, cv.plate, cv.make, cv.model, cv.year
       FROM contact_vehicle_documents cvd
       JOIN contact_vehicles cv ON cv.id = cvd.vehicle_id
       WHERE cvd.id = ?`,
      [inserted.id],
    );
    res.status(201).json(unifiedVehicleWalletRow(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al asociar documento' });
  }
});

async function clientOwnsVehicle(user, vehicleId) {
  const match = await vehiclePredicateFor(user);
  const row = await get(
    `SELECT cv.id FROM contact_vehicles cv
     JOIN contacts c ON c.id = cv.contact_id
     WHERE cv.id = ? AND ${match.sql}`,
    [vehicleId, ...match.params],
  );
  return !!row;
}

function dedupeVehiclesByPlate(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = String(row.plate || '').toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(vehicleRowWithVerification(row));
  }
  return out;
}

function vehicleDocumentRow(row) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    label: row.label,
    fileName: row.file_name,
    fileUrl: row.file_url,
    createdAt: row.created_at,
  };
}

async function vehiclesWithDocuments(user, filters = {}) {
  const match = await vehiclePredicateFor(user);
  const where = [match.sql];
  const params = [...match.params];

  const plateQ = String(filters.plate || '').trim().toUpperCase();
  if (plateQ) {
    where.push(`UPPER(IFNULL(cv.plate,'')) LIKE ?`);
    params.push(`%${plateQ}%`);
  }
  const stateQ = String(filters.state || '').trim();
  if (stateQ) {
    where.push(`cv.state = ?`);
    params.push(stateQ);
  }

  const rows = await query(
    `SELECT cv.* FROM contact_vehicles cv
     JOIN contacts c ON c.id = cv.contact_id
     WHERE ${where.join(' AND ')}
     ORDER BY cv.updated_at DESC, cv.created_at DESC`,
    params,
  );
  const vehicles = dedupeVehiclesByPlate(rows);
  const ids = vehicles.map((v) => v.id);
  if (!ids.length) return vehicles;

  // Reparte papeles entre copias del mismo auto (p. ej. varias gestorías).
  for (const id of ids) {
    try {
      await syncSiblingVehicleDocuments(user, id);
    } catch (syncErr) {
      console.error('syncSiblingVehicleDocuments', id, syncErr);
    }
  }

  const placeholders = ids.map(() => '?').join(',');
  const hydrated = await hydrateClientUser(user);
  const docsParams = [...ids];
  let docsSql = `SELECT * FROM contact_vehicle_documents WHERE vehicle_id IN (${placeholders})`;
  // Subusuario: solo documentos propios o de sus vehículos asignados (ya filtrados arriba)
  if (isEmpresaSubuser(hydrated)) {
    docsSql += ` AND (uploaded_by_user_id = ? OR uploaded_by_user_id IS NULL)`;
    docsParams.push(hydrated.id);
  }
  docsSql += ` ORDER BY created_at DESC`;
  const docs = await query(docsSql, docsParams);
  const byVehicle = {};
  for (const doc of docs) {
    if (!byVehicle[doc.vehicle_id]) byVehicle[doc.vehicle_id] = [];
    byVehicle[doc.vehicle_id].push(vehicleDocumentRow(doc));
  }
  return vehicles.map((v) => ({ ...v, documents: byVehicle[v.id] || [] }));
}

router.get('/vehicles', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    res.json(await vehiclesWithDocuments(req.user, {
      plate: req.query.plate,
      state: req.query.state,
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar vehículos' });
  }
});

router.post('/vehicles', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const {
      plate, make, model, year, state, engomadoColor, vehicleNotes,
      insuranceExpiry, tenenciaStatus, verificationHologram, nextVerificationDate,
      circulationCardName,
    } = req.body;
    if (!make?.trim() || !model?.trim() || year == null || year === '') {
      return res.status(400).json({ error: 'Selecciona marca, submarca y año' });
    }
    const insExpiry = insuranceExpiry && String(insuranceExpiry).trim() ? String(insuranceExpiry).slice(0, 10) : null;
    const tenencia = ['si', 'no', 'pendiente'].includes(tenenciaStatus) ? tenenciaStatus : null;
    const tenenciaYear = tenencia ? new Date().getFullYear() : null;
    const hologram = normalizeVerificationHologram(verificationHologram);
    const nextVerDate = normalizeNextVerificationDate(nextVerificationDate);
    const circName = circulationCardName?.trim() || null;

    const contacts = await ensureClientVehicleContacts(req.user);
    if (!contacts.length) {
      return res.status(400).json({
        error: 'No se pudo preparar tu perfil para registrar el vehículo.',
      });
    }

    const actor = await hydrateClientUser(req.user);
    const assignedUserId = isEmpresaSubuser(actor) ? actor.id : (req.body.assignedUserId || null);
    const createdBy = actor.id;

    let firstRow = null;
    for (const contact of contacts) {
      const id = uuid();
      await run(`
        INSERT INTO contact_vehicles (
          id, contact_id, user_id, assigned_user_id, created_by_user_id,
          plate, circulation_card_name, make, model, year, state, engomado_color, vehicle_notes,
          insurance_expiry, tenencia_2026, tenencia_year, verification_hologram, next_verification_date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, contact.id, contact.user_id,
        assignedUserId,
        createdBy,
        String(plate || '').trim().toUpperCase(),
        circName,
        make.trim(),
        model.trim(),
        Number(year),
        state || null,
        engomadoColor || null,
        vehicleNotes || null,
        insExpiry,
        tenencia,
        tenenciaYear,
        hologram,
        nextVerDate,
      ]);
      if (!firstRow) {
        firstRow = await get('SELECT * FROM contact_vehicles WHERE id = ?', [id]);
      }
    }

    res.status(201).json(vehicleRowWithVerification(firstRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agregar vehículo' });
  }
});

router.patch('/vehicles/:id', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    if (!await clientOwnsVehicle(req.user, req.params.id)) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const {
      plate, make, model, year, state, engomadoColor, vehicleNotes,
      insuranceExpiry, tenenciaStatus, verificationHologram, nextVerificationDate,
      circulationCardName,
    } = req.body;
    const row = await get('SELECT plate FROM contact_vehicles WHERE id = ?', [req.params.id]);
    const plateKey = plate ? String(plate).trim().toUpperCase() : row?.plate;

    const insExpiry = insuranceExpiry !== undefined
      ? (insuranceExpiry && String(insuranceExpiry).trim() ? String(insuranceExpiry).slice(0, 10) : null)
      : undefined;
    const tenencia = tenenciaStatus !== undefined
      ? (['si', 'no', 'pendiente'].includes(tenenciaStatus) ? tenenciaStatus : null)
      : undefined;
    const tenenciaYear = tenencia !== undefined ? (tenencia ? new Date().getFullYear() : null) : undefined;
    const hologram = verificationHologram !== undefined
      ? normalizeVerificationHologram(verificationHologram)
      : undefined;
    const nextVerDate = nextVerificationDate !== undefined
      ? normalizeNextVerificationDate(nextVerificationDate)
      : undefined;
    const circName = circulationCardName !== undefined
      ? (circulationCardName && String(circulationCardName).trim() ? String(circulationCardName).trim() : null)
      : undefined;
    const match = await vehiclePredicateFor(req.user);

    await run(
      `UPDATE contact_vehicles cv
       JOIN contacts c ON c.id = cv.contact_id
       SET cv.plate = COALESCE(?, cv.plate),
           cv.make = COALESCE(?, cv.make),
           cv.model = COALESCE(?, cv.model),
           cv.year = COALESCE(?, cv.year),
           cv.state = COALESCE(?, cv.state),
           cv.engomado_color = COALESCE(?, cv.engomado_color),
           cv.vehicle_notes = COALESCE(?, cv.vehicle_notes),
           cv.insurance_expiry = ${insExpiry !== undefined ? '?' : 'cv.insurance_expiry'},
           cv.tenencia_2026 = ${tenencia !== undefined ? '?' : 'cv.tenencia_2026'},
           cv.tenencia_year = ${tenenciaYear !== undefined ? '?' : 'cv.tenencia_year'},
           cv.verification_hologram = ${hologram !== undefined ? '?' : 'cv.verification_hologram'},
           cv.next_verification_date = ${nextVerDate !== undefined ? '?' : 'cv.next_verification_date'},
           cv.circulation_card_name = ${circName !== undefined ? '?' : 'cv.circulation_card_name'},
           cv.updated_at = NOW()
       WHERE ${match.sql} AND UPPER(cv.plate) = UPPER(?)`,
      [
        plate ? String(plate).trim().toUpperCase() : null,
        make ?? null,
        model ?? null,
        year != null && year !== '' ? Number(year) : null,
        state ?? null,
        engomadoColor ?? null,
        vehicleNotes ?? null,
        ...(insExpiry !== undefined ? [insExpiry] : []),
        ...(tenencia !== undefined ? [tenencia] : []),
        ...(tenenciaYear !== undefined ? [tenenciaYear] : []),
        ...(hologram !== undefined ? [hologram] : []),
        ...(nextVerDate !== undefined ? [nextVerDate] : []),
        ...(circName !== undefined ? [circName] : []),
        ...match.params,
        plateKey,
      ],
    );

    const updated = await get('SELECT * FROM contact_vehicles WHERE id = ?', [req.params.id]);
    res.json(vehicleRowWithVerification(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar vehículo' });
  }
});

router.delete('/vehicles/:id', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    if (!await clientOwnsVehicle(req.user, req.params.id)) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const row = await get('SELECT plate FROM contact_vehicles WHERE id = ?', [req.params.id]);
    const match = await vehiclePredicateFor(req.user);
    await run(
      `DELETE cv FROM contact_vehicles cv
       JOIN contacts c ON c.id = cv.contact_id
       WHERE ${match.sql} AND UPPER(cv.plate) = UPPER(?)`,
      [...match.params, row.plate],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar vehículo' });
  }
});

/** Todas las filas contact_vehicles del cliente que representan el mismo auto (mismo plate o MMY sin placa). */
async function siblingVehiclesForClient(user, vehicleId) {
  const match = await vehiclePredicateFor(user);
  const vehicle = await get(
    `SELECT cv.* FROM contact_vehicles cv
     JOIN contacts c ON c.id = cv.contact_id
     WHERE cv.id = ? AND ${match.sql}`,
    [vehicleId, ...match.params],
  );
  if (!vehicle) return [];

  const plate = String(vehicle.plate || '').trim().toUpperCase();
  if (plate) {
    return query(
      `SELECT cv.id, cv.user_id FROM contact_vehicles cv
       JOIN contacts c ON c.id = cv.contact_id
       WHERE ${match.sql} AND UPPER(IFNULL(cv.plate,'')) = ?`,
      [...match.params, plate],
    );
  }

  return query(
    `SELECT cv.id, cv.user_id FROM contact_vehicles cv
     JOIN contacts c ON c.id = cv.contact_id
     WHERE ${match.sql}
       AND IFNULL(cv.plate,'') = ''
       AND IFNULL(cv.make,'') = ?
       AND IFNULL(cv.model,'') = ?
       AND IFNULL(cv.year,0) = ?`,
    [...match.params, vehicle.make || '', vehicle.model || '', Number(vehicle.year) || 0],
  );
}

async function insertVehicleDocumentCopies({ siblings, uploadedByUserId, label, fileName, fileUrl }) {
  let firstRow = null;
  for (const sibling of siblings) {
    const docId = uuid();
    await run(
      `INSERT INTO contact_vehicle_documents (id, vehicle_id, user_id, uploaded_by_user_id, label, file_name, file_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [docId, sibling.id, sibling.user_id, uploadedByUserId, label, fileName, fileUrl],
    );
    if (!firstRow) {
      firstRow = await get('SELECT * FROM contact_vehicle_documents WHERE id = ?', [docId]);
    }
  }
  return firstRow;
}

/** Copia docs faltantes entre filas del mismo auto (arregla papeles que solo estaban en una gestoría). */
async function syncSiblingVehicleDocuments(user, vehicleId) {
  const siblings = await siblingVehiclesForClient(user, vehicleId);
  if (siblings.length < 2) return;
  const ids = siblings.map((s) => s.id);
  const placeholders = ids.map(() => '?').join(',');
  const docs = await query(
    `SELECT * FROM contact_vehicle_documents WHERE vehicle_id IN (${placeholders})`,
    ids,
  );
  if (!docs.length) return;

  const byVehicle = new Map(ids.map((id) => [id, new Set()]));
  for (const doc of docs) {
    byVehicle.get(doc.vehicle_id)?.add(String(doc.file_url || ''));
  }

  const siblingById = new Map(siblings.map((s) => [s.id, s]));
  for (const doc of docs) {
    const url = String(doc.file_url || '');
    if (!url) continue;
    for (const sibling of siblings) {
      if (sibling.id === doc.vehicle_id) continue;
      if (byVehicle.get(sibling.id)?.has(url)) continue;
      const docId = uuid();
      await run(
        `INSERT INTO contact_vehicle_documents (id, vehicle_id, user_id, uploaded_by_user_id, label, file_name, file_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          docId,
          sibling.id,
          sibling.user_id,
          doc.uploaded_by_user_id || user.id,
          doc.label,
          doc.file_name,
          doc.file_url,
        ],
      );
      byVehicle.get(sibling.id)?.add(url);
    }
  }
  return siblingById;
}

router.post('/vehicles/:id/documents', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    if (!await clientOwnsVehicle(req.user, req.params.id)) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const { fileName, fileUrl, label } = req.body;
    if (!fileName || !fileUrl) {
      return res.status(400).json({ error: 'Faltan datos del documento' });
    }

    const siblings = await siblingVehiclesForClient(req.user, req.params.id);
    if (!siblings.length) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    const row = await insertVehicleDocumentCopies({
      siblings,
      uploadedByUserId: req.user.id,
      label: label?.trim() || null,
      fileName,
      fileUrl,
    });
    res.status(201).json(vehicleDocumentRow(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar documento' });
  }
});

router.delete('/vehicle-documents/:id', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const match = await vehiclePredicateFor(req.user);
    const doc = await get(
      `SELECT cvd.id FROM contact_vehicle_documents cvd
       JOIN contact_vehicles cv ON cv.id = cvd.vehicle_id
       JOIN contacts c ON c.id = cv.contact_id
       WHERE cvd.id = ? AND ${match.sql}`,
      [req.params.id, ...match.params],
    );
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    await run('DELETE FROM contact_vehicle_documents WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar documento' });
  }
});

router.patch('/vehicles/:id/assign', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    if (!(await isEmpresaPrincipal(req.user))) {
      return res.status(403).json({ error: 'Solo el titular de la empresa puede asignar vehículos' });
    }
    if (!await clientOwnsVehicle(req.user, req.params.id)) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    const assignedUserId = req.body.userId || req.body.assignedUserId || null;
    const principalId = empresaPrincipalUserId(req.user);
    if (assignedUserId) {
      const member = await get(
        "SELECT id FROM users WHERE id = ? AND role = 'cliente' AND (id = ? OR parent_id = ?)",
        [assignedUserId, principalId, principalId],
      );
      if (!member) return res.status(400).json({ error: 'Usuario no pertenece a la empresa' });
    }
    await run(
      'UPDATE contact_vehicles SET assigned_user_id = ?, updated_at = NOW() WHERE id = ?',
      [assignedUserId, req.params.id],
    );
    const updated = await get('SELECT * FROM contact_vehicles WHERE id = ?', [req.params.id]);
    res.json(vehicleRowWithVerification(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al asignar vehículo' });
  }
});

router.get('/empresa-status', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const user = await hydrateClientUser(req.user);
    const isEmpresa = await isEmpresaPrincipal(user);
    res.json({
      isEmpresa,
      isSubuser: isEmpresaSubuser(user),
      profileType: user.profile_type || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar empresa' });
  }
});

router.get('/team', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const user = await hydrateClientUser(req.user);
    const principalId = empresaPrincipalUserId(user);
    if (!(await isEmpresaPrincipal(user))) {
      return res.status(403).json({ error: 'Solo el titular puede ver el equipo' });
    }
    const members = await query(
      `SELECT id, name, email, phone, profile_type, parent_id, status, created_at
       FROM users
       WHERE role = 'cliente' AND (id = ? OR parent_id = ?)
       ORDER BY (id = ?) DESC, name ASC`,
      [principalId, principalId, principalId],
    );
    res.json({
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email?.endsWith('@clientes.tramitesmx.local') ? null : m.email,
        phone: m.phone,
        profileType: m.profile_type,
        isPrincipal: m.id === principalId,
        status: m.status,
        createdAt: m.created_at,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar equipo' });
  }
});

router.post('/team', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const user = await hydrateClientUser(req.user);
    if (!(await isEmpresaPrincipal(user))) {
      return res.status(403).json({ error: 'Solo el titular puede crear usuarios del equipo' });
    }
    const { name, email, phone } = req.body;
    if (!String(name || '').trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    const cleanPhone = phone?.trim()
      ? (normalizeMxPhone(phone) || phone.replace(/\D/g, '') || phone.trim())
      : null;
    const cleanEmail = email?.trim()?.toLowerCase() || null;
    if (!cleanPhone && !cleanEmail) {
      return res.status(400).json({ error: 'Indica teléfono o correo del usuario' });
    }

    const access = await ensureClientUser({
      clientName: String(name).trim(),
      clientEmail: cleanEmail,
      clientPhone: cleanPhone,
      gestorUserId: null,
      gestorName: user.name,
      serviceName: 'Acceso empresa',
      resetPassword: true,
      profileType: 'moral_sub',
      parentId: user.id,
    });
    if (!access?.userId) {
      return res.status(400).json({ error: 'No se pudo crear el usuario' });
    }
    // Asegurar parent_id por si el usuario ya existía
    await run(
      "UPDATE users SET parent_id = ?, profile_type = 'moral_sub' WHERE id = ? AND role = 'cliente'",
      [user.id, access.userId],
    );

    res.status(201).json({
      member: {
        id: access.userId,
        name: String(name).trim(),
        email: access.email,
        phone: access.phone,
        profileType: 'moral_sub',
        isPrincipal: false,
      },
      access: {
        login: access.login,
        password: access.password,
        whatsappUrl: access.whatsappUrl,
        emailed: access.emailed,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al crear usuario del equipo' });
  }
});

router.delete('/team/:id', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const user = await hydrateClientUser(req.user);
    if (!(await isEmpresaPrincipal(user))) {
      return res.status(403).json({ error: 'Solo el titular puede eliminar usuarios' });
    }
    if (req.params.id === user.id) {
      return res.status(400).json({ error: 'No puedes eliminar la cuenta principal' });
    }
    const member = await get(
      "SELECT id FROM users WHERE id = ? AND role = 'cliente' AND parent_id = ?",
      [req.params.id, user.id],
    );
    if (!member) return res.status(404).json({ error: 'Usuario no encontrado' });

    await run(
      'UPDATE contact_vehicles SET assigned_user_id = NULL WHERE assigned_user_id = ?',
      [req.params.id],
    );
    await run("UPDATE users SET status = 'deactivated', parent_id = NULL WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

/** Banners promo del panel cliente filtrados por audiencia del usuario. */
router.get('/promo-banners', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const settings = await loadPanelClienteSettings();
    const all = promoBannersFromSettings(settings);
    const audience = await resolveClientPromoAudience(req.user);
    const matched = filterBannersForAudience(all, audience);
    res.json({
      banners: matched.map(bannerToClientDto),
      audience: {
        states: audience.states,
        hasPurchased: audience.hasPurchased,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar banners' });
  }
});

export default router;
