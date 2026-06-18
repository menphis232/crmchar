import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
const ogCacheDir = path.join(uploadDir, 'og');

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

export async function generateDealerOgImage(logoUrl, slug) {
  if (!logoUrl || !slug) return null;

  const logoPath = resolveLogoPath(logoUrl);
  if (!logoPath || !fs.existsSync(logoPath)) return null;

  if (!fs.existsSync(ogCacheDir)) {
    fs.mkdirSync(ogCacheDir, { recursive: true });
  }

  const outPath = path.join(ogCacheDir, `dealer-${slug}.jpg`);
  const logoStat = fs.statSync(logoPath);

  if (fs.existsSync(outPath)) {
    const outStat = fs.statSync(outPath);
    if (outStat.mtimeMs >= logoStat.mtimeMs) {
      return outPath;
    }
  }

  const logoBuffer = await sharp(logoPath)
    .resize({
      width: Math.round(OG_WIDTH * 0.7),
      height: Math.round(OG_HEIGHT * 0.7),
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

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
