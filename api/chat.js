import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();

// CORS: incluye Authorization y maneja preflight
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // o tu dominio del front si lo quieres restringir
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.use(cors());
app.use(express.json());

const PUERTO = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

// ===== Historial por usuario (memoria RAM) =====
const sessions = new Map(); // { userId: [{role, content}] }
const MAX_TURNS = 15;       // últimos 15 turnos (user+assistant)

function getHistory(userId) {
  if (!userId) return [];
  return sessions.get(userId) || [];
}
function saveTurn(userId, userMsg, assistantMsg) {
  if (!userId) return;
  const hist = sessions.get(userId) || [];
  if (userMsg)      hist.push({ role: 'user', content: userMsg });
  if (assistantMsg) hist.push({ role: 'assistant', content: assistantMsg });
  const excess = Math.max(0, hist.length - MAX_TURNS * 2);
  if (excess) hist.splice(0, excess);
  sessions.set(userId, hist);
}

// Utilidad de timeout
const withTimeout = (promise, ms = 25_000) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

// health
app.get('/api/chat/ping', (req, res) => {
  res.json({ ok: true, route: '/api/chat/ping', method: 'GET' });
});

// CHAT -> POST /api/chat
app.post('/api/chat', async (req, res) => {
  const { mensaje, userId: bodyUserId } = req.body || {};
  if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

  // 1) Intentar leer el token (opcional)
  let tokenUser = null;
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      tokenUser = jwt.verify(token, JWT_SECRET); // { userId, email, ... }
    } catch (_) {
      // Token inválido o expirado; seguimos como anónimo
    }
  }

  // 2) Determinar el userId efectivo
  const effectiveUserId = tokenUser?.userId || bodyUserId;
  if (!effectiveUserId) {
    // por seguridad: si no hay userId ni token, no guardamos historial
    return res.status(400).json({ error: 'userId requerido (o token válido)' });
  }

  const history = getHistory(effectiveUserId);

  // 3) OpenAI (principal)
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
- Da outputs accionables (plantillas, ejemplos, microcopys).
- Evita relleno. Pide solo lo mínimo si faltan datos.
- Ofrece “próximos pasos” concretos cuando aplique.

# Micro-plantillas
- CTA: "➡️ *[Acción]* ahora" / "🔒 *[Beneficio]* aquí".
- Urgencia: "⏳ Disponible hasta *[fecha/límite]*" / "Quedan *[X]* cupos".
- Beneficios: "✅ *[Beneficio]* — *[Por qué importa]*".
        `.trim()
      },
      ...history,
      { role: 'user', content: mensaje }
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
    saveTurn(effectiveUserId, mensaje, reply);
    return res.json({ fuente: 'openai', modelo: process.env.MODEL_OPENAI || 'gpt-4o-mini', respuesta: reply });
  } catch (error) {
    console.warn('❌ OpenAI falló. Usando Cohere como respaldo...', error?.message);
  }

  // 4) Cohere (respaldo)
  try {
    const cohereHistory = [
      { role: 'SYSTEM', message: 'Eres Alma (copywriting/ofertas irresistibles). Hook, bullets ✅, pasos, CTA y urgencia. Español neutro.' },
      ...history.map(m => ({ role: m.role === 'assistant' ? 'CHATBOT' : m.role.toUpperCase(), message: m.content })),
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

    saveTurn(effectiveUserId, mensaje, texto);
    return res.json({ fuente: 'cohere', modelo: process.env.MODEL_COHERE || 'command-r-plus', respuesta: texto });
  } catch (err) {
    console.error('❌ Cohere también falló.', err?.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Historial / reset (opcionales)
app.post('/api/chat/history', (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId requerido' });
  return res.json({ userId, history: getHistory(userId) });
});
app.post('/api/chat/reset', (req, res) => {
  const { userId } = req.body || {};
  if (userId) sessions.delete(userId);
  return res.json({ ok: true });
});

app.listen(PUERTO, () => {
  console.log(`✅ Servidor corriendo en puerto ${PUERTO}`);
});
