// app.state.js
// Estado global mínimo + utilidades de storage.

window.App = window.App || {};

// === Cola de mensajes y estados (pending/sent/failed) ===
App.msg = {
  sending: false,             // guard contra doble envío
  queue: [],                  // [{id, role, text, status}]
  genId() { return 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); },

  push(role, text, status='pending'){
    const id = this.genId();
    const item = { id, role, text, status };
    this.queue.push(item);
    return item;
  },
  setStatus(id, status){
    const it = this.queue.find(x=>x.id===id);
    if (it) it.status = status;
    return it;
  }
};

App.state = {
  clientId: null,
  conversationId: null,
};

(function initState() {
  // clientId persistente
  let cid = localStorage.getItem('clientId') || localStorage.getItem('alma:userId');
  if (!cid) cid = 'anon-' + Date.now();
  localStorage.setItem('clientId', cid);
  App.state.clientId = cid;

  // conversación previa (si existe)
  const savedConv = localStorage.getItem('alma:lastConv');
  if (savedConv) App.state.conversationId = savedConv;

  // API base (permite usar window.API si ya la defines en index.html)
  App.apiBase = window.API || 'https://ofertas-de-exito-backend.vercel.app';
})();

// helpers
App.stateHelpers = {
  setConversation(id) {
    App.state.conversationId = id;
    localStorage.setItem('alma:lastConv', id);
    const badge = document.getElementById('conv-badge');
    if (badge) badge.textContent = id ? `ID: ${id}` : '';
  },
  resetConversation() {
    localStorage.removeItem('alma:lastConv');
    App.state.conversationId = null;
    const badge = document.getElementById('conv-badge');
    if (badge) badge.textContent = '';
  }
};
