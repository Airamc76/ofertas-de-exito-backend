require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
const supaRoutes = require('./routes/supa');
app.use('/api/supa', supaRoutes);
app.use('/api/chat', supaRoutes); // Legacy compat

// Healthcheck
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

module.exports = app;
