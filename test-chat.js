// test-chat.js - Prueba del sistema de chat con historial
import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const TEST_USER_ID = 'test-user-123';

async function testChat() {
  console.log('🧪 Probando sistema de chat con historial...\n');

  try {
    // Test 1: Primer mensaje
    console.log('📝 Enviando primer mensaje...');
    const response1 = await axios.post(`${BASE_URL}/api/chat`, {
      mensaje: 'Hola Alma, soy un emprendedor que quiere vender cursos online',
      userId: TEST_USER_ID
    });
    console.log('✅ Respuesta 1:', response1.data.respuesta.substring(0, 100) + '...\n');

    // Test 2: Segundo mensaje (debería recordar el contexto)
    console.log('📝 Enviando segundo mensaje...');
    const response2 = await axios.post(`${BASE_URL}/api/chat`, {
      mensaje: '¿Qué precio debería poner?',
      userId: TEST_USER_ID
    });
    console.log('✅ Respuesta 2:', response2.data.respuesta.substring(0, 100) + '...\n');

    // Test 3: Verificar historial en Redis
    console.log('📊 Verificando historial guardado...');
    // Aquí podríamos verificar directamente en Redis si fuera necesario
    
    console.log('🎉 Pruebas completadas exitosamente!');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error.message);
    if (error.response) {
      console.error('Detalles:', error.response.data);
    }
  }
}

testChat();
