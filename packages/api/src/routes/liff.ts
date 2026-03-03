import { Hono } from 'hono';
import { Env } from '../types';
import { liffAuthMiddleware } from '../middleware/liff-auth';

type LiffVars = { liffUserId: string; liffLineUserId: string };
export const liffRoutes = new Hono<{ Bindings: Env; Variables: LiffVars }>();

liffRoutes.use('*', liffAuthMiddleware);

// GET /profile — Get my profile
liffRoutes.get('/profile', async (c) => {
  const userId = c.get('liffUserId');
  const user = await c.env.DB.prepare(
    'SELECT id, display_name, picture_url, status_message, status, created_at FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!user) return c.json({ success: false, error: 'User not found' }, 404);

  // Get tags
  const tags = await c.env.DB.prepare(
    'SELECT t.id, t.name, t.color FROM tags t JOIN user_tags ut ON t.id = ut.tag_id WHERE ut.user_id = ?'
  ).bind(userId).all();

  // Get attributes
  const attrs = await c.env.DB.prepare(
    'SELECT key, value FROM user_attributes WHERE user_id = ?'
  ).bind(userId).all();

  return c.json({
    success: true,
    data: {
      ...user,
      tags: tags.results || [],
      attributes: attrs.results || [],
    },
  });
});

// PUT /profile — Update my profile (limited fields)
liffRoutes.put('/profile', async (c) => {
  const userId = c.get('liffUserId');
  const body = await c.req.json<{ display_name?: string; status_message?: string }>();

  const sets: string[] = [];
  const vals: any[] = [];
  if (body.display_name !== undefined) { sets.push('display_name = ?'); vals.push(body.display_name); }
  if (body.status_message !== undefined) { sets.push('status_message = ?'); vals.push(body.status_message); }

  if (sets.length === 0) return c.json({ success: false, error: 'No fields to update' }, 400);
  sets.push("updated_at = datetime('now')");

  await c.env.DB.prepare('UPDATE users SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals, userId).run();
  const updated = await c.env.DB.prepare(
    'SELECT id, display_name, picture_url, status_message, status, created_at FROM users WHERE id = ?'
  ).bind(userId).first();

  return c.json({ success: true, data: updated });
});

// GET /surveys — List active surveys available for me
liffRoutes.get('/surveys', async (c) => {
  const userId = c.get('liffUserId');
  const surveys = await c.env.DB.prepare(
    'SELECT id, title, description, created_at FROM surveys WHERE is_active = 1 ORDER BY created_at DESC'
  ).all();

  // Get which surveys user has already responded to
  const responded = await c.env.DB.prepare(
    'SELECT survey_id FROM survey_responses WHERE user_id = ?'
  ).bind(userId).all();
  const respondedIds = new Set((responded.results || []).map((r: any) => r.survey_id));

  const data = (surveys.results || []).map((s: any) => ({
    ...s,
    responded: respondedIds.has(s.id),
  }));

  return c.json({ success: true, data });
});

// GET /surveys/:id — Get survey with questions (for answering)
liffRoutes.get('/surveys/:id', async (c) => {
  const surveyId = c.req.param('id');
  const survey = await c.env.DB.prepare(
    'SELECT * FROM surveys WHERE id = ? AND is_active = 1'
  ).bind(surveyId).first();
  if (!survey) return c.json({ success: false, error: 'Survey not found' }, 404);

  const questions = await c.env.DB.prepare(
    'SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY question_order ASC'
  ).bind(surveyId).all();

  // Check if already responded
  const userId = c.get('liffUserId');
  const existing = await c.env.DB.prepare(
    'SELECT id FROM survey_responses WHERE survey_id = ? AND user_id = ?'
  ).bind(surveyId, userId).first();

  return c.json({
    success: true,
    data: {
      ...survey,
      questions: questions.results || [],
      already_responded: !!existing,
    },
  });
});

// POST /surveys/:id/respond — Submit survey response
liffRoutes.post('/surveys/:id/respond', async (c) => {
  const surveyId = c.req.param('id');
  const userId = c.get('liffUserId');
  const body = await c.req.json<{ answers: Record<string, string | string[]> }>();

  if (!body.answers) return c.json({ success: false, error: 'answers required' }, 400);

  // Check duplicate
  const existing = await c.env.DB.prepare(
    'SELECT id FROM survey_responses WHERE survey_id = ? AND user_id = ?'
  ).bind(surveyId, userId).first();
  if (existing) return c.json({ success: false, error: 'Already responded' }, 409);

  // Verify survey exists and is active
  const survey = await c.env.DB.prepare(
    'SELECT id FROM surveys WHERE id = ? AND is_active = 1'
  ).bind(surveyId).first();
  if (!survey) return c.json({ success: false, error: 'Survey not found' }, 404);

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO survey_responses (id, survey_id, user_id, answers_json) VALUES (?, ?, ?, ?)'
  ).bind(id, surveyId, userId, JSON.stringify(body.answers)).run();

  return c.json({ success: true, data: { id } }, 201);
});

// GET /messages — My message history
liffRoutes.get('/messages', async (c) => {
  const userId = c.get('liffUserId');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const offset = parseInt(c.req.query('offset') || '0');

  const messages = await c.env.DB.prepare(
    'SELECT id, direction, message_type, content, sent_at FROM messages WHERE user_id = ? ORDER BY sent_at DESC LIMIT ? OFFSET ?'
  ).bind(userId, limit, offset).all();

  const countRow = await c.env.DB.prepare(
    'SELECT COUNT(*) as total FROM messages WHERE user_id = ?'
  ).bind(userId).first<{ total: number }>();

  return c.json({
    success: true,
    data: messages.results || [],
    pagination: { limit, offset, total: countRow?.total || 0 },
  });
});
