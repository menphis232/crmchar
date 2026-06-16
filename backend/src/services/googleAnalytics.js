import jwt from 'jsonwebtoken';
import { get, run } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'tramites-dev-secret-change-in-prod';
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3000/api/admin/analytics/oauth/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4201';
const SCOPES = 'https://www.googleapis.com/auth/analytics.readonly';

async function getOAuthCredentials() {
  const s = await getSettings();
  return {
    clientId: s?.google_client_id || process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: s?.google_client_secret || process.env.GOOGLE_CLIENT_SECRET || '',
  };
}

export async function isConfigured() {
  const { clientId, clientSecret } = await getOAuthCredentials();
  return !!(clientId && clientSecret);
}

export async function getSettings() {
  return get('SELECT * FROM analytics_settings WHERE id = 1');
}

export async function getPublicConfig() {
  const s = await getSettings();
  const oauthConfigured = await isConfigured();
  return {
    connected: !!(s?.refresh_token),
    measurementId: s?.measurement_id || null,
    propertyId: s?.property_id || null,
    connectedEmail: s?.connected_email || null,
    googleClientId: s?.google_client_id || null,
    hasClientSecret: !!(s?.google_client_secret || process.env.GOOGLE_CLIENT_SECRET),
    oauthConfigured,
    oauthRedirectUri: REDIRECT_URI,
  };
}

export async function updateConfig({ measurementId, propertyId, googleClientId, googleClientSecret }) {
  const exists = await get('SELECT id FROM analytics_settings WHERE id = 1');
  if (!exists) {
    await run(
      `INSERT INTO analytics_settings (id, measurement_id, property_id, google_client_id, google_client_secret)
       VALUES (1, ?, ?, ?, ?)`,
      [
        measurementId || null,
        propertyId || null,
        googleClientId || null,
        googleClientSecret || null,
      ],
    );
  } else {
    const sets = [];
    const params = [];
    if (measurementId !== undefined) { sets.push('measurement_id = ?'); params.push(measurementId || null); }
    if (propertyId !== undefined) { sets.push('property_id = ?'); params.push(propertyId || null); }
    if (googleClientId !== undefined) { sets.push('google_client_id = ?'); params.push(googleClientId || null); }
    if (googleClientSecret) { sets.push('google_client_secret = ?'); params.push(googleClientSecret); }
    if (sets.length) {
      await run(`UPDATE analytics_settings SET ${sets.join(', ')} WHERE id = 1`, params);
    }
  }
  return getPublicConfig();
}

export async function disconnect() {
  await run(`
    UPDATE analytics_settings SET
      access_token = NULL,
      refresh_token = NULL,
      token_expiry = NULL,
      connected_email = NULL,
      property_id = NULL
    WHERE id = 1
  `);
  return getPublicConfig();
}

export function createOAuthState(adminId) {
  return jwt.sign({ purpose: 'ga_oauth', adminId }, JWT_SECRET, { expiresIn: '15m' });
}

export function verifyOAuthState(state) {
  const payload = jwt.verify(state, JWT_SECRET);
  if (payload.purpose !== 'ga_oauth') throw new Error('Estado OAuth inválido');
  return payload;
}

export async function getOAuthUrl(state) {
  const { clientId } = await getOAuthCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function getFrontendRedirect(path = '/panel/admin') {
  return `${FRONTEND_URL.replace(/\/$/, '')}${path}`;
}

async function exchangeCode(code) {
  const { clientId, clientSecret } = await getOAuthCredentials();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Error OAuth');
  return data;
}

async function refreshAccessToken(refreshToken) {
  const { clientId, clientSecret } = await getOAuthCredentials();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Error al renovar token');
  return data;
}

async function fetchUserEmail(accessToken) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.email || null;
  } catch {
    return null;
  }
}

export async function handleOAuthCallback(code) {
  const tokens = await exchangeCode(code);
  const email = await fetchUserEmail(tokens.access_token);
  const expiry = Date.now() + (tokens.expires_in || 3600) * 1000;

  const exists = await get('SELECT id FROM analytics_settings WHERE id = 1');
  if (!exists) {
    await run(
      `INSERT INTO analytics_settings (id, access_token, refresh_token, token_expiry, connected_email)
       VALUES (1, ?, ?, ?, ?)`,
      [tokens.access_token, tokens.refresh_token || null, expiry, email],
    );
  } else {
    await run(
      `UPDATE analytics_settings SET
        access_token = ?,
        refresh_token = COALESCE(?, refresh_token),
        token_expiry = ?,
        connected_email = ?
       WHERE id = 1`,
      [tokens.access_token, tokens.refresh_token || null, expiry, email],
    );
  }
  return getPublicConfig();
}

export async function getValidAccessToken() {
  const s = await getSettings();
  if (!s?.refresh_token && !s?.access_token) return null;

  if (s.access_token && s.token_expiry && s.token_expiry > Date.now() + 60_000) {
    return s.access_token;
  }

  if (!s.refresh_token) return s.access_token || null;

  const tokens = await refreshAccessToken(s.refresh_token);
  const expiry = Date.now() + (tokens.expires_in || 3600) * 1000;
  await run(
    'UPDATE analytics_settings SET access_token = ?, token_expiry = ? WHERE id = 1',
    [tokens.access_token, expiry],
  );
  return tokens.access_token;
}

function parseMetricRow(row, metricNames) {
  const out = {};
  metricNames.forEach((name, i) => {
    out[name] = Number(row.metricValues?.[i]?.value || 0);
  });
  return out;
}

async function gaFetch(path, accessToken, body) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Error al consultar Google Analytics');
  }
  return data;
}

export async function listProperties() {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return [];

  const res = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Error al listar propiedades');

  const properties = [];
  for (const account of data.accountSummaries || []) {
    for (const prop of account.propertySummaries || []) {
      const rawId = (prop.property || '').replace('properties/', '');
      properties.push({
        propertyId: rawId,
        displayName: prop.displayName || rawId,
        accountName: account.displayName || account.account || '',
      });
    }
  }
  return properties;
}

export async function getDashboard(days = 30) {
  const s = await getSettings();
  const accessToken = await getValidAccessToken();
  if (!accessToken || !s?.property_id) {
    return { connected: false, needsProperty: !s?.property_id };
  }

  const propertyPath = `properties/${s.property_id}`;
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'today' }];

  const [overviewRes, devicesRes, pagesRes, dailyRes] = await Promise.all([
    gaFetch(`${propertyPath}:runReport`, accessToken, {
      dateRanges,
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
      ],
    }),
    gaFetch(`${propertyPath}:runReport`, accessToken, {
      dateRanges,
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    }),
    gaFetch(`${propertyPath}:runReport`, accessToken, {
      dateRanges,
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 8,
    }),
    gaFetch(`${propertyPath}:runReport`, accessToken, {
      dateRanges,
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    }),
  ]);

  const overviewRow = overviewRes.rows?.[0];
  const overview = overviewRow
    ? parseMetricRow(overviewRow, ['sessions', 'activeUsers', 'screenPageViews'])
    : { sessions: 0, activeUsers: 0, screenPageViews: 0 };

  const devices = (devicesRes.rows || []).map(row => ({
    device: row.dimensionValues?.[0]?.value || 'unknown',
    ...parseMetricRow(row, ['sessions', 'activeUsers']),
  }));

  const topPages = (pagesRes.rows || []).map(row => ({
    path: row.dimensionValues?.[0]?.value || '/',
    views: Number(row.metricValues?.[0]?.value || 0),
  }));

  const daily = (dailyRes.rows || []).map(row => {
    const raw = row.dimensionValues?.[0]?.value || '';
    const formatted = raw.length === 8
      ? `${raw.slice(6, 8)}/${raw.slice(4, 6)}`
      : raw;
    return {
      date: formatted,
      sessions: Number(row.metricValues?.[0]?.value || 0),
    };
  });

  return {
    connected: true,
    periodDays: days,
    overview,
    devices,
    topPages,
    daily,
  };
}
