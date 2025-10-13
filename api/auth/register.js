// api/auth/register.js
import { registerUser } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }
    
    const { user, token } = await registerUser({ email, password, name });
    
    // No devolver la contraseña hasheada
    const { password: _, ...userWithoutPassword } = user;
    
    return res.status(201).json({
      success: true,
      user: userWithoutPassword,
      token
    });
    
  } catch (error) {
    console.error('Error en el registro:', error);
    return res.status(400).json({ 
      success: false,
      error: error.message || 'Error al registrar el usuario' 
    });
  }
}
