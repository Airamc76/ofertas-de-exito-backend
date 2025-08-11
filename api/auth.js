// /api/auth.js — Registro y Login con Upstash Redis + JWT (handler plano para Vercel)
import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ===== Redis (Upstash) =====
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// ===== Config =====
const JWT_SECRET  = process.env.JWT_SECRET || 'change-me';
const SALT_ROUNDS = 10;

// ===== Utils =====
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
const keyByEmail = (email) => `alma:user:email:${email.toLowerCase()}`;
const keyById    = (id)    => `alma:user:${id}`;
const uid = () => 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);

function issueToken({ userId, email }) {
  // expira en 30 días
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '30d' });
}

// ===== Handler =====
export default async function handler(req, res) {
  setCORS(res);

  // Preflight
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Health
  if (req.method === 'GET') return res.status(200).json({ ok: true, service: 'auth', t: Date.now() });

  const url  = req.url || '';
  const body = req.body || {};
  const { email, password } = body;

  // ---------- POST /api/auth/register ----------
  if (url.endsWith('/register') && req.method === 'POST') {
    if (!email || !password) return res.status(400).json({ error: 'email y password requeridos' });

    const exists = await redis.get(keyByEmail(email));
    if (exists) return res.status(409).json({ error: 'El email ya está registrado' });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = uid();

    await redis.set(keyByEmail(email), userId);
    await redis.set(keyById(userId), JSON.stringify({
      userId,
      email: email.toLowerCase(),
      passwordHash,
      createdAt: Date.now()
    }));

    const token = issueToken({ userId, email: email.toLowerCase() });
    return res.status(201).json({ ok: true, token, user: { userId, email: email.toLowerCase() } });
  }

  // ---------- POST /api/auth/login ----------
  if (url.endsWith('/login') && req.method === 'POST') {
    if (!email || !password) return res.status(400).json({ error: 'email y password requeridos' });

    const userId = await redis.get(keyByEmail(email));
    if (!userId) return res.status(401).json({ error: 'Credenciales inválidas' });

    const raw  = await redis.get(keyById(userId));
    const user = raw ? JSON.parse(raw) : null;
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = issueToken({ userId, email: user.email });
    return res.status(200).json({ ok: true, token, user: { userId, email: user.email } });
  }

  // Ruta no encontrada
  return res.status(404).json({ error: 'Ruta no encontrada' });
}
