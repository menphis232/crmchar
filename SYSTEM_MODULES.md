# Documentación del Sistema: CRM Trámites Vehiculares y Concesionarias

Este documento describe la arquitectura, los módulos principales y el funcionamiento del sistema. Está diseñado para proporcionar contexto a modelos de IA o desarrolladores sobre las capacidades de la plataforma.

## 1. Visión General
El sistema es un CRM (Customer Relationship Management) especializado en el sector automotriz, específicamente para **Gestores de Trámites Vehiculares** y **Concesionarias**. Está compuesto por un frontend en Angular (v18) y un backend en Node.js/Express con base de datos MySQL 8.0.

### Roles de Usuario
- **Super Admin**: Control total del sistema, configuración global de IA (API Keys de OpenAI, Gemini, DeepSeek) y gestión de usuarios.
- **Gestor (Agente)**: Maneja trámites vehiculares, atiende clientes, sube documentos y mueve negocios en el embudo.
- **Concesionaria**: Perfil para agencias de autos. Pueden listar inventario de vehículos, integrarse con Google Maps y gestionar sus propios leads.
- **Cliente (Portal)**: Acceso limitado para que los clientes finales puedan ver el estatus de su trámite, chatear con el gestor y subir documentos.

---

## 2. Módulos Principales

### 2.1. Embudo de Ventas / CRM (Kanban)
- **Funcionamiento**: Tablero visual (Drag & Drop) donde los gestores arrastran tarjetas (Deals) a través de diferentes etapas.
- **Etapas Personalizables**: El usuario puede crear, editar y reordenar sus propias columnas (ej. *Lead Nuevo*, *En revisión*, *Completado*).
- **Métricas por Tarjeta**: Mide días estancados en una etapa, valor estimado del negocio (MXN) y marca con alertas rojas los tratos desatendidos.

### 2.2. Automatizaciones
- **Funcionamiento**: Motor de reglas lógicas (`crm_automations`). 
- **Triggers**: Se activan cuando una tarjeta entra a una etapa específica o lleva 'X' días estancada.
- **Acciones**: Puede enviar correos electrónicos automáticamente, mandar mensajes de WhatsApp o mover tarjetas. 
- **Logs**: Registra un historial (`automation_logs`) para evitar que una misma automatización se ejecute dos veces en el mismo trato.

### 2.3. Inteligencia Artificial y Chatbots
- **Multiproveedor**: Soporta OpenAI, Google Gemini y DeepSeek, con un sistema de *fallback* automático (si uno falla, intenta con el siguiente).
- **Asistente Virtual (Widget)**: Un chatbot instalable en páginas externas que responde dudas de clientes basándose en el inventario o servicios configurados.
- **CRM AI Copilot**: Genera resúmenes de conversaciones, sugiere respuestas automáticas a los clientes y redacta correos electrónicos con un clic.

### 2.4. Gestión de Documentos y OCR
- **Repositorio**: Cada trato/cliente tiene su propia bóveda de documentos (`deal_documents`).
- **OCR (Reconocimiento Óptico)**: Capacidad para leer imágenes o PDFs (como identificaciones oficiales o facturas de autos) y extraer datos estructurados automáticamente.

### 2.5. Constructor de Páginas (Page Builder)
- **Funcionamiento**: Editor visual "Drag & Drop" integrado en el panel. Permite a los gestores crear pequeñas páginas web o *Landing Pages* promocionales (Link in Bio) sin saber programar.
- **Bloques**: Texto, imágenes, botones y formularios de contacto que caen directamente al CRM.

### 2.6. Diseñador de PDFs
- **Funcionamiento**: Herramienta visual para generar plantillas de cotizaciones, recibos o comprobantes de trámites.
- Permite arrastrar variables dinámicas (ej. Nombre del cliente, precio, fecha) que se autocompletan al generar el PDF final.

### 2.7. Finanzas y Pagos (Stripe)
- **Integración con Stripe**: Permite enviar ligas de pago (Checkout) a los clientes directamente desde el chat del CRM.
- **Suscripciones**: Módulo para cobrar mensualidades a los gestores o concesionarias por usar la plataforma.
- **Registro Financiero**: Reportes de ingresos y proyecciones de ventas basadas en el valor del embudo.

### 2.8. Mensajería Omnicanal e Inbox
- **Bandeja Unificada**: Chat en tiempo real usando WebSockets (`socket.io`).
- **Plantillas**: Respuestas rápidas predefinidas para agilizar la atención.
- **Comunicaciones**: Interfaz para mandar correos y mensajes, registrando todo el historial (Activities) en la línea de tiempo del cliente.

### 2.9. Catálogo de Autos (Concesionarias)
- **Inventario**: Las concesionarias pueden subir su stock de vehículos (fotos, precios, características).
- Los leads que preguntan por un auto específico caen al CRM etiquetados con el vehículo de su interés.

---

## 3. Tecnologías Core
- **Frontend**: Angular 18 (Standalone Components, Signals), CSS nativo, HTML5 Drag & Drop.
- **Backend**: Node.js, Express, Socket.io, Multer (Archivos).
- **Base de Datos**: MySQL 8.0 (con migraciones automáticas).
- **Infraestructura**: Docker Compose, Nginx (Reverse Proxy) y Certbot (SSL Automático Let's Encrypt).
