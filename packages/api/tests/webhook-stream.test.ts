import { describe, it, expect } from 'vitest';

const BASE = 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';

describe('Webhook Stream endpoints', () => {
  it('GET /api/webhook-stream/events without auth → 401', async () => {
    const res = await fetch(BASE + '/api/webhook-stream/events');
    expect(res.status).toBe(401);
  });

  it('GET /api/webhook-stream/events/nonexistent without auth → 401', async () => {
    const res = await fetch(BASE + '/api/webhook-stream/events/nonexistent');
    expect(res.status).toBe(401);
  });

  it('GET /api/webhook-stream/stats without auth → 401', async () => {
    const res = await fetch(BASE + '/api/webhook-stream/stats');
    expect(res.status).toBe(401);
  });

  it('DELETE /api/webhook-stream/events without auth → 401', async () => {
    const res = await fetch(BASE + '/api/webhook-stream/events', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});

describe('Webhook Events table exists', () => {
  it('API root still returns service info after schema-v24', async () => {
    const res = await fetch(BASE + '/');
    const body = await res.json() as { status: string; service: string };
    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('LINE AI Marketing API');
  });
});
