require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const { helmetMiddleware, apiLimiter, corsMiddleware } = require('./middleware/security');
const { sequelize, initDb } = require('./config/db');

const authRoutes = require('./routes/auth');
const employeesRoutes = require('./routes/employees');
const guestsRoutes = require('./routes/guests');
const roomsRoutes = require('./routes/rooms');
const reservationsRoutes = require('./routes/reservations');
const billingRoutes = require('./routes/billing');
const documentsRoutes = require('./routes/documents');
const adminRoutes = require('./routes/admin');
const superadminRoutes = require('./routes/superadmin');
const receptionistsRoutes = require('./routes/receptionists');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(helmetMiddleware());
app.use(corsMiddleware());
app.use(apiLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// attach socket to app for controllers
app.set('io', io);

// API v1 routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/employees', employeesRoutes);
app.use('/api/v1/guests', guestsRoutes);
app.use('/api/v1/rooms', roomsRoutes);
app.use('/api/v1/reservations', reservationsRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/documents', documentsRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/superadmin', superadminRoutes);
app.use('/api/v1/receptionists', receptionistsRoutes);

// health
app.get('/api/v1/health', (req, res) => res.json({ ok: true, env: process.env.NODE_ENV || 'development' }));

// basic error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 4000;

initDb().then(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    server.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}).catch(err => {
  console.error('Failed to initialize DB', err);
  process.exit(1);
});
