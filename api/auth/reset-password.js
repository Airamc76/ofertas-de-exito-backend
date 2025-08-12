// /api/auth/reset.js
import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const keyByEmail = (email) => `alma:user:email:${email.toLowerCase()}`;
const keyById    = (id)    => `alma:user:${id}`;
const resetKey   = (email) => `alma:reset:${email.toLowerCase()}`;
const SALT_ROUNDS = 10;

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'email, code y newPassword requeridos' });
    }

    // 1) recupera solicitud
    const raw = await redis.get(resetKey(email));
    if (!raw) return res.status(400).json({ error: 'Código inválido o expirado' });

    let payload;
    try { payload = typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch { return res.status(400).json({ error: 'Código inválido o expirado' }); }

    if (payload.code !== String(code)) {
      return res.status(400).json({ error: 'Código inválido o expirado' });
    }

    // 2) valida que el email pertenezca al userId esperado
    const userId = await redis.get(keyByEmail(email));
    if (!userId || userId !== payload.userId) {
      return res.status(400).json({ error: 'Solicitud no válida' });
    }

    // 3) actualiza el hash de la contraseña
    const userRaw = await redis.get(keyById(userId));
    if (!userRaw) return res.status(400).json({ error: 'Usuario no encontrado' });

    const user = typeof userRaw === 'string' ? JSON.parse(userRaw) : userRaw;
    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    const p = redis.pipeline();
    p.set(keyById(userId), JSON.stringify(user));
    p.del(resetKey(email));
    await p.exec();

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[reset] error:', e?.message);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
}
