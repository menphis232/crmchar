/**
 * Enriquece concesionarias demo: videos en algunos autos, reseñas variadas y perfiles.
 * Ejecutar: node seed-dealer-enrichment.js
 */
import mysql from 'mysql2/promise';
import { randomUUID as uuid } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

/** Videos de YouTube estables (walkaround / review de autos) */
const CAR_VIDEOS = [
  'https://www.youtube.com/watch?v=6XLGxB3T3OQ',
  'https://www.youtube.com/watch?v=FuXNumBwDOM',
  'https://www.youtube.com/watch?v=WGwrJA6R5sA',
  'https://www.youtube.com/watch?v=Cox473qEQec',
  'https://www.youtube.com/watch?v=9AeB859-VLU',
  'https://www.youtube.com/watch?v=kwcIllaoNCw',
  'https://www.youtube.com/watch?v=OeW4A8KQy_8',
  'https://www.youtube.com/watch?v=XFJ3L9ZqZ9E',
];

const DEALER_PROFILES = {
  'concesionaria@demo.com': {
    description: 'Autos Premium S.A. — más de 15 años vendiendo vehículos de lujo en Polanco. Inventario certificado y garantía extendida.',
    phone: '525555010101',
    address: 'Av. Presidente Masaryk 123, Polanco, CDMX',
  },
  'concesionaria2@demo.com': {
    description: 'AutoLuxury MTY — concesionaria boutique en Monterrey especializada en deportivos europeos.',
    phone: '528180020202',
    address: 'Av. Lázaro Cárdenas 2500, San Pedro, N.L.',
  },
  'elite.gdl@demo.com': {
    description: 'Elite Motors Guadalajara — SUVs y deportivos premium con historial de servicio verificado.',
    phone: '523333030303',
    address: 'Av. Patria 1200, Zapopan, Jalisco',
  },
  'velocity.qro@demo.com': {
    description: 'Velocity Querétaro — autos seminuevos de alta gama con entrega inmediata y financiamiento.',
    phone: '524444040404',
    address: 'Blvd. Bernardo Quintana 100, Querétaro',
  },
  'prestige.pue@demo.com': {
    description: 'Prestige Auto Puebla — selección curada de vehículos premium para clientes exigentes.',
    phone: '522222050505',
    address: 'Av. Juárez 456, Angelópolis, Puebla',
  },
  'capital.select@demo.com': {
    description: 'Capital Select CDMX — superdeportivos y ultra-lujo en Santa Fe. Asesoría personalizada 7 días.',
    phone: '525555060606',
    address: 'Av. Santa Fe 482, Cuajimalpa, CDMX',
  },
  'norte.premium@demo.com': {
    description: 'Norte Premium Monterrey — inventario exclusivo del norte del país con inspección de 150 puntos.',
    phone: '528180070707',
    address: 'Carretera Nacional 500, Monterrey, N.L.',
  },
};

/** Reseñas por email de concesionaria (rating 1–5, comentarios variados) */
const DEALER_REVIEWS = {
  'concesionaria@demo.com': [
    { author: 'Carlos Ruiz', rating: 5, comment: 'Excelente atención y autos impecables. Compré un Mercedes y el proceso fue transparente de principio a fin.' },
    { author: 'Laura Méndez', rating: 4, comment: 'Buen servicio, respondieron rápido mis preguntas. El auto llegó en perfectas condiciones.' },
    { author: 'Fernando Ortiz', rating: 5, comment: 'La mejor experiencia de compra de auto premium que he tenido. Totalmente recomendados.' },
  ],
  'concesionaria2@demo.com': [
    { author: 'Mariana Soto', rating: 4, comment: 'Buen inventario en Monterrey. Negociación justa y entrega puntual.' },
    { author: 'Ricardo Vega', rating: 4, comment: 'El BMW que compré estaba como nuevo. Solo tardaron un poco en la papelería.' },
    { author: 'Patricia López', rating: 3, comment: 'Buen auto, pero el seguimiento post-venta podría mejorar.' },
  ],
  'elite.gdl@demo.com': [
    { author: 'Jorge Hernández', rating: 5, comment: 'Atención de primer nivel en Guadalajara. El Porsche estaba impecable.' },
    { author: 'Sofía Ramírez', rating: 5, comment: 'Profesionales y honestos. Me ayudaron con el financiamiento sin complicaciones.' },
    { author: 'Diego Morales', rating: 4, comment: 'Muy buena selección de SUVs premium. Volvería a comprar aquí.' },
    { author: 'Ana Torres', rating: 5, comment: 'Excelente asesor, sin presión de venta. Auto entregado en 48 horas.' },
  ],
  'velocity.qro@demo.com': [
    { author: 'Luis García', rating: 4, comment: 'Buenos precios para autos seminuevos de gama alta en Querétaro.' },
    { author: 'Claudia Núñez', rating: 4, comment: 'El Tesla que vi tenía video y fotos reales. Trato amable.' },
    { author: 'Roberto Jiménez', rating: 3, comment: 'El auto cumplió expectativas, aunque la sala de espera es pequeña.' },
    { author: 'Elena Castro', rating: 5, comment: 'Me encantó la transparencia del historial del vehículo. Muy confiables.' },
    { author: 'Miguel Ángel R.', rating: 4, comment: 'Recomendable para quien busca calidad sin pagar precio de agencia nueva.' },
  ],
  'prestige.pue@demo.com': [
    { author: 'Gabriela Ponce', rating: 4, comment: 'Buena atención en Puebla. El Lexus estaba en excelente estado.' },
    { author: 'Arturo Mendoza', rating: 3, comment: 'Precio algo elevado, pero el auto venía muy bien cuidado.' },
    { author: 'Verónica Salinas', rating: 4, comment: 'Proceso ágil y sin sorpresas. Me gustó la prueba de manejo extendida.' },
    { author: 'Héctor Vázquez', rating: 3, comment: 'Buen inventario, aunque esperaba más opciones de color.' },
  ],
  'capital.select@demo.com': [
    { author: 'Alejandro Fuentes', rating: 5, comment: 'Increíble experiencia comprando un Ferrari. Servicio VIP de verdad.' },
    { author: 'Valentina Cruz', rating: 5, comment: 'La concesionaria más profesional de Santa Fe. Detalles impecables.' },
    { author: 'Ignacio Reyes', rating: 5, comment: 'El Urus que adquirí superó expectativas. Equipo muy preparado.' },
    { author: 'Camila Herrera', rating: 4, comment: 'Excelente showroom y asesores conocedores. Solo un detalle menor en la entrega.' },
    { author: 'Daniel Ortega', rating: 5, comment: 'Para autos de ultra-lujo, Capital Select es la referencia en CDMX.' },
  ],
  'norte.premium@demo.com': [
    { author: 'Francisco Mejía', rating: 5, comment: 'El M8 Competition estaba espectacular. Negociación directa y clara.' },
    { author: 'Lucía Garza', rating: 4, comment: 'Buena reputación en Monterrey. Me gustó que subieron video del auto.' },
    { author: 'Oscar Delgado', rating: 4, comment: 'Inventario variado y personal capacitado. Recomendados.' },
    { author: 'Paola Rivas', rating: 5, comment: 'Compré un Audi R8 y todo salió perfecto. Muy satisfecha.' },
  ],
};

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tramites_vehiculares',
});

const [dealers] = await c.query(
  "SELECT id, email, name FROM users WHERE role = 'concesionaria' ORDER BY created_at",
);

let profilesUpdated = 0;
let reviewsInserted = 0;
let videosSet = 0;
let videosCleared = 0;

for (const dealer of dealers) {
  const profile = DEALER_PROFILES[dealer.email];
  if (profile) {
    await c.query(
      'UPDATE users SET description = ?, phone = ?, address = ? WHERE id = ?',
      [profile.description, profile.phone, profile.address, dealer.id],
    );
    profilesUpdated++;
  }

  const reviews = DEALER_REVIEWS[dealer.email];
  if (reviews?.length) {
    await c.query('DELETE FROM concesionaria_reviews WHERE user_id = ?', [dealer.id]);
    for (const r of reviews) {
      await c.query(
        'INSERT INTO concesionaria_reviews (id, user_id, author, rating, comment) VALUES (?, ?, ?, ?, ?)',
        [uuid(), dealer.id, r.author, r.rating, r.comment],
      );
      reviewsInserted++;
    }
    const avg = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
    console.log(`⭐ ${dealer.name}: ${reviews.length} reseñas (prom ~${avg})`);
  }
}

const [autos] = await c.query(`
  SELECT a.id, a.make, a.model, u.email
  FROM autos a
  JOIN users u ON u.id = a.user_id
  WHERE u.role = 'concesionaria' AND a.status = 'published'
  ORDER BY a.created_at
`);

for (const auto of autos) {
  // ~45% de autos con video (no todos)
  const withVideo = hashStr(auto.id) % 100 < 45;
  if (withVideo) {
    const video = CAR_VIDEOS[hashStr(`${auto.id}-video`) % CAR_VIDEOS.length];
    await c.query('UPDATE autos SET video_url = ? WHERE id = ?', [video, auto.id]);
    videosSet++;
    console.log(`🎬 Video: ${auto.make} ${auto.model} (${auto.email})`);
  } else {
    await c.query('UPDATE autos SET video_url = NULL WHERE id = ?', [auto.id]);
    videosCleared++;
  }
}

await c.end();

console.log('');
console.log('✅ Enriquecimiento demo completado');
console.log(`   Perfiles actualizados: ${profilesUpdated}`);
console.log(`   Reseñas insertadas: ${reviewsInserted}`);
console.log(`   Autos con video: ${videosSet}`);
console.log(`   Autos sin video: ${videosCleared}`);
