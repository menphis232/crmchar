const appId = process.env.ONESIGNAL_APP_ID;
const key = process.env.ONESIGNAL_REST_API_KEY;
if (!appId || !key) {
  console.error('Missing ONESIGNAL env');
  process.exit(1);
}
const headers = {
  Authorization: `Key ${key}`,
  'Content-Type': 'application/json',
};

async function get(url) {
  const res = await fetch(url, { headers: { Authorization: headers.Authorization } });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

console.log('=== PLAYERS ===');
const players = await get(`https://api.onesignal.com/players?app_id=${appId}&limit=50`);
for (const p of players.data.players || []) {
  console.log(JSON.stringify({
    id: p.id,
    os: p.device_os,
    model: p.device_model,
    types: p.notification_types,
    invalid: p.invalid_identifier,
    token: p.identifier ? `${String(p.identifier).slice(0, 24)}...` : null,
    ext: p.external_user_id || null,
    tags: p.tags || {},
    last: p.last_active,
  }));
}

console.log('\n=== RECENT NOTIFICATIONS ===');
const notifs = await get(`https://api.onesignal.com/notifications?app_id=${appId}&limit=10&kind=0`);
for (const n of notifs.data.notifications || []) {
  console.log(JSON.stringify({
    id: n.id,
    headings: n.headings,
    successful: n.successful,
    failed: n.failed,
    errored: n.errored,
    remaining: n.remaining,
    queued_at: n.queued_at,
    completed_at: n.completed_at,
    included_segments: n.included_segments,
    include_aliases: n.include_aliases,
  }));
}

const withExt = (players.data.players || []).find(p => p.external_user_id && Number(p.notification_types) === 1);
if (withExt) {
  console.log('\n=== TEST SEND external_id ===', withExt.external_user_id);
  const send = await post('https://api.onesignal.com/notifications', {
    app_id: appId,
    target_channel: 'push',
    include_aliases: { external_id: [String(withExt.external_user_id)] },
    headings: { es: 'Diag CRM', en: 'Diag CRM' },
    contents: { es: `Prueba API ${new Date().toISOString()}`, en: `API test ${new Date().toISOString()}` },
  });
  console.log('create', send.status, JSON.stringify(send.data));
  if (send.data.id) {
    await new Promise(r => setTimeout(r, 4000));
    const stat = await get(`https://api.onesignal.com/notifications/${send.data.id}?app_id=${appId}`);
    console.log('delivery', JSON.stringify({
      successful: stat.data.successful,
      failed: stat.data.failed,
      errored: stat.data.errored,
      platform_delivery_stats: stat.data.platform_delivery_stats,
    }));
  }
}
