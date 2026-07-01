import { get } from '../db.js';

/** Bloquea acciones del panel si la suscripción del titular no está activa. */
export async function requireActiveSubscription(req, res, next) {
  if (!['gestor', 'concesionaria', 'perito'].includes(req.user?.role)) {
    return next();
  }

  const orgId = req.user.role === 'perito' ? req.user.parent_id : (req.user.parent_id || req.user.id);
  const org = await get('SELECT status FROM users WHERE id = ?', [orgId]);

  if (!org || org.status === 'active') {
    return next();
  }

  if (org.status === 'pending_payment') {
    return res.status(402).json({
      error: 'Tu suscripción está pendiente de pago. Activa tu cuenta para usar el panel.',
      code: 'PENDING_PAYMENT',
    });
  }

  if (org.status === 'deactivated') {
    return res.status(403).json({
      error: 'Tu cuenta está desactivada por falta de pago. Contacta soporte o actualiza tu método de pago.',
      code: 'DEACTIVATED',
    });
  }

  return next();
}

export function isSubscriptionActive(status) {
  return !status || status === 'active';
}
