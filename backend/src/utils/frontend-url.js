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
  const dest = `${base}${path}${query}`;

  try {
    const frontendHost = new URL(base).host;
    if (req.get('host') === frontendHost) {
      console.warn(`Redirect loop prevented for ${path} (host=${frontendHost})`);
      return res.status(400).send(
        `<!DOCTYPE html><html lang="es"><body style="font-family:sans-serif;padding:2rem;background:#111;color:#fff;">`
        + `<p>Conflicto de proxy en desarrollo. Reinicia <code>ng serve</code>.</p>`
        + `<p><a href="${dest}" style="color:#c8a94a;">Continuar manualmente</a></p></body></html>`,
      );
    }
  } catch {
    // ignore invalid FRONTEND_URL
  }

  res.redirect(302, dest);
}
