import { Env } from '../types';

export async function evaluateTriggers(env: Env, eventType: string, data: any): Promise<string[]> {
  const ids: string[] = [];

  if (eventType === 'follow') {
    const rows = await env.DB.prepare("SELECT id FROM scenarios WHERE trigger_type = 'follow' AND is_active = 1").all();
    for (const r of rows.results || []) ids.push((r as any).id);
  }

  if (eventType === 'message_keyword' && data.text) {
    const rows = await env.DB.prepare("SELECT id, trigger_config FROM scenarios WHERE trigger_type = 'message_keyword' AND is_active = 1").all();
    for (const r of (rows.results || []) as any[]) {
      try {
        const cfg = JSON.parse(r.trigger_config || '{}');
        const keywords: string[] = cfg.keywords || [];
        if (keywords.some((kw: string) => data.text.includes(kw))) ids.push(r.id);
      } catch {}
    }
  }

  return ids;
}

export async function executeScenario(env: Env, scenarioId: string, userId: string): Promise<void> {
  const steps = await env.DB.prepare('SELECT * FROM scenario_steps WHERE scenario_id = ? ORDER BY step_order ASC').bind(scenarioId).all();
  if (!steps.results?.length) return;

  const user = await env.DB.prepare('SELECT line_user_id FROM users WHERE id = ?').bind(userId).first<{ line_user_id: string }>();
  if (!user) return;

  for (let i = 0; i < steps.results.length; i++) {
    const step = steps.results[i] as any;
    if (i === 0 && step.delay_minutes === 0) {
      try {
        await pushMessage(env, user.line_user_id, step.message_content);
        await env.DB.prepare("INSERT INTO delivery_logs (id, scenario_id, scenario_step_id, user_id, status, sent_at) VALUES (?, ?, ?, ?, 'sent', datetime('now'))").bind(crypto.randomUUID(), scenarioId, step.id, userId).run();
        await env.DB.prepare("INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, 'outbound', 'text', ?)").bind(crypto.randomUUID(), userId, step.message_content).run();
      } catch (e) {
        await env.DB.prepare("INSERT INTO delivery_logs (id, scenario_id, scenario_step_id, user_id, status, error_message) VALUES (?, ?, ?, ?, 'failed', ?)").bind(crypto.randomUUID(), scenarioId, step.id, userId, String(e)).run();
      }
    } else {
      const scheduledAt = new Date(Date.now() + step.delay_minutes * 60 * 1000).toISOString();
      await env.DB.prepare("INSERT INTO delivery_logs (id, scenario_id, scenario_step_id, user_id, status, scheduled_at) VALUES (?, ?, ?, ?, 'pending', ?)").bind(crypto.randomUUID(), scenarioId, step.id, userId, scheduledAt).run();
    }
  }
}

export async function processScheduledDeliveries(env: Env): Promise<{ processed: number; sent: number; failed: number }> {
  const pending = await env.DB.prepare("SELECT dl.*, ss.message_content FROM delivery_logs dl JOIN scenario_steps ss ON dl.scenario_step_id = ss.id WHERE dl.status = 'pending' AND dl.scheduled_at <= datetime('now') LIMIT 50").all();
  let sent = 0, failed = 0;

  for (const row of (pending.results || []) as any[]) {
    const user = await env.DB.prepare('SELECT line_user_id FROM users WHERE id = ?').bind(row.user_id).first<{ line_user_id: string }>();
    if (!user) { failed++; continue; }
    try {
      await pushMessage(env, user.line_user_id, row.message_content);
      await env.DB.prepare("UPDATE delivery_logs SET status = 'sent', sent_at = datetime('now') WHERE id = ?").bind(row.id).run();
      await env.DB.prepare("INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, 'outbound', 'text', ?)").bind(crypto.randomUUID(), row.user_id, row.message_content).run();
      sent++;
    } catch (e) {
      await env.DB.prepare("UPDATE delivery_logs SET status = 'failed', error_message = ? WHERE id = ?").bind(String(e), row.id).run();
      failed++;
    }
  }
  return { processed: (pending.results || []).length, sent, failed };
}

async function pushMessage(env: Env, lineUserId: string, text: string): Promise<void> {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.LINE_CHANNEL_ACCESS_TOKEN },
    body: JSON.stringify({ to: lineUserId, messages: [{ type: 'text', text }] }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error('Push failed: ' + res.status + ' ' + err); }
}
