/**
 * D1-based cache layer for dashboard acceleration.
 * Replaces KV when KV namespace permission is unavailable.
 * One D1 cache read is much faster than 8-14 parallel aggregation queries.
 */

export async function getCached<T>(db: D1Database, key: string): Promise<T | null> {
  try {
    const row = await db.prepare(
      "SELECT value FROM kv_cache WHERE key = ? AND expires_at > datetime('now')"
    ).bind(key).first<{ value: string }>();
    return row ? JSON.parse(row.value) : null;
  } catch {
    return null;
  }
}

export async function setCache(
  db: D1Database,
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  try {
    await db.prepare(
      `INSERT OR REPLACE INTO kv_cache (key, value, expires_at)
       VALUES (?, ?, datetime('now', '+${ttlSeconds} seconds'))`
    ).bind(key, JSON.stringify(value)).run();
  } catch {
    // fire-and-forget
  }
}

export async function invalidateCache(db: D1Database, pattern: string): Promise<void> {
  try {
    await db.prepare("DELETE FROM kv_cache WHERE key LIKE ?").bind(pattern).run();
  } catch {
    // fire-and-forget
  }
}

export async function cleanExpiredCache(db: D1Database): Promise<number> {
  try {
    const result = await db.prepare(
      "DELETE FROM kv_cache WHERE expires_at <= datetime('now')"
    ).run();
    return result.meta?.changes || 0;
  } catch {
    return 0;
  }
}

/**
 * Cache-through helper: get from cache or compute & store.
 */
export async function cached<T>(
  db: D1Database,
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>
): Promise<T> {
  const hit = await getCached<T>(db, key);
  if (hit !== null) return hit;

  const value = await compute();
  // Store in background (don't await)
  setCache(db, key, value, ttlSeconds);
  return value;
}
