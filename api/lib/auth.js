// api/lib/auth.js
import { v4 as uuidv4 } from 'uuid';

// Generar un ID de sesión único
export const generateSessionId = () => `sess_${uuidv4()}`;

// Middleware para manejar la sesión
export const handleSession = (req, res, next) => {
  // Obtener el ID de sesión de las cookies o del encabezado
  let sessionId = req.cookies?.sessionId || req.headers['x-session-id'];
  
  // Si no hay ID de sesión, crear uno nuevo
  if (!sessionId) {
    sessionId = generateSessionId();
    // Establecer la cookie de sesión
    res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; HttpOnly; SameSite=Lax`);
  }
  
  // Adjuntar el ID de sesión al objeto de solicitud
  req.sessionId = sessionId;
  next();
};
