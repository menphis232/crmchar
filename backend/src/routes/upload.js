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
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  }
});

function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'La imagen es muy pesada (máx. 12 MB). Intenta recortarla de nuevo.' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

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

function buildPublicUploadUrl(_req, filename) {
  // Ruta relativa: funciona en dev (proxy ng) y en prod (nginx) sin depender del dominio
  return `/uploads/${filename}`;
}

router.post('/', authRequired, handleUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún archivo' });
    }

    const isPng = req.file.mimetype === 'image/png';
    const ext = isPng ? 'png' : 'jpg';
    const filename = `${uuid()}.${ext}`;
    const outputPath = path.join(uploadDir, filename);

    let pipeline = sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true });

    if (isPng) {
      await pipeline.png({ compressionLevel: 9, quality: 90 }).toFile(outputPath);
    } else {
      await pipeline.jpeg({ quality: 85, mozjpeg: true }).toFile(outputPath);
    }

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
