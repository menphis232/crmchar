/** ID de la organización (titular) para gestor/concesionaria y sub-usuarios. */
export function orgId(req) {
  return req.user?.parent_id || req.user?.id;
}

export function staffHasPerm(req, mod) {
  if (!req.user?.parent_id) return true;
  let perms = req.user.permissions;
  if (typeof perms === 'string') {
    try {
      perms = JSON.parse(perms);
    } catch {
      return false;
    }
  }
  return Array.isArray(perms) && perms.includes(mod);
}

export function requireStaffPerm(mod) {
  return (req, res, next) => {
    if (!staffHasPerm(req, mod)) {
      return res.status(403).json({ error: 'No tienes permiso para esta sección' });
    }
    next();
  };
}
