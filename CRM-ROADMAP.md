# Roadmap CRM — Trámites Vehiculares

Estado del CRM embebido en los paneles de **Gestor** y **Concesionaria**.

---

## Resumen de fases

| Fase | Estado | Enfoque |
|------|--------|---------|
| **Fase 1** | ✅ Implementada | CRM ligero: contactos, pipeline Kanban, plantillas, KPIs básicos |
| **Fase 2** | ✅ Implementada | Productividad: tareas, bandeja “Hoy”, contacto 360°, motivo de pérdida |
| **Fase 3** | ⏳ Pendiente | Crecimiento: cotizaciones, documentos, automatizaciones, multi-usuario |
| **Fase 4** | ⏳ Pendiente | Escala: integraciones externas, scoring, reportes avanzados |

---

## Fase 1 — CRM ligero ✅

> Ya implementada. Referencia de lo que existe hoy.

### Backend
- Tablas: `contacts`, `crm_deals`, `crm_activities`, `message_templates`
- API `/api/crm`: dashboard, deals, actividades, plantillas, contactos
- Creación automática de contacto + deal al recibir solicitud (gestor) o pregunta (concesionaria)
- Migración: `backend/sql/migration-v4-crm.sql`

### Frontend
- Pipeline Kanban con etapas por rol
- Panel de detalle de deal (notas, etapa, WhatsApp, plantillas)
- KPIs en dashboard (activos, conversión, estancados, etc.)
- UI de servicios en panel gestor
- Formulario público de solicitud en perfil de gestor

### Etapas del pipeline

**Gestor (trámites):**  
`nuevo` → `contactado` → `en_tramite` → `documentacion` → `completado` / `perdido`

**Concesionaria (ventas):**  
`lead_nuevo` → `contactado` → `interesado` → `visita` → `negociacion` → `vendido` / `perdido`

---

## Fase 2 — Productividad ✅

> Ya implementada. Referencia de lo que existe hoy.

### Backend
- Tabla: `crm_tasks`
- Campos en `crm_deals`: `lost_reason`, `first_response_at`
- Rutas: `/api/crm/today`, `/api/crm/contacts/:id`, CRUD de tareas
- Búsqueda y filtro en deals (`?q=` y `?stage=`)
- KPIs: sin respuesta, tareas hoy/vencidas, tiempo medio de 1ª respuesta
- Migración: `backend/sql/migration-v5-crm-phase2.sql`

### Frontend
- **Bandeja de hoy:** tareas vencidas, tareas de hoy, leads sin respuesta, deals estancados
- **Tareas** en detalle de tarjeta (agendar, completar)
- **Motivo de pérdida** al marcar “Perdido”
- **Contacto 360°:** historial de tratos, actividades y tareas
- **Búsqueda y filtro** en pipeline

---

## Fase 3 — Crecimiento ⏳

Objetivo: convertir el CRM en herramienta de **cierre y operación diaria**, no solo seguimiento.

### 3.1 Cotizaciones / proformas (Concesionaria)

| Item | Descripción |
|------|-------------|
| **Qué es** | Generar propuesta formal por lead (auto, precio, condiciones, validez) |
| **Backend** | Tabla `crm_quotes` (deal_id, items JSON, total, valid_until, status, pdf_url) |
| **API** | `POST /api/crm/deals/:id/quotes`, `GET /quotes/:id/pdf` |
| **Frontend** | Botón “Generar cotización” en deal; etapa “Propuesta enviada”; descarga PDF |
| **Extra** | Campos en deal: enganche, auto a cuenta, plazo de crédito |

### 3.2 Documentos adjuntos (Gestor)

| Item | Descripción |
|------|-------------|
| **Qué es** | Subir INE, factura, tarjeta de circulación, etc. por trámite |
| **Backend** | Tabla `crm_documents` (deal_id, filename, mime, path, uploaded_by) |
| **API** | `POST /api/crm/deals/:id/documents` (multipart), `GET`, `DELETE` |
| **Frontend** | Sección “Documentos” en panel del deal; lista + subir archivo |
| **Seguridad** | Solo owner del deal; límite de tamaño; tipos permitidos (pdf, jpg, png) |

### 3.3 Automatizaciones básicas

| Trigger | Acción |
|---------|--------|
| Nuevo lead / solicitud | Email o WhatsApp de confirmación al cliente |
| Deal estancado > 48h | Notificación in-app al gestor/concesionaria |
| Tarea vencida | Badge en sidebar + item en bandeja “Hoy” |
| Deal → Completado / Vendido | Pedir reseña en directorio público |
| Deal en “Documentación” > 5 días | Recordatorio automático al cliente |

**Backend:** tabla `crm_automation_rules` o reglas fijas en código + job/cron  
**Frontend:** preferencias on/off por tipo de automatización en panel

### 3.4 Notificaciones in-app

| Item | Descripción |
|------|-------------|
| **Backend** | Tabla `notifications` (user_id, type, title, body, read, ref_id) |
| **API** | `GET /api/crm/notifications`, `PATCH /notifications/:id/read` |
| **Frontend** | Campana en nav del panel; contador; listado de alertas |

### 3.5 Multi-usuario por cuenta

| Item | Descripción |
|------|-------------|
| **Qué es** | Varios empleados por gestoría o concesionaria |
| **Backend** | Rol `empleado_gestor` / `empleado_concesionaria`; campo `assigned_to` en deals y tasks |
| **Frontend** | Asignar lead a vendedor; filtrar “Mis deals”; vista gerente con todos |
| **Admin** | Super admin crea sub-usuarios o invita por email |

### 3.6 Post-venta

| Item | Descripción |
|------|-------------|
| **Gestor** | Tras “Completado”: encuesta + solicitud de reseña |
| **Concesionaria** | Tras “Vendido”: seguimiento a 30/90 días (tareas automáticas) |
| **Backend** | Workflow al cambiar a etapa ganadora; plantillas de post-venta |

### Entregables Fase 3

- [ ] Cotizaciones PDF (concesionaria)
- [ ] Upload de documentos (gestor)
- [ ] Notificaciones in-app
- [ ] 3–5 automatizaciones configurables
- [ ] Asignación de deals a usuarios (multi-usuario básico)
- [ ] Flujo post-venta con tareas automáticas

**Estimación:** 3–4 sprints

---

## Fase 4 — Escala ⏳

Objetivo: crecer volumen de leads, medir rendimiento comercial y operar a escala.

### 4.1 Integración de leads externos

| Fuente | Descripción |
|--------|-------------|
| Facebook Marketplace | Webhook o import CSV de leads |
| Mercado Libre | API / export de preguntas |
| Formulario web embebido | Widget en sitios de terceros |
| WhatsApp Business API | Leads entrantes → contacto + deal automático |

**Backend:** tabla `lead_sources`, campo `source` en contacts/deals, endpoint de ingestión  
**Frontend:** configuración de fuentes; badge de origen en tarjeta

### 4.2 Score de lead (caliente / tibio / frío)

| Señal | Peso |
|-------|------|
| Respondió en < 1h | +20 |
| Pidió visita / cotización | +30 |
| Sin respuesta > 3 días | −15 |
| Vio el auto N veces (tracking) | +10 |

**Backend:** campo `lead_score` en deals; job de recálculo  
**Frontend:** indicador visual en Kanban (🔥 / 🌡 / ❄)

### 4.3 CRM telefónico / click-to-call

- Registrar llamadas como actividad (`activity_type: call`)
- Duración, resultado (contestó, no contestó, buzón)
- Integración opcional con Twilio o similar

### 4.4 Reportes y analytics

| Reporte | Audiencia |
|---------|-----------|
| Embudo de conversión por etapa | Gerente |
| Tiempo medio por etapa | Operaciones |
| Rendimiento por vendedor | Gerente concesionaria |
| Servicios más rentables | Gestor |
| Rotación de inventario (días publicado) | Concesionaria |
| Origen de leads (ROI por canal) | Marketing |

**Backend:** `/api/crm/reports/*` con rangos de fecha  
**Frontend:** pestaña “Reportes” con gráficas (Chart.js o similar)

### 4.5 Multi-sucursal / franquicias

- Varias concesionarias bajo una cuenta matriz
- Dashboard consolidado para admin de grupo
- Comparativa entre sucursales

### 4.6 Campañas de reactivación

- Segmentos: “clientes sin actividad 6 meses”, “verificación anual”
- Envío masivo con plantillas (email/WhatsApp)
- Opt-out y cumplimiento básico

### Entregables Fase 4

- [ ] Al menos 1 integración de leads externos
- [ ] Lead scoring visible en pipeline
- [ ] Módulo de reportes con 4+ gráficas
- [ ] Registro de llamadas en historial
- [ ] (Opcional) Multi-sucursal y campañas

**Estimación:** 4+ sprints

---

## Orden sugerido de implementación

```
Fase 3.1 Cotizaciones PDF          ← mayor impacto ventas (concesionaria)
Fase 3.2 Documentos adjuntos       ← mayor impacto operación (gestor)
Fase 3.4 Notificaciones in-app     ← base para automatizaciones
Fase 3.3 Automatizaciones          ← depende de notificaciones
Fase 3.5 Multi-usuario             ← cuando haya equipos reales
Fase 3.6 Post-venta                ← retención y reseñas
───────────────────────────────────
Fase 4.2 Lead scoring              ← quick win analítico
Fase 4.4 Reportes                  ← visibilidad gerencial
Fase 4.1 Integraciones externas    ← según canal de marketing
Fase 4.3 / 4.5 / 4.6               ← según escala del negocio
```

---

## Stack técnico actual (referencia)

| Capa | Tecnología |
|------|------------|
| Backend | Node.js, Express, MySQL (XAMPP) |
| Frontend | Angular 19 (standalone) |
| Auth | JWT, roles: gestor, concesionaria, admin |
| CRM API | `/api/crm/*` |
| Migraciones | `npm run db:migrate` en `backend/` |

### Archivos clave del CRM

```
backend/sql/migration-v4-crm.sql      # Fase 1
backend/sql/migration-v5-crm-phase2.sql
backend/src/routes/crm.js
backend/src/crm/helpers.js
backend/src/crm/stages.js
frontend/src/app/core/api.service.ts  # CrmService
frontend/src/app/features/panel/crm-*.component.*
frontend/src/app/features/panel/panel-gestor.component.*
frontend/src/app/features/panel/panel-concesionaria.component.*
```

---

## Usuarios demo para pruebas

| Email | Rol | Password |
|-------|-----|----------|
| `gestor@demo.com` | Gestor | `demo1234` |
| `concesionaria@demo.com` | Concesionaria | `demo1234` |
| `admin@demo.com` | Super Admin | `demo1234` |

---

*Última actualización: junio 2026 — Fases 1 y 2 completadas.*
