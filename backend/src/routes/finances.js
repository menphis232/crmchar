import express from 'express';
import { get, query, run } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { v4 as uuid } from 'uuid';
import PDFDocument from 'pdfkit';
import https from 'https';
import http from 'http';

const router = express.Router();

function finRoles(req, res, next) {
  if (!['gestor', 'concesionaria'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  if (req.user.parent_id && (!req.user.permissions || !req.user.permissions.includes('finanzas'))) {
    return res.status(403).json({ error: 'No tienes permiso para ver Finanzas' });
  }
  req.orgId = req.user.parent_id || req.user.id;
  next();
}

router.use(authRequired, finRoles);

// ──────────────────────────────────────────────
// MÉTODOS DE PAGO CONFIGURABLES
// ──────────────────────────────────────────────

router.get('/payment-methods', async (req, res) => {
  try {
    const [user] = await query('SELECT fin_payment_methods FROM users WHERE id = ?', [req.orgId]);
    let methods = ['efectivo', 'transferencia', 'mercadopago'];
    if (user?.fin_payment_methods) {
      try { methods = JSON.parse(user.fin_payment_methods); } catch {}
    }
    res.json({ methods });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener métodos de pago' });
  }
});

router.put('/payment-methods', async (req, res) => {
  try {
    const { methods } = req.body;
    if (!Array.isArray(methods)) return res.status(400).json({ error: 'methods debe ser un array' });
    await run('UPDATE users SET fin_payment_methods = ? WHERE id = ?', [JSON.stringify(methods), req.orgId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar métodos de pago' });
  }
});

// ──────────────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────────────

router.get('/dashboard', async (req, res) => {
  try {
    const { from, to } = req.query;
    let dateFilter = '';
    const params = [req.orgId];

    if (from && to) {
      dateFilter = ' AND date BETWEEN ? AND ?';
      params.push(from, to);
    }

    const rows = await query(
      `SELECT type, SUM(amount) as total FROM fin_transactions WHERE user_id = ?${dateFilter} GROUP BY type`,
      params
    );
    let income = 0;
    let expense = 0;
    rows.forEach(r => {
      if (r.type === 'income') income = Number(r.total);
      if (r.type === 'expense') expense = Number(r.total);
    });

    // Ingresos por método de pago
    const methodRows = await query(
      `SELECT payment_method, SUM(amount) as total FROM fin_transactions WHERE user_id = ? AND type = 'income'${dateFilter ? dateFilter.replace('date BETWEEN', 'date BETWEEN') : ''} GROUP BY payment_method`,
      params
    );
    const byMethod = {};
    methodRows.forEach(r => { byMethod[r.payment_method || 'general'] = Number(r.total); });

    const thisMonthRows = await query(
      'SELECT type, SUM(amount) as total FROM fin_transactions WHERE user_id = ? AND MONTH(date) = MONTH(CURRENT_DATE()) AND YEAR(date) = YEAR(CURRENT_DATE()) GROUP BY type',
      [req.orgId]
    );
    let monthIncome = 0;
    let monthExpense = 0;
    thisMonthRows.forEach(r => {
      if (r.type === 'income') monthIncome = Number(r.total);
      if (r.type === 'expense') monthExpense = Number(r.total);
    });

    // Proyección desde deals
    const [completedRows] = await query(
      "SELECT SUM(estimated_value) as total FROM crm_deals WHERE user_id = ? AND stage IN ('completado', 'vendido')",
      [req.orgId]
    );
    const dealsIncome = Number(completedRows?.total || 0);

    const [pendingRows] = await query(
      "SELECT SUM(estimated_value) as total FROM crm_deals WHERE user_id = ? AND stage NOT IN ('completado', 'vendido', 'perdido')",
      [req.orgId]
    );
    const projectedIncome = Number(pendingRows?.total || 0);

    if (!from && !to) {
      income += dealsIncome;
      monthIncome += dealsIncome;
    }

    res.json({
      totalIncome: income,
      totalExpense: expense,
      netBalance: income - expense,
      monthIncome,
      monthExpense,
      monthBalance: monthIncome - monthExpense,
      projectedIncome,
      byMethod
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar el resumen financiero' });
  }
});

// ──────────────────────────────────────────────
// LIST (con filtro de fecha)
// ──────────────────────────────────────────────

const VEHICLE_LABEL_SQL = `CASE WHEN a.id IS NOT NULL THEN TRIM(CONCAT(TRIM(a.make), ' ', TRIM(a.model), ' (', a.year, ')')) ELSE NULL END`;

function buildTxFilters(query, alias = 'f') {
  const { from, to, payment_method, deal_id } = query;
  let sql = '';
  const params = [];

  if (from && to) {
    sql += ` AND ${alias}.date BETWEEN ? AND ?`;
    params.push(from, to);
  }
  if (payment_method) {
    sql += ` AND ${alias}.payment_method = ?`;
    params.push(payment_method);
  }
  if (deal_id) {
    sql += ` AND ${alias}.deal_id = ?`;
    params.push(deal_id);
  }

  return { sql, params };
}

router.get('/filter-options', async (req, res) => {
  try {
    const { from, to } = req.query;
    const baseParams = [req.orgId];
    let dateFilter = '';
    if (from && to) {
      dateFilter = ' AND f.date BETWEEN ? AND ?';
      baseParams.push(from, to);
    }

    const deals = await query(
      `SELECT DISTINCT d.id, COALESCE(${VEHICLE_LABEL_SQL}, d.title) as title
       FROM fin_transactions f
       INNER JOIN crm_deals d ON f.deal_id = d.id
       LEFT JOIN autos a ON d.auto_id = a.id
       WHERE f.user_id = ? AND f.deal_id IS NOT NULL${dateFilter}
       ORDER BY title ASC`,
      baseParams
    );

    const methodRows = await query(
      `SELECT DISTINCT f.payment_method
       FROM fin_transactions f
       WHERE f.user_id = ?${dateFilter}
       ORDER BY f.payment_method ASC`,
      baseParams
    );

    res.json({
      deals,
      methods: methodRows.map(r => r.payment_method || 'general').filter(Boolean),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar filtros' });
  }
});

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;

    const { sql: extraFilter, params: filterParams } = buildTxFilters(req.query);
    const params = [req.orgId, ...filterParams];

    const [countRow] = await query(
      `SELECT COUNT(*) as total
       FROM fin_transactions f
       WHERE f.user_id = ?${extraFilter}`,
      params
    );
    const total = Number(countRow?.total || 0);

    const transactions = await query(
      `SELECT f.*, d.title as deal_title, ${VEHICLE_LABEL_SQL} as vehicle_label
       FROM fin_transactions f
       LEFT JOIN crm_deals d ON f.deal_id = d.id
       LEFT JOIN autos a ON d.auto_id = a.id
       WHERE f.user_id = ?${extraFilter}
       ORDER BY f.date DESC, f.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      items: transactions,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar transacciones' });
  }
});

// ──────────────────────────────────────────────
// CREATE
// ──────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    const { type, amount, description, category, date, deal_id, payment_method, referencia } = req.body;
    if (!type || !amount || !description || !date) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    const id = uuid();
    await run(
      'INSERT INTO fin_transactions (id, user_id, deal_id, type, amount, description, category, date, payment_method, referencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.orgId, deal_id || null, type, amount, description, category || 'general', date, payment_method || 'general', referencia?.trim() || null]
    );
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear transacción' });
  }
});

// ──────────────────────────────────────────────
// DELETE
// ──────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  try {
    await run('DELETE FROM fin_transactions WHERE id = ? AND user_id = ?', [req.params.id, req.orgId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar transacción' });
  }
});

// ──────────────────────────────────────────────
// DEALS PENDIENTES
// ──────────────────────────────────────────────

router.get('/deals/pending', async (req, res) => {
  try {
    const isDealer = req.user?.role === 'concesionaria';
    const deals = await query(
      isDealer
        ? `SELECT d.id, COALESCE(${VEHICLE_LABEL_SQL}, d.title) as title, d.estimated_value,
             COALESCE((SELECT SUM(amount) FROM fin_transactions f WHERE f.deal_id = d.id AND f.type = 'income'), 0) as paid_amount
           FROM crm_deals d
           LEFT JOIN autos a ON d.auto_id = a.id
           WHERE d.user_id = ? AND d.stage NOT IN ('perdido', 'vendido')
           ORDER BY d.updated_at DESC`
        : `SELECT d.id, d.title, d.estimated_value,
             COALESCE((SELECT SUM(amount) FROM fin_transactions f WHERE f.deal_id = d.id AND f.type = 'income'), 0) as paid_amount
           FROM crm_deals d
           WHERE d.user_id = ?
           HAVING paid_amount < estimated_value AND estimated_value > 0`,
      [req.orgId]
    );
    res.json(deals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar cuentas por cobrar' });
  }
});

// ──────────────────────────────────────────────
// EXPORT CSV
// ──────────────────────────────────────────────

router.get('/export/csv', async (req, res) => {
  try {
    const { from, to } = req.query;
    let dateFilter = '';
    const params = [req.orgId];

    if (from && to) {
      dateFilter = ' AND f.date BETWEEN ? AND ?';
      params.push(from, to);
    }

    const transactions = await query(
      `SELECT f.date, f.type, f.description, f.payment_method, f.amount, f.category, f.referencia,
              d.title as deal_title, ${VEHICLE_LABEL_SQL} as vehicle_label
       FROM fin_transactions f 
       LEFT JOIN crm_deals d ON f.deal_id = d.id 
       LEFT JOIN autos a ON d.auto_id = a.id
       WHERE f.user_id = ?${dateFilter}
       ORDER BY f.date DESC`,
      params
    );

    // Load custom methods for this user
    let userMethods = [];
    try {
      const [uRow] = await query('SELECT fin_payment_methods FROM users WHERE id = ?', [req.orgId]);
      if (uRow?.fin_payment_methods) userMethods = JSON.parse(uRow.fin_payment_methods);
    } catch {}

    const linkCol = req.user?.role === 'concesionaria' ? 'Vehículo Relacionado' : 'Trámite Relacionado';

    // Build CSV
    const header = `Fecha,Tipo,Descripción,Referencia,Método de Pago,Monto,Categoría,${linkCol}\n`;
    const rows = transactions.map(t => {
      const tipo = t.type === 'income' ? 'Ingreso' : 'Gasto';
      const metodo = methodLabel(t.payment_method || 'general', userMethods);
      const monto = Number(t.amount).toFixed(2);
      const desc = `"${(t.description || '').replace(/"/g, '""')}"`;
      const ref = `"${(t.referencia || '').replace(/"/g, '""')}"`;
      const link = req.user?.role === 'concesionaria'
        ? (t.vehicle_label || t.deal_title || '')
        : (t.deal_title || '');
      const deal = `"${link.replace(/"/g, '""')}"`;
      const cat = `"${(t.category || '').replace(/"/g, '""')}"`;
      return `${t.date},${tipo},${desc},${ref},${metodo},${monto},${cat},${deal}`;
    }).join('\n');

    const label = from && to ? `${from}_${to}` : 'total';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="finanzas_${label}.csv"`);
    res.send('\uFEFF' + header + rows); // BOM para Excel
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al exportar CSV' });
  }
});

// ──────────────────────────────────────────────
// EXPORT PDF
// ──────────────────────────────────────────────

router.get('/export/pdf', async (req, res) => {
  try {
    const { from, to } = req.query;
    let dateFilter = '';
    const params = [req.orgId];

    if (from && to) {
      dateFilter = ' AND f.date BETWEEN ? AND ?';
      params.push(from, to);
    }

    const transactions = await query(
      `SELECT f.date, f.type, f.description, f.payment_method, f.amount, f.category, d.title as deal_title 
       FROM fin_transactions f 
       LEFT JOIN crm_deals d ON f.deal_id = d.id 
       WHERE f.user_id = ?${dateFilter}
       ORDER BY f.date DESC`,
      params
    );

    // Totals
    let totalIncome = 0;
    let totalExpense = 0;
    transactions.forEach(t => {
      if (t.type === 'income') totalIncome += Number(t.amount);
      else totalExpense += Number(t.amount);
    });

    // Get user info (logo + name)
    const [user] = await query('SELECT name, logo_url FROM users WHERE id = ?', [req.orgId]);

    // Get site logo as fallback
    let siteLogo = null;
    try {
      const [siteSetting] = await query(
        "SELECT settings FROM site_settings WHERE page_key = 'home' LIMIT 1", []
      );
      if (siteSetting?.settings) {
        const parsed = JSON.parse(siteSetting.settings);
        siteLogo = parsed.logoUrl || null;
      }
    } catch {}

    const logoUrl = user?.logo_url || siteLogo;

    // Load custom payment methods for this user
    let userMethods = [];
    try {
      const [uRow] = await query('SELECT fin_payment_methods FROM users WHERE id = ?', [req.orgId]);
      if (uRow?.fin_payment_methods) userMethods = JSON.parse(uRow.fin_payment_methods);
    } catch {}

    // Build PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const label = from && to ? `${from}_${to}` : 'total';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="finanzas_${label}.pdf"`);
    doc.pipe(res);

    // Header band
    doc.rect(0, 0, doc.page.width, 80).fill('#0f0f0f');

    // Logo
    if (logoUrl) {
      try {
        const imgBuffer = await fetchImageBuffer(logoUrl);
        doc.image(imgBuffer, 50, 15, { height: 50, fit: [120, 50] });
      } catch {}
    }

    // Company name
    doc.fillColor('#C8A94A').fontSize(20).font('Helvetica-Bold')
      .text(user?.name || 'Reporte de Finanzas', logoUrl ? 185 : 50, 25);
    doc.fillColor('#888888').fontSize(10).font('Helvetica')
      .text('Reporte Financiero', logoUrl ? 185 : 50, 50);

    // Date range
    const rangeText = from && to
      ? `Período: ${formatDate(from)} — ${formatDate(to)}`
      : 'Período: Todos los registros';
    doc.fillColor('#888888').fontSize(9).text(rangeText, 400, 60, { align: 'right', width: 145 });

    doc.moveDown(4);

    // Summary cards
    const cardY = 100;
    const cardW = 150;

    // Ingresos
    doc.rect(50, cardY, cardW, 60).fill('#0a2e1a');
    doc.fillColor('#22c55e').fontSize(10).font('Helvetica-Bold').text('INGRESOS TOTALES', 55, cardY + 8, { width: cardW - 10 });
    doc.fillColor('#22c55e').fontSize(18).font('Helvetica-Bold').text(`$${fmtNum(totalIncome)}`, 55, cardY + 25, { width: cardW - 10 });

    // Gastos
    doc.rect(215, cardY, cardW, 60).fill('#2e0a0a');
    doc.fillColor('#ef4444').fontSize(10).font('Helvetica-Bold').text('GASTOS TOTALES', 220, cardY + 8, { width: cardW - 10 });
    doc.fillColor('#ef4444').fontSize(18).font('Helvetica-Bold').text(`$${fmtNum(totalExpense)}`, 220, cardY + 25, { width: cardW - 10 });

    // Balance
    const balPositive = totalIncome - totalExpense >= 0;
    doc.rect(380, cardY, cardW, 60).fill(balPositive ? '#0a1e2e' : '#2e0a0a');
    doc.fillColor(balPositive ? '#C8A94A' : '#ef4444').fontSize(10).font('Helvetica-Bold').text('BALANCE NETO', 385, cardY + 8, { width: cardW - 10 });
    doc.fillColor(balPositive ? '#C8A94A' : '#ef4444').fontSize(18).font('Helvetica-Bold').text(`$${fmtNum(totalIncome - totalExpense)}`, 385, cardY + 25, { width: cardW - 10 });

    doc.moveDown(1);
    doc.y = cardY + 80;

    // Table header
    const tY = doc.y + 10;
    doc.rect(50, tY, doc.page.width - 100, 22).fill('#1a1a1a');
    const cols = { fecha: 50, tipo: 120, descripcion: 175, metodo: 330, monto: 430, total: doc.page.width - 100 };

    doc.fillColor('#C8A94A').fontSize(9).font('Helvetica-Bold');
    doc.text('FECHA', cols.fecha, tY + 6);
    doc.text('TIPO', cols.tipo, tY + 6);
    doc.text('DESCRIPCIÓN', cols.descripcion, tY + 6);
    doc.text('MÉTODO', cols.metodo, tY + 6);
    doc.text('MONTO', cols.monto, tY + 6, { width: 80, align: 'right' });

    let rowY = tY + 26;
    let rowCount = 0;

    for (const t of transactions) {
      if (rowY > doc.page.height - 80) {
        doc.addPage();
        rowY = 50;
      }

      const bg = rowCount % 2 === 0 ? '#111111' : '#0a0a0a';
      doc.rect(50, rowY, doc.page.width - 100, 20).fill(bg);

      const isIncome = t.type === 'income';
      doc.fillColor('#aaaaaa').fontSize(8).font('Helvetica');
      doc.text(formatDate(t.date), cols.fecha, rowY + 5, { width: 65 });

      doc.fillColor(isIncome ? '#22c55e' : '#ef4444').fontSize(8).font('Helvetica-Bold');
      doc.text(isIncome ? 'Ingreso' : 'Gasto', cols.tipo, rowY + 5, { width: 50 });

      doc.fillColor('#cccccc').fontSize(8).font('Helvetica');
      doc.text((t.description || '').substring(0, 35), cols.descripcion, rowY + 5, { width: 150 });
      doc.text(methodLabel(t.payment_method || 'general', userMethods), cols.metodo, rowY + 5, { width: 90 });

      doc.fillColor(isIncome ? '#22c55e' : '#ef4444').fontSize(8).font('Helvetica-Bold');
      doc.text(`${isIncome ? '+' : '-'}$${fmtNum(t.amount)}`, cols.monto, rowY + 5, { width: 80, align: 'right' });

      rowY += 22;
      rowCount++;
    }

    // Footer
    doc.rect(50, rowY + 10, doc.page.width - 100, 1).fill('#333333');
    doc.fillColor('#888888').fontSize(8).font('Helvetica')
      .text(`Generado el ${new Date().toLocaleDateString('es-MX')} — ${user?.name || ''}`, 50, rowY + 18, { align: 'center', width: doc.page.width - 100 });

    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Error al generar PDF' });
  }
});

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

// customLabels is optional: array of {id, label, icon} for user-defined methods
function methodLabel(method, customMethods = []) {
  const labels = {
    stripe: 'Stripe',
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    mercadopago: 'MercadoPago',
    general: 'General',
  };
  if (labels[method]) return labels[method];
  // Look up in custom methods
  const found = customMethods.find(m => (typeof m === 'object' ? m.id : m) === method);
  if (found && typeof found === 'object' && found.label) return found.label;
  return method;
}

function fmtNum(n) {
  return Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  try {
    // MySQL may return a Date object or an ISO string like '2026-06-12T00:00:00.000Z'
    // Extract just the YYYY-MM-DD part before parsing to avoid timezone issues
    let raw = dateStr;
    if (raw instanceof Date) {
      raw = raw.toISOString();
    }
    raw = String(raw).slice(0, 10); // 'YYYY-MM-DD'
    const [y, m, d] = raw.split('-').map(Number);
    const date = new Date(y, m - 1, d); // local midnight — no TZ shift
    return date.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch { return String(dateStr); }
}

function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

export default router;
