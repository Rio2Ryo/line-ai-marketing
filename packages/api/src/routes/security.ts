import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

export const securityRoutes = new Hono<{ Bindings: Env }>();

securityRoutes.use('*', authMiddleware);
securityRoutes.use('*', roleMiddleware('admin'));

// GET /api/security/audit-logs - List audit logs with filters
securityRoutes.get('/audit-logs', async (c) => {
  const type = c.req.query('type');
  const severity = c.req.query('severity');
  const ip = c.req.query('ip');
  const hours = parseInt(c.req.query('hours') || '24');
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500);

  const since = new Date(Date.now() - hours * 3600000).toISOString();
  const conditions = ['created_at >= ?'];
  const params: (string | number)[] = [since];

  if (type) { conditions.push('event_type = ?'); params.push(type); }
  if (severity) { conditions.push('severity = ?'); params.push(severity); }
  if (ip) { conditions.push('source_ip = ?'); params.push(ip); }

  params.push(limit);

  const rows = await c.env.DB.prepare(
    `SELECT * FROM security_audit_logs WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT ?`
  ).bind(...params).all();

  return c.json({ success: true, data: rows.results || [] });
});

// GET /api/security/audit-stats - Audit log statistics
securityRoutes.get('/audit-stats', async (c) => {
  const hours = parseInt(c.req.query('hours') || '24');
  const since = new Date(Date.now() - hours * 3600000).toISOString();

  const [byType, bySeverity, byIp, total] = await Promise.all([
    c.env.DB.prepare(
      'SELECT event_type, COUNT(*) as count FROM security_audit_logs WHERE created_at >= ? GROUP BY event_type ORDER BY count DESC'
    ).bind(since).all(),
    c.env.DB.prepare(
      'SELECT severity, COUNT(*) as count FROM security_audit_logs WHERE created_at >= ? GROUP BY severity ORDER BY count DESC'
    ).bind(since).all(),
    c.env.DB.prepare(
      'SELECT source_ip, COUNT(*) as count FROM security_audit_logs WHERE created_at >= ? AND source_ip IS NOT NULL GROUP BY source_ip ORDER BY count DESC LIMIT 20'
    ).bind(since).all(),
    c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM security_audit_logs WHERE created_at >= ?'
    ).bind(since).first(),
  ]);

  return c.json({
    success: true,
    data: {
      total: (total as any)?.total || 0,
      by_type: byType.results || [],
      by_severity: bySeverity.results || [],
      top_ips: byIp.results || [],
    },
  });
});

// GET /api/security/ip-rules - List IP rules
securityRoutes.get('/ip-rules', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT * FROM ip_rules ORDER BY created_at DESC'
  ).all();
  return c.json({ success: true, data: rows.results || [] });
});

// POST /api/security/ip-rules - Create IP rule
securityRoutes.post('/ip-rules', async (c) => {
  const body = await c.req.json<{
    ip_pattern: string;
    rule_type: string;
    scope?: string;
    description?: string;
  }>();

  if (!body.ip_pattern?.trim()) return c.json({ success: false, error: 'ip_pattern required' }, 400);
  if (!['allow', 'block'].includes(body.rule_type)) return c.json({ success: false, error: 'rule_type must be allow or block' }, 400);

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO ip_rules (id, ip_pattern, rule_type, scope, description) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, body.ip_pattern.trim(), body.rule_type, body.scope || 'webhook', body.description || null).run();

  return c.json({ success: true, data: { id } }, 201);
});

// PUT /api/security/ip-rules/:id - Update IP rule
securityRoutes.put('/ip-rules/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ is_active?: boolean; description?: string }>();

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (body.is_active !== undefined) { updates.push('is_active = ?'); values.push(body.is_active ? 1 : 0); }
  if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description); }

  if (updates.length === 0) return c.json({ success: false, error: 'No fields to update' }, 400);

  values.push(id);
  await c.env.DB.prepare(`UPDATE ip_rules SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

  return c.json({ success: true, message: 'Rule updated' });
});

// DELETE /api/security/ip-rules/:id - Delete IP rule
securityRoutes.delete('/ip-rules/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM ip_rules WHERE id = ?').bind(id).run();
  return c.json({ success: true, message: 'Rule deleted' });
});

// DELETE /api/security/audit-logs - Cleanup old logs
securityRoutes.delete('/audit-logs', async (c) => {
  const days = parseInt(c.req.query('days') || '30');
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const result = await c.env.DB.prepare('DELETE FROM security_audit_logs WHERE created_at < ?').bind(cutoff).run();
  return c.json({ success: true, deleted: result.meta.changes || 0 });
});
