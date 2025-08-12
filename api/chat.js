// api/chat.js
import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();

/* ==========================
   0) Estilo Alma + Guardas
   ========================== */
const STYLE_PATH = path.join(process.cwd(), 'api', 'prompts', 'alma-style.md');
let ALMA_STYLE = '';
try {
  ALMA_STYLE = fs.readFileSync(STYLE_PATH, 'utf8');
} catch (e) {
  console.warn('[chat] No se pudo leer prompts/alma-style.md. ¿Existe el archivo?', e?.message);
  ALMA_STYLE = `
Eres “Alma”, asistente de copywriting y ofertas irresistibles. Responde en español con bloques claros,
acción inmediata y tono directo/empático. Trata todos los precios, descuentos, fechas y cupos como EJEMPLOS.
`;
}

const GUARD = `
Reglas obligatorias:
- Cualquier precio, descuento, fecha o cupo es “EJEMPLO” o “personalizable”.
- No fijes importes definitivos a menos que el usuario los provea explícitamente.
- Usa micro-decisiones (CTA breve) al final de cada bloque cuando aporte claridad.
- Mantén el tono: claro, persuasivo, sin relleno, útil para conversión.
`;

/* ==========================
   1) Config & Middlewares
   ========================== */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const JWT_SECRET     = process.env.JWT_SECRET || 'change-me';
const PORT           = process.env.PORT || 3000;

if (!OPENAI_API_KEY) {
  console.warn('[chat] Falta OPENAI_API_KEY en variables de entorno');
}

// CORS: incluye Authorization y maneja preflight
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // o tu dominio si quieres restringir
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});
app.use(cors());
app.use(express.json());

/* ==========================
   2) Sesiones (memoria RAM)
   ========================== */
const sessions = new Map();      // userId -> [{ role:'user'|'assistant', content }]
const MAX_TURNS = 12;            // conserva aprox. los últimos 12 turnos

function getHistory(userId) {
  if (!userId) return [];
  return sessions.get(userId) || [];
}
function saveTurn(userId, userMsg, assistantMsg) {
  if (!userId) return;
  const hist = sessions.get(userId) || [];
  if (userMsg)      hist.push({ role: 'user',      content: userMsg });
  if (assistantMsg) hist.push({ role: 'assistant', content: assistantMsg });

  // recorta si excede
  const extra = Math.max(0, hist.length - MAX_TURNS * 2);
  if (extra) hist.splice(0, extra);

  sessions.set(userId, hist);
}

/* ==========================
   3) Utils
   ========================== */
const withTimeout = (promise, ms = 25_000) =>
  Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ]);

const sanitize = (s = '') => String(s).trim().slice(0, 2000); // limita input

/* ==========================
   4) Health
   ========================== */
app.get('/api/chat/ping', (_req, res) => {
  res.json({ ok: true, route: '/api/chat/ping', method: 'GET' });
});

/* ==========================
   5) Endpoint principal
   ========================== */
app.post('/api/chat', async (req, res) => {
  try {
    const rawMsg   = req.body?.mensaje;
    const bodyUser = req.body?.userId;
    const mensaje  = sanitize(rawMsg);

    if (!mensaje) {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }

    // Token (opcional)
    let tokenUserId = null;
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
      const token = auth.slice(7);
      try {
        const payload = jwt.verify(token, JWT_SECRET); // { userId, email }
        tokenUserId = payload?.userId || null;
      } catch (_) {
        // token inválido: seguimos como anónimo
      }
    }

    // userId efectivo
    const userId = tokenUserId || bodyUser;
    if (!userId) {
      return res.status(400).json({ error: 'userId requerido (o token válido)' });
    }

    const history = getHistory(userId);

    // Mensajes al modelo
    const systemBlock = `${ALMA_STYLE}\n\n${GUARD}\n\nContexto: Responde en español.`;
    const messages = [
      { role: 'system', content: systemBlock },
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: mensaje }
    ];

    // Llamada a OpenAI
    const openaiResp = await withTimeout(
      axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          // usa el modelo que prefieras; gpt-4o-mini suele dar muy buena calidad/costo
          model: process.env.MODEL_OPENAI || 'gpt-4o-mini',
          messages,
          temperature: 0.7,
          max_tokens: 800
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

    const assistantMsg =
      openaiResp?.data?.choices?.[0]?.message?.content?.trim();

    if (!assistantMsg) {
      console.warn('[chat] Respuesta vacía de OpenAI');
      return res.status(502).json({ error: 'Respuesta inválida.' });
    }

    // guarda en historial
    saveTurn(userId, mensaje, assistantMsg);

    res.json({
      ok: true,
      fuente: 'openai',
      modelo: process.env.MODEL_OPENAI || 'gpt-4o-mini',
      respuesta: assistantMsg
    });
  } catch (err) {
    console.error('[chat] Error:', err?.message);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

/* ==========================
   6) Listen
   ========================== */
app.listen(PORT, () => {
  console.log(`[chat] Servidor corriendo en puerto ${PORT}`);
});
