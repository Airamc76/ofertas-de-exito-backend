// test-conversations.js - Prueba del sistema estilo ChatGPT
import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

dotenv.config();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function testConversations() {
  console.log('🧪 Probando sistema de conversaciones estilo ChatGPT...\n');

  const userId = 'test-user-456';
  
  try {
    // Simular 3 conversaciones diferentes
    const conversations = [
      {
        id: 'conv_1703123456789',
        messages: [
          { role: 'user', content: 'Quiero crear un curso de marketing digital', timestamp: new Date().toISOString() },
          { role: 'assistant', content: 'Excelente idea. Te ayudo a estructurar tu curso paso a paso', timestamp: new Date().toISOString() }
        ]
      },
      {
        id: 'conv_1703123456790',
        messages: [
          { role: 'user', content: 'Necesito ayuda con mi funnel de ventas', timestamp: new Date().toISOString() },
          { role: 'assistant', content: 'Perfecto, vamos a optimizar tu funnel para maximizar conversiones', timestamp: new Date().toISOString() }
        ]
      },
      {
        id: 'conv_1703123456791',
        messages: [
          { role: 'user', content: '¿Cómo hago email marketing efectivo?', timestamp: new Date().toISOString() },
          { role: 'assistant', content: 'Te muestro las mejores estrategias de email marketing', timestamp: new Date().toISOString() }
        ]
      }
    ];

    // Guardar cada conversación
    for (const conv of conversations) {
      await redis.set(`chat:${userId}:${conv.id}`, conv.messages);
      console.log(`✅ Guardada conversación: ${conv.id}`);
    }

    // Crear lista de conversaciones
    const conversationList = conversations.map(conv => ({
      id: conv.id,
      title: conv.messages[0].content.slice(0, 50) + '...',
      createdAt: conv.messages[0].timestamp,
      updatedAt: conv.messages[conv.messages.length - 1].timestamp
    }));

    await redis.set(`conversations:${userId}`, conversationList);
    console.log('✅ Lista de conversaciones guardada\n');

    // Verificar recuperación
    console.log('📖 Recuperando conversaciones...');
    const savedList = await redis.get(`conversations:${userId}`);
    
    console.log('📋 Lista de conversaciones:');
    savedList.forEach((conv, i) => {
      console.log(`${i + 1}. ${conv.title}`);
      console.log(`   ID: ${conv.id}`);
      console.log(`   Creada: ${new Date(conv.createdAt).toLocaleString()}\n`);
    });

    // Probar recuperación de una conversación específica
    const specificConv = await redis.get(`chat:${userId}:${conversations[0].id}`);
    console.log('💬 Mensajes de la primera conversación:');
    specificConv.forEach((msg, i) => {
      console.log(`${i + 1}. ${msg.role}: ${msg.content}`);
    });

    console.log('\n🎉 Sistema estilo ChatGPT funcionando correctamente!');
    console.log(`📊 Capacidad: 20 conversaciones máximo por usuario`);
    console.log(`📊 Cada conversación: 100 turnos (200 mensajes) máximo`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testConversations();
