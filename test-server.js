// Script de prueba simple
const http = require('http');

const server = http.createServer((req, res) => {
  console.log('Petición recibida:', req.url);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ 
    ok: true, 
    message: '¡Servidor funcionando correctamente!',
    timestamp: new Date().toISOString()
  }));
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Servidor de prueba escuchando en http://localhost:${PORT}`);
  console.log('Prueba con:');
  console.log(`Invoke-WebRequest -Uri "http://localhost:${PORT}" -Method Get | Select-Object -Expand Content`);
});
