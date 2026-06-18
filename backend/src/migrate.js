import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'migration-v2.sql'), 'utf8');
  const statements = sql.split(';').map(s => s.trim()).filter(Boolean);

  for (const stmt of statements) {
    if (stmt.includes('ADD COLUMN IF NOT EXISTS')) {
      try {
        await conn.query('USE tramites_vehiculares');
        await conn.query("ALTER TABLE autos ADD COLUMN status ENUM('draft', 'published', 'baja') DEFAULT 'published' AFTER dealer_name");
      } catch (e) {
        if (e.code !== 'ER_DUP_FIELDNAME') throw e;
      }
      continue;
    }
    try {
      await conn.query(stmt);
    } catch (e) {
      if (['ER_DUP_FIELDNAME', 'ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) continue;
      throw e;
    }
  }

  await conn.query('USE tramites_vehiculares');

  const [adminRows] = await conn.query("SELECT id FROM users WHERE email = 'admin@demo.com'");
  if (!adminRows.length) {
    const hash = bcrypt.hashSync('demo1234', 10);
    await conn.query('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)',
      [uuid(), 'admin@demo.com', hash, 'admin', 'Super Admin']);
    console.log('Usuario admin creado: admin@demo.com / demo1234');
  }

  const [reviewRows] = await conn.query('SELECT COUNT(*) as c FROM concesionaria_reviews');
  if (reviewRows[0].c === 0) {
    const [dealers] = await conn.query("SELECT id FROM users WHERE email = 'concesionaria@demo.com'");
    if (dealers.length) {
      await conn.query('INSERT INTO concesionaria_reviews (id, user_id, author, rating, comment) VALUES (?, ?, ?, ?, ?)',
        [uuid(), dealers[0].id, 'Carlos Ruiz', 5, 'Excelente atención y autos impecables.']);
      await conn.query('INSERT INTO concesionaria_reviews (id, user_id, author, rating, comment) VALUES (?, ?, ?, ?, ?)',
        [uuid(), dealers[0].id, 'Laura Méndez', 4, 'Buen servicio, respondieron rápido mis preguntas.']);
    }
  }

  const [inqRows] = await conn.query('SELECT COUNT(*) as c FROM auto_inquiries');
  if (inqRows[0].c === 0) {
    const [autos] = await conn.query("SELECT id, user_id FROM autos WHERE status = 'published' LIMIT 1");
    if (autos.length) {
      await conn.query(`
        INSERT INTO auto_inquiries (id, auto_id, user_id, client_name, client_email, message, status)
        VALUES (?, ?, ?, ?, ?, ?, 'nuevo')
      `, [uuid(), autos[0].id, autos[0].user_id, 'Pedro Sánchez', 'pedro@email.com', '¿El vehículo sigue disponible? ¿Aceptan financiamiento?']);
    }
  }

  await conn.end();
  console.log('Migración v2 aplicada.');

  // v3: panel themes
  const v3Path = path.join(__dirname, '..', 'sql', 'migration-v3.sql');
  if (fs.existsSync(v3Path)) {
    const v3 = fs.readFileSync(v3Path, 'utf8');
    const conn2 = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true,
    });
    for (const stmt of v3.split(';').map(s => s.trim()).filter(Boolean)) {
      try { await conn2.query(stmt); } catch (e) {
        if (!['ER_DUP_ENTRY'].includes(e.code)) throw e;
      }
    }
    await conn2.end();
    console.log('Migración v3 (paneles) aplicada.');
  }

  // v4: CRM
  const v4Path = path.join(__dirname, '..', 'sql', 'migration-v4-crm.sql');
  if (fs.existsSync(v4Path)) {
    const v4 = fs.readFileSync(v4Path, 'utf8');
    const conn3 = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true,
    });
    for (const stmt of v4.split(';').map(s => s.trim()).filter(Boolean)) {
      try { await conn3.query(stmt); } catch (e) {
        if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
      }
    }
    const alterCols = [
      "ALTER TABLE solicitudes ADD COLUMN client_email VARCHAR(255)",
      "ALTER TABLE solicitudes ADD COLUMN client_phone VARCHAR(50)",
      "ALTER TABLE solicitudes ADD COLUMN deal_id VARCHAR(36) NULL",
      "ALTER TABLE auto_inquiries ADD COLUMN deal_id VARCHAR(36) NULL",
    ];
    for (const stmt of alterCols) {
      try { await conn3.query(`USE tramites_vehiculares; ${stmt}`); } catch (e) {
        if (e.code !== 'ER_DUP_FIELDNAME') throw e;
      }
    }
    await conn3.end();
    console.log('Migración v4 (CRM) aplicada.');

    const { backfillCrmDeals } = await import('./crm/backfill.js');
    await backfillCrmDeals();
    console.log('CRM backfill completado.');
  }

  // v5: CRM fase 2 — tareas, lost_reason, first_response_at
  const v5Path = path.join(__dirname, '..', 'sql', 'migration-v5-crm-phase2.sql');
  if (fs.existsSync(v5Path)) {
    const v5 = fs.readFileSync(v5Path, 'utf8');
    const conn4 = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true,
    });
    for (const stmt of v5.split(';').map(s => s.trim()).filter(Boolean)) {
      try { await conn4.query(stmt); } catch (e) {
        if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
      }
    }
    const v5Cols = [
      'ALTER TABLE crm_deals ADD COLUMN lost_reason VARCHAR(255) NULL',
      'ALTER TABLE crm_deals ADD COLUMN first_response_at DATETIME NULL',
    ];
    for (const stmt of v5Cols) {
      try { await conn4.query(`USE tramites_vehiculares; ${stmt}`); } catch (e) {
        if (e.code !== 'ER_DUP_FIELDNAME') throw e;
      }
    }
    await conn4.end();
    console.log('Migración v5 (CRM fase 2) aplicada.');
  }

  // v6: CRM fase 3.1 — Cotizaciones
  const v6Path = path.join(__dirname, '..', 'sql', 'migration-v6-crm-phase3-quotes.sql');
  if (fs.existsSync(v6Path)) {
    const v6 = fs.readFileSync(v6Path, 'utf8');
    const conn5 = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true,
    });
    for (const stmt of v6.split(';').map(s => s.trim()).filter(Boolean)) {
      try { await conn5.query(stmt); } catch (e) {
        if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
      }
    }
    const v6Cols = [
      'ALTER TABLE crm_deals ADD COLUMN down_payment DECIMAL(14,2) NULL',
      'ALTER TABLE crm_deals ADD COLUMN trade_in_value DECIMAL(14,2) NULL',
      'ALTER TABLE crm_deals ADD COLUMN term_months INT NULL',
    ];
    for (const stmt of v6Cols) {
      try { await conn5.query(`USE tramites_vehiculares; ${stmt}`); } catch (e) {
        if (e.code !== 'ER_DUP_FIELDNAME') throw e;
      }
    }
    
    // v13: Multiuser
    const [colsV13] = await conn5.query("SHOW COLUMNS FROM users LIKE 'parent_id'");
    if (colsV13.length === 0) {
      console.log('Aplicando migración V13 (Multiuser)...');
      const sqlV13 = fs.readFileSync(path.join(__dirname, '..', 'sql', 'migration-v13-multiuser.sql'), 'utf8');
      for (const stmt of sqlV13.split(';').map(s => s.trim()).filter(Boolean)) {
        try { await conn5.query(stmt); } catch (e) {
          if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
        }
      }
    }

    await conn5.end();
    console.log('Migración v6 (CRM Cotizaciones) aplicada.');
  }

  // v7: Logos
  const v7Path = path.join(__dirname, '..', 'sql', 'migration-v7-logos.sql');
  if (fs.existsSync(v7Path)) {
    const v7 = fs.readFileSync(v7Path, 'utf8');
    const conn6 = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true,
    });
    for (const stmt of v7.split(';').map(s => s.trim()).filter(Boolean)) {
      if (stmt.includes('ADD COLUMN IF NOT EXISTS') || stmt.includes('ADD COLUMN')) {
        try { await conn6.query(stmt); } catch (e) {
          if (e.code !== 'ER_DUP_FIELDNAME') throw e;
        }
      } else {
        try { await conn6.query(stmt); } catch (e) {
          if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
        }
      }
    }
    await conn6.end();
    console.log('Migración v7 (Logos) aplicada.');
  }
    // v8: PDF settings
    const v8Path = path.join(__dirname, '..', 'sql', 'migration-v8-pdf-settings.sql');
    if (fs.existsSync(v8Path)) {
      const v8 = fs.readFileSync(v8Path, 'utf8');
      const conn7 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      for (const stmt of v8.split(';').map(s => s.trim()).filter(Boolean)) {
        if (stmt.includes('ADD COLUMN IF NOT EXISTS') || stmt.includes('ADD COLUMN')) {
          try { await conn7.query(stmt); } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') throw e;
          }
        } else {
          try { await conn7.query(stmt); } catch (e) {
            if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
          }
        }
      }
      await conn7.end();
      console.log('Migración v8 (PDF Settings) aplicada.');
    }

    // v9: Documents
    const v9Path = path.join(__dirname, '..', 'sql', 'migration-v9-documents.sql');
    if (fs.existsSync(v9Path)) {
      const v9 = fs.readFileSync(v9Path, 'utf8');
      const conn8 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      for (const stmt of v9.split(';').map(s => s.trim()).filter(Boolean)) {
        if (stmt.includes('ADD COLUMN IF NOT EXISTS') || stmt.includes('ADD COLUMN')) {
          try { await conn8.query(stmt); } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') throw e;
          }
        } else {
          try { await conn8.query(stmt); } catch (e) {
            if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
          }
        }
      }
      await conn8.end();
      console.log('Migración v9 (Documentos) aplicada.');
    }

    // v10: Tracking Code
    const v10Path = path.join(__dirname, '..', 'sql', 'migration-v10-tracking.sql');
    if (fs.existsSync(v10Path)) {
      const v10 = fs.readFileSync(v10Path, 'utf8');
      const conn9 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      for (const stmt of v10.split(';').map(s => s.trim()).filter(Boolean)) {
        if (stmt.includes('ADD COLUMN IF NOT EXISTS') || stmt.includes('ADD COLUMN')) {
          try { await conn9.query(stmt); } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') throw e;
          }
        } else {
          try { await conn9.query(stmt); } catch (e) {
            if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
          }
        }
      }
      await conn9.end();
      console.log('Migración v10 (Tracking Code) aplicada.');
    }

    // v11: Reviews deal_id
    const v11Path = path.join(__dirname, '..', 'sql', 'migration-v11-reviews.sql');
    if (fs.existsSync(v11Path)) {
      const v11 = fs.readFileSync(v11Path, 'utf8');
      const conn10 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      for (const stmt of v11.split(';').map(s => s.trim()).filter(Boolean)) {
        if (stmt.includes('ADD COLUMN IF NOT EXISTS') || stmt.includes('ADD COLUMN')) {
          try { await conn10.query(stmt); } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') throw e;
          }
        } else {
          try { await conn10.query(stmt); } catch (e) {
            if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
          }
        }
      }
      await conn10.end();
      console.log('Migración v11 (Reviews deal_id) aplicada.');
    }

    // v12: Notifications
    const v12Path = path.join(__dirname, '..', 'sql', 'migration-v12-notifications.sql');
    if (fs.existsSync(v12Path)) {
      const v12 = fs.readFileSync(v12Path, 'utf8');
      const conn11 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      for (const stmt of v12.split(';').map(s => s.trim()).filter(Boolean)) {
        try { await conn11.query(stmt); } catch (e) {
          if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
        }
      }
      await conn11.end();
      console.log('Migración v12 (Notificaciones) aplicada.');
    }

    // v14: Finances
    const v14Path = path.join(__dirname, '..', 'sql', 'migration-v14-finances.sql');
    if (fs.existsSync(v14Path)) {
      const v14 = fs.readFileSync(v14Path, 'utf8');
      const conn12 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      for (const stmt of v14.split(';').map(s => s.trim()).filter(Boolean)) {
        try { await conn12.query(stmt); } catch (e) {
          if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
        }
      }
      await conn12.end();
      console.log('Migración v14 (Finanzas) aplicada.');
    }

    // v15: Analytics
    const v15Path = path.join(__dirname, '..', 'sql', 'migration-v15-analytics.sql');
    if (fs.existsSync(v15Path)) {
      const v15 = fs.readFileSync(v15Path, 'utf8');
      const conn13 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      for (const stmt of v15.split(';').map(s => s.trim()).filter(Boolean)) {
        if (stmt.includes('ADD COLUMN IF NOT EXISTS') || stmt.includes('ADD COLUMN')) {
          try { await conn13.query(stmt); } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') throw e;
          }
        } else {
          try { await conn13.query(stmt); } catch (e) {
            if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
          }
        }
      }
      await conn13.end();
      console.log('Migración v15 (Analytics) aplicada.');
    }

    // v16: Stripe
    const v16Path = path.join(__dirname, '..', 'sql', 'migration-v16-stripe.sql');
    if (fs.existsSync(v16Path)) {
      const v16 = fs.readFileSync(v16Path, 'utf8');
      const conn14 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      await conn14.query('USE tramites_vehiculares');
      for (const stmt of v16.split(';').map(s => s.trim()).filter(Boolean)) {
        if (stmt.includes('ADD COLUMN IF NOT EXISTS') || stmt.includes('ADD COLUMN')) {
          try { await conn14.query(stmt); } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') throw e;
          }
        } else {
          try { await conn14.query(stmt); } catch (e) {
            if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
          }
        }
      }
      await conn14.end();
      console.log('Migración v16 (Stripe) aplicada.');
    }
    // v18: AI Config & Client Portal Chat
    const v18Path = path.join(__dirname, '..', 'sql', 'migration-v18-ai-and-client.sql');
    if (fs.existsSync(v18Path)) {
      const v18 = fs.readFileSync(v18Path, 'utf8');
      const conn15 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      await conn15.query('USE tramites_vehiculares');
      for (const stmt of v18.split(';').map(s => s.trim()).filter(Boolean)) {
        if (stmt.includes('ADD COLUMN') || stmt.includes('CREATE TABLE')) {
          try { await conn15.query(stmt); } catch (e) {
            if (!['ER_DUP_FIELDNAME', 'ER_TABLE_EXISTS_ERROR'].includes(e.code)) throw e;
          }
        } else {
          try { await conn15.query(stmt); } catch (e) {
            if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
          }
        }
      }
      await conn15.end();
      console.log('Migración v18 (AI & Client Portal) aplicada.');
    }
    // v19: Chatbot Colors
    const v19Path = path.join(__dirname, '..', 'sql', 'migration-v19-chatbot-colors.sql');
    if (fs.existsSync(v19Path)) {
      const v19 = fs.readFileSync(v19Path, 'utf8');
      const conn16 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      await conn16.query('USE tramites_vehiculares');
      for (const stmt of v19.split(';').map(s => s.trim()).filter(Boolean)) {
        if (stmt.includes('ADD COLUMN')) {
          try { await conn16.query(stmt); } catch (e) {
            if (!['ER_DUP_FIELDNAME'].includes(e.code)) throw e;
          }
        } else {
          try { await conn16.query(stmt); } catch (e) {
            if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
          }
        }
      }
      await conn16.end();
      console.log('Migración v19 (Chatbot Colors) aplicada.');
    }
    // v20: Stripe Subscriptions
    const v20Path = path.join(__dirname, '..', 'sql', 'migration-v20-stripe-subscriptions.sql');
    if (fs.existsSync(v20Path)) {
      const v20 = fs.readFileSync(v20Path, 'utf8');
      const conn17 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      await conn17.query('USE tramites_vehiculares');
      for (const stmt of v20.split(';').map(s => s.trim()).filter(Boolean)) {
        if (stmt.includes('ADD COLUMN')) {
          try { await conn17.query(stmt); } catch (e) {
            if (!['ER_DUP_FIELDNAME'].includes(e.code)) throw e;
          }
        } else {
          try { await conn17.query(stmt); } catch (e) {
            if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
          }
        }
      }
      await conn17.end();
      console.log('Migración v20 (Stripe Subscriptions) aplicada.');
    }
    // v21: Dealer Profile & Google Maps
    const v21Path = path.join(__dirname, '..', 'sql', 'migration-v21-dealer-profile.sql');
    if (fs.existsSync(v21Path)) {
      const v21 = fs.readFileSync(v21Path, 'utf8');
      const conn18 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      await conn18.query('USE tramites_vehiculares');
      for (const stmt of v21.split(';').map(s => s.trim()).filter(Boolean)) {
        if (stmt.includes('ADD COLUMN')) {
          try { await conn18.query(stmt); } catch (e) {
            if (!['ER_DUP_FIELDNAME'].includes(e.code)) throw e;
          }
        } else {
          try { await conn18.query(stmt); } catch (e) {
            if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
          }
        }
      }
      // Generate slugs for existing concesionarias that don't have one
      await conn18.query(`
        UPDATE users SET slug = CONCAT(LOWER(REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9]+', '-')), '-', SUBSTR(id, 1, 6))
        WHERE role = 'concesionaria' AND (slug IS NULL OR slug = '')
      `);
      await conn18.end();
      console.log('Migración v21 (Dealer Profile & Google Maps) aplicada.');
    }

    // v23: Finances v2 — payment_method + fin_payment_methods
    const v23Path = path.join(__dirname, '..', 'sql', 'migration-v23-finances-v2.sql');
    if (fs.existsSync(v23Path)) {
      const v23 = fs.readFileSync(v23Path, 'utf8');
      const conn19 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      await conn19.query('USE tramites_vehiculares');
      for (const stmt of v23.split(';').map(s => s.trim()).filter(Boolean)) {
        if (stmt.includes('ADD COLUMN')) {
          try { await conn19.query(stmt); } catch (e) {
            if (!['ER_DUP_FIELDNAME'].includes(e.code)) throw e;
          }
        } else {
          try { await conn19.query(stmt); } catch (e) {
            if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
          }
        }
      }
      await conn19.end();
      console.log('Migración v23 (Finanzas v2) aplicada.');
    }

    // v24: gestor_services required_documents
    const v24Path = path.join(__dirname, '..', 'sql', 'migration-v24-required-documents.sql');
    if (fs.existsSync(v24Path)) {
      const v24 = fs.readFileSync(v24Path, 'utf8');
      const conn20 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      await conn20.query('USE tramites_vehiculares');
      for (const stmt of v24.split(';').map(s => s.trim()).filter(Boolean)) {
        if (stmt.includes('ADD COLUMN')) {
          try { await conn20.query(stmt); } catch (e) {
            if (!['ER_DUP_FIELDNAME'].includes(e.code)) throw e;
          }
        } else {
          try { await conn20.query(stmt); } catch (e) {
            if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
          }
        }
      }
      await conn20.end();
      console.log('Migración v24 (gestor_services required_documents) aplicada.');
    }

    // v25: automations
    const v25Path = path.join(__dirname, '..', 'sql', 'migration-v25-automations.sql');
    if (fs.existsSync(v25Path)) {
      const v25 = fs.readFileSync(v25Path, 'utf8');
      const conn21 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      await conn21.query('USE tramites_vehiculares');
      for (const stmt of v25.split(';').map(s => s.trim()).filter(Boolean)) {
        if (stmt.includes('ADD COLUMN')) {
          try { await conn21.query(stmt); } catch (e) {
            if (!['ER_DUP_FIELDNAME'].includes(e.code)) throw e;
          }
        } else {
          try { await conn21.query(stmt); } catch (e) {
            if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
          }
        }
      }
      await conn21.end();
      console.log('Migración v25 (CRM automations) aplicada.');
    }

    // v26: documents
    const v26Path = path.join(__dirname, '..', 'sql', 'migration-v26-documents.sql');
    if (fs.existsSync(v26Path)) {
      const v26 = fs.readFileSync(v26Path, 'utf8');
      const conn22 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      await conn22.query('USE tramites_vehiculares');
      for (const stmt of v26.split(';').map(s => s.trim()).filter(Boolean)) {
        if (stmt.includes('ADD COLUMN')) {
          try { await conn22.query(stmt); } catch (e) {
            if (!['ER_DUP_FIELDNAME'].includes(e.code)) throw e;
          }
        } else {
          try { await conn22.query(stmt); } catch (e) {
            if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
          }
        }
      }
      await conn22.end();
      console.log('Migración v26 (deal_documents) aplicada.');
    }

    const v27Path = path.join(__dirname, '..', 'sql', 'migration-v27-panel-assistant.sql');
    if (fs.existsSync(v27Path)) {
      const v27 = fs.readFileSync(v27Path, 'utf8');
      const conn23 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      await conn23.query('USE tramites_vehiculares');
      for (const stmt of v27.split(';').map(s => s.trim()).filter(Boolean)) {
        if (stmt.includes('ADD COLUMN')) {
          try { await conn23.query(stmt); } catch (e) {
            if (!['ER_DUP_FIELDNAME'].includes(e.code)) throw e;
          }
        } else {
          try { await conn23.query(stmt); } catch (e) {
            if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
          }
        }
      }
      await conn23.end();
      console.log('Migración v27 (panel assistant) aplicada.');
    }

    const v28Path = path.join(__dirname, '..', 'sql', 'migration-v28-ga-oauth.sql');
    if (fs.existsSync(v28Path)) {
      const v28 = fs.readFileSync(v28Path, 'utf8');
      const conn24 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      await conn24.query('USE tramites_vehiculares');
      for (const stmt of v28.split(';').map(s => s.trim()).filter(Boolean)) {
        try { await conn24.query(stmt); } catch (e) {
          if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
        }
      }
      await conn24.end();
      console.log('Migración v28 (GA OAuth) aplicada.');
    }

    const v29Path = path.join(__dirname, '..', 'sql', 'migration-v29-ga-credentials.sql');
    if (fs.existsSync(v29Path)) {
      const v29 = fs.readFileSync(v29Path, 'utf8');
      const conn25 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      await conn25.query('USE tramites_vehiculares');
      for (const stmt of v29.split(';').map(s => s.trim()).filter(Boolean)) {
        try { await conn25.query(stmt); } catch (e) {
          if (!['ER_DUP_FIELDNAME', 'ER_TABLE_EXISTS_ERROR'].includes(e.code)) throw e;
        }
      }
      await conn25.end();
      console.log('Migración v29 (GA credentials DB) aplicada.');
    }

    const v30Path = path.join(__dirname, '..', 'sql', 'migration-v30-auto-private-docs.sql');
    if (fs.existsSync(v30Path)) {
      const v30 = fs.readFileSync(v30Path, 'utf8');
      const conn26 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      await conn26.query('USE tramites_vehiculares');
      for (const stmt of v30.split(';').map(s => s.trim()).filter(Boolean)) {
        try { await conn26.query(stmt); } catch (e) {
          if (!['ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY'].includes(e.code)) throw e;
        }
      }
      await conn26.end();
      console.log('Migración v30 (auto private docs) aplicada.');
    }

    const v31Path = path.join(__dirname, '..', 'sql', 'migration-v31-auto-video.sql');
    if (fs.existsSync(v31Path)) {
      const v31 = fs.readFileSync(v31Path, 'utf8');
      const conn27 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      await conn27.query('USE tramites_vehiculares');
      for (const stmt of v31.split(';').map(s => s.trim()).filter(Boolean)) {
        try { await conn27.query(stmt); } catch (e) {
          if (!['ER_DUP_FIELDNAME'].includes(e.code)) throw e;
        }
      }
      await conn27.end();
      console.log('Migración v31 (auto video) aplicada.');
    }

    const v32Path = path.join(__dirname, '..', 'sql', 'migration-v32-fin-referencia.sql');
    if (fs.existsSync(v32Path)) {
      const v32 = fs.readFileSync(v32Path, 'utf8');
      const conn32 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      await conn32.query('USE tramites_vehiculares');
      for (const stmt of v32.split(';').map(s => s.trim()).filter(Boolean)) {
        try { await conn32.query(stmt); } catch (e) {
          if (!['ER_DUP_FIELDNAME'].includes(e.code)) throw e;
        }
      }
      await conn32.end();
      console.log('Migración v32 (fin referencia) aplicada.');
    }

    const v33Path = path.join(__dirname, '..', 'sql', 'migration-v33-assistant-font.sql');
    if (fs.existsSync(v33Path)) {
      const v33 = fs.readFileSync(v33Path, 'utf8');
      const conn33 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      await conn33.query('USE tramites_vehiculares');
      for (const stmt of v33.split(';').map(s => s.trim()).filter(Boolean)) {
        try { await conn33.query(stmt); } catch (e) {
          if (!['ER_DUP_FIELDNAME'].includes(e.code)) throw e;
        }
      }
      await conn33.end();
      console.log('Migración v33 (assistant font) aplicada.');
    }

    const v34Path = path.join(__dirname, '..', 'sql', 'migration-v34-assistant-prompt.sql');
    if (fs.existsSync(v34Path)) {
      const v34 = fs.readFileSync(v34Path, 'utf8');
      const conn34 = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true,
      });
      await conn34.query('USE tramites_vehiculares');
      for (const stmt of v34.split(';').map(s => s.trim()).filter(Boolean)) {
        try { await conn34.query(stmt); } catch (e) {
          if (!['ER_DUP_FIELDNAME'].includes(e.code)) throw e;
        }
      }
      await conn34.end();
      console.log('Migración v34 (assistant prompt) aplicada.');
    }
    
    console.log('Todas las migraciones completadas.');
    process.exit(0);
}

migrate().catch(err => {
  console.error('Error en migración:', err.message);
  process.exit(1);
});
