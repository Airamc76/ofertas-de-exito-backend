import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import serverless from 'serverless-http';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;

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
  if (userMsg) hist.push({ role: 'user', content: userMsg });
  if (assistantMsg) hist.push({ role: 'assistant', content: assistantMsg });
  const excess = Math.max(0, hist.length - MAX_TURNS * 2);
  if (excess) hist.splice(0, excess);
  sessions.set(userId, hist);
}

const withTimeout = (promise, ms = 25_000) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

// Health (opcional): GET /api/chat
app.get('/', (_req, res) => res.json({ ok: true }));

// === OJO: rutas en raíz porque el archivo ya está en /api/chat ===

// Chat principal -> POST /api/chat
app.post('/', async (req, res) => {
  const { mensaje, userId } = req.body;
  if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

  const history = getHistory(userId);

  try {
    const messages = [
      {
        role: 'system',
        content: `
Eres **Alma**, una IA experta en redacción publicitaria, ventas, marketing digital y creación de ofertas irresistibles.
Estilo: conversacional, claro, persuasivo, cálido y profesional. Responde en español neutro.
- Hook breve
- Beneficios con ✅
- Pasos numerados
- CTA + urgencia
- Cierre con próxima acción
        `
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
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
        }
      )
    );

    const reply = openaiResponse?.data?.choices?.[0]?.message?.content?.trim() || '';
    saveTurn(userId, mensaje, reply);
    return res.json({ fuente: 'openai', respuesta: reply });
  } catch (error) {
    console.warn('❌ OpenAI falló. Usando Cohere...', error?.message);
  }

  try {
    const cohereHistory = [
      { role: 'SYSTEM', message: 'Eres Alma. Hook, bullets ✅, pasos, CTA y urgencia. Español neutro.' },
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
        {
          headers: {
            Authorization: `Bearer ${COHERE_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      )
    );

    const texto =
      cohereResponse?.data?.text?.trim() ||
      cohereResponse?.data?.message?.content?.[0]?.text?.trim() ||
      '';

    saveTurn(userId, mensaje, texto);
    return res.json({ fuente: 'cohere', respuesta: texto });
  } catch (err) {
    console.error('❌ Cohere también falló.', err?.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Historial -> POST /api/chat/history
app.post('/history', (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId requerido' });
  return res.json({ userId, history: getHistory(userId) });
});

// Reset -> POST /api/chat/reset
app.post('/reset', (req, res) => {
  const { userId } = req.body || {};
  if (userId) sessions.delete(userId);
  return res.json({ ok: true });
});

export default serverless(app);
