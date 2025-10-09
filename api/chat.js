// api/chat.js
import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import client from '../src/middleware/client.js';
import { conversationListStore as convStoreMem, chatStore as chatStoreMem } from '../src/store/memory.js';

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

// Middleware de headers CORS (asegura x-client-id en TODAS las respuestas)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-client-id, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-client-id', 'Authorization'],
}));

app.options('*', (_req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-client-id, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  return res.sendStatus(204);
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: 'text/*' }));

// Rutas públicas basadas en x-client-id (sin auth): conversaciones y mensajes
// GET/POST /api/conversations
app.get('/api/conversations', client, (req, res) => {
  const clientId = req.clientId;
  const list = convStoreMem.get(clientId) || [];
  const sorted = [...list].sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return res.json(sorted);
});

app.post('/api/conversations', client, (req, res) => {
  const clientId = req.clientId;
  const { title } = req.body || {};
  const conv = {
    id: `conv_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    title: title || 'Nueva conversación',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const list = convStoreMem.get(clientId) || [];
  convStoreMem.set(clientId, [conv, ...list]);
  return res.status(201).json(conv);
});

// Alias para compatibilidad: /api/chat/conversations (GET/POST)
app.get('/api/chat/conversations', client, (req, res) => {
  const clientId = req.clientId;
  const list = convStoreMem.get(clientId) || [];
  const sorted = [...list].sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return res.json(sorted);
});

app.post('/api/chat/conversations', client, (req, res) => {
  const clientId = req.clientId;
  const { title } = req.body || {};
  const conv = {
    id: `conv_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    title: title || 'Nueva conversación',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const list = convStoreMem.get(clientId) || [];
  convStoreMem.set(clientId, [conv, ...list]);
  return res.status(201).json(conv);
});

// GET/POST/DELETE /api/conversations/:id/messages
app.get('/api/conversations/:id/messages', client, (req, res) => {
  const clientId = req.clientId;
  const { id } = req.params;
  const list = convStoreMem.get(clientId) || [];
  const conv = list.find(c => c.id === id);
  if (!conv) return res.status(404).json({ error: 'conversation not found for this client' });
  const messages = chatStoreMem.get(id) || [];
  return res.json({ session: { id: conv.id, title: conv.title }, messages });
});

app.post('/api/conversations/:id/messages', client, (req, res) => {
  const clientId = req.clientId;
  const { id } = req.params;
  const { role, content, metadata } = req.body || {};
  if (!role || !content) return res.status(400).json({ error: 'role and content required' });
  const list = convStoreMem.get(clientId) || [];
  const conv = list.find(c => c.id === id);
  if (!conv) return res.status(404).json({ error: 'conversation not found for this client' });
  const messages = chatStoreMem.get(id) || [];
  const msg = { role, content, metadata: metadata ?? {}, createdAt: new Date().toISOString() };
  messages.push(msg);
  chatStoreMem.set(id, messages);
  conv.updatedAt = new Date().toISOString();
  convStoreMem.set(clientId, [conv, ...list.filter(c => c.id !== id)]);
  return res.status(201).json(msg);
});

app.delete('/api/conversations/:id', client, (req, res) => {
  const clientId = req.clientId;
  const { id } = req.params;
  const list = convStoreMem.get(clientId) || [];
  const conv = list.find(c => c.id === id);
  if (!conv) return res.status(404).json({ error: 'conversation not found for this client' });
  chatStoreMem.delete(id);
  const nextList = list.filter(c => c.id !== id);
  convStoreMem.set(clientId, nextList);
  return res.status(204).end();
});

// Manejador de errores de parseo JSON para responder en JSON y no HTML
app.use((err, _req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido en el cuerpo de la solicitud' });
  }
  next(err);
});

/* ==========================
   2) Historial y usuarios (In-Memory Store)
   ========================== */

// Almacenamiento en memoria (temporal) para reemplazar Redis
// Conversaciones: key -> `chat:${userId}:${conversationId}` => [messages]
const chatStore = new Map();
// Lista de conversaciones por usuario: key -> `conversations:${userId}` => [{id,title,...}]
const conversationListStore = new Map();
// Usuarios: por ID y por email
const usersStore = new Map(); // key -> `alma:user:${userId}` => userData
const emailToUserIdStore = new Map(); // key -> `alma:user:email:${email}` => userId
// Códigos de reset
const resetCodesStore = new Map(); // key -> `alma:reset:${email}` => code

const MAX_TURNS = 100; // Suficiente para ~3 meses de uso regular

// Helpers para deserializar y normalizar historial legado
function tryParseJSON(val) {
  if (typeof val !== 'string') return null;
  try { return JSON.parse(val); } catch { return null; }
}

function normalizeHistory(raw) {
  // Aceptar string JSON o arreglo directo
  const val = typeof raw === 'string' ? (tryParseJSON(raw) ?? raw) : raw;
  if (!Array.isArray(val)) return [];
  // Aceptar solo elementos con role y content válidos
  return val
    .filter(m => m && typeof m === 'object' && typeof m.role === 'string' && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: String(m.content) }));
}

function isValidRole(role) {
  return role === 'system' || role === 'user' || role === 'assistant';
}

function isValidMessage(m) {
  return m && typeof m === 'object' && isValidRole(m.role) && typeof m.content === 'string';
}

function normalizeMessagesArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(isValidMessage)
    .map(m => ({ role: m.role, content: String(m.content) }));
}

async function getHistory(userId, conversationId = 'default') {
  if (!userId) return [];
  try {
    const key = `chat:${userId}:${conversationId}`;
    const history = chatStore.get(key) || [];
    return normalizeHistory(history);
  } catch (error) {
    console.error('[chat] Error getting history (store):', error);
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
    chatStore.set(key, hist);
    
    // Guardar lista de conversaciones del usuario
    await saveConversationList(userId, conversationId, userMsg || assistantMsg || '');
  } catch (error) {
    console.error('[chat] Error saving turn (store):', error);
  }
}

async function saveConversationList(userId, conversationId, firstMessage) {
  try {
    const listKey = `conversations:${userId}`;
    const conversations = conversationListStore.get(listKey) || [];
    
    // Verificar si ya existe
    const existing = conversations.find(c => c.id === conversationId);
    if (!existing) {
      const safeMsg = String(firstMessage || 'Nueva conversación');
      const title = safeMsg.slice(0, 50) + (safeMsg.length > 50 ? '...' : '');
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
      
      conversationListStore.set(listKey, conversations);
    } else {
      // Actualizar timestamp
      existing.updatedAt = new Date().toISOString();
      conversationListStore.set(listKey, conversations);
    }
  } catch (error) {
    console.error('[chat] Error saving conversation list (store):', error);
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

// Endpoint de depuración para inspeccionar lo que recibe el servidor
app.post('/api/chat/debug', (req, res) => {
  try {
    const ct = req.headers['content-type'] || '';
    const preview = (obj) => {
      try { return JSON.parse(JSON.stringify(obj)); } catch { return String(obj); }
    };
    res.json({
      ok: true,
      contentType: ct,
      bodyType: typeof req.body,
      body: preview(req.body),
      query: preview(req.query),
      headers: {
        'x-user-id': req.headers['x-user-id'] || null,
        'x-message': req.headers['x-message'] || null
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'debug failed' });
  }
});

// Endpoint de debugging del store en memoria
app.get('/api/debug/store/:userId/:conversationId', async (req, res) => {
  try {
    const { userId, conversationId } = req.params;
    const chatKey = `chat:${userId}:${conversationId}`;
    const listKey = `conversations:${userId}`;
    
    const rawData = chatStore.get(chatKey) || [];
    const conversations = conversationListStore.get(listKey) || [];
    
    res.json({
      ok: true,
      chatKey,
      rawData,
      rawDataType: typeof rawData,
      normalizedData: normalizeHistory(rawData),
      conversations
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ==========================
   5) Endpoint principal
   ========================== */
app.post('/api/chat', async (req, res) => {
  try {
    let rawMsg   = req.body?.mensaje ?? req.body?.message ?? req.query?.mensaje ?? req.query?.message ?? req.headers['x-message'];
    let bodyUser = req.body?.userId ?? req.query?.userId ?? req.headers['x-user-id'];
    // Fallbacks por si el body llega como string o por querystring
    if (!rawMsg && typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        rawMsg = parsed?.mensaje ?? parsed?.message;
        bodyUser = bodyUser || parsed?.userId;
      } catch (_) {}
      // Si no es JSON, tratar la cadena completa como mensaje
      if (!rawMsg) rawMsg = req.body;
    }
    const conversationId = req.body?.conversationId || `conv_${Date.now()}`;
    const mensaje  = sanitize(rawMsg);

    if (!mensaje) {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }

    // Validación temprana: si falta la API key, no intentamos llamar a OpenAI
    if (!OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OPENAI_API_KEY no configurada en el servidor' });
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
    let messages = [
      { role: 'system', content: systemBlock },
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: mensaje }
    ];

    // Validación extra: si algún mensaje es inválido, usamos solo system + user
    if (!messages.every(isValidMessage)) {
      console.warn('[chat] Mensajes inválidos detectados. Rehaciendo sin historial.', { conversationId, userId });
      messages = [
        { role: 'system', content: systemBlock },
        { role: 'user', content: mensaje }
      ];
    }

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

    console.log('[chat] Conversation saved:', {
      userId,
      conversationId,
      messageLength: mensaje.length,
      responseLength: assistantMsg.length,
      storeKey: `chat:${userId}:${conversationId}`
    });

    res.json({
      ok: true,
      fuente: 'openai',
      modelo: process.env.MODEL_OPENAI || 'gpt-4o-mini',
      respuesta: assistantMsg,
      conversationId: conversationId
    });
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data;
    const msg = (data && (data.error?.message || data.message)) || err?.message || 'Error en el servidor';
    try {
      console.error('[chat] Error OpenAI/chat:', {
        status,
        message: msg,
        data: typeof data === 'object' ? data : String(data || '')
      });
    } catch (_) {
      console.error('[chat] Error OpenAI/chat:', status, msg);
    }
    return res.status(status).json({
      error: msg,
      providerStatus: status
    });
  }
});

/* ==========================
   6) Endpoints de Gestión de Conversaciones
   ========================== */

// GET /api/conversations - Listar conversaciones del usuario
app.get('/api/conversations', async (req, res) => {
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
    const conversations = conversationListStore.get(listKey) || [];
    
    res.json({
      ok: true,
      conversations: conversations
    });
  } catch (error) {
    console.error('[conversations] Error getting conversations:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// GET /api/conversations/:id/messages - Obtener mensajes de una conversación específica
app.get('/api/conversations/:id/messages', async (req, res) => {
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

    const conversationId = req.params.id;
    const messages = await getHistory(userId, conversationId);
    
    // Debug logging para identificar el problema
    console.log('[messages] Debug:', {
      userId,
      conversationId,
      messagesCount: messages.length,
      storeKey: `chat:${userId}:${conversationId}`,
      firstMessage: messages[0] || 'none'
    });
    
    res.json({
      ok: true,
      conversationId: conversationId,
      messages: messages
    });
  } catch (error) {
    console.error('[conversations] Error getting messages:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// POST /api/conversations - Crear/actualizar conversación
app.post('/api/conversations', async (req, res) => {
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

    const { id, title, messages } = req.body;
    
    if (!id || !title) {
      return res.status(400).json({ error: 'ID y título requeridos' });
    }

    const listKey = `conversations:${userId}`;
    const conversations = conversationListStore.get(listKey) || [];
    
    // Buscar conversación existente
    const existingIndex = conversations.findIndex(c => c.id === id);
    const conversationData = {
      id,
      title,
      updatedAt: new Date().toISOString(),
      createdAt: existingIndex >= 0 ? conversations[existingIndex].createdAt : new Date().toISOString()
    };

    if (existingIndex >= 0) {
      // Actualizar existente
      conversations[existingIndex] = conversationData;
    } else {
      // Crear nueva
      conversations.unshift(conversationData);
      
      // Limitar a 20 conversaciones máximo
      if (conversations.length > 20) {
        conversations.splice(20);
      }
    }

    conversationListStore.set(listKey, conversations);

    // Si se proporcionan mensajes, normalizarlos antes de guardar
    if (messages && Array.isArray(messages)) {
      const normalized = normalizeMessagesArray(messages);
      const chatKey = `chat:${userId}:${id}`;
      chatStore.set(chatKey, normalized);
    }
  } catch (error) {
    console.error('[conversations] Error creating/updating conversation:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// PUT /api/conversations/:id - Actualizar conversación específica
app.put('/api/conversations/:id', async (req, res) => {
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

    const conversationId = req.params.id;
    const { title, messages } = req.body;

    const listKey = `conversations:${userId}`;
    const conversations = conversationListStore.get(listKey) || [];
    
    const existingIndex = conversations.findIndex(c => c.id === conversationId);
    
    if (existingIndex < 0) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    // Actualizar metadatos
    if (title) {
      conversations[existingIndex].title = title;
    }
    conversations[existingIndex].updatedAt = new Date().toISOString();

    conversationListStore.set(listKey, conversations);

    // Actualizar mensajes si se proporcionan (normalizados)
    if (messages && Array.isArray(messages)) {
      const normalized = normalizeMessagesArray(messages);
      const chatKey = `chat:${userId}:${conversationId}`;
      chatStore.set(chatKey, normalized);
    }

    res.json({
      ok: true,
      conversation: conversations[existingIndex]
    });
  } catch (error) {
    console.error('[conversations] Error updating conversation:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// DELETE /api/conversations/:id - Eliminar conversación
app.delete('/api/conversations/:id', async (req, res) => {
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

    const conversationId = req.params.id;

    const listKey = `conversations:${userId}`;
    const conversations = conversationListStore.get(listKey) || [];
    
    const filteredConversations = conversations.filter(c => c.id !== conversationId);
    
    if (filteredConversations.length === conversations.length) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    conversationListStore.set(listKey, filteredConversations);

    // Eliminar también el historial de mensajes
    const chatKey = `chat:${userId}:${conversationId}`;
    chatStore.delete(chatKey);

    res.json({
      ok: true,
      message: 'Conversación eliminada'
    });
  } catch (error) {
    console.error('[conversations] Error deleting conversation:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Mantener compatibilidad con el endpoint anterior
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
    const conversations = conversationListStore.get(listKey) || [];
    
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
   7) Endpoints de Autenticación
   ========================== */

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    // Buscar usuario por email
    const emailKey = `alma:user:email:${email.toLowerCase()}`;
    const userId = emailToUserIdStore.get(emailKey);
    
    if (!userId) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Cargar datos del usuario
    const userKey = `alma:user:${userId}`;
    const userData = usersStore.get(userKey);
    
    if (!userData) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = typeof userData === 'string' ? JSON.parse(userData) : userData;

    // Verificar contraseña (usando bcrypt si está hasheada, sino comparación directa)
    let passwordValid = false;
    if (user.passwordHash) {
      passwordValid = await bcrypt.compare(password, user.passwordHash);
    } else {
      passwordValid = password === user.password;
    }

    if (!passwordValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar token JWT
    const token = jwt.sign(
      { userId, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      ok: true,
      token,
      user: { userId, email: user.email }
    });
  } catch (error) {
    console.error('[auth] Login error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Registro
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const emailKey = `alma:user:email:${email.toLowerCase()}`;
    
    // Verificar si el usuario ya existe
    const existingUserId = emailToUserIdStore.get(emailKey);
    if (existingUserId) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    // Generar ID único para el usuario
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Datos del usuario
    const userData = {
      userId,
      email: email.toLowerCase(),
      passwordHash,
      createdAt: new Date().toISOString()
    };

    // Guardar usuario
    const userKey = `alma:user:${userId}`;
    usersStore.set(userKey, userData);
    emailToUserIdStore.set(emailKey, userId);

    // Generar token JWT
    const token = jwt.sign(
      { userId, email: userData.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      ok: true,
      token,
      user: { userId, email: userData.email }
    });
  } catch (error) {
    console.error('[auth] Register error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Solicitar reset de contraseña
app.post('/api/auth/request-reset', async (req, res) => {
  try {
    const { email } = req.body || {};
    
    if (!email) {
      return res.status(400).json({ error: 'Email requerido' });
    }

    const emailKey = `alma:user:email:${email.toLowerCase()}`;
    const userId = emailToUserIdStore.get(emailKey);
    
    // Generar código de 6 dígitos siempre (para no revelar si el email existe)
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const resetKey = `alma:reset:${email.toLowerCase()}`;
    
    // Guardar código con expiración de 15 minutos (in-memory)
    const expiresAt = Date.now() + 15 * 60 * 1000;
    resetCodesStore.set(resetKey, { code, expiresAt });

    // Enviar email con Resend (solo si el usuario existe)
    if (userId && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        const emailData = {
          from: process.env.EMAIL_FROM || 'Alma <onboarding@resend.dev>',
          to: email,
          subject: 'Tu código para restablecer la contraseña - Alma',
          html: `
            <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:auto;padding:20px">
              <div style="text-align:center;margin-bottom:30px">
                <h1 style="color:#3b82f6;margin:0">Alma</h1>
                <p style="color:#6b7280;margin:5px 0">Ambición, Liderazgo, Motivo y Acción para tu futuro</p>
              </div>
              
              <h2 style="color:#111827;margin-bottom:20px">Código de verificación</h2>
              <p style="color:#374151;margin-bottom:20px">Usa este código para restablecer tu contraseña:</p>
              
              <div style="background:#f3f4f6;border-radius:8px;padding:20px;text-align:center;margin:20px 0">
                <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#1f2937">${code}</div>
              </div>
              
              <p style="color:#6b7280;font-size:14px;margin-top:20px">
                Este código caduca en 15 minutos. Si no solicitaste este cambio, ignora este mensaje.
              </p>
            </div>
          `
        };

        await resend.emails.send(emailData);
        console.log(`[auth] Email enviado a ${email} con código ${code}`);
      } catch (emailError) {
        console.error('[auth] Error enviando email:', emailError?.message);
        // No fallar la request si el email falla
      }
    }

    // Por seguridad, siempre respondemos ok
    res.json({
      ok: true,
      message: 'Si el email existe, recibirás un código para resetear tu contraseña',
      code: code // Solo para testing - remover en producción
    });
  } catch (error) {
    console.error('[auth] Request reset error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Reset de contraseña
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, código y nueva contraseña requeridos' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Verificar código
    const resetKey = `alma:reset:${email.toLowerCase()}`;
    const entry = resetCodesStore.get(resetKey);
    const storedCode = entry && entry.expiresAt > Date.now() ? entry.code : '';
    
    // Normalizar ambos códigos a string para comparación
    const normalizedStored = String(storedCode || '').trim();
    const normalizedProvided = String(code || '').trim();
    
    console.log('[reset-password] Debug:', { 
      email: email.toLowerCase(), 
      resetKey, 
      storedCode, 
      providedCode: code,
      normalizedStored,
      normalizedProvided,
      match: normalizedStored === normalizedProvided 
    });
    
    if (!normalizedStored || normalizedStored !== normalizedProvided) {
      return res.status(400).json({ error: 'Código inválido o expirado' });
    }

    // Buscar usuario por email (in-memory)
    const emailKey = `alma:user:email:${email.toLowerCase()}`;
    const userId = emailToUserIdStore.get(emailKey);
    if (!userId) {
      return res.status(400).json({ error: 'Usuario no encontrado' });
    }

    // Cargar datos del usuario (in-memory)
    const userKey = `alma:user:${userId}`;
    const userData = usersStore.get(userKey);
    if (!userData) {
      return res.status(400).json({ error: 'Usuario no encontrado' });
    }
    // Asegurar objeto mutable
    const user = typeof userData === 'string' ? JSON.parse(userData) : { ...userData };

    // Hash de la nueva contraseña
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña
    user.passwordHash = passwordHash;
    user.updatedAt = new Date().toISOString();

    usersStore.set(userKey, user);
    
    // Eliminar código de reset
    resetCodesStore.delete(resetKey);

    res.json({
      ok: true,
      message: 'Contraseña actualizada exitosamente'
    });
  } catch (error) {
    console.error('[auth] Reset password error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Manejador de errores final: siempre devolver JSON
// Debe estar al final de todas las rutas y middlewares (antes de exportar)
app.use((err, _req, res, _next) => {
  const status = err?.status || 400;
  const msg = err?.message || 'Solicitud inválida';
  res.status(status).json({ error: msg });
});

/* ==========================
   7) Export / Listen
   ========================== */
// En Vercel (serverless) exportamos el app; en local levantamos el servidor
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[chat] Servidor corriendo en puerto ${PORT}`);
  });
}

export default app;
