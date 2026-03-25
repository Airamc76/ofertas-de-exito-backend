// app.api.js
// Todas las llamadas fetch al backend (con fallback de rutas).

window.App = window.App || {};

// === Client ID (robusto e interoperable con iOS antiguos) ===
const CLIENT_ID_KEY = 'alma:clientId';
function ensureClientId(){
  try{
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id){
      if (globalThis.crypto?.randomUUID){ id = crypto.randomUUID(); }
      else { id = 'cid_' + Date.now().toString(36) + Math.random().toString(36).slice(2,10); }
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  }catch{ return 'cid_' + Math.random().toString(36).slice(2,10); }
}

// === Unified keys and helpers (single source of truth) ===
window.__ALMA_KEYS__ = {
  CLIENT: 'alma.clientId',
  CONV:   'alma.conversationId',
};

function genId(prefix = 'conv_'){
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
}

function getClientId(){
  try{
    // Prefer existing robust ensureClientId, also mirror under alma key
    const id = ensureClientId();
    try{ localStorage.setItem(window.__ALMA_KEYS__.CLIENT, id); }catch{}
    return id;
  }catch{
    return ensureClientId();
  }
}

function getConversationId(){
  try{
    let id = localStorage.getItem(window.__ALMA_KEYS__.CONV);
    if (!id){ id = genId(); localStorage.setItem(window.__ALMA_KEYS__.CONV, id); }
    return id;
  }catch{
    return genId();
  }
}

function setConversationId(id){
  try{ localStorage.setItem(window.__ALMA_KEYS__.CONV, id); }catch{}
  return id;
}

// === API BASE unificada con múltiples fuentes ===
(function resolveApiBase(){
  try{
    const fromQuery = new URLSearchParams(location.search).get('api');
    if (fromQuery) localStorage.setItem('API_BASE', fromQuery);

    const fromStorage = localStorage.getItem('API_BASE');
    const fromGlobal  = (typeof window !== 'undefined') ? window.__API_BASE__ : null;

    const fallback = (
      (location.protocol === 'https:' || location.hostname.endsWith('netlify.app'))
        ? 'https://ofertas-de-exito-backend.vercel.app/api/supax'
        : 'http://localhost:8788/api/supax'
    );

    const API_BASE = (fromQuery || fromStorage || fromGlobal || fallback).replace(/\/+$/, '');

    // Exponer builder seguro para rutas
    window.apiUrl = (path = '') => API_BASE + (String(path).startsWith('/') ? path : '/' + String(path));

    // Mantener compatibilidad con capas existentes
    App.config = Object.assign({}, App.config || {}, { apiBase: API_BASE });
    window.API_BASE = API_BASE;
  }catch{
    const API_BASE = 'https://ofertas-de-exito-backend.vercel.app/api/supax';
    window.apiUrl = (path = '') => API_BASE + (String(path).startsWith('/') ? path : '/' + String(path));
    App.config = Object.assign({}, App.config || {}, { apiBase: API_BASE });
    window.API_BASE = API_BASE;
  }
})();

App.api = {
  base() { return App.apiBase; },

  // headers comunes requeridos por backend
  commonHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-client-id': App.state.clientId,
    };
  },

  // headers aceptados por backend (sin headers extra de preflight)
  clientHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-client-id': ensureClientId(),
    };
  },

  async createConversation(payload = {}) {
    const r = await fetch(apiUrl('/conversations'), {
      method: 'POST',
      headers: this.clientHeaders(),
      body: JSON.stringify(payload || {}),
    });
    if (!r.ok) throw new Error(`createConversation failed: ${r.status}`);
    const json = await r.json();
    return json?.data;
  },

  async sendMessage(content) {
    const id = App.state.conversationId;
    if (!id) throw new Error('No hay conversationId');
    const clientMsgId = (App.msg?.genId?.() || ('m_' + Date.now().toString(36)));
    const res = await fetch(apiUrl(`/conversations/${encodeURIComponent(id)}/messages`), {
      method: 'POST',
      headers: this.clientHeaders(),
      body: JSON.stringify({ content, clientMsgId }),
      mode: 'cors',
    });
    if (!res.ok){
      const txt = await res.text().catch(()=> '');
      throw new Error(`HTTP ${res.status} ${res.statusText} :: ${txt.slice(0,200)}`);
    }
    return res.json();
  },

  // Cargar historial de una conversación
  async fetchMessages(conversationId, limit = 50){
    const id = conversationId || App.state.conversationId;
    if (!id) return [];

    // Supax primero
    const tryA = async ()=>{
      const url = apiUrl(`/conversations/${encodeURIComponent(id)}/history?limit=${encodeURIComponent(limit)}`);
      const r = await fetch(url, { method: 'GET', headers: this.clientHeaders() });
      if (!r.ok) throw new Error(`A ${r.status}`);
      const json = await r.json();
      if (json?.success && Array.isArray(json?.data)) return json.data;
      const arr = json?.data?.messages || json?.messages || [];
      return Array.isArray(arr) ? arr : [];
    };

    // Legacy fallback
    const tryB = async ()=>{
      const r = await fetch(apiUrl(`/conversations/${encodeURIComponent(id)}`), {
        method: 'GET', headers: this.clientHeaders()
      });
      if (!r.ok) throw new Error(`B ${r.status}`);
      const json = await r.json();
      const arr = json?.data?.messages || json?.messages || [];
      return Array.isArray(arr) ? arr : [];
    };

    try { return await tryA(); } catch { try { return await tryB(); } catch { return []; } }
  },

  // Nuevo helper explícito para historial
  async fetchHistory(conversationId, limit = 50){
    const id = conversationId || App.state.conversationId;
    if (!id) return [];
    const r = await fetch(apiUrl(`/conversations/${encodeURIComponent(id)}/history?limit=${encodeURIComponent(limit)}`), {
      method: 'GET',
      headers: this.clientHeaders(),
    });
    if (!r.ok) throw new Error('history failed');
    const j = await r.json();
    return j?.data || [];
  },

  // Ping de diagnóstico
  async ping(){
    const r = await fetch(apiUrl('/ping'), { headers: { 'x-client-id': ensureClientId() }, mode: 'cors' });
    if (!r.ok) throw new Error(`Ping failed: ${r.status}`);
    return r.json();
  },

  // Guard contra saludo duplicado en un hilo
  _greeted: false,
  pushGreetingIfNeeded(){
    if (this._greeted) return;
    this._greeted = true;
    try{ App.ui.pushAssistant?.('¡Hola! Soy Alma — tu asistente de copywriting profesional. ¿En qué puedo ayudarte hoy?'); }catch{}
  },
};

// Export helpers en el espacio App.api
App.api.ensureClientId = ensureClientId;
App.api.getClientId = getClientId;
App.api.getConversationId = getConversationId;
App.api.setConversationId = setConversationId;
App.api.genId = genId;
