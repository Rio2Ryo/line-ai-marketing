import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const autoResponseRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
autoResponseRoutes.use('*', authMiddleware);

// GET / — ルール一覧（priority DESC）
autoResponseRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT * FROM auto_response_rules ORDER BY priority DESC, created_at DESC'
  ).all();
  return c.json({ success: true, data: rows.results || [] });
});

// POST / — ルール作成
autoResponseRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    name: string;
    trigger_type: string;
    trigger_pattern: string;
    response_type?: string;
    response_content: string;
    priority?: number;
  }>();

  if (!body.name || !body.trigger_type || !body.trigger_pattern || !body.response_content) {
    return c.json({ success: false, error: 'name, trigger_type, trigger_pattern, response_content are required' }, 400);
  }

  if (!['keyword', 'exact_match', 'regex'].includes(body.trigger_type)) {
    return c.json({ success: false, error: 'trigger_type must be keyword, exact_match, or regex' }, 400);
  }

  if (body.response_type && !['text', 'survey', 'richmenu'].includes(body.response_type)) {
    return c.json({ success: false, error: 'response_type must be text, survey, or richmenu' }, 400);
  }

  // regex パターンの検証
  if (body.trigger_type === 'regex') {
    try {
      new RegExp(body.trigger_pattern);
    } catch {
      return c.json({ success: false, error: 'Invalid regex pattern' }, 400);
    }
  }

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO auto_response_rules (id, name, trigger_type, trigger_pattern, response_type, response_content, priority) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id,
    body.name,
    body.trigger_type,
    body.trigger_pattern,
    body.response_type || 'text',
    body.response_content,
    body.priority ?? 0
  ).run();

  const created = await c.env.DB.prepare('SELECT * FROM auto_response_rules WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: created }, 201);
});

// PUT /:id — ルール更新
autoResponseRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{
    name?: string;
    trigger_type?: string;
    trigger_pattern?: string;
    response_type?: string;
    response_content?: string;
    priority?: number;
    is_active?: number;
  }>();

  const sets: string[] = [];
  const vals: any[] = [];

  if (body.name) { sets.push('name = ?'); vals.push(body.name); }
  if (body.trigger_type) {
    if (!['keyword', 'exact_match', 'regex'].includes(body.trigger_type)) {
      return c.json({ success: false, error: 'trigger_type must be keyword, exact_match, or regex' }, 400);
    }
    sets.push('trigger_type = ?'); vals.push(body.trigger_type);
  }
  if (body.trigger_pattern !== undefined) {
    // regex の場合パターン検証
    const effectiveType = body.trigger_type || (await c.env.DB.prepare('SELECT trigger_type FROM auto_response_rules WHERE id = ?').bind(id).first<{ trigger_type: string }>())?.trigger_type;
    if (effectiveType === 'regex') {
      try {
        new RegExp(body.trigger_pattern);
      } catch {
        return c.json({ success: false, error: 'Invalid regex pattern' }, 400);
      }
    }
    sets.push('trigger_pattern = ?'); vals.push(body.trigger_pattern);
  }
  if (body.response_type) {
    if (!['text', 'survey', 'richmenu'].includes(body.response_type)) {
      return c.json({ success: false, error: 'response_type must be text, survey, or richmenu' }, 400);
    }
    sets.push('response_type = ?'); vals.push(body.response_type);
  }
  if (body.response_content !== undefined) { sets.push('response_content = ?'); vals.push(body.response_content); }
  if (body.priority !== undefined) { sets.push('priority = ?'); vals.push(body.priority); }
  if (body.is_active !== undefined) { sets.push('is_active = ?'); vals.push(body.is_active); }

  if (!sets.length) return c.json({ success: false, error: 'No fields to update' }, 400);

  sets.push("updated_at = datetime('now')");
  await c.env.DB.prepare('UPDATE auto_response_rules SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals, id).run();

  const updated = await c.env.DB.prepare('SELECT * FROM auto_response_rules WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: updated });
});

// DELETE /:id — ルール削除
autoResponseRoutes.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM auto_response_rules WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
});

// POST /test — メッセージテスト（アクティブルールとのマッチング）
autoResponseRoutes.post('/test', async (c) => {
  const body = await c.req.json<{ message: string }>();

  if (!body.message) {
    return c.json({ success: false, error: 'message is required' }, 400);
  }

  const rows = await c.env.DB.prepare(
    'SELECT * FROM auto_response_rules WHERE is_active = 1 ORDER BY priority DESC'
  ).all();

  const rules = (rows.results || []) as any[];
  const matches: Array<{ rule_id: string; name: string; response_type: string; response_content: string }> = [];

  for (const rule of rules) {
    let matched = false;

    switch (rule.trigger_type) {
      case 'keyword':
        matched = body.message.includes(rule.trigger_pattern);
        break;
      case 'exact_match':
        matched = body.message === rule.trigger_pattern;
        break;
      case 'regex':
        try {
          const re = new RegExp(rule.trigger_pattern);
          matched = re.test(body.message);
        } catch {
          // 無効な正規表現はスキップ
        }
        break;
    }

    if (matched) {
      matches.push({
        rule_id: rule.id,
        name: rule.name,
        response_type: rule.response_type,
        response_content: rule.response_content,
      });
    }
  }

  return c.json({ success: true, data: { matches } });
});
