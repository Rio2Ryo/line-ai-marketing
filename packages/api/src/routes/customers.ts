import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { evaluateTriggers, executeScenario } from '../lib/scenario-engine';

type AuthVars = { userId: string };
export const customerRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
customerRoutes.use('*', authMiddleware);

// GET / — 顧客一覧(page,limit,search,status,tag_id)
customerRoutes.get('/', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const search = c.req.query('search') || '';
  const status = c.req.query('status') || '';
  const tagId = c.req.query('tag_id') || '';
  const offset = (page - 1) * limit;

  let baseFrom = 'FROM users u';
  const conditions: string[] = [];
  const binds: any[] = [];

  if (tagId) {
    baseFrom += ' JOIN user_tags ut ON u.id = ut.user_id';
    conditions.push('ut.tag_id = ?');
    binds.push(tagId);
  }
  if (search) { conditions.push("u.display_name LIKE ?"); binds.push('%' + search + '%'); }
  if (status) { conditions.push('u.status = ?'); binds.push(status); }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const countResult = await c.env.DB.prepare('SELECT COUNT(DISTINCT u.id) as total ' + baseFrom + where).bind(...binds).first<{ total: number }>();
  const total = countResult?.total || 0;
  const users = await c.env.DB.prepare('SELECT DISTINCT u.* ' + baseFrom + where + ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?').bind(...binds, limit, offset).all();

  const data = await Promise.all((users.results || []).map(async (u: any) => {
    const tags = await c.env.DB.prepare('SELECT t.* FROM tags t JOIN user_tags ut ON t.id = ut.tag_id WHERE ut.user_id = ?').bind(u.id).all();
    return { ...u, tags: tags.results || [] };
  }));

  return c.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

// GET /:id — 顧客詳細
customerRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!user) return c.json({ success: false, error: 'Not found' }, 404);
  const tags = await c.env.DB.prepare('SELECT t.* FROM tags t JOIN user_tags ut ON t.id = ut.tag_id WHERE ut.user_id = ?').bind(id).all();
  const messages = await c.env.DB.prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY sent_at DESC LIMIT 50').bind(id).all();
  const attributes = await c.env.DB.prepare('SELECT * FROM user_attributes WHERE user_id = ?').bind(id).all();
  return c.json({ success: true, data: { ...user, tags: tags.results || [], recent_messages: messages.results || [], attributes: attributes.results || [] } });
});

// PUT /:id
customerRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ display_name?: string; status?: string }>();
  const sets: string[] = []; const vals: any[] = [];
  if (body.display_name !== undefined) { sets.push('display_name = ?'); vals.push(body.display_name); }
  if (body.status !== undefined) { sets.push('status = ?'); vals.push(body.status); }
  if (!sets.length) return c.json({ success: false, error: 'No fields' }, 400);
  sets.push("updated_at = datetime('now')");
  await c.env.DB.prepare('UPDATE users SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals, id).run();
  const updated = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: updated });
});

// POST /:id/tags
customerRoutes.post('/:id/tags', async (c) => {
  const userId = c.req.param('id');
  const { tag_id } = await c.req.json<{ tag_id: string }>();
  try {
    await c.env.DB.prepare('INSERT INTO user_tags (user_id, tag_id) VALUES (?, ?)').bind(userId, tag_id).run();
  } catch {}

  // Evaluate tag_added scenario triggers
  try {
    const sids = await evaluateTriggers(c.env, 'tag_added', { tag_id });
    for (const sid of sids) {
      await executeScenario(c.env, sid, userId);
    }
  } catch (e) { console.error('tag_added trigger error:', e); }

  return c.json({ success: true });
});

// DELETE /:id/tags/:tagId
customerRoutes.delete('/:id/tags/:tagId', async (c) => {
  await c.env.DB.prepare('DELETE FROM user_tags WHERE user_id = ? AND tag_id = ?').bind(c.req.param('id'), c.req.param('tagId')).run();
  return c.json({ success: true });
});

// GET /:id/journey — ユーザージャーニータイムライン
customerRoutes.get('/:id/journey', async (c) => {
  const id = c.req.param('id');
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 200);

  const user = await c.env.DB.prepare('SELECT id, display_name, created_at FROM users WHERE id = ?').bind(id).first<{ id: string; display_name: string | null; created_at: string }>();
  if (!user) return c.json({ success: false, error: 'Not found' }, 404);

  // Collect events from multiple tables in parallel
  const [msgs, deliveries, tagAssigns, aiChats, surveyResp, classifications] = await Promise.all([
    // Messages
    c.env.DB.prepare(
      `SELECT id, direction, message_type, content, sent_at as event_at FROM messages WHERE user_id = ? ORDER BY sent_at DESC LIMIT ?`
    ).bind(id, limit).all(),
    // Delivery logs
    c.env.DB.prepare(
      `SELECT dl.id, dl.status, dl.sent_at, dl.created_at as event_at, dl.error_message, COALESCE(s.name, '手動配信') as scenario_name
       FROM delivery_logs dl LEFT JOIN scenarios s ON dl.scenario_id = s.id
       WHERE dl.user_id = ? ORDER BY dl.created_at DESC LIMIT ?`
    ).bind(id, limit).all(),
    // Tag assignments
    c.env.DB.prepare(
      `SELECT ut.assigned_at as event_at, t.name as tag_name, t.color as tag_color
       FROM user_tags ut JOIN tags t ON ut.tag_id = t.id WHERE ut.user_id = ? ORDER BY ut.assigned_at DESC LIMIT ?`
    ).bind(id, limit).all(),
    // AI chat logs
    c.env.DB.prepare(
      `SELECT id, user_message, ai_reply, confidence, should_escalate, created_at as event_at
       FROM ai_chat_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
    ).bind(id, limit).all(),
    // Survey responses
    c.env.DB.prepare(
      `SELECT sr.id, sr.submitted_at as event_at, s.title as survey_title
       FROM survey_responses sr JOIN surveys s ON sr.survey_id = s.id WHERE sr.user_id = ? ORDER BY sr.submitted_at DESC LIMIT ?`
    ).bind(id, limit).all(),
    // AI classifications
    c.env.DB.prepare(
      `SELECT id, suggested_tags, segment, reasoning, status, created_at as event_at
       FROM ai_classifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
    ).bind(id, limit).all(),
  ]);

  // Build unified timeline
  type Event = { type: string; event_at: string; data: Record<string, any> };
  const events: Event[] = [];

  // Follow event
  events.push({ type: 'follow', event_at: user.created_at, data: { display_name: user.display_name } });

  for (const m of (msgs.results || []) as any[]) {
    events.push({ type: m.direction === 'inbound' ? 'message_in' : 'message_out', event_at: m.event_at, data: { content: m.content, message_type: m.message_type } });
  }
  for (const d of (deliveries.results || []) as any[]) {
    events.push({ type: 'delivery', event_at: d.event_at, data: { status: d.status, scenario_name: d.scenario_name, error_message: d.error_message, sent_at: d.sent_at } });
  }
  for (const t of (tagAssigns.results || []) as any[]) {
    events.push({ type: 'tag_assigned', event_at: t.event_at, data: { tag_name: t.tag_name, tag_color: t.tag_color } });
  }
  for (const a of (aiChats.results || []) as any[]) {
    events.push({ type: 'ai_chat', event_at: a.event_at, data: { user_message: a.user_message, ai_reply: a.ai_reply, confidence: a.confidence, should_escalate: a.should_escalate } });
  }
  for (const s of (surveyResp.results || []) as any[]) {
    events.push({ type: 'survey_response', event_at: s.event_at, data: { survey_title: s.survey_title } });
  }
  for (const cl of (classifications.results || []) as any[]) {
    events.push({ type: 'ai_classification', event_at: cl.event_at, data: { segment: cl.segment, suggested_tags: cl.suggested_tags, reasoning: cl.reasoning, status: cl.status } });
  }

  // Sort by date descending, take limit
  events.sort((a, b) => new Date(b.event_at).getTime() - new Date(a.event_at).getTime());
  const trimmed = events.slice(0, limit);

  return c.json({ success: true, data: { user_id: id, events: trimmed, total: events.length } });
});

// POST /:id/attributes
customerRoutes.post('/:id/attributes', async (c) => {
  const userId = c.req.param('id');
  const { key, value } = await c.req.json<{ key: string; value: string }>();
  await c.env.DB.prepare('INSERT OR REPLACE INTO user_attributes (user_id, key, value) VALUES (?, ?, ?)').bind(userId, key, value).run();
  return c.json({ success: true });
});
