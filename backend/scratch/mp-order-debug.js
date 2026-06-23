import { get } from '../src/db.js';

const orderId = process.argv[2] || 'ORDTST01KVV628QTTHVHF7Q6Y4AEDS27';
const row = await get('SELECT mp_access_token FROM users WHERE mp_access_token IS NOT NULL AND mp_access_token != "" LIMIT 1');
if (!row?.mp_access_token) {
  console.log('No MP token');
  process.exit(1);
}
const res = await fetch(`https://api.mercadopago.com/v1/orders/${orderId}`, {
  headers: { Authorization: `Bearer ${row.mp_access_token}` },
});
const text = await res.text();
console.log(text);
process.exit(0);
