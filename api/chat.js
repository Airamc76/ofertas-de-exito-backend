// /api/chat.js  — handler plano para Vercel (sin Express)
import axios from 'axios';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;

// ===== Memoria por usuario (RAM en runtime) =====
const sessions = new Map();           // { userId: [{role, content}] }
const MAX_TURNS = 15;

function getHistory(userId) {
  if (!userId) return [];
  return sessions.get(userId) || [];
}
function saveTurn(userId, userMsg, assistantMsg) {
  if (!userId) return;
  const hist = sessions.get(userId) || [];
  if (userMsg)      hist.push({ role:'user', content:userMsg });
  if (assistantMsg) hist.push({ role:'assistant', content:assistantMsg });
  const excess = Math.max(0, hist.length - MAX_TURNS*2);
  if (excess) hist.splice(0, excess);
  sessions.set(userId, hist);
}

// Timeout helper
const withTimeout = (p, ms=25000) =>
  Promise.race([p, new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')), ms))]);

// CORS headers helper
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  setCORS(res);

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Health
  if (req.method === 'GET') {
    return res.status(200).json({ ok:true, service:'chat', t:Date.now() });
  }

  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error:'Method Not Allowed' });
  }

  // Body parseado por Vercel si hay header application/json
  const { mensaje, userId, __echo } = req.body || {};

  // Echo de diagnóstico
  if (__echo) {
    return res.status(200).json({ ok:true, echo:req.body, where:'/api/chat' });
  }

  if (!mensaje) {
    return res.status(400).json({ error:'Mensaje requerido' });
  }

  const history = getHistory(userId);

  // ===== 1) OpenAI (principal) =====
  try {
    const messages = [
      {
        role:'system',
        content: `
Eres **Alma**, IA experta en copywriting, ventas, marketing digital y ofertas irresistibles (español neutro).
- Hook breve
- ✅ Beneficios
- Pasos numerados
- CTA + urgencia
- Cierre con próxima acción
        `.trim()
      },
      ...history,
      { role:'user', content: mensaje }
    ];

    const oai = await withTimeout(
      axios.post('https://api.openai.com/v1/chat/completions',
        { model: process.env.MODEL_OPENAI || 'gpt-4o-mini', messages, max_tokens: 900, temperature: 0.8 },
        { headers: { 'Content-Type':'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` } }
      ),
      25000
    );

    const reply = oai?.data?.choices?.[0]?.message?.content?.trim() || '';
    saveTurn(userId, mensaje, reply);
    return res.status(200).json({ fuente:'openai', modelo: process.env.MODEL_OPENAI || 'gpt-4o-mini', respuesta: reply });
  } catch (e) {
    // continúa a Cohere
    console.warn('OpenAI error:', e?.response?.status, e?.message);
  }

  // ===== 2) Cohere (fallback) =====
  try {
    const cohereHistory = [
      { role:'SYSTEM', message:'Eres Alma. Hook, bullets ✅, pasos, CTA y urgencia. Español neutro.' },
      ...history.map(m => ({ role: m.role === 'assistant' ? 'CHATBOT' : m.role.toUpperCase(), message: m.content })),
      { role:'USER', message: mensaje }
    ];

    const ch = await withTimeout(
      axios.post('https://api.cohere.ai/v1/chat',
        { model: process.env.MODEL_COHERE || 'command-r-plus', message: mensaje, temperature: 0.8, chat_history: cohereHistory },
        { headers: { Authorization: `Bearer ${COHERE_API_KEY}`, 'Content-Type':'application/json' } }
      ),
      25000
    );

    const texto = ch?.data?.text?.trim() || ch?.data?.message?.content?.[0]?.text?.trim() || '';
    saveTurn(userId, mensaje, texto);
    return res.status(200).json({ fuente:'cohere', modelo: process.env.MODEL_COHERE || 'command-r-plus', respuesta: texto });
  } catch (e) {
    console.error('Cohere error:', e?.response?.status, e?.message);
    return res.status(500).json({ error:'Error interno del servidor.' });
  }
}
