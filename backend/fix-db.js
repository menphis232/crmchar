import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  
  const cmd = `docker exec tramites-backend node -e "
    const mysql = require('mysql2/promise');
    async function run(){
      const c = await mysql.createConnection({
        host:'db',
        user:'root',
        password:process.env.DB_PASSWORD,
        database:'tramites_vehiculares'
      });
      try { await c.query('ALTER TABLE users ADD COLUMN page_builder_config JSON NULL DEFAULT NULL;'); console.log('page_builder_config added'); } catch(e) { console.log(e.message); }
      try { await c.query('ALTER TABLE solicitudes ADD COLUMN custom_data JSON NULL DEFAULT NULL;'); console.log('custom_data added'); } catch(e) { console.log(e.message); }
      c.end();
    }
    run().catch(console.error);
  "`;

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
