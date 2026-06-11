import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  const cmd = `docker exec tramites-backend node -e "
    const mysql = require('mysql2/promise');
    async function run(){
      const c = await mysql.createConnection({
        host:'db',
        user:'root',
        password:process.env.DB_PASSWORD,
        database:'tramites_vehiculares'
      });
      const [rows] = await c.query('DESCRIBE users;');
      console.log(rows.map(r => r.Field).join(', '));
      c.end();
    }
    run().catch(console.error);
  "`;
  conn.exec(cmd, (err, stream) => {
    stream.on('data', (data) => console.log(''+data)).on('close', () => conn.end());
  });
}).connect({ host: '2.25.197.82', port: 22, username: 'root', password: '24@Camila@232' });
