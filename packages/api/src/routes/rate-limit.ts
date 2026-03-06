import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { getRateLimitStats } from '../lib/rate-limiter';

type AuthVars = { userId: string };
export const rateLimitRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
rateLimitRoutes.use('*', authMiddleware);

// GET /stats — Current rate limit stats
rateLimitRoutes.get('/stats', async (c) => {
  try {
    const stats = await getRateLimitStats(c.env);
    return c.json({ success: true, data: stats });
  } catch (err) {
    console.error('Rate limit stats error:', err);
    return c.json({ success: false, error: 'Failed to fetch rate limit stats' }, 500);
  }
});

// GET /logs — Recent rate limit events
rateLimitRoutes.get('/logs', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = (page - 1) * limit;
    const eventType = c.req.query('type'); // success, rate_limited, server_error, client_error, batch_complete

    let where = '';
    const binds: unknown[] = [];
    if (eventType) {
      where = 'WHERE event_type = ?';
      binds.push(eventType);
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM rate_limit_logs ${where}`
    ).bind(...binds).first<{ total: number }>();

    const rows = await c.env.DB.prepare(
      `SELECT * FROM rate_limit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...binds, limit, offset).all();

    return c.json({
      success: true,
      data: rows.results || [],
      pagination: {
        page,
        limit,
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / limit),
      },
    });
  } catch (err) {
    console.error('Rate limit logs error:', err);
    return c.json({ success: false, error: 'Failed to fetch rate limit logs' }, 500);
  }
});

// GET /hourly — Hourly breakdown (last 24h)
rateLimitRoutes.get('/hourly', async (c) => {
  try {
    const rows = await c.env.DB.prepare(
      `SELECT
        strftime('%Y-%m-%d %H:00', created_at) as hour,
        event_type,
        COUNT(*) as count
       FROM rate_limit_logs
       WHERE created_at >= datetime('now', '-24 hours')
       GROUP BY hour, event_type
       ORDER BY hour ASC`
    ).all();

    // Group by hour
    const hourMap: Record<string, { hour: string; success: number; rate_limited: number; server_error: number; client_error: number; total: number }> = {};
    for (const r of (rows.results || []) as { hour: string; event_type: string; count: number }[]) {
      if (!hourMap[r.hour]) {
        hourMap[r.hour] = { hour: r.hour, success: 0, rate_limited: 0, server_error: 0, client_error: 0, total: 0 };
      }
      const h = hourMap[r.hour];
      if (r.event_type === 'success') h.success = r.count;
      else if (r.event_type === 'rate_limited') h.rate_limited = r.count;
      else if (r.event_type === 'server_error') h.server_error = r.count;
      else if (r.event_type === 'client_error') h.client_error = r.count;
      h.total += r.count;
    }

    return c.json({
      success: true,
      data: Object.values(hourMap).sort((a, b) => a.hour.localeCompare(b.hour)),
    });
  } catch (err) {
    console.error('Rate limit hourly error:', err);
    return c.json({ success: false, error: 'Failed to fetch hourly stats' }, 500);
  }
});

// DELETE /logs — Cleanup old logs (keep last 7 days)
rateLimitRoutes.delete('/logs', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      "DELETE FROM rate_limit_logs WHERE created_at < datetime('now', '-7 days')"
    ).run();
    return c.json({ success: true, data: { deleted: result.meta?.changes || 0 } });
  } catch (err) {
    console.error('Rate limit cleanup error:', err);
    return c.json({ success: false, error: 'Failed to cleanup logs' }, 500);
  }
});
