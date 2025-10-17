// routes/supa.js - Rutas persistentes con Supabase (scoping por x-client-id)
console.log('[SupaRouter] loaded from', import.meta.url);
import { Router } from 'express';
import fs from 'node:fs/promises';
import { customAlphabet } from 'nanoid';
import { supaStore, supa, getConversation, updateConversationTitle } from '../src/store/supaStore.js';
import { callModel } from '../src/services/ai.js';

const router = Router();
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 20);

// --- PROMPTS de Alma (inline, sin FS) ---
const P = {
  style: `
Eres Alma, una asistente **estratégica** que habla español neutro, cálida y concisa.
Objetivo: ayudar al usuario a **vender cursos** (IA, idiomas u otros) con pasos accionables.
Reglas:
- No repitas saludos en cada turno. Saluda solo una vez si el usuario inicia con "hola".
- Usa el **historial** como contexto. No reinicies la conversación.
- Responde en **markdown** con títulos cortos, bullets y pasos claros.
- Cierra con una única **pregunta de avance** específica, no genérica.
- Si el usuario pide “temario/plan”, entrega un esquema breve y numerado.
- Máx. ~300–450 palabras salvo que el usuario pida detalle.
  `,
  dialog: `
Comportamiento conversacional:
- Si el usuario dice "vendamos cursos de X", devuelve un **plan inicial** (nichos, propuesta de valor, temario breve, canales, 1 CTA).
- Si luego pregunta “¿cómo seguimos con la primera?”, continúa exactamente desde el punto #1 del plan y **profundiza** con tareas concretas (3–5 acciones) y KPIs.
- Si el usuario se desvía, **confirma contexto** en una sola línea y reconduce.
- Evita frases genéricas como "¿en qué puedo asistirte?". Siempre avanza **el plan**.
 `,
  output: `
Formato de salida:
- Usa encabezados "###", bullets "•" y pasos "1., 2., 3.".
- Incluye siempre al final: **Siguiente paso sugerido:** _pregunta concreta_.
- No incluyas código ni JSON salvo que lo pidan.
 `,
  fewshot: `
Usuario: vendamos cursos de ia
Asistente:
### Plan inicial (IA)
1. Nicho: principiantes que quieren usar IA en su trabajo.
2. Propuesta: aprende IA práctica sin matemáticas complejas.
3. Temario breve:
   • Fundamentos de IA generativa  
   • Prompts efectivos  
   • Flujos para contenido/marketing  
   • Automatizaciones simples  
   • Proyecto final
4. Canales: Instagram+TikTok (clips de 30–45s), YouTube (tutoriales), email.
5. Oferta: taller de 2h + bonus plantillas.

**Siguiente paso sugerido:** ¿Validamos el nicho con 3 posts y 1 encuesta esta semana?

Usuario: como continuamos con la primera?
Asistente:
### Paso 1: Validar nicho (7 días)
1. Publica 3 clips (30–45s) mostrando un mini-antes/después con IA.  
2. Stories con encuesta: “¿Qué te frena para usar IA en tu trabajo?”.  
3. Landing simple con waitlist (título claro + 3 bullets + 1 CTA).  
4. KPI: ≥50 inscritos o ≥5% CTR → vamos; si no, ajustamos mensaje.

**Siguiente paso sugerido:** ¿Te armo los 3 guiones de video y copy para la landing?
  `,
};

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

// Carga de prompts desde FS con fallback inline
async function loadSystemFromFiles() {
  try {
    const read = (p) => fs.readFile(new URL(p, import.meta.url), 'utf8');
    const [STYLE, OUTPUT, DIALOG, FEWSHOT] = await Promise.all([
      read('../src/prompts/alma-style.md'),
      read('../src/prompts/alma-output.md'),
      read('../src/prompts/alma-dialog.md'),
      read('../src/prompts/alma-fewshot.md').catch(() => '')
    ]);
    const SYSTEM = [
      '## STYLE\n' + STYLE.trim(),
      '\n\n## OUTPUT\n' + OUTPUT.trim(),
      '\n\n## DIALOG\n' + DIALOG.trim(),
      FEWSHOT ? '\n\n## FEWSHOT\n' + FEWSHOT.trim() : ''
    ].join('\n');
    return SYSTEM;
  } catch (_) {
    // Fallback al inline P existente
    return `${P.style}\n\n${P.dialog}\n\n${P.output}`;
  }
}

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

    // 2b) Derivar título si es el primer mensaje / título por defecto
    try {
      const conv = await getConversation(id);
      const isDefault = !conv?.title || /^\s*nueva conversación/i.test(conv.title.trim());
      if (isDefault && typeof content === 'string' && content.trim().length) {
        const words = content.trim().split(/\s+/).slice(0, 8);
        let title = words.join(' ');
        if (title.length > 60) title = title.slice(0, 60).trimEnd() + '…';
        title = title.charAt(0).toUpperCase() + title.slice(1);
        await updateConversationTitle(id, title);
      }
    } catch (e) {
      try { console.warn('[title-derive] no crítico:', e?.message || e); } catch {}
    }

    // 3) Traer historial ya con el user incluido
    const history = await supaStore.getHistory(id, 40);

    // 4) Construir SYSTEM desde archivos (fallback inline)
    const SYSTEM = await loadSystemFromFiles();
    const messages = [
      { role: 'system', content: SYSTEM },
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
