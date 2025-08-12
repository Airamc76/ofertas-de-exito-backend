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
const keyReset   = (email) => `alma:reset:${email.toLowerCase()}`;

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'email, code y newPassword requeridos' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener 6+ caracteres' });
    }

    // Validar código
    const saved = await redis.get(keyReset(email));
    if (!saved || String(saved) !== String(code)) {
      return res.status(400).json({ error: 'Código inválido o expirado' });
    }

    // Buscar usuario
    const userId = await redis.get(keyByEmail(email));
    if (!userId) {
      // Por seguridad, no revelamos
      await redis.del(keyReset(email));
      return res.status(200).json({ ok: true });
    }

    // Cargar usuario
    const raw = await redis.get(keyById(userId));
    if (!raw) {
      await redis.del(keyReset(email));
      return res.status(200).json({ ok: true });
    }
    const user = typeof raw === 'string' ? JSON.parse(raw) : raw;

    // Hash y guardado
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;

    const p = redis.pipeline();
    p.set(keyById(userId), JSON.stringify(user));
    p.del(keyReset(email));
    await p.exec();

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[reset-password] ERROR:', e?.message);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
}
