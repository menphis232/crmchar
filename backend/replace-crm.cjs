const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'routes', 'crm.js');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/req\.user\.id/g, 'req.orgId');

// We need to inject req.orgId in the crmRoles middleware
const crmRolesRegex = /function crmRoles\(req, res, next\) \{\s+if \(\!\['gestor', 'concesionaria'\]\.includes\(req\.user\?\.role\)\) \{\s+return res\.status\(403\)\.json\(\{ error: 'No autorizado' \}\);\s+\}\s+next\(\);\s+\}/;

const newCrmRoles = `function crmRoles(req, res, next) {
  if (!['gestor', 'concesionaria'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  req.orgId = req.user.parent_id || req.user.id;
  next();
}`;

content = content.replace(crmRolesRegex, newCrmRoles);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Replaced req.user.id with req.orgId in crm.js');
