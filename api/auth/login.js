import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
const keyByEmail = (email) => `alma:user:email:${email.toLowerCase()}`;
const keyById    = (id)    => `alma:user:${id}`;
const tokenOf = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method Not Allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email y password requeridos' });

  const userId = await redis.get(keyByEmail(email));
  if (!userId) return res.status(401).json({ error: 'Credenciales inválidas' });

  const raw = await redis.get(keyById(userId));
  const user = raw ? JSON.parse(raw) : null;
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

  const ok = await bcrypt.compare(password, user.passwordHash || '');
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

  const token = tokenOf({ userId, email: user.email });
  return res.status(200).json({ ok: true, token, user: { userId, email: user.email } });
}
