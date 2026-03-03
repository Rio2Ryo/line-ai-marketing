import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

type Variables = { userId: string; userRole: string };
export const apiMonitorRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

apiMonitorRoutes.use('*', authMiddleware);
apiMonitorRoutes.use('*', roleMiddleware('admin'));

// GET /summary — Overall stats for a period
apiMonitorRoutes.get('/summary', async (c) => {
  const days = parseInt(c.req.query('days') || '7');
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [total, errors, avgTime, statusDist] = await Promise.all([
    c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM api_request_logs WHERE created_at >= ?"
    ).bind(since).first<{ count: number }>(),

    c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM api_request_logs WHERE created_at >= ? AND status_code >= 400"
    ).bind(since).first<{ count: number }>(),

    c.env.DB.prepare(
      "SELECT AVG(response_time_ms) as avg_ms, MAX(response_time_ms) as max_ms, MIN(response_time_ms) as min_ms FROM api_request_logs WHERE created_at >= ?"
    ).bind(since).first<{ avg_ms: number; max_ms: number; min_ms: number }>(),

    c.env.DB.prepare(
      "SELECT CASE WHEN status_code < 300 THEN '2xx' WHEN status_code < 400 THEN '3xx' WHEN status_code < 500 THEN '4xx' ELSE '5xx' END as status_group, COUNT(*) as count FROM api_request_logs WHERE created_at >= ? GROUP BY status_group ORDER BY status_group"
    ).bind(since).all(),
  ]);

  const totalCount = total?.count || 0;
  const errorCount = errors?.count || 0;

  return c.json({
    success: true,
    data: {
      period_days: days,
      total_requests: totalCount,
      error_count: errorCount,
      error_rate: totalCount > 0 ? ((errorCount / totalCount) * 100).toFixed(2) : '0.00',
      avg_response_ms: Math.round(avgTime?.avg_ms || 0),
      max_response_ms: avgTime?.max_ms || 0,
      min_response_ms: avgTime?.min_ms || 0,
      status_distribution: statusDist.results || [],
    },
  });
});

// GET /endpoints — Per-endpoint breakdown
apiMonitorRoutes.get('/endpoints', async (c) => {
  const days = parseInt(c.req.query('days') || '7');
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const rows = await c.env.DB.prepare(
    `SELECT method, path,
     COUNT(*) as request_count,
     AVG(response_time_ms) as avg_ms,
     MAX(response_time_ms) as max_ms,
     SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
     FROM api_request_logs
     WHERE created_at >= ?
     GROUP BY method, path
     ORDER BY request_count DESC
     LIMIT 50`
  ).bind(since).all();

  const endpoints = (rows.results || []).map((r: any) => ({
    method: r.method,
    path: r.path,
    request_count: r.request_count,
    avg_response_ms: Math.round(r.avg_ms || 0),
    max_response_ms: r.max_ms || 0,
    error_count: r.error_count || 0,
    error_rate: r.request_count > 0 ? ((r.error_count / r.request_count) * 100).toFixed(2) : '0.00',
  }));

  return c.json({ success: true, data: endpoints });
});

// GET /daily — Daily request/error counts for chart
apiMonitorRoutes.get('/daily', async (c) => {
  const days = parseInt(c.req.query('days') || '30');
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const rows = await c.env.DB.prepare(
    `SELECT DATE(created_at) as date,
     COUNT(*) as total,
     SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors,
     AVG(response_time_ms) as avg_ms
     FROM api_request_logs
     WHERE created_at >= ?
     GROUP BY DATE(created_at)
     ORDER BY date ASC`
  ).bind(since).all();

  return c.json({
    success: true,
    data: (rows.results || []).map((r: any) => ({
      date: r.date,
      total: r.total,
      errors: r.errors || 0,
      avg_response_ms: Math.round(r.avg_ms || 0),
    })),
  });
});

// GET /errors — Recent error details
apiMonitorRoutes.get('/errors', async (c) => {
  const limit = parseInt(c.req.query('limit') || '50');

  const rows = await c.env.DB.prepare(
    `SELECT id, method, path, status_code, response_time_ms, error_message, ip_address, created_at
     FROM api_request_logs
     WHERE status_code >= 400
     ORDER BY created_at DESC
     LIMIT ?`
  ).bind(Math.min(limit, 100)).all();

  return c.json({ success: true, data: rows.results || [] });
});

// GET /slow — Slowest requests
apiMonitorRoutes.get('/slow', async (c) => {
  const days = parseInt(c.req.query('days') || '7');
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const threshold = parseInt(c.req.query('threshold') || '1000');

  const rows = await c.env.DB.prepare(
    `SELECT id, method, path, status_code, response_time_ms, created_at
     FROM api_request_logs
     WHERE created_at >= ? AND response_time_ms >= ?
     ORDER BY response_time_ms DESC
     LIMIT 50`
  ).bind(since, threshold).all();

  return c.json({ success: true, data: rows.results || [] });
});
