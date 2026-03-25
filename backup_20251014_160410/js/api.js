// API base URL - can be overridden by Vite environment variable
const API_BASE = 'https://ofertas-de-exito-backend.vercel.app';

/**
 * Chat API service
 * Handles all communication with the chat backend
 */
export const chatApi = {
  /**
   * Create a new conversation
   * @returns {Promise<{id: string, title: string}>}
   */
  async createConversation() {
    try {
      return await apiRequest('/api/chat/conversations', {
        method: 'POST',
        body: JSON.stringify({ title: 'Nueva conversación' })
      });
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw new Error('No se pudo crear la conversación. Por favor, inténtalo de nuevo.');
    }
  },

  /**
   * Send a message to a conversation
   * @param {string} conversationId - The ID of the conversation
   * @param {string} content - The message content
   * @returns {Promise<{role: string, content: string}>}
   */
  async sendMessage(conversationId, content) {
    if (!conversationId) throw new Error('Se requiere el ID de la conversación');
    if (!content || typeof content !== 'string' || content.trim() === '') {
      throw new Error('El mensaje no puede estar vacío');
    }

    try {
      return await apiRequest(`/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          role: 'user',
          content: content.trim()
        })
      });
    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error('No se pudo enviar el mensaje. Por favor, inténtalo de nuevo.');
    }
  },

  /**
   * Get messages from a conversation
   * @param {string} conversationId - The ID of the conversation
   * @returns {Promise<Array<{role: string, content: string, timestamp: string}>>}
   */
  async getMessages(conversationId) {
    if (!conversationId) {
      throw new Error('Se requiere el ID de la conversación');
    }

    try {
      return await apiRequest(`/api/chat/conversations/${conversationId}/messages`);
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw new Error('No se pudieron cargar los mensajes. Por favor, inténtalo de nuevo.');
    }
  },

  /**
   * List all conversations
   * @returns {Promise<Array<{id: string, title: string, lastMessage: string, updatedAt: string}>>}
   */
  async listConversations() {
    try {
      return await apiRequest('/api/chat/conversations');
    } catch (error) {
      console.error('Error listing conversations:', error);
      throw new Error('No se pudieron cargar las conversaciones. Por favor, inténtalo de nuevo.');
    }
  }
};

/**
 * Generic API request helper
 * @private
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-client-id': getClientId(),
    ...options.headers
  };

  // Add auth token if available
  const token = localStorage.getItem('authToken');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
      signal: AbortSignal.timeout(30000) // 30s timeout
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      // Handle 401 Unauthorized
      if (response.status === 401) {
        // Clear auth data and reload
        localStorage.removeItem('authToken');
        window.location.href = '/login.html';
      }
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

/**
 * Get or create a client ID
 * @returns {string} Client ID
 */
function getClientId() {
  let clientId = localStorage.getItem('clientId');
  if (!clientId) {
    clientId = 'anon-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('clientId', clientId);
  }
  return clientId;
}
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
