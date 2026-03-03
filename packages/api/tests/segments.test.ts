import { describe, it, expect } from 'vitest';

const BASE = 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';

// ─── Auth Required ───

describe('Segment API - Auth Required', () => {
  it('POST /api/segments/preview without auth → 401', async () => {
    const res = await fetch(BASE + '/api/segments/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conditions: [{ type: 'tag', operator: 'eq', field: '', value: 'vip' }] }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/segments/send without auth → 401', async () => {
    const res = await fetch(BASE + '/api/segments/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conditions: [{ type: 'tag', operator: 'eq', field: '', value: 'vip' }],
        message: { type: 'text', text: 'hello' },
      }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/segments/history without auth → 401', async () => {
    const res = await fetch(BASE + '/api/segments/history');
    expect(res.status).toBe(401);
  });

  it('POST /api/segments/preview with invalid token → 401', async () => {
    const res = await fetch(BASE + '/api/segments/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid-token',
      },
      body: JSON.stringify({ conditions: [{ type: 'tag', operator: 'eq', field: '', value: 'vip' }] }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── V2 Condition Group (auth required, so expect 401) ───

describe('Segment API - V2 Condition Group Format', () => {
  it('POST /api/segments/preview with condition_group without auth → 401', async () => {
    const res = await fetch(BASE + '/api/segments/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        condition_group: {
          logic: 'AND',
          items: [{ type: 'tag', operator: 'eq', field: '', value: 'vip' }],
        },
      }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/segments/preview with nested groups without auth → 401', async () => {
    const res = await fetch(BASE + '/api/segments/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        condition_group: {
          logic: 'OR',
          items: [
            { type: 'tag', operator: 'eq', field: '', value: 'vip' },
            {
              logic: 'AND',
              negate: true,
              items: [
                { type: 'status', operator: 'eq', field: '', value: 'blocked' },
                { type: 'last_message_days', operator: 'gt', field: '', value: '30' },
              ],
            },
          ],
        },
      }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/segments/send with condition_group without auth → 401', async () => {
    const res = await fetch(BASE + '/api/segments/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        condition_group: {
          logic: 'AND',
          items: [
            { type: 'engagement_score', operator: 'gte', field: 'score', value: '80' },
          ],
        },
        message: { type: 'text', text: 'test' },
      }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── New Condition Types (all auth blocked) ───

describe('Segment API - New Condition Types', () => {
  const newConditionTypes = [
    { type: 'engagement_score', operator: 'gt', field: 'score', value: '70' },
    { type: 'engagement_score', operator: 'eq', field: 'rank', value: 'S' },
    { type: 'conversion', operator: 'exists', field: 'goal', value: 'purchase' },
    { type: 'conversion', operator: 'not_exists', field: 'goal', value: 'signup' },
    { type: 'conversion', operator: 'gt', field: 'count', value: '3' },
    { type: 'follow_source', operator: 'eq', field: 'type', value: 'QR' },
    { type: 'follow_source', operator: 'contains', field: 'name', value: 'campaign' },
  ];

  for (const cond of newConditionTypes) {
    it(`preview with ${cond.type}/${cond.field}/${cond.operator} without auth → 401`, async () => {
      const res = await fetch(BASE + '/api/segments/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          condition_group: { logic: 'AND', items: [cond] },
        }),
      });
      expect(res.status).toBe(401);
    });
  }
});

// ─── Complex Nested Conditions ───

describe('Segment API - Complex Nested Conditions', () => {
  it('deeply nested condition group without auth → 401', async () => {
    const res = await fetch(BASE + '/api/segments/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        condition_group: {
          logic: 'AND',
          items: [
            { type: 'status', operator: 'eq', field: '', value: 'active' },
            {
              logic: 'OR',
              items: [
                { type: 'tag', operator: 'eq', field: '', value: 'premium' },
                {
                  logic: 'AND',
                  negate: true,
                  items: [
                    { type: 'engagement_score', operator: 'lt', field: 'score', value: '30' },
                    { type: 'last_message_days', operator: 'gt', field: '', value: '60' },
                  ],
                },
              ],
            },
            { type: 'conversion', operator: 'exists', field: 'goal', value: 'purchase' },
          ],
        },
      }),
    });
    expect(res.status).toBe(401);
  });

  it('OR group with negate without auth → 401', async () => {
    const res = await fetch(BASE + '/api/segments/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        condition_group: {
          logic: 'OR',
          negate: true,
          items: [
            { type: 'follow_source', operator: 'eq', field: 'type', value: 'QR' },
            { type: 'follow_source', operator: 'eq', field: 'type', value: 'URL' },
          ],
        },
      }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── V1 Backward Compatibility ───

describe('Segment API - V1 Backward Compatibility', () => {
  it('V1 flat conditions format without auth → 401', async () => {
    const res = await fetch(BASE + '/api/segments/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conditions: [
          { type: 'tag', operator: 'eq', field: '', value: 'vip' },
          { type: 'status', operator: 'eq', field: '', value: 'active' },
        ],
      }),
    });
    expect(res.status).toBe(401);
  });

  it('V1 single condition without auth → 401', async () => {
    const res = await fetch(BASE + '/api/segments/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conditions: [{ type: 'attribute', operator: 'contains', field: 'city', value: 'Tokyo' }],
      }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── HTTP Methods ───

describe('Segment API - HTTP Methods', () => {
  it('GET /api/segments/preview returns 404', async () => {
    const res = await fetch(BASE + '/api/segments/preview', {
      headers: { Authorization: 'Bearer test' },
    });
    expect([401, 404]).toContain(res.status);
  });

  it('DELETE /api/segments/history returns 404', async () => {
    const res = await fetch(BASE + '/api/segments/history', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test' },
    });
    expect([401, 404]).toContain(res.status);
  });
});
