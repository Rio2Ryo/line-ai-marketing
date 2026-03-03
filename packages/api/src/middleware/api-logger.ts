import { Context, Next } from 'hono';
import { Env } from '../types';

export async function apiLoggerMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
): Promise<Response | void> {
  const start = Date.now();
  const method = c.req.method;
  const url = new URL(c.req.url);
  const path = url.pathname;

  // Skip logging for health check, OPTIONS, and the monitor endpoint itself (to avoid infinite loops)
  if (path === '/health' || method === 'OPTIONS' || path.startsWith('/api/api-monitor')) {
    await next();
    return;
  }

  let statusCode = 200;
  let errorMessage: string | null = null;

  try {
    await next();
    statusCode = c.res.status;
  } catch (err) {
    statusCode = 500;
    errorMessage = String(err);
    throw err;
  } finally {
    const responseTime = Date.now() - start;
    const userId = ((c as any).get('userId') as string) || null;
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null;
    const ua = c.req.header('user-agent') || null;

    // Normalize path: remove UUIDs and IDs for aggregation
    const normalizedPath = path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '/:id');

    // Fire-and-forget: don't block response
    try {
      c.executionCtx.waitUntil(
        c.env.DB.prepare(
          "INSERT INTO api_request_logs (id, method, path, status_code, response_time_ms, user_id, ip_address, user_agent, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          crypto.randomUUID(),
          method,
          normalizedPath,
          statusCode,
          responseTime,
          userId,
          ip,
          ua ? ua.substring(0, 200) : null,
          errorMessage
        ).run()
      );
    } catch {
      // Silently fail - logging should never break the app
    }
  }
}
