// api/chat/conversations.js
// Serverless endpoint para crear/listar conversaciones por x-client-id (Vercel)
// ESM autocontenible con CORS y parser robusto de JSON

function genId() {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
// CORS wrapper sin cookies, siempre agrega headers incluso en errores
function allowCors(handler) {
  return async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-client-id, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).end();
    try { return await handler(req, res); }
    catch (e) {
      console.error('Handler error:', e);
      return res.status(500).json({ error: 'internal_error' });
    }
  };
}

// JSON reader robusto: object | string | Buffer | Uint8Array | stream
async function getJson(req) {
  const b = req.body;
  if (b !== undefined && b !== null) {
    if (typeof b === 'object' && !Buffer.isBuffer(b) && !(b instanceof Uint8Array)) return b;
    if (typeof b === 'string') {
      try { return JSON.parse(b); } catch { throw new Error('BAD_JSON'); }
    }
    if (Buffer.isBuffer(b) || b instanceof Uint8Array) {
      const s = Buffer.from(b).toString('utf8');
      try { return JSON.parse(s); } catch { throw new Error('BAD_JSON'); }
    }
  }
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new Error('BAD_JSON'); }
}

// Memoria por instancia (global) para no reinicializar en hot reloads
const conversationListStore = globalThis.__conv || new Map();
if (!globalThis.__conv) globalThis.__conv = conversationListStore;

export default allowCors(async function handler(req, res) {
  const clientId = req.headers['x-client-id'];
  if (!clientId) return res.status(400).json({ error: 'missing x-client-id' });

  // Body robusto (serverless)
  let body = {};
  if (req.method === 'POST') {
    try { body = await getJson(req); }
    catch { return res.status(400).json({ error: 'JSON inválido en el cuerpo de la solicitud' }); }
  }

  if (req.method === 'GET') {
    const list = conversationListStore.get(clientId) || [];
    list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return res.json(list);
  }

  if (req.method === 'POST') {
    const title = body?.title || 'Nueva conversación';
    const conv = {
      id: genId(),
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const prev = conversationListStore.get(clientId) || [];
    conversationListStore.set(clientId, [conv, ...prev]);
    return res.status(201).json(conv);
  }

  return res.status(405).end();
});
