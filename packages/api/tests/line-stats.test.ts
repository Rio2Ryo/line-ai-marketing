import { describe, it, expect } from 'vitest';

const BASE = 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';

// ─── Auth Required ───

describe('LINE Stats API - Auth Required', () => {
  it('GET /api/line-stats/overview without auth → 401', async () => {
    const res = await fetch(BASE + '/api/line-stats/overview');
    expect(res.status).toBe(401);
  });

  it('GET /api/line-stats/followers without auth → 401', async () => {
    const res = await fetch(BASE + '/api/line-stats/followers');
    expect(res.status).toBe(401);
  });

  it('GET /api/line-stats/messages without auth → 401', async () => {
    const res = await fetch(BASE + '/api/line-stats/messages');
    expect(res.status).toBe(401);
  });

  it('GET /api/line-stats/engagement without auth → 401', async () => {
    const res = await fetch(BASE + '/api/line-stats/engagement');
    expect(res.status).toBe(401);
  });
});

// ─── Query Parameter Validation ───

describe('LINE Stats API - Query Parameters', () => {
  it('GET /api/line-stats/followers?days=7 without auth → 401', async () => {
    const res = await fetch(BASE + '/api/line-stats/followers?days=7');
    expect(res.status).toBe(401);
  });

  it('GET /api/line-stats/messages?days=90 without auth → 401', async () => {
    const res = await fetch(BASE + '/api/line-stats/messages?days=90');
    expect(res.status).toBe(401);
  });

  it('GET /api/line-stats/engagement?days=30 without auth → 401', async () => {
    const res = await fetch(BASE + '/api/line-stats/engagement?days=30');
    expect(res.status).toBe(401);
  });
});

// ─── Endpoint Existence ───

describe('LINE Stats API - Endpoint Existence', () => {
  it('GET /api/line-stats → 404 (no root handler)', async () => {
    const res = await fetch(BASE + '/api/line-stats');
    // Should be 401 (auth middleware catches first) or 404
    expect([401, 404]).toContain(res.status);
  });

  it('POST /api/line-stats/overview → 404 (GET only)', async () => {
    const res = await fetch(BASE + '/api/line-stats/overview', { method: 'POST' });
    // Auth middleware first, then method not found
    expect([401, 404]).toContain(res.status);
  });

  it('GET /api/line-stats/nonexistent → 404', async () => {
    const res = await fetch(BASE + '/api/line-stats/nonexistent');
    expect([401, 404]).toContain(res.status);
  });
});
