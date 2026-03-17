import { Hono } from 'hono';
import { Env } from '../types';
import { testClaudeConnection } from '../lib/claude';
import { signJwt } from '../lib/jwt';
import { sendNotification } from '../lib/notify';

export const healthRoutes = new Hono<{ Bindings: Env }>();

// GET /monitor — Fast health check for UptimeRobot / external monitoring (no auth, no Claude call)
// Returns keyword "HEALTHY" or "UNHEALTHY" for keyword-type monitors, ~100-300ms
healthRoutes.get('/monitor', async (c) => {
  const start = Date.now();
  try {
    // Quick D1 connectivity check (single lightweight query)
    const result = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM sqlite_master WHERE type='table'"
    ).first<{ c: number }>();
    const tableCount = result?.c || 0;
    const ok = tableCount >= 42;
    const ms = Date.now() - start;

    // Store check result for history
    c.env.DB.prepare(
      `INSERT OR REPLACE INTO kv_cache (key, value, expires_at)
       VALUES ('monitor_last_check', ?, datetime('now', '+7 days'))`
    ).bind(JSON.stringify({
      status: ok ? 'healthy' : 'degraded',
      tables: tableCount,
      latency_ms: ms,
      timestamp: new Date().toISOString(),
    })).run().catch(() => {});

    c.header('Cache-Control', 'no-cache, no-store');
    return c.text(ok ? `HEALTHY | tables=${tableCount} | ${ms}ms` : `UNHEALTHY | tables=${tableCount} | ${ms}ms`, ok ? 200 : 503);
  } catch (e) {
    const ms = Date.now() - start;
    c.header('Cache-Control', 'no-cache, no-store');
    return c.text(`UNHEALTHY | error=${e instanceof Error ? e.message : String(e)} | ${ms}ms`, 503);
  }
});

// POST /check — Run deep health check + send alert if unhealthy (called by cron)
healthRoutes.post('/check', async (c) => {
  const start = Date.now();
  const checks: Record<string, any> = {};
  const failures: string[] = [];

  // 1. D1 tables
  try {
    const tableResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM sqlite_master WHERE type='table'"
    ).first<{ c: number }>();
    const count = tableResult?.c || 0;
    checks.d1 = { ok: count >= 42, tables: count };
    if (count < 42) failures.push(`D1: ${count}/42 tables`);
  } catch (e) {
    checks.d1 = { ok: false, error: String(e) };
    failures.push(`D1: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 2. D1 data (quick sanity: users table readable)
  try {
    const users = await c.env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>();
    checks.data = { ok: true, users: users?.c || 0 };
  } catch (e) {
    checks.data = { ok: false, error: String(e) };
    failures.push(`Data: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 3. Claude API (optional, skip if it adds too much latency for monitoring)
  try {
    const claudeResult = await testClaudeConnection(c.env);
    checks.claude = claudeResult;
    if (!claudeResult.ok) failures.push(`Claude: ${claudeResult.error || 'unreachable'}`);
  } catch (e) {
    checks.claude = { ok: false, error: String(e) };
    failures.push(`Claude: ${e instanceof Error ? e.message : String(e)}`);
  }

  const duration = Date.now() - start;
  const isHealthy = failures.length === 0;

  // Load previous status to detect state transitions
  let prevStatus = 'unknown';
  try {
    const prev = await c.env.DB.prepare(
      "SELECT value FROM kv_cache WHERE key = 'monitor_status'"
    ).first<{ value: string }>();
    if (prev) prevStatus = JSON.parse(prev.value).status;
  } catch {}

  const currentStatus = isHealthy ? 'healthy' : 'unhealthy';

  // Store current status
  try {
    await c.env.DB.prepare(
      `INSERT OR REPLACE INTO kv_cache (key, value, expires_at)
       VALUES ('monitor_status', ?, datetime('now', '+30 days'))`
    ).bind(JSON.stringify({
      status: currentStatus,
      failures,
      checks,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    })).run();
  } catch {}

  // Send alert on state transitions (healthy→unhealthy or unhealthy→healthy)
  let notified = false;
  if (currentStatus !== prevStatus && prevStatus !== 'unknown') {
    try {
      if (currentStatus === 'unhealthy') {
        await sendNotification(c.env, {
          title: 'Production Alert: Service UNHEALTHY',
          message: `LINE AI Marketing APIのヘルスチェックで異常を検出しました。\n\n障害内容:\n${failures.map(f => `- ${f}`).join('\n')}\n\nチェック時間: ${duration}ms`,
          priority: 'high',
        });
      } else {
        await sendNotification(c.env, {
          title: 'Production Recovery: Service HEALTHY',
          message: `LINE AI Marketing APIは正常に復旧しました。\n\nダウンタイムから回復。全チェック正常。\nチェック時間: ${duration}ms`,
          priority: 'normal',
        });
      }
      notified = true;
    } catch (e) {
      console.error('Monitor notification failed:', e);
    }
  }

  return c.json({
    status: currentStatus,
    version: '0.8.0',
    timestamp: new Date().toISOString(),
    duration_ms: duration,
    failures: failures.length > 0 ? failures : undefined,
    checks,
    alert: notified ? (currentStatus === 'unhealthy' ? 'alert_sent' : 'recovery_sent') : 'no_change',
    previous_status: prevStatus,
  }, isHealthy ? 200 : 503);
});

// POST /e2e-token — Issue JWT for E2E testing (validates Cloudflare account ownership)
healthRoutes.post('/e2e-token', async (c) => {
  const { cf_api_token } = await c.req.json<{ cf_api_token: string }>();
  if (!cf_api_token) {
    return c.json({ success: false, error: 'cf_api_token required' }, 400);
  }
  // Verify the token is valid by calling Cloudflare API
  const cfRes = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
    headers: { Authorization: `Bearer ${cf_api_token}` },
  });
  const cfData = (await cfRes.json()) as any;
  if (!cfData.success || cfData.result?.status !== 'active') {
    return c.json({ success: false, error: 'Invalid Cloudflare API token' }, 403);
  }
  // Find admin user
  const admin = await c.env.DB.prepare(
    "SELECT id, display_name FROM users WHERE role = 'admin' LIMIT 1"
  ).first<{ id: string; display_name: string | null }>();
  if (!admin) {
    return c.json({ success: false, error: 'No admin user found' }, 404);
  }
  const token = await signJwt({ sub: admin.id, displayName: admin.display_name || 'admin' }, c.env.JWT_SECRET);
  return c.json({ success: true, token, user_id: admin.id, expires_in: '7d' });
});

const EXPECTED_TABLES = [
  'users', 'tags', 'user_tags', 'scenarios', 'scenario_steps', 'messages',
  'knowledge_base', 'delivery_logs', 'user_attributes', 'ai_chat_logs',
  'escalations', 'surveys', 'survey_questions', 'survey_responses',
  'scheduled_deliveries', 'auto_response_rules', 'ab_tests', 'ab_test_variations',
  'settings', 'ai_classifications', 'message_templates', 'conversion_goals',
  'conversions', 'engagement_scores', 'delivery_queues', 'delivery_queue_items',
  'follow_sources', 'follow_events', 'chat_read_status', 'dashboard_widgets',
  'api_request_logs', 'notifications', 'rate_limit_logs', 'kv_cache',
  'webhook_events', 'line_accounts', 'user_account_access', 'security_audit_logs',
  'ip_rules', 'richmenu_rules', 'score_auto_actions', 'score_action_logs',
];

healthRoutes.get('/deep', async (c) => {
  const start = Date.now();
  const checks: Record<string, any> = {};

  // 1. D1 table verification
  try {
    const tableResult = await c.env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all();
    const actual = (tableResult.results || []).map((r: any) => r.name as string);
    const missing = EXPECTED_TABLES.filter(t => !actual.includes(t));
    const extra = actual.filter(t => !EXPECTED_TABLES.includes(t) && !t.startsWith('_cf') && !t.startsWith('sqlite_'));
    checks.d1 = { ok: missing.length === 0, tables: actual.length, expected: EXPECTED_TABLES.length, missing, extra };
  } catch (e) {
    checks.d1 = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // 2. D1 data summary (parallel queries)
  try {
    const counts = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as c FROM messages').first<{ c: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as c FROM knowledge_base').first<{ c: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as c FROM tags').first<{ c: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as c FROM scenarios').first<{ c: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as c FROM message_templates').first<{ c: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as c FROM ai_chat_logs').first<{ c: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as c FROM auto_response_rules').first<{ c: number }>(),
    ]);
    checks.data = {
      users: counts[0]?.c || 0,
      messages: counts[1]?.c || 0,
      knowledge_base: counts[2]?.c || 0,
      tags: counts[3]?.c || 0,
      scenarios: counts[4]?.c || 0,
      templates: counts[5]?.c || 0,
      ai_chat_logs: counts[6]?.c || 0,
      auto_response_rules: counts[7]?.c || 0,
    };
  } catch (e) {
    checks.data = { error: e instanceof Error ? e.message : String(e) };
  }

  // 3. Claude API connectivity
  checks.claude = await testClaudeConnection(c.env);

  // 4. Environment config
  checks.config = {
    environment: c.env.ENVIRONMENT || 'unknown',
    anthropic_resource: c.env.ANTHROPIC_RESOURCE ? 'configured' : 'NOT SET',
    anthropic_key: c.env.ANTHROPIC_API_KEY ? 'configured' : 'NOT SET',
    jwt_secret: c.env.JWT_SECRET ? 'configured' : 'NOT SET',
    line_channel_secret: c.env.LINE_CHANNEL_SECRET ? 'configured' : 'NOT SET',
    line_channel_token: c.env.LINE_CHANNEL_ACCESS_TOKEN ? 'configured' : 'NOT SET',
    frontend_url: c.env.FRONTEND_URL || 'not set',
  };

  const allOk = checks.d1?.ok && checks.claude?.ok;
  return c.json({
    status: allOk ? 'healthy' : 'degraded',
    version: '0.8.0',
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - start,
    checks,
  }, allOk ? 200 : 503);
});
