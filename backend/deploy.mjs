import { Client } from 'ssh2';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const privateKey = readFileSync(join(homedir(), '.ssh', 'id_ed25519'));

const CONFIGS = [
  { host: '2.25.197.82', port: 22,   auth: 'key' },
  { host: '2.25.197.82', port: 22,   auth: 'pass' },
  { host: '2.25.197.82', port: 2222, auth: 'key' },
  { host: '2.25.197.82', port: 2222, auth: 'pass' },
  { host: '2.25.197.82', port: 2200, auth: 'key' },
];

async function tryConnect(cfg) {
  return new Promise((resolve) => {
    const conn = new Client();
    const timer = setTimeout(() => { conn.destroy(); resolve({ success: false, cfg, error: 'TIMEOUT' }); }, 12000);
    conn.on('ready', () => { clearTimeout(timer); resolve({ success: true, conn, cfg }); });
    conn.on('error', (e) => { clearTimeout(timer); resolve({ success: false, cfg, error: e.message }); });

    const opts = {
      host: cfg.host,
      port: cfg.port,
      username: 'root',
      readyTimeout: 11000,
    };
    if (cfg.auth === 'key') {
      opts.privateKey = privateKey;
    } else {
      opts.password = '24@Camila@232';
    }
    conn.connect(opts);
  });
}

async function runCmd(conn, cmd) {
  return new Promise((resolve, reject) => {
    console.log(`\n$ ${cmd}`);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', d => { process.stdout.write(d.toString()); out += d; });
      stream.stderr.on('data', d => process.stderr.write(d.toString()));
      stream.on('close', () => resolve(out));
    });
  });
}

let connected = null;
let connCfg = null;
for (const cfg of CONFIGS) {
  process.stdout.write(`Trying ${cfg.host}:${cfg.port} (${cfg.auth})... `);
  const r = await tryConnect(cfg);
  if (r.success) {
    console.log('✅ Conectado!');
    connected = r.conn;
    connCfg = cfg;
    break;
  } else {
    console.log(`❌ ${r.error}`);
  }
}

if (!connected) {
  console.error('\n❌ No se pudo conectar al servidor por SSH en ningún puerto/método.');
  console.error('   El servidor posiblemente tiene whitelist de IPs en el firewall SSH.');
  process.exit(1);
}

try {
  console.log('\n=== ESTRUCTURA DEL SERVIDOR ===');
  await runCmd(connected, 'ls /');
  await runCmd(connected, 'ls /root');
  await runCmd(connected, 'docker ps --format "{{.Names}}\\t{{.Ports}}" 2>/dev/null || echo "docker no disponible"');
  await runCmd(connected, 'find / -name "docker-compose.yml" 2>/dev/null | grep -v proc | grep -v sys | head -10');
} finally {
  connected.end();
}
