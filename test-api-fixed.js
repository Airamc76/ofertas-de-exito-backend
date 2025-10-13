// Script de prueba para la API con x-client-id
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/chat';
const CLIENT_ID = 'demo-1';

async function testAPI() {
  try {
    // 1. Crear una nueva conversación
    console.log('Creando nueva conversación...');
    const createRes = await fetch(`${API_URL}/conversations`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-client-id': CLIENT_ID 
      },
      body: JSON.stringify({ title: 'Prueba de API' })
    });
    
    const conversation = await createRes.json();
    console.log('Conversación creada:', conversation);
    
    const conversationId = conversation.data?.id || conversation.id;
    
    if (!conversationId) {
      console.error('No se pudo obtener el ID de la conversación');
      return;
    }
    
    // 2. Enviar un mensaje
    console.log('\nEnviando mensaje...');
    const messageRes = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-client-id': CLIENT_ID 
      },
      body: JSON.stringify({ 
        content: 'Hola, ¿puedes decirme qué tiempo hace hoy?',
        role: 'user'
      })
    });
    
    const message = await messageRes.json();
    console.log('Respuesta del asistente:', message);
    
    // 3. Obtener mensajes de la conversación
    console.log('\nObteniendo mensajes...');
    const messagesRes = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
      headers: { 'x-client-id': CLIENT_ID }
    });
    const messages = await messagesRes.json();
    console.log('Mensajes en la conversación:', JSON.stringify(messages, null, 2));
    
    // 4. Obtener todas las conversaciones
    console.log('\nListando todas las conversaciones...');
    const conversationsRes = await fetch(`${API_URL}/conversations`, {
      headers: { 'x-client-id': CLIENT_ID }
    });
    const conversations = await conversationsRes.json();
    console.log('Todas las conversaciones:', JSON.stringify(conversations, null, 2));
    
  } catch (error) {
    console.error('Error en la prueba:', error);
  }
}

testAPI();
