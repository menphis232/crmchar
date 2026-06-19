import mysql from 'mysql2/promise';

const c = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tramites_vehiculares',
});

const [rows] = await c.query(
  "SELECT id, make, model, price, special_price FROM autos WHERE status = 'published' AND make = 'LAND ROVER' AND model LIKE 'Defender%' LIMIT 1"
);
const car = rows[0];
if (!car) {
  console.error('No hay autos publicados');
  process.exit(1);
}

await c.query('UPDATE autos SET special_price = NULL WHERE id = ?', [car.id]);
console.log(`✅ ${car.make} ${car.model}`);
console.log(`   Precio único: $${Number(car.price).toLocaleString('es-MX')}`);
console.log(`   (antes special_price: ${car.special_price ?? 'null'})`);

await c.end();
