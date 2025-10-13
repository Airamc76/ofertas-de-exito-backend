const { v4: uuidv4 } = require('uuid');
const { 
  allowCors, 
  readJson, 
  getClientConversations,
  saveConversation
} = require('../_utils');

module.exports = allowCors(async (req, res) => {
  const clientId = req.headers['x-client-id'];
  
  if (!clientId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Se requiere el encabezado x-client-id' 
    });
  }

  try {
    // Obtener todas las conversaciones del cliente
    if (req.method === 'GET') {
      const conversations = getClientConversations(clientId)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      
      return res.json({
        success: true,
        data: conversations
      });
    }

    // Crear una nueva conversación
    if (req.method === 'POST') {
      const body = await readJson(req);
      const title = body?.title?.trim() || 'Nueva conversación';
      
      const newConversation = {
        id: `conv_${uuidv4()}`,
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0
      };

      // Guardar la nueva conversación
      const savedConv = saveConversation(clientId, newConversation);
      
      return res.status(201).json({
        success: true,
        data: savedConv
      });
    }

    // Método no permitido
    return res.status(405).json({
      success: false,
      error: 'Método no permitido'
    });
    
  } catch (error) {
    console.error('Error en el manejador de conversaciones:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
