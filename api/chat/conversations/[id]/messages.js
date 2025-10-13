// api/chat/conversations/[id]/messages.js
import { 
  allowCors, 
  readJson, 
  getClientConversations,
  getMessages,
  saveMessage,
  saveConversation
} from '../../../_utils.js';

// Configuración del modelo de IA
const MODEL = process.env.MODEL_NAME || 'gpt-4o-mini';

/**
 * Función para obtener una respuesta del modelo de IA (OpenAI o demo)
 */
async function getAIResponse(prompt) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  // Modo demo: Si no hay clave de API, devolver una respuesta de prueba
  if (!openaiApiKey) {
    return `Esto es una respuesta de prueba para: ${prompt}`;
  }

  try {
    // SDK v4 de OpenAI
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: openaiApiKey });

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'Eres un asistente útil y conciso.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
    });

    return completion.choices?.[0]?.message?.content?.trim() || 'No pude generar una respuesta.';

  } catch (error) {
    console.error('Error al llamar a OpenAI:', error?.response?.data || error?.message || error);
    return 'Lo siento, hubo un error al generar la respuesta.';
  }
}

// Manejador principal
export default allowCors(async (req, res) => {
  const clientId = req.headers['x-client-id'];
  const conversationId = req.query.id;
  
  // Validaciones básicas
  if (!clientId) {
    return res.status(400).json({
      success: false,
      error: 'Se requiere el encabezado x-client-id'
    });
  }
  
  if (!conversationId) {
    return res.status(400).json({
      success: false,
      error: 'Se requiere el ID de la conversación'
    });
  }

  try {
    // En serverless (Vercel) no hay garantía de estado en memoria entre invocaciones.
    // Si la conversación no existe en esta instancia, la creamos de forma mínima para continuar.
    const conversations = getClientConversations(clientId);
    let conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) {
      conversation = {
        id: conversationId,
        title: 'Conversación',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0
      };
      saveConversation(clientId, conversation);
    }

    // Manejar GET: Obtener mensajes de la conversación
    if (req.method === 'GET') {
      const messages = getMessages(conversationId).map(m => ({ ...m, conversationId }));
      
      // Responder en el formato ideal requerido por el frontend: data como lista
      return res.json({
        success: true,
        data: messages
      });
    }
    
    // Manejar POST: Enviar un nuevo mensaje
    if (req.method === 'POST') {
      const body = await readJson(req);
      const content = body?.content?.trim();
      
      if (!content) {
        return res.status(400).json({
          success: false,
          error: 'El contenido del mensaje es requerido'
        });
      }
      
      // Crear y guardar el mensaje del usuario
      const userMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content,
        createdAt: new Date().toISOString()
      };
      
      saveMessage(conversationId, userMessage);
      
      // Actualizar la última actualización de la conversación
      conversation.updatedAt = new Date().toISOString();
      saveConversation(clientId, conversation);
      
      // Obtener respuesta del asistente
      const assistantContent = await getAIResponse(content);
      
      // Crear y guardar la respuesta del asistente
      const assistantMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: assistantContent,
        createdAt: new Date().toISOString()
      };
      
      saveMessage(conversationId, assistantMessage);
      
      // Devolver solo el mensaje del asistente como respuesta
      return res.status(201).json({
        success: true,
        data: assistantMessage
      });
    }
    
    // Método no permitido
    return res.status(405).json({
      success: false,
      error: 'Método no permitido'
    });
    
  } catch (error) {
    console.error('Error en el manejador de mensajes:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});
