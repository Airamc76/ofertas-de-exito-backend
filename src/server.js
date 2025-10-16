// src/server.js
import express from 'express';
import cors from 'cors';

// Routers existentes (ajusta si cambian las rutas reales)
import chatRouter from '../routes/chat.js';
import conversationsRouter from '../routes/chat-conversations.js';
import supaRouter from '../routes/supa.js';

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Montaje unificado bajo /api/*
if (chatRouter) app.use('/api/chat', chatRouter);
if (conversationsRouter) app.use('/api/conversations', conversationsRouter);
if (supaRouter) app.use('/api/supa', supaRouter);

// Healthcheck
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

export default app;
