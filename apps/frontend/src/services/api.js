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
  async sendMessage(id, content, onChunk) {
    const res = await fetch(`${API_BASE}/conversations/${id}/messages?stream=true`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content, client_msg_id: 'msg_' + Date.now() })
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to send message');
    }

    if (onChunk) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) onChunk(parsed.text);
            } catch (e) {
              console.warn('Error parsing SSE chunk', e);
            }
          }
        }
      }
      return { success: true };
    }

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
