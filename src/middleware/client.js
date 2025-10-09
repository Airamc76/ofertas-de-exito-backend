export default function client(req, res, next) {
  const id = req.header('x-client-id') || req.query.clientId || req.cookies?.clientId;
  if (!id) return res.status(400).json({ error: 'missing x-client-id' });
  req.clientId = id;
  next();
}
