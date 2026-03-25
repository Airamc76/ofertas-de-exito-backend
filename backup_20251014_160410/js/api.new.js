// API base URL
const API_BASE = import.meta.env.VITE_API_BASE || 'https://ofertas-de-exito-backend.vercel.app';

// Chat API methods
export const chatApi = {
  // Create a new conversation
  async createConversation() {
    return apiRequest('/api/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ title: 'Nueva conversación' })
    });
  },

  // Send a message
  async sendMessage(conversationId, content) {
    if (!conversationId || !content) {
      throw new Error('Missing conversation ID or message content');
    }
    return apiRequest(`/api/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ role: 'user', content })
    });
  },

  // Get messages
  async getMessages(conversationId) {
    if (!conversationId) {
      throw new Error('Missing conversation ID');
    }
    return apiRequest(`/api/chat/conversations/${conversationId}/messages`);
  }
};

// Helper function for API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-client-id': getClientId(),
    ...options.headers
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Get or create client ID
function getClientId() {
  let clientId = localStorage.getItem('clientId');
  if (!clientId) {
    clientId = 'anon-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('clientId', clientId);
  }
  return clientId;
}
