import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { get, query, run } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import * as ga from '../services/googleAnalytics.js';
import { isOneSignalConfigured, sendOneSignalPush, listPushSubscriptions } from '../services/onesignal.js';

const router = Router();

router.get('/stats', authRequired, requireRole('admin'), async (_req, res) => {
  try {
    const [users, gestores, concesionarias, autosPub, autosDraft, autosBaja, inquiries, reviews] = await Promise.all([
      get('SELECT COUNT(*) as c FROM users'),
      get('SELECT COUNT(*) as c FROM gestores'),
      get("SELECT COUNT(*) as c FROM users WHERE role = 'concesionaria'"),
      get("SELECT COUNT(*) as c FROM autos WHERE status = 'published'"),
      get("SELECT COUNT(*) as c FROM autos WHERE status = 'draft'"),
      get("SELECT COUNT(*) as c FROM autos WHERE status = 'baja'"),
      get('SELECT COUNT(*) as c FROM auto_inquiries'),
      get('SELECT COUNT(*) as c FROM concesionaria_reviews'),
    ]);

    const topGestores = await query(`
      SELECT name, rating, tramites_count as tramitesCount, state FROM gestores
      ORDER BY tramites_count DESC LIMIT 5
    `);
    const topDealers = await query(`
      SELECT u.name, COUNT(a.id) as autosCount,
        COALESCE(AVG(cr.rating), 0) as avgRating
      FROM users u
      LEFT JOIN autos a ON a.user_id = u.id AND a.status = 'published'
      LEFT JOIN concesionaria_reviews cr ON cr.user_id = u.id
      WHERE u.role = 'concesionaria'
      GROUP BY u.id ORDER BY autosCount DESC LIMIT 5
    `);

    res.json({
      totals: {
        users: users.c,
        gestores: gestores.c,
        concesionarias: concesionarias.c,
        autosPublished: autosPub.c,
        autosDraft: autosDraft.c,
        autosBaja: autosBaja.c,
        inquiries: inquiries.c,
        dealerReviews: reviews.c,
      },
      topGestores,
      topDealers,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar estadísticas' });
  }
});

router.get('/users', authRequired, requireRole('admin'), async (_req, res) => {
  try {
    const rows = await query(`
      SELECT id, email, role, name, created_at as createdAt FROM users ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
});

// Clientes y propietarios de gestorías/concesionarias con detalle para administración
router.get('/users/managed', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const { role } = req.query;
    let sql = `
      SELECT u.id, u.email, u.name, u.role, u.created_at as createdAt,
             g.id as gestorId, g.slug, g.location, g.state, g.rating,
             (SELECT COUNT(*) FROM autos a WHERE a.user_id = u.id) as autosCount
      FROM users u
      LEFT JOIN gestores g ON g.user_id = u.id
      WHERE u.role IN ('gestor', 'concesionaria', 'cliente')
        AND (u.role = 'cliente' OR u.parent_id IS NULL)
    `;
    const params = [];
    if (['gestor', 'concesionaria', 'cliente'].includes(role)) {
      sql += ' AND u.role = ?';
      params.push(role);
    }
    sql += ' ORDER BY u.name ASC';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
});

// Cambiar contraseña de un usuario administrado
router.patch('/users/:id/password', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const user = await get('SELECT id, role FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!['gestor', 'concesionaria', 'cliente'].includes(user.role)) {
      return res.status(403).json({ error: 'Solo puedes cambiar claves de usuarios administrados' });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
    res.json({ ok: true, message: 'Contraseña actualizada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

// Admin edita datos básicos del usuario
router.put('/users/:id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const user = await get('SELECT id, role FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!['gestor', 'concesionaria', 'cliente'].includes(user.role)) {
      return res.status(403).json({ error: 'Usuario no administrable' });
    }
    const { name, email } = req.body;
    await run('UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?',
      [name, email?.toLowerCase(), req.params.id]);

    if (user.role === 'gestor' && req.body.gestorProfile) {
      const { location, state, bio, whatsapp, schedule } = req.body.gestorProfile;
      await run(`
        UPDATE gestores SET
          name = COALESCE(?, name), location = COALESCE(?, location), state = COALESCE(?, state),
          bio = COALESCE(?, bio), whatsapp = COALESCE(?, whatsapp), schedule = COALESCE(?, schedule)
        WHERE user_id = ?
      `, [name, location, state, bio, whatsapp, schedule, req.params.id]);
    }

    const updated = await get('SELECT id, email, name, role, created_at as createdAt FROM users WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// ─── AUDITORÍA DE ORGS ──────────────────────────────────────

router.get('/orgs/:id/stats', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const orgId = req.params.id;
    const [clients, openDeals, billed] = await Promise.all([
      get('SELECT COUNT(*) as c FROM contacts WHERE user_id = ?', [orgId]),
      get("SELECT COUNT(*) as c FROM crm_deals WHERE user_id = ? AND stage NOT IN ('completado','perdido')", [orgId]),
      get("SELECT SUM(estimated_value) as s FROM crm_deals WHERE user_id = ? AND stage = 'completado'", [orgId])
    ]);
    res.json({
      clientsCount: clients?.c || 0,
      openDealsCount: openDeals?.c || 0,
      totalBilled: billed?.s || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estadísticas de org' });
  }
});

router.get('/orgs/:id/deals', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const orgId = req.params.id;
    const rows = await query(`
      SELECT d.id, d.title, d.stage, d.estimated_value as price, d.created_at as createdAt,
             c.name as clientName, c.email as clientEmail
      FROM crm_deals d
      LEFT JOIN contacts c ON c.id = d.contact_id
      WHERE d.user_id = ?
      ORDER BY d.created_at DESC
    `, [orgId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener trámites de org' });
  }
});

router.get('/deals/:id/messages', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const dealId = req.params.id;
    const messages = await query(`
      SELECT m.id, m.sender_id, m.message, m.file_url, m.created_at, u.name as sender_name, u.role as sender_role
      FROM chat_messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.deal_id = ?
      ORDER BY m.created_at ASC
    `, [dealId]);
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener mensajes del trámite' });
  }
});

// ─── GOOGLE ANALYTICS (OAuth + reportes globales) ─────────────────

router.get('/analytics/config', authRequired, requireRole('admin'), async (_req, res) => {
  try {
    res.json(await ga.getPublicConfig());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar configuración de Analytics' });
  }
});

router.put('/analytics/config', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const { measurementId, propertyId, googleClientId, googleClientSecret } = req.body;
    const config = await ga.updateConfig({ measurementId, propertyId, googleClientId, googleClientSecret });
    res.json(config);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar configuración' });
  }
});

router.get('/analytics/oauth/url', authRequired, requireRole('admin'), async (req, res) => {
  try {
    if (!(await ga.isConfigured())) {
      return res.status(503).json({
        error: 'Guarda primero el Client ID y Client Secret de Google en la configuración de Analytics.',
      });
    }
    const state = ga.createOAuthState(req.user.id);
    const url = await ga.getOAuthUrl(state);
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar OAuth' });
  }
});

router.get('/analytics/oauth/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    const redirect = ga.getFrontendRedirect('/panel/admin');
    if (error) {
      return res.redirect(`${redirect}?analytics=error&reason=${encodeURIComponent(error)}`);
    }
    if (!code || !state) {
      return res.redirect(`${redirect}?analytics=error&reason=missing_code`);
    }
    ga.verifyOAuthState(state);
    await ga.handleOAuthCallback(code);
    res.redirect(`${redirect}?analytics=connected`);
  } catch (err) {
    console.error('GA OAuth callback:', err);
    const redirect = ga.getFrontendRedirect('/panel/admin');
    res.redirect(`${redirect}?analytics=error&reason=${encodeURIComponent(err.message || 'oauth_failed')}`);
  }
});

router.get('/analytics/properties', authRequired, requireRole('admin'), async (_req, res) => {
  try {
    const properties = await ga.listProperties();
    res.json(properties);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al listar propiedades GA' });
  }
});

router.get('/analytics/dashboard', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 30));
    const data = await ga.getDashboard(days);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al cargar estadísticas de Analytics' });
  }
});

router.delete('/analytics/disconnect', authRequired, requireRole('admin'), async (_req, res) => {
  try {
    const config = await ga.disconnect();
    res.json(config);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al desconectar Analytics' });
  }
});

/** OneSignal: estado de configuración */
router.get('/push/status', authRequired, requireRole('admin'), (_req, res) => {
  res.json({ configured: isOneSignalConfigured() });
});

/** OneSignal: suscripciones registradas (diagnóstico) */
router.get('/push/subscriptions', authRequired, requireRole('admin'), async (_req, res) => {
  try {
    if (!isOneSignalConfigured()) {
      return res.json({ configured: false, subscriptions: [] });
    }
    const subscriptions = await listPushSubscriptions();
    const valid = subscriptions.filter(s => s.hasToken && !s.invalid && s.subscribed).length;
    res.json({ configured: true, validCount: valid, subscriptions });
  } catch (err) {
    console.error('push/subscriptions:', err);
    res.status(500).json({ error: err.message || 'Error al listar suscripciones' });
  }
});

/** OneSignal: historial de campañas enviadas */
router.get('/push/history', authRequired, requireRole('admin'), async (_req, res) => {
  try {
    const rows = await query(`
      SELECT id, title, body, url, audience_type as audienceType, audience_value as audienceValue,
             recipients, onesignal_id as onesignalId, created_at as createdAt
      FROM push_campaigns
      ORDER BY created_at DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar historial push' });
  }
});

/** OneSignal: enviar notificación push personalizada */
router.post('/push/send', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    const url = String(req.body?.url || '').trim();
    const audience = String(req.body?.audience || 'all').trim();
    const audienceValue = req.body?.audienceValue ? String(req.body.audienceValue).trim() : '';
    const testOnly = !!req.body?.testOnly;

    if (!title || title.length > 200) {
      return res.status(400).json({ error: 'El título es obligatorio (máx. 200 caracteres)' });
    }
    if (!body || body.length > 1000) {
      return res.status(400).json({ error: 'El mensaje es obligatorio (máx. 1000 caracteres)' });
    }
    if (!isOneSignalConfigured()) {
      return res.status(503).json({ error: 'OneSignal no está configurado en el servidor' });
    }

    const effectiveAudience = testOnly ? 'test' : audience;
    const result = await sendOneSignalPush({
      title,
      body,
      url: url || undefined,
      audience: effectiveAudience,
      audienceValue: effectiveAudience === 'user' ? audienceValue : undefined,
      adminUserId: req.user.id,
    });

    const campaignId = uuid();
    await run(`
      INSERT INTO push_campaigns
        (id, title, body, url, audience_type, audience_value, recipients, onesignal_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      campaignId,
      title,
      body,
      url || null,
      effectiveAudience,
      effectiveAudience === 'user' ? audienceValue : null,
      result.recipients,
      result.id || null,
      req.user.id,
    ]);

    res.json({
      ok: true,
      id: campaignId,
      onesignalId: result.id,
      recipients: result.recipients,
      delivered: result.delivered ?? result.recipients,
    });
  } catch (err) {
    console.error('push/send:', err);
    res.status(500).json({ error: err.message || 'Error al enviar notificación push' });
  }
});

export default router;
