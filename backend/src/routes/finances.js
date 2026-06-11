import express from 'express';
import { get, query, run } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { v4 as uuid } from 'uuid';

const router = express.Router();

function finRoles(req, res, next) {
  if (!['gestor', 'concesionaria'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  // Permitimos ver finanzas si es jefe o si tiene el permiso "finanzas"
  if (req.user.parent_id && (!req.user.permissions || !req.user.permissions.includes('finanzas'))) {
    return res.status(403).json({ error: 'No tienes permiso para ver Finanzas' });
  }
  req.orgId = req.user.parent_id || req.user.id;
  next();
}

router.use(authRequired, finRoles);

// Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const rows = await query(
      'SELECT type, SUM(amount) as total FROM fin_transactions WHERE user_id = ? GROUP BY type',
      [req.orgId]
    );
    let income = 0;
    let expense = 0;
    rows.forEach(r => {
      if (r.type === 'income') income = Number(r.total);
      if (r.type === 'expense') expense = Number(r.total);
    });

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

    // Ingresos por trámites finalizados (Dinero real)
    const [completedRows] = await query(
      "SELECT SUM(estimated_value) as total FROM crm_deals WHERE user_id = ? AND stage IN ('completado', 'vendido')",
      [req.orgId]
    );
    const dealsIncome = Number(completedRows?.total || 0);

    // Dinero en trámites pendientes (Proyección)
    const [pendingRows] = await query(
      "SELECT SUM(estimated_value) as total FROM crm_deals WHERE user_id = ? AND stage NOT IN ('completado', 'vendido', 'perdido')",
      [req.orgId]
    );
    const projectedIncome = Number(pendingRows?.total || 0);

    // Sumar el dinero real de trámites al ingreso manual
    income += dealsIncome;
    monthIncome += dealsIncome; // Simplificación: asumimos que el mes actual refleja el balance total de deals por ahora

    res.json({
      totalIncome: income,
      totalExpense: expense,
      netBalance: income - expense,
      monthIncome,
      monthExpense,
      monthBalance: monthIncome - monthExpense,
      projectedIncome
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar el resumen financiero' });
  }
});

// List
router.get('/', async (req, res) => {
  try {
    const transactions = await query(
      `SELECT f.*, d.title as deal_title 
       FROM fin_transactions f 
       LEFT JOIN crm_deals d ON f.deal_id = d.id 
       WHERE f.user_id = ? 
       ORDER BY f.date DESC, f.created_at DESC`,
      [req.orgId]
    );
    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar transacciones' });
  }
});

// Create
router.post('/', async (req, res) => {
  try {
    const { type, amount, description, category, date, deal_id } = req.body;
    if (!type || !amount || !description || !date) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    const id = uuid();
    await run(
      'INSERT INTO fin_transactions (id, user_id, deal_id, type, amount, description, category, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.orgId, deal_id || null, type, amount, description, category || 'general', date]
    );
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear transacción' });
  }
});

// Delete
router.delete('/:id', async (req, res) => {
  try {
    await run('DELETE FROM fin_transactions WHERE id = ? AND user_id = ?', [req.params.id, req.orgId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar transacción' });
  }
});

// Deals pending balance
router.get('/deals/pending', async (req, res) => {
  try {
    const deals = await query(
      `SELECT d.id, d.title, d.estimated_value,
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

export default router;
