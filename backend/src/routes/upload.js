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

const DOC_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

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

const docStorage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${uuid()}${ext.toLowerCase()}`);
  },
});

const uploadDocument = multer({
  storage: docStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (DOC_MIMES.has(file.mimetype) || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Usa PDF, imagen o Word/Excel.'));
    }
  },
});

const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']);

const uploadVideo = multer({
  storage: docStorage,
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (VIDEO_MIMES.has(file.mimetype) || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Formato no permitido. Usa MP4, WebM o MOV.'));
    }
  },
});

const router = Router();

const PUBLIC_BASE = (
  process.env.API_PUBLIC_URL ||
  process.env.FRONTEND_URL ||
  ''
).replace(/\/$/, '');

function buildPublicUploadUrl(req, filename) {
  if (PUBLIC_BASE) return `${PUBLIC_BASE}/uploads/${filename}`;
  const host = req.get('host');
  const protocol = req.protocol;
  return `${protocol}://${host}/uploads/${filename}`;
}

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

    const url = buildPublicUploadUrl(req, filename);
    
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al subir archivo' });
  }
});

router.post('/document', authRequired, uploadDocument.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún archivo' });
    }
    const url = buildPublicUploadUrl(req, req.file.filename);
    res.json({ url, fileName: req.file.originalname });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al subir documento' });
  }
});

router.post('/video', authRequired, uploadVideo.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún video' });
    }
    const url = buildPublicUploadUrl(req, req.file.filename);
    res.json({ url, fileName: req.file.originalname });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al subir video' });
  }
});

export default router;
