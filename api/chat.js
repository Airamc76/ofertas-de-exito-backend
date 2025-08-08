import axios from 'axios';
import { Redis } from '@upstash/redis';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const MAX_TURNS = Number(process.env.MAX_TURNS || 15);
const TTL_SECONDS = (Number(process.env.TTL_DAYS || 30)) * 24 * 60 * 60;
const historyKey = (userId) => `alma:history:${userId}`;

const withTimeout = (p, ms = 15000) =>
  Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);

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
    if (userMsg)      ops.push(redis.rpush(key, JSON.stringify({ role:'user', content:userMsg })));
    if (assistantMsg) ops.push(redis.rpush(key, JSON.stringify({ role:'assistant', content:assistantMsg })));
    await Promise.all(ops);
    await redis.ltrim(key, -MAX_TURNS*2, -1);
    await redis.expire(key, TTL_SECONDS);
  } catch (e) {
    console.error('Redis saveTurn error:', e?.message);
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, route: 'GET /api/chat' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { mensaje, userId } = req.body || {};
  if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

  const history = await getHistory(userId);

  // 1) OpenAI (principal)
  try {
    const messages = [
      {
        role: 'system',
        content: `
Eres Alma, IA experta en copywriting, ventas y ofertas irresistibles.
- Hook breve
- ✅ Beneficios
- Pasos numerados
- CTA + urgencia breve
- Cierre con próxima acción
        `.trim(),
      },
      ...history,
      { role: 'user', content: mensaje }
    ];

    const oai = await withTimeout(
      axios.post('https://api.openai.com/v1/chat/completions',
        { model: process.env.MODEL_OPENAI || 'gpt-4o-mini', messages, max_tokens: 900, temperature: 0.8 },
        { headers: { 'Content-Type':'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` } }
      )
    );

    const reply = oai?.data?.choices?.[0]?.message?.content?.trim() || '';
    await saveTurn(userId, mensaje, reply);
    return res.status(200).json({ fuente:'openai', respuesta: reply });
  } catch (e) {
    console.warn('OpenAI error:', e?.message);
  }

  // 2) Cohere (fallback opcional)
  try {
    const cohereHistory = [
      { role: 'SYSTEM', message: 'Eres Alma. Hook, bullets ✅, pasos, CTA y urgencia. Español neutro.' },
      ...history.map(m => ({ role: m.role === 'assistant' ? 'CHATBOT' : m.role.toUpperCase(), message: m.content })),
      { role: 'USER', message: mensaje },
    ];

    const ch = await withTimeout(
      axios.post('https://api.cohere.ai/v1/chat',
        { model: process.env.MODEL_COHERE || 'command-r-plus', message: mensaje, temperature: 0.8, chat_history: cohereHistory },
        { headers: { Authorization: `Bearer ${COHERE_API_KEY}`, 'Content-Type': 'application/json' } }
      )
    );

    const texto = ch?.data?.text?.trim() || ch?.data?.message?.content?.[0]?.text?.trim() || '';
    await saveTurn(userId, mensaje, texto);
    return res.status(200).json({ fuente:'cohere', respuesta: texto });
  } catch (e) {
    console.error('Cohere error:', e?.message);
    return res.status(500).json({ error:'Error interno del servidor.' });
  }
}
