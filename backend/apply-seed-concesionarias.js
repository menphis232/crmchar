/**
 * Crea concesionarias demo con inventario y galerías de fotos.
 * Idempotente: omite usuarios/autos que ya existen.
 * Password de todas las cuentas: demo1234
 */
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { randomUUID as uuid } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const PASSWORD = 'demo1234';
const HASH = bcrypt.hashSync(PASSWORD, 10);

const DEALERS = [
  {
    email: 'elite.gdl@demo.com',
    name: 'Elite Motors Guadalajara',
    slug: 'elite-motors-gdl',
    city: 'Guadalajara',
    autos: [
      {
        make: 'PORSCHE', model: 'Cayenne S', year: 2023, price: 2450000, mileage: 18000,
        desc: 'SUV premium en excelente estado. Un solo dueño, servicio agencia.',
        gallery: [
          'https://images.unsplash.com/photo-1503376713356-200d72f10255?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1618843479313-40f8afb4bce4?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1614162692292-7b37b7d83842?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1617531653332-bd46c24f2068?q=80&w=900&auto=format&fit=crop',
        ],
      },
      {
        make: 'AUDI', model: 'RS Q8', year: 2022, price: 2680000, mileage: 22000,
        desc: 'Audi RS Q8 con paquete Black Optic. Potencia y lujo en cada detalle.',
        gallery: [
          'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd2?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1618843479313-40f8afb4bce4?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1609521263047-f8f205293f24?q=80&w=900&auto=format&fit=crop',
        ],
      },
      {
        make: 'BMW', model: 'X5 M50i', year: 2024, price: 2190000, mileage: 8500,
        desc: 'BMW X5 M50i 2024. Equipamiento M Sport completo.',
        gallery: [
          'https://images.unsplash.com/photo-1555215695-3004980ad54e?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1494976388531-d1058494451e?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=900&auto=format&fit=crop',
        ],
      },
    ],
  },
  {
    email: 'velocity.qro@demo.com',
    name: 'Velocity Querétaro',
    slug: 'velocity-qro',
    city: 'Querétaro',
    autos: [
      {
        make: 'MERCEDES-BENZ', model: 'AMG GT 43', year: 2023, price: 2890000, mileage: 11000,
        desc: 'Mercedes-AMG GT 43 sedán deportivo. Impecable.',
        gallery: [
          'https://images.unsplash.com/photo-1520031441872-265e4ff70366?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1618843479313-40f8afb4bce4?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1617531653332-bd46c24f2068?q=80&w=900&auto=format&fit=crop',
        ],
      },
      {
        make: 'TESLA', model: 'Model S Plaid', year: 2024, price: 2650000, mileage: 5200,
        desc: 'Tesla Model S Plaid. Autonomía extendida y aceleración brutal.',
        gallery: [
          'https://images.unsplash.com/photo-1560958089-b825a2a08a09?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1617788138017-80ad40651399?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1620891541453-2241328f4892?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1619767886554-ef1f35bcbc2c?q=80&w=900&auto=format&fit=crop',
        ],
      },
      {
        make: 'LAND ROVER', model: 'Defender 110', year: 2022, price: 1980000, mileage: 31000,
        desc: 'Land Rover Defender 110. Capacidad off-road y confort premium.',
        gallery: [
          'https://images.unsplash.com/photo-1519641471654-76ceae7eb567?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd2?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=900&auto=format&fit=crop',
        ],
      },
    ],
  },
  {
    email: 'prestige.pue@demo.com',
    name: 'Prestige Auto Puebla',
    slug: 'prestige-puebla',
    city: 'Puebla',
    autos: [
      {
        make: 'LEXUS', model: 'LC 500', year: 2021, price: 1750000, mileage: 28000,
        desc: 'Lexus LC 500 coupé. Elegancia japonesa en estado excepcional.',
        gallery: [
          'https://images.unsplash.com/photo-1542362567-b07e54358753?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1494976388531-d1058494451e?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1502877338535-766e1452684a?q=80&w=900&auto=format&fit=crop',
        ],
      },
      {
        make: 'CADILLAC', model: 'Escalade Sport', year: 2023, price: 2350000, mileage: 15000,
        desc: 'Cadillac Escalade Sport Platinum. Espacio y tecnología de punta.',
        gallery: [
          'https://images.unsplash.com/photo-1519641471654-76ceae7eb567?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=900&auto=format&fit=crop',
        ],
      },
      {
        make: 'VOLVO', model: 'XC90 Recharge', year: 2024, price: 1680000, mileage: 9000,
        desc: 'Volvo XC90 híbrido enchufable. Seguridad y sostenibilidad.',
        gallery: [
          'https://images.unsplash.com/photo-1617468765124-268b0758cc72?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1609521263047-f8f205293f24?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd2?q=80&w=900&auto=format&fit=crop',
        ],
      },
    ],
  },
  {
    email: 'capital.select@demo.com',
    name: 'Capital Select CDMX',
    slug: 'capital-select-cdmx',
    city: 'CDMX (Santa Fe)',
    autos: [
      {
        make: 'FERRARI', model: 'Roma', year: 2022, price: 6200000, mileage: 6800,
        desc: 'Ferrari Roma V8 biturbo. Gran turismo italiano de colección.',
        gallery: [
          'https://images.unsplash.com/photo-1583121274602-3e2820c50d68?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1614162692292-7b37b7d83842?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1544636331-e26879cd4d9f?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1503376713356-200d72f10255?q=80&w=900&auto=format&fit=crop',
        ],
      },
      {
        make: 'LAMBORGHINI', model: 'Urus', year: 2023, price: 5800000, mileage: 9200,
        desc: 'Lamborghini Urus. Super SUV con ADAS y interior Alcantara.',
        gallery: [
          'https://images.unsplash.com/photo-1544636331-e26879cd4d9f?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1583121274602-3e2820c50d68?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1618843479313-40f8afb4bce4?q=80&w=900&auto=format&fit=crop',
        ],
      },
      {
        make: 'MERCEDES-BENZ', model: 'S 580 Maybach', year: 2024, price: 4500000, mileage: 4000,
        desc: 'Mercedes-Maybach S 580. Máximo lujo ejecutivo.',
        gallery: [
          'https://images.unsplash.com/photo-1520031441872-265e4ff70366?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1617531653332-bd46c24f2068?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1614162692292-7b37b7d83842?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1609521263047-f8f205293f24?q=80&w=900&auto=format&fit=crop',
        ],
      },
      {
        make: 'PORSCHE', model: 'Taycan Turbo S', year: 2024, price: 3900000, mileage: 3500,
        desc: 'Porsche Taycan Turbo S eléctrico. 0-100 en 2.8 segundos.',
        gallery: [
          'https://images.unsplash.com/photo-1614162692292-7b37b7d83842?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1503376713356-200d72f10255?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1619767886554-ef1f35bcbc2c?q=80&w=900&auto=format&fit=crop',
        ],
      },
    ],
  },
  {
    email: 'norte.premium@demo.com',
    name: 'Norte Premium Monterrey',
    slug: 'norte-premium-mty',
    city: 'Monterrey',
    autos: [
      {
        make: 'BMW', model: 'M8 Competition', year: 2023, price: 3200000, mileage: 14000,
        desc: 'BMW M8 Competition Gran Coupé. 617 HP de pura emoción.',
        gallery: [
          'https://images.unsplash.com/photo-1555215695-3004980ad54e?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1494976388531-d1058494451e?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=900&auto=format&fit=crop',
        ],
      },
      {
        make: 'AUDI', model: 'R8 V10', year: 2022, price: 4100000, mileage: 7600,
        desc: 'Audi R8 V10 performance. Motor central atmosférico.',
        gallery: [
          'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd2?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1544636331-e26879cd4d9f?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1583121274602-3e2820c50d68?q=80&w=900&auto=format&fit=crop',
        ],
      },
      {
        make: 'JEEP', model: 'Grand Wagoneer', year: 2024, price: 2100000, mileage: 6000,
        desc: 'Jeep Grand Wagoneer Series III. SUV americano full size.',
        gallery: [
          'https://images.unsplash.com/photo-1519641471654-76ceae7eb567?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=900&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1502877338535-766e1452684a?q=80&w=900&auto=format&fit=crop',
        ],
      },
    ],
  },
];

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tramites_vehiculares',
});

async function ensureDealer(dealer) {
  const [rows] = await c.query('SELECT id FROM users WHERE email = ?', [dealer.email]);
  if (rows.length) {
    await c.query('UPDATE users SET slug = COALESCE(slug, ?), status = ? WHERE id = ?', [
      dealer.slug, 'active', rows[0].id,
    ]);
    console.log(`↪ Concesionaria existente: ${dealer.name} (${dealer.email})`);
    return rows[0].id;
  }

  const userId = uuid();
  await c.query(
    'INSERT INTO users (id, email, password_hash, role, name, status, slug) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, dealer.email, HASH, 'concesionaria', dealer.name, 'active', dealer.slug],
  );
  console.log(`✅ Concesionaria creada: ${dealer.name} (${dealer.email})`);
  return userId;
}

async function ensureAuto(userId, dealerName, city, auto) {
  const [existing] = await c.query(
    'SELECT id FROM autos WHERE user_id = ? AND make = ? AND model = ? AND year = ? LIMIT 1',
    [userId, auto.make, auto.model, auto.year],
  );
  if (existing.length) {
    console.log(`   ↪ Auto ya existe: ${auto.make} ${auto.model} ${auto.year}`);
    return;
  }

  const id = uuid();
  const gallery = auto.gallery?.length ? auto.gallery : [auto.gallery?.[0]].filter(Boolean);
  const mainImage = gallery[0];

  await c.query(
    `INSERT INTO autos (
      id, user_id, make, model, year, price, mileage, transmission,
      location, description, image_url, images, dealer_name, status, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, userId, auto.make, auto.model, auto.year, auto.price, auto.mileage,
      'Automático', city, auto.desc, mainImage, JSON.stringify(gallery),
      dealerName, 'published', 1,
    ],
  );
  console.log(`   ✅ Auto: ${auto.make} ${auto.model} (${gallery.length} fotos)`);
}

let dealersCreated = 0;
let autosCreated = 0;

for (const dealer of DEALERS) {
  const before = autosCreated;
  const userId = await ensureDealer(dealer);
  for (const auto of dealer.autos) {
    const [beforeCount] = await c.query(
      'SELECT COUNT(*) as c FROM autos WHERE user_id = ? AND make = ? AND model = ? AND year = ?',
      [userId, auto.make, auto.model, auto.year],
    );
    await ensureAuto(userId, dealer.name, dealer.city, auto);
    const [afterCount] = await c.query(
      'SELECT COUNT(*) as c FROM autos WHERE user_id = ? AND make = ? AND model = ? AND year = ?',
      [userId, auto.make, auto.model, auto.year],
    );
    if (afterCount[0].c > beforeCount[0].c) autosCreated++;
  }
  if (before === autosCreated) dealersCreated++;
}

const [totals] = await c.query(`
  SELECT
    (SELECT COUNT(*) FROM users WHERE role = 'concesionaria') AS dealers,
    (SELECT COUNT(*) FROM autos WHERE status = 'published' OR active = 1) AS autos
`);

await c.end();

console.log('');
console.log('✅ Seed concesionarias completado');
console.log(`   Nuevos autos insertados en esta corrida: ${autosCreated}`);
console.log(`   Total concesionarias en BD: ${totals[0].dealers}`);
console.log(`   Total autos publicados: ${totals[0].autos}`);
console.log(`   Password de acceso: ${PASSWORD}`);
