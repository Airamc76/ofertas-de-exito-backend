// In production (Netlify), VITE_API_URL points to the Render backend.
// In dev, Vite proxy handles /api/* → localhost:3000
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/chat`
  : '/api/chat';

function getOrCreateClientId() {
  let id = localStorage.getItem('alma_client_id');
  if (!id) {
    id = 'cli_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('alma_client_id', id);
  }
  return id;
}

const headers = {
  'Content-Type': 'application/json',
  'x-client-id': getOrCreateClientId()
};

export const api = {
  async listConversations() {
    const res = await fetch(`${API_BASE}/conversations`, { headers });
    return res.json();
  },
  async createConversation(title = 'Nueva Oferta') {
    const res = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title })
    });
    return res.json();
  },
  async getHistory(id) {
    const res = await fetch(`${API_BASE}/conversations/${id}/history`, { headers });
    return res.json();
  },
  async sendMessage(id, content) {
    const res = await fetch(`${API_BASE}/conversations/${id}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content, client_msg_id: 'msg_' + Date.now() })
    });
    return res.json();
  },
  async updateTitle(id, title) {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ title })
    });
    return res.json();
  },
  async deleteConversation(id) {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      method: 'DELETE',
      headers
    });
    return res.json();
  }
};
