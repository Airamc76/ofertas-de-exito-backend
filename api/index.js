// api/index.js
let appPromise;

export default async (req, res) => {
  try {
    if (!appPromise) {
      console.log('[boot] importing server.js …');
      appPromise = import('../src/server.js').then(m => m.default);
    }
    const app = await appPromise;
    return app(req, res);
  } catch (e) {
    console.error('[boot] server crash:', e);
    res.status(500).json({ ok: false, error: (e?.stack || String(e)) });
  }
};
