// routes/chat-conversations.js
const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const router = Router();

// stores en memoria (global para que no se reinicien en caliente)
const convStore = global.__conv || new Map();
if (!global.__conv) global.__conv = convStore;

// helper para tomar x-client-id
function requireClient(req, res, next) {
  const cid = req.header('x-client-id');
  if (!cid) return res.status(400).json({ error: 'missing x-client-id' });
  req.clientId = cid; next();
}

// GET /api/chat/conversations  -> lista conversaciones
router.get('/conversations', requireClient, (req, res) => {
  const list = convStore.get(req.clientId) || [];
  list.sort((a,b)=> new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json(list);
});

// POST /api/chat/conversations -> crea conversación
router.post('/conversations', requireClient, (req, res) => {
  // tolerante: si por alguna razón el body vino string, intenta parsear
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const title = body.title || 'Nueva conversación';
  const conv = { id: uuidv4(), title, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const prev = convStore.get(req.clientId) || [];
  convStore.set(req.clientId, [conv, ...prev]);
  res.status(201).json(conv);
});

module.exports = router;
