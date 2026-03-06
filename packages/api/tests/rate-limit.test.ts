import { describe, it, expect } from 'vitest';

const BASE = 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';

// ─── Auth Required ───

describe('Rate Limit API - Auth Required', () => {
  it('GET /api/rate-limit/stats without auth → 401', async () => {
    const res = await fetch(BASE + '/api/rate-limit/stats');
    expect(res.status).toBe(401);
  });

  it('GET /api/rate-limit/logs without auth → 401', async () => {
    const res = await fetch(BASE + '/api/rate-limit/logs');
    expect(res.status).toBe(401);
  });

  it('GET /api/rate-limit/hourly without auth → 401', async () => {
    const res = await fetch(BASE + '/api/rate-limit/hourly');
    expect(res.status).toBe(401);
  });

  it('DELETE /api/rate-limit/logs without auth → 401', async () => {
    const res = await fetch(BASE + '/api/rate-limit/logs', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});

// ─── Query Params ───

describe('Rate Limit API - Query Params', () => {
  it('GET /api/rate-limit/logs?type=success without auth → 401', async () => {
    const res = await fetch(BASE + '/api/rate-limit/logs?type=success');
    expect(res.status).toBe(401);
  });

  it('GET /api/rate-limit/logs?type=rate_limited without auth → 401', async () => {
    const res = await fetch(BASE + '/api/rate-limit/logs?type=rate_limited');
    expect(res.status).toBe(401);
  });
});

// ─── Endpoint Existence ───

describe('Rate Limit API - Endpoint Existence', () => {
  it('GET /api/rate-limit → 401 (auth middleware catches)', async () => {
    const res = await fetch(BASE + '/api/rate-limit');
    expect([401, 404]).toContain(res.status);
  });

  it('POST /api/rate-limit/stats → 401 or 404', async () => {
    const res = await fetch(BASE + '/api/rate-limit/stats', { method: 'POST' });
    expect([401, 404]).toContain(res.status);
  });
});
