import { describe, it, expect } from 'vitest';

const BASE = 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';

describe('Security endpoints (auth + admin required)', () => {
  it('GET /api/security/audit-logs without auth → 401', async () => {
    const res = await fetch(BASE + '/api/security/audit-logs');
    expect(res.status).toBe(401);
  });

  it('GET /api/security/audit-stats without auth → 401', async () => {
    const res = await fetch(BASE + '/api/security/audit-stats');
    expect(res.status).toBe(401);
  });

  it('GET /api/security/ip-rules without auth → 401', async () => {
    const res = await fetch(BASE + '/api/security/ip-rules');
    expect(res.status).toBe(401);
  });

  it('POST /api/security/ip-rules without auth → 401', async () => {
    const res = await fetch(BASE + '/api/security/ip-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip_pattern: '1.2.3.4', rule_type: 'block' }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/security/audit-logs without auth → 401', async () => {
    const res = await fetch(BASE + '/api/security/audit-logs', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});

describe('Webhook signature verification still works', () => {
  it('POST /webhook without signature → 400', async () => {
    const res = await fetch(BASE + '/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /webhook with invalid signature → 403', async () => {
    const res = await fetch(BASE + '/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': 'invalid-signature',
      },
      body: JSON.stringify({ events: [] }),
    });
    expect(res.status).toBe(403);
  });
});

describe('Security schema exists', () => {
  it('API root returns service info after schema-v26', async () => {
    const res = await fetch(BASE + '/');
    const body = await res.json() as { status: string; service: string };
    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
  });
});
