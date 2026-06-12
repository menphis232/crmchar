import { Router } from 'express';
import { get, query, run } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { v4 as uuid } from 'uuid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// Get all deals for the client
router.get('/deals', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const deals = await query(`
      SELECT d.id, d.title, d.stage, d.estimated_value as price, d.created_at, g.name as gestor_name, d.deal_type, d.tracking_code,
             gs.required_documents
      FROM crm_deals d
      LEFT JOIN gestores g ON g.user_id = d.user_id
      LEFT JOIN gestor_services gs ON gs.gestor_id = g.id AND gs.name = d.title
      JOIN contacts c ON c.id = d.contact_id
      WHERE c.email = ?
      ORDER BY d.created_at DESC
    `, [req.user.email]);
    
    deals.forEach(d => {
      try { d.required_documents = typeof d.required_documents === 'string' ? JSON.parse(d.required_documents) : (d.required_documents || ['INE', 'Tarjeta de Circulación', 'Factura de Origen']); } catch(e) { d.required_documents = ['INE', 'Tarjeta de Circulación', 'Factura de Origen']; }
    });
    res.json(deals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener trámites' });
  }
});

// Get chat messages for a deal
router.get('/deals/:id/messages', authRequired, async (req, res) => {
  try {
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
router.post('/deals/:id/messages', authRequired, async (req, res) => {
  try {
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
    
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

// Get documents for a deal
router.get('/deals/:id/documents', authRequired, async (req, res) => {
  try {
    const docs = await query('SELECT * FROM deal_documents WHERE deal_id = ? ORDER BY created_at DESC', [req.params.id]);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener documentos' });
  }
});

// Upload a document and perform OCR
router.post('/deals/:id/documents', authRequired, async (req, res) => {
  try {
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
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
          
          const filename = fileUrl.split('/').pop();
          const filePath = path.join(__dirname, '..', '..', 'uploads', filename);
          
          if (fs.existsSync(filePath)) {
            const fileData = fs.readFileSync(filePath);
            const imagePart = {
              inlineData: { data: fileData.toString('base64'), mimeType: 'image/png' }
            };
            
            const prompt = `Extrae la información principal de este documento (${documentType}). Devuelve SOLO un JSON válido con las claves en formato camelCase (ej: nombre, fechaNacimiento, curp, rfc, numeroIdentificacion, placas, niv, marca, modelo, etc). No incluyas markdown como \`\`\`json.`;
            
            const result = await model.generateContent([prompt, imagePart]);
            const responseText = result.response.text().trim().replace(/^```json/g, '').replace(/```$/g, '').trim();
            
            try {
              extractedData = JSON.parse(responseText);
            } catch (e) { console.error('Error parsing OCR JSON:', responseText); }
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

export default router;
