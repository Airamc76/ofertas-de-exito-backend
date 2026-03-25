// app.ui.js
// Render de UI: layout, burbujas, typing, teclado móvil.

window.App = window.App || {};
const $ = (s)=>document.querySelector(s);

// Formateador local para mensajes del asistente (bloques por emojis)
function formatAssistantText(raw){
  if (!raw) return '';
  let s = String(raw);

  // Escapar HTML básico
  s = s.replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
  }[m] || m));

  // Normalizar: si todo viene en una sola línea, forzar saltos antes de emojis de bloque
  const emojiPattern = '(💡|🎯|🧩|📦|🛡️|🚀|👉|🔥)';
  const emojiReInline = new RegExp('\\s+'+emojiPattern+'\\s+','g');
  s = s.replace(emojiReInline, '\n$1 ');
  const emojiAfterPunct = new RegExp('([\\.\\!\\?])\\s+'+emojiPattern+'\\s+','g');
  s = s.replace(emojiAfterPunct, '$1\n$2 ');

  // Procesar línea por línea
  const lines = s.split(/\n+/).map(l=>l.trim()).filter(Boolean);
  const out = [];

  for (const line of lines){
    // Caso: "💡 **Diagnóstico** resto..."
    const m = line.match(/^(💡|🎯|🧩|📦|🛡️|🚀|👉|🔥)\s+\*\*([^*]+)\*\*(.*)$/);
    if (m){
      const emoji = m[1];
      const title = m[2].trim();
      const rest  = m[3].trim();
      out.push(`<p class="chat-heading"><strong>${emoji} ${title}<\/strong><\/p>`);
      if (rest) out.push(`<p>${rest}<\/p>`);
      continue;
    }

    // Bullets simples "- **Etiqueta**: texto"
    const b = line.match(/^-[ \t]+\*\*([^*]+)\*\*:(.*)$/);
    if (b){
      const label = b[1].trim();
      const rest  = b[2].trim();
      out.push(`<p><strong>${label}<\/strong>: ${rest}<\/p>`);
      continue;
    }

    // Línea normal
    out.push(`<p>${line}<\/p>`);
  }

  return out.join('\n');
}

App.ui = {
  ensureLayout() {
    // Si la página host ya tiene un hero propio, no construimos nuestro layout
    if (document.getElementById('hero')) return;
    if (document.getElementById('chat-root')) return;

    // Welcome card (nuevo hero con logo + glow + eslogan)
    const welcome = document.createElement('section');
    welcome.id = 'welcome';
    welcome.className = 'welcome-wrap';
    welcome.innerHTML = `
      <div class="welcome-card">
        <div class="wc-icon"></div>
        <h1 class="wc-title">Alma</h1>
        <p class="wc-sub">Ambición, Liderazgo, Motivo y Acción para tu futuro</p>
        <ul class="wc-points">
          <li>Tu asistente de <strong>copywriting</strong> profesional.</li>
        </ul>
        <button id="btn-start" class="wc-cta">Comenzar</button>
      </div>
    `;

    // Degradé
    const reveal = document.createElement('div');
    reveal.id = 'reveal';

    // Chat
    const root = document.createElement('div');
    root.id = 'chat-root';
    root.className = 'chat-wrap';
    root.innerHTML = `
      <header class="chat-header">
        <div class="chat-header__brand">
          <span class="dot dot--online"></span>
          <span class="brand">Alma</span>
          <span class="muted">· conectada</span>
        </div>
        <div class="header-actions">
          <button id="btn-new" class="btn btn--primary">Nueva</button>
          <button id="btn-clear" class="btn btn--ghost">Limpiar</button>
        </div>
      </header>
      <main id="chat-messages" class="chat-main messages-scroll"></main>
      <div id="typing-indicator" class="typing-indicator" aria-hidden="true">
        <span class="typing-label">Alma está escribiendo</span>
        <span class="typing-dots">
          <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
        </span>
      </div>
      <footer class="chat-footer">
        <div id="chat-input-row" class="input-row">
          <div class="composer">
            <div class="input-wrap">
              <textarea id="chat-input" rows="1" placeholder="Escribe tu mensaje… (Shift+Enter = salto de línea)"></textarea>
              <span class="chip" id="msg-count">0</span>
            </div>
            <button id="btn-send" type="button" class="btn">Enviar</button>
          </div>
        </div>
      </footer>
    `;

    document.body.appendChild(root);
    document.body.appendChild(reveal);
    document.body.appendChild(welcome);

    $('#chat-input').disabled = true;

    // Cualquier clic en la barra de entrada enfoca el textarea
    try{
      const inputWrap = root.querySelector('.input-wrap');
      const chatInput = root.querySelector('#chat-input');
      if (inputWrap && chatInput){
        inputWrap.addEventListener('click', () => { chatInput.focus(); });
      }
    }catch{/* no-op */}

    // Ensure Welcome markup matches spec (section#welcome with data-state)
    (function ensureWelcomeMarkup(){
      const existing = document.getElementById('welcome');
      const markup = `
<!-- Bienvenida: overlay accesible fuera del chat -->
<section id="welcome" class="welcome" hidden aria-labelledby="welcome-title" aria-describedby="welcome-subtitle">
  <div class="welcome__backdrop"></div>
  <div class="welcome__card" role="dialog" aria-modal="true">
    <div class="welcome__logo">
      <img src="alma-logo-new.svg" alt="Logo de Alma" onerror="this.style.display='none'" />
    </div>
    <h1 id="welcome-title">Alma</h1>
    <p id="welcome-subtitle" class="welcome__subtitle">Ambición, Liderazgo, Motivo y Acción para tu futuro</p>
    <p class="welcome__tagline">tu asistente IA para crear tu <strong>oferta irresistible</strong></p>
    <button id="btn-start" class="btn btn-primary btn-lg" type="button">Comenzar</button>
  </div>
  <!-- Banner BETA SOLO para la bienvenida -->
  <div id="beta-banner" class="beta-banner" role="status" aria-live="polite">
    <span class="beta-pill">BETA</span>
    <span class="beta-text">
      Esta es una versión beta y puede contener errores. Para reportar un problema o solicitar soporte, escribe a
      <a href="mailto:soporte.alma.bot@gmail.com" class="beta-link">soporte.alma.bot@gmail.com</a>.
    </span>
    <button class="beta-close" aria-label="Cerrar aviso BETA" type="button">×</button>
  </div>
</section>

`;
      if (existing){ existing.outerHTML = markup; }
      else { document.body.insertAdjacentHTML('beforeend', markup); }
    })();

    const SHOW_KEY = 'alma.showWelcome';
    const hasMessages = ()=> (document.querySelectorAll('#chat-messages .msg-row').length > 0);
    const getShowWelcome = ()=>{
      const v = localStorage.getItem(SHOW_KEY);
      if (v == null) return true;
      return v === 'true' || v === '1';
    };
    const setShowWelcome = (flag)=>{
      localStorage.setItem(SHOW_KEY, String(!!flag));
    };
    // Accesible open/close with focus + hidden/inert
    const applyWelcomeOpen = (open)=>{
      document.body.classList.toggle('app--welcome-open', !!open);
    };
    const openWelcome = ()=>{
      const w = document.getElementById('welcome');
      const startBtn = document.getElementById('btn-start');
      if (!w) return;
      // Mostrar y habilitar: quitar hidden/inert/aria-hidden explícitamente
      w.hidden = false; w.removeAttribute('hidden');
      w.inert = false; w.removeAttribute('inert');
      try{ w.setAttribute('aria-hidden','false'); }catch{}
      applyWelcomeOpen(true);
      queueMicrotask(()=>{ try{ startBtn?.focus(); }catch{} });
    };
    const closeWelcome = ()=>{
      const w = document.getElementById('welcome');
      const input = document.getElementById('chat-input');
      if (!w) return;
      // move focus out first
      try{
        if (input) input.focus(); else document.body.focus?.({ preventScroll: true });
        if (w.contains(document.activeElement)) document.activeElement.blur();
      }catch{}
      try{ w.setAttribute('aria-hidden','true'); }catch{}
      w.inert = true;
      w.hidden = true;
      applyWelcomeOpen(false);
    };
    const renderWelcome = (open)=>{ if (open) openWelcome(); else closeWelcome(); };

    const setWelcomeOpen = (open)=>{
      renderWelcome(!!open);
      const body = document.body;
      if (open) { body.classList.add('app--welcome-open'); body.classList.remove('app--chat-open'); }
      else { body.classList.remove('app--welcome-open'); body.classList.add('app--chat-open'); }
      if (!open) requestAnimationFrame(()=> document.getElementById('chat-input')?.focus());
    };
    const initWelcome = ()=>{
      const showWelcome = getShowWelcome();
      const noMessages = !(Array.isArray(App.state?.messages) && App.state.messages.length > 0);
      const open = !!(showWelcome && noMessages);
      setWelcomeOpen(open);
      return open;
    };

    // expose helpers
    App.ui.getShowWelcome = getShowWelcome;
    App.ui.setShowWelcome = setShowWelcome;
    App.ui.setWelcomeOpen = setWelcomeOpen;
    App.ui.applyWelcomeOpen = applyWelcomeOpen;
    App.ui.WelcomeState = { getShowWelcome, setShowWelcome, setWelcomeOpen };
    App.ui.hasMessages = hasMessages;
    // alias conveniente
    App.ui.focusInput = function(){ try{ App.ui.focusComposer(); }catch{} };
    App.ui.clearMessagesUI = function(){
      const wrap = document.getElementById('chat-messages');
      if (wrap) wrap.innerHTML = '';
    };
    App.ui.updateTokenCounter = function(n){
      const el = document.getElementById('token-counter');
      if (el) el.textContent = String(n || 0);
    };

    // Optimistic assistant message injection
    App.ui.pushAssistant = (text)=>{
      try{
        const msg = { role: 'assistant', content: String(text || ''), ts: Date.now() };
        const current = Array.isArray(App.state?.messages) ? App.state.messages.slice() : [];
        current.push(msg);
        App.state.messages = current;
        if (App.ui.renderMessages) App.ui.renderMessages(current);
        else App.ui.appendMsg?.('assistant', msg.content);
        App.ui.scrollToBottom?.();
      }catch{}
    };

    // === Composer helpers ===
    App.ui.lockComposer = (lock)=>{
      const row = document.getElementById('chat-input-row');
      const ta  = document.getElementById('chat-input');
      const btn = document.getElementById('chat-send');
      if (!row || !ta || !btn) return;
      row.classList.toggle('is-locked', !!lock);
      ta.toggleAttribute('disabled', !!lock);
      ta.readOnly = !!lock;
      btn.toggleAttribute('disabled', !!lock);
    };
    App.ui.focusComposer = ()=>{
      const ta = document.getElementById('chat-input');
      if (!ta) return;
      ta.removeAttribute('disabled');
      ta.readOnly = false;
      setTimeout(()=> ta.focus(), 0);
    };

    App.ui.onWelcomeStart = function(){
      try{ setShowWelcome(false); }catch{}
      try{ setWelcomeOpen(false); }catch{}
      // Mostrar saludo efímero solo una vez por conversación (solo UI)
      try{ if (typeof window.showWelcomeOnce === 'function') window.showWelcomeOnce(App.state?.conversationId); }catch{}
      try{ App.ui.focusInput?.(); }catch{}
    };
    document.getElementById('btn-start')?.addEventListener('click', (e)=>{ e?.preventDefault?.(); App.ui.onWelcomeStart(); });

    // Cierre manual del banner sin salir del welcome (opcional)
    document.addEventListener('click', (e)=>{
      if (e?.target && e.target.matches('#welcome .beta-close')){
        const banner = document.getElementById('beta-banner');
        if (banner) banner.style.display = 'none';
      }
    });

    // ===== Aviso Beta (persistencia simple) ========================
    const BETA_KEY = 'alma.betaNote.hidden';
    function initBetaNote(){
      const betaEl = document.getElementById('beta-note');
      const closeBtn = document.getElementById('beta-dismiss');
      if (!betaEl || !closeBtn) return;
      const hidden = localStorage.getItem(BETA_KEY) === '1';
      if (hidden) betaEl.style.display = 'none';
      closeBtn.addEventListener('click', () => {
        betaEl.style.display = 'none';
        localStorage.setItem(BETA_KEY, '1');
      });
      window.AlmaBeta = {
        reset: () => {
          localStorage.removeItem(BETA_KEY);
          if (betaEl) betaEl.style.display = '';
        }
      };
    }
    document.addEventListener('DOMContentLoaded', initBetaNote);

    // ===== Toast BETA (persistencia y cerrar) =====
    const BETA_OUT_KEY = 'alma.betaNoteOut.hidden';
    function initBetaBanner(){
      const toast = document.getElementById('beta-banner');
      const close = toast?.querySelector('.beta-close');
      if (!toast || !close) return;
      if (localStorage.getItem(BETA_OUT_KEY) === '1') toast.style.display = 'none';
      close.addEventListener('click', ()=>{ toast.style.display = 'none'; localStorage.setItem(BETA_OUT_KEY, '1'); });
      window.AlmaBetaOut = { reset(){ localStorage.removeItem(BETA_OUT_KEY); toast.style.display = ''; } };
    }
    document.addEventListener('DOMContentLoaded', initBetaBanner);

    const open = initWelcome();
    renderWelcome(open);
    App.ui.lockComposer(open);
  },

  // Desplaza el contenedor de chat al final
  scrollToBottom(behavior = 'smooth'){
    const inner = document.getElementById('chat-messages');
    if (!inner) return;

    // Usar el contenedor scrollable real si existe
    const scrollBox = inner.closest('.chat-messages-wrapper') || inner;
    try{
      scrollBox.scrollTo({ top: scrollBox.scrollHeight, behavior });
    }catch{/* no-op */}
  },

  // Ajusta el padding inferior del área según altura real del footer
  updateFooterPadding(){
    try{
      const f = document.querySelector('.chat-footer');
      const h = f ? f.offsetHeight : 0;
      document.documentElement.style.setProperty('--footer-h', `${h}px`);
    }catch{/* no-op */}
  },

  // Bubbles estilo ChatGPT (apilado por rol)
  _stackRole: null, _stackTs: 0, STACK_MS: 90_000,

  computeStackClass(role, now){
    const same  = this._stackRole === role;
    const close = (now - this._stackTs) <= this.STACK_MS;
    let cls = 'stack-last';

    const container = document.getElementById('chat-messages');
    const prev = container?.lastElementChild;

    if (same && close && prev && prev.classList.contains(role)) {
      // el anterior pasa a middle (si no tenía stack, se marca first)
      if (!prev.classList.contains('stack-first') &&
          !prev.classList.contains('stack-middle') &&
          !prev.classList.contains('stack-last')) {
        prev.classList.add('stack-first');
      } else {
        prev.classList.remove('stack-first','stack-last');
        prev.classList.add('stack-middle');
      }
      cls = 'stack-last';
    } else {
      cls = 'stack-first';
    }

    this._stackRole = role;
    this._stackTs = now;
    return cls;
  },

  appendMsg(role, text, opts = {}){
    const container = document.getElementById('chat-messages');
    if (!container) return null;

    const now = Date.now();
    const stackCls = this.computeStackClass(role, now);

    const row = document.createElement('div');
    row.className = `msg-row ${role} ${stackCls}`;

    // Burbuja dentro de la fila
    const bubble = document.createElement('div');
    bubble.className = `msg ${role}`;

    // Busca un formateador markdown disponible (App.ui.mdToHtml o window.mdToHtml)
    let html;
    if (role === 'assistant') {
      html = formatAssistantText(text);
    } else {
      // Usuario u otros roles: mostrar texto plano escapado en un solo párrafo
      const esc = (text || '').toString().replace(/[&<>"']/g, m => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
      }[m] || m));
      html = `<p>${esc}<\/p>`;
    }
    bubble.innerHTML = `<div class="content">${html}</div>`;

    // Nuevas clases de burbuja para el layout estático
    bubble.classList.add('chat-message');
    if (role === 'user' || role === 'human') {
      bubble.classList.add('chat-message--user');
    } else {
      // assistant / alma / system / otros
      bubble.classList.add('chat-message--alma');
    }
    if (opts.failed) bubble.classList.add('failed');

    row.appendChild(bubble);
    container.appendChild(row);

    // padding + autoscroll
    App.ui.updateFooterPadding();
    App.ui.scrollToBottom('smooth');
    return bubble;
  },

  setTyping(on){
    const container = document.getElementById('chat-messages');
    if (!container) return;

    let typingEl = document.getElementById('typing-indicator');

    // Si no existe en el DOM, lo creamos dinámicamente
    if (!typingEl) {
      typingEl = document.createElement('div');
      typingEl.id = 'typing-indicator';
      typingEl.className = 'typing-indicator';
      typingEl.setAttribute('aria-hidden', 'true');
      typingEl.innerHTML = `
        <div class="typing-dots">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
        <span class="typing-label">Alma está pensando…</span>
      `;
      container.appendChild(typingEl);
    }

    if (on) {
      // Siempre lo movemos al final del contenedor para que aparezca
      // debajo del último mensaje, incluso si ya era hijo de container.
      container.appendChild(typingEl);
      typingEl.classList.add('visible');
      typingEl.setAttribute('aria-hidden', 'false');
      // Fuerza visibilidad aunque algún CSS externo interfiera
      typingEl.style.display = 'inline-flex';
      App.ui.scrollToBottom('smooth');
    } else {
      typingEl.classList.remove('visible');
      typingEl.setAttribute('aria-hidden', 'true');
      typingEl.style.display = 'none';
    }
  },

  installKeyboardLift(){
    const root = document.documentElement;
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = ()=>{
      const offset = Math.max(0, window.innerHeight - vv.height);
      root.style.setProperty('--kb-offset', offset + 'px');
      App.ui.updateFooterPadding();
      App.ui.scrollToBottom('auto');
    };
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    window.addEventListener('orientationchange', onResize);
    onResize();
  },

  async startExperience() {
    // reveal + ocultar intro
    const reveal = $('#reveal'); const intro = $('#intro');
    reveal?.classList.add('play');
    intro?.classList.add('hidden');
    await new Promise(r=>setTimeout(r, 300));

    // conversación
    if (!App.state.conversationId) {
      await App.api.createConversation();
    } else {
      App.stateHelpers.setConversation(App.state.conversationId);
    }

    // habilitar input + saludo
    $('#chat-input').disabled = false;
    App.ui.appendMsg('assistant', '👋 ¡Hola! ¿En qué puedo ayudarte hoy?');
    setTimeout(()=> $('#chat-input').focus(), 120);
  },
};

// Usa el formateador markdown global si existe (encabezados, listas, etc.)
if (typeof window.mdToHtml === 'function') {
  App.ui.mdToHtml = window.mdToHtml;
}

// export para consola
window.appendMsg = (role, text, opts)=> App.ui.appendMsg(role, text, opts);

// Auto-resize del textarea del composer y helper de foco
(function autoResizeComposer(){
  const ta = document.getElementById('chat-input');
  if (!ta) return;
  const fit = ()=>{
    try{
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
    }catch{/* no-op */}
  };
  ta.addEventListener('input', fit);
  window.addEventListener('load', fit);
  window.focusComposer = ()=>{ try{ ta.focus(); fit(); }catch{} };
})();
