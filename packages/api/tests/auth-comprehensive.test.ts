import { describe, it, expect } from 'vitest';

const BASE = 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';

// ─── Customers API ───

describe('Customers API - Auth Required', () => {
  it('GET /api/customers without auth → 401', async () => {
    const res = await fetch(BASE + '/api/customers');
    expect(res.status).toBe(401);
  });

  it('GET /api/customers/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/customers/test-id');
    expect(res.status).toBe(401);
  });

  it('PUT /api/customers/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/customers/test-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: 'Test' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/customers/:id/tags without auth → 401', async () => {
    const res = await fetch(BASE + '/api/customers/test-id/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: 'tag-1' }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/customers/:id/tags/:tagId without auth → 401', async () => {
    const res = await fetch(BASE + '/api/customers/test-id/tags/tag-1', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('GET /api/customers/:id/journey without auth → 401', async () => {
    const res = await fetch(BASE + '/api/customers/test-id/journey');
    expect(res.status).toBe(401);
  });

  it('POST /api/customers/:id/attributes without auth → 401', async () => {
    const res = await fetch(BASE + '/api/customers/test-id/attributes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'city', value: 'Tokyo' }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/customers with invalid token → 401', async () => {
    const res = await fetch(BASE + '/api/customers', {
      headers: { Authorization: 'Bearer invalid-token-xyz' },
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/customers with search params without auth → 401', async () => {
    const res = await fetch(BASE + '/api/customers?search=test&page=1&limit=10');
    expect(res.status).toBe(401);
  });
});

// ─── Tags API ───

describe('Tags API - Auth Required', () => {
  it('GET /api/tags without auth → 401', async () => {
    const res = await fetch(BASE + '/api/tags');
    expect(res.status).toBe(401);
  });

  it('POST /api/tags without auth → 401', async () => {
    const res = await fetch(BASE + '/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'VIP', color: '#ff0000' }),
    });
    expect(res.status).toBe(401);
  });

  it('PUT /api/tags/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/tags/test-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/tags/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/tags/test-id', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});

// ─── Scenarios API ───

describe('Scenarios API - Auth Required', () => {
  it('GET /api/scenarios without auth → 401', async () => {
    const res = await fetch(BASE + '/api/scenarios');
    expect(res.status).toBe(401);
  });

  it('GET /api/scenarios/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/scenarios/test-id');
    expect(res.status).toBe(401);
  });

  it('POST /api/scenarios without auth → 401', async () => {
    const res = await fetch(BASE + '/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Scenario', trigger_type: 'follow' }),
    });
    expect(res.status).toBe(401);
  });

  it('PUT /api/scenarios/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/scenarios/test-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/scenarios/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/scenarios/test-id', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('POST /api/scenarios/:id/steps without auth → 401', async () => {
    const res = await fetch(BASE + '/api/scenarios/test-id/steps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step_type: 'message', delay_minutes: 0 }),
    });
    expect(res.status).toBe(401);
  });

  it('PUT /api/scenarios/:id/steps/:stepId without auth → 401', async () => {
    const res = await fetch(BASE + '/api/scenarios/test-id/steps/step-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delay_minutes: 60 }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/scenarios/:id/steps/:stepId without auth → 401', async () => {
    const res = await fetch(BASE + '/api/scenarios/test-id/steps/step-1', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('POST /api/scenarios/:id/execute without auth → 401', async () => {
    const res = await fetch(BASE + '/api/scenarios/test-id/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  it('PUT /api/scenarios/:id/layout without auth → 401', async () => {
    const res = await fetch(BASE + '/api/scenarios/test-id/layout', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout: {} }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── Knowledge API ───

describe('Knowledge API - Auth Required', () => {
  it('GET /api/knowledge without auth → 401', async () => {
    const res = await fetch(BASE + '/api/knowledge');
    expect(res.status).toBe(401);
  });

  it('GET /api/knowledge/categories without auth → 401', async () => {
    const res = await fetch(BASE + '/api/knowledge/categories');
    expect(res.status).toBe(401);
  });

  it('GET /api/knowledge/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/knowledge/test-id');
    expect(res.status).toBe(401);
  });

  it('POST /api/knowledge without auth → 401', async () => {
    const res = await fetch(BASE + '/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'FAQ', content: 'test', category: 'general' }),
    });
    expect(res.status).toBe(401);
  });

  it('PUT /api/knowledge/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/knowledge/test-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/knowledge/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/knowledge/test-id', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});

// ─── RichMenu API ───

describe('RichMenu API - Auth Required', () => {
  it('GET /api/richmenu without auth → 401', async () => {
    const res = await fetch(BASE + '/api/richmenu');
    expect(res.status).toBe(401);
  });

  it('GET /api/richmenu/alias without auth → 401', async () => {
    const res = await fetch(BASE + '/api/richmenu/alias');
    expect(res.status).toBe(401);
  });

  it('GET /api/richmenu/default without auth → 401', async () => {
    const res = await fetch(BASE + '/api/richmenu/default');
    expect(res.status).toBe(401);
  });

  it('POST /api/richmenu without auth → 401', async () => {
    const res = await fetch(BASE + '/api/richmenu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ size: { width: 2500, height: 1686 }, selected: false, name: 'Test', chatBarText: 'Menu', areas: [] }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/richmenu/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/richmenu/test-id', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});

// ─── Surveys API ───

describe('Surveys API - Auth Required', () => {
  it('GET /api/surveys without auth → 401', async () => {
    const res = await fetch(BASE + '/api/surveys');
    expect(res.status).toBe(401);
  });

  it('GET /api/surveys/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/surveys/test-id');
    expect(res.status).toBe(401);
  });

  it('POST /api/surveys without auth → 401', async () => {
    const res = await fetch(BASE + '/api/surveys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Survey', questions: [] }),
    });
    expect(res.status).toBe(401);
  });

  it('PUT /api/surveys/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/surveys/test-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/surveys/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/surveys/test-id', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('GET /api/surveys/:id/results without auth → 401', async () => {
    const res = await fetch(BASE + '/api/surveys/test-id/results');
    expect(res.status).toBe(401);
  });
});

// ─── AI Generate API ───

describe('AI Generate API - Auth Required', () => {
  it('POST /api/ai/generate/message without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ai/generate/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose: 'promotion', target: 'all', industry: 'retail' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/ai/generate/flex without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ai/generate/flex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose: 'product_card', description: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/ai/generate/improve without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ai/generate/improve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original_message: 'hello', improvement_type: 'engagement' }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── Auto Response API ───

describe('Auto Response API - Auth Required', () => {
  it('GET /api/auto-response without auth → 401', async () => {
    const res = await fetch(BASE + '/api/auto-response');
    expect(res.status).toBe(401);
  });

  it('POST /api/auto-response without auth → 401', async () => {
    const res = await fetch(BASE + '/api/auto-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Rule', trigger_type: 'keyword', trigger_value: 'hello' }),
    });
    expect(res.status).toBe(401);
  });

  it('PUT /api/auto-response/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/auto-response/test-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/auto-response/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/auto-response/test-id', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auto-response/test without auth → 401', async () => {
    const res = await fetch(BASE + '/api/auto-response/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello' }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── A/B Tests API ───

describe('A/B Tests API - Auth Required', () => {
  it('GET /api/ab-tests without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ab-tests');
    expect(res.status).toBe(401);
  });

  it('POST /api/ab-tests without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ab-tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test AB', variations: [] }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/ab-tests/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ab-tests/test-id');
    expect(res.status).toBe(401);
  });

  it('PUT /api/ab-tests/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ab-tests/test-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/ab-tests/:id/start without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ab-tests/test-id/start', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('POST /api/ab-tests/:id/complete without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ab-tests/test-id/complete', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/ab-tests/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ab-tests/test-id', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('POST /api/ab-tests/generate without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ab-tests/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original: 'hello', count: 3 }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── Export API ───

describe('Export API - Auth Required', () => {
  it('GET /api/export/customers without auth → 401', async () => {
    const res = await fetch(BASE + '/api/export/customers');
    expect(res.status).toBe(401);
  });

  it('GET /api/export/surveys/:id/responses without auth → 401', async () => {
    const res = await fetch(BASE + '/api/export/surveys/test-id/responses');
    expect(res.status).toBe(401);
  });

  it('GET /api/export/delivery-logs without auth → 401', async () => {
    const res = await fetch(BASE + '/api/export/delivery-logs');
    expect(res.status).toBe(401);
  });

  it('GET /api/export/ai-logs without auth → 401', async () => {
    const res = await fetch(BASE + '/api/export/ai-logs');
    expect(res.status).toBe(401);
  });
});

// ─── Settings API ───

describe('Settings API - Auth Required', () => {
  it('GET /api/settings without auth → 401', async () => {
    const res = await fetch(BASE + '/api/settings');
    expect(res.status).toBe(401);
  });

  it('PUT /api/settings without auth → 401', async () => {
    const res = await fetch(BASE + '/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_auto_reply: true }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── AI Classify API ───

describe('AI Classify API - Auth Required', () => {
  it('GET /api/ai/classify without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ai/classify');
    expect(res.status).toBe(401);
  });

  it('POST /api/ai/classify/user/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ai/classify/user/test-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/ai/classify/batch without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ai/classify/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_ids: ['test-1'] }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/ai/classify/:id/apply without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ai/classify/test-id/apply', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('POST /api/ai/classify/:id/dismiss without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ai/classify/test-id/dismiss', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('GET /api/ai/classify/summary without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ai/classify/summary');
    expect(res.status).toBe(401);
  });
});

// ─── Templates API ───

describe('Templates API - Auth Required', () => {
  it('GET /api/templates without auth → 401', async () => {
    const res = await fetch(BASE + '/api/templates');
    expect(res.status).toBe(401);
  });

  it('GET /api/templates/categories without auth → 401', async () => {
    const res = await fetch(BASE + '/api/templates/categories');
    expect(res.status).toBe(401);
  });

  it('GET /api/templates/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/templates/test-id');
    expect(res.status).toBe(401);
  });

  it('POST /api/templates without auth → 401', async () => {
    const res = await fetch(BASE + '/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Welcome', category: 'greeting', content: 'hello' }),
    });
    expect(res.status).toBe(401);
  });

  it('PUT /api/templates/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/templates/test-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/templates/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/templates/test-id', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('POST /api/templates/:id/use without auth → 401', async () => {
    const res = await fetch(BASE + '/api/templates/test-id/use', { method: 'POST' });
    expect(res.status).toBe(401);
  });
});

// ─── Calendar API ───

describe('Calendar API - Auth Required', () => {
  it('GET /api/calendar without auth → 401', async () => {
    const res = await fetch(BASE + '/api/calendar');
    expect(res.status).toBe(401);
  });

  it('GET /api/calendar?month=2026-03 without auth → 401', async () => {
    const res = await fetch(BASE + '/api/calendar?month=2026-03');
    expect(res.status).toBe(401);
  });
});

// ─── Conversions API ───

describe('Conversions API - Auth Required', () => {
  it('GET /api/conversions/goals without auth → 401', async () => {
    const res = await fetch(BASE + '/api/conversions/goals');
    expect(res.status).toBe(401);
  });

  it('POST /api/conversions/goals without auth → 401', async () => {
    const res = await fetch(BASE + '/api/conversions/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Purchase', type: 'event' }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/conversions/goals/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/conversions/goals/test-id');
    expect(res.status).toBe(401);
  });

  it('PUT /api/conversions/goals/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/conversions/goals/test-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/conversions/goals/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/conversions/goals/test-id', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('POST /api/conversions/track without auth → 401', async () => {
    const res = await fetch(BASE + '/api/conversions/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal_id: 'test', user_id: 'user-1' }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/conversions/funnel without auth → 401', async () => {
    const res = await fetch(BASE + '/api/conversions/funnel');
    expect(res.status).toBe(401);
  });

  it('GET /api/conversions/by-scenario without auth → 401', async () => {
    const res = await fetch(BASE + '/api/conversions/by-scenario');
    expect(res.status).toBe(401);
  });

  it('GET /api/conversions/daily without auth → 401', async () => {
    const res = await fetch(BASE + '/api/conversions/daily');
    expect(res.status).toBe(401);
  });

  it('GET /api/conversions/summary without auth → 401', async () => {
    const res = await fetch(BASE + '/api/conversions/summary');
    expect(res.status).toBe(401);
  });
});

// ─── AI Optimize API ───

describe('AI Optimize API - Auth Required', () => {
  it('GET /api/ai-optimize/timing without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ai-optimize/timing');
    expect(res.status).toBe(401);
  });

  it('GET /api/ai-optimize/message-patterns without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ai-optimize/message-patterns');
    expect(res.status).toBe(401);
  });

  it('POST /api/ai-optimize/recommend without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ai-optimize/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id: 'test' }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── Delivery Errors API ───

describe('Delivery Errors API - Auth Required', () => {
  it('GET /api/delivery-errors without auth → 401', async () => {
    const res = await fetch(BASE + '/api/delivery-errors');
    expect(res.status).toBe(401);
  });

  it('GET /api/delivery-errors/summary without auth → 401', async () => {
    const res = await fetch(BASE + '/api/delivery-errors/summary');
    expect(res.status).toBe(401);
  });

  it('POST /api/delivery-errors/:id/retry without auth → 401', async () => {
    const res = await fetch(BASE + '/api/delivery-errors/test-id/retry', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('POST /api/delivery-errors/retry-all without auth → 401', async () => {
    const res = await fetch(BASE + '/api/delivery-errors/retry-all', { method: 'POST' });
    expect(res.status).toBe(401);
  });
});

// ─── Engagement Scores API ───

describe('Engagement Scores API - Auth Required', () => {
  it('GET /api/engagement-scores without auth → 401', async () => {
    const res = await fetch(BASE + '/api/engagement-scores');
    expect(res.status).toBe(401);
  });

  it('GET /api/engagement-scores/distribution without auth → 401', async () => {
    const res = await fetch(BASE + '/api/engagement-scores/distribution');
    expect(res.status).toBe(401);
  });

  it('GET /api/engagement-scores/user/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/engagement-scores/user/test-id');
    expect(res.status).toBe(401);
  });

  it('POST /api/engagement-scores/calculate without auth → 401', async () => {
    const res = await fetch(BASE + '/api/engagement-scores/calculate', { method: 'POST' });
    expect(res.status).toBe(401);
  });
});

// ─── Delivery Queue API ───

describe('Delivery Queue API - Auth Required', () => {
  it('GET /api/delivery-queue without auth → 401', async () => {
    const res = await fetch(BASE + '/api/delivery-queue');
    expect(res.status).toBe(401);
  });

  it('POST /api/delivery-queue without auth → 401', async () => {
    const res = await fetch(BASE + '/api/delivery-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Queue', message_type: 'text' }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/delivery-queue/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/delivery-queue/test-id');
    expect(res.status).toBe(401);
  });

  it('GET /api/delivery-queue/:id/progress without auth → 401', async () => {
    const res = await fetch(BASE + '/api/delivery-queue/test-id/progress');
    expect(res.status).toBe(401);
  });

  it('POST /api/delivery-queue/:id/start without auth → 401', async () => {
    const res = await fetch(BASE + '/api/delivery-queue/test-id/start', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('POST /api/delivery-queue/:id/pause without auth → 401', async () => {
    const res = await fetch(BASE + '/api/delivery-queue/test-id/pause', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('POST /api/delivery-queue/:id/cancel without auth → 401', async () => {
    const res = await fetch(BASE + '/api/delivery-queue/test-id/cancel', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/delivery-queue/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/delivery-queue/test-id', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});

// ─── Follow Sources API ───

describe('Follow Sources API - Auth Required', () => {
  it('GET /api/follow-sources/sources without auth → 401', async () => {
    const res = await fetch(BASE + '/api/follow-sources/sources');
    expect(res.status).toBe(401);
  });

  it('POST /api/follow-sources/sources without auth → 401', async () => {
    const res = await fetch(BASE + '/api/follow-sources/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'QR Campaign', type: 'QR' }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/follow-sources/sources/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/follow-sources/sources/test-id');
    expect(res.status).toBe(401);
  });

  it('PUT /api/follow-sources/sources/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/follow-sources/sources/test-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/follow-sources/sources/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/follow-sources/sources/test-id', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('GET /api/follow-sources/analytics without auth → 401', async () => {
    const res = await fetch(BASE + '/api/follow-sources/analytics');
    expect(res.status).toBe(401);
  });

  it('GET /api/follow-sources/daily without auth → 401', async () => {
    const res = await fetch(BASE + '/api/follow-sources/daily');
    expect(res.status).toBe(401);
  });
});

// ─── Chat API ───

describe('Chat API - Auth Required', () => {
  it('GET /api/chat/conversations without auth → 401', async () => {
    const res = await fetch(BASE + '/api/chat/conversations');
    expect(res.status).toBe(401);
  });

  it('GET /api/chat/:userId/messages without auth → 401', async () => {
    const res = await fetch(BASE + '/api/chat/test-user/messages');
    expect(res.status).toBe(401);
  });

  it('POST /api/chat/:userId/send without auth → 401', async () => {
    const res = await fetch(BASE + '/api/chat/test-user/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello' }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── Roles API ───

describe('Roles API - Auth Required', () => {
  it('GET /api/roles without auth → 401', async () => {
    const res = await fetch(BASE + '/api/roles');
    expect(res.status).toBe(401);
  });

  it('PUT /api/roles/:userId without auth → 401', async () => {
    const res = await fetch(BASE + '/api/roles/test-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/roles/me without auth → 401', async () => {
    const res = await fetch(BASE + '/api/roles/me');
    expect(res.status).toBe(401);
  });
});

// ─── Media API ───

describe('Media API - Auth Required', () => {
  it('GET /api/media/:messageId without auth → 401', async () => {
    const res = await fetch(BASE + '/api/media/test-id');
    expect(res.status).toBe(401);
  });
});

// ─── Import API ───

describe('Import API - Auth Required', () => {
  it('POST /api/import/preview without auth → 401', async () => {
    const res = await fetch(BASE + '/api/import/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [], type: 'customers' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/import/customers without auth → 401', async () => {
    const res = await fetch(BASE + '/api/import/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [] }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/import/tags without auth → 401', async () => {
    const res = await fetch(BASE + '/api/import/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [] }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/import/knowledge without auth → 401', async () => {
    const res = await fetch(BASE + '/api/import/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [] }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── API Monitor ───

describe('API Monitor - Auth Required', () => {
  it('GET /api/api-monitor/summary without auth → 401', async () => {
    const res = await fetch(BASE + '/api/api-monitor/summary');
    expect(res.status).toBe(401);
  });

  it('GET /api/api-monitor/endpoints without auth → 401', async () => {
    const res = await fetch(BASE + '/api/api-monitor/endpoints');
    expect(res.status).toBe(401);
  });

  it('GET /api/api-monitor/daily without auth → 401', async () => {
    const res = await fetch(BASE + '/api/api-monitor/daily');
    expect(res.status).toBe(401);
  });

  it('GET /api/api-monitor/errors without auth → 401', async () => {
    const res = await fetch(BASE + '/api/api-monitor/errors');
    expect(res.status).toBe(401);
  });

  it('GET /api/api-monitor/slow without auth → 401', async () => {
    const res = await fetch(BASE + '/api/api-monitor/slow');
    expect(res.status).toBe(401);
  });
});

// ─── AI Logs API ───

describe('AI Logs API - Auth Required', () => {
  it('GET /api/ai/logs without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ai/logs');
    expect(res.status).toBe(401);
  });

  it('GET /api/ai/logs/stats without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ai/logs/stats');
    expect(res.status).toBe(401);
  });

  it('GET /api/ai/escalations without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ai/escalations');
    expect(res.status).toBe(401);
  });

  it('PUT /api/ai/escalations/:id without auth → 401', async () => {
    const res = await fetch(BASE + '/api/ai/escalations/test-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── Widgets API ───

describe('Widgets API - Auth Required', () => {
  it('GET /api/widgets without auth → 401', async () => {
    const res = await fetch(BASE + '/api/widgets');
    expect(res.status).toBe(401);
  });

  it('PUT /api/widgets without auth → 401', async () => {
    const res = await fetch(BASE + '/api/widgets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout: [] }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/widgets/reset without auth → 401', async () => {
    const res = await fetch(BASE + '/api/widgets/reset', { method: 'POST' });
    expect(res.status).toBe(401);
  });
});

// ─── Reports API ───

describe('Reports API - Auth Required', () => {
  it('GET /api/reports/export/csv without auth → 401', async () => {
    const res = await fetch(BASE + '/api/reports/export/csv');
    expect(res.status).toBe(401);
  });
});

// ─── Auth Endpoints ───

describe('Auth Endpoints', () => {
  it('GET /auth/me without auth → 401', async () => {
    const res = await fetch(BASE + '/auth/me');
    expect(res.status).toBe(401);
  });

  it('POST /auth/logout without auth → 401', async () => {
    const res = await fetch(BASE + '/auth/logout', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('GET /auth/me with invalid token → 401', async () => {
    const res = await fetch(BASE + '/auth/me', {
      headers: { Authorization: 'Bearer completely-invalid-token' },
    });
    expect(res.status).toBe(401);
  });

  it('GET /auth/line redirects to LINE Login', async () => {
    const res = await fetch(BASE + '/auth/line', { redirect: 'manual' });
    expect(res.status).toBe(302);
    const location = res.headers.get('location');
    expect(location).toContain('access.line.me');
  });
});
