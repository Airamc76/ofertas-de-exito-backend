// api/chat.js
import fs from 'fs';
import path from 'path';
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

/* ------------------------- Prompt de estilo de Alma ------------------------- */
const STYLE_PATH = path.join(process.cwd(), 'prompts', 'alma-style.md');
let ALMA_STYLE = `Eres “Alma”, asistente de copywriting y ofertas. Usa estructura clara,
con ejemplos personalizables (nunca fijes precios, fechas o cupos).`;

try {
  if (fs.existsSync(STYLE_PATH)) {
    ALMA_STYLE = fs.readFileSync(STYLE_PATH, 'utf8');
  } else {
    console.warn(`[alma] No se encontró ${STYLE_PATH}. Usaré prompt por defecto.`);
  }
} catch (e) {
  console.warn('[alma] Error leyendo alma-style.md:', e?.message);
}

const guard = `
Reglas de seguridad:
- Trata cualquier precio, descuento, fecha o cupo como EJEMPLO PERSONALIZABLE.
- No fijes importes definitivos a menos que el usuario los provea explícitamente.
`;

/* --------------------------------- App ------------------------------------- */
const app = express();

// CORS básico + preflight
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // cámbialo a tu dominio si quieres
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.use(cors());
app.use(express.json());

/* --------------------------------- ENV ------------------------------------- */
const PUERTO = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL_OPENAI = process.env.MODEL_OPENAI || 'gpt-4o-mini';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

if (!OPENAI_API_KEY) {
  console.warn('[alma] Falta OPENAI_API_KEY en variables de entorno.');
}

/* ------------------ Memoria por usuario (simple en RAM) -------------------- */
const sessions = new Map(); // userId -> [{role, content}]
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

/* ----------------------------- Util: timeout ------------------------------- */
const withTimeout = (promise, ms = 25_000) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

/* --------------------------------- Ping ------------------------------------ */
app.get('/api/chat/ping', (req, res) => {
  res.json({ ok: true, route: '/api/chat/ping', method: 'GET' });
});

/* --------------------------------- Chat ------------------------------------ */
app.post('/api/chat', async (req, res) => {
  const { mensaje, userId: bodyUserId } = req.body || {};
  if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

  // 1) Intentar leer token JWT (opcional)
  let tokenUser = null;
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    try {
      tokenUser = jwt.verify(auth.slice(7), JWT_SECRET); // { userId, email, ... }
    } catch {
      // token inválido: seguimos como anónimo
    }
  }

  // 2) Determinar userId efectivo
  const effectiveUserId = tokenUser?.userId || bodyUserId;
  if (!effectiveUserId) {
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

    const response = await withTimeout(
      axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: MODEL_OPENAI,
          messages,
          temperature: 0.7,
          max_tokens: 900
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`
          }
        }
      ),
      25_000
    );

    // Log útil de depuración (coméntalo si ya no lo necesitas)
    console.log('[alma] OpenAI raw response:', JSON.stringify(response.data, null, 2));

    const assistantMsg = response?.data?.choices?.[0]?.message?.content?.trim();

    if (!assistantMsg) {
      console.error('[alma] OpenAI sin contenido. Data:', response?.data);
      return res.status(502).json({ error: 'No se recibió respuesta del modelo' });
    }

    // Guardar en historial
    saveTurn(effectiveUserId, mensaje, assistantMsg);

    // IMPORTANTE: el frontend espera "respuesta"
    return res.json({ ok: true, respuesta: assistantMsg });
  } catch (error) {
    // Log detallado
    const status = error?.response?.status;
    const data = error?.response?.data;
    console.error('[alma] Error OpenAI:', error?.message, 'status:', status, 'data:', data);

    if (status === 401) {
      return res.status(401).json({ error: 'API Key inválida o no autorizada' });
    }
    if (status === 429) {
      return res.status(429).json({ error: 'Límite de peticiones alcanzado. Intenta más tarde.' });
    }
    if (status >= 500) {
      return res.status(502).json({ error: 'Proveedor no disponible. Intenta de nuevo.' });
    }
    return res.status(500).json({ error: 'Error interno' });
  }
});

/* ------------------------------- Servidor ---------------------------------- */
app.listen(PUERTO, () => {
  console.log(`✅ Alma backend listo en puerto ${PUERTO} | Modelo: ${MODEL_OPENAI}`);
});
