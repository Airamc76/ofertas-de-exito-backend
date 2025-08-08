import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ===== ENV =====
const PUERTO = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;

// ===== Redis (Upstash) =====
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const MAX_TURNS = Number(process.env.MAX_TURNS || 15);      // turnos (user+bot) a conservar
const TTL_SECONDS = (Number(process.env.TTL_DAYS || 30)) * 24 * 60 * 60;
const historyKey = (userId) => `alma:history:${userId}`;

async function getHistory(userId) {
  if (!userId) return [];
  const arr = await redis.lrange(historyKey(userId), 0, -1);
  return (arr || []).map((s) => JSON.parse(s));
}

async function saveTurn(userId, userMsg, assistantMsg) {
  if (!userId) return;
  const key = historyKey(userId);
  const ops = [];
  if (userMsg)      ops.push(redis.rpush(key, JSON.stringify({ role: 'user', content: userMsg })));
  if (assistantMsg) ops.push(redis.rpush(key, JSON.stringify({ role: 'assistant', content: assistantMsg })));
  await Promise.all(ops);
  await redis.ltrim(key, -MAX_TURNS * 2, -1); // conserva últimos N turnos
  await redis.expire(key, TTL_SECONDS);       // TTL de autolimpieza
}

// ===== Utils =====
const withTimeout = (promise, ms = 25_000) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

// ===== Chat =====
app.post('/api/chat', async (req, res) => {
  const { mensaje, userId } = req.body;
  if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

  const history = await getHistory(userId);

  // 1) OpenAI (principal)
  try {
    const messages = [
      {
        role: 'system',
        content: `
Eres **Alma**, una IA experta en redacción publicitaria, ventas, marketing digital y creación de ofertas irresistibles.
Estilo: conversacional, claro, persuasivo, cálido y profesional. Responde en español neutro.

# Estilo y formato (hazlo SIEMPRE)
- Abre con un **hook** breve (1–2 líneas).
- Beneficios con viñetas y ✅.
- **Pasos numerados** para instrucciones.
- **CTA** claro y línea de **urgencia/escasez** realista.
- Cierra reforzando la transformación y la próxima acción.

# Pautas
- Outputs accionables (plantillas, ejemplos, microcopys).
- Evita relleno; pide lo mínimo si faltan datos.
- Propón “próximos pasos” cuando aplique.

# Micro-plantillas
- CTA: "➡️ *[Acción]* ahora" / "🔒 *[Beneficio]* aquí".
- Urgencia: "⏳ Disponible hasta *[fecha/límite]*" / "Quedan *[X]* cupos".
- Beneficios: "✅ *[Beneficio]* — *[Por qué importa]*".
        `,
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
    return res.json({ fuente: 'openai', modelo: process.env.MODEL_OPENAI || 'gpt-4o-mini', respuesta: reply });
  } catch (error) {
    console.warn('❌ OpenAI falló. Usando Cohere...', error?.message);
  }

  // 2) Cohere (fallback)
  try {
    const cohereHistory = [
      { role: 'SYSTEM', message: `Eres Alma (copywriting/ofertas irresistibles). Hook breve, bullets ✅, pasos numerados, CTA y urgencia. Español neutro.` },
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
    return res.json({ fuente: 'cohere', modelo: process.env.MODEL_COHERE || 'command-r-plus', respuesta: texto });
  } catch (err) {
    console.error('❌ Cohere también falló.', err?.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ===== Endpoints de ver/borrar historial (útiles para probar) =====
app.post('/api/history', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId requerido' });
  const hist = await getHistory(userId);
  res.json({ userId, history: hist });
});

app.post('/api/reset', async (req, res) => {
  const { userId } = req.body || {};
  if (userId) await redis.del(historyKey(userId));
  res.json({ ok: true });
});

app.listen(PUERTO, () => {
  console.log(`✅ Servidor corriendo en puerto ${PUERTO}`);
});



