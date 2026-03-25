// app.main.js
// Orquesta: layout, eventos, envío/recepción.

// === Config de API (soporta file:// y http/https) ===
const DEFAULT_API_HOST = 'https://ofertas-de-exito-backend.vercel.app';
// Permite override vía ventana si luego lo necesitas: window.__ALMA_API__ = 'https://...'
const API_HOST =
  (typeof window !== 'undefined' && window.__ALMA_API__)
    ? window.__ALMA_API__
    : (location.protocol === 'http:' || location.protocol === 'https:' )
        ? ''    // servido por http/https -> usar rutas relativas
        : DEFAULT_API_HOST; // file:// -> usar dominio público
// Prefijo real que usará fetch
const API_BASE = `${API_HOST}/api/supax`;
const CLIENT_ID = (function(){ try{ return App.api.getClientId?.() || App.api.ensureClientId?.() }catch{ return 'CLIENT_' + Math.random().toString(36).slice(2,10) } })();
const commonHeaders = { 'x-client-id': CLIENT_ID, 'Content-Type': 'application/json' };
const ALMA_SLOGAN = 'Ambición, Liderazgo, Motivo y Acción para tu futuro';
// Saludo optimista único
window.ALMA_GREETING = window.ALMA_GREETING || '¡Hola! Soy Alma — tu asistente IA para crear tu **oferta irresistible**. ¿En qué puedo ayudarte hoy?';

// Config saludo único por conversación
const WELCOME_TEXT = '¡Hola! Soy Alma — tu asistente IA para crear tu **oferta irresistible**. ¿En qué puedo ayudarte hoy?';
const shownWelcome = new Map();

// Sincroniza con capas existentes
window.App = window.App || {};
// Compatibilidad: helpers legacy usan App.apiBase + '/api/supax'
App.apiBase = API_HOST;
// Nueva config centralizada
App.config = Object.assign({}, App.config || {}, { apiBase: API_BASE });
App.state = App.state || {};
App.state.clientId = CLIENT_ID;
// Persistente: conversación actual
try{ App.state.conversationId = App.api.getConversationId?.() || App.state.conversationId; }catch{}

// Helpers UI mínimos equivalentes
function clearChatUI(){ const box = document.getElementById('chat-messages'); if (box) box.innerHTML=''; }
function appendUser(t){ return App.ui.appendMsg('user', t); }
function appendAssistant(t, opts){ return App.ui.appendMsg('assistant', t, opts); }
function appendSystem(t){ return App.ui.appendMsg('assistant', t, { failed:true }); }
function scrollToBottom(){ App.ui.scrollToBottom('smooth'); }

// Indicador “typing” con retardo mínimo para evitar parpadeo
function minDelay(promise, ms = 400){
  return Promise.all([ promise, new Promise(r => setTimeout(r, ms)) ])
    .then(([result]) => result);
}
function showTyping(){ App.ui.setTyping?.(true); }
function hideTyping(){ App.ui.setTyping?.(false); }

function showWelcomeOnce(convId){
  if (!convId) return;
  if (shownWelcome.get(convId)) return;
  App.ui.appendMsg('assistant', WELCOME_TEXT);
  shownWelcome.set(convId, true);
}

// Guardia anti-duplicado de saludo
function isWelcomeDuplicate(content){
  return typeof content === 'string' && content.trim() === WELCOME_TEXT;
}
function addAssistantSafe(text){
  if (isWelcomeDuplicate(text) && shownWelcome.get(App.state.conversationId)) return;
  App.ui.appendMsg('assistant', text);
}

// Export helper para otros módulos (app.ui.js)
window.showWelcomeOnce = showWelcomeOnce;

document.addEventListener('DOMContentLoaded', () => {
  // Inicializa portada según flags y mensajes existentes
  try{ App.ui.initWelcome?.(); }catch{}
  {
  const el = document.getElementById('chat-slogan');
  if (el) { el.textContent = ALMA_SLOGAN; el.title = ALMA_SLOGAN; }
}
  // 1) Layout + ajustes móviles
  App.ui.ensureLayout();
  // Evita centrados accidentales en header aplicados por estilos inline antiguos
  const headerEl = document.querySelector('.chat-header');
  headerEl?.style.removeProperty('justify-content');
  App.ui.installKeyboardLift();

  // === iOS focus + scroll helpers ===
  const isiOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function focusComposer(){
    const ta = document.querySelector('#chat-input');
    if (!ta) return;
    try{ ta.focus({ preventScroll: true }); }catch{ try{ ta.focus(); }catch{} }
    setTimeout(()=>{ try{ ta.scrollIntoView({ block:'center', behavior:'smooth' }); }catch{} }, 0);
  }

  function restoreViewportAfterSend(){
    // Solo aplicamos este fix en móviles, donde el teclado/zoom es problemático
    if (!isiOS() && window.innerWidth > 768) return;
    try{
      const ta = document.querySelector('#chat-input');
      ta?.blur();
      if (document.activeElement && document.activeElement !== ta && document.activeElement.blur) {
        document.activeElement.blur();
      }
    }catch{}
    try{
      const vv = window.visualViewport;
      if (vv && vv.scrollTo) vv.scrollTo(0, 0);
    }catch{}
    try{
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }catch{}
  }

  // Atributos del textarea para mejor UX móvil
  (function tuneTextarea(){
    const ta = document.querySelector('#chat-input');
    if (!ta) return;
    ta.setAttribute('rows','1');
    ta.setAttribute('inputmode','text');
    ta.setAttribute('enterkeyhint','send');
    ta.setAttribute('autocapitalize','sentences');
    ta.setAttribute('autocomplete','on');
    ta.setAttribute('spellcheck','true');
    if (!ta.getAttribute('placeholder')) ta.setAttribute('placeholder','Escribe tu mensaje… (Shift+Enter = salto)');
  })();

  const row = document.querySelector('#chat-input-row');
  row?.addEventListener('click', () => focusComposer(), { passive: true });
  row?.addEventListener('touchend', () => { if (isiOS()) focusComposer(); }, { passive: true });

  window.addEventListener('resize', () => {
    if (!isiOS()) return;
    const ta = document.querySelector('#chat-input');
    if (document.activeElement === ta){
      setTimeout(() => { try{ ta.scrollIntoView({ block:'center' }); }catch{} }, 50);
    }
  });
  // Ajuste inicial de padding inferior según footer
  App.ui.updateFooterPadding?.();

  // Boot: cargar SIEMPRE la conversación actual
  (async ()=>{
    try{
      const convId = App.state.conversationId;
      const box = document.getElementById('chat-messages'); if (box) box.innerHTML='';
      if (!convId){ App.ui.setWelcomeOpen?.(true); return; }
      const hist = await App.api.fetchHistory?.(convId, 50).catch(()=> []);
      if (Array.isArray(hist) && hist.length > 0){
        for (const m of hist){
          const role = (m.role === 'assistant' || m.role === 'bot') ? 'assistant' : 'user';
          const text = m.content || m.message || '';
          if (!text) continue;
          if (role === 'assistant') { addAssistantSafe(text); } else { App.ui.appendMsg(role, text); }
        }

        // Forzar que el scroll quede SIEMPRE en el último mensaje tras recargar
        const forceScroll = ()=>{
          try{
            const scrollBox = box?.closest?.('.chat-messages-wrapper') || box;
            if (!scrollBox) return;
            scrollBox.scrollTop = scrollBox.scrollHeight;
            App.ui.scrollToBottom('auto');
          }catch{}
        };
        // Varios intentos para cubrir conversaciones largas y layouts perezosos
        forceScroll();
        setTimeout(forceScroll, 50);
        setTimeout(forceScroll, 200);


        try{ App.ui.setWelcomeOpen?.(false); }catch{}
      } else {
        App.ui.setWelcomeOpen?.(true);
      }
    }catch{ App.ui.setWelcomeOpen?.(true); }
  })();

  // 2) Botones header
  App.actions = App.actions || {};
  App.actions.onNew = async () => {
  	try{
  		App.ui.disableHeader?.(true);
  		// 1) nuevo ID persistente
		  let conv = null;
		  try{
			conv = await App.api.createConversation({ title: 'Nueva conversación' });
		  }catch(e){
			console.error('[Nueva] createConversation failed', e);
			const fallbackId = (App.api.genId?.() || ('conv_' + Date.now().toString(36)));
			App.api.setConversationId?.(fallbackId);
			App.state.conversationId = fallbackId;
		  }
		  const convId = conv?.id || App.state.conversationId;
		  if (convId){
			App.api.setConversationId?.(convId);
			App.state.conversationId = convId;
		  }
		  // 2) limpiar SOLO UI
		  if (typeof App.ui.renderMessages === 'function') App.ui.renderMessages([]); else clearChatUI();
		  try{ const c = document.getElementById('chat-messages'); c?.scrollTo({ top: 0, behavior: 'auto' }); }catch{}
		  // 3) mostrar de nuevo el hero estático (pantalla de bienvenida)
		  try{
			App.ui.setWelcomeOpen?.(false);
			if (convId){
			  const hist = await App.api.fetchHistory?.(convId, 50).catch(()=> []);
			  if (Array.isArray(hist) && hist.length > 0){
				for (const m of hist){
				  const role = (m.role === 'assistant' || m.role === 'bot') ? 'assistant' : 'user';
				  const text = m.content || m.message || '';
				  if (!text) continue;
				  if (role === 'assistant') { addAssistantSafe(text); } else { App.ui.appendMsg(role, text); }
				}
				App.ui.scrollToBottom('auto');
			  }
			}
			const hero = document.getElementById('hero');
			const appRoot = document.getElementById('app-root');
			if (hero && appRoot){
			  hero.style.display = 'none';
			  appRoot.classList.add('is-visible');
			  window.scrollTo({ top: 0, behavior: 'instant' });
			}
		  }catch{}
  	}catch(e){ console.error('[Nueva] error', e); }
  	finally{ App.ui.disableHeader?.(false); }
  };

  // Exponer alias público para integraciones
  window.App = window.App || {}; window.App.main = window.App.main || {};
  App.main.sendMessage = ()=> doSend();
  // Hooks de estado de envío por defecto
  App.main.onSendStart = App.main.onSendStart || (function(){ const b=document.getElementById('btn-send'); if (b) b.disabled=true; });
  App.main.onSendEnd   = App.main.onSendEnd   || (function(){
    const b=document.getElementById('btn-send');
    if (b) b.disabled=false;
    const ta=document.getElementById('chat-input');
    // En desktop volvemos a enfocar; en mobile soltamos foco para evitar zoom
    if (ta && !isiOS() && window.innerWidth > 768) {
      ta.focus();
    } else {
      restoreViewportAfterSend();
    }
  });
  document.getElementById('btn-new')?.addEventListener('click', App.actions.onNew);
  (document.getElementById('new-conversation-btn') || document.querySelector('[data-role="new-conversation"]'))?.addEventListener('click', App.actions.onNew);

  // --- Limpieza local/remota (idempotente) ---
  const LOCAL_CLEAR_ONLY = true; // <- estrategia por defecto

  function clearConversationLocal(){
    try{ App.state.messages = []; }catch{}
    try{ App.state.tokensIn = 0; App.state.tokensOut = 0; }catch{}

    // UI
    if (App.ui.renderMessages) App.ui.renderMessages([]);
    else if (App.ui.clearMessagesUI) App.ui.clearMessagesUI();
    if (App.ui.updateTokens) App.ui.updateTokens(0); else if (App.ui.updateTokenCounter) App.ui.updateTokenCounter(0);
    if (App.ui.updateChars) App.ui.updateChars(0);
    if (App.ui.setTyping) App.ui.setTyping(false);
    if (App.ui.focusInput) App.ui.focusInput(); else if (App.ui.focusComposer) App.ui.focusComposer();
    App.ui.scrollToBottom?.('auto');
  }

  async function clearConversationRemoteBestEffort(){
    try{
      const convId = (App.state.getConversationId?.() || App.state.conversationId);
      if (!convId) return;
      await fetch(apiUrl(`/conversations/${encodeURIComponent(convId)}/messages`), {
        method: 'DELETE',
        headers: { 'x-client-id': App.state.clientId }
      });
    }catch(_){ /* no-op */ }
  }

  // Exponer acciones y conectar botón
  App.actions = App.actions || {};
  App.actions.onClear = async ()=>{
    // Solo visual: no cambiamos ID ni llamamos backend
    try{ App.state.messages = []; }catch{}
    if (App.ui.renderMessages) App.ui.renderMessages([]); else clearChatUI();
    try{ const c = document.getElementById('chat-messages'); c?.scrollTo({ top: 0, behavior: 'auto' }); }catch{}
  };
  document.getElementById('btn-clear')?.addEventListener('click', App.actions.onClear);
  (document.getElementById('clear-conversation-btn') || document.querySelector('[data-role="clear-conversation"]'))?.addEventListener('click', App.actions.onClear);

  // 3) Input + enviar
  const input = document.getElementById('chat-input');
  const sendBtn  = document.getElementById('btn-send') || document.getElementById('send-button');
  const form = document.getElementById('chat-form');
  const count = document.getElementById('msg-count');

  const updateCount = ()=> count && (count.textContent = String(input.value.length));
  input?.addEventListener('input', ()=>{
    updateCount();
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 180) + 'px';
    App.ui.updateFooterPadding?.();
    App.ui.scrollToBottom('auto');
  });
  updateCount();

  const doSend = async ()=>{
    const text = (input.value||'').trim();
    if (!text) return;
    if (App.msg.sending) return; // guard anti-spam
    App.msg.sending = true;

    try{
      // 0) asegurar conversación (crea y guarda id si no existe)
      if (!App.state.conversationId) {
        try{
          const conv = await App.api.createConversation({ title: 'Nueva conversación' });
          if (conv?.id) App.state.conversationId = conv.id;
        }catch(e){ console.warn('No se pudo crear conversación previa al envío', e); }
      }

      // 1) optimista: cierro welcome y pinto user
      try{ App.ui.setWelcomeOpen?.(false); }catch{}
      const userMsg = App.msg.push('user', text, 'pending');
      App.ui.appendMsg('user', text);
      input.value=''; input.style.height='auto'; const cc=document.getElementById('msg-count'); if (cc) cc.textContent='0';
      App.ui.scrollToBottom('auto');

      // 2) bloqueo breve de UI + typing
      input.disabled = true;
      try{ App.main?.onSendStart?.(); }catch{}
      showTyping();

      // 3) envío real (idempotencia)
      const clientMsgId = (crypto?.randomUUID?.() || App.msg.genId());
      const res = await minDelay(
        fetch(apiUrl(`/conversations/${encodeURIComponent(App.state.conversationId)}/messages`), {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify({ content: text, clientMsgId })
        })
      , 400);
      if (!res.ok){
        const body = await res.text().catch(()=> '');
        throw new Error(`HTTP ${res.status} ${body}`);
      }
      App.msg.setStatus(userMsg.id, 'sent');

      // 4) respuesta del asistente
      const json = await res.json();
      const data = json?.data ?? json;
      const aiText = json?.data?.content ?? data?.content ?? data?.message?.content ?? '…';

      hideTyping();
      addAssistantSafe(aiText);
      App.ui.scrollToBottom('smooth');
      input.disabled = false;
      // Desktop: mantener foco. Mobile: soltar foco y restaurar viewport.
      if (!isiOS() && window.innerWidth > 768) {
        input.focus();
      } else {
        restoreViewportAfterSend();
      }
      try{ App.main?.onSendEnd?.(); }catch{}
    }
    catch(err){
      console.error(err);
      App.ui.setTyping(false);
      App.ui.appendMsg('assistant', '⚠️ No pude enviar. Reintenta.', { failed:true });
      input.disabled = false;
      if (!isiOS() && window.innerWidth > 768) {
        input.focus();
      } else {
        restoreViewportAfterSend();
      }
      try{ App.main?.onSendEnd?.(); }catch{}
    }
    finally{
      App.msg.sending = false;
    }
  };

  // Enter con debounce y sin duplicar
  let enterLock = false;
  input?.addEventListener('keydown', (e)=>{
    if (e.key==='Enter' && !e.shiftKey){
      e.preventDefault();
      if (enterLock) return;
      enterLock = true;
      doSend().finally(()=> enterLock = false);
    }
  });
  // Click en botón de enviar (soporta btn-send legacy y send-button actual)
  sendBtn?.addEventListener('click', (e)=>{
    e?.preventDefault?.();
    if (!enterLock){ enterLock = true; doSend().finally(()=> enterLock=false); }
  }, { passive: false });
  // iOS Safari / WebView: asegura envío en touchend
  sendBtn?.addEventListener('touchend', (e)=>{
    e?.preventDefault?.();
    if (!enterLock){ enterLock = true; doSend().finally(()=> enterLock=false); }
  }, { passive: false });

  // Submit del formulario: siempre enruta a doSend para reutilizar la lógica de typing
  form?.addEventListener('submit', (e)=>{
    e?.preventDefault?.();
    if (!enterLock){ enterLock = true; doSend().finally(()=> enterLock=false); }
  });

  // 4) Mostrar SIEMPRE la intro al entrar; el chat inicia con “Comenzar”
  document.getElementById('intro')?.classList.remove('hidden');
  // Eventos globales
  window.addEventListener('resize', ()=> App.ui.updateFooterPadding?.());
});
