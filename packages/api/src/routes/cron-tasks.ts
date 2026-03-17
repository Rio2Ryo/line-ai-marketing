import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware, roleMiddleware } from '../middleware/auth';
import { processScheduledDeliveries, processScheduledDeliveryJobs, processRetries } from '../lib/scenario-engine';
import { cleanExpiredCache } from '../lib/cache';

type AuthVars = { userId: string; userRole: string };
export const cronTaskRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
cronTaskRoutes.use('*', authMiddleware);

// POST /run — HTTP-triggered scheduled task runner (replaces Cron Trigger)
// Admin only. Can be called manually from dashboard or by external cron service.
cronTaskRoutes.post('/run', roleMiddleware('admin'), async (c) => {
  const startTime = Date.now();
  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  // Run all scheduled tasks in parallel
  const [scenarioResult, deliveryResult, retryResult, cacheResult] = await Promise.allSettled([
    processScheduledDeliveries(c.env),
    processScheduledDeliveryJobs(c.env),
    processRetries(c.env),
    cleanExpiredCache(c.env.DB),
  ]);

  if (scenarioResult.status === 'fulfilled') {
    results.scenarioDeliveries = scenarioResult.value;
  } else {
    errors.push(`scenarioDeliveries: ${scenarioResult.reason}`);
  }

  if (deliveryResult.status === 'fulfilled') {
    results.scheduledDeliveries = deliveryResult.value;
  } else {
    errors.push(`scheduledDeliveries: ${deliveryResult.reason}`);
  }

  if (retryResult.status === 'fulfilled') {
    results.retries = retryResult.value;
  } else {
    errors.push(`retries: ${retryResult.reason}`);
  }

  if (cacheResult.status === 'fulfilled') {
    results.cacheCleanup = { removedEntries: cacheResult.value };
  } else {
    errors.push(`cacheCleanup: ${cacheResult.reason}`);
  }

  const duration = Date.now() - startTime;

  // Log the run result to D1
  try {
    await c.env.DB.prepare(
      `INSERT OR REPLACE INTO kv_cache (key, value, expires_at)
       VALUES ('cron_last_run', ?, datetime('now', '+30 days'))`
    ).bind(JSON.stringify({
      timestamp: new Date().toISOString(),
      duration,
      results,
      errors,
      triggeredBy: c.get('userId'),
    })).run();
  } catch { /* fire-and-forget */ }

  return c.json({
    success: true,
    data: {
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      results,
      errors: errors.length > 0 ? errors : undefined,
    },
  });
});

// POST /run/task — Run a specific task only
cronTaskRoutes.post('/run/:task', roleMiddleware('admin'), async (c) => {
  const task = c.req.param('task');
  const startTime = Date.now();

  try {
    let result: unknown;

    switch (task) {
      case 'scenario-deliveries':
        result = await processScheduledDeliveries(c.env);
        break;
      case 'scheduled-deliveries':
        result = await processScheduledDeliveryJobs(c.env);
        break;
      case 'retries':
        result = await processRetries(c.env);
        break;
      case 'cache-cleanup':
        result = { removedEntries: await cleanExpiredCache(c.env.DB) };
        break;
      case 'health-check': {
        // Run deep health check + alert on state change
        const apiBase = 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';
        const hcRes = await fetch(`${apiBase}/health/check`, { method: 'POST' });
        result = await hcRes.json();
        break;
      }
      default:
        return c.json({ success: false, error: `Unknown task: ${task}. Available: scenario-deliveries, scheduled-deliveries, retries, cache-cleanup, health-check` }, 400);
    }

    const duration = Date.now() - startTime;
    return c.json({
      success: true,
      data: {
        task,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        result,
      },
    });
  } catch (err) {
    return c.json({ success: false, error: `Task ${task} failed: ${err}` }, 500);
  }
});

// GET /status — Last run status and pending items count
cronTaskRoutes.get('/status', roleMiddleware('admin'), async (c) => {
  try {
    // Get last run info from cache
    const lastRun = await c.env.DB.prepare(
      "SELECT value FROM kv_cache WHERE key = 'cron_last_run'"
    ).first<{ value: string }>();

    // Count pending items
    const [pendingScenario, pendingDelivery, pendingRetry, cacheSize] = await Promise.all([
      c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM delivery_logs WHERE status = 'pending' AND scheduled_at <= datetime('now')"
      ).first<{ count: number }>(),
      c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM scheduled_deliveries WHERE status = 'pending' AND scheduled_at <= datetime('now')"
      ).first<{ count: number }>(),
      c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM delivery_logs WHERE status = 'failed' AND next_retry_at IS NOT NULL AND next_retry_at <= datetime('now') AND retry_count < max_retries"
      ).first<{ count: number }>(),
      c.env.DB.prepare(
        "SELECT COUNT(*) as total, SUM(CASE WHEN expires_at <= datetime('now') THEN 1 ELSE 0 END) as expired FROM kv_cache"
      ).first<{ total: number; expired: number }>(),
    ]);

    return c.json({
      success: true,
      data: {
        lastRun: lastRun ? JSON.parse(lastRun.value) : null,
        pending: {
          scenarioDeliveries: pendingScenario?.count || 0,
          scheduledDeliveries: pendingDelivery?.count || 0,
          retries: pendingRetry?.count || 0,
          expiredCache: cacheSize?.expired || 0,
          totalCache: cacheSize?.total || 0,
        },
      },
    });
  } catch (err) {
    console.error('Cron status error:', err);
    return c.json({ success: false, error: 'Failed to fetch cron status' }, 500);
  }
});

// GET /token — Generate a one-time token for external cron service
cronTaskRoutes.get('/webhook-url', roleMiddleware('admin'), async (c) => {
  // Return the endpoint info for external cron setup
  const apiUrl = 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';
  return c.json({
    success: true,
    data: {
      endpoints: {
        runAll: `POST ${apiUrl}/api/cron-tasks/run`,
        runSpecific: `POST ${apiUrl}/api/cron-tasks/run/{task}`,
        status: `GET ${apiUrl}/api/cron-tasks/status`,
      },
      tasks: ['scenario-deliveries', 'scheduled-deliveries', 'retries', 'cache-cleanup', 'health-check'],
      note: 'All endpoints require Authorization: Bearer <jwt_token> header with admin role.',
      recommendedInterval: '5 minutes (*/5 * * * *)',
      externalCronServices: [
        { name: 'cron-job.org', url: 'https://cron-job.org', free: true },
        { name: 'EasyCron', url: 'https://www.easycron.com', free: true },
        { name: 'UptimeRobot', url: 'https://uptimerobot.com', free: true },
      ],
    },
  });
});
