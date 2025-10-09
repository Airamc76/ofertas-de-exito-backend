// frontend-debug-kit.js - Kit completo de debugging para el frontend
// INSTRUCCIONES: Copiar este código en la consola del navegador

console.clear();
console.log('🔧 CARGANDO KIT DE DEBUGGING PARA FRONTEND...\n');

const DEBUG_KIT = {
    API_URL: 'https://ofertas-de-exito-backend.vercel.app',
    
    // Paso 1: Verificar configuración básica
    async checkBasics() {
        console.log('📋 PASO 1: VERIFICANDO CONFIGURACIÓN BÁSICA');
        console.log('=' .repeat(50));
        
        const results = {};
        
        // Verificar token
        const token = localStorage.getItem('authToken');
        results.hasToken = !!token;
        console.log(`🔑 Token en localStorage: ${results.hasToken ? '✅ SÍ' : '❌ NO'}`);
        
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                results.userId = payload.userId;
                results.email = payload.email;
                results.tokenExpiry = new Date(payload.exp * 1000);
                console.log(`👤 User ID: ${results.userId}`);
                console.log(`📧 Email: ${results.email}`);
                console.log(`⏰ Token expira: ${results.tokenExpiry.toLocaleString()}`);
                console.log(`⏰ Token válido: ${results.tokenExpiry > new Date() ? '✅ SÍ' : '❌ NO'}`);
            } catch (e) {
                console.log('❌ Token inválido:', e.message);
                results.tokenValid = false;
            }
        }
        
        // Verificar elementos DOM
        const elements = [
            'conversations-list',
            'chat-messages',
            'message-input',
            'send-btn'
        ];
        
        console.log('\n🎯 Elementos DOM:');
        elements.forEach(id => {
            const element = document.getElementById(id);
            results[`dom_${id}`] = !!element;
            console.log(`   ${id}: ${element ? '✅ Encontrado' : '❌ No encontrado'}`);
        });
        
        return results;
    },
    
    // Paso 2: Probar conectividad con API
    async testAPI() {
        console.log('\n📡 PASO 2: PROBANDO CONECTIVIDAD CON API');
        console.log('=' .repeat(50));
        
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.log('❌ No hay token - saltando pruebas de API');
            return {};
        }
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
        
        const results = {};
        
        // Test 1: Ping
        try {
            console.log('🏓 Probando ping...');
            const response = await fetch(`${this.API_URL}/api/chat/ping`);
            results.ping = response.ok;
            console.log(`   Ping: ${response.ok ? '✅ OK' : '❌ FAIL'} (${response.status})`);
        } catch (e) {
            console.log(`   Ping: ❌ ERROR - ${e.message}`);
            results.ping = false;
        }
        
        // Test 2: Conversations
        try {
            console.log('📋 Probando /api/conversations...');
            const response = await fetch(`${this.API_URL}/api/conversations`, { headers });
            const data = await response.json();
            results.conversations = {
                status: response.status,
                ok: response.ok,
                count: data.conversations?.length || 0,
                data: data
            };
            console.log(`   Conversations: ${response.ok ? '✅ OK' : '❌ FAIL'} (${response.status})`);
            console.log(`   Conversaciones encontradas: ${data.conversations?.length || 0}`);
        } catch (e) {
            console.log(`   Conversations: ❌ ERROR - ${e.message}`);
            results.conversations = { error: e.message };
        }
        
        return results;
    },
    
    // Paso 3: Probar endpoint específico de mensajes
    async testMessages(conversationId = null) {
        console.log('\n💬 PASO 3: PROBANDO ENDPOINT DE MENSAJES');
        console.log('=' .repeat(50));
        
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.log('❌ No hay token');
            return {};
        }
        
        // Si no se proporciona conversationId, usar el primero disponible
        if (!conversationId) {
            try {
                const convResponse = await fetch(`${this.API_URL}/api/conversations`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const convData = await convResponse.json();
                if (convData.conversations?.length > 0) {
                    conversationId = convData.conversations[0].id;
                    console.log(`🎯 Usando conversación: ${conversationId}`);
                } else {
                    console.log('❌ No hay conversaciones para probar');
                    return { error: 'No conversations found' };
                }
            } catch (e) {
                console.log('❌ Error obteniendo conversaciones:', e.message);
                return { error: e.message };
            }
        }
        
        const results = {};
        
        try {
            console.log(`🔍 Probando mensajes para: ${conversationId}`);
            const url = `${this.API_URL}/api/conversations/${conversationId}/messages`;
            console.log(`🔗 URL: ${url}`);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            console.log(`📡 Status: ${response.status} ${response.statusText}`);
            
            const data = await response.json();
            results.messages = {
                status: response.status,
                ok: response.ok,
                conversationId: data.conversationId,
                count: data.messages?.length || 0,
                messages: data.messages
            };
            
            console.log(`✅ Response OK: ${response.ok}`);
            console.log(`💬 Mensajes encontrados: ${data.messages?.length || 0}`);
            
            if (data.messages?.length > 0) {
                console.log('📝 Primeros mensajes:');
                data.messages.slice(0, 3).forEach((msg, i) => {
                    console.log(`   ${i + 1}. ${msg.role}: ${msg.content.substring(0, 50)}...`);
                });
            } else {
                console.log('⚠️ ARRAY VACÍO - AQUÍ ESTÁ EL PROBLEMA');
            }
            
        } catch (e) {
            console.log(`❌ ERROR: ${e.message}`);
            results.messages = { error: e.message };
        }
        
        return results;
    },
    
    // Paso 4: Crear conversación de prueba
    async createTestConversation() {
        console.log('\n🧪 PASO 4: CREANDO CONVERSACIÓN DE PRUEBA');
        console.log('=' .repeat(50));
        
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.log('❌ No hay token');
            return {};
        }
        
        try {
            const testId = `debug_${Date.now()}`;
            console.log(`🆔 ID de prueba: ${testId}`);
            
            const response = await fetch(`${this.API_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    mensaje: 'Mensaje de prueba para debugging - ¿puedes confirmar que recibes esto?',
                    conversationId: testId
                })
            });
            
            const data = await response.json();
            console.log(`✅ Conversación creada: ${data.conversationId}`);
            console.log(`📝 Respuesta recibida: ${data.respuesta?.substring(0, 100)}...`);
            
            // Ahora probar cargar los mensajes
            console.log('\n🔄 Probando cargar mensajes de la nueva conversación...');
            await this.testMessages(data.conversationId);
            
            return { conversationId: data.conversationId, success: true };
            
        } catch (e) {
            console.log(`❌ ERROR: ${e.message}`);
            return { error: e.message };
        }
    },
    
    // Diagnóstico completo
    async runFullDiagnostic() {
        console.log('🚀 INICIANDO DIAGNÓSTICO COMPLETO DEL FRONTEND');
        console.log('=' .repeat(60));
        
        const results = {
            timestamp: new Date().toISOString(),
            basics: await this.checkBasics(),
            api: await this.testAPI(),
            messages: await this.testMessages(),
            testConversation: await this.createTestConversation()
        };
        
        console.log('\n📊 RESUMEN DEL DIAGNÓSTICO');
        console.log('=' .repeat(60));
        
        // Análisis de resultados
        const hasToken = results.basics.hasToken;
        const apiWorks = results.api.ping;
        const conversationsWork = results.api.conversations?.ok;
        const messagesWork = results.messages.messages?.ok && results.messages.messages?.count > 0;
        
        console.log(`🔑 Autenticación: ${hasToken ? '✅' : '❌'}`);
        console.log(`📡 Conectividad API: ${apiWorks ? '✅' : '❌'}`);
        console.log(`📋 Endpoint conversations: ${conversationsWork ? '✅' : '❌'}`);
        console.log(`💬 Endpoint messages: ${messagesWork ? '✅' : '❌'}`);
        
        // Recomendaciones
        console.log('\n💡 RECOMENDACIONES:');
        if (!hasToken) {
            console.log('   1. ❌ Hacer login primero');
        }
        if (!apiWorks) {
            console.log('   2. ❌ Verificar conectividad de red');
        }
        if (!conversationsWork) {
            console.log('   3. ❌ Problema con autenticación o CORS');
        }
        if (!messagesWork) {
            console.log('   4. ❌ PROBLEMA PRINCIPAL: Endpoint de mensajes no funciona');
            console.log('      - Verificar headers de Authorization');
            console.log('      - Verificar formato de URL');
            console.log('      - Verificar manejo de respuesta');
        }
        
        // Guardar resultados
        window.debugResults = results;
        console.log('\n📋 Resultados guardados en: window.debugResults');
        
        return results;
    },
    
    // Función para probar código específico del frontend
    testFrontendCode() {
        console.log('\n🔧 PROBANDO CÓDIGO DEL FRONTEND');
        console.log('=' .repeat(50));
        
        // Verificar si existen las funciones del frontend
        const functions = [
            'loadConversations',
            'loadConversationMessages', 
            'selectConversation',
            'renderMessages'
        ];
        
        functions.forEach(funcName => {
            const exists = typeof window[funcName] === 'function';
            console.log(`   ${funcName}: ${exists ? '✅ Definida' : '❌ No definida'}`);
        });
        
        // Código de ejemplo para copiar
        console.log('\n📝 CÓDIGO CORREGIDO PARA COPIAR:');
        console.log(`
// FUNCIÓN CORREGIDA - Copiar y pegar en tu código
async function loadConversationMessages(conversationId) {
    const token = localStorage.getItem('authToken');
    const response = await fetch('${this.API_URL}/api/conversations/' + conversationId + '/messages', {
        headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await response.json();
    console.log('Mensajes cargados:', data.messages?.length || 0);
    return data.messages || [];
}
        `);
    }
};

// Funciones globales para usar en consola
window.debugKit = DEBUG_KIT;
window.runDiagnostic = () => DEBUG_KIT.runFullDiagnostic();
window.testMessages = (id) => DEBUG_KIT.testMessages(id);
window.createTest = () => DEBUG_KIT.createTestConversation();
window.checkCode = () => DEBUG_KIT.testFrontendCode();

console.log('✅ KIT DE DEBUGGING CARGADO');
console.log('📝 COMANDOS DISPONIBLES:');
console.log('   runDiagnostic()     - Diagnóstico completo');
console.log('   testMessages(id)    - Probar endpoint de mensajes');
console.log('   createTest()        - Crear conversación de prueba');
console.log('   checkCode()         - Verificar código del frontend');
console.log('\n🚀 EJECUTA: runDiagnostic() para empezar');
