import { Router } from 'express';
import {
  getPrecio,
  libroAzulStatus,
  listAnios,
  listMarcas,
  listModelos,
  listVersiones,
} from '../services/libroazul.js';

const router = Router();

function sendLibroError(res, err) {
  if (err.code === 'not_configured') {
    return res.status(503).json({
      error: 'Libro Azul no está configurado. Agrega LIBROAZUL_USER y LIBROAZUL_PASSWORD al .env del backend.',
      code: 'not_configured',
    });
  }
  console.error('[libroazul]', err.message, err.payload || '');
  return res.status(err.status && err.status >= 400 && err.status < 600 ? err.status : 502).json({
    error: err.message || 'Error al consultar Libro Azul',
    code: err.code || 'libroazul_error',
  });
}

/** Estado público (sin secretos): ¿hay credenciales? */
router.get('/status', (_req, res) => {
  res.json(libroAzulStatus());
});

router.get('/anios', async (_req, res) => {
  try {
    res.json({ items: await listAnios() });
  } catch (err) {
    sendLibroError(res, err);
  }
});

router.get('/marcas', async (req, res) => {
  try {
    const claveAnio = req.query.claveAnio;
    if (!claveAnio) return res.status(400).json({ error: 'Falta claveAnio' });
    res.json({ items: await listMarcas(claveAnio) });
  } catch (err) {
    sendLibroError(res, err);
  }
});

router.get('/modelos', async (req, res) => {
  try {
    const { claveAnio, claveMarca } = req.query;
    if (!claveAnio || !claveMarca) {
      return res.status(400).json({ error: 'Faltan claveAnio y claveMarca' });
    }
    res.json({ items: await listModelos(claveAnio, claveMarca) });
  } catch (err) {
    sendLibroError(res, err);
  }
});

/** Paso 2: versiones del auto (equivalente a la 2ª pantalla de libroazul.com). */
router.get('/versiones', async (req, res) => {
  try {
    const { claveAnio, claveMarca, claveModelo } = req.query;
    if (!claveAnio || !claveMarca || !claveModelo) {
      return res.status(400).json({ error: 'Faltan claveAnio, claveMarca y claveModelo' });
    }
    res.json({ items: await listVersiones(claveAnio, claveMarca, claveModelo) });
  } catch (err) {
    sendLibroError(res, err);
  }
});

router.get('/precio', async (req, res) => {
  try {
    const { claveVersion, kilometraje } = req.query;
    if (!claveVersion) return res.status(400).json({ error: 'Falta claveVersion' });
    const precio = await getPrecio(claveVersion, kilometraje);
    res.json(precio);
  } catch (err) {
    sendLibroError(res, err);
  }
});

export default router;
