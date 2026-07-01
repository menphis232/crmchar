/** Visibilidad de leads en concesionaria: empleados solo ven los asignados a ellos; el dueño ve todo. */

export function isConcesionariaStaff(user) {
  return user?.role === 'concesionaria' && !!user?.parent_id;
}

export function isOrgOwner(user) {
  return !user?.parent_id;
}

/** Filtro SQL para filas de crm_deals (empleado concesionaria). */
export function dealAccessFilter(user, alias = 'd') {
  if (!isConcesionariaStaff(user)) return { sql: '', params: [] };
  const col = alias ? `${alias}.assigned_to` : 'assigned_to';
  return { sql: ` AND ${col} = ?`, params: [user.id] };
}

export function canAccessDeal(user, deal) {
  if (!deal) return false;
  if (!isConcesionariaStaff(user)) return true;
  return deal.assigned_to === user.id;
}

/** Solo contactos con al menos un deal asignado al empleado. */
export function contactAccessFilter(user, orgId, dealType, contactAlias = 'c') {
  if (!isConcesionariaStaff(user)) return { sql: '', params: [] };
  return {
    sql: `EXISTS (
      SELECT 1 FROM crm_deals dca
      WHERE dca.contact_id = ${contactAlias}.id
        AND dca.user_id = ?
        AND dca.deal_type = ?
        AND dca.assigned_to = ?
    )`,
    params: [orgId, dealType, user.id],
  };
}
