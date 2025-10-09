import jwt from 'jsonwebtoken';

export default function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'No auth header' });
  const token = h.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'change-me');
    req.user = { id: payload.userId };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
