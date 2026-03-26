const express = require('express');
const router = express.Router();
const { supabase } = require('../services/db');
const { generateChatCompletion, generateChatStream } = require('../services/ai');

// Simple in-memory cache for client verification to avoid DB hits on every request
const clientCache = new Set();

function genId(prefix = 'conv_') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
}

// Middleware para verificar y registrar el cliente
router.use(async (req, res, next) => {
  const clientId = req.headers['x-client-id'];
  if (!clientId) {
    return res.status(401).json({ error: 'x-client-id header is required' });
  }

  // Use cache to avoid DB hit
  if (!clientCache.has(clientId)) {
    const { error } = await supabase
      .from('clients')
      .upsert({ id: clientId }, { onConflict: 'id' });
    
    if (error) {
      console.error('Error upserting client:', error);
      return res.status(500).json({ error: 'Database error registering client' });
    }
    clientCache.add(clientId);
  }

  req.clientId = clientId;
  next();
});

// Obtener todas las conversaciones (con paginación básica)
router.get('/conversations', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('client_id', req.clientId)
    .order('created_at', { ascending: false })
    .limit(limit);

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

// Obtener historial de una conversación (últimos 50 mensajes por defecto)
router.get('/conversations/:id/history', async (req, res) => {
  const conversationId = req.params.id;
  const limit = parseInt(req.query.limit) || 50;
  
  // Verify ownership (optional check, but for security)
  const { data: conv } = await supabase.from('conversations').select('client_id').eq('id', conversationId).single();
  if (!conv || conv.client_id !== req.clientId) return res.status(403).json({ error: 'Access denied' });

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
});

// Enviar un mensaje con STREAMING
router.post('/conversations/:id/messages', async (req, res) => {
  const conversationId = req.params.id;
  const content = req.body.content;
  const client_msg_id = req.body.client_msg_id || req.body.clientMsgId;
  const useStream = req.query.stream === 'true' || req.headers['accept'] === 'text/event-stream';

  if (!content) return res.status(400).json({ error: 'Content is required' });
  if (!client_msg_id) return res.status(400).json({ error: 'client_msg_id or clientMsgId is required' });

  // Verify ownership
  const { data: conv } = await supabase.from('conversations').select('*').eq('id', conversationId).single();
  if (!conv || conv.client_id !== req.clientId) return res.status(403).json({ error: 'Access denied' });

  // Autogenerar titulo si es necesario
  if (conv.title === 'Nueva Oferta' || conv.title === 'Nueva conversacion' || conv.title === 'Nueva conversación') {
    const words = content.trim().split(/\s+/).slice(0, 6).join(' ');
    const newTitle = words.length > 3 ? words : content.slice(0, 40);
    supabase.from('conversations').update({ title: newTitle }).eq('id', conversationId).then(); // Async fire and forget
  }

  // 1. Guardar mensaje del usuario
  const userMsg = { conversation_id: conversationId, role: 'user', content, client_msg_id };
  const { error: insertError } = await supabase.from('messages').insert(userMsg);
  if (insertError) return res.status(500).json({ error: insertError.message });

  // 2. Obtener solo los últimos 20 mensajes para contexto (Scalability!)
  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(20);
  
  const aiHistory = (history || []).reverse();

  if (useStream) {
    // SSE Setup
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const stream = await generateChatStream(aiHistory);
      let fullContent = '';

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) {
          fullContent += text;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      // Guardar respuesta final en DB
      const assistantMsg = {
        conversation_id: conversationId,
        role: 'assistant',
        content: fullContent,
        client_msg_id: `resp_${client_msg_id}_${Date.now()}`
      };
      await supabase.from('messages').insert(assistantMsg);

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      console.error('Streaming error:', err);
      res.write(`data: ${JSON.stringify({ error: 'Error generando respuesta' })}\n\n`);
      res.end();
    }
  } else {
    // Legacy non-streaming fallack
    const aiResponse = await generateChatCompletion(aiHistory);
    const assistantMsg = {
      conversation_id: conversationId,
      role: 'assistant',
      content: aiResponse,
      client_msg_id: `resp_${client_msg_id}_${Date.now()}`
    };

    const { data: savedMsg, error: aiSavedError } = await supabase
      .from('messages')
      .insert(assistantMsg)
      .select()
      .single();

    if (aiSavedError) return res.status(500).json({ error: aiSavedError.message });
    res.json({ data: savedMsg });
  }
});

// Actualizar título de la conversación
router.patch('/conversations/:id', async (req, res) => {
  const conversationId = req.params.id;
  const { title } = req.body;

  if (!title) return res.status(400).json({ error: 'Title is required' });

  // Verify ownership
  const { data: conv } = await supabase.from('conversations').select('client_id').eq('id', conversationId).single();
  if (!conv || conv.client_id !== req.clientId) return res.status(403).json({ error: 'Access denied' });

  const { data, error } = await supabase
    .from('conversations')
    .update({ title })
    .eq('id', conversationId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ data });
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
