import { Env } from '../types';

/**
 * LINE API Rate Limiter
 *
 * LINE Messaging API limits:
 * - Push: 60,000 requests/min (paid), varies by plan
 * - Reply: no rate limit (but per-event)
 *
 * Strategy:
 * - 429 detection with exponential backoff + auto-retry (up to 3 attempts)
 * - Per-minute request counting in D1 for monitoring
 * - Configurable concurrency limit for batch operations
 */

export interface RateLimitResult {
  success: boolean;
  statusCode: number;
  retryCount: number;
  rateLimited: boolean;
  error?: string;
}

export interface RateLimitStats {
  current_minute_count: number;
  total_24h: number;
  rate_limited_24h: number;
  last_rate_limit_at: string | null;
  avg_per_minute_1h: number;
}

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000; // 1s, 2s, 4s

/**
 * Send a LINE push message with rate limit handling.
 * Detects 429 responses and applies exponential backoff with retry.
 * Logs rate limit events to D1 for monitoring.
 */
export async function sendWithRateLimit(
  env: Env,
  to: string,
  messages: unknown[],
  opts?: { maxRetries?: number; skipLog?: boolean }
): Promise<RateLimitResult> {
  const maxRetries = opts?.maxRetries ?? MAX_RETRIES;
  let lastError = '';
  let rateLimited = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({ to, messages }),
      });

      // Success
      if (res.ok) {
        // Log successful push (fire-and-forget)
        if (!opts?.skipLog) {
          logPushEvent(env, 'success', res.status).catch(() => {});
        }
        return { success: true, statusCode: res.status, retryCount: attempt, rateLimited };
      }

      // Rate limited — 429
      if (res.status === 429) {
        rateLimited = true;
        const retryAfter = res.headers.get('Retry-After');
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : BASE_BACKOFF_MS * Math.pow(2, attempt);

        // Log rate limit event
        logPushEvent(env, 'rate_limited', 429).catch(() => {});

        if (attempt < maxRetries) {
          await sleep(Math.min(waitMs, 30000)); // Cap at 30s
          continue;
        }

        lastError = `Rate limited (429) after ${attempt + 1} attempts`;
        return { success: false, statusCode: 429, retryCount: attempt, rateLimited: true, error: lastError };
      }

      // Other errors
      const errBody = await res.text();
      lastError = `LINE API ${res.status}: ${errBody}`;

      // Server errors (500, 502, 503) — retry with backoff
      if (res.status >= 500 && attempt < maxRetries) {
        logPushEvent(env, 'server_error', res.status).catch(() => {});
        await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt));
        continue;
      }

      // Client errors (400, 401, 403, 404) — don't retry
      if (!opts?.skipLog) {
        logPushEvent(env, 'client_error', res.status).catch(() => {});
      }
      return { success: false, statusCode: res.status, retryCount: attempt, rateLimited, error: lastError };

    } catch (e) {
      lastError = String(e);
      // Network errors — retry with backoff
      if (attempt < maxRetries) {
        await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt));
        continue;
      }
    }
  }

  return { success: false, statusCode: 0, retryCount: maxRetries, rateLimited, error: lastError };
}

/**
 * Batch send with rate-aware throttling.
 * Enforces a delay between messages to stay within rate limits.
 * Pauses on 429 and resumes after backoff.
 */
export async function batchSendWithRateLimit(
  env: Env,
  items: { to: string; messages: unknown[] }[],
  opts?: { throttleMs?: number; onProgress?: (sent: number, failed: number, total: number) => void }
): Promise<{ sent: number; failed: number; rateLimited: number; errors: { to: string; error: string }[] }> {
  const throttleMs = opts?.throttleMs ?? 100; // ~600/min default = safe margin
  let sent = 0, failed = 0, rateLimitedCount = 0;
  const errors: { to: string; error: string }[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const result = await sendWithRateLimit(env, item.to, item.messages, { skipLog: true });

    if (result.success) {
      sent++;
    } else {
      failed++;
      if (result.rateLimited) rateLimitedCount++;
      errors.push({ to: item.to, error: result.error || 'Unknown error' });

      // If rate limited, increase throttle for remaining items
      if (result.rateLimited && i < items.length - 1) {
        await sleep(5000); // Extra 5s pause after rate limit
      }
    }

    opts?.onProgress?.(sent, failed, items.length);

    // Throttle between sends
    if (i < items.length - 1 && throttleMs > 0) {
      await sleep(throttleMs);
    }
  }

  // Log batch summary
  logBatchEvent(env, items.length, sent, failed, rateLimitedCount).catch(() => {});

  return { sent, failed, rateLimited: rateLimitedCount, errors };
}

/**
 * Get current rate limit stats from D1
 */
export async function getRateLimitStats(env: Env): Promise<RateLimitStats> {
  const [minuteCount, total24h, rateLimited24h, lastRateLimit, hourlyAvg] = await Promise.all([
    env.DB.prepare(
      "SELECT COUNT(*) as c FROM rate_limit_logs WHERE created_at >= datetime('now', '-1 minute')"
    ).first<{ c: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) as c FROM rate_limit_logs WHERE created_at >= datetime('now', '-24 hours')"
    ).first<{ c: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) as c FROM rate_limit_logs WHERE event_type = 'rate_limited' AND created_at >= datetime('now', '-24 hours')"
    ).first<{ c: number }>(),
    env.DB.prepare(
      "SELECT created_at FROM rate_limit_logs WHERE event_type = 'rate_limited' ORDER BY created_at DESC LIMIT 1"
    ).first<{ created_at: string }>(),
    env.DB.prepare(
      "SELECT COUNT(*) / 60.0 as avg FROM rate_limit_logs WHERE created_at >= datetime('now', '-1 hour')"
    ).first<{ avg: number }>(),
  ]);

  return {
    current_minute_count: minuteCount?.c || 0,
    total_24h: total24h?.c || 0,
    rate_limited_24h: rateLimited24h?.c || 0,
    last_rate_limit_at: lastRateLimit?.created_at || null,
    avg_per_minute_1h: Math.round((hourlyAvg?.avg || 0) * 10) / 10,
  };
}

// ─── Internal helpers ───

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function logPushEvent(env: Env, eventType: string, statusCode: number): Promise<void> {
  try {
    await env.DB.prepare(
      "INSERT INTO rate_limit_logs (id, event_type, status_code, created_at) VALUES (?, ?, ?, datetime('now'))"
    ).bind(crypto.randomUUID(), eventType, statusCode).run();
  } catch {
    // Fire-and-forget; don't block the main flow
  }
}

async function logBatchEvent(env: Env, total: number, sent: number, failed: number, rateLimited: number): Promise<void> {
  try {
    await env.DB.prepare(
      "INSERT INTO rate_limit_logs (id, event_type, status_code, metadata, created_at) VALUES (?, 'batch_complete', 200, ?, datetime('now'))"
    ).bind(crypto.randomUUID(), JSON.stringify({ total, sent, failed, rateLimited })).run();
  } catch {}
}
