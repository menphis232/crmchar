/** URL pública del frontend (Stripe success/cancel, redirects). */
export function getFrontendBase() {
  return (
    process.env.FRONTEND_URL
    || 'https://central.tramitesvehicularesdemexico.com'
  ).replace(/\/$/, '');
}

export function redirectToFrontend(req, res, path) {
  const base = getFrontendBase();
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(302, `${base}${path}${query}`);
}
