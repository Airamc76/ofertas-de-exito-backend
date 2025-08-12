// api/auth/request-reset.js
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import axios from 'axios';
// ⬇️ Ajusta este import si ya tienes utilidades para cargar usuarios
// import { getUserByEmail } from './_users.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const APP_ORIGIN = process.env.APP_ORIGIN || 'https://ofertas-de-exito-frontend.vercel.app'; 
// Pon aquí el dominio real del front (donde está tu index.html / reset.html)

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''; // opcional

// Simulación de buscador de usuario: NO filtres por existencia para evitar enumeración
async function findUserIdByEmail(email) {
  // Si tienes función real, úsala:
  // const user = await getUserByEmail(email);
  // return user?.userId || null;

  // Si no la tienes, retornamos null (no revelamos si existe)
  return null;
}

async function sendMailWithResend(to, subject, html) {
  if (!RESEND_API_KEY) return { ok: false, sent: false };
  try {
    const res = await axios.post(
      'https://api.resend.com/emails',
      {
        from: 'Alma <no-reply@ofertasdeexito.ai>',
        to: [to],
        subject,
        html
      },
      { headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' } }
    );
    return { ok: true, sent: true, id: res.data?.id };
  } catch (e) {
    console.error('Resend error:', e?.response?.data || e.message);
    return { ok: false, sent: false };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email } = req.body || {};
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    // 1) (opc.) buscar userId por email – NO revelar si existe
    const userId = await findUserIdByEmail(email);

    // 2) Generar token corto para reset (15 min)
    const token = jwt.sign(
      { purpose: 'reset', email, userId: userId || undefined },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // 3) Link para la página de reset del FRONT
    const link = `${APP_ORIGIN}/reset.html?token=${encodeURIComponent(token)}`;

    // 4) Intentar mandar email (si hay RESEND_API_KEY)
    const subject = 'Restablecer contraseña — Alma';
    const html = `
      <div style="font-family:Inter,system-ui,Arial,sans-serif;line-height:1.55">
        <h2>Restablecer contraseña</h2>
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p>Haz clic en el siguiente botón (o copia el enlace) para continuar:</p>
        <p><a href="${link}" style="display:inline-block;padding:10px 16px;background:#516BFF;color:#fff;border-radius:10px;text-decoration:none">Restablecer contraseña</a></p>
        <p style="color:#666;font-size:12px">El enlace expira en 15 minutos.</p>
        <p style="color:#666;font-size:12px">${link}</p>
        <hr/>
        <p style="color:#666;font-size:12px">Si no solicitaste esto, ignora este correo.</p>
      </div>`;

    const mail = await sendMailWithResend(email, subject, html);

    // Por seguridad, siempre 200 aunque el email no exista.
    // En DEV, si no hay RESEND_API_KEY, devolvemos el link para que lo pruebes fácil.
    return res.json({
      ok: true,
      ...(mail.sent ? { delivered: true } : { delivered: false, dev_link: link })
    });
  } catch (e) {
    console.error('request-reset error:', e);
    return res.status(500).json({ error: 'Error interno' });
  }
}
