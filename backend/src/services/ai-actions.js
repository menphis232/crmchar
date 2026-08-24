import { get, query, run } from '../db.js';
import { v4 as uuid } from 'uuid';
import { sendEmail } from '../utils/mailer.js';
import { createManualVentaDeal } from '../crm/helpers.js';
import { emitChatMessage, emitUserNotification } from '../utils/socket-events.js';
import { maybeAutoReplyClientChat } from './chat-auto-reply.js';

const fmtMoney = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

function orgId(user) {
  return user.parent_id || user.id;
}

async function processBlock(reply, tag, handler) {
  const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`);
  let out = reply;
  let guard = 0;
  while (guard++ < 10) {
    const match = out.match(re);
    if (!match) break;
    let replacement;
    try {
      const data = JSON.parse(match[1]);
      replacement = await handler(data);
    } catch (e) {
      console.error(`AI action ${tag}:`, e);
      replacement = `\n\n❌ *Error en ${tag}: ${e.message}*`;
    }
    out = out.replace(match[0], replacement);
  }
  return out;
}

async function clientOwnsDeal(email, dealId) {
  const row = await get(
    `SELECT d.id, d.user_id FROM crm_deals d
     JOIN contacts c ON c.id = d.contact_id
     WHERE d.id = ? AND LOWER(c.email) = LOWER(?)`,
    [dealId, email],
  );
  return row;
}

async function clientOwnsVehicle(email, vehicleId) {
  return get(
    `SELECT cv.id FROM contact_vehicles cv
     JOIN contacts c ON c.id = cv.contact_id
     WHERE cv.id = ? AND LOWER(c.email) = LOWER(?)`,
    [vehicleId, email],
  );
}

async function clientContacts(email) {
  return query('SELECT id, user_id FROM contacts WHERE LOWER(email) = LOWER(?)', [email]);
}

async function createClientVehicle(email, data) {
  const { plate, make, model, year, state, engomadoColor, vehicleNotes, insuranceExpiry, tenenciaStatus } = data;
  if (!plate?.trim()) throw new Error('Falta la placa');
  if (!make?.trim() || !model?.trim() || year == null || year === '') {
    throw new Error('Faltan marca, submarca o año');
  }
  const contacts = await clientContacts(email);
  if (!contacts.length) {
    throw new Error('Aún no tienes trámites con una gestoría. Solicita un servicio primero.');
  }
  const insExpiry = insuranceExpiry && String(insuranceExpiry).trim()
    ? String(insuranceExpiry).slice(0, 10) : null;
  const tenencia = ['si', 'no', 'pendiente'].includes(tenenciaStatus) ? tenenciaStatus : null;
  const tenenciaYear = tenencia ? new Date().getFullYear() : null;
  const validEngomado = ['amarillo', 'rosa', 'rojo', 'verde', 'azul'];
  const engomado = validEngomado.includes(engomadoColor) ? engomadoColor : null;

  let firstId = null;
  for (const contact of contacts) {
    const id = uuid();
    await run(
      `INSERT INTO contact_vehicles (id, contact_id, user_id, plate, make, model, year, state, engomado_color, vehicle_notes, insurance_expiry, tenencia_2026, tenencia_year)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, contact.id, contact.user_id,
        String(plate).trim().toUpperCase(),
        make.trim(), model.trim(), Number(year),
        state || null, engomado, vehicleNotes || null,
        insExpiry, tenencia, tenenciaYear,
      ],
    );
    if (!firstId) firstId = id;
  }
  return firstId;
}

export function clienteSuperpowersPrompt(deals, walletDocs, vehicles) {
  const today = new Date().toISOString().split('T')[0];
  return `
══════════════════════════════════════════
ACCIONES DEL PANEL (si el usuario lo pide)
══════════════════════════════════════════

IMPORTANTE — REGISTRAR VEHÍCULO EN "MIS VEHÍCULOS":
Esto es guardar el auto en el panel del cliente, NO es un trámite de REPUVE ni alta vehicular.
Campos del formulario real del panel:
  OBLIGATORIOS: plate (placa), make (marca), model (submarca/modelo), year (año)
  OPCIONALES (no preguntes si el usuario no los menciona): state (estado de placas), engomadoColor (amarillo|rosa|rojo|verde|azul), insuranceExpiry (fecha YYYY-MM-DD), tenenciaStatus (si|no|pendiente)
NUNCA pidas para registrar en el panel: NIV, VIN, número de serie, factura, tarjeta de circulación, CURP, RFC ni documentos físicos.
NUNCA inventes ni sugieras una marca/modelo/año/placa de ejemplo (nada de "Nissan Sentra 2020" ni placas ficticias). Usa solo los datos que el usuario diga, o pregunta por los que falten.
Si el usuario ya dio marca, modelo, año y placa, ejecuta [CREATE_VEHICLE] de inmediato sin más preguntas.
Solo pregunta por el dato obligatorio que falte (máximo una pregunta corta).

Cuando el usuario pida crear, actualizar o eliminar algo del panel, usa el bloque correspondiente.
NO subas archivos (documentos con archivo requieren subirlos manualmente en el panel).

**Registrar vehículo en Mis Vehículos**
[CREATE_VEHICLE]
{ "plate": "PLACA_DEL_USUARIO", "make": "MARCA", "model": "MODELO", "year": 2024 }
[/CREATE_VEHICLE]

**Actualizar vehículo** (solo campos del formulario; vehicle_id del listado)
[UPDATE_VEHICLE]
{ "vehicle_id": "uuid", "plate": "NUEVA", "make": "...", "model": "...", "year": 2021, "state": "...", "engomadoColor": "verde", "insuranceExpiry": "2026-06-01", "tenenciaStatus": "pendiente" }
[/UPDATE_VEHICLE]

**Eliminar vehículo**
[DELETE_VEHICLE]
{ "vehicle_id": "uuid" }
[/DELETE_VEHICLE]

**Enviar mensaje al chat de un trámite**
[SEND_CHAT]
{ "deal_id": "ID del trámite", "message": "Texto" }
[/SEND_CHAT]

**Eliminar documento de billetera** (source: "wallet" o "vehicle")
[DELETE_DOCUMENT]
{ "document_id": "uuid", "source": "wallet" }
[/DELETE_DOCUMENT]

**Asociar documento de billetera a un vehículo**
[ASSOCIATE_WALLET_DOC]
{ "document_id": "uuid", "vehicle_id": "uuid" }
[/ASSOCIATE_WALLET_DOC]

**Actualizar nombre del perfil**
[UPDATE_PROFILE]
{ "name": "Nuevo nombre" }
[/UPDATE_PROFILE]

TRÁMITES (deal_id):
${deals.length ? deals.map(d => `- ID: ${d.id} | ${d.title} | ${d.stage}`).join('\n') : '(Sin trámites)'}

DOCUMENTOS BILLETERA:
${walletDocs.length ? walletDocs.map(w => `- ID: ${w.id} | ${w.label} | source: ${w.source}${w.vehiclePlate ? ` | ${w.vehiclePlate}` : ''}`).join('\n') : '(Sin documentos)'}

VEHÍCULOS:
${vehicles.length ? vehicles.map(v => `- ID: ${v.id} | ${v.plate} | ${[v.make, v.model, v.year].filter(Boolean).join(' ')}`).join('\n') : '(Sin vehículos)'}

Fecha de hoy: ${today}
`;
}

export function businessSuperpowersPrompt(userRole, deals, recentTx, services = []) {
  const today = new Date().toISOString().split('T')[0];
  let extra = '';
  if (userRole === 'concesionaria') {
    extra = `
**Actualizar vehículo del inventario**
[UPDATE_AUTO]
{ "auto_id": "uuid", "make": "...", "model": "...", "year": 2022, "price": 350000, "status": "published" }
[/UPDATE_AUTO]

**Eliminar vehículo del inventario**
[DELETE_AUTO]
{ "auto_id": "uuid" }
[/DELETE_AUTO]
`;
  }
  if (userRole === 'gestor') {
    extra = `
**Crear servicio de gestoría**
[CREATE_SERVICE]
{ "name": "Cambio de propietario", "timeEstimate": "3-5 días", "price": 2500 }
[/CREATE_SERVICE]

**Actualizar servicio**
[UPDATE_SERVICE]
{ "service_id": "uuid", "name": "...", "timeEstimate": "...", "price": 3000 }
[/UPDATE_SERVICE]

**Eliminar servicio**
[DELETE_SERVICE]
{ "service_id": "uuid" }
[/DELETE_SERVICE]

SERVICIOS:
${services.length ? services.map(s => `- ID: ${s.id} | ${s.name} | ${fmtMoney(s.price)}`).join('\n') : '(Sin servicios)'}
`;
  }

  return `
══════════════════════════════════════════
ACCIONES QUE PUEDES EJECUTAR
══════════════════════════════════════════

[SEND_EMAIL]
{ "to": "correo@destino.com", "subject": "Asunto", "body": "Cuerpo" }
[/SEND_EMAIL]

[SEND_CHAT]
{ "deal_id": "uuid", "message": "Texto" }
[/SEND_CHAT]

[CREATE_LEAD]
{ "clientName": "Nombre", "clientEmail": "opcional", "clientPhone": "opcional", "title": "Título", "autoId": null, "estimatedValue": 0, "message": "nota" }
[/CREATE_LEAD]

[UPDATE_DEAL]
{ "deal_id": "uuid", "stage": "etapa", "internalNotes": "nota", "estimatedValue": 5000 }
[/UPDATE_DEAL]

[CREATE_TRANSACTION]
{ "type": "income", "amount": 5000, "description": "...", "date": "${today}", "payment_method": "efectivo", "deal_id": null }
[/CREATE_TRANSACTION]

[DELETE_TRANSACTION]
{ "transaction_id": "uuid" }
[/DELETE_TRANSACTION]

[UPDATE_PROFILE]
{ "name": "...", "phone": "...", "address": "...", "description": "..." }
[/UPDATE_PROFILE]
${userRole === 'concesionaria' ? `
[CREATE_AUTO]
{ "make": "Toyota", "model": "Corolla", "year": 2022, "price": 350000, "mileage": 15000, "transmission": "Automático", "status": "draft" }
[/CREATE_AUTO]
` : ''}${extra}

ÚLTIMAS TRANSACCIONES (transaction_id):
${recentTx.length ? recentTx.map(t => `- ID: ${t.id} | ${t.type} | ${fmtMoney(t.amount)} | ${t.description}`).join('\n') : '(Sin transacciones)'}

REGLAS: confirma acciones, no inventes datos, pregunta si hay ambigüedad en leads.
`;
}

export async function processAiActions(reply, ctx) {
  const { user, req } = ctx;
  const uid = orgId(user);
  const role = user.role;
  let out = reply;

  out = await processBlock(out, 'SEND_EMAIL', async (data) => {
    if (!data.to || !data.subject || !data.body) throw new Error('to, subject y body requeridos');
    await sendEmail(data.to, data.subject, data.body, null, user.id);
    return `\n\n📧 *Correo enviado a ${data.to}*`;
  });

  out = await processBlock(out, 'SEND_CHAT', async (data) => {
    if (!data.deal_id || !data.message?.trim()) throw new Error('deal_id y message requeridos');
    const msgId = uuid();

    if (role === 'cliente') {
      const deal = await clientOwnsDeal(user.email, data.deal_id);
      if (!deal) throw new Error('Trámite no encontrado');
      await run(
        'INSERT INTO chat_messages (id, deal_id, sender_id, message) VALUES (?, ?, ?, ?)',
        [msgId, data.deal_id, user.id, data.message.trim()],
      );
      const saved = await get(
        `SELECT m.id, m.sender_id, m.message, m.file_url, m.created_at, u.name AS sender_name, u.role AS sender_role
         FROM chat_messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`,
        [msgId],
      );
      if (deal.user_id) {
        const notifId = uuid();
        const title = 'Nuevo mensaje del Cliente';
        const body = data.message.substring(0, 100);
        await run(
          'INSERT INTO notifications (id, user_id, type, title, body, ref_id) VALUES (?, ?, ?, ?, ?, ?)',
          [notifId, deal.user_id, 'new_message', title, body, data.deal_id],
        );
        emitUserNotification(deal.user_id, {
          id: notifId, type: 'new_message', title, body, ref_id: data.deal_id, is_read: 0,
          created_at: new Date().toISOString(),
        });
        setImmediate(() => {
          maybeAutoReplyClientChat(data.deal_id, deal.user_id, user.id).catch(() => {});
        });
      }
      emitChatMessage(data.deal_id, saved);
      return '\n\n💬 *Mensaje enviado a tu gestoría en el chat del trámite*';
    }

    const deal = await get('SELECT id, user_id, contact_id FROM crm_deals WHERE id = ? AND user_id = ?', [data.deal_id, uid]);
    if (!deal) throw new Error('Lead/trámite no encontrado');
    await run(
      'INSERT INTO chat_messages (id, deal_id, sender_id, message) VALUES (?, ?, ?, ?)',
      [msgId, data.deal_id, user.id, data.message.trim()],
    );
    const contact = await get('SELECT email FROM contacts WHERE id = ?', [deal.contact_id]);
    const clientUser = contact?.email
      ? await get('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND role = ?', [contact.email, 'cliente'])
      : null;
    if (clientUser?.id) {
      const notifId = uuid();
      const title = 'Nuevo mensaje en tu trámite';
      const body = data.message.substring(0, 100);
      await run(
        'INSERT INTO notifications (id, user_id, type, title, body, ref_id) VALUES (?, ?, ?, ?, ?, ?)',
        [notifId, clientUser.id, 'new_message', title, body, data.deal_id],
      );
      emitUserNotification(clientUser.id, {
        id: notifId, type: 'new_message', title, body, ref_id: data.deal_id, is_read: 0,
        created_at: new Date().toISOString(),
      });
    }
    const saved = await get(
      `SELECT m.id, m.sender_id, m.message, m.created_at, u.name AS sender_name
       FROM chat_messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`,
      [msgId],
    );
    emitChatMessage(data.deal_id, saved);
    return '\n\n💬 *Mensaje enviado al chat del cliente*';
  });

  out = await processBlock(out, 'CREATE_LEAD', async (data) => {
    if (role === 'cliente') throw new Error('No disponible para clientes');
    if (!data.clientName?.trim()) throw new Error('clientName requerido');
    const dealId = await createManualVentaDeal(uid, {
      clientName: data.clientName,
      clientEmail: data.clientEmail || null,
      clientPhone: data.clientPhone || null,
      title: data.title || null,
      autoId: data.autoId || null,
      estimatedValue: data.estimatedValue || 0,
      message: data.message || null,
      stage: 'lead_nuevo',
    });
    return `\n\n✅ *Lead creado* — ${data.clientName} (ID: \`${dealId}\`)`;
  });

  out = await processBlock(out, 'UPDATE_DEAL', async (data) => {
    if (role === 'cliente') throw new Error('No disponible para clientes');
    if (!data.deal_id) throw new Error('deal_id requerido');
    const deal = await get('SELECT id, stage FROM crm_deals WHERE id = ? AND user_id = ?', [data.deal_id, uid]);
    if (!deal) throw new Error('Trámite no encontrado');
    const sets = ['updated_at = NOW()'];
    const params = [];
    if (data.stage !== undefined) { sets.push('stage = ?'); params.push(data.stage); }
    if (data.internalNotes !== undefined) { sets.push('internal_notes = ?'); params.push(data.internalNotes); }
    if (data.estimatedValue !== undefined) { sets.push('estimated_value = ?'); params.push(Number(data.estimatedValue)); }
    if (sets.length === 1) throw new Error('Indica al menos un campo a actualizar');
    params.push(data.deal_id, uid);
    await run(`UPDATE crm_deals SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);
    return `\n\n✅ *Trámite actualizado* (ID: \`${data.deal_id}\`)`;
  });

  out = await processBlock(out, 'CREATE_TRANSACTION', async (data) => {
    if (role === 'cliente') throw new Error('No disponible para clientes');
    if (!data.type || !data.amount || !data.description || !data.date) {
      throw new Error('type, amount, description y date requeridos');
    }
    const txId = uuid();
    await run(
      'INSERT INTO fin_transactions (id, user_id, deal_id, type, amount, description, category, date, payment_method, referencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [txId, uid, data.deal_id || null, data.type, Number(data.amount), data.description,
        data.category || 'general', data.date, data.payment_method || 'general', data.referencia?.trim() || null],
    );
    const label = data.type === 'income' ? 'Ingreso' : 'Gasto';
    return `\n\n✅ *${label} registrado* — ${fmtMoney(data.amount)} | ${data.description}`;
  });

  out = await processBlock(out, 'DELETE_TRANSACTION', async (data) => {
    if (role === 'cliente') throw new Error('No disponible para clientes');
    if (!data.transaction_id) throw new Error('transaction_id requerido');
    const result = await run('DELETE FROM fin_transactions WHERE id = ? AND user_id = ?', [data.transaction_id, uid]);
    if (!result.affectedRows) throw new Error('Transacción no encontrada');
    return '\n\n✅ *Transacción eliminada*';
  });

  out = await processBlock(out, 'CREATE_AUTO', async (data) => {
    if (role !== 'concesionaria') throw new Error('Solo concesionarias');
    if (!data.make || !data.model || !data.year || !data.price) {
      throw new Error('make, model, year y price requeridos');
    }
    const autoId = uuid();
    await run(
      `INSERT INTO autos (id, user_id, make, model, year, price, mileage, transmission, location, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [autoId, uid, data.make, data.model, Number(data.year), Number(data.price),
        Number(data.mileage || 0), data.transmission || 'Automático', data.location || null,
        data.description || null, data.status === 'published' ? 'published' : 'draft'],
    );
    return `\n\n✅ *Vehículo agregado* — ${data.make} ${data.model} ${data.year} (ID: \`${autoId}\`)`;
  });

  out = await processBlock(out, 'UPDATE_AUTO', async (data) => {
    if (role !== 'concesionaria') throw new Error('Solo concesionarias');
    if (!data.auto_id) throw new Error('auto_id requerido');
    const existing = await get('SELECT id FROM autos WHERE id = ? AND user_id = ?', [data.auto_id, uid]);
    if (!existing) throw new Error('Vehículo no encontrado');
    const sets = [];
    const params = [];
    const map = {
      make: data.make, model: data.model, year: data.year, price: data.price,
      mileage: data.mileage, transmission: data.transmission, location: data.location,
      description: data.description,
    };
    for (const [col, val] of Object.entries(map)) {
      if (val !== undefined) {
        sets.push(`${col} = ?`);
        params.push(['year', 'price', 'mileage'].includes(col) ? Number(val) : val);
      }
    }
    if (data.status !== undefined) {
      sets.push('status = ?');
      sets.push('active = ?');
      params.push(data.status, data.status === 'published' ? 1 : 0);
    }
    if (!sets.length) throw new Error('Indica campos a actualizar');
    params.push(data.auto_id, uid);
    await run(`UPDATE autos SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);
    return `\n\n✅ *Vehículo actualizado* (ID: \`${data.auto_id}\`)`;
  });

  out = await processBlock(out, 'DELETE_AUTO', async (data) => {
    if (role !== 'concesionaria') throw new Error('Solo concesionarias');
    if (!data.auto_id) throw new Error('auto_id requerido');
    const result = await run('DELETE FROM autos WHERE id = ? AND user_id = ?', [data.auto_id, uid]);
    if (!result.affectedRows) throw new Error('Vehículo no encontrado');
    return '\n\n✅ *Vehículo eliminado del inventario*';
  });

  out = await processBlock(out, 'CREATE_SERVICE', async (data) => {
    if (role !== 'gestor') throw new Error('Solo gestores');
    if (!data.name?.trim()) throw new Error('name requerido');
    const gestor = await get('SELECT id FROM gestores WHERE user_id = ?', [uid]);
    if (!gestor) throw new Error('Perfil de gestor no encontrado');
    const id = uuid();
    const maxOrder = await get(
      'SELECT COALESCE(MAX(sort_order), -1) AS maxOrder FROM gestor_services WHERE gestor_id = ?',
      [gestor.id],
    );
    const priceValue = data.price != null && data.price !== '' ? Number(data.price) : null;
    await run(
      `INSERT INTO gestor_services (id, gestor_id, name, time_estimate, price, required_documents, includes, bonus, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, gestor.id, data.name.trim(), data.timeEstimate || null, priceValue,
        JSON.stringify(['INE', 'Tarjeta de Circulación', 'Factura de Origen']),
        JSON.stringify([]), JSON.stringify([]), (maxOrder?.maxOrder ?? -1) + 1],
    );
    return `\n\n✅ *Servicio creado* — ${data.name} (ID: \`${id}\`)`;
  });

  out = await processBlock(out, 'UPDATE_SERVICE', async (data) => {
    if (role !== 'gestor') throw new Error('Solo gestores');
    if (!data.service_id) throw new Error('service_id requerido');
    const gestor = await get('SELECT id FROM gestores WHERE user_id = ?', [uid]);
    if (!gestor) throw new Error('Perfil de gestor no encontrado');
    const svc = await get('SELECT id FROM gestor_services WHERE id = ? AND gestor_id = ?', [data.service_id, gestor.id]);
    if (!svc) throw new Error('Servicio no encontrado');
    const sets = [];
    const params = [];
    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
    if (data.timeEstimate !== undefined) { sets.push('time_estimate = ?'); params.push(data.timeEstimate); }
    if (data.price !== undefined) { sets.push('price = ?'); params.push(data.price != null ? Number(data.price) : null); }
    if (!sets.length) throw new Error('Indica campos a actualizar');
    params.push(data.service_id, gestor.id);
    await run(`UPDATE gestor_services SET ${sets.join(', ')} WHERE id = ? AND gestor_id = ?`, params);
    return `\n\n✅ *Servicio actualizado* (ID: \`${data.service_id}\`)`;
  });

  out = await processBlock(out, 'DELETE_SERVICE', async (data) => {
    if (role !== 'gestor') throw new Error('Solo gestores');
    if (!data.service_id) throw new Error('service_id requerido');
    const gestor = await get('SELECT id FROM gestores WHERE user_id = ?', [uid]);
    if (!gestor) throw new Error('Perfil de gestor no encontrado');
    const result = await run('DELETE FROM gestor_services WHERE id = ? AND gestor_id = ?', [data.service_id, gestor.id]);
    if (!result.affectedRows) throw new Error('Servicio no encontrado');
    return '\n\n✅ *Servicio eliminado*';
  });

  out = await processBlock(out, 'CREATE_VEHICLE', async (data) => {
    if (role !== 'cliente') throw new Error('Solo clientes');
    const vehicleId = await createClientVehicle(user.email, data);
    return `\n\n✅ *Vehículo registrado* — placa ${String(data.plate).toUpperCase()} (ID: \`${vehicleId}\`)`;
  });

  out = await processBlock(out, 'UPDATE_VEHICLE', async (data) => {
    if (role !== 'cliente') throw new Error('Solo clientes');
    if (!data.vehicle_id) throw new Error('vehicle_id requerido');
    if (!await clientOwnsVehicle(user.email, data.vehicle_id)) throw new Error('Vehículo no encontrado');
    const row = await get('SELECT plate FROM contact_vehicles WHERE id = ?', [data.vehicle_id]);
    const plateKey = data.plate ? String(data.plate).trim().toUpperCase() : row?.plate;
    const insExpiry = data.insuranceExpiry !== undefined
      ? (data.insuranceExpiry && String(data.insuranceExpiry).trim() ? String(data.insuranceExpiry).slice(0, 10) : null)
      : undefined;
    const tenencia = data.tenenciaStatus !== undefined
      ? (['si', 'no', 'pendiente'].includes(data.tenenciaStatus) ? data.tenenciaStatus : null)
      : undefined;
    const tenenciaYear = tenencia !== undefined ? (tenencia ? new Date().getFullYear() : null) : undefined;
    await run(
      `UPDATE contact_vehicles cv
       JOIN contacts c ON c.id = cv.contact_id
       SET cv.plate = COALESCE(?, cv.plate), cv.make = COALESCE(?, cv.make), cv.model = COALESCE(?, cv.model),
           cv.year = COALESCE(?, cv.year), cv.state = COALESCE(?, cv.state),
           cv.engomado_color = COALESCE(?, cv.engomado_color),
           cv.insurance_expiry = ${insExpiry !== undefined ? '?' : 'cv.insurance_expiry'},
           cv.tenencia_2026 = ${tenencia !== undefined ? '?' : 'cv.tenencia_2026'},
           cv.tenencia_year = ${tenenciaYear !== undefined ? '?' : 'cv.tenencia_year'},
           cv.updated_at = NOW()
       WHERE LOWER(c.email) = LOWER(?) AND UPPER(cv.plate) = UPPER(?)`,
      [
        data.plate ? String(data.plate).trim().toUpperCase() : null,
        data.make ?? null, data.model ?? null,
        data.year != null && data.year !== '' ? Number(data.year) : null,
        data.state ?? null,
        data.engomadoColor ?? null,
        ...(insExpiry !== undefined ? [insExpiry] : []),
        ...(tenencia !== undefined ? [tenencia] : []),
        ...(tenenciaYear !== undefined ? [tenenciaYear] : []),
        user.email, plateKey,
      ],
    );
    return `\n\n✅ *Vehículo actualizado* (ID: \`${data.vehicle_id}\`)`;
  });

  out = await processBlock(out, 'DELETE_VEHICLE', async (data) => {
    if (role !== 'cliente') throw new Error('Solo clientes');
    if (!data.vehicle_id) throw new Error('vehicle_id requerido');
    if (!await clientOwnsVehicle(user.email, data.vehicle_id)) throw new Error('Vehículo no encontrado');
    await run('DELETE FROM contact_vehicle_documents WHERE vehicle_id = ?', [data.vehicle_id]);
    await run(
      `DELETE cv FROM contact_vehicles cv
       JOIN contacts c ON c.id = cv.contact_id
       WHERE cv.id = ? AND LOWER(c.email) = LOWER(?)`,
      [data.vehicle_id, user.email],
    );
    return '\n\n✅ *Vehículo eliminado*';
  });

  out = await processBlock(out, 'DELETE_DOCUMENT', async (data) => {
    if (role !== 'cliente') throw new Error('Solo clientes');
    if (!data.document_id) throw new Error('document_id requerido');
    if (data.source === 'vehicle') {
      const doc = await get(
        `SELECT cvd.id FROM contact_vehicle_documents cvd
         JOIN contact_vehicles cv ON cv.id = cvd.vehicle_id
         JOIN contacts c ON c.id = cv.contact_id
         WHERE cvd.id = ? AND LOWER(c.email) = LOWER(?)`,
        [data.document_id, user.email],
      );
      if (!doc) throw new Error('Documento no encontrado');
      await run('DELETE FROM contact_vehicle_documents WHERE id = ?', [data.document_id]);
    } else {
      const doc = await get(
        'SELECT id FROM client_wallet_documents WHERE id = ? AND user_id = ?',
        [data.document_id, user.id],
      );
      if (!doc) throw new Error('Documento no encontrado');
      await run('DELETE FROM client_wallet_documents WHERE id = ?', [data.document_id]);
    }
    return '\n\n✅ *Documento eliminado de la billetera*';
  });

  out = await processBlock(out, 'ASSOCIATE_WALLET_DOC', async (data) => {
    if (role !== 'cliente') throw new Error('Solo clientes');
    if (!data.document_id || !data.vehicle_id) throw new Error('document_id y vehicle_id requeridos');
    if (!await clientOwnsVehicle(user.email, data.vehicle_id)) throw new Error('Vehículo no encontrado');
    const walletDoc = await get(
      'SELECT * FROM client_wallet_documents WHERE id = ? AND user_id = ?',
      [data.document_id, user.id],
    );
    if (!walletDoc) throw new Error('Documento de billetera no encontrado');
    const vehicle = await get('SELECT user_id FROM contact_vehicles WHERE id = ?', [data.vehicle_id]);
    const ext = (walletDoc.file_url || '').match(/\.[a-z0-9]{2,5}($|\?)/i)?.[0]?.replace('?', '') || '';
    const docId = uuid();
    await run(
      `INSERT INTO contact_vehicle_documents (id, vehicle_id, user_id, label, file_name, file_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [docId, data.vehicle_id, vehicle.user_id, walletDoc.label, `${walletDoc.label}${ext}`, walletDoc.file_url],
    );
    await run('DELETE FROM client_wallet_documents WHERE id = ?', [data.document_id]);
    return '\n\n✅ *Documento asociado al vehículo*';
  });

  out = await processBlock(out, 'UPDATE_PROFILE', async (data) => {
    const sets = [];
    const params = [];
    const targetId = role === 'cliente' ? user.id : uid;
    if (data.name) { sets.push('name = ?'); params.push(data.name); }
    if (data.phone !== undefined) { sets.push('phone = ?'); params.push(data.phone || null); }
    if (data.address !== undefined) { sets.push('address = ?'); params.push(data.address || null); }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description || null); }
    if (!sets.length) throw new Error('Indica al menos un campo');
    params.push(targetId);
    await run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
    return `\n\n✅ *Perfil actualizado* — ${sets.map(s => s.split(' =')[0]).join(', ')}`;
  });

  return out;
}
