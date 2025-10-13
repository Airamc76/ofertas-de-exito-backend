// api/chat/conversations.js
// Serverless: crear/listar conversaciones sin login (scoped por x-client-id)
const { v4: uuidv4 } = require('uuid');

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

const convStore = global.__conv || new Map();
if (!global.__conv) global.__conv = convStore;

module.exports = allowCors(async (req, res) => {
  const cid = req.headers['x-client-id'];
  if (!cid) return res.status(400).json({ error:'missing x-client-id' });

  if (req.method === 'GET') {
    const list = (convStore.get(cid) || []).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
    return res.json(list);
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const title = body?.title || 'Nueva conversación';
    const conv = { id: uuidv4(), title, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const prev = convStore.get(cid) || [];
    convStore.set(cid, [conv, ...prev]);
    return res.status(201).json(conv);
  }

  return res.status(405).end();
});
