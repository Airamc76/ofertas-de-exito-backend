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

// Utilidad de timeout
const withTimeout = (promise, ms = 25_000) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

// ================== RUTAS ==================

// Chat principal -> POST /api/chat
app.post('/api/chat', async (req, res) => {
  const { mensaje, userId } = req.body;
  if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

  const history = getHistory(userId);

  // 1) OpenAI (principal)
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
    return res.json({
      fuente: 'openai',
      modelo: process.env.MODEL_OPENAI || 'gpt-4o-mini',
      respuesta: reply
    });
  } catch (error) {
    console.warn('❌ OpenAI falló. Usando Cohere como respaldo...', error?.message);
  }

  // 2) Cohere (respaldo)
  try {
    const cohereHistory = [
      { role: 'SYSTEM', message: `Eres Alma (copywriting/ofertas irresistibles). Hook breve, bullets ✅, pasos numerados, CTA y urgencia. Español neutro.` },
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
    return res.json({
      fuente: 'cohere',
      modelo: process.env.MODEL_COHERE || 'command-r-plus',
      respuesta: texto
    });
  } catch (err) {
    console.error('❌ Cohere también falló.', err?.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Ver historial -> POST /api/history
app.post('/api/history', (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId requerido' });
  return res.json({ userId, history: getHistory(userId) });
});

// Reset historial -> POST /api/reset
app.post('/api/reset', (req, res) => {
  const { userId } = req.body || {};
  if (userId) sessions.delete(userId);
  return res.json({ ok: true });
});

// En Vercel NO se usa app.listen; exportamos el handler serverless
export default serverless(app);
