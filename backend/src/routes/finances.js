import express from 'express';
import {
  enabledManualPaymentMethodIds,
  parseFinPaymentMethodsJson,
  resolvePaymentMethodLabel,
} from '../fin/payment-methods.js';
import { get, query, run } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { requireActiveSubscription } from '../middleware/subscription.js';
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

router.use(authRequired, finRoles, requireActiveSubscription);

// ──────────────────────────────────────────────
// MÉTODOS DE PAGO CONFIGURABLES
// ──────────────────────────────────────────────

router.get('/payment-methods', async (req, res) => {
  try {
    const user = await get('SELECT fin_payment_methods FROM users WHERE id = ?', [req.orgId]);
    const parsed = parseFinPaymentMethodsJson(user?.fin_payment_methods);
    res.json({ methods: parsed ?? [] });
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
    res.json({ success: true, methods });
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

function buildTxFilters(queryParams, alias = 'f') {
  const { from, to, payment_method, deal_id } = queryParams;
  let sql = '';
  const params = [];

  if (from && to) {
    sql += ` AND ${alias}.date BETWEEN ? AND ?`;
    params.push(from, to);
  } else if (from) {
    sql += ` AND ${alias}.date >= ?`;
    params.push(from);
  } else if (to) {
    sql += ` AND ${alias}.date <= ?`;
    params.push(to);
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

function exportPeriodLabel(from, to) {
  if (from && to) return `${from}_${to}`;
  if (from) return `desde_${from}`;
  if (to) return `hasta_${to}`;
  return 'total';
}

function exportFiltersSummary(req, userMethods = [], dealTitle = null) {
  const parts = [];
  const { from, to, payment_method, deal_id } = req.query;
  if (from && to) parts.push(`Período: ${formatDate(from)} — ${formatDate(to)}`);
  else if (from) parts.push(`Desde: ${formatDate(from)}`);
  else if (to) parts.push(`Hasta: ${formatDate(to)}`);
  else parts.push('Período: Todos los registros');
  if (payment_method) parts.push(`Método: ${methodLabel(payment_method, userMethods)}`);
  if (deal_id) {
    const label = req.user?.role === 'concesionaria' ? 'Vehículo' : 'Trámite';
    parts.push(`${label}: ${dealTitle || 'Seleccionado'}`);
  }
  return parts.join('  ·  ');
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
       LIMIT ${limit} OFFSET ${offset}`,
      params
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
    const { sql: extraFilter, params: filterParams } = buildTxFilters(req.query);
    const params = [req.orgId, ...filterParams];

    const transactions = await query(
      `SELECT f.date, f.type, f.description, f.payment_method, f.amount, f.category, f.referencia,
              d.title as deal_title, ${VEHICLE_LABEL_SQL} as vehicle_label
       FROM fin_transactions f 
       LEFT JOIN crm_deals d ON f.deal_id = d.id 
       LEFT JOIN autos a ON d.auto_id = a.id
       WHERE f.user_id = ?${extraFilter}
       ORDER BY f.date DESC`,
      params
    );

    // Load custom methods for this user
    let userMethods = [];
    try {
      const uRow = await get('SELECT fin_payment_methods FROM users WHERE id = ?', [req.orgId]);
      userMethods = parseFinPaymentMethodsJson(uRow?.fin_payment_methods) || [];
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

    const label = exportPeriodLabel(req.query.from, req.query.to);
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
    const { sql: extraFilter, params: filterParams } = buildTxFilters(req.query);
    const params = [req.orgId, ...filterParams];

    const transactions = await query(
      `SELECT f.date, f.type, f.description, f.payment_method, f.amount, f.category, f.referencia,
              d.title as deal_title, ${VEHICLE_LABEL_SQL} as vehicle_label
       FROM fin_transactions f 
       LEFT JOIN crm_deals d ON f.deal_id = d.id 
       LEFT JOIN autos a ON d.auto_id = a.id
       WHERE f.user_id = ?${extraFilter}
       ORDER BY f.date DESC`,
      params
    );

    let totalIncome = 0;
    let totalExpense = 0;
    transactions.forEach(t => {
      if (t.type === 'income') totalIncome += Number(t.amount);
      else totalExpense += Number(t.amount);
    });
    const netBalance = totalIncome - totalExpense;

    const [user] = await query('SELECT name, logo_url FROM users WHERE id = ?', [req.orgId]);

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

    let userMethods = [];
    try {
      const uRow = await get('SELECT fin_payment_methods FROM users WHERE id = ?', [req.orgId]);
      userMethods = parseFinPaymentMethodsJson(uRow?.fin_payment_methods) || [];
    } catch {}

    const label = exportPeriodLabel(req.query.from, req.query.to);
    const linkCol = req.user?.role === 'concesionaria' ? 'Vehículo' : 'Trámite';

    let dealTitle = null;
    if (req.query.deal_id) {
      const [dealRow] = await query(
        `SELECT COALESCE(${VEHICLE_LABEL_SQL}, d.title) as title
         FROM crm_deals d LEFT JOIN autos a ON d.auto_id = a.id WHERE d.id = ?`,
        [req.query.deal_id],
      );
      dealTitle = dealRow?.title || null;
    }

    const filtersText = exportFiltersSummary(req, userMethods, dealTitle);
    const generatedAt = new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="finanzas_${label}.pdf"`);
    doc.pipe(res);

    const pageW = doc.page.width;
    const contentW = pageW - 80;
    const gold = '#C8A94A';
    const dark = '#0B0B0B';
    const muted = '#8A8A8A';
    const border = '#2A2A2A';

    // ── Header ──
    doc.rect(0, 0, pageW, 96).fill(dark);
    doc.rect(0, 96, pageW, 3).fill(gold);

    if (logoUrl) {
      try {
        const imgBuffer = await fetchImageBuffer(logoUrl);
        doc.image(imgBuffer, 40, 22, { fit: [56, 56] });
      } catch {}
    }

    const titleX = logoUrl ? 108 : 40;
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20)
      .text(user?.name || 'Reporte Financiero', titleX, 28, { width: contentW - 60 });
    doc.fillColor(gold).font('Helvetica').fontSize(10)
      .text('REPORTE DE FINANZAS', titleX, 54);
    doc.fillColor(muted).fontSize(8)
      .text(`Generado: ${generatedAt}`, pageW - 220, 30, { width: 180, align: 'right' });

    // ── Filter bar ──
    doc.y = 112;
    doc.roundedRect(40, doc.y, contentW, 28, 6).fillAndStroke('#141414', border);
    doc.fillColor('#CCCCCC').font('Helvetica').fontSize(8)
      .text(filtersText, 52, doc.y + 10, { width: contentW - 24 });

    // ── KPI cards ──
    const kpiY = 152;
    const kpiW = (contentW - 20) / 3;
    const kpis = [
      { label: 'INGRESOS', value: `$${fmtNum(totalIncome)}`, color: '#22C55E', bg: '#0F1F14' },
      { label: 'GASTOS', value: `$${fmtNum(totalExpense)}`, color: '#EF4444', bg: '#1F0F0F' },
      { label: 'BALANCE NETO', value: `${netBalance >= 0 ? '+' : ''}$${fmtNum(netBalance)}`, color: netBalance >= 0 ? gold : '#EF4444', bg: '#141414' },
    ];
    kpis.forEach((kpi, i) => {
      const x = 40 + i * (kpiW + 10);
      doc.roundedRect(x, kpiY, kpiW, 58, 8).fillAndStroke(kpi.bg, border);
      doc.fillColor(muted).font('Helvetica-Bold').fontSize(7)
        .text(kpi.label, x + 12, kpiY + 10, { width: kpiW - 24 });
      drawFitText(doc, kpi.value, x + 12, kpiY + 26, kpiW - 24, kpi.color, 16, 9);
    });

    // ── Table ──
    const tableTop = kpiY + 78;
    const cols = {
      fecha: 40,
      tipo: 98,
      desc: 138,
      ref: 268,
      metodo: 338,
      link: 398,
      monto: pageW - 40,
    };
    const colWidths = {
      fecha: 54, tipo: 36, desc: 124, ref: 66, metodo: 56, link: 92, monto: 72,
    };

    const drawTableHeader = (y) => {
      doc.roundedRect(40, y, contentW, 22, 4).fill('#1A1A1A');
      doc.fillColor(gold).font('Helvetica-Bold').fontSize(7);
      doc.text('FECHA', cols.fecha + 8, y + 7, { width: colWidths.fecha });
      doc.text('TIPO', cols.tipo, y + 7, { width: colWidths.tipo });
      doc.text('DESCRIPCIÓN', cols.desc, y + 7, { width: colWidths.desc });
      doc.text('REF.', cols.ref, y + 7, { width: colWidths.ref });
      doc.text('MÉTODO', cols.metodo, y + 7, { width: colWidths.metodo });
      doc.text(linkCol.toUpperCase(), cols.link, y + 7, { width: colWidths.link });
      doc.text('MONTO', cols.monto - colWidths.monto, y + 7, { width: colWidths.monto, align: 'right' });
      return y + 26;
    };

    let rowY = drawTableHeader(tableTop);
    let rowCount = 0;

    if (transactions.length === 0) {
      doc.fillColor(muted).font('Helvetica').fontSize(9)
        .text('No hay transacciones con los filtros aplicados.', 40, rowY + 8, { width: contentW, align: 'center' });
    }

    for (const t of transactions) {
      if (rowY > doc.page.height - 70) {
        doc.addPage();
        doc.rect(0, 0, pageW, 36).fill(dark);
        doc.fillColor(gold).font('Helvetica-Bold').fontSize(9)
          .text(user?.name || 'Reporte Financiero', 40, 12);
        rowY = drawTableHeader(48);
      }

      const bg = rowCount % 2 === 0 ? '#111111' : '#0D0D0D';
      doc.rect(40, rowY, contentW, 20).fill(bg);

      const isIncome = t.type === 'income';
      const typeColor = isIncome ? '#22C55E' : '#EF4444';
      const linkVal = req.user?.role === 'concesionaria'
        ? (t.vehicle_label || t.deal_title || '—')
        : (t.deal_title || '—');

      doc.fillColor('#BBBBBB').font('Helvetica').fontSize(7);
      doc.text(formatDate(t.date), cols.fecha + 8, rowY + 6, { width: colWidths.fecha });
      doc.fillColor(typeColor).font('Helvetica-Bold');
      doc.text(isIncome ? 'Ing.' : 'Gasto', cols.tipo, rowY + 6, { width: colWidths.tipo });
      doc.fillColor('#DDDDDD').font('Helvetica');
      doc.text(truncate(t.description, 28), cols.desc, rowY + 6, { width: colWidths.desc });
      doc.text(truncate(t.referencia, 14), cols.ref, rowY + 6, { width: colWidths.ref });
      doc.text(truncate(methodLabel(t.payment_method || 'general', userMethods), 12), cols.metodo, rowY + 6, { width: colWidths.metodo });
      doc.text(truncate(linkVal, 18), cols.link, rowY + 6, { width: colWidths.link });
      doc.fillColor(typeColor).font('Helvetica-Bold');
      doc.text(`${isIncome ? '+' : '-'}$${fmtNum(t.amount)}`, cols.monto - colWidths.monto, rowY + 6, { width: colWidths.monto, align: 'right' });

      rowY += 20;
      rowCount++;
    }

    // ── Footer on all pages ──
    const pages = doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i);
      const footerY = doc.page.height - 36;
      doc.moveTo(40, footerY).lineTo(pageW - 40, footerY).strokeColor(border).lineWidth(0.5).stroke();
      doc.fillColor(muted).font('Helvetica').fontSize(7);
      doc.text(`${transactions.length} transacciones`, 40, footerY + 10);
      doc.text(`Página ${i - pages.start + 1} de ${pages.count}`, pageW - 120, footerY + 10, { width: 80, align: 'right' });
      doc.fillColor(gold).text('Trámites Vehiculares de México', 40, footerY + 10, { width: contentW, align: 'center' });
    }

    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Error al generar PDF' });
  }
});

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

function methodLabel(method, customMethods = []) {
  return resolvePaymentMethodLabel(method, customMethods);
}

function fmtNum(n) {
  return Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function truncate(str, max) {
  const s = String(str || '');
  if (s.length <= max) return s || '—';
  return `${s.slice(0, max - 1)}…`;
}

function drawFitText(doc, text, x, y, maxWidth, color, maxSize = 16, minSize = 9) {
  let size = maxSize;
  doc.fillColor(color).font('Helvetica-Bold').fontSize(size);
  while (size > minSize && doc.widthOfString(text) > maxWidth) {
    size -= 0.5;
    doc.fontSize(size);
  }
  doc.text(text, x, y, { width: maxWidth, lineBreak: false });
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
