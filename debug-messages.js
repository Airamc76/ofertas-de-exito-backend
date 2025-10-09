// debug-messages.js - Script para debuggear el problema de mensajes vacíos
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'https://ofertas-de-exito-backend.vercel.app';

async function debugMessages() {
  console.log('🔍 Debuggeando problema de mensajes vacíos...\n');

  try {
    // 1. Crear usuario de prueba
    console.log('1️⃣ Creando usuario de prueba...');
    const registerResponse = await axios.post(`${API_URL}/api/auth/register`, {
      email: `debug${Date.now()}@test.com`,
      password: '123456'
    });
    
    const token = registerResponse.data.token;
    const userId = registerResponse.data.user.userId;
    const headers = { Authorization: `Bearer ${token}` };
    console.log('✅ Usuario creado:', userId);

    // 2. Enviar mensaje usando el endpoint de chat
    console.log('\n2️⃣ Enviando primer mensaje...');
    const conversationId = `conv_${Date.now()}`;
    
    const chatResponse1 = await axios.post(`${API_URL}/api/chat`, {
      mensaje: 'Hola Alma, necesito ayuda con mi negocio online',
      conversationId: conversationId
    }, { headers });
    
    console.log('✅ Primer mensaje enviado');
    console.log('📄 Respuesta:', {
      ok: chatResponse1.data.ok,
      conversationId: chatResponse1.data.conversationId,
      responseLength: chatResponse1.data.respuesta?.length
    });

    // 3. Enviar segundo mensaje
    console.log('\n3️⃣ Enviando segundo mensaje...');
    const chatResponse2 = await axios.post(`${API_URL}/api/chat`, {
      mensaje: '¿Cuáles son las mejores estrategias de marketing digital?',
      conversationId: conversationId
    }, { headers });
    
    console.log('✅ Segundo mensaje enviado');

    // 4. Verificar datos directamente en Redis
    console.log('\n4️⃣ Verificando datos en Redis...');
    const redisDebugResponse = await axios.get(`${API_URL}/api/debug/redis/${userId}/${conversationId}`);
    console.log('🔍 Debug Redis:', {
      chatKey: redisDebugResponse.data.chatKey,
      rawDataType: redisDebugResponse.data.rawDataType,
      messagesCount: redisDebugResponse.data.normalizedData?.length || 0,
      conversations: redisDebugResponse.data.conversations?.length || 0
    });

    if (redisDebugResponse.data.normalizedData?.length > 0) {
      console.log('📝 Primeros mensajes en Redis:');
      redisDebugResponse.data.normalizedData.slice(0, 3).forEach((msg, i) => {
        console.log(`   ${i + 1}. ${msg.role}: ${msg.content.substring(0, 50)}...`);
      });
    }

    // 5. Probar endpoint de conversaciones
    console.log('\n5️⃣ Obteniendo lista de conversaciones...');
    const conversationsResponse = await axios.get(`${API_URL}/api/conversations`, { headers });
    console.log('📋 Conversaciones encontradas:', conversationsResponse.data.conversations?.length || 0);
    
    if (conversationsResponse.data.conversations?.length > 0) {
      const conv = conversationsResponse.data.conversations[0];
      console.log('📝 Primera conversación:', {
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt
      });
    }

    // 6. Probar endpoint de mensajes específicos
    console.log('\n6️⃣ Obteniendo mensajes de la conversación...');
    const messagesResponse = await axios.get(`${API_URL}/api/conversations/${conversationId}/messages`, { headers });
    console.log('💬 Mensajes obtenidos:', {
      ok: messagesResponse.data.ok,
      conversationId: messagesResponse.data.conversationId,
      messagesCount: messagesResponse.data.messages?.length || 0
    });

    if (messagesResponse.data.messages?.length > 0) {
      console.log('📄 Mensajes encontrados:');
      messagesResponse.data.messages.forEach((msg, i) => {
        console.log(`   ${i + 1}. ${msg.role}: ${msg.content.substring(0, 50)}...`);
      });
    } else {
      console.log('❌ NO SE ENCONTRARON MENSAJES - AQUÍ ESTÁ EL PROBLEMA');
    }

    // 7. Comparar claves de Redis
    console.log('\n7️⃣ Análisis de claves Redis:');
    console.log('🔑 Clave de chat:', `chat:${userId}:${conversationId}`);
    console.log('🔑 Clave de lista:', `conversations:${userId}`);
    
    // 8. Verificar si el problema está en getHistory
    console.log('\n8️⃣ Probando getHistory directamente...');
    // Esta función está en el backend, pero podemos ver los logs

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

debugMessages();
