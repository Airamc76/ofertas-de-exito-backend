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

// Servir Frontend (build compilado de Vite)
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// SPA Fallback - todas las rutas sirven el index.html
app.get('*', (req, res) => {
  const indexPath = path.join(frontendDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Frontend not built. Run npm run build in apps/frontend.' });
    }
  });
});

// Healthcheck
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

module.exports = app;
