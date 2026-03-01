import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const abTestRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
abTestRoutes.use('*', authMiddleware);

async function callClaude(env: Env, systemPrompt: string, userMessage: string, maxTokens = 2000): Promise<string> {
  const isFoundry = !!env.ANTHROPIC_RESOURCE;
  const apiUrl = isFoundry
    ? `https://${env.ANTHROPIC_RESOURCE}.services.ai.azure.com/anthropic/v1/messages`
    : 'https://api.anthropic.com/v1/messages';
  const authHeader = isFoundry
    ? { 'Authorization': `Bearer ${env.ANTHROPIC_API_KEY}` }
    : { 'x-api-key': env.ANTHROPIC_API_KEY };
  const modelName = isFoundry ? 'claude-opus-4-6' : 'claude-haiku-4-5-20251001';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} ${err}`);
  }
  const data = (await response.json()) as any;
  return data.content?.[0]?.text || '';
}

function parseJsonSafe(text: string): any {
  let cleaned = text.trim();
  const m = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) cleaned = m[1].trim();
  return JSON.parse(cleaned);
}

// GET / — A/Bテスト一覧（バリエーション数付き、ページネーション）
abTestRoutes.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    const countResult = await c.env.DB.prepare('SELECT COUNT(*) as total FROM ab_tests').first<{ total: number }>();
    const total = countResult?.total || 0;

    const rows = await c.env.DB.prepare(
      'SELECT t.*, COUNT(v.id) as variation_count FROM ab_tests t LEFT JOIN ab_test_variations v ON t.id = v.ab_test_id GROUP BY t.id ORDER BY t.created_at DESC LIMIT ? OFFSET ?'
    ).bind(limit, offset).all();

    return c.json({
      success: true,
      data: rows.results || [],
      pagination: { page, limit, total },
    });
  } catch (err) {
    console.error('List AB tests error:', err);
    return c.json({ success: false, error: 'A/Bテスト一覧の取得に失敗しました' }, 500);
  }
});

// POST / — A/Bテスト作成（バリエーション一括）
abTestRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json<{
      name: string;
      description?: string;
      scenario_id?: string;
      variations: Array<{
        name: string;
        message_type?: string;
        message_content: string;
        distribution_rate: number;
      }>;
    }>();

    if (!body.name) {
      return c.json({ success: false, error: 'name is required' }, 400);
    }
    if (!body.variations || body.variations.length < 2) {
      return c.json({ success: false, error: 'At least 2 variations are required' }, 400);
    }

    const totalRate = body.variations.reduce((sum, v) => sum + v.distribution_rate, 0);
    if (totalRate !== 100) {
      return c.json({ success: false, error: 'distribution_rates must sum to 100' }, 400);
    }

    const testId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO ab_tests (id, name, description, scenario_id) VALUES (?, ?, ?, ?)'
    ).bind(testId, body.name, body.description || null, body.scenario_id || null).run();

    for (const v of body.variations) {
      const vId = crypto.randomUUID();
      await c.env.DB.prepare(
        'INSERT INTO ab_test_variations (id, ab_test_id, name, message_type, message_content, distribution_rate) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(vId, testId, v.name, v.message_type || 'text', v.message_content, v.distribution_rate).run();
    }

    const test = await c.env.DB.prepare('SELECT * FROM ab_tests WHERE id = ?').bind(testId).first();
    const variations = await c.env.DB.prepare('SELECT * FROM ab_test_variations WHERE ab_test_id = ?').bind(testId).all();

    return c.json({ success: true, data: { test, variations: variations.results || [] } }, 201);
  } catch (err) {
    console.error('Create AB test error:', err);
    return c.json({ success: false, error: 'A/Bテストの作成に失敗しました' }, 500);
  }
});

// GET /:id — A/Bテスト詳細（バリエーション＋統計情報付き）
abTestRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const test = await c.env.DB.prepare('SELECT * FROM ab_tests WHERE id = ?').bind(id).first();
    if (!test) return c.json({ success: false, error: 'Not found' }, 404);

    const variations = await c.env.DB.prepare('SELECT * FROM ab_test_variations WHERE ab_test_id = ?').bind(id).all();

    const variationsWithRates = (variations.results || []).map((v: any) => ({
      ...v,
      open_rate: v.sent_count > 0 ? Math.round((v.open_count / v.sent_count) * 10000) / 100 : 0,
      click_rate: v.sent_count > 0 ? Math.round((v.click_count / v.sent_count) * 10000) / 100 : 0,
      conversion_rate: v.sent_count > 0 ? Math.round((v.conversion_count / v.sent_count) * 10000) / 100 : 0,
    }));

    return c.json({ success: true, data: { ...test, variations: variationsWithRates } });
  } catch (err) {
    console.error('Get AB test error:', err);
    return c.json({ success: false, error: 'A/Bテストの取得に失敗しました' }, 500);
  }
});

// PUT /:id — A/Bテスト更新（draftステータスのみ）
abTestRoutes.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const test = await c.env.DB.prepare('SELECT * FROM ab_tests WHERE id = ?').bind(id).first<{ status: string }>();
    if (!test) return c.json({ success: false, error: 'Not found' }, 404);
    if (test.status !== 'draft') {
      return c.json({ success: false, error: 'Can only update tests in draft status' }, 400);
    }

    const body = await c.req.json<{ name?: string; description?: string; scenario_id?: string }>();
    const sets: string[] = [];
    const vals: any[] = [];

    if (body.name) { sets.push('name = ?'); vals.push(body.name); }
    if (body.description !== undefined) { sets.push('description = ?'); vals.push(body.description); }
    if (body.scenario_id !== undefined) { sets.push('scenario_id = ?'); vals.push(body.scenario_id); }
    if (!sets.length) return c.json({ success: false, error: 'No fields to update' }, 400);

    sets.push("updated_at = datetime('now')");
    await c.env.DB.prepare('UPDATE ab_tests SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals, id).run();

    const updated = await c.env.DB.prepare('SELECT * FROM ab_tests WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update AB test error:', err);
    return c.json({ success: false, error: 'A/Bテストの更新に失敗しました' }, 500);
  }
});

// POST /:id/start — A/Bテスト開始
abTestRoutes.post('/:id/start', async (c) => {
  try {
    const id = c.req.param('id');
    const test = await c.env.DB.prepare('SELECT * FROM ab_tests WHERE id = ?').bind(id).first<{ status: string }>();
    if (!test) return c.json({ success: false, error: 'Not found' }, 404);
    if (test.status !== 'draft') {
      return c.json({ success: false, error: 'Can only start tests in draft status' }, 400);
    }

    await c.env.DB.prepare(
      "UPDATE ab_tests SET status = 'running', started_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
    ).bind(id).run();

    const updated = await c.env.DB.prepare('SELECT * FROM ab_tests WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: updated });
  } catch (err) {
    console.error('Start AB test error:', err);
    return c.json({ success: false, error: 'A/Bテストの開始に失敗しました' }, 500);
  }
});

// POST /:id/complete — A/Bテスト完了（勝者自動判定）
abTestRoutes.post('/:id/complete', async (c) => {
  try {
    const id = c.req.param('id');
    const test = await c.env.DB.prepare('SELECT * FROM ab_tests WHERE id = ?').bind(id).first<{ status: string }>();
    if (!test) return c.json({ success: false, error: 'Not found' }, 404);
    if (test.status !== 'running') {
      return c.json({ success: false, error: 'Can only complete tests in running status' }, 400);
    }

    const variations = await c.env.DB.prepare('SELECT * FROM ab_test_variations WHERE ab_test_id = ?').bind(id).all();
    const varList = (variations.results || []) as any[];

    // 勝者判定: conversion_rate → click_rate → open_rate の優先順
    let winnerId: string | null = null;
    let bestScore = -1;

    for (const v of varList) {
      const sent = v.sent_count || 0;
      if (sent === 0) continue;

      const conversionRate = v.conversion_count / sent;
      const clickRate = v.click_count / sent;
      const openRate = v.open_count / sent;

      // 複合スコア: conversion_rate を最優先、次に click_rate、最後に open_rate
      const score = conversionRate * 1000000 + clickRate * 1000 + openRate;
      if (score > bestScore) {
        bestScore = score;
        winnerId = v.id;
      }
    }

    await c.env.DB.prepare(
      "UPDATE ab_tests SET status = 'completed', completed_at = datetime('now'), winner_variation_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(winnerId, id).run();

    const updated = await c.env.DB.prepare('SELECT * FROM ab_tests WHERE id = ?').bind(id).first();
    const updatedVariations = await c.env.DB.prepare('SELECT * FROM ab_test_variations WHERE ab_test_id = ?').bind(id).all();

    const variationsWithRates = (updatedVariations.results || []).map((v: any) => ({
      ...v,
      open_rate: v.sent_count > 0 ? Math.round((v.open_count / v.sent_count) * 10000) / 100 : 0,
      click_rate: v.sent_count > 0 ? Math.round((v.click_count / v.sent_count) * 10000) / 100 : 0,
      conversion_rate: v.sent_count > 0 ? Math.round((v.conversion_count / v.sent_count) * 10000) / 100 : 0,
    }));

    return c.json({ success: true, data: { ...updated, variations: variationsWithRates } });
  } catch (err) {
    console.error('Complete AB test error:', err);
    return c.json({ success: false, error: 'A/Bテストの完了処理に失敗しました' }, 500);
  }
});

// DELETE /:id — A/Bテスト削除（draft/cancelledのみ）
abTestRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const test = await c.env.DB.prepare('SELECT * FROM ab_tests WHERE id = ?').bind(id).first<{ status: string }>();
    if (!test) return c.json({ success: false, error: 'Not found' }, 404);
    if (test.status !== 'draft' && test.status !== 'cancelled') {
      return c.json({ success: false, error: 'Can only delete tests in draft or cancelled status' }, 400);
    }

    await c.env.DB.prepare('DELETE FROM ab_tests WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('Delete AB test error:', err);
    return c.json({ success: false, error: 'A/Bテストの削除に失敗しました' }, 500);
  }
});

// PUT /:id/variations/:variationId — バリエーション指標更新（runningのみ）
abTestRoutes.put('/:id/variations/:variationId', async (c) => {
  try {
    const id = c.req.param('id');
    const variationId = c.req.param('variationId');

    const test = await c.env.DB.prepare('SELECT * FROM ab_tests WHERE id = ?').bind(id).first<{ status: string }>();
    if (!test) return c.json({ success: false, error: 'Test not found' }, 404);
    if (test.status !== 'running') {
      return c.json({ success: false, error: 'Can only update variations when test is running' }, 400);
    }

    const variation = await c.env.DB.prepare('SELECT * FROM ab_test_variations WHERE id = ? AND ab_test_id = ?').bind(variationId, id).first();
    if (!variation) return c.json({ success: false, error: 'Variation not found' }, 404);

    const body = await c.req.json<{
      sent_count?: number;
      open_count?: number;
      click_count?: number;
      conversion_count?: number;
    }>();

    const sets: string[] = [];
    const vals: any[] = [];

    if (body.sent_count !== undefined) { sets.push('sent_count = ?'); vals.push(body.sent_count); }
    if (body.open_count !== undefined) { sets.push('open_count = ?'); vals.push(body.open_count); }
    if (body.click_count !== undefined) { sets.push('click_count = ?'); vals.push(body.click_count); }
    if (body.conversion_count !== undefined) { sets.push('conversion_count = ?'); vals.push(body.conversion_count); }
    if (!sets.length) return c.json({ success: false, error: 'No fields to update' }, 400);

    await c.env.DB.prepare('UPDATE ab_test_variations SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals, variationId).run();

    const updated = await c.env.DB.prepare('SELECT * FROM ab_test_variations WHERE id = ?').bind(variationId).first();
    return c.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update variation error:', err);
    return c.json({ success: false, error: 'バリエーションの更新に失敗しました' }, 500);
  }
});

// POST /generate — AIによるA/Bテストバリエーション生成
abTestRoutes.post('/generate', async (c) => {
  try {
    const body = await c.req.json<{
      purpose: string;
      target_audience: string;
      tone?: string;
      count?: number;
    }>();

    if (!body.purpose) {
      return c.json({ success: false, error: '配信の目的は必須です' }, 400);
    }
    if (!body.target_audience) {
      return c.json({ success: false, error: 'ターゲット層は必須です' }, 400);
    }

    const count = Math.min(Math.max(body.count || 3, 2), 5);
    const tone = body.tone || 'casual';

    const systemPrompt = `あなたはLINE公式アカウントのA/Bテスト専門マーケターです。
A/Bテストで比較するためのメッセージバリエーションを日本語で生成してください。

ルール:
- 各メッセージは200文字以内
- ${tone}なトーンで書く
- CTA（行動喚起）を含める
- ${count}個のバリエーションを生成する
- 各バリエーションは異なるアプローチ（訴求軸・表現方法・CTA）を使うこと
- A/Bテストとして有意な比較ができるよう、明確に差別化すること

必ずJSON配列で文字列のみを返してください。他のテキストは含めないでください。
例: ["メッセージA", "メッセージB", "メッセージC"]`;

    const userMessage = `目的: ${body.purpose}\nターゲット: ${body.target_audience}`;

    const result = await callClaude(c.env, systemPrompt, userMessage);
    try {
      const variations: string[] = parseJsonSafe(result);
      return c.json({ success: true, data: { variations } });
    } catch {
      return c.json({ success: true, data: { variations: [result.trim()] } });
    }
  } catch (err) {
    console.error('AB variation generation error:', err);
    return c.json({ success: false, error: 'バリエーション生成に失敗しました' }, 500);
  }
});
