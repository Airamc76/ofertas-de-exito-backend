/* app-clean.js
 * Chat mínimo conectado a tu backend. Seguro para probar en limpio.
 * Asume window.API y window.CLIENT_ID ya definidos en index.html
 */

(function bootstrapUI() {
  // Si no existe el contenedor del chat, lo creamos
  if (!document.getElementById('chat-root')) {
    const root = document.createElement('div');
    root.id = 'chat-root';
    root.innerHTML = `
      <div id="chat-wrap" style="position:relative;height:100vh;display:flex;flex-direction:column;background:#0b1220;color:#e6e9ef;font-family:Inter,system-ui,Arial">
        <style>
          @keyframes typing-pulse {
            0%, 60%, 100% { transform: scale(1); opacity: 0.5; }
            30% { transform: scale(1.2); opacity: 1; }
          }
        </style>
        <header style="padding:12px 16px;border-bottom:1px solid #1c2340;display:flex;align-items:center;gap:8px">
          <div style="width:10px;height:10px;border-radius:50%;background:#22c55e"></div>
          <strong>Alma</strong><span style="opacity:.6">· conectada</span>
          <span id="conv-badge" style="margin-left:auto;opacity:.7;font-size:12px"></span>
        </header>

        <main id="chat-messages" style="flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:12px"></main>

        <footer style="border-top:1px solid #1c2340;padding:12px;display:flex;gap:8px">
          <input id="chat-input" type="text" placeholder="Escribe tu mensaje…" autocomplete="off"
                 style="flex:1;border:1px solid #283155;background:#0f172a;color:#fff;border-radius:10px;padding:12px" />
          <button id="chat-send" style="border:0;background:#2563eb;color:#fff;border-radius:10px;padding:12px 16px;cursor:pointer">
            Enviar
          </button>
        </footer>
      </div>
    `;
    document.body.appendChild(root);
  }
})();

function $(sel){ return document.querySelector(sel); }
function appendMsg(role, text){
  const wrap = document.createElement('div');
  const isUser = role === 'user';
  wrap.style.alignSelf = isUser ? 'flex-end' : 'flex-start';
  wrap.style.maxWidth = '80%';
  wrap.style.background = isUser ? '#1d4ed8' : '#111827';
  wrap.style.border = '1px solid #1f2937';
  wrap.style.borderRadius = '12px';
  wrap.style.padding = '10px 12px';
  wrap.style.whiteSpace = 'pre-wrap';
  wrap.textContent = text;
  $('#chat-messages').appendChild(wrap);
  wrap.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function setBusy(b){ 
  $('#chat-input').disabled = b; 
  $('#chat-send').disabled = b; 
  $('#chat-send').textContent = b ? 'Enviando…' : 'Enviar';
  
  const typingIndicator = $('#typing-indicator');
  if (b && !typingIndicator) {
    // Crear indicador de escribiendo
    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.style.alignSelf = 'flex-start';
    indicator.style.maxWidth = '80%';
    indicator.style.background = '#111827';
    indicator.style.border = '1px solid #1f2937';
    indicator.style.borderRadius = '12px';
    indicator.style.padding = '10px 12px';
    indicator.style.display = 'flex';
    indicator.style.alignItems = 'center';
    indicator.style.gap = '4px';
    indicator.innerHTML = `
      <div class="typing-dot" style="width: 6px; height: 6px; border-radius: 50%; background: #6b7280; animation: typing-pulse 1.5s infinite;"></div>
      <div class="typing-dot" style="width: 6px; height: 6px; border-radius: 50%; background: #6b7280; animation: typing-pulse 1.5s infinite 0.2s;"></div>
      <div class="typing-dot" style="width: 6px; height: 6px; border-radius: 50%; background: #6b7280; animation: typing-pulse 1.5s infinite 0.4s;"></div>
      <span style="margin-left: 8px; color: #9ca3af; font-size: 0.9em;">Alma está escribiendo...</span>
    `;
    $('#chat-messages').appendChild(indicator);
    indicator.scrollIntoView({ behavior: 'smooth', block: 'end' });
  } else if (!b && typingIndicator) {
    // Eliminar indicador de escribiendo
    typingIndicator.remove();
  }
}

async function createConversation() {
  try {
    const body = { 
      clientId: state.clientId,
      userId: state.clientId,
      title: 'Nueva conversación',
      messages: [],
      model: 'gpt-4',
      timestamp: new Date().toISOString()
    };
    const url = `${window.API}/api/conversations`;

    console.log('Creando conversación con:', { url, body });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Client-Id': state.clientId
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Error desconocido');
      console.error('Error al crear conversación:', res.status, errorText);
      throw new Error(`No se pudo crear la conversación: ${res.status} ${errorText}`);
    }

    const response = await res.json();
    // Manejar tanto { data: {...} como respuesta directa
    const conversation = response.data || response;
    
    if (!conversation || !conversation.id) {
      throw new Error('Respuesta del servidor inválida');
    }

    console.log('Conversación creada:', conversation.id);
    return conversation;
    
  } catch (error) {
    console.error('Error en createConversation:', error);
    throw error; // Re-lanzar para manejo de errores en el llamador
  }
}

// Intenta enviar por /conversations/:id/messages y si falla, prueba /api/messages
async function sendMessage(conversationId, content) {
  const payload = {
    conversationId,        // útil para el fallback
    content,
    role: 'user',          // por si el backend lo solicita
    clientId: window.CLIENT_ID,
    timestamp: new Date().toISOString()
  };

  // Opción A: ruta anidada
  const tryA = async () => {
    const url = `${window.API}/api/conversations/${encodeURIComponent(conversationId)}/messages`;
    console.log('Intentando ruta A:', url);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Client-Id': window.CLIENT_ID
      },
      body: JSON.stringify({ 
        content, 
        clientId: window.CLIENT_ID, 
        role: 'user',
        timestamp: new Date().toISOString()
      }),
    });
    if (!r.ok) {
      const err = await r.text().catch(() => '');
      throw new Error(`A ${r.status} ${err}`);
    }
    return r.json();
  };

  // Opción B: ruta plana
  const tryB = async () => {
    const url = `${window.API}/api/messages`;
    console.log('Intentando ruta B:', url);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Client-Id': window.CLIENT_ID
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const err = await r.text().catch(() => '');
      throw new Error(`B ${r.status} ${err}`);
    }
    return r.json();
  };

  try {
    return await tryA();
  } catch (eA) {
    console.warn('Fallo ruta A, probando fallback /api/messages:', eA?.message || eA);
    return await tryB();
  }
}

// Estado global
const state = {
  conversationId: null,
  clientId: window.CLIENT_ID || localStorage.getItem('clientId') || `anon-${Date.now()}`,
  isInitialized: false
};

window.addEventListener('DOMContentLoaded', async () => {
  try {
    // Asegurar que tenemos un clientId
    if (!window.CLIENT_ID) {
      window.CLIENT_ID = localStorage.getItem('clientId') || `anon-${Date.now()}`;
      localStorage.setItem('clientId', window.CLIENT_ID);
    }

    // Asegurar que tenemos la URL de la API
    if (!window.API) {
      window.API = 'https://ofertas-de-exito-backend.vercel.app';
    }

    console.log('Iniciando con:', { clientId: window.CLIENT_ID, api: window.API });

    // Cargar conversación existente o crear una nueva
    const savedConvId = localStorage.getItem('alma:lastConv');
    if (savedConvId) {
      state.conversationId = savedConvId;
      $('#conv-badge').textContent = state.conversationId ? `Conversación #${state.conversationId.slice(0, 8)}` : '';
      appendMsg('assistant', '🔄 Continuando conversación existente...');
      console.log('Usando conversación existente:', savedConvId);
    } else {
      const conv = await createConversation();
      console.log('Conversación creada:', conv);

      state.conversationId = conv.id || conv.conversationId || conv.uuid;
      localStorage.setItem('alma:lastConv', state.conversationId);
      $('#conv-badge').textContent = state.conversationId ? `Conversación #${state.conversationId.slice(0, 8)}` : '';
    }

    state.isInitialized = true;
    appendMsg('assistant', '¡Hola! Soy Alma. ¿En qué puedo ayudarte hoy?');

    // Eventos de envío
    const doSend = async () => {
      const input = $('#chat-input');
      const txt = (input.value || '').trim();
      if (!txt || !state.conversationId) return;

      appendMsg('user', txt);
      input.value = '';
      setBusy(true);

      try {
        const res = await sendMessage(state.conversationId, txt);
        console.log('Respuesta del servidor:', res);

        // soporta { success, data:{ content }} o { content }
        const data = res?.data ?? res;
        const aiText = data?.content || data?.message?.content || JSON.stringify(data, null, 2);
        appendMsg('assistant', aiText);
      } catch (err) {
        console.error('Error al enviar mensaje:', err);
        appendMsg('assistant', `⚠️ Error: ${err.message || 'No se pudo enviar el mensaje'}`);
      } finally {
        setBusy(false);
      }
    };

    // Solo configurar eventos si el chat está inicializado
    function setupEventListeners() {
      $('#chat-send').addEventListener('click', () => {
        if (state.isInitialized) doSend();
      });

      $('#chat-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && state.isInitialized) {
          e.preventDefault();
          doSend();
        }
      });
    }

    // Configurar eventos y enfocar el input cuando esté listo
    setupEventListeners();

    // Verificar inicialización periódicamente
    const checkInitialization = setInterval(() => {
      if (state.isInitialized) {
        clearInterval(checkInitialization);
        $('#chat-input').focus();
      }
    }, 100);
  } catch (e) {
    console.error('Fallo al iniciar el chat:', e);
    const errorMsg = document.createElement('div');
    errorMsg.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ef4444;color:white;padding:12px;text-align:center;z-index:9999;';
    errorMsg.innerHTML = `
      <div style="font-weight:bold">Error al conectar con el servidor</div>
      <div style="font-size:0.9em;opacity:0.9">${e.message || 'Error desconocido'}</div>
      <button onclick="location.reload()" style="margin-top:8px;padding:4px 12px;background:white;border:none;border-radius:4px;cursor:pointer">
        Reintentar
      </button>
    `;
    document.body.appendChild(errorMsg);
  }
});

// Función para enviar mensajes
