// api/chat/conversations.js
// Serverless endpoint para crear/listar conversaciones por x-client-id

import allowCors from '../../lib/allowCors.js';
import { conversationListStore } from '../../src/store/memory.js';

function genId() {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default allowCors(async function handler(req, res) {
  const clientId = req.headers['x-client-id'];
  if (!clientId) return res.status(400).json({ error: 'missing x-client-id' });

  // Body seguro (Vercel puede entregarlo como string)
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
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
