/**
 * Inicialización de la aplicación
 * Este archivo se encarga de configurar e inicializar la aplicación
 */

// Función principal de inicialización
function initApp() {
  try {
    console.log('🚀 Inicializando aplicación...');
    
    // Inicializar el tema
    initTheme();
    
    // Inicializar el sistema de notificaciones
    initNotifications();
    
    // Inicializar el servicio de autenticación
    initAuth();
    
    // Inicializar el chat
    initChat();
    
    console.log('✅ Aplicación inicializada correctamente');
    
    // Mostrar la interfaz de usuario
    showUI();
    
  } catch (error) {
    console.error('❌ Error al inicializar la aplicación:', error);
    showError('No se pudo inicializar la aplicación. Por favor, recarga la página.');
  }
}

// Inicializar el tema
function initTheme() {
  try {
    // Verificar preferencias del sistema
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');
    
    // Aplicar tema guardado
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Configurar el botón de cambio de tema
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
      themeToggle.innerHTML = savedTheme === 'dark' ? '☀️' : '🌙';
    }
    
  } catch (error) {
    console.error('Error al inicializar el tema:', error);
  }
}

// Cambiar entre tema claro y oscuro
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  // Actualizar atributo y guardar preferencia
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  // Actualizar ícono del botón
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
  }
}

// Inicializar notificaciones
function initNotifications() {
  // Verificar si el navegador soporta notificaciones
  if (!('Notification' in window)) {
    console.warn('Este navegador no soporta notificaciones');
    return;
  }
  
  // Solicitar permiso para notificaciones
  if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      console.log('Permiso de notificación:', permission);
    });
  }
}

// Mostrar notificación
function showNotification(title, options = {}) {
  // Verificar si las notificaciones están disponibles y permitidas
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    console.warn('No se pueden mostrar notificaciones');
    return;
  }
  
  // Configuración por defecto
  const defaultOptions = {
    icon: '/favicon.ico',
    badge: '/badge.png',
    vibrate: [200, 100, 200],
    renotify: true,
    requireInteraction: false,
    ...options
  };
  
  // Mostrar notificación
  return new Notification(title, defaultOptions);
}

// Inicializar autenticación
function initAuth() {
  // Verificar si el usuario ya está autenticado
  const token = localStorage.getItem('auth_token');
  const userData = localStorage.getItem('user_data');
  
  if (token && userData) {
    try {
      const user = JSON.parse(userData);
      window.APP_STATE.user = user;
      console.log('Usuario autenticado:', user.email);
    } catch (error) {
      console.error('Error al analizar datos de usuario:', error);
      localStorage.removeItem('user_data');
    }
  }
  
  // Actualizar interfaz de usuario de autenticación
  updateAuthUI();
}

// Actualizar interfaz de usuario de autenticación
function updateAuthUI() {
  const authSection = document.getElementById('auth-section');
  const userSection = document.getElementById('user-section');
  const userEmail = document.getElementById('user-email');
  
  if (!authSection || !userSection || !userEmail) return;
  
  if (window.APP_STATE.user) {
    // Usuario autenticado
    authSection.style.display = 'none';
    userSection.style.display = 'block';
    userEmail.textContent = window.APP_STATE.user.email;
  } else {
    // Usuario no autenticado
    authSection.style.display = 'block';
    userSection.style.display = 'none';
  }
}

// Inicializar chat
function initChat() {
  try {
    // Verificar si el contenedor del chat existe
    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) {
      console.error('No se encontró el contenedor del chat');
      return;
    }
    
    // Inicializar el chat
    if (typeof initChatUI === 'function') {
      initChatUI();
    } else {
      console.warn('La función initChatUI no está definida');
    }
    
    // Configurar eventos del teclado
    setupKeyboardShortcuts();
    
  } catch (error) {
    console.error('Error al inicializar el chat:', error);
    showError('No se pudo inicializar el chat. Por favor, recarga la página.');
  }
}

// Configurar atajos de teclado
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl + N: Nueva conversación
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      if (typeof createNewConversation === 'function') {
        createNewConversation();
      }
    }
    
    // Ctrl + /: Mostrar atajos de teclado
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      showKeyboardShortcuts();
    }
  });
}

// Mostrar atajos de teclado
function showKeyboardShortcuts() {
  const shortcuts = [
    { key: 'Ctrl + N', description: 'Nueva conversación' },
    { key: 'Ctrl + /', description: 'Mostrar esta ayuda' },
    { key: 'Esc', description: 'Cerrar menús o diálogos' },
    { key: 'Enter', description: 'Enviar mensaje' },
    { key: 'Shift + Enter', description: 'Nueva línea en el campo de mensaje' }
  ];
  
  let html = '<div class="keyboard-shortcuts">';
  html += '<h3>Atajos de teclado</h3>';
  html += '<ul>';
  
  shortcuts.forEach(shortcut => {
    html += `
      <li>
        <kbd>${shortcut.key}</kbd>
        <span>${shortcut.description}</span>
      </li>
    `;
  });
  
  html += '</ul></div>';
  
  // Mostrar en un modal o notificación
  showModal('Atajos de teclado', html);
}

// Mostrar interfaz de usuario
function showUI() {
  // Ocultar pantalla de carga
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 300);
  }
  
  // Mostrar la aplicación
  const app = document.getElementById('app');
  if (app) {
    app.style.opacity = '1';
  }
}

// Mostrar mensaje de error
function showError(message) {
  console.error(message);
  
  // Mostrar notificación
  showNotification('Error', {
    body: message,
    icon: '/icons/error.png'
  });
  
  // Mostrar en la interfaz si es posible
  const errorContainer = document.getElementById('error-container');
  if (errorContainer) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    errorContainer.appendChild(errorElement);
    
    // Eliminar después de 5 segundos
    setTimeout(() => {
      errorElement.style.opacity = '0';
      setTimeout(() => {
        errorElement.remove();
      }, 300);
    }, 5000);
  }
}

// Mostrar modal
function showModal(title, content) {
  // Crear o actualizar el modal
  let modal = document.getElementById('app-modal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'app-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>${title}</h2>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">${content}</div>
      </div>
    `;
    
    // Cerrar al hacer clic fuera del contenido
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('modal-close')) {
        closeModal();
      }
    });
    
    // Cerrar con la tecla Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    });
    
    document.body.appendChild(modal);
  } else {
    // Actualizar contenido existente
    modal.querySelector('.modal-header h2').textContent = title;
    modal.querySelector('.modal-body').innerHTML = content;
  }
  
  // Mostrar el modal
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);
  
  return modal;
}

// Cerrar modal
function closeModal() {
  const modal = document.getElementById('app-modal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => {
      modal.remove();
    }, 300);
  }
}

// Inicializar cuando el DOM esté completamente cargado
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Hacer funciones accesibles globalmente
window.initApp = initApp;
window.showNotification = showNotification;
window.showError = showError;
window.showModal = showModal;
window.closeModal = closeModal;
