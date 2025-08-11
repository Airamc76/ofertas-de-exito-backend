import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const JWT_SECRET  = process.env.JWT_SECRET || 'change-me';
const SALT_ROUNDS = 10;

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const keyByEmail = (email) => `alma:user:email:${email.toLowerCase()}`;
const keyById    = (id)    => `alma:user:${id}`;
const uid        = () => 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
const signToken  = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email y password requeridos' });

    // ¿Ya existe?
    const exists = await redis.get(keyByEmail(email));
    if (exists) return res.status(409).json({ error: 'El email ya está registrado' });

    const userId = uid();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userData = { userId, email: email.toLowerCase(), passwordHash, createdAt: Date.now() };

    // Guardado atómico con verificación
    const p = redis.pipeline();
    p.set(keyByEmail(email), userId);
    p.set(keyById(userId), JSON.stringify(userData));
    await p.exec();

    // Verificación: ambas claves deben existir
    const savedId = await redis.get(keyByEmail(email));
    const raw     = await redis.get(keyById(userId));

    if (!savedId || !raw) {
      console.error('register verify failed:', { savedId, hasRaw: !!raw });
      return res.status(500).json({ error: 'No se pudo guardar el usuario (verifica Redis).' });
    }

    const token = signToken({ userId, email: email.toLowerCase() });
    return res.status(201).json({ ok: true, token, user: { userId, email: email.toLowerCase() } });

  } catch (e) {
    console.error('register error:', e?.message);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
}
