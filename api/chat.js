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

// ===== Memoria por usuario (en RAM del runtime) =====
const sessions = new Map(); // { userId: [{role, content}] }
const MAX_TURNS = 15;

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

// Timeout helper
const withTimeout = (promise, ms = 25000) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

// Healthcheck -> GET /api/chat
app.get('/', (_req, res) => res.json({ ok: true, service: 'chat', t: Date.now() }));

// ================== CHAT ==================
// IMPORTANT: rutas en raíz porque este archivo ya vive en /api/chat
app.post('/', async (req, res) => {
  const { mensaje, userId, __echo } = req.body || {};
  console.log('>> /api/chat IN', { hasMsg: !!mensaje, userId });

  // 0) Echo de diagnóstico: responde al instante para descartar routing
  if (__echo) {
    console.log('<< /api/chat ECHO');
    return res.json({ ok: true, echo: req.body, where: '/api/chat' });
  }

  if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

  const history = getHistory(userId);

  // 1) OpenAI principal
  try {
    const messages = [
      {
        role: 'system',
        content: `
Eres **Alma**, IA experta en copywriting, ventas, marketing digital y ofertas irresistibles.
Estilo: conversacional, claro, persuasivo, cálido y profesional. Español neutro.
- Hook breve
- Beneficios con ✅
- Pasos numerados
- CTA + urgencia
- Cierre con próxima acción
      `.trim()
      },
      ...history,
      { role: 'user', content: mensaje }
    ];

    console.log('.. calling OpenAI');
    const openaiResponse = await withTimeout(
      axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: process.env.MODEL_OPENAI || 'gpt-4o-mini',
          messages,
          max_tokens: 900,
          temperature: 0.8
        },
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` } }
      ),
      25000
    );

    const reply = openaiResponse?.data?.choices?.[0]?.message?.content?.trim() || '';
    console.log('<< OpenAI OK', reply.slice(0, 60));
    saveTurn(userId, mensaje, reply);
    return res.json({ fuente: 'openai', modelo: process.env.MODEL_OPENAI || 'gpt-4o-mini', respuesta: reply });
  } catch (error) {
    console.warn('!! OpenAI error', error?.response?.status, error?.message);
  }

  // 2) Cohere fallback
  try {
    const cohereHistory = [
      { role: 'SYSTEM', message: 'Eres Alma. Hook, bullets ✅, pasos, CTA y urgencia. Español neutro.' },
      ...history.map(m => ({ role: m.role === 'assistant' ? 'CHATBOT' : m.role.toUpperCase(), message: m.content })),
      { role: 'USER', message: mensaje }
    ];

    console.log('.. calling Cohere');
    const cohereResponse = await withTimeout(
      axios.post(
        'https://api.cohere.ai/v1/chat',
        {
          model: process.env.MODEL_COHERE || 'command-r-plus',
          message: mensaje,
          temperature: 0.8,
          chat_history: cohereHistory
        },
        { headers: { Authorization: `Bearer ${COHERE_API_KEY}`, 'Content-Type': 'application/json' } }
      ),
      25000
    );

    const texto =
      cohereResponse?.data?.text?.trim() ||
      cohereResponse?.data?.message?.content?.[0]?.text?.trim() ||
      '';

    console.log('<< Cohere OK', (texto || '').slice(0, 60));
    saveTurn(userId, mensaje, texto);
    return res.json({ fuente: 'cohere', modelo: process.env.MODEL_COHERE || 'command-r-plus', respuesta: texto });
  } catch (err) {
    console.error('!! Cohere error', err?.response?.status, err?.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ================== HISTORY/RESET ==================
app.post('/history', (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId requerido' });
  return res.json({ userId, history: getHistory(userId) });
});

app.post('/reset', (req, res) => {
  const { userId } = req.body || {};
  if (userId) sessions.delete(userId);
  return res.json({ ok: true });
});

// Exportar para Vercel (no usar app.listen en serverless)
export default serverless(app);
