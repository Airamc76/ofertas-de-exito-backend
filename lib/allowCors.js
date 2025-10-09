export default function allowCors(handler) {
  return async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // sin cookies
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-client-id, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).end();

    try {
      return await handler(req, res);
    } catch (e) {
      console.error('Handler error:', e);
      // Siempre devolver headers CORS incluso en error
      return res.status(500).json({ error: 'internal_error' });
    }
  };
}
