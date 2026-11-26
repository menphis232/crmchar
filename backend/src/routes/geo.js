import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { lookupMxPostalCode } from '../utils/mx-cp.js';

const router = Router();

router.get('/mx-cp/:cp', authRequired, async (req, res) => {
  try {
    const result = await lookupMxPostalCode(req.params.cp);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo consultar el código postal' });
  }
});

export default router;
