import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

export const webhookStreamRoutes = new Hono<{ Bindings: Env }>();

webhookStreamRoutes.use('*', authMiddleware);

// GET /events - List webhook events with cursor-based polling
webhookStreamRoutes.get('/events', async (c) => {
  const after = c.req.query('after');      // cursor: ISO timestamp or event ID
  const type = c.req.query('type');         // filter by event_type
  const stage = c.req.query('stage');       // filter by stage
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);

  let sql = 'SELECT id, event_type, source_type, source_user_id, internal_user_id, message_type, summary, stage, processing_ms, error_message, created_at FROM webhook_events';
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (after) {
    conditions.push('created_at > ?');
    params.push(after);
  }
  if (type) {
    conditions.push('event_type = ?');
    params.push(type);
  }
  if (stage) {
    conditions.push('stage = ?');
    params.push(stage);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const rows = await c.env.DB.prepare(sql).bind(...params).all();

  return c.json({
    success: true,
    data: rows.results || [],
    cursor: (rows.results && rows.results.length > 0) ? (rows.results[rows.results.length - 1] as any).created_at : null,
  });
});

// GET /events/:id - Single event detail with full raw JSON
webhookStreamRoutes.get('/events/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(
    'SELECT * FROM webhook_events WHERE id = ?'
  ).bind(id).first();

  if (!row) return c.json({ success: false, error: 'Not found' }, 404);

  return c.json({ success: true, data: row });
});

// GET /stats - Event statistics
webhookStreamRoutes.get('/stats', async (c) => {
  const hours = parseInt(c.req.query('hours') || '24');
  const since = new Date(Date.now() - hours * 3600000).toISOString();

  const [byType, byStage, avgTime, total, recent] = await Promise.all([
    c.env.DB.prepare(
      `SELECT event_type, COUNT(*) as count FROM webhook_events WHERE created_at >= ? GROUP BY event_type ORDER BY count DESC`
    ).bind(since).all(),
    c.env.DB.prepare(
      `SELECT stage, COUNT(*) as count FROM webhook_events WHERE created_at >= ? GROUP BY stage ORDER BY count DESC`
    ).bind(since).all(),
    c.env.DB.prepare(
      `SELECT AVG(processing_ms) as avg_ms, MIN(processing_ms) as min_ms, MAX(processing_ms) as max_ms FROM webhook_events WHERE created_at >= ? AND processing_ms IS NOT NULL`
    ).bind(since).first(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM webhook_events WHERE created_at >= ?`
    ).bind(since).first(),
    c.env.DB.prepare(
      `SELECT strftime('%Y-%m-%dT%H:00:00', created_at) as hour, COUNT(*) as count FROM webhook_events WHERE created_at >= ? GROUP BY hour ORDER BY hour`
    ).bind(since).all(),
  ]);

  return c.json({
    success: true,
    data: {
      total: (total as any)?.total || 0,
      by_type: byType.results || [],
      by_stage: byStage.results || [],
      timing: {
        avg_ms: Math.round((avgTime as any)?.avg_ms || 0),
        min_ms: (avgTime as any)?.min_ms || 0,
        max_ms: (avgTime as any)?.max_ms || 0,
      },
      hourly: recent.results || [],
    },
  });
});

// DELETE /events - Cleanup old events (admin only)
webhookStreamRoutes.delete('/events', roleMiddleware('admin'), async (c) => {
  const days = parseInt(c.req.query('days') || '7');
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  const result = await c.env.DB.prepare(
    'DELETE FROM webhook_events WHERE created_at < ?'
  ).bind(cutoff).run();

  return c.json({
    success: true,
    deleted: result.meta.changes || 0,
  });
});
