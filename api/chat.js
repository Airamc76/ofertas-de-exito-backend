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
  console.warn('[chat] No se pudo leer alma-style.md. Usando fallback.', e?.message);
  ALMA_STYLE = `
Eres “Alma”, **experta en ventas online** y ofertas irresistibles. Tu trabajo: guiar a la persona para convertir ideas en ventas digitales usando funnels, páginas de venta, anuncios, e-mail marketing y automatización. Responde en español con bloques claros, acción inmediata y tono directo/empático.
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

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});
app.use(cors());
app.use(express.json());

/* ==========================
   2) Historial con Redis
   ========================== */
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const MAX_TURNS = 100; // Suficiente para ~3 meses de uso regular

async function getHistory(userId, conversationId = 'default') {
  if (!userId) return [];
  try {
    const key = `chat:${userId}:${conversationId}`;
    const history = await redis.get(key);
    return history || [];
  } catch (error) {
    console.error('[chat] Error getting history:', error);
    return [];
  }
}

async function saveTurn(userId, userMsg, assistantMsg, conversationId = 'default') {
  if (!userId) return;
  try {
    const hist = await getHistory(userId, conversationId);
    if (userMsg) hist.push({ role: 'user', content: userMsg, timestamp: new Date().toISOString() });
    if (assistantMsg) hist.push({ role: 'assistant', content: assistantMsg, timestamp: new Date().toISOString() });

    const extra = Math.max(0, hist.length - MAX_TURNS * 2);
    if (extra) hist.splice(0, extra);

    const key = `chat:${userId}:${conversationId}`;
    await redis.set(key, hist);
    
    // Guardar lista de conversaciones del usuario
    await saveConversationList(userId, conversationId, userMsg);
  } catch (error) {
    console.error('[chat] Error saving turn:', error);
  }
}

async function saveConversationList(userId, conversationId, firstMessage) {
  try {
    const listKey = `conversations:${userId}`;
    const conversations = await redis.get(listKey) || [];
    
    // Verificar si ya existe
    const existing = conversations.find(c => c.id === conversationId);
    if (!existing) {
      const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');
      conversations.unshift({
        id: conversationId,
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      // Limitar a 20 conversaciones máximo
      if (conversations.length > 20) {
        conversations.splice(20);
      }
      
      await redis.set(listKey, conversations);
    } else {
      // Actualizar timestamp
      existing.updatedAt = new Date().toISOString();
      await redis.set(listKey, conversations);
    }
  } catch (error) {
    console.error('[chat] Error saving conversation list:', error);
  }
}

/* ==========================
   3) Utils
   ========================== */
const withTimeout = (promise, ms = 25_000) =>
  Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
  ]);

const sanitize = (s = '') => String(s).trim().slice(0, 2000); 

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
    const conversationId = req.body?.conversationId || `conv_${Date.now()}`;
    const mensaje  = sanitize(rawMsg);

    if (!mensaje) {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }

    let tokenUserId = null;
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
      const token = auth.slice(7);
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        tokenUserId = payload?.userId || null;
      } catch (_) {}
    }

    const userId = tokenUserId || bodyUser;
    if (!userId) {
      return res.status(400).json({ error: 'userId requerido (o token válido)' });
    }

    const history = await getHistory(userId, conversationId);

    // Bloques de contexto para Alma
    const systemBlock = `${ALMA_STYLE}\n\n${GUARD}\n\nContexto: Responde en español.`;
    const messages = [
      { role: 'system', content: systemBlock },
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: mensaje }
    ];

    const openaiResp = await withTimeout(
      axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
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

    await saveTurn(userId, mensaje, assistantMsg, conversationId);

    res.json({
      ok: true,
      fuente: 'openai',
      modelo: process.env.MODEL_OPENAI || 'gpt-4o-mini',
      respuesta: assistantMsg,
      conversationId: conversationId
    });
  } catch (err) {
    console.error('[chat] Error:', err?.message);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

/* ==========================
   6) Endpoint para listar conversaciones
   ========================== */
app.get('/api/chat/conversations', async (req, res) => {
  try {
    let userId = null;
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
      const token = auth.slice(7);
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        userId = payload?.userId || null;
      } catch (_) {}
    }

    if (!userId) {
      return res.status(401).json({ error: 'Token requerido' });
    }

    const listKey = `conversations:${userId}`;
    const conversations = await redis.get(listKey) || [];
    
    res.json({
      ok: true,
      conversations: conversations
    });
  } catch (error) {
    console.error('[chat] Error getting conversations:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

/* ==========================
   7) Listen
   ========================== */
app.listen(PORT, () => {
  console.log(`[chat] Servidor corriendo en puerto ${PORT}`);
});

