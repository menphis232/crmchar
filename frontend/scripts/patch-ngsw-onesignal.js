/**
 * Fusiona OneSignal en el service worker de Angular PWA.
 * Sin esto, en Android la PWA registra ngsw-worker y OneSignal no puede suscribir push.
 */
const fs = require('fs');
const path = require('path');

const browserDir = path.join(__dirname, '..', 'dist', 'tramites-frontend', 'browser');
const ngswPath = path.join(browserDir, 'ngsw-worker.js');

if (!fs.existsSync(ngswPath)) {
  console.warn('[patch-ngsw-onesignal] ngsw-worker.js no encontrado, omitiendo.');
  process.exit(0);
}

const marker = 'OneSignalSDK.sw.js';
let content = fs.readFileSync(ngswPath, 'utf8');

if (content.includes(marker)) {
  console.log('[patch-ngsw-onesignal] Ya parcheado.');
  process.exit(0);
}

const prefix = 'importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");\n';
fs.writeFileSync(ngswPath, prefix + content, 'utf8');
console.log('[patch-ngsw-onesignal] OneSignal importado en ngsw-worker.js');
