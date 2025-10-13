// Script de prueba para la API
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api/chat';
const CLIENT_ID = 'demo-1';

const headers = {
  'Content-Type': 'application/json',
  'x-client-id': CLIENT_ID
};

async function testAPI() {
  try {
    // 1. Hacer ping al servidor
    console.log('Haciendo ping al servidor...');
    const pingRes = await fetch(`${API_BASE}/ping`);
    console.log('Ping exitoso:', await pingRes.json());

    // 2. Crear una conversación
    console.log('\nCreando conversación...');
    const createRes = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Conversación de prueba' })
    });
    const conversation = await createRes.json();
    console.log('Conversación creada:', JSON.stringify(conversation, null, 2));
    
    const conversationId = conversation.data?.id;
    if (!conversationId) {
      throw new Error('No se pudo obtener el ID de la conversación');
    }

    // 3. Enviar un mensaje
    console.log('\nEnviando mensaje...');
    const messageRes = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content: 'Hola, ¿cómo estás?',
        role: 'user'
      })
    });
    const message = await messageRes.json();
    console.log('Respuesta del mensaje:', JSON.stringify(message, null, 2));

    // 4. Obtener mensajes de la conversación
    console.log('\nObteniendo mensajes...');
    const messagesRes = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, { headers });
    const messages = await messagesRes.json();
    console.log('Mensajes:', JSON.stringify(messages, null, 2));

    // 5. Listar todas las conversaciones
    console.log('\nListando conversaciones...');
    const convsRes = await fetch(`${API_BASE}/conversations`, { headers });
    const conversations = await convsRes.json();
    console.log('Conversaciones:', JSON.stringify(conversations, null, 2));

  } catch (error) {
    console.error('Error en la prueba:', error);
  }
}

testAPI();
