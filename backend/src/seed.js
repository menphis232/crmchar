import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';
import { get, run } from './db.js';

dotenv.config();

const DEMO_PASSWORD = 'demo1234';
const users = [
  { email: 'gestor@demo.com', role: 'gestor', name: 'Gestoría López' },
  { email: 'concesionaria@demo.com', role: 'concesionaria', name: 'Autos Premium S.A.' },
  { email: 'concesionaria2@demo.com', role: 'concesionaria', name: 'AutoLuxury MTY' },
];

const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);

async function seed() {
  console.log('Sembrando base de datos MySQL...');

  const row = await get('SELECT COUNT(*) as c FROM users');
  if (row.c > 0) {
    console.log('Ya existen datos. Saltando seed.');
    process.exit(0);
  }

  for (const u of users) {
    const userId = uuid();
    await run('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)',
      [userId, u.email, hash, u.role, u.name]);

    if (u.role === 'gestor') {
      const gestorId = uuid();
      await run(`
        INSERT INTO gestores (id, user_id, slug, name, location, state, banner_url, photo_url, rating, review_count, tramites_count, experience_years, bio, whatsapp, schedule)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        gestorId, userId, 'gestoria-lopez', 'Gestoría López', 'CDMX Y ÁREA METROPOLITANA', 'CDMX',
        'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=600',
        'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200',
        4.9, 84, 1240, 8,
        'Somos un equipo de profesionales dedicados a facilitar tus trámites vehiculares.',
        '525500000000', 'Lunes a Viernes de 9am a 6pm',
      ]);

      for (const [name, time, price] of [
        ['Alta de Vehículo Nuevo', '24 a 48 horas hábiles', 1500],
        ['Cambio de Propietario', '48 a 72 horas hábiles', 1800],
        ['Baja de Placas', '24 horas hábiles', 800],
      ]) {
        await run('INSERT INTO gestor_services (id, gestor_id, name, time_estimate, price) VALUES (?, ?, ?, ?, ?)',
          [uuid(), gestorId, name, time, price]);
      }

      await run('INSERT INTO gestor_reviews (id, gestor_id, author, rating, comment) VALUES (?, ?, ?, ?, ?)',
        [uuid(), gestorId, 'Roberto Martínez', 5, 'Excelente servicio. Me sacaron las placas en 2 días.']);

      await run('INSERT INTO solicitudes (id, gestor_id, client_name, service_name, location, status) VALUES (?, ?, ?, ?, ?, ?)',
        [uuid(), gestorId, 'Mariana Rodríguez', 'Cambio de Propietario', 'CDMX', 'nuevo']);
      await run('INSERT INTO solicitudes (id, gestor_id, client_name, service_name, location, status) VALUES (?, ?, ?, ?, ?, ?)',
        [uuid(), gestorId, 'Roberto G.', 'Alta de Vehículo Extranjero', 'Nuevo León', 'en_proceso']);
    }
  }

  const g2UserId = uuid();
  await run('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)',
    [g2UserId, 'gestor2@demo.com', hash, 'gestor', 'Trámites Express MTY']);
  const g2Id = uuid();
  await run(`
    INSERT INTO gestores (id, user_id, slug, name, location, state, banner_url, photo_url, rating, tramites_count, bio, whatsapp, schedule)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    g2Id, g2UserId, 'tramites-express-mty', 'Trámites Express MTY', 'NUEVO LEÓN', 'Nuevo León',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=600',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200',
    5.0, 850, 'Trámites rápidos en Monterrey.', '528100000000', 'Lun-Vie 8am-7pm',
  ]);

  const conc1 = await get('SELECT id FROM users WHERE email = ?', ['concesionaria@demo.com']);
  for (const a of [
    { make: 'PORSCHE', model: '911 Carrera 4S', year: 2023, price: 2850000, mileage: 12000,
      image: 'https://images.unsplash.com/photo-1503376713356-200d72f10255?q=80&w=600',
      desc: 'Impecable Porsche 911 Carrera 4S del año 2023.' },
    { make: 'MERCEDES-BENZ', model: 'Clase G 500', year: 2022, price: 3100000, mileage: 24000,
      image: 'https://images.unsplash.com/photo-1520031441872-265e4ff70366?q=80&w=600', desc: 'Mercedes Clase G impecable.' },
  ]) {
    await run(`
      INSERT INTO autos (id, user_id, make, model, year, price, mileage, location, description, image_url, images, dealer_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [uuid(), conc1.id, a.make, a.model, a.year, a.price, a.mileage, 'CDMX (Polanco)', a.desc, a.image, JSON.stringify([a.image]), 'Autos Premium S.A.']);
  }

  const conc2 = await get('SELECT id FROM users WHERE email = ?', ['concesionaria2@demo.com']);
  const img = 'https://images.unsplash.com/photo-1555215695-3004980ad54e?q=80&w=600';
  await run(`
    INSERT INTO autos (id, user_id, make, model, year, price, mileage, location, description, image_url, images, dealer_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [uuid(), conc2.id, 'BMW', 'M4 Competition', 2024, 2300000, 2500, 'Monterrey', 'BMW M4 Competition casi nuevo.', img, JSON.stringify([img]), 'AutoLuxury MTY']);

  console.log('Seed completado.');
  console.log('Usuarios demo (password: demo1234):');
  console.log('  gestor@demo.com | concesionaria@demo.com');
  process.exit(0);
}

seed().catch(err => {
  console.error('Error en seed:', err.message);
  process.exit(1);
});
