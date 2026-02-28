import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const aiLogRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
aiLogRoutes.use('*', authMiddleware);

// GET /logs — AIチャットログ一覧(ページネーション、escalateフィルタ)
aiLogRoutes.get('/logs', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const escalateOnly = c.req.query('escalate') === '1';
  const offset = (page - 1) * limit;

  let where = '';
  if (escalateOnly) where = ' WHERE should_escalate = 1';
  const countResult = await c.env.DB.prepare('SELECT COUNT(*) as total FROM ai_chat_logs' + where).first<{ total: number }>();
  const rows = await c.env.DB.prepare(
    'SELECT l.*, u.display_name, u.line_user_id FROM ai_chat_logs l LEFT JOIN users u ON l.user_id = u.id' + where + ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?'
  ).bind(limit, offset).all();

  return c.json({ success: true, data: rows.results || [], pagination: { page, limit, total: countResult?.total || 0, totalPages: Math.ceil((countResult?.total || 0) / limit) } });
});

// GET /logs/stats — AIログ統計
aiLogRoutes.get('/logs/stats', async (c) => {
  const total = await c.env.DB.prepare("SELECT COUNT(*) as c FROM ai_chat_logs WHERE created_at >= datetime('now','-30 days')").first<{ c: number }>();
  const escalated = await c.env.DB.prepare("SELECT COUNT(*) as c FROM ai_chat_logs WHERE should_escalate = 1 AND created_at >= datetime('now','-30 days')").first<{ c: number }>();
  const avgConf = await c.env.DB.prepare("SELECT AVG(confidence) as avg FROM ai_chat_logs WHERE created_at >= datetime('now','-30 days')").first<{ avg: number }>();
  const avgTime = await c.env.DB.prepare("SELECT AVG(response_time_ms) as avg FROM ai_chat_logs WHERE response_time_ms IS NOT NULL AND created_at >= datetime('now','-30 days')").first<{ avg: number }>();
  return c.json({ success: true, data: { total_responses: total?.c || 0, escalated: escalated?.c || 0, avg_confidence: Math.round((avgConf?.avg || 0) * 100) / 100, avg_response_ms: Math.round(avgTime?.avg || 0) } });
});

// GET /escalations — エスカレーション一覧
aiLogRoutes.get('/escalations', async (c) => {
  const status = c.req.query('status') || '';
  let query = 'SELECT e.*, u.display_name, u.line_user_id, u.picture_url, l.user_message, l.ai_reply FROM escalations e LEFT JOIN users u ON e.user_id = u.id LEFT JOIN ai_chat_logs l ON e.ai_chat_log_id = l.id';
  const binds: any[] = [];
  if (status) { query += ' WHERE e.status = ?'; binds.push(status); }
  query += ' ORDER BY e.created_at DESC';
  const rows = await c.env.DB.prepare(query).bind(...binds).all();
  return c.json({ success: true, data: rows.results || [] });
});

// PUT /escalations/:id — エスカレーション更新(ステータス変更/アサイン/メモ)
aiLogRoutes.put('/escalations/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ status?: string; assigned_to?: string; note?: string; priority?: string }>();
  const sets: string[] = []; const vals: any[] = [];
  if (body.status) { sets.push('status = ?'); vals.push(body.status); if (body.status === 'resolved') sets.push("resolved_at = datetime('now')"); }
  if (body.assigned_to !== undefined) { sets.push('assigned_to = ?'); vals.push(body.assigned_to); }
  if (body.note !== undefined) { sets.push('note = ?'); vals.push(body.note); }
  if (body.priority) { sets.push('priority = ?'); vals.push(body.priority); }
  if (!sets.length) return c.json({ success: false, error: 'No fields' }, 400);
  await c.env.DB.prepare('UPDATE escalations SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals, id).run();
  const updated = await c.env.DB.prepare('SELECT * FROM escalations WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: updated });
});
