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
  try {
    const clientId = req.headers['x-client-id'];
    res.setHeader('x-hit', 'supa:messages');
    if (!clientId) return res.status(400).json({ success: false, route: 'supa:messages', error: 'Se requiere el encabezado x-client-id' });

    const id = req.params.id;
    const content = (req.body?.content || '').trim();
    const clientMsgId = req.body?.clientMsgId || null;
    if (!content) return res.status(400).json({ success: false, error: 'content requerido' });

    const startedAt = Date.now();

    // Auto-creación de conversación para IDs legacy si no existe
    await supaStore.ensureConversation(id, clientId);

    // 1) UPSERT del mensaje user con client_msg_id (idempotencia DB)
    let userRow = null;
    try {
      const upsertPayload = [{ conversation_id: id, role: 'user', content, client_msg_id: clientMsgId }];
      const { data: upserted, error: upErr } = await supa
        .from('messages')
        .upsert(upsertPayload, { onConflict: 'conversation_id,client_msg_id', ignoreDuplicates: true })
        .select('id, created_at')
        .maybeSingle();
      if (upErr) throw upErr;
      userRow = upserted || null;
    } catch (e) {
      // Si falla por índice, el mensaje del user puede existir; se intenta recuperar
      const { data: existingUser, error: getUserErr } = await supa
        .from('messages')
        .select('id, created_at')
        .eq('conversation_id', id)
        .eq('role', 'user')
        .eq('client_msg_id', clientMsgId)
        .maybeSingle();
      if (getUserErr) throw getUserErr;
      userRow = existingUser || null;
    }

    // 2) Si existía ya, intentar devolver la respuesta assistant que lo sigue (dedupe)
    if (userRow && clientMsgId) {
      for (let i = 0; i < 6; i++) { // ~2.1s
        const { data: reply, error: repErr } = await supa
          .from('messages')
          .select('content, created_at')
          .eq('conversation_id', id)
          .eq('role', 'assistant')
          .gt('created_at', userRow.created_at)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (repErr) throw repErr;
        if (reply?.content) {
          try { console.log('[supa] dedup hit', { id, clientMsgId, ms: Date.now() - startedAt }); } catch {}
          return res.status(200).json({ success: true, route: 'supa:messages', data: { content: reply.content }, dedup: true });
        }
        await sleep(350);
      }
      return res.status(202).json({ success: true, route: 'supa:messages', pending: true });
    }

    // 3) Request ganador: construir prompts + historial recortado
    // HOTFIX: prompts inline (evita ENOENT de fs en producción)
    const P = {
      style:  process.env.PROMPT_STYLE  || 'Eres Alma, una asistente clara, amable y accionable.',
      dialog: process.env.PROMPT_DIALOG || 'Mantén el contexto; pide datos faltantes sin ambigüedad.',
      output: process.env.PROMPT_OUTPUT || 'Responde con pasos y ejemplos breves. Evita jerga innecesaria y usa bloques de código cuando aplique.',
      fewshot: process.env.PROMPT_FEWSHOT || null,
    };
    const fullHistory = await supaStore.getHistory(id, 60);

    const MAX_CHARS = 16000;
    const sys = [{ role: 'system', content: `${P.style}\n\n${P.dialog}\n\n${P.output}` }];
    const few = P.fewshot ? [{ role: 'system', content: P.fewshot }] : [];

    let used = 0;
    const body = [];
    for (let i = fullHistory.length - 1; i >= 0; i--) {
      const m = fullHistory[i];
      const size = (m.content?.length || 0);
      if (used + size > MAX_CHARS && body.length > 0) break;
      used += size;
      body.unshift({ role: m.role, content: m.content });
    }
    const messages = [...sys, ...few, ...body];

    // 4) Inferencia con retry
    const t0 = Date.now();
    const { text } = await callWithRetry(() => callModel({ messages }), 3);
    const inferMs = Date.now() - t0;
    try { console.log('[supa] infer', { messages: messages.length, ms: inferMs }); } catch {}

    // 5) Guardar respuesta assistant una sola vez
    await supaStore.appendMessage(id, 'assistant', text);

    // 6) Actualizar título automáticamente si está genérico
    try {
      const { data: convMeta } = await supa
        .from('conversations')
        .select('title')
        .eq('id', id)
        .single();
      const currentTitle = convMeta?.title || '';
      const isGeneric = !currentTitle || /^\s*Nueva conversación\s*$/i.test(currentTitle);
      if (isGeneric) {
        const { text: title } = await callModel({
          messages: [
            { role: 'system', content: 'Resume el tema de la conversación en máximo 6 palabras, sin comillas.' },
            { role: 'user', content }
          ]
        });
        const newTitle = (title || '').trim().slice(0, 60);
        if (newTitle) {
          await supa.from('conversations').update({ title: newTitle }).eq('id', id);
        }
      }
    } catch (e) {
      try { console.warn('[supa] title auto-update skipped:', e?.message || e); } catch {}
    }

    return res.status(201).json({ success: true, route: 'supa:messages', data: { content: text } });
  } catch (e) {
    console.error('[supa] send message error:', e);
    res.setHeader('x-hit', 'supa:messages');
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
