const express = require('express');
const router = express.Router();
const { supabase } = require('../services/db');
const { generateChatCompletion } = require('../services/ai');

function genId(prefix = 'conv_') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
}

// Middleware para verificar y registrar el cliente
router.use(async (req, res, next) => {
  const clientId = req.headers['x-client-id'];
  if (!clientId) {
    return res.status(401).json({ error: 'x-client-id header is required' });
  }

  // Upsert the client
  const { error } = await supabase
    .from('clients')
    .upsert({ id: clientId }, { onConflict: 'id' });
  
  if (error) {
    console.error('Error upserting client:', error);
    return res.status(500).json({ error: 'Database error registering client' });
  }

  req.clientId = clientId;
  next();
});

// Obtener todas las conversaciones
router.get('/conversations', async (req, res) => {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('client_id', req.clientId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

// Crear una conversación y mensaje inicial de Alma
router.post('/conversations', async (req, res) => {
  const title = req.body.title || 'Nueva conversación';
  const newId = genId();

  const { data: convData, error: convError } = await supabase
    .from('conversations')
    .insert({ id: newId, client_id: req.clientId, title })
    .select()
    .single();

  if (convError) return res.status(500).json({ error: convError.message });

  // Siembra el mensaje inicial de Alma
  const initMsg = {
    conversation_id: convData.id,
    role: 'assistant',
    content: '¡Hola! Soy Alma, tu IA experta en ofertas de ventas y copywriting. ¿En qué puedo ayudarte a vender hoy?',
    client_msg_id: `init_${Date.now()}`
  };

  const { error: msgError } = await supabase.from('messages').insert(initMsg);
  if (msgError) console.error("Error sembrando mensaje inicial:", msgError);

  res.json({ data: convData });
});

// Obtener historial de una conversación
router.get('/conversations/:id/history', async (req, res) => {
  const conversationId = req.params.id;
  
  // Verify ownership
  const { data: conv } = await supabase.from('conversations').select('client_id').eq('id', conversationId).single();
  if (!conv || conv.client_id !== req.clientId) return res.status(403).json({ error: 'Access denied' });

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

// Enviar un mensaje
router.post('/conversations/:id/messages', async (req, res) => {
  const conversationId = req.params.id;
  const content = req.body.content;
  const client_msg_id = req.body.client_msg_id || req.body.clientMsgId;

  if (!content) return res.status(400).json({ error: 'Content is required' });
  if (!client_msg_id) return res.status(400).json({ error: 'client_msg_id or clientMsgId is required' });

  // Verify ownership
  const { data: conv } = await supabase.from('conversations').select('*').eq('id', conversationId).single();
  if (!conv || conv.client_id !== req.clientId) return res.status(403).json({ error: 'Access denied' });

  // Autogenerar título si es "Nueva conversación" (solo en el primer mensaje de usuario real)
  if (conv.title === 'Nueva conversación') {
    const newTitle = content.split(' ').slice(0, 5).join(' ') + '...';
    await supabase.from('conversations').update({ title: newTitle }).eq('id', conversationId);
  }

  // 1. Guardar mensaje del usuario (idempotente)
  const userMsg = {
    conversation_id: conversationId,
    role: 'user',
    content,
    client_msg_id
  };

  const { error: insertError } = await supabase.from('messages').insert(userMsg);
  if (insertError) return res.status(500).json({ error: insertError.message });

  // 2. Obtener historial para la IA
  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  // 3. Llamar a AI
  const aiResponse = await generateChatCompletion(history || [{role: 'user', content}]);

  // 4. Guardar respuesta de Alma
  const assistantMsg = {
    conversation_id: conversationId,
    role: 'assistant',
    content: aiResponse,
    client_msg_id: `resp_${client_msg_id}`
  };

  const { data: savedMsg, error: aiSavedError } = await supabase
    .from('messages')
    .insert(assistantMsg)
    .select()
    .single();

  if (aiSavedError) return res.status(500).json({ error: aiSavedError.message });

  res.json({ data: savedMsg });
});

// Eliminar conversación
router.delete('/conversations/:id', async (req, res) => {
  const conversationId = req.params.id;
  
  const { data: conv } = await supabase.from('conversations').select('client_id').eq('id', conversationId).single();
  if (!conv || conv.client_id !== req.clientId) return res.status(403).json({ error: 'Access denied' });

  const { error } = await supabase.from('conversations').delete().eq('id', conversationId);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
