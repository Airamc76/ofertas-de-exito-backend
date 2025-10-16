// src/api/_cors.js
const ALLOWED = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

export function withCors(handler){
  return async (req, res) => {
    const origin = req.headers.origin || '';
    if (ALLOWED.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else {
      // Fallback abierto si no se especifica ALLOWED_ORIGINS
      if (!ALLOWED.length) res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-client-id');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    return handler(req, res);
  };
}
