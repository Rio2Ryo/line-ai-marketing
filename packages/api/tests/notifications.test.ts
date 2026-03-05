import { describe, it, expect } from 'vitest';

const BASE = 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';

// ─── Auth Required ───

describe('Notifications API - Auth Required', () => {
  it('GET /api/notifications without auth → 401', async () => {
    const res = await fetch(BASE + '/api/notifications');
    expect(res.status).toBe(401);
  });

  it('GET /api/notifications/unread-count without auth → 401', async () => {
    const res = await fetch(BASE + '/api/notifications/unread-count');
    expect(res.status).toBe(401);
  });

  it('GET /api/notifications/poll without auth → 401', async () => {
    const res = await fetch(BASE + '/api/notifications/poll');
    expect(res.status).toBe(401);
  });

  it('PUT /api/notifications/read-all without auth → 401', async () => {
    const res = await fetch(BASE + '/api/notifications/read-all', { method: 'PUT' });
    expect(res.status).toBe(401);
  });

  it('PUT /api/notifications/test-id/read without auth → 401', async () => {
    const res = await fetch(BASE + '/api/notifications/test-id/read', { method: 'PUT' });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/notifications/test-id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/notifications/test-id', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('POST /api/notifications/test without auth → 401', async () => {
    const res = await fetch(BASE + '/api/notifications/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'slack' }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── Invalid Token ───

describe('Notifications API - Invalid Token', () => {
  const headers = { Authorization: 'Bearer invalid-token-xyz' };

  it('GET /api/notifications with invalid token → 401', async () => {
    const res = await fetch(BASE + '/api/notifications', { headers });
    expect(res.status).toBe(401);
  });

  it('GET /api/notifications/unread-count with invalid token → 401', async () => {
    const res = await fetch(BASE + '/api/notifications/unread-count', { headers });
    expect(res.status).toBe(401);
  });

  it('GET /api/notifications/poll with invalid token → 401', async () => {
    const res = await fetch(BASE + '/api/notifications/poll', { headers });
    expect(res.status).toBe(401);
  });

  it('PUT /api/notifications/read-all with invalid token → 401', async () => {
    const res = await fetch(BASE + '/api/notifications/read-all', { method: 'PUT', headers });
    expect(res.status).toBe(401);
  });
});

// ─── Query Parameters ───

describe('Notifications API - Query Params', () => {
  it('GET /api/notifications?unread=1 without auth → 401', async () => {
    const res = await fetch(BASE + '/api/notifications?unread=1');
    expect(res.status).toBe(401);
  });

  it('GET /api/notifications?page=2&limit=10 without auth → 401', async () => {
    const res = await fetch(BASE + '/api/notifications?page=2&limit=10');
    expect(res.status).toBe(401);
  });

  it('GET /api/notifications/poll?since=2026-01-01T00:00:00Z without auth → 401', async () => {
    const res = await fetch(BASE + '/api/notifications/poll?since=2026-01-01T00:00:00Z');
    expect(res.status).toBe(401);
  });
});
