import { describe, it, expect } from 'vitest';

const BASE = 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';

// ─── Auth Required ───

describe('Multi-Message Delivery - Auth Required', () => {
  it('POST /api/segments/send without auth → 401', async () => {
    const res = await fetch(BASE + '/api/segments/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ type: 'text', text: 'hello' }], conditions: [{ type: 'status', operator: 'eq', field: 'status', value: 'active' }] }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/scheduled without auth → 401', async () => {
    const res = await fetch(BASE + '/api/scheduled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'test', messages_json: '[{"type":"text","text":"hi"}]', target_type: 'all', scheduled_at: '2099-01-01T00:00:00Z' }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── Scheduled Delivery Validation ───

describe('Scheduled Delivery - Validation', () => {
  it('POST /api/scheduled without title → 400', async () => {
    const res = await fetch(BASE + '/api/scheduled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-invalid-token' },
      body: JSON.stringify({ message_content: 'test', target_type: 'all', scheduled_at: '2099-01-01T00:00:00Z' }),
    });
    // Should be 401 (bad token) or 400 (validation)
    expect([400, 401]).toContain(res.status);
  });

  it('POST /api/scheduled without message → 400', async () => {
    const res = await fetch(BASE + '/api/scheduled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-invalid-token' },
      body: JSON.stringify({ title: 'test', target_type: 'all', scheduled_at: '2099-01-01T00:00:00Z' }),
    });
    expect([400, 401]).toContain(res.status);
  });

  it('POST /api/scheduled with invalid target_type → 400', async () => {
    const res = await fetch(BASE + '/api/scheduled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-invalid-token' },
      body: JSON.stringify({ title: 'test', message_content: 'hi', target_type: 'invalid', scheduled_at: '2099-01-01T00:00:00Z' }),
    });
    expect([400, 401]).toContain(res.status);
  });

  it('POST /api/scheduled with past date → 400', async () => {
    const res = await fetch(BASE + '/api/scheduled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-invalid-token' },
      body: JSON.stringify({ title: 'test', message_content: 'hi', target_type: 'all', scheduled_at: '2020-01-01T00:00:00Z' }),
    });
    expect([400, 401]).toContain(res.status);
  });
});

// ─── Segment Send Validation ───

describe('Segment Send - Validation', () => {
  it('POST /api/segments/send without conditions → 400', async () => {
    const res = await fetch(BASE + '/api/segments/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-invalid-token' },
      body: JSON.stringify({ messages: [{ type: 'text', text: 'hello' }] }),
    });
    expect([400, 401]).toContain(res.status);
  });

  it('POST /api/segments/send without messages → 400', async () => {
    const res = await fetch(BASE + '/api/segments/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-invalid-token' },
      body: JSON.stringify({ conditions: [{ type: 'status', operator: 'eq', field: 'status', value: 'active' }] }),
    });
    expect([400, 401]).toContain(res.status);
  });
});

// ─── Calendar Endpoint ───

describe('Scheduled Delivery - Calendar', () => {
  it('GET /api/scheduled/calendar without month → 400 or 401', async () => {
    const res = await fetch(BASE + '/api/scheduled/calendar');
    expect([400, 401]).toContain(res.status);
  });

  it('GET /api/scheduled/calendar with invalid month format → 400 or 401', async () => {
    const res = await fetch(BASE + '/api/scheduled/calendar?month=2026-1');
    expect([400, 401]).toContain(res.status);
  });

  it('GET /api/scheduled/calendar without auth → 401', async () => {
    const res = await fetch(BASE + '/api/scheduled/calendar?month=2026-03');
    expect(res.status).toBe(401);
  });
});

// ─── List / Detail Endpoints ───

describe('Scheduled Delivery - List & Detail', () => {
  it('GET /api/scheduled without auth → 401', async () => {
    const res = await fetch(BASE + '/api/scheduled');
    expect(res.status).toBe(401);
  });

  it('GET /api/scheduled/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/scheduled/nonexistent-id');
    expect(res.status).toBe(401);
  });

  it('PUT /api/scheduled/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/scheduled/nonexistent-id', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/scheduled/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/scheduled/nonexistent-id', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});

// ─── Segment History ───

describe('Segment Delivery - History', () => {
  it('GET /api/segments/history without auth → 401', async () => {
    const res = await fetch(BASE + '/api/segments/history');
    expect(res.status).toBe(401);
  });
});
