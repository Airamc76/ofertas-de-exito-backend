// Elementos del DOM
const elements = {
  appContainer: document.getElementById('app'),
  sidebar: document.querySelector('.sidebar'),
  menuToggle: document.querySelectorAll('.sidebar-toggle'),
  newChatBtn: document.getElementById('newChatBtn'),
  conversationsList: document.getElementById('conversationsList'),
  chatContainer: document.querySelector('.chat-messages'),
  messageInput: document.getElementById('userInput'),
  sendButton: document.getElementById('sendBtn'),
  chatTitle: document.querySelector('.chat-header h1')
};

// Estado de la aplicación
const state = {
  currentConversationId: null,
  conversations: [],
  isTyping: false
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Inicializando aplicación...');
  
  // Mostrar la aplicación
  showApp();
  
  // Cargar conversaciones
  loadConversations();
  
  // Configurar event listeners
  setupEventListeners();
  
  // Mostrar el contenido una vez cargado todo
  document.documentElement.style.visibility = 'visible';
});

// Configurar event listeners
function setupEventListeners() {
  // Enviar mensaje al hacer clic en el botón
  if (elements.sendButton) {
    elements.sendButton.addEventListener('click', sendMessage);
  }
  
  // Enviar mensaje al presionar Enter
  if (elements.messageInput) {
    elements.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  
  // Toggle del menú en móviles
  if (elements.menuToggle && elements.menuToggle.length > 0) {
    elements.menuToggle.forEach(button => {
      button.addEventListener('click', () => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.classList.toggle('open');
      });
    });
  }
  
  // Nuevo chat
  if (elements.newChatBtn) {
    elements.newChatBtn.addEventListener('click', createNewConversation);
  }
}

// Mostrar la aplicación
function showApp() {
  // Crear una conversación por defecto si no hay ninguna
  if (state.conversations.length === 0) {
    createNewConversation();
  } else {
    // Cargar la última conversación
    const lastConversation = state.conversations[state.conversations.length - 1];
    selectConversation(lastConversation.id);
  }
  
  // Asegurarse de que el chat esté visible
  if (elements.chatContainer) {
    elements.chatContainer.style.display = 'flex';
  }
  
  // Ocultar pantalla de introducción después de cargar
  const introScreen = document.getElementById('intro');
  if (introScreen) {
    introScreen.style.display = 'none';
  }
}

// Cargar conversaciones
async function loadConversations() {
  try {
    // Aquí iría la lógica para cargar conversaciones desde tu API o localStorage
    // Por ahora, inicializamos con un array vacío
    state.conversations = [];
    renderConversations();
  } catch (error) {
    console.error('Error al cargar conversaciones:', error);
  }
}

// Renderizar lista de conversaciones
function renderConversations() {
  if (!elements.conversationsList) return;
  
  if (state.conversations.length === 0) {
    elements.conversationsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💬</div>
        <p>No hay conversaciones aún.<br>¡Inicia tu primera conversación!</p>
      </div>
    `;
    return;
  }
  
  // Renderizar la lista de conversaciones
  let html = '';
  state.conversations.forEach(conversation => {
    const isActive = conversation.id === state.currentConversationId;
    html += `
      <div class="conversation-item ${isActive ? 'active' : ''}" data-id="${conversation.id}">
        <div class="conversation-title">${conversation.title || 'Nueva conversación'}</div>
        <div class="conversation-preview">
          ${conversation.messages.length > 0 ? conversation.messages[0].content.substring(0, 50) + '...' : 'Sin mensajes'}
        </div>
      </div>
    `;
  });
  
  elements.conversationsList.innerHTML = html;
  
  // Agregar event listeners a los elementos de la conversación
  document.querySelectorAll('.conversation-item').forEach(item => {
    item.addEventListener('click', () => {
      const conversationId = item.getAttribute('data-id');
      selectConversation(conversationId);
    });
  });
}

// Seleccionar conversación
function selectConversation(conversationId) {
  const conversation = state.conversations.find(c => c.id === conversationId);
  if (!conversation) return;
  
  state.currentConversationId = conversationId;
  
  // Actualizar la UI
  if (elements.chatTitle) {
    elements.chatTitle.textContent = conversation.title || 'Nueva conversación';
  }
  
  // Cargar mensajes
  loadMessages(conversation.messages);
  
  // Resaltar la conversación seleccionada
  document.querySelectorAll('.conversation-item').forEach(item => {
    if (item.getAttribute('data-id') === conversationId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // Cerrar el menú en móviles
  if (window.innerWidth <= 768) {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.remove('open');
  }
}

// Cargar mensajes en el chat
function loadMessages(messages = []) {
  if (!elements.chatContainer) return;
  
  // Limpiar el contenedor de mensajes
  elements.chatContainer.innerHTML = '';
  
  // Agregar mensajes
  messages.forEach(message => {
    appendMessage(message.role, message.content);
  });
  
  // Hacer scroll al final
  scrollToBottom();
}

// Crear nueva conversación
function createNewConversation() {
  const newConversation = {
    id: 'conv-' + Date.now(),
    title: 'Nueva conversación',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  state.conversations.push(newConversation);
  state.currentConversationId = newConversation.id;
  
  // Actualizar la UI
  renderConversations();
  selectConversation(newConversation.id);
  
  // Enfocar el input de mensaje
  if (elements.messageInput) {
    elements.messageInput.focus();
  }
  
  return newConversation;
}

// Enviar mensaje
async function sendMessage() {
  if (!elements.messageInput) return;
  
  const message = elements.messageInput.value.trim();
  if (!message || state.isTyping) return;
  
  // Obtener la conversación actual o crear una nueva
  let conversation = state.conversations.find(c => c.id === state.currentConversationId);
  if (!conversation) {
    conversation = createNewConversation();
  }
  
  // Crear mensaje del usuario
  const userMessage = {
    role: 'user',
    content: message,
    timestamp: new Date().toISOString()
  };
  
  // Agregar mensaje a la conversación
  conversation.messages.push(userMessage);
  conversation.updatedAt = new Date().toISOString();
  
  // Limpiar el input
  elements.messageInput.value = '';
  
  // Mostrar el mensaje del usuario
  appendMessage('user', message);
  
  // Mostrar indicador de escritura
  showTypingIndicator();
  
  try {
    // Simular respuesta del bot después de un retraso
    setTimeout(() => {
      const botResponse = {
        role: 'bot',
        content: '¡Hola! Soy Alma, tu asistente de IA. ¿En qué puedo ayudarte hoy?',
        timestamp: new Date().toISOString()
      };
      
      // Agregar respuesta del bot a la conversación
      conversation.messages.push(botResponse);
      conversation.updatedAt = new Date().toISOString();
      
      // Ocultar indicador de escritura
      hideTypingIndicator();
      
      // Mostrar la respuesta del bot
      appendMessage('bot', botResponse.content);
      
      // Actualizar la lista de conversaciones
      renderConversations();
      
    }, 1500);
    
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    hideTypingIndicator();
    appendMessage('bot', 'Lo siento, ha ocurrido un error al procesar tu mensaje. Por favor, inténtalo de nuevo.');
  }
}

// Mostrar indicador de escritura
function showTypingIndicator() {
  state.isTyping = true;
  
  if (elements.chatContainer) {
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.id = 'typing-indicator';
    typingIndicator.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
    `;
    elements.chatContainer.appendChild(typingIndicator);
    scrollToBottom();
  }
}

// Ocultar indicador de escritura
function hideTypingIndicator() {
  state.isTyping = false;
  
  const typingIndicator = document.getElementById('typing-indicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

// Agregar mensaje al chat
function appendMessage(role, content) {
  if (!elements.chatContainer) return;
  
  const messageElement = document.createElement('div');
  messageElement.className = `message ${role}`;
  messageElement.textContent = content;
  
  elements.chatContainer.appendChild(messageElement);
  scrollToBottom();
}

// Hacer scroll al final del chat
function scrollToBottom() {
  if (elements.chatContainer) {
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
  }
}

// Hacer las funciones accesibles globalmente para depuración
window.chatApp = {
  state,
  elements,
  showApp,
  loadConversations,
  createNewConversation,
  sendMessage
};
