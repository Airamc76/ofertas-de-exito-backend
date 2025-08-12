import fs from 'fs';
import path from 'path';

import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

/* ============================
   Estilo fijo de Alma + guard
============================= */
const STYLE_PATH = path.join(process.cwd(), 'prompts', 'alma-style.md');

let ALMA_STYLE = `
# Alma – Estilo base
- Tono: claro, directo, amable, sin paja.
- Estructura: titulares breves, bullets, pasos numerados, CTAs claros.
- Siempre personaliza con lo que el usuario te haya dicho.
- Si mencionas precios, fechas o cupos, deja claro que son **ejemplos**.
- Cuando propongas copy, usa formato limpio y fácil de copiar/pegar.
`;

try {
  if (fs.existsSync(STYLE_PATH)) {
    ALMA_STYLE = fs.readFileSync(STYLE_PATH, 'utf8') || ALMA_STYLE;
  }
} catch (_) {
  // Si falla la lectura, seguimos con el fallback embebido.
}

const guard = `
Reglas de seguridad:
- Trata cualquier precio, descuento, fecha o cupo como EJEMPLO PERSONALIZABLE.
- No fijes importes definitivos a menos que el usuario los provea explícitamente.
`;

/* ============================
            App
============================= */
const app = express();

// CORS: permite Authorization y preflight
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // cámbialo a tu dominio si quieres
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.use(cors());
app.use(express.json());

const PUERTO = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL_OPENAI = process.env.MODEL_OPENAI || 'gpt-4o-mini';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

if (!OPENAI_API_KEY) {
  console.warn('⚠️  Falta OPENAI_API_KEY en .env');
}

/* ============================
   Memoria por usuario (RAM)
============================= */
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

/* ============================
           Rutas
============================= */
app.get('/api/chat/ping', (req, res) => {
  res.json({ ok: true, route: '/api/chat/ping', method: 'GET' });
});

app.post('/api/chat', async (req, res) => {
  const { mensaje, userId: bodyUserId } = req.body || {};
  if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

  // Token (opcional)
  let tokenUser = null;
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      tokenUser = jwt.verify(token, JWT_SECRET); // { userId, email, ... }
    } catch (_) {
      // Token inválido/expirado → seguimos como anónimo
    }
  }

  // userId efectivo
  const effectiveUserId = tokenUser?.userId || bodyUserId;
  if (!effectiveUserId) {
    return res.status(400).json({ error: 'userId requerido (o token válido)' });
  }

  const history = getHistory(effectiveUserId);

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Falta OPENAI_API_KEY en el servidor' });
  }

  try {
    const messages = [
      { role: 'system', content: ALMA_STYLE },
      { role: 'system', content: guard },
      ...history,
      { role: 'user', content: mensaje }
    ];

    const response = await withTimeout(
      axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: MODEL_OPENAI,       // ej. gpt-4o-mini / gpt-4o / gpt-3.5-turbo
          messages,
          temperature: 0.8,
          max_tokens: 900
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          }
        }
      ),
      25_000
    );

    const assistantMsg = response?.data?.choices?.[0]?.message?.content?.trim();
    if (!assistantMsg) throw new Error('Sin respuesta de OpenAI');

    // Guardar historial
    saveTurn(effectiveUserId, mensaje, assistantMsg);

    // ⚠️ Tu frontend espera "respuesta"
    return res.json({
      ok: true,
      fuente: 'openai',
      modelo: MODEL_OPENAI,
      respuesta: assistantMsg
    });
  } catch (error) {
    console.error('Error en OpenAI:', error?.message || error);
    return res.status(500).json({ error: 'Error interno' });
  }
});

app.listen(PUERTO, () => {
  console.log(`Servidor corriendo en puerto ${PUERTO}`);
});
