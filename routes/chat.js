// routes/chat.js - Rutas de chat sin login (scoping por x-client-id)
// ESM module
import { Router } from 'express';
import { randomUUID } from 'crypto';

const router = Router();

// Stores en memoria por instancia
const convStore = globalThis.__conv || new Map(); // clientId -> [convs]
const msgStore  = globalThis.__msg  || new Map(); // convId -> [msgs]
if (!globalThis.__conv) globalThis.__conv = convStore;
if (!globalThis.__msg)  globalThis.__msg  = msgStore;

function requireClient(req, res, next) {
  const cid = req.header('x-client-id');
  if (!cid) return res.status(400).json({ error: 'missing x-client-id' });
  req.clientId = cid; next();
}

// Utilidad para IDs (uuid v4 compatible)
function uuidv4() {
  try { return randomUUID(); } catch { return `conv_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
}

// Crear conversación
router.post('/conversations', requireClient, (req, res) => {
  const title = req.body?.title || 'Nueva conversación';
  const conv = { id: uuidv4(), title, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const list = convStore.get(req.clientId) || [];
  convStore.set(req.clientId, [conv, ...list]);
  res.status(201).json(conv);
});

// Listar conversaciones
router.get('/conversations', requireClient, (req, res) => {
  const list = convStore.get(req.clientId) || [];
  list.sort((a,b)=> new Date(b.updatedAt)-new Date(a.updatedAt));
  res.json(list);
});

// Crear mensaje
router.post('/conversations/:id/messages', requireClient, (req, res) => {
  const { id } = req.params;
  const list = convStore.get(req.clientId) || [];
  const conv = list.find(c => c.id === id);
  if (!conv) return res.status(404).json({ error: 'conversation not found for this client' });

  const { role, content, metadata } = req.body || {};
  if (!role || !content) return res.status(400).json({ error: 'role and content required' });

  const arr = msgStore.get(id) || [];
  const msg = { role, content, metadata: metadata ?? {}, createdAt: new Date().toISOString() };
  arr.push(msg);
  msgStore.set(id, arr);

  conv.updatedAt = new Date().toISOString();
  convStore.set(req.clientId, [conv, ...list.filter(c => c.id !== id)]);

  res.status(201).json(msg);
});

// Listar mensajes
router.get('/conversations/:id/messages', requireClient, (req, res) => {
  const { id } = req.params;
  const list = convStore.get(req.clientId) || [];
  const conv = list.find(c => c.id === id);
  if (!conv) return res.status(404).json({ error: 'conversation not found for this client' });

  const messages = msgStore.get(id) || [];
  res.json({ session: { id: conv.id, title: conv.title }, messages });
});

// Eliminar conversación
router.delete('/conversations/:id', requireClient, (req, res) => {
  const { id } = req.params;
  const list = convStore.get(req.clientId) || [];
  const exists = list.some(c => c.id === id);
  if (!exists) return res.status(404).end();
  convStore.set(req.clientId, list.filter(c => c.id !== id));
  msgStore.delete(id);
  res.status(204).end();
});

export default router;
