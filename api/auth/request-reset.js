import { Redis } from '@upstash/redis';
import { Resend } from 'resend';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
const resend = new Resend(process.env.RESEND_API_KEY);

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
const keyByEmail = (email) => `alma:user:email:${email.toLowerCase()}`;
const keyReset   = (email) => `alma:reset:${email.toLowerCase()}`;

const FROM = process.env.EMAIL_FROM || 'Alma <onboarding@resend.dev>'; // sandbox o tu dominio

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    // Si el usuario no existe, respondemos ok igual (para no filtrar emails)
    const userId = await redis.get(keyByEmail(email));
    // Generar y guardar código siempre (aunque el email no esté registrado)
    const code = String(Math.floor(100000 + Math.random() * 900000));
    // TTL 15 min
    await redis.set(keyReset(email), code, { ex: 15 * 60 });

    // Enviar correo
    const subject = 'Tu código para restablecer la contraseña';
    const html = `
      <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:auto">
        <h2 style="color:#111827">Código de verificación</h2>
        <p>Usa este código para restablecer tu contraseña en <strong>Alma</strong>:</p>
        <div style="font-size:28px; letter-spacing:6px; font-weight:700; padding:16px 0;">${code}</div>
        <p style="color:#6b7280">Caduca en 15 minutos. Si no fuiste tú, ignora este mensaje.</p>
      </div>
    `;
    try {
      await resend.emails.send({
        from: FROM,
        to: email,
        subject,
        html
      });
    } catch (mailErr) {
      // No revelamos error de mail al cliente, pero lo registramos
      console.error('[request-reset] Error enviando email:', mailErr?.message);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[request-reset] ERROR:', e?.message);
    return res.status(500).json({ error: 'Error en el servidor' });
  }
}
