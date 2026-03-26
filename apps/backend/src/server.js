require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
const supaRoutes = require('./routes/supa');
app.use('/api/supa', supaRoutes);
app.use('/api/chat', supaRoutes); // Legacy compat

// Servir Frontend
app.use(express.static(path.join(__dirname, '../../frontend')));

// Ruta principal para el frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// Healthcheck
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

module.exports = app;
