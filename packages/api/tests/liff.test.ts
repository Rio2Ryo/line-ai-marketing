import { describe, it, expect } from 'vitest';

const BASE = 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';

describe('LIFF API - Auth', () => {
  it('GET /api/liff/profile without auth returns 401', async () => {
    const res = await fetch(BASE + '/api/liff/profile');
    expect(res.status).toBe(401);
  });

  it('GET /api/liff/surveys without auth returns 401', async () => {
    const res = await fetch(BASE + '/api/liff/surveys');
    expect(res.status).toBe(401);
  });

  it('GET /api/liff/messages without auth returns 401', async () => {
    const res = await fetch(BASE + '/api/liff/messages');
    expect(res.status).toBe(401);
  });

  it('PUT /api/liff/profile without auth returns 401', async () => {
    const res = await fetch(BASE + '/api/liff/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/liff/surveys/fake-id/respond without auth returns 401', async () => {
    const res = await fetch(BASE + '/api/liff/surveys/fake-id/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: {} }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/liff/profile with invalid token returns 401', async () => {
    const res = await fetch(BASE + '/api/liff/profile', {
      headers: { Authorization: 'Bearer invalid-token-12345' },
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/liff/surveys with invalid token returns 401', async () => {
    const res = await fetch(BASE + '/api/liff/surveys', {
      headers: { Authorization: 'Bearer invalid-token-12345' },
    });
    expect(res.status).toBe(401);
  });
});
