// test-browser-reload.js - Simula el comportamiento del navegador al recargar
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'https://ofertas-de-exito-backend.vercel.app';

async function simulateBrowserReload() {
  console.log('🔄 Simulando recarga del navegador...\n');

  try {
    // Paso 1: Crear usuario y conversación (simula uso previo)
    console.log('1️⃣ Creando usuario y conversación inicial...');
    const registerResponse = await axios.post(`${API_URL}/api/auth/register`, {
      email: `browsertest${Date.now()}@test.com`,
      password: '123456'
    });
    
    const token = registerResponse.data.token;
    const headers = { Authorization: `Bearer ${token}` };
    console.log('✅ Usuario creado');

    // Crear conversación usando el endpoint de chat (como lo haría el frontend)
    const chatResponse = await axios.post(`${API_URL}/api/chat`, {
      mensaje: 'Hola Alma, necesito ayuda con mi estrategia de ventas online',
      userId: registerResponse.data.user.userId,
      conversationId: `conv_${Date.now()}`
    }, { headers });
    
    const conversationId = chatResponse.data.conversationId;
    console.log('✅ Conversación creada:', conversationId);

    // Agregar más mensajes
    await axios.post(`${API_URL}/api/chat`, {
      mensaje: '¿Cuál es la mejor plataforma para vender cursos?',
      userId: registerResponse.data.user.userId,
      conversationId: conversationId
    }, { headers });
    
    console.log('✅ Mensajes adicionales agregados');

    // Paso 2: Simular "cerrar navegador" - solo guardamos el token
    console.log('\n🚪 Simulando cierre del navegador...');
    const savedToken = token;
    const savedUserId = registerResponse.data.user.userId;
    console.log('💾 Token guardado (localStorage simulado)');

    // Paso 3: Simular "abrir navegador" - cargar conversaciones
    console.log('\n🌐 Simulando apertura del navegador...');
    console.log('🔍 Cargando conversaciones existentes...');

    // Esto es lo que DEBE hacer el frontend al cargar
    const conversationsResponse = await axios.get(`${API_URL}/api/conversations`, {
      headers: { Authorization: `Bearer ${savedToken}` }
    });

    console.log('📋 Conversaciones encontradas:', conversationsResponse.data.conversations.length);
    
    if (conversationsResponse.data.conversations.length > 0) {
      const firstConv = conversationsResponse.data.conversations[0];
      console.log('📝 Primera conversación:', {
        id: firstConv.id,
        title: firstConv.title,
        createdAt: firstConv.createdAt
      });

      // Cargar mensajes de la primera conversación
      const messagesResponse = await axios.get(`${API_URL}/api/conversations/${firstConv.id}/messages`, {
        headers: { Authorization: `Bearer ${savedToken}` }
      });

      console.log('💬 Mensajes cargados:', messagesResponse.data.messages.length);
      console.log('📄 Primer mensaje:', messagesResponse.data.messages[0]?.content?.substring(0, 50) + '...');
      
      console.log('\n✅ ¡ÉXITO! El backend puede restaurar conversaciones correctamente');
      console.log('\n📋 Resumen de lo que el frontend DEBE hacer:');
      console.log('1. Al cargar la página, hacer GET /api/conversations');
      console.log('2. Mostrar la lista de conversaciones en el sidebar');
      console.log('3. Al seleccionar una conversación, hacer GET /api/conversations/:id/messages');
      console.log('4. Mostrar los mensajes en el chat');
      console.log('\n🔧 El problema está en el FRONTEND - no está implementando estos pasos');
      
    } else {
      console.log('❌ No se encontraron conversaciones - problema en el backend');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

simulateBrowserReload();
