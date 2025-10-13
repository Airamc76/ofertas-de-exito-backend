// api/chat/conversations/[id]/messages.js
// Serverless: enviar/listar mensajes sin login (scoped por x-client-id)

function allowCors(handler) {
  return async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, x-client-id, Authorization');
    if (req.method==='OPTIONS') return res.status(204).end();
    try { return await handler(req,res); }
    catch (e) { console.error(e); return res.status(500).json({ error:'internal_error' }); }
  };
}

async function readBody(req){
  const b = req.body;
  if (b!=null) {
    if (typeof b==='object' && !Buffer.isBuffer(b) && !(b instanceof Uint8Array)) return b;
    if (typeof b==='string') { try { return JSON.parse(b); } catch { return {}; } }
    if (Buffer.isBuffer(b) || b instanceof Uint8Array) {
      const s = Buffer.from(b).toString('utf8'); try { return JSON.parse(s); } catch { return {}; }
    }
  }
  const chunks=[]; for await (const ch of req) chunks.push(ch);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

// Stores globales por instancia (no se reinician en caliente)
const convStore = global.__conv || new Map();
if (!global.__conv) global.__conv = convStore;
const msgStore  = global.__msg  || new Map();
if (!global.__msg)  global.__msg  = msgStore;

module.exports = allowCors(async (req, res) => {
  const cid = req.headers['x-client-id'];
  if (!cid) return res.status(400).json({ error:'missing x-client-id' });

  const convId = req.query.id;
  const list = convStore.get(cid) || [];
  const conv = list.find(c => c.id === convId);
  if (!conv) return res.status(404).json({ error:'conversation not found for this client' });

  if (req.method === 'GET') {
    const messages = msgStore.get(convId) || [];
    return res.json({ session: { id: conv.id, title: conv.title }, messages });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const content = body?.content ?? body?.message ?? body?.text ?? '';
    const role    = body?.role ?? 'user';
    if (!content) return res.status(400).json({ error:'content required' });

    const arr = msgStore.get(convId) || [];
    const msg = { role, content, metadata: body?.metadata ?? {}, createdAt: new Date().toISOString() };
    arr.push(msg);
    msgStore.set(convId, arr);

    conv.updatedAt = new Date().toISOString();
    convStore.set(cid, [conv, ...list.filter(c => c.id !== convId)]);

    return res.status(201).json(msg);
  }

  return res.status(405).end();
});
