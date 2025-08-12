import fs from 'fs';
import path from 'path';

const STYLE_PATH = path.join(process.cwd(), 'prompts', 'alma-style.md');
const ALMA_STYLE = fs.readFileSync(STYLE_PATH, 'utf8');

const guard = `
Reglas de seguridad:
- Trata cualquier precio, descuento, fecha o cupo como EJEMPLO PERSONALIZABLE.
- No fijes importes definitivos a menos que el usuario los provea explícitamente.
`;

import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

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
      { role: 'system', content: ALMA_STYLE },
      { role: 'system', content: guard },
      ...history,
      { role: 'user', content: mensaje }
    ];
    //
    const response = await withTimeout(
      axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages,
        temperature: 0.7,
        max_tokens: 150,
        // top_p: 1,
        // frequency_penalty: 0,
        // presence_penalty: 0,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }),
      25_000
    );

    const assistantMsg = response.data.choices[0]?.message?.content?.trim();
    if (!assistantMsg) throw new Error('Sin respuesta de OpenAI');

    // Guardar historial
    saveTurn(effectiveUserId, mensaje, assistantMsg);

    // Responder al cliente
    res.json({ ok: true, mensaje: assistantMsg });
  } catch (error) {
    console.error('Error en OpenAI:', error.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.listen(PUERTO, () => {
  console.log(`Servidor corriendo en puerto ${PUERTO}`);
});
