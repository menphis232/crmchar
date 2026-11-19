/** Usuarios con socket activo: userId → Set<socketId> */
const onlineByUser = new Map();

export function markOnline(userId, socketId) {
  if (!userId || !socketId) return;
  const id = String(userId);
  let set = onlineByUser.get(id);
  if (!set) {
    set = new Set();
    onlineByUser.set(id, set);
  }
  set.add(String(socketId));
}

export function markOffline(userId, socketId) {
  if (!userId) return;
  const id = String(userId);
  const set = onlineByUser.get(id);
  if (!set) return;
  set.delete(String(socketId));
  if (!set.size) onlineByUser.delete(id);
}

export function isUserOnline(userId) {
  if (!userId) return false;
  const set = onlineByUser.get(String(userId));
  return !!(set && set.size);
}

export function listOnlineUserIds() {
  return [...onlineByUser.keys()];
}
