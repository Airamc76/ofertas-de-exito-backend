// API base URL - will use current host if not defined
const BASE_URL = 'https://ofertas-de-exito-backend.vercel.app';

// Obtener el ID del cliente desde localStorage
function getClientId() {
  try {
    let cid = localStorage.getItem('clientId');
    if (!cid) {
      cid = 'user-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('clientId', cid);
    }
    return cid;
  } catch (e) {
    console.warn('No se pudo acceder al localStorage', e);
    return 'temp-' + Math.random().toString(36).substr(2, 9);
  }
}

// Helper function to get headers with client ID
function getHeaders() {
  return { 
    'Content-Type': 'application/json', 
    'x-client-id': getClientId() 
  };
}

// Create a new conversation
export async function createConversation(title = 'Nueva conversación') {
  const response = await fetch(`${BASE_URL}/api/chat/conversations`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ title })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error creating conversation: ${error}`);
  }
  return response.json();
}

// List all conversations
export async function listConversations() {
  const response = await fetch(`${BASE_URL}/api/chat/conversations`, {
    headers: getHeaders()
  });
  if (!response.ok) {
    throw new Error('Failed to fetch conversations');
  }
  return response.json();
}

// Add a message to a conversation
export async function addMessage(conversationId, role, content, metadata = {}) {
  const response = await fetch(`${BASE_URL}/api/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ role, content, metadata })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error adding message: ${error}`);
  }
  return response.json();
}

// Get messages from a conversation
export async function getMessages(conversationId) {
  const response = await fetch(`${BASE_URL}/api/chat/conversations/${conversationId}/messages`, {
    headers: getHeaders()
  });
  if (!response.ok) {
    throw new Error('Failed to fetch messages');
  }
  return response.json();
}

// Delete a conversation
export async function deleteConversation(conversationId) {
  const response = await fetch(`${BASE_URL}/api/chat/conversations/${conversationId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error deleting conversation: ${error}`);
  }
  return response.json();
}
