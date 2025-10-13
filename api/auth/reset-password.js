// api/auth/reset-password.js
import { getUserByEmail, saveUser } from '../lib/db.js';
import { verifyToken, hashPassword } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { email, code, newPassword } = req.body;
    
    if (!email || !code || !newPassword) {
      return res.status(400).json({ 
        error: 'Correo electrónico, código y nueva contraseña son obligatorios' 
      });
    }
    
    // Verificar si el usuario existe
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ 
        success: false,
        error: 'No se pudo restablecer la contraseña' 
      });
    }
    
    // Verificar el código de restablecimiento
    if (user.resetPasswordCode !== code) {
      return res.status(400).json({ 
        success: false,
        error: 'Código de verificación inválido o expirado' 
      });
    }
    
    // Verificar si el token ha expirado
    if (Date.now() > user.resetPasswordExpires) {
      return res.status(400).json({ 
        success: false,
        error: 'El código de verificación ha expirado' 
      });
    }
    
    // Actualizar la contraseña
    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;
    
    // Limpiar los campos de restablecimiento
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.resetPasswordCode = undefined;
    
    await saveUser(user);
    
    return res.status(200).json({ 
      success: true,
      message: 'Contraseña restablecida correctamente' 
    });
    
  } catch (error) {
    console.error('Error al restablecer la contraseña:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Error al restablecer la contraseña' 
    });
  }
}
