import { describe, it, expect } from 'vitest';

const BASE = 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';

// ─── Webhook Signature Validation ───

describe('Webhook - Signature Validation', () => {
  it('POST /webhook without signature returns 400', async () => {
    const res = await fetch(BASE + '/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('signature');
  });

  it('POST /webhook with invalid signature returns 403', async () => {
    const res = await fetch(BASE + '/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': 'aW52YWxpZHNpZ25hdHVyZQ==',
      },
      body: JSON.stringify({ events: [] }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('POST /webhook with empty signature returns 403', async () => {
    const res = await fetch(BASE + '/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': '',
      },
      body: JSON.stringify({ events: [] }),
    });
    expect([400, 403]).toContain(res.status);
  });

  it('POST /webhook with base64-encoded fake signature returns 403', async () => {
    const res = await fetch(BASE + '/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': 'dGVzdHNpZ25hdHVyZXRoYXRpc2xvbmdlbm91Z2g=',
      },
      body: JSON.stringify({
        events: [{ type: 'message', source: { userId: 'test' }, message: { type: 'text', text: 'hi' } }],
      }),
    });
    expect(res.status).toBe(403);
  });
});

// ─── Webhook HTTP Methods ───

describe('Webhook - HTTP Methods', () => {
  it('GET /webhook returns 404 (only POST allowed)', async () => {
    const res = await fetch(BASE + '/webhook');
    expect(res.status).toBe(404);
  });

  it('PUT /webhook returns 404', async () => {
    const res = await fetch(BASE + '/webhook', { method: 'PUT' });
    expect(res.status).toBe(404);
  });

  it('DELETE /webhook returns 404', async () => {
    const res = await fetch(BASE + '/webhook', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

// ─── Webhook Payload Structures (all rejected at signature) ───

describe('Webhook - Message Type Payloads', () => {
  const messageTypes = [
    { type: 'text', extra: { text: 'Hello world' } },
    { type: 'image', extra: { id: 'img001', contentProvider: { type: 'line' } } },
    { type: 'video', extra: { id: 'vid001', duration: 5000, contentProvider: { type: 'line' } } },
    { type: 'audio', extra: { id: 'aud001', duration: 3000, contentProvider: { type: 'line' } } },
    { type: 'file', extra: { id: 'file001', fileName: 'doc.pdf', fileSize: 1024 } },
    { type: 'location', extra: { title: 'Tokyo', address: 'Tokyo, Japan', latitude: 35.6762, longitude: 139.6503 } },
    { type: 'sticker', extra: { packageId: '1', stickerId: '1', stickerResourceType: 'STATIC' } },
  ];

  for (const { type, extra } of messageTypes) {
    it(`${type} message payload is rejected at signature check`, async () => {
      const res = await fetch(BASE + '/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-line-signature': 'fake-sig',
        },
        body: JSON.stringify({
          events: [{
            type: 'message',
            replyToken: 'test-reply-token',
            source: { type: 'user', userId: 'U' + type },
            message: { id: 'id-' + type, type, ...extra },
          }],
        }),
      });
      expect(res.status).toBe(403);
    });
  }
});

// ─── Webhook Event Types ───

describe('Webhook - Event Types', () => {
  it('follow event payload', async () => {
    const res = await fetch(BASE + '/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-line-signature': 'fake' },
      body: JSON.stringify({
        events: [{ type: 'follow', replyToken: 'test', source: { type: 'user', userId: 'Ufollow1' } }],
      }),
    });
    expect(res.status).toBe(403);
  });

  it('unfollow event payload', async () => {
    const res = await fetch(BASE + '/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-line-signature': 'fake' },
      body: JSON.stringify({
        events: [{ type: 'unfollow', source: { type: 'user', userId: 'Uunfollow1' } }],
      }),
    });
    expect(res.status).toBe(403);
  });

  it('postback event payload', async () => {
    const res = await fetch(BASE + '/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-line-signature': 'fake' },
      body: JSON.stringify({
        events: [{ type: 'postback', replyToken: 'test', source: { userId: 'U1234' }, postback: { data: 'action=buy&itemId=123' } }],
      }),
    });
    expect(res.status).toBe(403);
  });

  it('multiple events in single payload', async () => {
    const res = await fetch(BASE + '/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-line-signature': 'fake' },
      body: JSON.stringify({
        events: [
          { type: 'message', replyToken: 't1', source: { userId: 'U1' }, message: { id: '1', type: 'text', text: 'Hello' } },
          { type: 'follow', replyToken: 't2', source: { userId: 'U2' } },
          { type: 'message', replyToken: 't3', source: { userId: 'U3' }, message: { id: '3', type: 'image' } },
        ],
      }),
    });
    expect(res.status).toBe(403);
  });

  it('empty events array', async () => {
    const res = await fetch(BASE + '/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-line-signature': 'fake' },
      body: JSON.stringify({ events: [] }),
    });
    expect(res.status).toBe(403);
  });

  it('unknown event type (beacon)', async () => {
    const res = await fetch(BASE + '/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-line-signature': 'fake' },
      body: JSON.stringify({
        events: [{ type: 'beacon', source: { userId: 'U1234' }, beacon: { hwid: 'd41d8cd98f', type: 'enter' } }],
      }),
    });
    expect(res.status).toBe(403);
  });
});

// ─── Webhook Security Edge Cases ───

describe('Webhook - Security Edge Cases', () => {
  it('large payload is handled', async () => {
    const largeText = 'a'.repeat(10000);
    const res = await fetch(BASE + '/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-line-signature': 'fake' },
      body: JSON.stringify({
        events: [{ type: 'message', source: { userId: 'U1' }, message: { type: 'text', text: largeText } }],
      }),
    });
    expect(res.status).toBe(403);
  });

  it('malformed JSON body returns error', async () => {
    const res = await fetch(BASE + '/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-line-signature': 'fake' },
      body: '{"events": [broken',
    });
    expect([400, 403, 500]).toContain(res.status);
  });

  it('missing events field returns 403 (signature fails first)', async () => {
    const res = await fetch(BASE + '/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-line-signature': 'fake' },
      body: JSON.stringify({ destination: 'test' }),
    });
    expect(res.status).toBe(403);
  });
});

// ─── Webhook Test Endpoint Auth ───

describe('Webhook Test - Auth Required', () => {
  it('POST /api/webhook-test/simulate without auth returns 401', async () => {
    const res = await fetch(BASE + '/api/webhook-test/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'message', line_user_id: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/webhook-test/cleanup without auth returns 401', async () => {
    const res = await fetch(BASE + '/api/webhook-test/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line_user_id: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/webhook-test/simulate with invalid token returns 401', async () => {
    const res = await fetch(BASE + '/api/webhook-test/simulate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid-token-xyz',
      },
      body: JSON.stringify({ event_type: 'message', line_user_id: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/webhook-test/cleanup with invalid token returns 401', async () => {
    const res = await fetch(BASE + '/api/webhook-test/cleanup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid-token-xyz',
      },
      body: JSON.stringify({ line_user_id: 'test' }),
    });
    expect(res.status).toBe(401);
  });
});
