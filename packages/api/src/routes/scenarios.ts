import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const scenarioRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
scenarioRoutes.use('*', authMiddleware);

scenarioRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT s.*, COUNT(ss.id) as step_count FROM scenarios s LEFT JOIN scenario_steps ss ON s.id = ss.scenario_id GROUP BY s.id ORDER BY s.created_at DESC').all();
  return c.json({ success: true, data: rows.results || [] });
});

scenarioRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const scenario = await c.env.DB.prepare('SELECT * FROM scenarios WHERE id = ?').bind(id).first();
  if (!scenario) return c.json({ success: false, error: 'Not found' }, 404);
  const steps = await c.env.DB.prepare('SELECT * FROM scenario_steps WHERE scenario_id = ? ORDER BY step_order ASC').bind(id).all();
  return c.json({ success: true, data: { ...scenario, steps: steps.results || [] } });
});

scenarioRoutes.post('/', async (c) => {
  const body = await c.req.json<{ name: string; trigger_type: string; description?: string; trigger_config?: string; steps?: Array<{ message_type: string; message_content: string; delay_minutes?: number; condition_json?: string }> }>();
  if (!body.name || !body.trigger_type) return c.json({ success: false, error: 'name and trigger_type required' }, 400);
  const sid = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO scenarios (id, name, description, trigger_type, trigger_config, is_active) VALUES (?, ?, ?, ?, ?, 1)').bind(sid, body.name, body.description || null, body.trigger_type, body.trigger_config || null).run();
  if (body.steps) {
    for (let i = 0; i < body.steps.length; i++) {
      const s = body.steps[i];
      await c.env.DB.prepare('INSERT INTO scenario_steps (id, scenario_id, step_order, message_type, message_content, delay_minutes, condition_json) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), sid, i + 1, s.message_type, s.message_content, s.delay_minutes || 0, s.condition_json || null).run();
    }
  }
  const created = await c.env.DB.prepare('SELECT * FROM scenarios WHERE id = ?').bind(sid).first();
  const steps = await c.env.DB.prepare('SELECT * FROM scenario_steps WHERE scenario_id = ? ORDER BY step_order ASC').bind(sid).all();
  return c.json({ success: true, data: { ...created, steps: steps.results || [] } }, 201);
});

scenarioRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ name?: string; description?: string; is_active?: number; trigger_type?: string; trigger_config?: string }>();
  const sets: string[] = []; const vals: any[] = [];
  if (body.name) { sets.push('name = ?'); vals.push(body.name); }
  if (body.description !== undefined) { sets.push('description = ?'); vals.push(body.description); }
  if (body.is_active !== undefined) { sets.push('is_active = ?'); vals.push(body.is_active); }
  if (body.trigger_type) { sets.push('trigger_type = ?'); vals.push(body.trigger_type); }
  if (body.trigger_config !== undefined) { sets.push('trigger_config = ?'); vals.push(body.trigger_config); }
  if (!sets.length) return c.json({ success: false, error: 'No fields' }, 400);
  sets.push("updated_at = datetime('now')");
  await c.env.DB.prepare('UPDATE scenarios SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals, id).run();
  const updated = await c.env.DB.prepare('SELECT * FROM scenarios WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: updated });
});

scenarioRoutes.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM scenarios WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
});

scenarioRoutes.post('/:id/steps', async (c) => {
  const scenarioId = c.req.param('id');
  const body = await c.req.json<{ message_type: string; message_content: string; delay_minutes?: number; condition_json?: string }>();
  const maxRow = await c.env.DB.prepare('SELECT MAX(step_order) as mx FROM scenario_steps WHERE scenario_id = ?').bind(scenarioId).first<{ mx: number | null }>();
  const order = (maxRow?.mx || 0) + 1;
  const stepId = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO scenario_steps (id, scenario_id, step_order, message_type, message_content, delay_minutes, condition_json) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(stepId, scenarioId, order, body.message_type, body.message_content, body.delay_minutes || 0, body.condition_json || null).run();
  const step = await c.env.DB.prepare('SELECT * FROM scenario_steps WHERE id = ?').bind(stepId).first();
  return c.json({ success: true, data: step }, 201);
});

scenarioRoutes.delete('/:id/steps/:stepId', async (c) => {
  await c.env.DB.prepare('DELETE FROM scenario_steps WHERE id = ?').bind(c.req.param('stepId')).run();
  return c.json({ success: true });
});

// シナリオ手動実行: LINE Push API配信
scenarioRoutes.post('/:id/execute', async (c) => {
  const scenarioId = c.req.param('id');
  const { user_ids } = await c.req.json<{ user_ids: string[] }>();
  const steps = await c.env.DB.prepare('SELECT * FROM scenario_steps WHERE scenario_id = ? ORDER BY step_order ASC').bind(scenarioId).all();
  if (!steps.results?.length) return c.json({ success: false, error: 'No steps' }, 400);

  let sent = 0, failed = 0;
  const firstStep = steps.results[0] as any;

  for (const uid of user_ids) {
    const user = await c.env.DB.prepare('SELECT line_user_id FROM users WHERE id = ?').bind(uid).first<{ line_user_id: string }>();
    if (!user) { failed++; continue; }
    try {
      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + c.env.LINE_CHANNEL_ACCESS_TOKEN },
        body: JSON.stringify({ to: user.line_user_id, messages: [{ type: 'text', text: firstStep.message_content }] }),
      });
      const msgId = crypto.randomUUID();
      await c.env.DB.prepare('INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, ?, ?, ?)').bind(msgId, uid, 'outbound', 'text', firstStep.message_content).run();
      await c.env.DB.prepare("INSERT INTO delivery_logs (id, scenario_id, scenario_step_id, user_id, status, sent_at) VALUES (?, ?, ?, ?, 'sent', datetime('now'))").bind(crypto.randomUUID(), scenarioId, firstStep.id, uid).run();
      sent++;
    } catch (e) {
      await c.env.DB.prepare("INSERT INTO delivery_logs (id, scenario_id, scenario_step_id, user_id, status, error_message) VALUES (?, ?, ?, ?, 'failed', ?)").bind(crypto.randomUUID(), scenarioId, firstStep.id, uid, String(e)).run();
      failed++;
    }
  }
  return c.json({ success: true, data: { sent, failed, total_steps: steps.results.length } });
});
