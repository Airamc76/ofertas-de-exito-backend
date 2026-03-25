/* app-clean.js
 * Chat mínimo conectado a tu backend. Seguro para probar en limpio.
 * Asume window.API y window.CLIENT_ID ya definidos en index.html
 */

(function bootstrapUI() {
  if (!document.getElementById('chat-root')) {
    layout();
  }
})();

function $(sel){ return document.querySelector(sel); }
function byId(id){ return document.getElementById(id); }
function el(html){ const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

// --- Teclado móvil: eleva el footer cuando aparece (VisualViewport) ---
function installKeyboardLift() {
  const root = document.documentElement;
  const vv = window.visualViewport;
  if (!vv) return; // navegadores viejos
  const onResize = () => {
    const offset = Math.max(0, window.innerHeight - vv.height);
    root.style.setProperty('--kb-offset', offset + 'px');
    if (window.App?.ui?.scrollToBottom) {
      window.App.ui.scrollToBottom('auto');
    } else {
      const c = document.getElementById('chat-messages');
      if (c) c.scrollTo({ top: c.scrollHeight, behavior: 'auto' });
    }
  };
  vv.addEventListener('resize', onResize);
  vv.addEventListener('scroll', onResize);
  window.addEventListener('orientationchange', onResize);
  onResize();
}
// Por si se llama desde otro scope/archivo
window.installKeyboardLift = installKeyboardLift;

// Genera Intro, Reveal y Chat Root
function layout(){
  if (byId('chat-root')) return;

  // Splash / Intro
  const intro = el(`
    <section id="intro" aria-hidden="false">
      <div class="intro-card">
        <div class="intro-head">
          <div class="intro-logo"><img src="alma-logo-new.svg?v=2" alt="Alma" width="28" height="28"></div>
          <div>
            <div class="intro-title">Alma · Asistente IA</div>
            <div class="intro-sub">Respuestas claras. Acciones rápidas. Diseño limpio.</div>
          </div>
        </div>
        <ul class="intro-list">
          <li>Chat conversacional con memoria local y continuidad.</li>
          <li>UI rápida con indicador de escritura y auto-scroll.</li>
          <li>Seguro: tu sesión se identifica por <code>clientId</code> local.</li>
        </ul>
        <div class="intro-cta">
          <button id="intro-start" class="btn-primary">Comenzar</button>
        </div>
      </div>
    </section>
  `);

  // Capa de degradé
  const reveal = el(`<div id="reveal"></div>`);

  // Chat (oculto visualmente hasta play)
  const root = el(`
    <div id="chat-root" class="chat-wrap">
      <header class="chat-header">
        <div class="brand">
          <div class="dot"></div>
          <div class="avatar"><img src="alma-logo-new.svg?v=2" alt="Alma" width="20" height="20"></div>
          <strong>Alma</strong><span style="opacity:.6">· conectada</span>
        </div>
        <span id="conv-badge" class="badge"></span>
        <button id="btn-new" class="btn" style="margin-left:12px">Nueva</button>
        <button id="btn-clear" class="btn secondary" style="margin-left:8px">Limpiar</button>
      </header>
      <main id="chat-messages" class="chat-main"></main>
      <footer class="chat-footer">
        <div class="inputbox" style="flex:1">
          <textarea id="chat-input" rows="1" placeholder="Escribe tu mensaje… (Shift+Enter = salto de línea)"></textarea>
          <span id="char-count" class="counter">0</span>
        </div>
        <div class="actions">
          <button id="chat-send" class="btn">Enviar</button>
        </div>
      </footer>
    </div>
  `);

  document.body.appendChild(root);
  document.body.appendChild(reveal);
  document.body.appendChild(intro);

  // Bloquea input hasta iniciar
  byId('chat-input').disabled = true;

  // CTA
  intro.querySelector('#intro-start').addEventListener('click', startExperience);
}
// ===== Helpers Markdown muy básico y seguro =====
function escapeHtml(s){
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function mdToHtml(src){
  let s = escapeHtml(src);
  // Normaliza encabezados inline para que empiecen en línea nueva
  s = s.replace(/\s+(###\s+)/g, '\n$1');
  s = s.replace(/\s+(##\s+)/g, '\n$1');
  s = s.replace(/\s+(#\s+)/g, '\n$1');

  // Normaliza emojis de sección inline (💡, 🎯, 🧩, 📦, 🛡️, 🚀, 👉) para que empiecen en línea nueva
  s = s.replace(/\s+(💡|🎯|🧩|📦|🛡️|🚀|👉)\s+/g, '\n$1 ');

  // Si hay final de frase seguido de emoji de sección, fuerza salto antes del emoji
  s = s.replace(/([\.\!\?])\s+(💡|🎯|🧩|📦|🛡️|🚀|👉)\s+/g, '$1\n$2 ');

   // Si viene todo en una sola línea, fuerza saltos antes de bullets tipo "- **Texto**"
   s = s.replace(/\s+(-\s+\*\*)/g, '\n$1');

  // Casos tipo "💡 **Diagnóstico** Texto..." -> título + párrafo separado
  s = s.replace(/^(💡|🎯|🧩|📦|🛡️|🚀|👉)\s+\*\*([^*]+)\*\*(.*)$/gm,
    (m, emoji, title, rest) => `\n<p class="chat-heading"><strong>${emoji} ${title.trim()}<\/strong><\/p>\n<p>${rest.trim()}<\/p>`);

  // Encabezados Markdown -> párrafos destacados (sin símbolos #)
  // Nivel 3
  s = s.replace(/^###\s+(.+)$/gm, '<p class="chat-heading"><strong>$1<\/strong><\/p>');
  // Nivel 2
  s = s.replace(/^##\s+(.+)$/gm, '<p class="chat-heading"><strong>$1<\/strong><\/p>');
  // Nivel 1
  s = s.replace(/^#\s+(.+)$/gm, '<p class="chat-heading"><strong>$1<\/strong><\/p>');

  // Quita cualquier marcador ###/##/# suelto que haya quedado sin convertir
  s = s.replace(/#{2,4}\s*(?=\w)/g, '');
  s = s.replace(/```([\s\S]*?)```/g, (_,code)=> `<pre><code>${code}</code></pre>`);

  // Líneas tipo "- **Etiqueta**: texto" -> párrafos sueltos sin guion
  s = s.replace(/^-[ \t]+\*\*([^*]+)\*\*:(.*)$/gm, (m, label, rest)=> {
    return `<p><strong>${label.trim()}</strong>:${rest}</p>`;
  });

  // Listas normales con - o *
  s = s.replace(/^(?:-\s.+|\*\s.+)(?:\r?\n(?:-\s.+|\*\s.+))*/gm, block=>{
    const items = block.split(/\r?\n/).map(l=> l.replace(/^[-*]\s+/, '').trim()).map(li=> `<li>${li}</li>`).join('');
    return `<ul>${items}</ul>`;
  });
  s = s.replace(/(^|\n)([^\n<][^\n]*)/g, (m, br, line) => `${br}<p>${line}</p>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  s = s.replace(/`([^`\n]+)`/g, '<code>$1<\/code>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1<\/a>');
  return s;
}

// Exportar para que otras UIs (app.ui.js) puedan usar el mismo formateo
if (typeof window !== 'undefined') {
  window.mdToHtml = mdToHtml;
}

// ==== Grouping por rol + ventana temporal (90s)
let _lastRole = null;
let _lastTs   = 0;
const GROUP_WINDOW_MS = 90 * 1000; // agrupa mensajes del mismo rol con < 90s de diferencia

function computeGroupState(role, ts) {
  const sameRole = _lastRole === role;
  const closeInTime = (ts - _lastTs) <= GROUP_WINDOW_MS;

  // Por defecto, este será el "last" (cuando llega, es el final del grupo)
  let state = 'group-last';

  if (sameRole && closeInTime) {
    // el mensaje anterior (si existe) deja de ser "last" y pasa a first/middle
    const container = document.getElementById('chat-messages');
    const prev = container?.lastElementChild;
    if (prev && prev.classList.contains(role)) {
      prev.classList.remove('group-last', 'tail');
      if (!prev.classList.contains('group-first') && !prev.classList.contains('group-middle')) {
        prev.classList.add('group-first');
      } else {
        prev.classList.add('group-middle');
      }
    }
    state = 'group-last'; // este nuevo cierra el grupo (muestra hora y tail)
  } else {
    // inicia un grupo nuevo; este queda como last (mostrar meta+tail)
  }

  _lastRole = role;
  _lastTs   = ts;
  return state;
}

// ===== Burbujas mejoradas (stack) =====
function appendMsg(role, text, opts={}){
  const container = byId('chat-messages');
  daySeparatorIfNeeded(container, new Date());

  const ts = Date.now();
  const groupState = computeGroupState(role, ts);

  const wrap = document.createElement('div');
  wrap.className = `msg ${role} ${groupState} tail`;
  wrap.innerHTML = `
    <div class="content">${ typeof mdToHtml === 'function' ? mdToHtml(text) : text }</div>
    <div class="meta">
      <span class="time">${ new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) }</span>
      <span class="ticks">${opts.status === 'error' ? '✖' : (role === 'user' ? '✔✔' : '')}</span>
    </div>
    <div class="tools">
      <button class="tool copy" title="Copiar">⧉</button>
      ${opts.failed ? `<button class="tool retry" title="Reintentar">↻</button>` : ''}
    </div>
  `;

  // Acciones
  wrap.querySelector('.copy')?.addEventListener('click', async ()=>{
    try { await navigator.clipboard.writeText(wrap.querySelector('.content').innerText); } catch {}
  });
  wrap.querySelector('.retry')?.addEventListener('click', ()=>{
    byId('chat-input').value = text; byId('chat-input').focus();
  });

  container.appendChild(wrap);
  if (window.App?.ui?.scrollToBottom) {
    window.App.ui.scrollToBottom('smooth');
  } else {
    container.scrollTo({ top: container.scrollHeight, behavior:'smooth' });
  }
  return wrap;
}

// Función auxiliar para separar mensajes por día (placeholder)
function daySeparatorIfNeeded(container, date) {
  // Implementar lógica de separación por día si es necesario
}

// Funciones auxiliares para herramientas de mensajes
function copyMessage(button) {
  const content = button.closest('.msg').querySelector('.content').textContent;
  navigator.clipboard.writeText(content).then(() => {
    showToast('Mensaje copiado al portapapeles');
  });
}

function retryMessage(button) {
  // Por implementar - reintentar el último mensaje
  showToast('Función de reintento pendiente');
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

function setBusy(b){
  $('#chat-input').disabled = b;
  $('#chat-send').disabled = b;
  $('#chat-send').textContent = b ? 'Enviando…' : 'Enviar';
}

// Indicador “escribiendo…” como burbuja mini
function setTyping(on){
  const container = byId('chat-messages');
  if (on && !state.typingEl){
    state.typingEl = document.createElement('div');
    state.typingEl.className = 'typing-bubble';
    state.typingEl.innerHTML = `<span>Alma está escribiendo</span><span class="dot3"><i></i><i></i><i></i></span>`;
    container.appendChild(state.typingEl);
    if (window.App?.ui?.scrollToBottom) {
      window.App.ui.scrollToBottom('smooth');
    } else {
      container.scrollTo({ top: container.scrollHeight, behavior:'smooth' });
    }
  } else if (!on && state.typingEl){
    state.typingEl.remove(); state.typingEl = null;
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

    // No creamos conversación aún; esperamos al "Comenzar"
    // Preparar eventos y UI

    // Eventos de envío
    const doSend = async () => {
      // Auto-inicio: si aún no hay conversación, dispara la experiencia
      if (!state.conversationId) await startExperience();

      const input = $('#chat-input');
      const txt = (input.value || '').trim();
      if (!txt || !state.conversationId) return;

      appendMsg('user', txt);
      input.value = '';
      updateCharCount();
      setBusy(true);
      setTyping(true);

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
        // Mostrar botón de reintento
        const lastMsg = $('#chat-messages').lastElementChild;
        if (lastMsg && lastMsg.classList.contains('msg')) {
          const retryBtn = document.createElement('button');
          retryBtn.className = 'btn danger';
          retryBtn.textContent = 'Reintentar';
          retryBtn.onclick = () => {
            lastMsg.remove();
            doSend();
          };
          lastMsg.appendChild(retryBtn);
        }
      } finally {
        setTyping(false);
        setBusy(false);
      }
    };

    // Solo configurar eventos si el chat está inicializado
    function setupEventListeners() {
      $('#chat-send').addEventListener('click', () => {
        if (!state.conversationId) return; // requiere iniciar
        doSend();
      });

      const input = $('#chat-input');
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (!state.conversationId) return; // requiere iniciar
          doSend();
        }
      });

      // Contador de caracteres + ocultar typing si el usuario escribe
      input.addEventListener('input', () => {
        updateCharCount();
        if (state.typingEl) setTyping(false);
      });

    }

    // Configurar eventos (sin iniciar)
    setupEventListeners();
    hookHeaderButtons();

    // Placeholder más corto en móvil
    if (window.matchMedia('(max-width: 480px)').matches) {
      const ci = byId('chat-input');
      if (ci) ci.placeholder = 'Escribe un mensaje…';
    }

    // Elevar footer cuando aparece el teclado (visualViewport)
    installKeyboardLift();

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

// Función para limpiar el chat
function clearChat() {
  $('#chat-messages').innerHTML = '';
  localStorage.removeItem('alma:lastConv');
  appendMsg('assistant', '💬 Chat limpiado. ¿En qué puedo ayudarte?');
}

// Reset de conversación (UI y estado)
function resetConversation(showIntro = true) {
  // Limpiar estado y pantalla
  localStorage.removeItem('alma:lastConv');
  state.conversationId = null;
  const badge = byId('conv-badge');
  if (badge) badge.textContent = '';
  const main = byId('chat-messages');
  if (main) main.innerHTML = '';

  // Deshabilitar input hasta que se inicie de nuevo
  const input = byId('chat-input');
  if (input) input.disabled = true;

  // Mostrar intro si existe
  if (showIntro) {
    byId('intro')?.classList.remove('hidden');
    byId('reveal')?.classList.remove('play');
  }
}

// Botones de header: Nueva y Limpiar (solo UI)
function hookHeaderButtons() {
  byId('btn-new')?.addEventListener('click', () => {
    resetConversation(true);
    byId('chat-messages')?.scrollTo({ top: 0, behavior: 'smooth' });
  });

  byId('btn-clear')?.addEventListener('click', () => {
    const main = byId('chat-messages');
    if (main) main.innerHTML = '';
    // Nota: Limpiar no borra la conversación almacenada
  });
}

// Inicia la experiencia: animación, oculta intro, asegura conversación y muestra chat
async function startExperience(){
  const reveal = byId('reveal');
  const intro = byId('intro');
  const input = byId('chat-input');
  const wrap = byId('chat-wrap');

  // Animación de degradé
  if (reveal) reveal.classList.add('play');

  // Ocultar overlay
  if (intro) intro.classList.add('hidden');

  // Espera breve y asegura conversación
  await new Promise(r => setTimeout(r, 300));
  await ensureConversation();

  // Habilitar UI y aparición
  if (input) input.disabled = false;
  if (wrap) wrap.classList.add('fade-in');

  // Mensaje inicial
  appendMsg('assistant',
    localStorage.getItem('alma:lastConv')
      ? '🔄 Continuando conversación existente...'
      : '👋 ¡Hola! ¿En qué puedo ayudarte hoy?'
  );

  // Enfocar
  setTimeout(()=> input && input.focus(), 100);
}

// Garantiza una conversación activa (carga existente o crea nueva)
async function ensureConversation(){
  if (state.conversationId) return state.conversationId;
  const saved = localStorage.getItem('alma:lastConv');
  if (saved) {
    state.conversationId = saved;
    const badge = byId('conv-badge');
    if (badge) badge.textContent = state.conversationId ? `Conversación #${state.conversationId.slice(0, 8)}` : '';
    return saved;
  }
  const conv = await createConversation();
  const id = conv?.id || conv?.conversationId || conv?.uuid;
  state.conversationId = id;
  localStorage.setItem('alma:lastConv', id);
  const badge = byId('conv-badge');
  if (badge) badge.textContent = state.conversationId ? `Conversación #${state.conversationId.slice(0, 8)}` : '';
  return id;
}

// Función para actualizar contador de caracteres
function updateCharCount() {
  const input = $('#chat-input');
  const count = input.value.length;
  $('#char-count').textContent = `${count}`;
  $('#char-count').style.color = count > 900 ? '#ef4444' : count > 800 ? '#f59e0b' : '';
}

// Funciones auxiliares para herramientas de mensajes
function copyMessage(button) {
  const content = button.closest('.msg').querySelector('.content').textContent;
  navigator.clipboard.writeText(content).then(() => {
    showToast('Mensaje copiado al portapapeles');
  });
}

function retryMessage(button) {
  // Por implementar - reintentar el último mensaje
  showToast('Función de reintento pendiente');
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}