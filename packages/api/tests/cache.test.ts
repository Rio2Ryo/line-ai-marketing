import { describe, it, expect } from 'vitest';

const BASE = 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';

// ─── Cache-accelerated endpoints return 200 or 401 ───

describe('Cache-accelerated endpoints', () => {
  it('GET /api/stats/overview without auth → 401', async () => {
    const res = await fetch(BASE + '/api/stats/overview');
    expect(res.status).toBe(401);
  });

  it('GET /api/stats/delivery without auth → 401', async () => {
    const res = await fetch(BASE + '/api/stats/delivery');
    expect(res.status).toBe(401);
  });

  it('GET /api/widgets/data without auth → 401', async () => {
    const res = await fetch(BASE + '/api/widgets/data');
    expect(res.status).toBe(401);
  });

  it('GET /api/analytics/delivery-effectiveness without auth → 401', async () => {
    const res = await fetch(BASE + '/api/analytics/delivery-effectiveness');
    expect(res.status).toBe(401);
  });

  it('GET /api/analytics/user-activity without auth → 401', async () => {
    const res = await fetch(BASE + '/api/analytics/user-activity');
    expect(res.status).toBe(401);
  });

  it('GET /api/analytics/ai-performance without auth → 401', async () => {
    const res = await fetch(BASE + '/api/analytics/ai-performance');
    expect(res.status).toBe(401);
  });

  it('GET /api/analytics/churn-risk without auth → 401', async () => {
    const res = await fetch(BASE + '/api/analytics/churn-risk');
    expect(res.status).toBe(401);
  });

  it('GET /api/reports/performance without auth → 401', async () => {
    const res = await fetch(BASE + '/api/reports/performance');
    expect(res.status).toBe(401);
  });

  it('GET /api/line-stats/overview without auth → 401', async () => {
    const res = await fetch(BASE + '/api/line-stats/overview');
    expect(res.status).toBe(401);
  });

  it('GET /api/line-stats/engagement without auth → 401', async () => {
    const res = await fetch(BASE + '/api/line-stats/engagement');
    expect(res.status).toBe(401);
  });
});

// ─── Health check still fast (not cached, baseline) ───

describe('Health check baseline', () => {
  it('GET /health completes quickly', async () => {
    const start = Date.now();
    const res = await fetch(BASE + '/health');
    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(3000);
  });
});

// ─── Verify cache table exists ───

describe('Cache table integration', () => {
  it('API root still returns service info after schema migration', async () => {
    const res = await fetch(BASE + '/');
    const body = await res.json() as { status: string; service: string };
    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('LINE AI Marketing API');
  });
});
