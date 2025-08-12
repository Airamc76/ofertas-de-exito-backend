// api/auth/reset-password.js
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
// import { getUserByEmail, updateUserPasswordHash } from './_users.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

// ⬇️ Implementa estas funciones según tu almacenamiento real
async function getUserByEmailFake(email) {
  // Reemplaza por tu lookup real (KV/DB)
  return null;
}
async function updateUserPasswordHashFake(userIdOrEmail, passwordHash) {
  // Guarda el hash en tu storage real.
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { token, newPassword } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token requerido' });
    }
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }
    if (payload?.purpose !== 'reset') {
      return res.status(400).json({ error: 'Token inválido' });
    }

    const email = payload.email;
    if (!email) return res.status(400).json({ error: 'Token sin email' });

    // 1) Buscar usuario (no revelamos si existe)
    // const user = await getUserByEmail(email);
    const user = await getUserByEmailFake(email);

    // 2) Hashear nueva clave
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // 3) Guardar (si existe); para no revelar nada, siempre respondemos 200
    // const ok = user ? await updateUserPasswordHash(user.userId, passwordHash) : true;
    const ok = user ? await updateUserPasswordHashFake(user.userId || email, passwordHash) : true;

    return res.json({ ok: !!ok });
  } catch (e) {
    console.error('reset-password error:', e);
    return res.status(500).json({ error: 'Error interno' });
  }
}
