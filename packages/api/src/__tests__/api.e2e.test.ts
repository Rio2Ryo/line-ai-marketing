import { describe, it, expect } from 'vitest';

const API = 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, init);
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ─── Public endpoints ───

describe('Public endpoints', () => {
  it('GET / returns service info', async () => {
    const { status, body } = await api('/');
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('LINE AI Marketing API');
    expect(body.version).toBeDefined();
  });

  it('GET /health returns healthy', async () => {
    const { status, body } = await api('/health');
    expect(status).toBe(200);
    expect(body.status).toBe('healthy');
  });

  it('GET /nonexistent returns 404', async () => {
    const { status, body } = await api('/nonexistent');
    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });
});

// ─── Auth-protected routes return 401 without token ───

describe('Auth-protected routes require token', () => {
  const protectedPaths = [
    ['GET', '/api/customers'],
    ['GET', '/api/tags'],
    ['GET', '/api/scenarios'],
    ['PUT', '/api/scenarios/test-id/steps/test-step-id'],
    ['PUT', '/api/scenarios/test-id/layout'],
    ['GET', '/api/stats'],
    ['GET', '/api/ai'],
    ['GET', '/api/knowledge'],
    ['GET', '/api/richmenu'],
    ['GET', '/api/surveys'],
    ['GET', '/api/segments/history'],
    ['POST', '/api/ai/generate/message'],
    ['GET', '/api/analytics/delivery-effectiveness'],
    ['GET', '/api/scheduled'],
    ['GET', '/api/auto-response'],
    ['GET', '/api/ab-tests'],
    ['GET', '/api/export/customers'],
    ['GET', '/api/export/delivery-logs'],
    ['GET', '/api/export/ai-logs'],
    ['GET', '/api/settings'],
    ['GET', '/api/ai/classify'],
    ['GET', '/api/ai/classify/summary'],
    ['GET', '/api/templates'],
    ['GET', '/api/reports/performance'],
    ['GET', '/api/notifications'],
    ['GET', '/api/notifications/unread-count'],
    ['GET', '/api/notifications/poll'],
    ['PUT', '/api/notifications/read-all'],
    ['POST', '/api/notifications/test'],
    ['GET', '/api/calendar'],
    ['GET', '/api/conversions/goals'],
    ['GET', '/api/conversions/funnel'],
    ['GET', '/api/conversions/summary'],
    ['GET', '/api/ai-optimize/timing'],
    ['GET', '/api/ai-optimize/message-patterns'],
    ['GET', '/api/delivery-errors'],
    ['GET', '/api/delivery-errors/summary'],
    ['GET', '/api/engagement-scores'],
    ['GET', '/api/engagement-scores/distribution'],
    ['POST', '/api/engagement-scores/calculate'],
    ['GET', '/api/delivery-queue'],
    ['POST', '/api/delivery-queue'],
    ['GET', '/api/follow-sources/sources'],
    ['GET', '/api/follow-sources/analytics'],
    ['GET', '/api/follow-sources/daily'],
    ['GET', '/api/chat/conversations'],
    ['GET', '/api/chat/test-user/messages'],
    ['POST', '/api/chat/test-user/send'],
    ['GET', '/api/widgets'],
    ['GET', '/api/widgets/data'],
    ['GET', '/api/roles'],
    ['GET', '/api/roles/me'],
    ['PUT', '/api/roles/test-user-id'],
    ['GET', '/api/media/test-message-id'],
    ['POST', '/api/import/preview'],
    ['POST', '/api/import/customers'],
    ['POST', '/api/import/tags'],
    ['POST', '/api/import/knowledge'],
    ['GET', '/api/api-monitor/summary'],
    ['GET', '/api/api-monitor/endpoints'],
    ['GET', '/api/api-monitor/daily'],
    ['GET', '/api/api-monitor/errors'],
    ['GET', '/api/api-monitor/slow'],
    ['GET', '/api/liff/profile'],
    ['GET', '/api/liff/surveys'],
    ['GET', '/api/liff/messages'],
    ['POST', '/api/webhook-test/simulate'],
    ['POST', '/api/webhook-test/cleanup'],
  ];

  for (const [method, path] of protectedPaths) {
    it(`${method} ${path} → 401`, async () => {
      const init: RequestInit = { method };
      if (method === 'POST') {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = '{}';
      }
      const { status } = await api(path, init);
      expect(status).toBe(401);
    });
  }
});

// ─── Webhook endpoint ───

describe('Webhook', () => {
  it('POST /webhook rejects invalid signature', async () => {
    const { status } = await api('/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': 'invalidsignature',
      },
      body: JSON.stringify({ events: [] }),
    });
    // Should reject with 401 or 400 (signature mismatch)
    expect([400, 401, 403]).toContain(status);
  });
});

// ─── Survey respond (public endpoint) ───

describe('Survey respond (no auth)', () => {
  it('POST /api/surveys/nonexistent/respond → 404', async () => {
    const { status, body } = await api('/api/surveys/nonexistent/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'test', answers: { q1: 'a' } }),
    });
    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });

  it('POST /api/surveys/nonexistent/respond without body → 400', async () => {
    const { status } = await api('/api/surveys/nonexistent/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect([400, 404]).toContain(status);
  });
});

// ─── CORS ───

describe('CORS headers', () => {
  it('OPTIONS / returns CORS headers', async () => {
    const res = await fetch(`${API}/`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://line-ai-marketing.pages.dev',
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(res.status).toBeLessThan(400);
    const acao = res.headers.get('access-control-allow-origin');
    expect(acao).toBe('https://line-ai-marketing.pages.dev');
  });

  it('rejects unknown origin', async () => {
    const res = await fetch(`${API}/`, {
      headers: { Origin: 'https://evil.example.com' },
    });
    const acao = res.headers.get('access-control-allow-origin');
    expect(acao).not.toBe('https://evil.example.com');
  });
});

// ─── Segment validation ───

describe('Segment API validation', () => {
  it('POST /api/segments/preview without auth → 401', async () => {
    const { status } = await api('/api/segments/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conditions: [] }),
    });
    expect(status).toBe(401);
  });
});

// ─── AI Generate validation ───

describe('AI Generate API validation', () => {
  it('POST /api/ai/generate/message without auth → 401', async () => {
    const { status } = await api('/api/ai/generate/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose: 'test', target: 'test', tone: 'casual' }),
    });
    expect(status).toBe(401);
  });

  it('POST /api/ai/generate/flex without auth → 401', async () => {
    const { status } = await api('/api/ai/generate/flex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose: 'test', style: 'card', content: 'test' }),
    });
    expect(status).toBe(401);
  });

  it('POST /api/ai/generate/improve without auth → 401', async () => {
    const { status } = await api('/api/ai/generate/improve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalText: 'test', instruction: 'test' }),
    });
    expect(status).toBe(401);
  });
});
