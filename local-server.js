// local-server.js
// Servidor solo para desarrollo local. No se usa en Vercel.
import app from './src/server.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[local-server] Escuchando en http://localhost:${PORT}`);
});
