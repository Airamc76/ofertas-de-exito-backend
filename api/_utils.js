// Almacenamiento en memoria global
const G = globalThis;

// Inicializar los almacenes si no existen
if (!G.__convStore) G.__convStore = new Map(); // clientId -> [conversaciones]
if (!G.__msgStore) G.__msgStore = new Map();   // convId -> [mensajes]

// Función para manejar CORS
exports.allowCors = (handler) => async (req, res) => {
  try {
    const origin = req.headers?.origin || '';
    let host = '';
    try { if (origin) host = new URL(origin).hostname || ''; } catch {}
    const isLocal = origin === 'http://localhost:3000';
    const isVercel = /\.vercel\.app$/i.test(host);
    const allowOrigin = (isLocal || isVercel) ? origin : '*';

    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-client-id');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    
    return await handler(req, res);
  } catch (e) {
    console.error('Error en el manejador:', e);
    return res.status(500).json({ error: 'internal_error', message: e.message });
  }
};

// Función para leer el cuerpo JSON de la petición
exports.readJson = async (req) => {
  try {
    if (req.body) {
      if (typeof req.body === 'string') {
        return JSON.parse(req.body);
      } else if (Buffer.isBuffer(req.body) || req.body instanceof Uint8Array) {
        return JSON.parse(req.body.toString('utf8'));
      } else if (typeof req.body === 'object') {
        return { ...req.body };
      }
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    
    const body = Buffer.concat(chunks).toString('utf8');
    return body ? JSON.parse(body) : {};
  } catch (error) {
    console.error('Error al leer JSON:', error);
    return {};
  }
};

// Getters para los almacenes
exports.getConvStore = () => G.__convStore;
exports.getMsgStore = () => G.__msgStore;

// Helper para obtener conversaciones de un cliente
exports.getClientConversations = (clientId) => {
  return G.__convStore.get(clientId) || [];
};

// Helper para guardar una conversación
exports.saveConversation = (clientId, conversation) => {
  const conversations = G.__convStore.get(clientId) || [];
  const existingIndex = conversations.findIndex(c => c.id === conversation.id);
  
  if (existingIndex >= 0) {
    conversations[existingIndex] = conversation;
  } else {
    conversations.push(conversation);
  }
  
  G.__convStore.set(clientId, conversations);
  return conversation;
};

// Helper para obtener mensajes de una conversación
exports.getMessages = (conversationId) => {
  return G.__msgStore.get(conversationId) || [];
};

// Helper para guardar un mensaje
exports.saveMessage = (conversationId, message) => {
  const messages = G.__msgStore.get(conversationId) || [];
  messages.push(message);
  G.__msgStore.set(conversationId, messages);
  return message;
};

// Inicializar con datos de prueba si estamos en desarrollo
if (process.env.NODE_ENV !== 'production' && G.__convStore.size === 0) {
  const testClientId = 'demo-1';
  const testConvId = 'test-conv-1';
  
  G.__convStore.set(testClientId, [{
    id: testConvId,
    title: 'Conversación de prueba',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }]);
  
  G.__msgStore.set(testConvId, [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Hola, esto es una prueba',
      createdAt: new Date().toISOString()
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: '¡Hola! Soy un asistente de prueba.',
      createdAt: new Date().toISOString()
    }
  ]);
}
