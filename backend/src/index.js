import express from 'express';
import http from 'http';
import compression from 'compression';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import gestoresRoutes from './routes/gestores.js';
import autosRoutes from './routes/autos.js';
import concesionariaRoutes from './routes/concesionaria.js';
import adminRoutes from './routes/admin.js';
import crmRoutes from './routes/crm.js';
import siteRoutes, { adminSiteRouter } from './routes/site.js';
import uploadRoutes from './routes/upload.js';
import financesRoutes from './routes/finances.js';
import paymentsRoutes from './routes/payments.js';
import billingRoutes from './routes/billing.js';
import clientRoutes from './routes/client.js';
import webhooksRoutes from './routes/webhooks.js';
import aiRoutes from './routes/ai.js';
import shareRoutes from './routes/share.js';
import ogRoutes from './routes/og.js';
import peritoRoutes from './routes/perito.js';
import mpRoutes from './routes/mp.js';
import supportRoutes from './routes/support.js';
import { testConnection } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkStalledDeals } from './crm/automations.js';
import { startAutomationsCron } from './cron/automations.js';
import { redirectToFrontend } from './utils/frontend-url.js';
import { setSocketIo } from './utils/socket-events.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.set('trust proxy', 1);

// FASE 3.3 Automatizaciones: Ejecutar robot
startAutomationsCron();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(compression());
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooksRoutes);

app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (_req, res) => res.json({ ok: true, db: 'mysql' }));

// Stripe redirige aquí si la URL de éxito apunta al backend; enviamos al SPA del frontend
app.get('/subscription/success', (req, res) => redirectToFrontend(req, res, '/subscription/success'));
app.get('/registro-pendiente', (req, res) => redirectToFrontend(req, res, '/registro-pendiente'));

app.use('/api/auth', authRoutes);
app.use('/api/gestores', gestoresRoutes);
app.use('/api/autos', autosRoutes);
app.use('/api/concesionaria', concesionariaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/finances', financesRoutes);
app.use('/api/admin/site', adminSiteRouter);
app.use('/api/site', siteRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/perito', peritoRoutes);
app.use('/api/mp', mpRoutes);
app.use('/api/support', supportRoutes);
app.use('/og', ogRoutes);
// Rutas cortas para compartir con OG tags
app.use('/s', shareRoutes);   // /s/:id  → autos
app.use('/sg', shareRoutes);  // /sg/gestores/:slug → gestores
app.use('/sc', shareRoutes);  // /sc/concesionarias/:slug → concesionarias

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true },
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e6,
});
app.set('io', io);
setSocketIo(io);

const isProd = process.env.NODE_ENV === 'production';

// Socket.io connection handling
io.on('connection', (socket) => {
  if (!isProd) console.log('Socket connected:', socket.id);
  
  socket.on('identify', (payload) => {
    const userId = typeof payload === 'object' && payload !== null ? payload.userId : payload;
    const orgId = typeof payload === 'object' && payload !== null ? payload.orgId : null;
    if (userId) socket.join('user_' + userId);
    if (orgId && orgId !== userId) socket.join('user_' + orgId);
  });

  socket.on('join_deal', (dealId) => {
    if (dealId) socket.join(String(dealId));
  });

  socket.on('leave_deal', (dealId) => {
    if (dealId) socket.leave(String(dealId));
  });

  socket.on('send_message', (data) => {
    if (data?.dealId) io.to(String(data.dealId)).emit('receive_message', data);
  });

  socket.on('join_support', (clientId) => {
    if (clientId) socket.join(`support_${String(clientId)}`);
  });

  socket.on('leave_support', (clientId) => {
    if (clientId) socket.leave(`support_${String(clientId)}`);
  });

  socket.on('send_support_message', (data) => {
    if (data?.clientId) {
      io.to(`support_${String(data.clientId)}`).emit('receive_support_message', data);
    }
  });
});

testConnection()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`API y WebSockets corriendo en http://localhost:${PORT}`);
      console.log(`MySQL: ${process.env.DB_NAME}@${process.env.DB_HOST || 'localhost'}`);
    });
  })
  .catch(err => {
    console.error('No se pudo conectar a MySQL. ¿Está XAMPP MySQL corriendo?');
    console.error(err.message);
    process.exit(1);
  });
