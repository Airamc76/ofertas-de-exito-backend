// /api/chat.js — Handler plano para Vercel con el formato de respuesta de Alma
import axios from 'axios';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;

// Helpers
const withTimeout = (p, ms = 25000) =>
  Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  setCORS(res);

  // Preflight
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Health
  if (req.method === 'GET') return res.status(200).json({ ok: true, service: 'chat', t: Date.now() });

  // Solo POST
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { mensaje, __echo } = req.body || {};
  if (__echo) return res.status(200).json({ ok: true, where: '/api/chat' });
  if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

  // 1) OpenAI (principal) — MISMO ESTILO QUE ME MOSTRASTE
  try {
    const messages = [
      {
        role: 'system',
        content: `
Eres **Alma**, una IA experta en redacción publicitaria, ventas, marketing digital y creación de ofertas irresistibles.
Estilo: conversacional, claro, persuasivo, cálido y profesional. Responde SIEMPRE en español neutro.

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
        `.trim()
      },
      { role: 'user', content: mensaje }
    ];

    const oai = await withTimeout(
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

    const reply = oai?.data?.choices?.[0]?.message?.content?.trim() || '';
    return res.status(200).json({
      fuente: 'openai',
      modelo: process.env.MODEL_OPENAI || 'gpt-4o-mini',
      respuesta: reply
    });
  } catch (error) {
    console.warn('OpenAI error:', error?.response?.status, error?.message);
  }

  // 2) Cohere (fallback)
  try {
    const ch = await withTimeout(
      axios.post(
        'https://api.cohere.ai/v1/chat',
        {
          model: process.env.MODEL_COHERE || 'command-r-plus',
          message: mensaje,
          temperature: 0.8,
          chat_history: [
            { role: 'SYSTEM', message: 'Eres Alma. Hook, bullets ✅, pasos numerados, CTA y urgencia. Español neutro.' },
            { role: 'USER', message: mensaje }
          ]
        },
        { headers: { Authorization: `Bearer ${COHERE_API_KEY}`, 'Content-Type': 'application/json' } }
      ),
      25000
    );

    const texto =
      ch?.data?.text?.trim() ||
      ch?.data?.message?.content?.[0]?.text?.trim() ||
      '';

    return res.status(200).json({
      fuente: 'cohere',
      modelo: process.env.MODEL_COHERE || 'command-r-plus',
      respuesta: texto
    });
  } catch (err) {
    console.error('Cohere error:', err?.response?.status, err?.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
}
