// routes/supa.js - Rutas persistentes con Supabase (scoping por x-client-id)
console.log('[SupaRouter] loaded from', import.meta.url);
import { Router } from 'express';
import { customAlphabet } from 'nanoid';
import { supaStore, supa } from '../src/store/supaStore.js';
import { callModel } from '../src/services/ai.js';

const router = Router();
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 20);

// === HOTFIX PROMPTS INLINE (no FS) ===
const P = {
  style:  process.env.PROMPT_STYLE  || 'Eres Alma, una asistente clara, amable y accionable.',
  dialog: process.env.PROMPT_DIALOG || 'Mantén el contexto; pide datos faltantes sin ambigüedad.',
  output: process.env.PROMPT_OUTPUT || 'Responde con pasos y ejemplos breves. Evita jerga innecesaria y usa bloques de código cuando aplique.',
  fewshot: process.env.PROMPT_FEWSHOT || null,
};
// =====================================

// Retry exponencial simple para llamadas a proveedor
async function callWithRetry(fn, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      await new Promise(r => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw last;
}

// Pequeño helper
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Loguea qué ruta está entrando realmente
router.use((req, _res, next) => {
  try { console.log('[supa]', req.method, req.originalUrl); } catch {}
  next();
});

// Health-check
router.get('/ping', async (_req, res) => {
  try {
    const { error } = await supa.from('clients').select('id').limit(1);
    if (error) throw error;
    res.setHeader('x-hit', 'supa:ping');
    res.json({ success: true, route: 'supa:ping', db: 'up', ts: Date.now() });
  } catch (e) {
    res.setHeader('x-hit', 'supa:ping');
    res.status(500).json({ success: false, route: 'supa:ping', db: 'down', error: String(e) });
  }
});

// Listar conversaciones
router.get('/conversations', async (req, res) => {
  try {
    const clientId = req.headers['x-client-id'];
    res.setHeader('x-hit', 'supa:list');
    if (!clientId) return res.status(400).json({ success: false, route: 'supa:list', error: 'Se requiere el encabezado x-client-id' });
    const list = await supaStore.listConversations(clientId, 20);
    res.json({ success: true, route: 'supa:list', data: list });
  } catch (e) {
    console.error('[supa] list conversations error:', e);
    res.setHeader('x-hit', 'supa:list');
    res.status(500).json({ success: false, route: 'supa:list', error: String(e?.message || e) });
  }
});

// Crear conversación
router.post('/conversations', async (req, res) => {
  try {
    const clientId = req.headers['x-client-id'];
    res.setHeader('x-hit', 'supa:create');
    if (!clientId) return res.status(400).json({ success: false, route: 'supa:create', error: 'Se requiere el encabezado x-client-id' });
    const convId = 'conv_' + nanoid();
    const conv = await supaStore.createConversation(clientId, convId, 'Nueva conversación');
    res.status(201).json({ success: true, route: 'supa:create', data: conv });
  } catch (e) {
    console.error('[supa] create conversation error:', e);
    res.setHeader('x-hit', 'supa:create');
    res.status(500).json({ success: false, route: 'supa:create', error: String(e?.message || e) });
  }
});

// Enviar mensaje y obtener respuesta del modelo
router.post('/conversations/:id/messages', async (req, res) => {
  const startedAt = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Hit', 'supa:messages');

  try {
    const clientId = req.headers['x-client-id'];
    if (!clientId) return res.status(400).json({ success: false, route: 'supa:messages', error: 'Missing x-client-id' });

    const id = req.params.id;
    const content = (req.body?.content || '').trim();
    const clientMsgId = req.body?.clientMsgId || null;
    if (!content || !clientMsgId) {
      return res.status(400).json({ success: false, route: 'supa:messages', error: 'content y clientMsgId requeridos' });
    }

    // 1) Asegura conversación (ids legacy)
    await supaStore.ensureConversation(id, clientId);

    // 2) UPSERT del user con idempotencia (conversation_id + client_msg_id) con verificación y fallback
    const upsertRes = await supa
      .from('messages')
      .upsert(
        [{ conversation_id: id, role: 'user', content, client_msg_id: clientMsgId }],
        { onConflict: 'conversation_id,client_msg_id' }
      )
      .select('id, role, client_msg_id')
      .maybeSingle();

    if (upsertRes.error) {
      try { console.error('[supa] upsert user error:', upsertRes.error); } catch {}
    }

    if (!upsertRes.data) {
      const check = await supa
        .from('messages')
        .select('id')
        .eq('conversation_id', id)
        .eq('role', 'user')
        .eq('client_msg_id', clientMsgId)
        .maybeSingle();

      if (!check.data) {
        try { console.warn('[supa] user not found after upsert, fallback insert'); } catch {}
        await supaStore.appendMessage(id, 'user', content, { client_msg_id: clientMsgId });
      }
    }

    // 3) Traer historial ya con el user incluido
    const history = await supaStore.getHistory(id, 40);

    // 4) Componer prompts anti-saludo
    const SYS = 'Eres Alma, una asistente de negocio práctica. Respondes en español, directo y accionable. '
      + 'No saludes ni digas “Estoy aquí para ayudarte”. Evita frases de relleno. '
      + 'Da pasos concretos, bullets y ejemplos breves. Si falta un dato clave, haz 1–2 preguntas cortas.';
    const OUTPUT = 'Formato: • Bullets cortas o pasos numerados • Enlazar con lo ya dicho • Nada de párrafos largos • Máximo 8 bullets.';

    const messages = [
      { role: 'system', content: `${SYS}\n${OUTPUT}` },
      ...history.map(m => ({ role: m.role, content: m.content })),
    ];

    // 5) Llamar al modelo con retry
    const t0 = Date.now();
    const { text } = await callWithRetry(() => callModel({ messages }), 3);
    const inferMs = Date.now() - t0;
    try { console.log('[supa] infer', { messages: messages.length, ms: inferMs }); } catch {}

    // 6) Guardar assistant
    await supaStore.appendMessage(id, 'assistant', text);

    return res.status(201).json({ success: true, route: 'supa:messages', data: { content: text } });
  } catch (e) {
    console.error('supa:messages error', e);
    return res.status(500).json({ success: false, route: 'supa:messages', error: String(e?.message || e) });
  }
});

// Depuración: ver historial que se envía al modelo
router.get('/conversations/:id/history', async (req, res) => {
  try {
    res.setHeader('x-hit', 'supa:history');
    const clientId = req.headers['x-client-id'];
    if (!clientId) return res.status(400).json({ success: false, route: 'supa:history', error: 'Se requiere el encabezado x-client-id' });
    const limit = Math.min(parseInt(req.query.limit || '24', 10), 200);
    const history = await supaStore.getHistory(req.params.id, limit);
    res.json({ success: true, route: 'supa:history', data: history });
  } catch (e) {
    res.setHeader('x-hit', 'supa:history');
    res.status(500).json({ success: false, route: 'supa:history', error: String(e?.message || e) });
  }
});

export default router;
