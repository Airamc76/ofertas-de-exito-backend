import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import serverless from 'serverless-http';

dotenv.config();

const app = express();

// --- CORS (responder también preflight) ---
app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'], optionsSuccessStatus: 204 }));
app.options('*', cors()); // <- importante para el preflight

app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;

// ===== Memoria por usuario (en RAM) =====
const sessions = new Map();
const MAX_TURNS = 15;

function getHistory(userId){ return userId ? (sessions.get(userId) || []) : []; }
function saveTurn(userId, userMsg, assistantMsg){
  if (!userId) return;
  const hist = sessions.get(userId) || [];
  if (userMsg) hist.push({ role:'user', content:userMsg });
  if (assistantMsg) hist.push({ role:'assistant', content:assistantMsg });
  const excess = Math.max(0, hist.length - MAX_TURNS*2);
  if (excess) hist.splice(0, excess);
  sessions.set(userId, hist);
}

const withTimeout = (p, ms=25000) => Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')), ms))]);

// Health -> GET /api/chat
app.get('/', (_req, res) => res.json({ ok:true, service:'chat', t: Date.now() }));

// Chat -> POST /api/chat   (rutas en raíz)
app.post('/', async (req, res) => {
  const { mensaje, userId, __echo } = req.body || {};
  if (__echo) return res.json({ ok:true, echo:req.body, where:'/api/chat' });
  if (!mensaje) return res.status(400).json({ error:'Mensaje requerido' });

  const history = getHistory(userId);

  // OpenAI principal
  try {
    const messages = [
      { role:'system', content: `
Eres **Alma**, IA experta en copywriting, ventas y ofertas irresistibles (español neutro).
- Hook breve
- ✅ Beneficios
- Pasos numerados
- CTA + urgencia
- Cierre con próxima acción
      `.trim() },
      ...history,
      { role:'user', content: mensaje }
    ];

    const r = await withTimeout(
      axios.post('https://api.openai.com/v1/chat/completions',
        { model: process.env.MODEL_OPENAI || 'gpt-4o-mini', messages, max_tokens: 900, temperature: 0.8 },
        { headers: { 'Content-Type':'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` } }
      ),
      25000
    );

    const reply = r?.data?.choices?.[0]?.message?.content?.trim() || '';
    saveTurn(userId, mensaje, reply);
    return res.json({ fuente:'openai', respuesta: reply });
  } catch (e) {
    console.warn('OpenAI error:', e?.response?.status, e?.message);
  }

  // Cohere fallback
  try {
    const cohereHistory = [
      { role:'SYSTEM', message:'Eres Alma. Hook, bullets ✅, pasos, CTA y urgencia. Español neutro.' },
      ...history.map(m => ({ role: m.role === 'assistant' ? 'CHATBOT' : m.role.toUpperCase(), message: m.content })),
      { role:'USER', message: mensaje }
    ];

    const r = await withTimeout(
      axios.post('https://api.cohere.ai/v1/chat',
        { model: process.env.MODEL_COHERE || 'command-r-plus', message: mensaje, temperature: 0.8, chat_history: cohereHistory },
        { headers: { Authorization: `Bearer ${COHERE_API_KEY}`, 'Content-Type':'application/json' } }
      ),
      25000
    );

    const texto = r?.data?.text?.trim() || r?.data?.message?.content?.[0]?.text?.trim() || '';
    saveTurn(userId, mensaje, texto);
    return res.json({ fuente:'cohere', respuesta: texto });
  } catch (e) {
    console.error('Cohere error:', e?.response?.status, e?.message);
    return res.status(500).json({ error:'Error interno del servidor.' });
  }
});

// Historial -> POST /api/chat/history
app.post('/history', (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error:'userId requerido' });
  return res.json({ userId, history: getHistory(userId) });
});

// Reset -> POST /api/chat/reset
app.post('/reset', (req, res) => {
  const { userId } = req.body || {};
  if (userId) sessions.delete(userId);
  return res.json({ ok:true });
});

export default serverless(app);
