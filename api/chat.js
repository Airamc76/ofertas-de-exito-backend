// api/chat.js
import fs from 'fs';
import path from 'path';
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();

// --- Rutas de prompts
const PROMPTS_DIR = path.join(process.cwd(), 'api', 'prompts');
const STYLE_PATH  = path.join(PROMPTS_DIR, 'alma-style.md');
const FORMAT_PATH = path.join(PROMPTS_DIR, 'alma-output.md');
const FEWSHOT_PATH= path.join(PROMPTS_DIR, 'alma-fewshot.md');

// --- Lee prompts (en frío, al arrancar)
const ALMA_STYLE   = fs.existsSync(STYLE_PATH)   ? fs.readFileSync(STYLE_PATH, 'utf8')   : '';
const ALMA_OUTPUT  = fs.existsSync(FORMAT_PATH)  ? fs.readFileSync(FORMAT_PATH, 'utf8')  : '';
const ALMA_FEWSHOT = fs.existsSync(FEWSHOT_PATH) ? fs.readFileSync(FEWSHOT_PATH, 'utf8') : '';

const GUARDRAILS = `
Reglas de seguridad y personalización:
- Cualquier precio, fecha, descuento, cupo o KPI es EJEMPLO/PERSONALIZABLE.
- Si falta info, asume lo mínimo y dilo explícitamente.
- Responde SIEMPRE en español y orientado a conversión.
`;

// --- CORS (incluye preflight)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // o tu dominio
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});
app.use(cors());
app.use(express.json());

const PORT            = process.env.PORT || 3000;
const OPENAI_API_KEY  = process.env.OPENAI_API_KEY;
const JWT_SECRET      = process.env.JWT_SECRET || 'change-me';

// --- Sesiones en memoria
const sessions = new Map(); // userId -> [{role,content}]
const MAX_TURNS = 15;

const getHistory = (id) => (id ? (sessions.get(id) || []) : []);
function saveTurn(id, userMsg, assistantMsg){
  if (!id) return;
  const hist = sessions.get(id) || [];
  if (userMsg)      hist.push({ role: 'user', content: userMsg });
  if (assistantMsg) hist.push({ role: 'assistant', content: assistantMsg });
  const excess = Math.max(0, hist.length - MAX_TURNS*2);
  if (excess) hist.splice(0, excess);
  sessions.set(id, hist);
}

// Utilidad timeout
const withTimeout = (promise, ms = 25_000) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

app.get('/api/chat/ping', (req, res) => res.json({ ok: true }));

// --- Helper: construye el “brief” para Alma con salida fuerte
function buildMessages({ history, userMessage }){
  const system = [
    { role: 'system', content: ALMA_STYLE },
    { role: 'system', content: GUARDRAILS },
    { role: 'system', content: ALMA_OUTPUT },
  ];

  // few‑shot en bloque de assistant para anclar tono y estructura
  const fewshot = ALMA_FEWSHOT
    ? [{ role: 'system', content: ALMA_FEWSHOT }]
    : [];

  return [
    ...system,
    ...fewshot,
    ...history,
    { role: 'user', content: userMessage }
  ];
}

app.post('/api/chat', async (req, res) => {
  const { mensaje, userId: bodyUserId } = req.body || {};
  if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

  // token opcional
  let tokenUser = null;
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    try { tokenUser = jwt.verify(auth.slice(7), JWT_SECRET); } catch {}
  }
  const effectiveUserId = tokenUser?.userId || bodyUserId;
  if (!effectiveUserId) return res.status(400).json({ error: 'userId requerido (o token válido)' });

  const history = getHistory(effectiveUserId);

  try {
    const messages = buildMessages({ history, userMessage: mensaje });

    const response = await withTimeout(
      axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          // 🔼 Usa un modelo actual y más capaz
          model: 'gpt-4o-mini',
          messages,
          temperature: 0.6,          // creativo pero controlado
          max_tokens: 900,           // suficiente para planes detallados
          presence_penalty: 0.2,     // empuja ideas nuevas
          frequency_penalty: 0.15,   // reduce repetición
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
        }
      ),
      25_000
    );

    const assistantMsg = response.data?.choices?.[0]?.message?.content?.trim();
    if (!assistantMsg) throw new Error('Sin respuesta');

    saveTurn(effectiveUserId, mensaje, assistantMsg);
    return res.json({ ok: true, mensaje: assistantMsg });
  } catch (err) {
    console.error('[chat] error:', err?.message);
    return res.status(500).json({ error: 'Error interno' });
  }
});

app.listen(PORT, () => {
  console.log(`Alma backend en http://localhost:${PORT}`);
});
