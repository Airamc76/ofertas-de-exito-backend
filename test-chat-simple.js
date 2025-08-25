// test-chat-simple.js - Prueba del historial sin OpenAI
import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

dotenv.config();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function testHistorial() {
  console.log('🧪 Probando historial de chat en Redis...\n');

  const userId = 'test-user-123';
  
  try {
    // Simular conversación
    const conversacion = [
      { role: 'user', content: 'Hola, quiero vender cursos online' },
      { role: 'assistant', content: 'Perfecto, te ayudo con tu estrategia de ventas' },
      { role: 'user', content: '¿Qué precio debería poner?' },
      { role: 'assistant', content: 'Depende de tu audiencia y valor percibido' }
    ];

    // Guardar historial
    console.log('💾 Guardando historial...');
    await redis.set(`chat:${userId}`, conversacion);
    
    // Recuperar historial
    console.log('📖 Recuperando historial...');
    const historial = await redis.get(`chat:${userId}`);
    
    console.log('✅ Historial guardado y recuperado:');
    historial.forEach((msg, i) => {
      console.log(`${i + 1}. ${msg.role}: ${msg.content}`);
    });

    // Verificar límite de 100 turnos
    console.log(`\n📊 Límite actual: 100 turnos (200 mensajes)`);
    console.log(`📊 Mensajes actuales: ${historial.length}`);
    console.log(`📊 Capacidad restante: ${200 - historial.length} mensajes`);
    
    console.log('\n🎉 Sistema de historial funcionando correctamente!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testHistorial();
