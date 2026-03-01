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
    ['GET', '/api/stats'],
    ['GET', '/api/ai'],
    ['GET', '/api/knowledge'],
    ['GET', '/api/richmenu'],
    ['GET', '/api/surveys'],
    ['GET', '/api/segments/history'],
    ['POST', '/api/ai/generate/message'],
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
