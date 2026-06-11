import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import sharp from 'sharp';
import { authRequired } from '../middleware/auth.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Use memory storage to process with sharp
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
});

const router = Router();

router.post('/', authRequired, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún archivo' });
    }
    
    // Convert to png with sharp and save to disk
    const filename = `${uuid()}.png`;
    const outputPath = path.join(uploadDir, filename);
    
    await sharp(req.file.buffer)
      .png()
      .toFile(outputPath);

    const host = req.get('host');
    const protocol = req.protocol;
    const url = `${protocol}://${host}/uploads/${filename}`;
    
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al subir archivo' });
  }
});

export default router;
