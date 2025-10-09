// validate-frontend-claim.js - Validar afirmación del frontend sobre guardado de mensajes
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'https://ofertas-de-exito-backend.vercel.app';

async function validateFrontendClaim() {
  console.log('🔍 VALIDANDO AFIRMACIÓN DEL FRONTEND');
  console.log('Claim: "El backend solo guarda mensajes del usuario, no las respuestas del bot"');
  console.log('=' .repeat(70));

  try {
    // 1. Crear usuario
    console.log('\n1️⃣ Creando usuario de prueba...');
    const registerResponse = await axios.post(`${API_URL}/api/auth/register`, {
      email: `validate${Date.now()}@test.com`,
      password: '123456'
    });
    
    const token = registerResponse.data.token;
    const userId = registerResponse.data.user.userId;
    const headers = { Authorization: `Bearer ${token}` };
    console.log('✅ Usuario creado:', userId);

    // 2. Probar endpoint /api/chat (que SÍ guarda ambos mensajes)
    console.log('\n2️⃣ Probando /api/chat (método principal)...');
    const conversationId = `validate_${Date.now()}`;
    
    const chatResponse = await axios.post(`${API_URL}/api/chat`, {
      mensaje: 'Mensaje de prueba para validar guardado',
      conversationId: conversationId
    }, { headers });
    
    console.log('✅ Chat response:', {
      conversationId: chatResponse.data.conversationId,
      hasResponse: !!chatResponse.data.respuesta
    });

    // 3. Verificar qué se guardó en Redis después del chat
    console.log('\n3️⃣ Verificando Redis después de /api/chat...');
    const redisAfterChat = await axios.get(`${API_URL}/api/debug/redis/${userId}/${conversationId}`);
    console.log('📦 Mensajes en Redis después de chat:', {
      count: redisAfterChat.data.normalizedData?.length || 0,
      messages: redisAfterChat.data.normalizedData?.map(m => `${m.role}: ${m.content.substring(0, 30)}...`)
    });

    // 4. Probar endpoint POST /api/conversations (el que menciona el frontend)
    console.log('\n4️⃣ Probando POST /api/conversations...');
    const testMessages = [
      { role: 'user', content: 'Primer mensaje del usuario', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Respuesta del bot al primer mensaje', timestamp: new Date().toISOString() },
      { role: 'user', content: 'Segundo mensaje del usuario', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Segunda respuesta del bot', timestamp: new Date().toISOString() }
    ];

    const conversationId2 = `validate_post_${Date.now()}`;
    const postResponse = await axios.post(`${API_URL}/api/conversations`, {
      id: conversationId2,
      title: 'Conversación de prueba POST',
      messages: testMessages
    }, { headers });

    console.log('✅ POST /api/conversations response:', {
      ok: postResponse.data.ok,
      conversationId: postResponse.data.conversation?.id
    });

    // 5. Verificar qué se guardó después del POST
    console.log('\n5️⃣ Verificando Redis después de POST /api/conversations...');
    const redisAfterPost = await axios.get(`${API_URL}/api/debug/redis/${userId}/${conversationId2}`);
    console.log('📦 Mensajes en Redis después de POST:', {
      count: redisAfterPost.data.normalizedData?.length || 0,
      messages: redisAfterPost.data.normalizedData?.map(m => `${m.role}: ${m.content.substring(0, 30)}...`)
    });

    // 6. Probar recuperación con GET /api/conversations/:id/messages
    console.log('\n6️⃣ Probando recuperación con GET messages...');
    const getMessagesResponse = await axios.get(`${API_URL}/api/conversations/${conversationId2}/messages`, { headers });
    console.log('📄 Mensajes recuperados con GET:', {
      count: getMessagesResponse.data.messages?.length || 0,
      messages: getMessagesResponse.data.messages?.map(m => `${m.role}: ${m.content.substring(0, 30)}...`)
    });

    // 7. ANÁLISIS COMPARATIVO
    console.log('\n📊 ANÁLISIS COMPARATIVO:');
    console.log('=' .repeat(70));
    
    const chatSavedCount = redisAfterChat.data.normalizedData?.length || 0;
    const postSavedCount = redisAfterPost.data.normalizedData?.length || 0;
    const getSavedCount = getMessagesResponse.data.messages?.length || 0;
    
    console.log(`🔄 /api/chat guardó: ${chatSavedCount} mensajes`);
    console.log(`📝 POST /api/conversations guardó: ${postSavedCount} mensajes`);
    console.log(`📖 GET /api/conversations/:id/messages recuperó: ${getSavedCount} mensajes`);
    console.log(`📤 Mensajes enviados en POST: ${testMessages.length} mensajes`);

    // 8. VERIFICAR TIPOS DE MENSAJES
    console.log('\n🔍 ANÁLISIS DETALLADO DE TIPOS:');
    
    if (redisAfterChat.data.normalizedData?.length > 0) {
      console.log('📨 Mensajes de /api/chat:');
      redisAfterChat.data.normalizedData.forEach((msg, i) => {
        console.log(`   ${i + 1}. ${msg.role}: ${msg.content.substring(0, 50)}...`);
      });
    }
    
    if (redisAfterPost.data.normalizedData?.length > 0) {
      console.log('📨 Mensajes de POST /api/conversations:');
      redisAfterPost.data.normalizedData.forEach((msg, i) => {
        console.log(`   ${i + 1}. ${msg.role}: ${msg.content.substring(0, 50)}...`);
      });
    }

    // 9. CONCLUSIÓN
    console.log('\n🎯 CONCLUSIÓN:');
    console.log('=' .repeat(70));
    
    const hasUserMessages = redisAfterPost.data.normalizedData?.some(m => m.role === 'user') || false;
    const hasAssistantMessages = redisAfterPost.data.normalizedData?.some(m => m.role === 'assistant') || false;
    
    console.log(`👤 Mensajes de usuario guardados: ${hasUserMessages ? '✅ SÍ' : '❌ NO'}`);
    console.log(`🤖 Mensajes de assistant guardados: ${hasAssistantMessages ? '✅ SÍ' : '❌ NO'}`);
    
    if (postSavedCount === testMessages.length && hasUserMessages && hasAssistantMessages) {
      console.log('\n✅ AFIRMACIÓN DEL FRONTEND ES INCORRECTA');
      console.log('   El backend SÍ guarda ambos tipos de mensajes correctamente');
      console.log('   POST /api/conversations funciona perfectamente');
    } else if (hasUserMessages && !hasAssistantMessages) {
      console.log('\n❌ AFIRMACIÓN DEL FRONTEND ES CORRECTA');
      console.log('   El backend solo está guardando mensajes del usuario');
      console.log('   Necesita corrección en normalizeMessagesArray() o saveTurn()');
    } else if (postSavedCount < testMessages.length) {
      console.log('\n⚠️ PROBLEMA PARCIAL CONFIRMADO');
      console.log('   Algunos mensajes no se están guardando');
      console.log(`   Esperados: ${testMessages.length}, Guardados: ${postSavedCount}`);
    } else {
      console.log('\n🤔 SITUACIÓN INESPERADA - Revisar logs');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

validateFrontendClaim();
