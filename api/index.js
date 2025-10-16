// api/index.js (temporal)
export default async (req, res) => {
  try {
    res.setHeader('x-hit', 'index-echo');
    return res.status(200).json({ ok: true, path: req.url });
  } catch (e) {
    try { console.error('index crash', e); } catch {}
    return res.status(500).json({ ok: false, error: String(e) });
  }
};
