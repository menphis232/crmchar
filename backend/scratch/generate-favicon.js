import sharp from 'sharp';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(__dirname, '../../frontend/src/assets/brand/favicono.png');
const outDir = path.join(__dirname, '../../frontend/src/assets/brand');

mkdirSync(outDir, { recursive: true });

/** Convierte grises/grunge a blanco y negro puro para que no salgan rayas al reducir. */
async function cleanSourceBuffer() {
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const threshold = 155;
  for (let i = 0; i < data.length; i += info.channels) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const v = lum >= threshold ? 255 : 0;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toBuffer();
}

/** Escalado por pasos + Lanczos para evitar artefactos en tamaños pequeños. */
async function resizeSteps(source, size) {
  const meta = await sharp(source).metadata();
  let current = meta.width;
  let buf = source;

  while (current > size) {
    const next = Math.max(size, Math.round(current / 2));
    buf = await sharp(buf)
      .resize(next, next, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
      .png({ compressionLevel: 6, palette: false })
      .toBuffer();
    current = next;
  }

  return buf;
}

async function squareIcon(cleanSource, size) {
  if (size <= 16) {
    const meta = await sharp(cleanSource).metadata();
    const cropTop = Math.round(meta.height * 0.38);
    return sharp(cleanSource)
      .extract({
        left: 0,
        top: cropTop,
        width: meta.width,
        height: meta.height - cropTop,
      })
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 1 },
        kernel: sharp.kernel.lanczos3,
      })
      .png({ compressionLevel: 6, palette: false })
      .toBuffer();
  }

  return resizeSteps(cleanSource, size);
}

const cleanSource = await cleanSourceBuffer();
writeFileSync(path.join(outDir, 'favicono-clean.png'), cleanSource);
console.log('✅ favicono-clean.png (maestro sin grunge)');

const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-48x48.png', size: 48 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-512x512.png', size: 512 },
];

const written = [];
for (const { name, size } of sizes) {
  const file = path.join(outDir, name);
  writeFileSync(file, await squareIcon(cleanSource, size));
  written.push(file);
  console.log(`✅ ${name}`);
}

try {
  const toIco = (await import('to-ico')).default;
  const ico = await toIco(written.slice(0, 3).map((f) => readFileSync(f)));
  writeFileSync(path.join(outDir, 'favicon.ico'), ico);
  writeFileSync(path.join(outDir, '../../favicon.ico'), ico);
  console.log('✅ favicon.ico');
} catch {
  const fallback = await squareIcon(cleanSource, 32);
  writeFileSync(path.join(outDir, 'favicon.ico'), fallback);
  writeFileSync(path.join(outDir, '../../favicon.ico'), fallback);
  console.log('✅ favicon.ico (fallback 32px PNG)');
}
