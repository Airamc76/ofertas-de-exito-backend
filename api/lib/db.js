// api/lib/db.js
import { v4 as uuidv4 } from 'uuid';

// Almacenamiento en memoria
const memoryStore = {
  conversations: new Map(), // Almacena conversaciones por ID de sesión
  messages: new Map()       // Almacena mensajes por ID de conversación
};

// Generar un ID de sesión único
export const generateSessionId = () => `sess_${uuidv4()}`;

// Obtener conversaciones de una sesión
export const getConversations = (sessionId) => {
  return Array.from(memoryStore.conversations.get(sessionId)?.values() || []);
};

// Crear una nueva conversación
export const createConversation = (sessionId, title = 'Nueva conversación') => {
  const conversationId = `conv_${uuidv4()}`;
  const now = new Date().toISOString();
  
  const conversation = {
    id: conversationId,
    title,
    createdAt: now,
    updatedAt: now,
    messageCount: 0
  };
  
  if (!memoryStore.conversations.has(sessionId)) {
    memoryStore.conversations.set(sessionId, new Map());
  }
  
  memoryStore.conversations.get(sessionId).set(conversationId, conversation);
  memoryStore.messages.set(conversationId, []);
  
  return conversation;
};

// Obtener mensajes de una conversación
export const getMessages = (conversationId) => {
  return memoryStore.messages.get(conversationId) || [];
};

// Agregar un mensaje a una conversación
export const addMessage = (conversationId, message) => {
  if (!memoryStore.messages.has(conversationId)) {
    memoryStore.messages.set(conversationId, []);
  }
  
  const messages = memoryStore.messages.get(conversationId);
  const newMessage = {
    id: `msg_${Date.now()}`,
    ...message,
    timestamp: new Date().toISOString()
  };
  
  messages.push(newMessage);
  
  // Actualizar la fecha de actualización de la conversación
  for (const [sessionId, conversations] of memoryStore.conversations.entries()) {
    if (conversations.has(conversationId)) {
      const conv = conversations.get(conversationId);
      conv.updatedAt = newMessage.timestamp;
      conv.messageCount = messages.length;
      break;
    }
  }
  
  return newMessage;
};

// Eliminar una conversación
export const deleteConversation = (sessionId, conversationId) => {
  if (memoryStore.conversations.has(sessionId)) {
    memoryStore.conversations.get(sessionId).delete(conversationId);
  }
  memoryStore.messages.delete(conversationId);
  return { success: true };
};

// Actualizar el título de una conversación
export const updateConversationTitle = (sessionId, conversationId, title) => {
  if (memoryStore.conversations.has(sessionId)) {
    const conv = memoryStore.conversations.get(sessionId).get(conversationId);
    if (conv) {
      conv.title = title;
      conv.updatedAt = new Date().toISOString();
      return conv;
    }
  }
  return null;
};
