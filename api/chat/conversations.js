// api/chat/conversations.js
// Serverless endpoint para crear/listar conversaciones por x-client-id

import allowCors from '../../lib/allowCors.js';
import { conversationListStore } from '../../src/store/memory.js';

function genId() {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function getJson(req) {
  // Si ya viene parseado por algún middleware
  if (req.body && typeof req.body === 'object') return req.body;
  // Si viene como string desde la plataforma
  if (typeof req.body === 'string' && req.body.trim() !== '') {
    try { return JSON.parse(req.body); } catch { throw new Error('BAD_JSON'); }
  }
  // Leer el stream manualmente (Vercel puede no adjuntar req.body)
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new Error('BAD_JSON'); }
}

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
    const title = body.title || 'Nueva conversación';
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
