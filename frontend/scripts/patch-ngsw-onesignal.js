/**
 * Fusiona OneSignal en el service worker de Angular PWA y publica
 * /OneSignalSDKWorker.js en la raíz (ruta que el SDK busca por defecto).
 */
const fs = require('fs');
const path = require('path');

const browserDir = path.join(__dirname, '..', 'dist', 'tramites-frontend', 'browser');
const ngswPath = path.join(browserDir, 'ngsw-worker.js');
const rootWorkerPath = path.join(browserDir, 'OneSignalSDKWorker.js');
const updaterWorkerPath = path.join(browserDir, 'OneSignalSDKUpdaterWorker.js');
const marker = 'OneSignalSDK.sw.js';
const prefix = 'importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");\n';

if (!fs.existsSync(ngswPath)) {
  console.warn('[patch-ngsw-onesignal] ngsw-worker.js no encontrado, omitiendo.');
  process.exit(0);
}

let content = fs.readFileSync(ngswPath, 'utf8');

if (!content.includes(marker)) {
  content = prefix + content;
  fs.writeFileSync(ngswPath, content, 'utf8');
  console.log('[patch-ngsw-onesignal] OneSignal importado en ngsw-worker.js');
} else {
  console.log('[patch-ngsw-onesignal] ngsw-worker.js ya incluye OneSignal.');
}

fs.writeFileSync(rootWorkerPath, content, 'utf8');
fs.writeFileSync(updaterWorkerPath, content, 'utf8');
console.log('[patch-ngsw-onesignal] OneSignalSDKWorker.js publicado en la raíz');
console.log('[patch-ngsw-onesignal] OneSignalSDKUpdaterWorker.js publicado en la raíz');
