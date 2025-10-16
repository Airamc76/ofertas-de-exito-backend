// src/server.js
import express from 'express';
import cors from 'cors';

// Routers existentes (ajusta si cambian las rutas reales)
import chatRouter from '../routes/chat.js';
import supaRouter from '../routes/supa.js';

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Montaje unificado bajo /api/*
if (chatRouter) app.use('/api/chat', chatRouter);
if (supaRouter) app.use('/api/supa', supaRouter);

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
