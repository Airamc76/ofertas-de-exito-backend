// test-frontend-real-case.js - Simular exactamente lo que hace el frontend
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'https://ofertas-de-exito-backend.vercel.app';

async function testFrontendRealCase() {
  console.log('🔍 SIMULANDO CASO REAL DEL FRONTEND\n');

  try {
    // 1. Simular login del frontend
    console.log('1️⃣ Simulando login del frontend...');
    const loginResponse = await axios.post(`${API_URL}/api/auth/register`, {
      email: `frontend${Date.now()}@test.com`,
      password: '123456'
    });
    
    const token = loginResponse.data.token;
    const userId = loginResponse.data.user.userId;
    const headers = { Authorization: `Bearer ${token}` };
    console.log('✅ Login simulado:', userId);

    // 2. Crear conversación como lo hace el frontend
    console.log('\n2️⃣ Creando conversación como el frontend...');
    const conversationId = `conv_${Date.now()}`;
    
    // Primer mensaje
    const chatResponse1 = await axios.post(`${API_URL}/api/chat`, {
      mensaje: 'Hola Alma, necesito ayuda con mi negocio',
      conversationId: conversationId
    }, { headers });
    
    console.log('✅ Primer mensaje enviado');

    // 3. Simular "cerrar navegador" - guardar solo token
    console.log('\n3️⃣ Simulando cierre de navegador...');
    const savedToken = token;
    console.log('💾 Token guardado (localStorage)');

    // 4. Simular "abrir navegador" - cargar conversaciones
    console.log('\n4️⃣ Simulando apertura de navegador...');
    
    // Paso 1: Cargar lista de conversaciones (esto funciona)
    const conversationsResponse = await axios.get(`${API_URL}/api/conversations`, {
      headers: { Authorization: `Bearer ${savedToken}` }
    });
    
    console.log('📋 Conversaciones cargadas:', {
      count: conversationsResponse.data.conversations?.length || 0,
      conversations: conversationsResponse.data.conversations?.map(c => ({
        id: c.id,
        title: c.title
      }))
    });

    if (conversationsResponse.data.conversations?.length > 0) {
      const firstConv = conversationsResponse.data.conversations[0];
      
      // Paso 2: Intentar cargar mensajes (aquí está el problema según el frontend)
      console.log('\n5️⃣ Intentando cargar mensajes de la conversación...');
      console.log('🔍 Conversación a cargar:', {
        id: firstConv.id,
        title: firstConv.title,
        url: `${API_URL}/api/conversations/${firstConv.id}/messages`
      });

      // ESTE ES EL CALL EXACTO QUE HACE EL FRONTEND
      const messagesResponse = await axios.get(`${API_URL}/api/conversations/${firstConv.id}/messages`, {
        headers: { Authorization: `Bearer ${savedToken}` }
      });

      console.log('📄 Respuesta del endpoint messages:', {
        status: messagesResponse.status,
        ok: messagesResponse.data.ok,
        conversationId: messagesResponse.data.conversationId,
        messagesCount: messagesResponse.data.messages?.length || 0,
        messages: messagesResponse.data.messages
      });

      // 6. Verificar Redis para esta conversación específica
      console.log('\n6️⃣ Verificando Redis para esta conversación...');
      const redisDebug = await axios.get(`${API_URL}/api/debug/redis/${userId}/${firstConv.id}`);
      console.log('🔍 Estado en Redis:', {
        chatKey: redisDebug.data.chatKey,
        messagesInRedis: redisDebug.data.normalizedData?.length || 0,
        rawDataType: redisDebug.data.rawDataType,
        conversations: redisDebug.data.conversations?.length || 0
      });

      // 7. DIAGNÓSTICO COMPLETO
      console.log('\n📊 DIAGNÓSTICO COMPLETO:');
      console.log('=' .repeat(60));
      
      const redisCount = redisDebug.data.normalizedData?.length || 0;
      const endpointCount = messagesResponse.data.messages?.length || 0;
      
      console.log(`📦 Mensajes en Redis: ${redisCount}`);
      console.log(`🔗 Mensajes del endpoint: ${endpointCount}`);
      console.log(`🆔 Conversation ID: ${firstConv.id}`);
      console.log(`👤 User ID: ${userId}`);
      console.log(`🔑 Redis Key: chat:${userId}:${firstConv.id}`);
      
      if (redisCount > 0 && endpointCount === 0) {
        console.log('\n❌ PROBLEMA CONFIRMADO: Endpoint devuelve vacío');
        console.log('🔧 POSIBLES CAUSAS:');
        console.log('   1. Error en getHistory() function');
        console.log('   2. Problema con normalizeHistory()');
        console.log('   3. Mismatch en conversationId');
        console.log('   4. Problema con userId del token');
        
        // Verificar si el problema es el userId
        console.log('\n🔍 VERIFICACIÓN ADICIONAL:');
        
        // Decodificar token para ver userId
        try {
          const tokenPayload = JSON.parse(atob(savedToken.split('.')[1]));
          console.log('👤 User ID del token:', tokenPayload.userId);
          console.log('👤 User ID usado:', userId);
          console.log('🔄 Match:', tokenPayload.userId === userId);
        } catch (e) {
          console.log('❌ Error decodificando token:', e.message);
        }
        
      } else if (redisCount === endpointCount && endpointCount > 0) {
        console.log('\n✅ TODO FUNCIONA CORRECTAMENTE');
        console.log('💡 El problema debe estar en el frontend, no en el backend');
      } else {
        console.log('\n⚠️ SITUACIÓN INESPERADA');
        console.log('💡 Revisar logs del servidor para más detalles');
      }

      // 8. Probar el nuevo endpoint de diagnóstico
      console.log('\n7️⃣ Probando endpoint de diagnóstico...');
      try {
        const diagnosticResponse = await axios.get(`${API_URL}/api/debug/frontend-diagnostic`, {
          headers: { Authorization: `Bearer ${savedToken}` }
        });
        
        console.log('🔧 Diagnóstico del backend:', {
          userId: diagnosticResponse.data.userId,
          totalConversations: diagnosticResponse.data.stats?.totalConversations,
          totalMessages: diagnosticResponse.data.stats?.totalMessages,
          troubleshooting: diagnosticResponse.data.troubleshooting
        });
      } catch (diagError) {
        console.log('❌ Error en diagnóstico:', diagError.message);
      }
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testFrontendRealCase();
