// api/chat/conversations/index.js
import utils from '../../_utils.js';
const { allowCors, readJson, getClientConversations, saveConversation } = utils;

// Obtener la lista de conversaciones
async function getConversationsHandler(req, res) {
  const clientId = req.headers['x-client-id'];
  if (!clientId) {
    return res.status(400).json({ success: false, error: 'Se requiere el encabezado x-client-id' });
  }
  const conversations = getClientConversations(clientId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return res.status(200).json({
    success: true,
    data: conversations
  });
}

// Crear una nueva conversación
async function createConversationHandler(req, res) {
  const clientId = req.headers['x-client-id'];
  if (!clientId) {
    return res.status(400).json({ success: false, error: 'Se requiere el encabezado x-client-id' });
  }
  const body = await readJson(req);
  const title = body?.title?.trim() || 'Nueva conversación';
  const conversation = {
    id: `conv_${Date.now()}`,
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 0
  };
  saveConversation(clientId, conversation);
  
  return res.status(201).json({
    success: true,
    data: conversation
  });
}

// Eliminar una conversación
async function deleteConversationHandler(req, res) {
  return res.status(405).json({ success: false, error: 'Método no permitido' });
}

// Manejador principal
export default allowCors(async (req, res) => {
  // Enrutar según el método HTTP
  switch (req.method) {
    case 'GET':
      return await getConversationsHandler(req, res);
      
    case 'POST':
      return await createConversationHandler(req, res);
      
    default:
      return res.status(405).json({
        success: false,
        error: 'Método no permitido'
      });
  }
});
