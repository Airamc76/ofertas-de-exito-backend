// Configuración global de la aplicación
window.APP_CONFIG = {
  // URL de la API del backend
  API_URL: 'https://ofertas-de-exito-backend.vercel.app',
  
  // Configuración del chat
  CHAT: {
    // Tiempo de espera para la respuesta del bot (ms)
    BOT_RESPONSE_DELAY: 1500,
    // Número máximo de caracteres por mensaje
    MAX_MESSAGE_LENGTH: 2000,
    // Número máximo de mensajes por conversación
    MAX_MESSAGES_PER_CONVERSATION: 100,
    // Tiempo de espera para reconexión (ms)
    RECONNECTION_DELAY: 3000
  },
  
  // Configuración de la interfaz de usuario
  UI: {
    // Tema claro/oscuro
    THEME: 'dark',
    // Mostrar avisos
    SHOW_NOTIFICATIONS: true,
    // Sonidos
    SOUNDS: {
      MESSAGE_SENT: 'sounds/message-sent.mp3',
      MESSAGE_RECEIVED: 'sounds/message-received.mp3',
      NOTIFICATION: 'sounds/notification.mp3'
    }
  },
  
  // Configuración de persistencia
  STORAGE: {
    // Prefijo para las claves en localStorage
    KEY_PREFIX: 'alma_chat_',
    // Guardar automáticamente cada X segundos (0 para desactivar)
    AUTO_SAVE_INTERVAL: 30
  },
  
  // Características experimentales
  FEATURES: {
    // Habilitar marcado Markdown en los mensajes
    MARKDOWN_SUPPORT: true,
    // Mostrar sugerencias de mensajes
    MESSAGE_SUGGESTIONS: true,
    // Mostrar vista previa de enlaces
    LINK_PREVIEW: true
  }
};

// Inicialización de variables globales
window.APP_STATE = {
  // ID del cliente
  clientId: null,
  // ID de la conversación actual
  currentConversationId: null,
  // Lista de conversaciones
  conversations: [],
  // Estado de la aplicación
  isInitialized: false,
  isTyping: false,
  isOnline: navigator.onLine,
  // Configuración del usuario
  userSettings: {}
};

// Inicialización de la configuración
(function initConfig() {
  try {
    // Cargar configuración guardada
    const savedConfig = localStorage.getItem('alma_chat_config');
    if (savedConfig) {
      Object.assign(window.APP_CONFIG, JSON.parse(savedConfig));
    }
    
    // Generar ID de cliente si no existe
    if (!window.APP_STATE.clientId) {
      window.APP_STATE.clientId = 'user-' + Math.random().toString(36).substr(2, 9);
    }
    
    // Configurar detección de conexión
    window.addEventListener('online', () => { window.APP_STATE.isOnline = true; });
    window.addEventListener('offline', () => { window.APP_STATE.isOnline = false; });
    
    console.log('✅ Configuración inicializada correctamente');
  } catch (error) {
    console.error('❌ Error al inicializar la configuración:', error);
  }
})();
