// src/server.js
import express from 'express';
import cors from 'cors';

// Routers existentes (ajusta si cambian las rutas reales)
import chatRouter from '../routes/chat.js';
import supaRouter from '../routes/supa.js';

const app = express();

// Middlewares globales
// CORS global y preflight para TODAS las rutas
app.all('*', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-client-id, Authorization');
  // res.setHeader('Access-Control-Allow-Credentials', 'true'); // si usas cookies
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Montaje unificado bajo /api/*
if (chatRouter) app.use('/api/chat', chatRouter);
// Alias principal nuevo: expone rutas de supaRouter directamente bajo /api
if (supaRouter) app.use('/api', supaRouter); // ahora /api/ping, /api/conversations, etc.
// Alias anterior conservado
if (supaRouter) app.use('/api/supa', supaRouter);

// --- Compatibilidad con rutas antiguas del front ---
// POST /api/conversations/:id/messages  -> 307 -> /api/supax/conversations/:id/messages
app.all('/api/conversations/:id/messages', (req, res) => {
  res.set('X-Legacy-Route', '1');
  res.redirect(307, `/api/supax/conversations/${encodeURIComponent(req.params.id)}/messages`);
});

// GET /api/conversations/:id/history  -> 307 -> /api/supax/conversations/:id/history?...
app.get('/api/conversations/:id/history', (req, res) => {
  res.set('X-Legacy-Route', '1');
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(307, `/api/supax/conversations/${encodeURIComponent(req.params.id)}/history${qs}`);
});

// Prefijo alternativo temporal para diagnóstico
if (supaRouter) app.use('/api/supax', supaRouter);

// Healthcheck
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Manejador global de errores (diagnóstico)
app.use((err, req, res, next) => {
  try {
    console.error('[global-error]', { path: req.url, message: err?.message, stack: err?.stack });
  } catch {}
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ success: false, route: 'global-error', reason: 'invalid_json', message: err.message });
  }
  res.status(500).json({ success: false, route: 'global-error', message: err?.message || 'internal_error' });
});

export default app;
