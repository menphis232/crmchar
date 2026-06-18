import express from 'express';
import http from 'http';
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
import clientRoutes from './routes/client.js';
import webhooksRoutes from './routes/webhooks.js';
import aiRoutes from './routes/ai.js';
import shareRoutes from './routes/share.js';
import { testConnection } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkStalledDeals } from './crm/automations.js';
import { startAutomationsCron } from './cron/automations.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// FASE 3.3 Automatizaciones: Ejecutar robot
startAutomationsCron();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooksRoutes);

app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (_req, res) => res.json({ ok: true, db: 'mysql' }));

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
app.use('/api/client', clientRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/share', shareRoutes);
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
  cors: { origin: '*' }
});
app.set('io', io);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('identify', (userId) => {
    if (userId) {
      socket.join('user_' + userId);
      console.log(`Socket ${socket.id} identified as user_${userId}`);
    }
  });

  socket.on('join_deal', (dealId) => {
    socket.join(dealId);
    console.log(`Socket ${socket.id} joined deal ${dealId}`);
  });

  socket.on('send_message', (data) => {
    // Expected data: { dealId, message, senderId, senderName }
    io.to(data.dealId).emit('receive_message', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
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
