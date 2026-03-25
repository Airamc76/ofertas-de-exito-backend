// Elementos del DOM
const elements = {
  appContainer: document.getElementById('app'),
  sidebar: document.querySelector('.sidebar'),
  menuToggle: document.getElementById('menuToggle'),
  newChatBtn: document.getElementById('newChatBtn'),
  conversationsList: document.getElementById('conversationsList'),
  chatContainer: document.querySelector('.chat-container'),
  messagesContainer: document.querySelector('.messages'),
  messageInput: document.getElementById('messageInput'),
  sendButton: document.getElementById('sendButton'),
  chatTitle: document.querySelector('.chat-title'),
  errorContainer: document.getElementById('errorContainer') || createErrorContainer()
};

// Estado de la aplicación
const state = {
  currentConversationId: null,
  conversations: [],
  isTyping: false,
  isSending: false,
  error: null
};

// Constantes
const MAX_MESSAGE_LENGTH = 2000;

// Crear contenedor de errores si no existe
function createErrorContainer() {
  const container = document.createElement('div');
  container.id = 'errorContainer';
  container.className = 'error-container';
  document.body.appendChild(container);
  return container;
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Inicializando aplicación...');
  
  // Cargar conversaciones
  loadConversations();
  
  // Configurar event listeners
  setupEventListeners();
  
  // Mostrar la aplicación
  showApp();
  
  // Aplicar estilos para el contenedor de errores
  applyErrorStyles();
});

function applyErrorStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .error-container {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background-color: #f44336;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      z-index: 1000;
      transition: transform 0.3s ease-in-out;
      max-width: 90%;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    
    .error-container.show {
      transform: translateX(-50%) translateY(0);
    }
  `;
  document.head.appendChild(style);
}

// Configurar event listeners
function setupEventListeners() {
  // Enviar mensaje al hacer clic en el botón
  elements.sendButton.addEventListener('click', sendMessage);
  
  // Enviar mensaje al presionar Enter
  elements.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Validar longitud del mensaje en tiempo real
  elements.messageInput.addEventListener('input', (e) => {
    if (e.target.value.length > MAX_MESSAGE_LENGTH) {
      showError(`El mensaje no puede superar los ${MAX_MESSAGE_LENGTH} caracteres`);
    } else {
      clearError();
    }
  });
}

// Mostrar mensaje de error
function showError(message) {
  if (!elements.errorContainer) return;
  
  elements.errorContainer.textContent = message;
  elements.errorContainer.classList.add('show');
  
  // Ocultar después de 5 segundos
  setTimeout(clearError, 5000);
}

// Limpiar mensaje de error
function clearError() {
  if (elements.errorContainer) {
    elements.errorContainer.classList.remove('show');
  }
}

// Función para enviar mensaje actualizada
async function sendMessage() {
  const message = elements.messageInput.value.trim();
  
  // Validaciones
  if (!message) {
    showError('Por favor escribe un mensaje');
    return;
  }
  
  if (message.length > MAX_MESSAGE_LENGTH) {
    showError(`El mensaje no puede superar los ${MAX_MESSAGE_LENGTH} caracteres`);
    return;
  }
  
  if (state.isSending || state.isTyping) {
    return;
  }
  
  state.isSending = true;
  showTypingIndicator();
  
  try {
    // Obtener o crear conversación
    let conversation = state.conversations.find(c => c.id === state.currentConversationId);
    if (!conversation) {
      const newConv = await chatApi.createConversation();
      conversation = {
        id: newConv.id,
        title: newConv.title || 'Nueva conversación',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      state.conversations.push(conversation);
      state.currentConversationId = conversation.id;
      renderConversations();
    }

    // Crear y mostrar mensaje del usuario
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    
    conversation.messages.push(userMessage);
    conversation.updatedAt = new Date().toISOString();
    elements.messageInput.value = '';
    appendMessage(userMessage.role, userMessage.content);
    
    // Enviar mensaje al servidor
    const response = await chatApi.sendMessage(conversation.id, message);
    
    // Mostrar respuesta del asistente
    const botResponse = {
      role: 'assistant',
      content: response.content,
      timestamp: new Date().toISOString()
    };
    
    conversation.messages.push(botResponse);
    conversation.updatedAt = new Date().toISOString();
    appendMessage(botResponse.role, botResponse.content);
    
    // Actualizar UI
    renderConversations();
    scrollToBottom();
    
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    showError('Error al enviar el mensaje. Intenta de nuevo.');
  } finally {
    state.isSending = false;
    hideTypingIndicator();
  }
}

// Hacer scroll al final del chat
function scrollToBottom() {
  const messagesContainer = elements.messagesContainer;
  // Usar requestAnimationFrame para un scroll suave
  requestAnimationFrame(() => {
    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior: 'smooth'
    });
  });
}

// Funciones existentes que se mantienen sin cambios
function showApp() {
  if (elements.appContainer) {
    elements.appContainer.style.display = 'flex';
  }
}

function showTypingIndicator() {
  state.isTyping = true;
  // Implementar lógica del indicador de escritura
}

function hideTypingIndicator() {
  state.isTyping = false;
  // Implementar lógica para ocultar indicador
}

function appendMessage(role, content) {
  // Implementar lógica para agregar mensaje al DOM
}

function renderConversations() {
  // Implementar lógica para renderizar conversaciones
}

function loadConversations() {
  // Implementar lógica para cargar conversaciones
}

// Hacer las funciones accesibles globalmente para depuración
window.chatApp = {
  state,
  elements,
  sendMessage,
  scrollToBottom
};
