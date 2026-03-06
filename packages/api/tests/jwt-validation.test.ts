import { describe, it, expect } from 'vitest';

const BASE = 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';

// Test various JWT token format edge cases against auth-protected endpoints

// ─── Malformed Token Formats ───

describe('JWT - Malformed Token Formats', () => {
  const endpoint = BASE + '/api/customers';

  it('Empty Bearer token → 401', async () => {
    const res = await fetch(endpoint, {
      headers: { Authorization: 'Bearer ' },
    });
    expect(res.status).toBe(401);
  });

  it('No Bearer prefix → 401', async () => {
    const res = await fetch(endpoint, {
      headers: { Authorization: 'some-token-here' },
    });
    expect(res.status).toBe(401);
  });

  it('Basic auth instead of Bearer → 401', async () => {
    const res = await fetch(endpoint, {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(res.status).toBe(401);
  });

  it('Bearer with extra spaces → 401', async () => {
    const res = await fetch(endpoint, {
      headers: { Authorization: 'Bearer  extra-spaces' },
    });
    expect(res.status).toBe(401);
  });

  it('Multiple Bearer tokens → 401', async () => {
    const res = await fetch(endpoint, {
      headers: { Authorization: 'Bearer token1 Bearer token2' },
    });
    expect(res.status).toBe(401);
  });

  it('Empty Authorization header → 401', async () => {
    const res = await fetch(endpoint, {
      headers: { Authorization: '' },
    });
    expect(res.status).toBe(401);
  });

  it('Lowercase "bearer" prefix → 401', async () => {
    const res = await fetch(endpoint, {
      headers: { Authorization: 'bearer some-token' },
    });
    // The middleware lowercases the check, so this should still be rejected by JWT validation
    expect(res.status).toBe(401);
  });
});

// ─── Invalid JWT Structure ───

describe('JWT - Invalid Structure', () => {
  const endpoint = BASE + '/api/scenarios';

  it('Token with only 1 part → 401', async () => {
    const res = await fetch(endpoint, {
      headers: { Authorization: 'Bearer headeronly' },
    });
    expect(res.status).toBe(401);
  });

  it('Token with only 2 parts → 401', async () => {
    const res = await fetch(endpoint, {
      headers: { Authorization: 'Bearer header.payload' },
    });
    expect(res.status).toBe(401);
  });

  it('Token with 4 parts → 401', async () => {
    const res = await fetch(endpoint, {
      headers: { Authorization: 'Bearer a.b.c.d' },
    });
    expect(res.status).toBe(401);
  });

  it('Token with empty segments → 401', async () => {
    const res = await fetch(endpoint, {
      headers: { Authorization: 'Bearer ...' },
    });
    expect(res.status).toBe(401);
  });

  it('Valid-looking but fake JWT → 401', async () => {
    // Create a fake JWT with invalid signature
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '');
    const payload = btoa(JSON.stringify({ sub: 'fake-user', iat: Math.floor(Date.now() / 1000) })).replace(/=/g, '');
    const signature = btoa('fake-signature').replace(/=/g, '');
    const fakeJwt = `${header}.${payload}.${signature}`;

    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${fakeJwt}` },
    });
    expect(res.status).toBe(401);
  });

  it('JWT with base64url encoded but wrong secret → 401', async () => {
    // A structurally valid JWT signed with the wrong secret
    const header = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const payload = 'eyJzdWIiOiJ0ZXN0LXVzZXIiLCJpYXQiOjE3MDk2NzIwMDB9';
    const signature = 'dGVzdC1zaWduYXR1cmUtdGhhdC1pcy1pbnZhbGlk';
    const token = `${header}.${payload}.${signature}`;

    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
  });
});

// ─── Expired Token Simulation ───

describe('JWT - Expired Token', () => {
  it('JWT with past exp claim → 401', async () => {
    // This JWT has an exp in the past (2020-01-01). Even if signature somehow matched,
    // the verifyJwt checks expiration.
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '');
    const payload = btoa(JSON.stringify({
      sub: 'expired-user',
      iat: 1577836800,
      exp: 1577836801, // 2020-01-01T00:00:01
    })).replace(/=/g, '');
    const signature = btoa('expired-sig').replace(/=/g, '');

    const res = await fetch(BASE + '/api/customers', {
      headers: { Authorization: `Bearer ${header}.${payload}.${signature}` },
    });
    expect(res.status).toBe(401);
  });
});

// ─── Special Characters in Token ───

describe('JWT - Special Characters', () => {
  const endpoint = BASE + '/api/tags';

  it('Token with encoded unicode characters → 401', async () => {
    const res = await fetch(endpoint, {
      headers: { Authorization: 'Bearer %E3%83%A6%E3%83%8B%E3%82%B3%E3%83%BC%E3%83%89' },
    });
    expect(res.status).toBe(401);
  });

  it('Token with SQL injection attempt → 401', async () => {
    const res = await fetch(endpoint, {
      headers: { Authorization: "Bearer ' OR 1=1 --" },
    });
    expect(res.status).toBe(401);
  });

  it('Token with XSS payload → 401', async () => {
    const res = await fetch(endpoint, {
      headers: { Authorization: 'Bearer <script>alert(1)</script>' },
    });
    expect(res.status).toBe(401);
  });

  it('Very long token string → 401', async () => {
    const longToken = 'a'.repeat(10000);
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${longToken}` },
    });
    expect(res.status).toBe(401);
  });

  it('Token with encoded null bytes → 401', async () => {
    const res = await fetch(endpoint, {
      headers: { Authorization: 'Bearer null%00byte%00token' },
    });
    expect(res.status).toBe(401);
  });
});

// ─── Cross-Route Invalid Token Consistency ───

describe('JWT - Consistent 401 across different route groups', () => {
  const invalidHeaders = { Authorization: 'Bearer invalid-token-consistency-test' };

  const routes = [
    { method: 'GET', path: '/api/customers' },
    { method: 'GET', path: '/api/tags' },
    { method: 'GET', path: '/api/scenarios' },
    { method: 'GET', path: '/api/knowledge' },
    { method: 'GET', path: '/api/surveys' },
    { method: 'GET', path: '/api/templates' },
    { method: 'GET', path: '/api/ab-tests' },
    { method: 'GET', path: '/api/auto-response' },
    { method: 'GET', path: '/api/delivery-queue' },
    { method: 'GET', path: '/api/delivery-errors' },
    { method: 'GET', path: '/api/engagement-scores' },
    { method: 'GET', path: '/api/conversions/goals' },
    { method: 'GET', path: '/api/follow-sources/sources' },
    { method: 'GET', path: '/api/chat/conversations' },
    { method: 'GET', path: '/api/settings' },
    { method: 'GET', path: '/api/roles/me' },
    { method: 'GET', path: '/api/export/customers' },
    { method: 'GET', path: '/api/widgets' },
    { method: 'GET', path: '/api/ai/logs' },
    { method: 'GET', path: '/api/api-monitor/summary' },
    { method: 'GET', path: '/api/richmenu' },
    { method: 'GET', path: '/api/calendar' },
    { method: 'GET', path: '/auth/me' },
  ];

  for (const { method, path } of routes) {
    it(`${method} ${path} with invalid token → 401`, async () => {
      const res = await fetch(BASE + path, {
        method,
        headers: invalidHeaders,
      });
      expect(res.status).toBe(401);
    });
  }
});

// ─── Auth Error Response Format ───

describe('JWT - Error Response Format', () => {
  it('401 response has correct JSON structure (no auth)', async () => {
    const res = await fetch(BASE + '/api/customers');
    expect(res.status).toBe(401);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
    expect(typeof body.error).toBe('string');
  });

  it('401 response has correct JSON structure (invalid token)', async () => {
    const res = await fetch(BASE + '/api/customers', {
      headers: { Authorization: 'Bearer bad-token' },
    });
    expect(res.status).toBe(401);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });

  it('401 response has correct JSON structure (bad format)', async () => {
    const res = await fetch(BASE + '/api/customers', {
      headers: { Authorization: 'NotBearer token' },
    });
    expect(res.status).toBe(401);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toContain('Bearer');
  });
});

// ─── Public Endpoints (no auth needed) ───

describe('Public Endpoints - No Auth Required', () => {
  it('GET / returns service info', async () => {
    const res = await fetch(BASE + '/');
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; service: string; version: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('LINE AI Marketing API');
    expect(body.version).toBeDefined();
  });

  it('GET /health returns healthy', async () => {
    const res = await fetch(BASE + '/health');
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('healthy');
  });

  it('Non-existent route returns 404 with JSON', async () => {
    const res = await fetch(BASE + '/api/nonexistent-route-xyz');
    expect(res.status).toBe(404);
    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe('Not Found');
  });
});

// ─── CORS Headers ───

describe('CORS Headers', () => {
  it('OPTIONS request returns CORS headers', async () => {
    const res = await fetch(BASE + '/api/customers', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://line-ai-marketing.pages.dev',
        'Access-Control-Request-Method': 'GET',
      },
    });
    // Should return 200 or 204 with CORS headers
    expect([200, 204]).toContain(res.status);
    const acaoHeader = res.headers.get('access-control-allow-origin');
    expect(acaoHeader).toBeTruthy();
  });

  it('Allowed origin gets correct CORS header', async () => {
    const res = await fetch(BASE + '/health', {
      headers: { Origin: 'https://line-ai-marketing.pages.dev' },
    });
    expect(res.status).toBe(200);
    const acaoHeader = res.headers.get('access-control-allow-origin');
    expect(acaoHeader).toBe('https://line-ai-marketing.pages.dev');
  });
});
