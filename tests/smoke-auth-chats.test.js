/* Smoke test: auth + /api/chats stubs (501) */

describe('smoke: auth + chats 501', () => {
  let token;
  const base = 'http://localhost:3000';

  it('registers and logins', async () => {
    const email = `test+${Date.now()}@example.com`;
    const password = '123456';

    const r1 = await fetch(`${base}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (r1.status !== 201) throw new Error(`register failed: ${r1.status}`);
    const j1 = await r1.json();
    token = j1.token;
    if (!token) throw new Error('no token returned');

    const r2 = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!r2.ok) throw new Error(`login failed: ${r2.status}`);
  });

  it('protects /api/chats (401 without token)', async () => {
    const r = await fetch(`${base}/api/chats`);
    if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`);
  });

  it('returns 501 with token (stubs active)', async () => {
    const r = await fetch(`${base}/api/chats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (r.status !== 501) throw new Error(`expected 501, got ${r.status}`);
  });
});
