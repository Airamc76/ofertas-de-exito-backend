// frontend-fix-final.js - Código corregido para el frontend
// Reemplazar las funciones problemáticas con estas versiones

const API_URL = 'https://ofertas-de-exito-backend.vercel.app';

// Función CORREGIDA para cargar mensajes
async function loadConversationMessages(conversationId) {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.error('No hay token de autenticación');
            return [];
        }

        console.log('🔍 Cargando mensajes para conversación:', conversationId);
        
        const response = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`  // ← IMPORTANTE: Bearer + espacio
            }
        });

        console.log('📡 Response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('📄 Response data:', data);

        // ← IMPORTANTE: Acceder a data.messages, no solo messages
        const messages = data.messages || [];
        console.log('💬 Mensajes obtenidos:', messages.length);

        return messages;
    } catch (error) {
        console.error('❌ Error cargando mensajes:', error);
        return [];
    }
}

// Función CORREGIDA para cargar conversaciones
async function loadConversations() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.error('No hay token de autenticación');
            return [];
        }

        console.log('🔍 Cargando conversaciones...');
        
        const response = await fetch(`${API_URL}/api/conversations`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const conversations = data.conversations || [];
        
        console.log('📋 Conversaciones cargadas:', conversations.length);
        return conversations;
    } catch (error) {
        console.error('❌ Error cargando conversaciones:', error);
        return [];
    }
}

// Función CORREGIDA para seleccionar conversación
async function selectConversation(conversationId) {
    try {
        console.log('🎯 Seleccionando conversación:', conversationId);
        
        // Marcar como activa en UI
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`[data-conversation-id="${conversationId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }

        // Cargar mensajes
        const messages = await loadConversationMessages(conversationId);
        renderMessages(messages);
        
        // Guardar conversación actual
        window.currentConversationId = conversationId;
        
        console.log('✅ Conversación seleccionada con', messages.length, 'mensajes');
    } catch (error) {
        console.error('❌ Error seleccionando conversación:', error);
    }
}

// Función CORREGIDA para renderizar mensajes
function renderMessages(messages) {
    const chatContainer = document.getElementById('chat-messages');
    if (!chatContainer) {
        console.error('❌ Contenedor de chat no encontrado');
        return;
    }

    chatContainer.innerHTML = '';

    if (!messages || messages.length === 0) {
        console.log('📝 No hay mensajes, mostrando mensaje de bienvenida');
        chatContainer.innerHTML = `
            <div class="message assistant">
                <div class="message-content">¡Hola! Soy Alma, tu experta en ventas online. ¿En qué puedo ayudarte hoy?</div>
            </div>
        `;
        return;
    }

    console.log('📝 Renderizando', messages.length, 'mensajes');
    
    messages.forEach((message, index) => {
        if (message.role === 'system') return; // Saltar mensajes del sistema

        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.role}`;
        
        messageElement.innerHTML = `
            <div class="message-content">${message.content}</div>
            ${message.timestamp ? `<div class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</div>` : ''}
        `;

        chatContainer.appendChild(messageElement);
    });

    // Scroll al final
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Función CORREGIDA de inicialización
async function initializeApp() {
    try {
        console.log('🚀 Inicializando aplicación...');
        
        // 1. Cargar conversaciones
        const conversations = await loadConversations();
        
        // 2. Renderizar lista
        renderConversationsList(conversations);
        
        // 3. Seleccionar primera conversación si existe
        if (conversations.length > 0) {
            await selectConversation(conversations[0].id);
        }
        
        console.log('✅ Aplicación inicializada correctamente');
    } catch (error) {
        console.error('❌ Error inicializando aplicación:', error);
    }
}

// Función para renderizar lista de conversaciones
function renderConversationsList(conversations) {
    const listContainer = document.getElementById('conversations-list');
    if (!listContainer) {
        console.error('❌ Contenedor de conversaciones no encontrado');
        return;
    }

    if (!conversations || conversations.length === 0) {
        listContainer.innerHTML = '<div class="no-conversations">No hay conversaciones</div>';
        return;
    }

    listContainer.innerHTML = '';
    
    conversations.forEach(conv => {
        const convElement = document.createElement('div');
        convElement.className = 'conversation-item';
        convElement.dataset.conversationId = conv.id;
        
        convElement.innerHTML = `
            <div class="conversation-title">${conv.title}</div>
            <div class="conversation-date">${new Date(conv.updatedAt).toLocaleDateString()}</div>
        `;

        convElement.addEventListener('click', () => {
            selectConversation(conv.id);
        });

        listContainer.appendChild(convElement);
    });
    
    console.log('📋 Lista de conversaciones renderizada:', conversations.length);
}

// DEBUGGING: Función para probar el endpoint manualmente
async function testMessagesEndpoint(conversationId) {
    console.log('🧪 PROBANDO ENDPOINT MANUALMENTE...');
    
    const token = localStorage.getItem('authToken');
    const url = `${API_URL}/api/conversations/${conversationId}/messages`;
    
    console.log('🔗 URL:', url);
    console.log('🔑 Token:', token ? 'Presente' : 'Ausente');
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('📡 Status:', response.status);
        console.log('📡 Status Text:', response.statusText);
        
        const data = await response.json();
        console.log('📄 Data:', data);
        console.log('💬 Messages count:', data.messages?.length || 0);
        
        return data;
    } catch (error) {
        console.error('❌ Error:', error);
        return null;
    }
}

// Exportar funciones para uso global
window.loadConversations = loadConversations;
window.loadConversationMessages = loadConversationMessages;
window.selectConversation = selectConversation;
window.renderMessages = renderMessages;
window.initializeApp = initializeApp;
window.testMessagesEndpoint = testMessagesEndpoint;

// Auto-inicializar si hay token
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('authToken')) {
        initializeApp();
    }
});

console.log('🔧 Frontend corregido cargado. Usa initializeApp() para inicializar.');
