import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const templateRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
templateRoutes.use('*', authMiddleware);

function generateId(): string {
  return crypto.randomUUID();
}

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

// GET / — List templates (with optional category filter)
templateRoutes.get('/', async (c) => {
  try {
    const category = c.req.query('category');
    const search = c.req.query('search');

    let sql = 'SELECT * FROM message_templates';
    const conditions: string[] = [];
    const params: string[] = [];

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (search) {
      conditions.push('(name LIKE ? OR content LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY is_preset DESC, usage_count DESC, created_at DESC';

    const stmt = c.env.DB.prepare(sql);
    const rows = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

    return c.json({ success: true, data: rows.results || [] });
  } catch (err) {
    console.error('List templates error:', err);
    return c.json({ success: false, error: 'テンプレート一覧の取得に失敗しました' }, 500);
  }
});

// GET /categories — List available categories
templateRoutes.get('/categories', async (c) => {
  try {
    const rows = await c.env.DB.prepare(
      'SELECT category, COUNT(*) as count FROM message_templates GROUP BY category ORDER BY count DESC'
    ).all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (err) {
    console.error('List categories error:', err);
    return c.json({ success: false, error: 'カテゴリ一覧の取得に失敗しました' }, 500);
  }
});

// GET /:id — Get single template
templateRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const row = await c.env.DB.prepare('SELECT * FROM message_templates WHERE id = ?').bind(id).first();
    if (!row) {
      return c.json({ success: false, error: 'テンプレートが見つかりません' }, 404);
    }
    return c.json({ success: true, data: row });
  } catch (err) {
    console.error('Get template error:', err);
    return c.json({ success: false, error: 'テンプレートの取得に失敗しました' }, 500);
  }
});

// POST / — Create custom template
templateRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json<{
      name: string;
      category: string;
      message_type?: string;
      content: string;
    }>();

    if (!body.name || !body.category || !body.content) {
      return c.json({ success: false, error: '名前、カテゴリ、内容は必須です' }, 400);
    }

    const id = generateId();
    const messageType = body.message_type === 'flex' ? 'flex' : 'text';

    await c.env.DB.prepare(
      'INSERT INTO message_templates (id, name, category, message_type, content, is_preset) VALUES (?, ?, ?, ?, ?, 0)'
    ).bind(id, body.name, body.category, messageType, body.content).run();

    return c.json({
      success: true,
      data: { id, name: body.name, category: body.category, message_type: messageType, content: body.content, is_preset: 0, usage_count: 0 },
    }, 201);
  } catch (err) {
    console.error('Create template error:', err);
    return c.json({ success: false, error: 'テンプレートの作成に失敗しました' }, 500);
  }
});

// PUT /:id — Update template (custom only)
templateRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const existing = await c.env.DB.prepare('SELECT is_preset FROM message_templates WHERE id = ?').bind(id).first<{ is_preset: number }>();
    if (!existing) {
      return c.json({ success: false, error: 'テンプレートが見つかりません' }, 404);
    }
    if (existing.is_preset) {
      return c.json({ success: false, error: 'プリセットテンプレートは編集できません' }, 403);
    }

    const body = await c.req.json<{
      name?: string;
      category?: string;
      message_type?: string;
      content?: string;
    }>();

    const updates: string[] = [];
    const params: any[] = [];

    if (body.name) { updates.push('name = ?'); params.push(body.name); }
    if (body.category) { updates.push('category = ?'); params.push(body.category); }
    if (body.message_type) { updates.push('message_type = ?'); params.push(body.message_type === 'flex' ? 'flex' : 'text'); }
    if (body.content) { updates.push('content = ?'); params.push(body.content); }

    if (updates.length === 0) {
      return c.json({ success: false, error: '更新する項目がありません' }, 400);
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    await c.env.DB.prepare(
      `UPDATE message_templates SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...params).run();

    return c.json({ success: true, message: 'テンプレートを更新しました' });
  } catch (err) {
    console.error('Update template error:', err);
    return c.json({ success: false, error: 'テンプレートの更新に失敗しました' }, 500);
  }
});

// DELETE /:id — Delete template (custom only)
templateRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const existing = await c.env.DB.prepare('SELECT is_preset FROM message_templates WHERE id = ?').bind(id).first<{ is_preset: number }>();
    if (!existing) {
      return c.json({ success: false, error: 'テンプレートが見つかりません' }, 404);
    }
    if (existing.is_preset) {
      return c.json({ success: false, error: 'プリセットテンプレートは削除できません' }, 403);
    }

    await c.env.DB.prepare('DELETE FROM message_templates WHERE id = ?').bind(id).run();
    return c.json({ success: true, message: 'テンプレートを削除しました' });
  } catch (err) {
    console.error('Delete template error:', err);
    return c.json({ success: false, error: 'テンプレートの削除に失敗しました' }, 500);
  }
});

// POST /:id/use — Increment usage count (called when template is used)
templateRoutes.post('/:id/use', async (c) => {
  const id = c.req.param('id');
  try {
    const result = await c.env.DB.prepare(
      "UPDATE message_templates SET usage_count = usage_count + 1, updated_at = datetime('now') WHERE id = ?"
    ).bind(id).run();

    if (!result.meta.changes) {
      return c.json({ success: false, error: 'テンプレートが見つかりません' }, 404);
    }

    return c.json({ success: true, message: '使用回数を更新しました' });
  } catch (err) {
    console.error('Use template error:', err);
    return c.json({ success: false, error: '使用回数の更新に失敗しました' }, 500);
  }
});

// POST /ai-generate — AIでテンプレート文面を自動生成（業種・目的ベース）
templateRoutes.post('/ai-generate', async (c) => {
  try {
    const body = await c.req.json<{
      industry: string;
      purpose: string;
      tone?: string;
      category?: string;
      count?: number;
    }>();

    if (!body.industry) {
      return c.json({ success: false, error: '業種は必須です' }, 400);
    }
    if (!body.purpose) {
      return c.json({ success: false, error: '目的は必須です' }, 400);
    }

    const count = Math.min(Math.max(body.count || 3, 1), 5);
    const tone = body.tone || 'casual';
    const category = body.category || '汎用';

    const toneLabel: Record<string, string> = {
      casual: 'カジュアル（親しみやすい）',
      formal: 'フォーマル（丁寧・ビジネス）',
      friendly: 'フレンドリー（温かみのある）',
      urgent: '緊急性のある（限定感・FOMO）',
    };

    const systemPrompt = `あなたはLINE公式アカウントのマーケティング専門コピーライターです。
業種と目的に最適化されたLINEメッセージテンプレートを生成してください。

ルール:
- 各テンプレートは200文字以内
- ${toneLabel[tone] || tone}トーンで書く
- CTA（行動喚起）を含める
- 変数プレースホルダーを活用する（例: {customer_name}, {shop_name}, {coupon_code}, {date}）
- ${count}個のバリエーションを生成
- 業種「${body.industry}」に特有の用語やシチュエーションを活用
- 実践的ですぐに使える内容にする

必ず以下のJSON配列で返してください。他のテキストは含めないでください。
[
  {
    "name": "テンプレート名（簡潔に）",
    "content": "メッセージ本文（変数プレースホルダー含む）"
  }
]`;

    const userMessage = `業種: ${body.industry}\n目的: ${body.purpose}\nカテゴリ: ${category}`;

    const result = await callClaude(c.env, systemPrompt, userMessage);
    try {
      const templates = parseJsonSafe(result) as Array<{ name: string; content: string }>;
      return c.json({ success: true, data: { templates, category } });
    } catch {
      return c.json({ success: false, error: 'AI応答の解析に失敗しました' }, 500);
    }
  } catch (err) {
    console.error('AI template generation error:', err);
    return c.json({ success: false, error: 'テンプレート生成に失敗しました' }, 500);
  }
});

// POST /:id/ab-variations — 既存テンプレートからABテストバリエーションを自動提案
templateRoutes.post('/:id/ab-variations', async (c) => {
  const id = c.req.param('id');
  try {
    const template = await c.env.DB.prepare('SELECT * FROM message_templates WHERE id = ?').bind(id).first<{
      name: string;
      category: string;
      content: string;
    }>();

    if (!template) {
      return c.json({ success: false, error: 'テンプレートが見つかりません' }, 404);
    }

    const body = await c.req.json<{
      count?: number;
      focus?: string;
    }>().catch(() => ({ count: 3, focus: '' }));

    const count = Math.min(Math.max(body.count || 3, 2), 5);
    const focus = body.focus || '訴求軸・CTA・表現方法を変えて比較';

    const systemPrompt = `あなたはLINE A/Bテスト専門のマーケティングコンサルタントです。
既存のメッセージテンプレートを元に、A/Bテスト用のバリエーションを提案してください。

ルール:
- 元のメッセージの核となるメッセージ性は維持する
- 各バリエーションは明確に差別化する（訴求軸・表現・CTA・構成）
- 各メッセージは200文字以内
- ${count}個のバリエーションを生成（元のメッセージも含む）
- A/Bテストとして有意な比較ができるよう設計
- 各バリエーションに「何を変えたか」の説明を付ける
- 改善フォーカス: ${focus}

必ず以下のJSON配列で返してください。他のテキストは含めないでください。
[
  {
    "name": "バリエーション名（A, B, C...）",
    "content": "メッセージ本文",
    "change_description": "元のメッセージから何を変えたかの説明"
  }
]`;

    const userMessage = `テンプレート名: ${template.name}\nカテゴリ: ${template.category}\n元のメッセージ:\n${template.content}`;

    const result = await callClaude(c.env, systemPrompt, userMessage);
    try {
      const variations = parseJsonSafe(result) as Array<{
        name: string;
        content: string;
        change_description: string;
      }>;
      return c.json({
        success: true,
        data: {
          original: { name: template.name, content: template.content },
          variations,
        },
      });
    } catch {
      return c.json({ success: false, error: 'AI応答の解析に失敗しました' }, 500);
    }
  } catch (err) {
    console.error('AB variation generation error:', err);
    return c.json({ success: false, error: 'バリエーション生成に失敗しました' }, 500);
  }
});
