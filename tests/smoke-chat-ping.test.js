/* Smoke test: /api/chat/ping */

describe('smoke: /api/chat/ping', () => {
  it('returns ok', async () => {
    const res = await fetch('http://localhost:3000/api/chat/ping');
    if (!res.ok) throw new Error(`Ping failed: ${res.status}`);
  });
});
