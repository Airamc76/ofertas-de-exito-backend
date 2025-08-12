// /api/auth/forgot.js
import { Redis } from '@upstash/redis';

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
const resetKey   = (email) => `alma:reset:${email.toLowerCase()}`; // guarda { userId, codeHash? -> aquí guardamos el código plano }

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email requerido' });

    // 1) existe el usuario?
    const userId = await redis.get(keyByEmail(email));
    if (!userId) {
      // Por seguridad, respondemos OK igual (no revelamos existencia)
      return res.status(200).json({ ok: true });
    }

    // 2) genera código de 6 dígitos y guárdalo con TTL (10 min = 600s)
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await redis.set(resetKey(email), JSON.stringify({ userId, code }), { ex: 600 });

    // 3) Envío (por ahora lo registramos en logs del server)
    console.log(`[reset] email=${email} code=${code} (válido 10 min)`);

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[forgot] error:', e?.message);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
}
