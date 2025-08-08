// api/chat.js
export default async function handler(req, res) {
  try {
    // 1) Healthcheck rápido
    if (req.method === 'GET') {
      if (req.url.endsWith('/ping')) {
        return res.status(200).json({ ok: true, t: Date.now() });
      }
      return res.status(200).json({ ok: true, route: 'GET /api/chat' });
    }

    // 2) Solo aceptamos POST /api/chat
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Aseguramos body (Vercel parsea JSON por defecto si content-type es application/json)
    const { mensaje, userId } = req.body || {};
    if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

    // Respuesta dummy inmediata (sin OpenAI) para comprobar que funciona
    const reply = `Eco de Alma: "${mensaje}" (userId: ${userId || 'anon'})`;

    return res.status(200).json({ fuente: 'dummy', respuesta: reply });
  } catch (e) {
    console.error('Handler error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
