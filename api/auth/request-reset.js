// api/auth/request-reset.js
import { getUserByEmail, saveUser } from '../lib/db.js';
import { generatePasswordResetToken } from '../lib/auth.js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'El correo electrónico es obligatorio' });
    }
    
    // Verificar si el usuario existe
    const user = await getUserByEmail(email);
    if (!user) {
      // Por seguridad, no revelamos si el correo existe o no
      return res.status(200).json({ 
        success: true,
        message: 'Si existe una cuenta con este correo, se ha enviado un enlace de restablecimiento'
      });
    }
    
    // Generar token de restablecimiento
    const resetToken = generatePasswordResetToken(email);
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString(); // Código de 6 dígitos
    
    // Guardar el código en el usuario
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hora de expiración
    user.resetPasswordCode = resetCode;
    
    await saveUser(user);
    
    // Enviar correo con el código (usando Resend)
    const { error } = await resend.emails.send({
      from: 'no-reply@ofertasdeexito.com',
      to: email,
      subject: 'Restablecimiento de contraseña',
      html: `
        <h2>Restablecimiento de contraseña</h2>
        <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
        <p>Tu código de verificación es: <strong>${resetCode}</strong></p>
        <p>Este código expirará en 1 hora.</p>
        <p>Si no solicitaste este restablecimiento, puedes ignorar este correo.</p>
      `
    });
    
    if (error) {
      console.error('Error al enviar el correo:', error);
      throw new Error('Error al enviar el correo de restablecimiento');
    }
    
    return res.status(200).json({ 
      success: true,
      message: 'Se ha enviado un correo con instrucciones para restablecer tu contraseña'
    });
    
  } catch (error) {
    console.error('Error en la solicitud de restablecimiento:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Error al procesar la solicitud' 
    });
  }
}
