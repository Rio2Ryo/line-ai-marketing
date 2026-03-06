import { describe, it, expect } from 'vitest';

const BASE = 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';

describe('Accounts endpoints (auth required)', () => {
  it('GET /api/accounts without auth → 401', async () => {
    const res = await fetch(BASE + '/api/accounts');
    expect(res.status).toBe(401);
  });

  it('GET /api/accounts/default without auth → 401', async () => {
    const res = await fetch(BASE + '/api/accounts/default');
    expect(res.status).toBe(401);
  });

  it('POST /api/accounts without auth → 401', async () => {
    const res = await fetch(BASE + '/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    expect(res.status).toBe(401);
  });

  it('PUT /api/accounts/default without auth → 401', async () => {
    const res = await fetch(BASE + '/api/accounts/default', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/accounts/default without auth → 401', async () => {
    const res = await fetch(BASE + '/api/accounts/default', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('GET /api/accounts/current/resolve without auth → 401', async () => {
    const res = await fetch(BASE + '/api/accounts/current/resolve');
    expect(res.status).toBe(401);
  });

  it('POST /api/accounts/default/members without auth → 401', async () => {
    const res = await fetch(BASE + '/api/accounts/default/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'test' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('Multi-tenant schema exists', () => {
  it('API root returns service info after schema-v25', async () => {
    const res = await fetch(BASE + '/');
    const body = await res.json() as { status: string; service: string };
    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
  });
});
