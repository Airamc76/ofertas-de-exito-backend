import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';
import serverless from 'serverless-http';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// === ENV ===
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;

// === Redis (Upstash) ===
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
const MAX_TURNS = Number(process.env.MAX_TURNS || 15);
const TTL_SECONDS = (Number(process.env.TTL_DAYS || 30)) * 24 * 60 * 60;
const historyKey = (userId) => `alma:history:${userId}`;

async function getHistory(userId) {
  if (!userId) return [];
  try {
    const arr = await redis.lrange(historyKey(userId), 0, -1);
    return (arr || []).map((s) => JSON.parse(s));
  } catch (e) {
    console.error('Redis getHistory error:', e?.message);
    return [];
  }
}
async function saveTurn(userId, userMsg, assistantMsg) {
  if (!userId) return;
  try {
    const key = historyKey(userId);
    const ops = [];
    if (userMsg)      ops.push(redis.rpush(key, JSON.stringify({ role: 'user', content: userMsg })));
    if (assistantMsg) ops.push(redis.rpush(key, JSON.stringify({ role: 'assistant', content: assistantMsg })));
    await Promise.all(ops);
    await redis.ltrim(key, -MAX_TURNS * 2, -1);
    await redis.expire(key, TTL_SECONDS);
  } catch (e) {
    console.error('Redis saveTurn error:', e?.message);
  }
}

const withTimeout = (p, ms = 15000) =>
  Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);

// ---- Healthcheck -> GET /api/chat/ping
app.get('/ping', (_req, res) => res.json({ ok: true, t: Date.now() }));

// ---- Chat -> POST /api/chat
app.post('/', async (req, res) => {
  const { mensaje, userId } = req.body || {};
  if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

  const history = await getHistory(userId);

  // 1) OpenAI primero
  try {
    const messages = [
      {
        role: 'system',
        content: `
Eres **Alma**, IA experta en copywriting, ventas y ofertas irresistibles.
Estilo: conversacional, claro y persuasivo.
- Hook breve
- Beneficios con ✅
- Pasos numerados
- CTA y urgencia breve
- Cierre con próxima acción
`.trim(),
      },
      ...history,
      { role: 'user', content: mensaje },
    ];

    const openaiResponse = await withTimeout(
      axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: process.env.MODEL_OPENAI || 'gpt-4o-mini',
          messages,
          max_tokens: 900,
          temperature: 0.8,
        },
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` } }
      )
    );

    const reply = openaiResponse?.data?.choices?.[0]?.message?.content?.trim() || '';
    await saveTurn(userId, mensaje, reply);
    return res.json({ fuente: 'openai', respuesta: reply });
  } catch (error) {
    console.warn('OpenAI error:', error?.message);
  }

  // 2) Cohere fallback
  try {
    const cohereHistory = [
      { role: 'SYSTEM', message: 'Eres Alma. Hook, bullets ✅, pasos, CTA y urgencia. Español neutro.' },
      ...history.map((m) => ({ role: m.role === 'assistant' ? 'CHATBOT' : m.role.toUpperCase(), message: m.content })),
      { role: 'USER', message: mensaje },
    ];

    const cohereResponse = await withTimeout(
      axios.post(
        'https://api.cohere.ai/v1/chat',
        {
          model: process.env.MODEL_COHERE || 'command-r-plus',
          message: mensaje,
          temperature: 0.8,
          chat_history: cohereHistory,
        },
        { headers: { Authorization: `Bearer ${COHERE_API_KEY}`, 'Content-Type': 'application/json' } }
      )
    );

    const texto =
      cohereResponse?.data?.text?.trim() ||
      cohereResponse?.data?.message?.content?.[0]?.text?.trim() ||
      '';

    await saveTurn(userId, mensaje, texto);
    return res.json({ fuente: 'cohere', respuesta: texto });
  } catch (err) {
    console.error('Cohere error:', err?.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ---- Historial -> POST /api/chat/history
app.post('/history', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId requerido' });
  const hist = await getHistory(userId);
  res.json({ userId, history: hist });
});

// ---- Reset -> POST /api/chat/reset
app.post('/reset', async (req, res) => {
  const { userId } = req.body || {};
  if (userId) await redis.del(historyKey(userId));
  res.json({ ok: true });
});

// Exportar como handler serverless para Vercel
export default serverless(app);
