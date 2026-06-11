import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');

  const cmd = `sed -i "s/cors({ origin: \\['http:\\/\\/localhost:4200', 'http:\\/\\/127.0.0.1:4200'\\] })/cors({ origin: '*' })/g" /root/crmchar/backend/src/index.js
cd /root/crmchar
docker compose up -d --build backend
`;

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '2.25.197.82',
  port: 22,
  username: 'root',
  password: '24@Camila@232'
});
