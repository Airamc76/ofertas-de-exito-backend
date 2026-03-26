/**
 * Alma Chat UI - Premium Logic
 * Handles API communication, UI state, and animations.
 */

const API_BASE = 'http://localhost:3000/api/chat';
let currentConvId = null;
let isBusy = false;

// DOM Elements
const elements = {
    viewport: document.getElementById('chatViewport'),
    container: document.getElementById('messagesContainer'),
    input: document.getElementById('userInput'),
    sendBtn: document.getElementById('sendBtn'),
    typing: document.getElementById('typingIndicator'),
    historyList: document.getElementById('historyList'),
    btnNewChat: document.getElementById('btnNewChat'),
    btnClearChat: document.getElementById('btnClearChat'),
    btnBack: document.getElementById('btnBack'),
    chatTitle: document.getElementById('chatTitle') || { innerText: '' } // Fallback for card layout
};

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupListeners();
});

async function initApp() {
    console.log('Premium UI Initializing...');
    const clientId = getOrCreateClientId();
    // Load initial history if any
    loadHistory();
}

function setupListeners() {
    // Input auto-resize
    elements.input.addEventListener('input', () => {
        elements.input.style.height = 'auto';
        elements.input.style.height = (elements.input.scrollHeight) + 'px';
        elements.sendBtn.disabled = !elements.input.value.trim();
    });

    // Send on click
    elements.sendBtn.addEventListener('click', () => handleUserInput());

    // Send on Enter (but allow Shift+Enter)
    elements.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleUserInput();
        }
    });

    // New Chat
    elements.btnNewChat.addEventListener('click', startNewChat);

    // Clear Chat
    elements.btnClearChat.addEventListener('click', () => {
        elements.container.innerHTML = '';
        appendMessage('assistant', 'Chat limpiado. ¿Qué vamos a vender hoy?');
    });

    // Back to Portal
    elements.btnBack.addEventListener('click', () => {
        // Redirect to a specific portal URL if provided, otherwise history.back()
        window.location.href = '#'; // Placeholder for actual portal
        console.log('Navegando al portal...');
    });
}

// --- Logic ---

function getOrCreateClientId() {
    let id = localStorage.getItem('alma_client_id');
    if (!id) {
        id = 'cli_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('alma_client_id', id);
    }
    return id;
}

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'x-client-id': getOrCreateClientId()
    };
}

async function startNewChat() {
    if (isBusy) return;
    
    try {
        const res = await fetch(`${API_BASE}/conversations`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ title: 'Nueva Oferta' })
        });
        const json = await res.json();
        
        if (json.data) {
            currentConvId = json.data.id;
            elements.chatTitle.innerText = json.data.title;
            clearViewport();
            loadHistory(); // Refresh sidebar
            
            // Start with a small delay for the welcome animation
            setTimeout(() => {
                appendMessage('assistant', '¡Hola! Soy Alma, tu estratega. ¿Qué vamos a vender hoy?');
            }, 300);
        }
    } catch (err) {
        console.error('Error starting chat:', err);
    }
}

async function handleUserInput() {
    const text = elements.input.value.trim();
    if (!text || isBusy) return;

    if (!currentConvId) {
        await startNewChat();
    }

    // Clear input
    elements.input.value = '';
    elements.input.style.height = 'auto';
    elements.sendBtn.disabled = true;

    // Show in UI
    appendMessage('user', text);
    showTyping(true);

    try {
        isBusy = true;
        const res = await fetch(`${API_BASE}/conversations/${currentConvId}/messages`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ 
                content: text,
                client_msg_id: 'msg_' + Date.now()
            })
        });
        const json = await res.json();
        
        showTyping(false);
        if (json.data) {
            appendMessage('assistant', json.data.content);
            // If it was the first message, title might have changed
            if (elements.chatTitle.innerText === 'Nueva Conversación' || elements.chatTitle.innerText === 'Nueva Oferta') {
                refreshActiveTitle();
            }
        }
    } catch (err) {
        console.error('Error sending message:', err);
        showTyping(false);
        appendMessage('assistant', 'Lo siento, he tenido un problema conectando con mis neuronas de marketing. ¿Lo intentamos de nuevo?');
    } finally {
        isBusy = false;
    }
}

async function loadHistory() {
    try {
        const res = await fetch(`${API_BASE}/conversations`, { headers: getHeaders() });
        const json = await res.json();
        renderHistoryList(json.data || []);
    } catch (err) {
        console.error('Error loading history:', err);
    }
}

function renderHistoryList(convs) {
    elements.historyList.innerHTML = convs.map(c => `
        <div class="history-item ${c.id === currentConvId ? 'active' : ''}" onclick="selectConversation('${c.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span class="truncate">${c.title}</span>
        </div>
    `).join('');
}

window.selectConversation = async (id) => {
    if (isBusy || id === currentConvId) return;
    
    currentConvId = id;
    clearViewport();
    
    try {
        const res = await fetch(`${API_BASE}/conversations/${id}/history`, { headers: getHeaders() });
        const json = await res.json();
        (json.data || []).forEach(m => appendMessage(m.role, m.content));
        
        // Update title
        const convRes = await fetch(`${API_BASE}/conversations`, { headers: getHeaders() });
        const convs = await convRes.json();
        const active = convs.data.find(c => c.id === id);
        if (active) elements.chatTitle.innerText = active.title;
        
        renderHistoryList(convs.data);
    } catch (err) {
        console.error('Error loading conversation:', err);
    }
};

async function refreshActiveTitle() {
    const res = await fetch(`${API_BASE}/conversations`, { headers: getHeaders() });
    const json = await res.json();
    const active = json.data.find(c => c.id === currentConvId);
    if (active) elements.chatTitle.innerText = active.title;
    renderHistoryList(json.data);
}

// --- UI Helpers ---

function appendMessage(role, content) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}-message`;
    
    // Improved Markdown-ish processing
    let html = content
        .replace(/\n\d\. (.*)/g, '<br><strong>$1</strong>') // Handle numbered items as bold for now
        .replace(/\n- (.*)/g, '<br>• $1')                 // Handle bullet points
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>')             // Italics
        .replace(/\n/g, '<br>');                           // Line breaks
    
    msgDiv.innerHTML = html;
    elements.container.appendChild(msgDiv);
    
    scrollToBottom();
}

function showTyping(show) {
    elements.typing.style.display = show ? 'flex' : 'none';
    if (show) scrollToBottom();
}

function hideWelcome() {
    // Welcome screen removed in card layout
}

function clearViewport() {
    elements.container.innerHTML = '';
}

function scrollToBottom() {
    setTimeout(() => {
        elements.viewport.scrollTo({
            top: elements.viewport.scrollHeight,
            behavior: 'smooth'
        });
    }, 50);
}

window.quickAction = (text) => {
    elements.input.value = text;
    elements.input.dispatchEvent(new Event('input'));
    handleUserInput();
};
