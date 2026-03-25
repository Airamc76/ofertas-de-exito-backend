// Variables globales
let currentConversationId = null;
let isTyping = false;

// Elementos del DOM
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const newChatBtn = document.getElementById('newChatBtn');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.querySelector('.sidebar');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    console.log('Aplicación inicializada');
    setupEventListeners();
    createNewConversation();
});

// Configurar event listeners
function setupEventListeners() {
    // Enviar mensaje al hacer clic en el botón
    sendButton.addEventListener('click', sendMessage);
    
    // Enviar mensaje al presionar Enter
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Nuevo chat
    newChatBtn.addEventListener('click', createNewConversation);
    
    // Toggle sidebar en móviles
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }
}

// Crear nueva conversación
function createNewConversation() {
    currentConversationId = 'conv-' + Date.now();
    messagesContainer.innerHTML = '';
    userInput.value = '';
    userInput.focus();
    
    // Mostrar mensaje de bienvenida
    appendMessage('bot', '¡Hola! Soy Alma, tu asistente de IA. ¿En qué puedo ayudarte hoy?');
}

// Enviar mensaje
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message || isTyping) return;
    
    // Agregar mensaje del usuario al chat
    appendMessage('user', message);
    userInput.value = '';
    
    // Mostrar indicador de escritura
    showTypingIndicator();
    
    try {
        // Simular respuesta del bot (reemplazar con llamada a la API real)
        setTimeout(() => {
            hideTypingIndicator();
            const botResponse = getBotResponse(message);
            appendMessage('bot', botResponse);
        }, 1000);
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        hideTypingIndicator();
        appendMessage('bot', 'Lo siento, ha ocurrido un error. Por favor, inténtalo de nuevo.');
    }
}

// Mostrar indicador de escritura
function showTypingIndicator() {
    isTyping = true;
    const typingHtml = `
        <div class="typing-indicator" id="typingIndicator">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    messagesContainer.insertAdjacentHTML('beforeend', typingHtml);
    scrollToBottom();
}

// Ocultar indicador de escritura
function hideTypingIndicator() {
    isTyping = false;
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Agregar mensaje al chat
function appendMessage(role, content) {
    const messageDiv = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.className = `message ${role}-message`;
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-text">${content}</div>
        </div>
        <div class="message-time">${timestamp}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

// Desplazarse al final de los mensajes
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Respuestas predefinidas del bot (ejemplo)
function getBotResponse(userMessage) {
    const message = userMessage.toLowerCase();
    
    if (message.includes('hola') || message.includes('buenos días') || message.includes('buenas tardes')) {
        return '¡Hola! ¿En qué puedo ayudarte hoy?';
    } else if (message.includes('cómo estás') || message.includes('qué tal')) {
        return '¡Estoy aquí para ayudarte! ¿En qué puedo asistirte hoy?';
    } else if (message.includes('gracias')) {
        return '¡De nada! ¿Hay algo más en lo que pueda ayudarte?';
    } else if (message.includes('adiós') || message.includes('hasta luego')) {
        return '¡Hasta luego! No dudes en volver si necesitas más ayuda.';
    } else {
        return 'Gracias por tu mensaje. Estoy aquí para ayudarte con lo que necesites. ¿En qué más puedo asistirte?';
    }
}

// Hacer funciones accesibles globalmente para eventos en línea
window.sendMessage = sendMessage;
