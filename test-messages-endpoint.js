// test-messages-endpoint.js - Validar específicamente el endpoint de mensajes
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'https://ofertas-de-exito-backend.vercel.app';

async function testMessagesEndpoint() {
  console.log('🔍 VALIDANDO ENDPOINT /api/conversations/:id/messages\n');

  try {
    // 1. Crear usuario y conversación
    console.log('1️⃣ Creando usuario y conversación...');
    const registerResponse = await axios.post(`${API_URL}/api/auth/register`, {
      email: `msgtest${Date.now()}@test.com`,
      password: '123456'
    });
    
    const token = registerResponse.data.token;
    const userId = registerResponse.data.user.userId;
    const headers = { Authorization: `Bearer ${token}` };
    console.log('✅ Usuario creado:', userId);

    // 2. Enviar mensajes usando /api/chat
    console.log('\n2️⃣ Enviando mensajes...');
    const conversationId = `conv_${Date.now()}`;
    
    const msg1 = await axios.post(`${API_URL}/api/chat`, {
      mensaje: 'Primer mensaje de prueba',
      conversationId: conversationId
    }, { headers });
    
    const msg2 = await axios.post(`${API_URL}/api/chat`, {
      mensaje: 'Segundo mensaje de prueba',
      conversationId: conversationId
    }, { headers });
    
    console.log('✅ Mensajes enviados:', {
      conversationId: msg1.data.conversationId,
      response1Length: msg1.data.respuesta?.length,
      response2Length: msg2.data.respuesta?.length
    });

    // 3. Verificar que se guardaron en Redis
    console.log('\n3️⃣ Verificando Redis directamente...');
    const redisDebug = await axios.get(`${API_URL}/api/debug/redis/${userId}/${conversationId}`);
    console.log('🔍 Redis Debug:', {
      chatKey: redisDebug.data.chatKey,
      messagesInRedis: redisDebug.data.normalizedData?.length || 0,
      conversationsInList: redisDebug.data.conversations?.length || 0
    });

    if (redisDebug.data.normalizedData?.length > 0) {
      console.log('📝 Mensajes en Redis:');
      redisDebug.data.normalizedData.forEach((msg, i) => {
        console.log(`   ${i + 1}. ${msg.role}: ${msg.content.substring(0, 50)}...`);
      });
    }

    // 4. Probar endpoint /api/conversations (que funciona)
    console.log('\n4️⃣ Probando /api/conversations...');
    const conversationsResponse = await axios.get(`${API_URL}/api/conversations`, { headers });
    console.log('✅ Conversaciones endpoint:', {
      status: conversationsResponse.status,
      count: conversationsResponse.data.conversations?.length || 0
    });

    // 5. Probar endpoint PROBLEMÁTICO /api/conversations/:id/messages
    console.log('\n5️⃣ Probando /api/conversations/:id/messages (PROBLEMÁTICO)...');
    const messagesResponse = await axios.get(`${API_URL}/api/conversations/${conversationId}/messages`, { headers });
    console.log('🔍 Messages endpoint response:', {
      status: messagesResponse.status,
      ok: messagesResponse.data.ok,
      conversationId: messagesResponse.data.conversationId,
      messagesCount: messagesResponse.data.messages?.length || 0,
      messages: messagesResponse.data.messages
    });

    // 6. ANÁLISIS DEL PROBLEMA
    console.log('\n📊 ANÁLISIS DEL PROBLEMA:');
    console.log('=' .repeat(60));
    
    const redisMessages = redisDebug.data.normalizedData?.length || 0;
    const endpointMessages = messagesResponse.data.messages?.length || 0;
    
    console.log(`📦 Mensajes en Redis: ${redisMessages}`);
    console.log(`🔗 Mensajes del endpoint: ${endpointMessages}`);
    
    if (redisMessages > 0 && endpointMessages === 0) {
      console.log('❌ PROBLEMA CONFIRMADO: El endpoint NO lee correctamente de Redis');
      console.log('\n🔧 POSIBLES CAUSAS:');
      console.log('   1. Error en la función getHistory()');
      console.log('   2. Problema con la clave de Redis');
      console.log('   3. Error en normalizeHistory()');
      console.log('   4. Problema con el userId o conversationId');
      
      console.log('\n🔍 DEBUGGING ADICIONAL:');
      console.log(`   Redis Key: chat:${userId}:${conversationId}`);
      console.log(`   Endpoint URL: /api/conversations/${conversationId}/messages`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Conversation ID: ${conversationId}`);
      
    } else if (redisMessages === endpointMessages && endpointMessages > 0) {
      console.log('✅ ENDPOINT FUNCIONA CORRECTAMENTE');
    } else {
      console.log('⚠️ SITUACIÓN INESPERADA - Revisar logs');
    }

    // 7. Probar con conversación existente de la lista
    if (conversationsResponse.data.conversations?.length > 0) {
      const existingConv = conversationsResponse.data.conversations[0];
      console.log('\n6️⃣ Probando con conversación existente...');
      console.log('🔍 Conversación existente:', {
        id: existingConv.id,
        title: existingConv.title
      });
      
      const existingMessagesResponse = await axios.get(`${API_URL}/api/conversations/${existingConv.id}/messages`, { headers });
      console.log('📄 Mensajes de conversación existente:', {
        count: existingMessagesResponse.data.messages?.length || 0,
        messages: existingMessagesResponse.data.messages?.map(m => `${m.role}: ${m.content.substring(0, 30)}...`)
      });
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testMessagesEndpoint();
