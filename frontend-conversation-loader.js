// frontend-conversation-loader.js - Código para el frontend que carga conversaciones al iniciar
// Este código debe integrarse en tu aplicación frontend

class ConversationManager {
  constructor(apiUrl = 'https://ofertas-de-exito-backend.vercel.app') {
    this.apiUrl = apiUrl;
    this.token = localStorage.getItem('authToken');
    this.currentConversationId = null;
    this.conversations = [];
  }

  // Obtener headers con autenticación
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    };
  }

  // Cargar todas las conversaciones del usuario
  async loadConversations() {
    try {
      if (!this.token) {
        console.log('No hay token de autenticación');
        return [];
      }

      const response = await fetch(`${this.apiUrl}/api/conversations`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.conversations = data.conversations || [];
      
      console.log(`Conversaciones cargadas: ${this.conversations.length}`);
      return this.conversations;
    } catch (error) {
      console.error('Error cargando conversaciones:', error);
      return [];
    }
  }

  // Cargar mensajes de una conversación específica
  async loadConversationMessages(conversationId) {
    try {
      if (!this.token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${this.apiUrl}/api/conversations/${conversationId}/messages`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.messages || [];
    } catch (error) {
      console.error('Error cargando mensajes:', error);
      return [];
    }
  }

  // Renderizar lista de conversaciones en el sidebar
  renderConversationsList(containerId = 'conversations-list') {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Contenedor ${containerId} no encontrado`);
      return;
    }

    container.innerHTML = '';

    if (this.conversations.length === 0) {
      container.innerHTML = '<div class="no-conversations">No hay conversaciones</div>';
      return;
    }

    this.conversations.forEach(conv => {
      const convElement = document.createElement('div');
      convElement.className = 'conversation-item';
      convElement.dataset.conversationId = conv.id;
      
      convElement.innerHTML = `
        <div class="conversation-title">${conv.title}</div>
        <div class="conversation-date">${new Date(conv.updatedAt).toLocaleDateString()}</div>
      `;

      convElement.addEventListener('click', () => {
        this.selectConversation(conv.id);
      });

      container.appendChild(convElement);
    });
  }

  // Seleccionar y cargar una conversación
  async selectConversation(conversationId) {
    try {
      this.currentConversationId = conversationId;
      
      // Marcar como activa en la UI
      document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
      });
      
      const activeItem = document.querySelector(`[data-conversation-id="${conversationId}"]`);
      if (activeItem) {
        activeItem.classList.add('active');
      }

      // Cargar mensajes
      const messages = await this.loadConversationMessages(conversationId);
      this.renderMessages(messages);
      
      console.log(`Conversación ${conversationId} cargada con ${messages.length} mensajes`);
    } catch (error) {
      console.error('Error seleccionando conversación:', error);
    }
  }

  // Renderizar mensajes en el chat
  renderMessages(messages, containerId = 'chat-messages') {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Contenedor ${containerId} no encontrado`);
      return;
    }

    container.innerHTML = '';

    messages.forEach(message => {
      if (message.role === 'system') return; // No mostrar mensajes del sistema

      const messageElement = document.createElement('div');
      messageElement.className = `message ${message.role}`;
      
      messageElement.innerHTML = `
        <div class="message-content">${message.content}</div>
        ${message.timestamp ? `<div class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</div>` : ''}
      `;

      container.appendChild(messageElement);
    });

    // Scroll al final
    container.scrollTop = container.scrollHeight;
  }

  // Inicializar el sistema al cargar la página
  async initialize() {
    console.log('Inicializando sistema de conversaciones...');
    
    try {
      // Cargar conversaciones existentes
      await this.loadConversations();
      
      // Renderizar lista
      this.renderConversationsList();
      
      // Si hay conversaciones, cargar la más reciente
      if (this.conversations.length > 0) {
        await this.selectConversation(this.conversations[0].id);
      }
      
      console.log('Sistema de conversaciones inicializado correctamente');
    } catch (error) {
      console.error('Error inicializando sistema:', error);
    }
  }

  // Crear nueva conversación
  async createNewConversation() {
    const conversationId = `conv_${Date.now()}`;
    this.currentConversationId = conversationId;
    
    // Limpiar chat actual
    this.renderMessages([]);
    
    // Actualizar UI
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.classList.remove('active');
    });
    
    console.log(`Nueva conversación creada: ${conversationId}`);
    return conversationId;
  }

  // Enviar mensaje (integrar con tu función existente)
  async sendMessage(message) {
    try {
      if (!this.currentConversationId) {
        this.currentConversationId = await this.createNewConversation();
      }

      const response = await fetch(`${this.apiUrl}/api/chat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          mensaje: message,
          conversationId: this.currentConversationId
        })
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Recargar conversaciones y mensajes
      await this.loadConversations();
      this.renderConversationsList();
      
      if (this.currentConversationId) {
        const messages = await this.loadConversationMessages(this.currentConversationId);
        this.renderMessages(messages);
      }

      return data;
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      throw error;
    }
  }
}

// Uso del sistema
// 1. Crear instancia global
window.conversationManager = new ConversationManager();

// 2. Inicializar cuando la página cargue
document.addEventListener('DOMContentLoaded', () => {
  // Solo inicializar si el usuario está autenticado
  if (localStorage.getItem('authToken')) {
    window.conversationManager.initialize();
  }
});

// 3. CSS básico para las conversaciones (agregar a tu CSS)
const conversationStyles = `
.conversation-item {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  transition: background-color 0.2s;
}

.conversation-item:hover {
  background-color: #f3f4f6;
}

.conversation-item.active {
  background-color: #3b82f6;
  color: white;
}

.conversation-title {
  font-weight: 500;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-date {
  font-size: 0.75rem;
  opacity: 0.7;
}

.message {
  margin-bottom: 16px;
  padding: 12px;
  border-radius: 8px;
}

.message.user {
  background-color: #3b82f6;
  color: white;
  margin-left: 20%;
}

.message.assistant {
  background-color: #f3f4f6;
  margin-right: 20%;
}

.message-content {
  margin-bottom: 4px;
}

.message-time {
  font-size: 0.75rem;
  opacity: 0.7;
}

.no-conversations {
  padding: 20px;
  text-align: center;
  color: #6b7280;
  font-style: italic;
}
`;

// Agregar estilos al documento
const styleSheet = document.createElement('style');
styleSheet.textContent = conversationStyles;
document.head.appendChild(styleSheet);

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConversationManager;
}
