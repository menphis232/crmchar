import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
const ogCacheDir = path.join(uploadDir, 'og');
const brandAssetsDir = path.join(__dirname, '..', '..', 'assets');

async function composeOgImage(logoBuffer, outPath) {
  const { width = 0, height = 0 } = await sharp(logoBuffer).metadata();
  const left = Math.max(0, Math.round((OG_WIDTH - width) / 2));
  const top = Math.max(0, Math.round((OG_HEIGHT - height) / 2));

  await sharp({
    create: {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite([{ input: logoBuffer, left, top }])
    .jpeg({ quality: 90 })
    .toFile(outPath);

  return outPath;
}

async function logoBufferFromPath(logoPath, maxScale = 0.7) {
  return sharp(logoPath)
    .resize({
      width: Math.round(OG_WIDTH * maxScale),
      height: Math.round(OG_HEIGHT * maxScale),
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();
}

function resolveLogoPath(logoUrl) {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('/uploads/')) {
    return path.join(uploadDir, path.basename(logoUrl));
  }
  if (/^https?:\/\//i.test(logoUrl)) {
    try {
      const { pathname } = new URL(logoUrl);
      if (pathname.startsWith('/uploads/')) {
        return path.join(uploadDir, path.basename(pathname));
      }
    } catch {
      return null;
    }
  }
  return null;
}

async function generateLogoOgImage(logoUrl, slug, prefix) {
  if (!logoUrl || !slug) return null;

  const logoPath = resolveLogoPath(logoUrl);
  if (!logoPath || !fs.existsSync(logoPath)) return null;

  if (!fs.existsSync(ogCacheDir)) {
    fs.mkdirSync(ogCacheDir, { recursive: true });
  }

  const outPath = path.join(ogCacheDir, `${prefix}-${slug}.jpg`);
  const logoStat = fs.statSync(logoPath);

  if (fs.existsSync(outPath)) {
    const outStat = fs.statSync(outPath);
    if (outStat.mtimeMs >= logoStat.mtimeMs) {
      return outPath;
    }
  }

  const logoBuffer = await logoBufferFromPath(logoPath);
  return composeOgImage(logoBuffer, outPath);
}

export async function generateDealerOgImage(logoUrl, slug) {
  return generateLogoOgImage(logoUrl, slug, 'dealer');
}

export async function generateGestorOgImage(logoUrl, slug) {
  return generateLogoOgImage(logoUrl, slug, 'gestor');
}

export async function generateAutosOgImage() {
  const logoPath = path.join(brandAssetsDir, 'tvm-logo.png');
  if (!fs.existsSync(logoPath)) return null;

  if (!fs.existsSync(ogCacheDir)) {
    fs.mkdirSync(ogCacheDir, { recursive: true });
  }

  const outPath = path.join(ogCacheDir, 'autos.jpg');
  const logoStat = fs.statSync(logoPath);

  if (fs.existsSync(outPath)) {
    const outStat = fs.statSync(outPath);
    if (outStat.mtimeMs >= logoStat.mtimeMs) {
      return outPath;
    }
  }

  const logoBuffer = await logoBufferFromPath(logoPath, 0.65);
  return composeOgImage(logoBuffer, outPath);
}
