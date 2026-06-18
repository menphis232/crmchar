import sharp from 'sharp';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(__dirname, '../../frontend/src/assets/brand/favicono.png');
const outDir = path.join(__dirname, '../../frontend/src/assets/brand');

mkdirSync(outDir, { recursive: true });

async function squareIcon(size) {
  return sharp(sourcePath)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toBuffer();
}

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
  writeFileSync(file, await squareIcon(size));
  written.push(file);
  console.log(`✅ ${name}`);
}

try {
  const toIco = (await import('to-ico')).default;
  const ico = await toIco(written.slice(0, 3).map((f) => readFileSync(f)));
  writeFileSync(path.join(outDir, 'favicon.ico'), ico);
  writeFileSync(path.join(outDir, '../../favicon.ico'), ico);
  console.log('✅ favicon.ico');
} catch (err) {
  const fallback = await squareIcon(32);
  writeFileSync(path.join(outDir, 'favicon.ico'), fallback);
  writeFileSync(path.join(outDir, '../../favicon.ico'), fallback);
  console.log('✅ favicon.ico (fallback 32px PNG)');
}
