# Trámites Vehiculares — Gestores y Autos

Aplicación Angular + API Node.js multi-usuario.

## Estructura

```
web/
├── backend/          # API REST (Express + SQLite)
├── frontend/         # App Angular
├── index.html        # Landing original (sin cambios)
└── ...
```

## Arrancar el backend (MySQL / XAMPP)

1. Abre **XAMPP Control Panel** y enciende **Apache** + **MySQL**  
   (o ejecuta `C:\xampp\mysql_start.bat` y `C:\xampp\apache_start.bat`)

2. **phpMyAdmin**: http://localhost/phpmyadmin  
   - Usuario: `root`  
   - Contraseña: *(vacía)*  
   - Base de datos: `tramites_vehiculares` (se crea automáticamente con el script)

```powershell
cd backend
npm install
npm run db:setup   # crea BD y tablas en MySQL
npm run seed       # datos demo (solo la primera vez)
npm run dev        # http://localhost:3000
```

También puedes importar manualmente `backend/sql/schema.sql` desde phpMyAdmin → Importar.

## Arrancar el frontend

```bash
cd frontend
npm install
npm start       # http://localhost:4200
```

## Usuarios demo

| Email | Rol | Contraseña |
|-------|-----|------------|
| gestor@demo.com | Gestor | demo1234 |
| gestor2@demo.com | Gestor | demo1234 |
| concesionaria@demo.com | Concesionaria | demo1234 |
| concesionaria2@demo.com | Concesionaria | demo1234 |

## API

- `POST /api/auth/login` — Iniciar sesión
- `POST /api/auth/register` — Registro (gestor / concesionaria)
- `GET /api/gestores` — Directorio público (filtros: state, minRating)
- `GET /api/gestores/:slug` — Perfil público
- `GET /api/gestores/me/profile` — Panel gestor (JWT)
- `PUT /api/gestores/me/profile` — Editar perfil propio
- `GET /api/autos` — Catálogo público
- `GET /api/autos/me/inventory` — Inventario propio (JWT concesionaria)
- `POST /api/autos` — Publicar vehículo (solo el dueño)

Cada usuario solo puede modificar **sus** gestorías o **sus** autos.
