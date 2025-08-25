// test-redis.js - Prueba básica de conexión Redis
import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

dotenv.config();

console.log('Testing Redis connection...');
console.log('URL:', process.env.UPSTASH_REDIS_REST_URL ? 'SET' : 'NOT SET');
console.log('TOKEN:', process.env.UPSTASH_REDIS_REST_TOKEN ? 'SET' : 'NOT SET');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function testRedis() {
  try {
    // Test básico
    await redis.set('test-key', 'hello-redis');
    const result = await redis.get('test-key');
    console.log('✅ Redis connected successfully!');
    console.log('Test result:', result);
    
    // Limpiar
    await redis.del('test-key');
    console.log('✅ Test completed');
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
  }
}

testRedis();
