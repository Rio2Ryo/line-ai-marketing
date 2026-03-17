import { Hono } from 'hono';
import { Env } from '../types';
import { testClaudeConnection } from '../lib/claude';
import { signJwt } from '../lib/jwt';

export const healthRoutes = new Hono<{ Bindings: Env }>();

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
