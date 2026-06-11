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
      permissions: user.permissions
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado para esta acción' });
    }
    next();
  };
}
