# Contexto del Proyecto: CRM Trámites Vehiculares

Este documento sirve como resumen general de la arquitectura, tecnologías y configuración del proyecto, así como las instrucciones de acceso al servidor de producción. Está diseñado para darle contexto rápido a la IA y evitar gastar tokens explicando todo desde cero en futuras sesiones.

## 🛠️ Stack Tecnológico

El proyecto es una aplicación web full-stack diseñada para la gestión de trámites vehiculares, ventas de autos y un sistema CRM integrado.

### Frontend
- **Framework:** Angular (usando componentes Standalone y la nueva sintaxis de control de flujo `@if`, `@for`).
- **Estilos:** CSS puro / CSS variables para temas dinámicos (`--p-primary-color`, etc.) y clases utilitarias.
- **Tiempo Real:** `socket.io-client` para el chat en vivo del CRM.
- **Estructura:** Se ubica en la carpeta `/frontend`. Usa Nginx para servir los archivos estáticos en producción.

### Backend
- **Framework:** Node.js con Express.
- **Base de Datos:** MySQL (conector `mysql2/promise`). Las migraciones SQL crudas se corren manual o automáticamente desde archivos en `/backend/sql/`.
- **Tiempo Real:** `socket.io` integrado en el servidor HTTP de Express para el chat y notificaciones.
- **Estructura:** Se ubica en la carpeta `/backend`.

### Infraestructura y Despliegue
- **Contenedores:** Se utiliza Docker y `docker-compose`.
  - `tramites-frontend`: Nginx sirviendo la app de Angular y actuando como Reverse Proxy para la API y los WebSockets.
  - `tramites-backend`: Node.js API en el puerto 3000.
  - `tramites-db`: Servidor MySQL 8.
- **Dominio/IP:** `2.25.197.82`

---

## 🚀 Acceso al Servidor de Producción (SSH)

El despliegue está alojado en un VPS externo. Para interactuar con él directamente desde scripts de Node.js usando la librería `ssh2`, o desde la terminal:

- **Host:** `2.25.197.82`
- **Puerto:** `22`
- **Usuario:** `root`
- **Contraseña:** `24@Camila@232`
- **Ruta del proyecto:** `/root/crmchar`

### Comandos Útiles de Docker en el Servidor
Si necesitas reconstruir o reiniciar los servicios después de hacer un cambio en el código, los comandos deben ejecutarse dentro de la ruta `/root/crmchar`:

**Reconstruir el Backend:**
```bash
docker compose up -d --build backend
```

**Reconstruir el Frontend:**
```bash
docker compose up -d --build frontend
```

**Ver logs del Backend:**
```bash
docker logs --tail 100 -f tramites-backend
```

**Ejecutar comandos dentro de la Base de Datos:**
```bash
docker exec -it tramites-db mysql -u root -p'supersecret' tramites_vehiculares
```

---

## 📁 Estructura Principal del Repositorio Local

En el entorno de desarrollo de Windows local, el proyecto se encuentra en:
`C:\Users\menph\OneDrive\Desktop\web`

- `/backend/src/index.js` - Archivo principal del servidor, donde se configura Express y Socket.io.
- `/backend/sql/` - Historial de todas las migraciones SQL de la base de datos (Ej: `migration-v20-stripe.sql`).
- `/backend/src/routes/` - Controladores de la API (Auth, CRM, Gestores, Autos, etc.).
- `/frontend/src/app/` - Código fuente de Angular.
- `/frontend/nginx.conf` - Configuración del proxy inverso para producción. ¡Muy importante para las reglas de WebSocket (`/socket.io/`)!

## ⚠️ Notas Importantes para la IA
0. **🚨 FRONTEND = ANGULAR, NO HTMLs SUELTOS:** Todo el trabajo de interfaz de usuario se realiza EXCLUSIVAMENTE dentro de la app Angular ubicada en `/frontend/src/app/`. Los archivos `.html` sueltos en la raíz del proyecto (`gestores.html`, `autos.html`, `index.html`, etc.) son prototipos obsoletos y **NO deben modificarse**. Las features principales están en `/frontend/src/app/features/` con subdirectorios como `gestores/`, `autos/`, `panel/`, `auth/`, etc. Cada feature tiene sus propios archivos `.component.ts`, `.component.html` y `.component.css`.
1. **Migraciones:** Si agregas una nueva columna a la base de datos, siempre verifica si se necesita un archivo nuevo de migración en la carpeta `sql/` y asegúrate de que el código de `migrate.js` lo mande a llamar.
2. **WebSockets (Socket.io):** Nginx debe tener la directiva `proxy_set_header Upgrade $http_upgrade;` configurada correctamente. Cuidado al inyectar configuraciones por script, no escapes el símbolo del dólar (`$`) si usas sintaxis de `EOF` en bash, o Nginx fallará con `Invalid Upgrade header`.
3. **Roles de Usuario:** Existen diferentes roles (`admin`, `gestor`, `concesionaria`, `cliente`) y un estado (`status`) que puede ser `active` o `pending_payment`. El acceso al CRM se valida a través de un Middleware según el rol del JWT.
