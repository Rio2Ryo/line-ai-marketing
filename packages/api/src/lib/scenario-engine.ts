import { Env } from '../types';

// ─── DB Migration: expand trigger_type CHECK constraint ───

let migrationDone = false;

async function ensureExtendedTriggers(db: D1Database): Promise<void> {
  if (migrationDone) return;
  try {
    // Test if new trigger types are allowed
    await db.prepare(
      "INSERT INTO scenarios (id, name, trigger_type, is_active) VALUES ('__trigger_test__', '__test__', 'rank_change', 0)"
    ).run();
    await db.prepare("DELETE FROM scenarios WHERE id = '__trigger_test__'").run();
    migrationDone = true;
  } catch {
    // CHECK constraint blocks new types — migrate table
    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS scenarios_v2 (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          trigger_type TEXT NOT NULL,
          trigger_config TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT OR IGNORE INTO scenarios_v2 SELECT * FROM scenarios;
        DROP TABLE scenarios;
        ALTER TABLE scenarios_v2 RENAME TO scenarios;
      `);
      migrationDone = true;
    } catch (e) {
      console.error('Scenario migration failed:', e);
      migrationDone = true; // Don't retry
    }
  }
}

// ─── Trigger Evaluation ───

const RANK_ORDER: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };

export async function evaluateTriggers(env: Env, eventType: string, data: any): Promise<string[]> {
  await ensureExtendedTriggers(env.DB);
  const ids: string[] = [];

  // follow — 友だち追加
  if (eventType === 'follow') {
    const rows = await env.DB.prepare("SELECT id FROM scenarios WHERE trigger_type = 'follow' AND is_active = 1").all();
    for (const r of rows.results || []) ids.push((r as any).id);
  }

  // message_keyword — キーワードマッチ
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

  // tag_added — タグ付与時
  if (eventType === 'tag_added' && data.tag_id) {
    const rows = await env.DB.prepare("SELECT id, trigger_config FROM scenarios WHERE trigger_type = 'tag_added' AND is_active = 1").all();
    for (const r of (rows.results || []) as any[]) {
      try {
        const cfg = JSON.parse(r.trigger_config || '{}');
        const tagIds: string[] = cfg.tag_ids || [];
        // Empty tag_ids = match any tag; otherwise match specific tags
        if (tagIds.length === 0 || tagIds.includes(data.tag_id)) ids.push(r.id);
      } catch {}
    }
  }

  // rank_change — スコアランク変動
  if (eventType === 'rank_change' && data.new_rank) {
    const rows = await env.DB.prepare("SELECT id, trigger_config FROM scenarios WHERE trigger_type = 'rank_change' AND is_active = 1").all();
    for (const r of (rows.results || []) as any[]) {
      try {
        const cfg = JSON.parse(r.trigger_config || '{}');
        const direction = cfg.direction; // 'up' | 'down' | 'any' | undefined
        const targetRank = cfg.target_rank; // specific rank or undefined

        const prevOrd = RANK_ORDER[data.prev_rank] || 0;
        const newOrd = RANK_ORDER[data.new_rank] || 0;

        let matches = true;
        if (direction === 'up' && newOrd <= prevOrd) matches = false;
        if (direction === 'down' && newOrd >= prevOrd) matches = false;
        if (targetRank && data.new_rank !== targetRank) matches = false;

        if (matches) ids.push(r.id);
      } catch {}
    }
  }

  // conversion — コンバージョン達成
  if (eventType === 'conversion' && data.goal_id) {
    const rows = await env.DB.prepare("SELECT id, trigger_config FROM scenarios WHERE trigger_type = 'conversion' AND is_active = 1").all();
    for (const r of (rows.results || []) as any[]) {
      try {
        const cfg = JSON.parse(r.trigger_config || '{}');
        const goalIds: string[] = cfg.goal_ids || [];
        // Empty = match any goal; otherwise match specific goals
        if (goalIds.length === 0 || goalIds.includes(data.goal_id)) ids.push(r.id);
      } catch {}
    }
  }

  // follow_source — 特定経路からの友だち追加
  if (eventType === 'follow_source' && data.source_code) {
    const rows = await env.DB.prepare("SELECT id, trigger_config FROM scenarios WHERE trigger_type = 'follow_source' AND is_active = 1").all();
    for (const r of (rows.results || []) as any[]) {
      try {
        const cfg = JSON.parse(r.trigger_config || '{}');
        const sourceCodes: string[] = cfg.source_codes || [];
        if (sourceCodes.length === 0 || sourceCodes.includes(data.source_code)) ids.push(r.id);
      } catch {}
    }
  }

  return ids;
}

// ─── Scenario Execution ───

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
        const nextRetryAt = new Date(Date.now() + 10 * 60000).toISOString();
        await env.DB.prepare("INSERT INTO delivery_logs (id, scenario_id, scenario_step_id, user_id, status, error_message, retry_count, max_retries, next_retry_at) VALUES (?, ?, ?, ?, 'failed', ?, 0, 3, ?)").bind(crypto.randomUUID(), scenarioId, step.id, userId, String(e), nextRetryAt).run();
      }
    } else {
      const scheduledAt = new Date(Date.now() + step.delay_minutes * 60 * 1000).toISOString();
      await env.DB.prepare("INSERT INTO delivery_logs (id, scenario_id, scenario_step_id, user_id, status, scheduled_at) VALUES (?, ?, ?, ?, 'pending', ?)").bind(crypto.randomUUID(), scenarioId, step.id, userId, scheduledAt).run();
    }
  }
}

// ─── Scheduled Delivery Processing ───

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
      const nextRetryAt = new Date(Date.now() + 10 * 60000).toISOString();
      await env.DB.prepare("UPDATE delivery_logs SET status = 'failed', error_message = ?, next_retry_at = ? WHERE id = ?").bind(String(e), nextRetryAt, row.id).run();
      failed++;
    }
  }
  return { processed: (pending.results || []).length, sent, failed };
}

export async function processScheduledDeliveryJobs(env: Env): Promise<{ processed: number; sent: number; failed: number }> {
  const now = new Date().toISOString();
  const pending = await env.DB.prepare(
    "SELECT * FROM scheduled_deliveries WHERE status = 'pending' AND scheduled_at <= ? LIMIT 20"
  ).bind(now).all();

  let totalSent = 0, totalFailed = 0;

  for (const job of (pending.results || []) as any[]) {
    await env.DB.prepare(
      "UPDATE scheduled_deliveries SET status = 'processing', updated_at = datetime('now') WHERE id = ?"
    ).bind(job.id).run();

    try {
      const users = await resolveTargetUsers(env, job.target_type, job.target_config);
      let sent = 0, failed = 0;

      for (const user of users) {
        try {
          await pushMessage(env, user.line_user_id, job.message_content);
          sent++;
        } catch {
          failed++;
        }
      }

      await env.DB.prepare(
        "UPDATE scheduled_deliveries SET status = 'completed', sent_count = ?, failed_count = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(sent, failed, job.id).run();
      totalSent += sent;
      totalFailed += failed;
    } catch (e) {
      await env.DB.prepare(
        "UPDATE scheduled_deliveries SET status = 'failed', updated_at = datetime('now') WHERE id = ?"
      ).bind(job.id).run();
      totalFailed++;
      console.error('Scheduled delivery job failed:', job.id, e);
    }
  }

  return { processed: (pending.results || []).length, sent: totalSent, failed: totalFailed };
}

async function resolveTargetUsers(env: Env, targetType: string, targetConfig: string | null): Promise<{ line_user_id: string }[]> {
  if (targetType === 'all') {
    const rows = await env.DB.prepare("SELECT line_user_id FROM users WHERE status = 'active' LIMIT 1000").all();
    return (rows.results || []) as { line_user_id: string }[];
  }

  if (targetType === 'tag' && targetConfig) {
    const tagNames = targetConfig.split(',').map(t => t.trim()).filter(Boolean);
    if (tagNames.length === 0) return [];
    const placeholders = tagNames.map(() => '?').join(',');
    const rows = await env.DB.prepare(
      `SELECT DISTINCT u.line_user_id FROM users u
       JOIN user_tags ut ON u.id = ut.user_id
       JOIN tags t ON ut.tag_id = t.id
       WHERE t.name IN (${placeholders}) AND u.status = 'active' LIMIT 1000`
    ).bind(...tagNames).all();
    return (rows.results || []) as { line_user_id: string }[];
  }

  if (targetType === 'segment' && targetConfig) {
    const rows = await env.DB.prepare("SELECT line_user_id FROM users WHERE status = 'active' LIMIT 1000").all();
    return (rows.results || []) as { line_user_id: string }[];
  }

  return [];
}

// ─── Retry Processing ───

export async function processRetries(env: Env): Promise<{ processed: number; sent: number; failed: number }> {
  const retryable = await env.DB.prepare(
    "SELECT dl.*, ss.message_content FROM delivery_logs dl LEFT JOIN scenario_steps ss ON dl.scenario_step_id = ss.id WHERE dl.status = 'failed' AND dl.next_retry_at IS NOT NULL AND dl.next_retry_at <= datetime('now') AND dl.retry_count < dl.max_retries LIMIT 30"
  ).all();

  let sent = 0, failed = 0;
  for (const row of (retryable.results || []) as any[]) {
    const user = await env.DB.prepare('SELECT line_user_id FROM users WHERE id = ?').bind(row.user_id).first<{ line_user_id: string }>();
    if (!user) { failed++; continue; }

    const content = row.message_content || '';
    if (!content) { failed++; continue; }

    const newRetryCount = (row.retry_count || 0) + 1;

    try {
      await pushMessage(env, user.line_user_id, content);
      await env.DB.prepare(
        "UPDATE delivery_logs SET status = 'sent', sent_at = datetime('now'), retry_count = ?, next_retry_at = NULL, error_message = NULL WHERE id = ?"
      ).bind(newRetryCount, row.id).run();
      await env.DB.prepare(
        "INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, 'outbound', 'text', ?)"
      ).bind(crypto.randomUUID(), row.user_id, content).run();
      sent++;
    } catch (e) {
      const backoffMinutes = Math.pow(2, newRetryCount) * 5; // 10, 20, 40 min
      const nextRetry = newRetryCount < (row.max_retries || 3)
        ? new Date(Date.now() + backoffMinutes * 60000).toISOString()
        : null;

      await env.DB.prepare(
        "UPDATE delivery_logs SET retry_count = ?, error_message = ?, next_retry_at = ? WHERE id = ?"
      ).bind(newRetryCount, String(e), nextRetry, row.id).run();
      failed++;
    }
  }

  return { processed: (retryable.results || []).length, sent, failed };
}

// ─── LINE Push ───

async function pushMessage(env: Env, lineUserId: string, content: string): Promise<void> {
  let messages: unknown[];
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) {
      messages = parsed.slice(0, 5);
    } else {
      messages = [{ type: 'text', text: content }];
    }
  } catch {
    messages = [{ type: 'text', text: content }];
  }

  const maxRetries = 3;
  const baseBackoff = 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.LINE_CHANNEL_ACCESS_TOKEN },
      body: JSON.stringify({ to: lineUserId, messages }),
    });

    if (res.ok) return;

    if (res.status === 429 && attempt < maxRetries) {
      const retryAfter = res.headers.get('Retry-After');
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : baseBackoff * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, Math.min(waitMs, 30000)));
      continue;
    }

    if (res.status >= 500 && attempt < maxRetries) {
      await new Promise(r => setTimeout(r, baseBackoff * Math.pow(2, attempt)));
      continue;
    }

    const err = await res.text();
    throw new Error('Push failed: ' + res.status + ' ' + err);
  }
}
