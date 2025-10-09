// test-conversations.js - Prueba del sistema estilo ChatGPT
import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const API_URL = 'https://ofertas-de-exito-backend.vercel.app';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function testConversations() {
  console.log('🧪 Testing Conversation Management Endpoints...\n');

  try {
    // Test 1: Create user and get token
    console.log('1️⃣ Creating test user...');
    const registerResponse = await axios.post(`${API_URL}/api/auth/register`, {
      email: `convtest${Date.now()}@test.com`,
      password: '123456'
    });
    
    const token = registerResponse.data.token;
    const headers = { Authorization: `Bearer ${token}` };
    console.log('✅ User created, token obtained');

    // Test 2: Get empty conversations list
    console.log('\n2️⃣ Getting empty conversations...');
    const emptyResponse = await axios.get(`${API_URL}/api/conversations`, { headers });
    console.log('✅ Empty conversations:', emptyResponse.data);

    // Test 3: Create new conversation
    console.log('\n3️⃣ Creating new conversation...');
    const newConv = {
      id: `conv_${Date.now()}`,
      title: 'Mi primera conversación con Alma',
      messages: [
        { role: 'user', content: 'Hola Alma, necesito ayuda con mi negocio online', timestamp: new Date().toISOString() },
        { role: 'assistant', content: '¡Hola! Soy Alma, tu experta en ventas online. Te ayudo a convertir ideas en ventas digitales. ¿Qué tipo de negocio tienes en mente?', timestamp: new Date().toISOString() }
      ]
    };
    
    const createResponse = await axios.post(`${API_URL}/api/conversations`, newConv, { headers });
    console.log('✅ Conversation created:', createResponse.data);

    // Test 4: Create second conversation
    console.log('\n4️⃣ Creating second conversation...');
    const secondConv = {
      id: `conv_${Date.now() + 1}`,
      title: 'Estrategias de marketing digital',
      messages: [
        { role: 'user', content: '¿Cuáles son las mejores estrategias de marketing?', timestamp: new Date().toISOString() }
      ]
    };
    
    await axios.post(`${API_URL}/api/conversations`, secondConv, { headers });
    console.log('✅ Second conversation created');

    // Test 5: Get conversations list
    console.log('\n5️⃣ Getting conversations list...');
    const listResponse = await axios.get(`${API_URL}/api/conversations`, { headers });
    console.log('✅ Conversations list:', listResponse.data);

    // Test 6: Update conversation title
    console.log('\n6️⃣ Updating conversation title...');
    const updateResponse = await axios.put(`${API_URL}/api/conversations/${newConv.id}`, {
      title: 'Consulta sobre negocio online - ACTUALIZADA'
    }, { headers });
    console.log('✅ Conversation updated:', updateResponse.data);

    // Test 7: Update conversation with new messages
    console.log('\n7️⃣ Adding messages to conversation...');
    const updatedMessages = [
      ...newConv.messages,
      { role: 'user', content: 'Quiero vender cursos online', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Excelente elección. Los cursos online son muy rentables. Te ayudo a crear un funnel de ventas efectivo.', timestamp: new Date().toISOString() }
    ];
    
    await axios.put(`${API_URL}/api/conversations/${newConv.id}`, {
      messages: updatedMessages
    }, { headers });
    console.log('✅ Messages added to conversation');

    // Test 8: Delete one conversation
    console.log('\n8️⃣ Deleting conversation...');
    const deleteResponse = await axios.delete(`${API_URL}/api/conversations/${secondConv.id}`, { headers });
    console.log('✅ Conversation deleted:', deleteResponse.data);

    // Test 9: Get messages from specific conversation
    console.log('\n9️⃣ Getting messages from conversation...');
    const messagesResponse = await axios.get(`${API_URL}/api/conversations/${newConv.id}/messages`, { headers });
    console.log('✅ Messages retrieved:', messagesResponse.data);

    // Test 10: Verify final state
    console.log('\n🔟 Verifying final state...');
    const finalListResponse = await axios.get(`${API_URL}/api/conversations`, { headers });
    console.log('✅ Final conversations list:', finalListResponse.data);

    console.log('\n🎉 All conversation management tests passed!');
    console.log('📊 Summary:');
    console.log('- ✅ GET /api/conversations');
    console.log('- ✅ POST /api/conversations');  
    console.log('- ✅ PUT /api/conversations/:id');
    console.log('- ✅ DELETE /api/conversations/:id');
    console.log('- ✅ GET /api/conversations/:id/messages');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testConversations();
