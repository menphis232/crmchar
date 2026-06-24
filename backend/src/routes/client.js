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

const DEFAULT_REQUIRED_DOCS = ['INE', 'Tarjeta de Circulación', 'Factura de Origen'];

const DEALS_SELECT = `
  SELECT d.id, d.title, d.stage, d.estimated_value as price, d.created_at, d.updated_at,
         g.name as gestor_name, d.deal_type, d.tracking_code,
         d.payment_status, gs.required_documents, u.role as owner_role, u.crm_stages,
         di.id as invoice_id, di.invoice_number, di.pdf_url as invoice_pdf_url,
         di.amount as invoice_amount, di.created_at as invoice_date
  FROM crm_deals d
  LEFT JOIN gestores g ON g.user_id = d.user_id
  LEFT JOIN gestor_services gs ON gs.gestor_id = g.id AND gs.name = d.title
  JOIN contacts c ON c.id = d.contact_id
  LEFT JOIN users u ON u.id = d.user_id
  LEFT JOIN deal_invoices di ON di.deal_id = d.id
  WHERE c.email = ?
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

async function fetchClientDeals(email) {
  const rows = await query(`${DEALS_SELECT} ORDER BY d.updated_at DESC`, [email]);
  return rows.map(mapDealRow);
}

async function clientOwnsDeal(email, dealId) {
  const row = await get(
    `SELECT d.id FROM crm_deals d
     JOIN contacts c ON c.id = d.contact_id
     WHERE d.id = ? AND c.email = ?`,
    [dealId, email],
  );
  return !!row;
}

// Stats for dashboard
router.get('/deals/stats', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const deals = await fetchClientDeals(req.user.email);
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

    let deals = await fetchClientDeals(req.user.email);

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
    if (!await clientOwnsDeal(req.user.email, req.params.id)) {
      return res.status(404).json({ error: 'Trámite no encontrado' });
    }
    const messages = await query(`
      SELECT m.id, m.sender_id, m.message, m.file_url, m.created_at, u.name as sender_name, u.role as sender_role
      FROM chat_messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.deal_id = ?
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
    if (!await clientOwnsDeal(req.user.email, req.params.id)) {
      return res.status(404).json({ error: 'Trámite no encontrado' });
    }
    const { message, fileUrl } = req.body;
    if (!message && !fileUrl) {
      return res.status(400).json({ error: 'Mensaje vacío' });
    }
    
    const id = uuid();
    await run(`
      INSERT INTO chat_messages (id, deal_id, sender_id, message, file_url)
      VALUES (?, ?, ?, ?, ?)
    `, [id, req.params.id, req.user.id, message || null, fileUrl || null]);
    
    const saved = await get(`
      SELECT m.id, m.sender_id, m.message, m.file_url, m.created_at, u.name as sender_name, u.role as sender_role
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

    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

// List all invoices for the client
router.get('/invoices', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const invoices = await query(`
      SELECT i.id, i.invoice_number, i.amount, i.pdf_url, i.payment_method, i.created_at,
             d.id as deal_id, d.title as deal_title, g.name as gestor_name
      FROM deal_invoices i
      JOIN crm_deals d ON d.id = i.deal_id
      JOIN contacts c ON c.id = d.contact_id
      LEFT JOIN gestores g ON g.user_id = d.user_id
      WHERE i.contact_email = ?
      ORDER BY i.created_at DESC
    `, [req.user.email]);
    res.json(invoices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener facturas' });
  }
});

// Download invoice PDF (authenticated)
router.get('/invoices/:id/download', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const invoice = await get(
      `SELECT i.*, d.title as deal_title
       FROM deal_invoices i
       JOIN crm_deals d ON d.id = i.deal_id
       WHERE i.id = ? AND i.contact_email = ?`,
      [req.params.id, req.user.email],
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
    if (!await clientOwnsDeal(req.user.email, req.params.id)) {
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
    if (!await clientOwnsDeal(req.user.email, req.params.id)) {
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
    if (!await clientOwnsDeal(req.user.email, req.params.id)) {
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

    const newDoc = await get('SELECT * FROM deal_documents WHERE id = ?', [docId]);
    res.status(201).json(newDoc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar documento' });
  }
});

// ── Billetera de documentos personales ──────────────────

router.get('/wallet', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const docs = await query(
      'SELECT * FROM client_wallet_documents WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id],
    );
    res.json(docs);
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

export default router;
