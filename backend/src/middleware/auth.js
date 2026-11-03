import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'tramites-dev-secret-change-in-prod';

export function signToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role, 
      name: user.name,
      parent_id: user.parent_id,
      permissions: user.permissions,
      status: user.status,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function readBearerOrQueryToken(req) {
  const header = req.headers.authorization;
  const queryToken = req.query.token;
  return header?.startsWith('Bearer ') ? header.slice(7) : queryToken;
}

export function authRequired(req, res, next) {
  // Also support token via query string (for direct download links)
  const rawToken = readBearerOrQueryToken(req);
  if (!rawToken) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    req.user = jwt.verify(rawToken, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/** Adjunta req.user si hay JWT válido; si no, continúa como visitante. */
export function authOptional(req, res, next) {
  const rawToken = readBearerOrQueryToken(req);
  if (!rawToken) return next();
  try {
    req.user = jwt.verify(rawToken, JWT_SECRET);
  } catch {
    /* token inválido: tratar como anónimo */
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado para esta acción' });
    }
    next();
  };
}
