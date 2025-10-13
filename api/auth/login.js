// api/auth/login.js
import { loginUser } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Correo electrónico y contraseña son obligatorios' });
    }
    
    const { user, token } = await loginUser(email, password);
    
    // No devolver la contraseña hasheada
    const { password: _, ...userWithoutPassword } = user;
    
    return res.status(200).json({
      success: true,
      user: userWithoutPassword,
      token
    });
    
  } catch (error) {
    console.error('Error en el inicio de sesión:', error);
    return res.status(401).json({ 
      success: false,
      error: error.message || 'Credenciales inválidas' 
    });
  }
}
