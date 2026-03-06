import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { sendWithRateLimit } from '../lib/rate-limiter';

type AuthVars = { userId: string };
export const deliveryQueueRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
deliveryQueueRoutes.use('*', authMiddleware);

// ─── GET / — キュー一覧 ───
deliveryQueueRoutes.get('/', async (c) => {
  try {
    const status = c.req.query('status');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;

    let where = '';
    const binds: any[] = [];
    if (status) {
      where = 'WHERE status = ?';
      binds.push(status);
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM delivery_queues ${where}`
    ).bind(...binds).first<{ total: number }>();

    const rows = await c.env.DB.prepare(
      `SELECT * FROM delivery_queues ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...binds, limit, offset).all();

    return c.json({
      success: true,
      data: rows.results || [],
      pagination: {
        page,
        limit,
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / limit),
      },
    });
  } catch (err) {
    console.error('List queues error:', err);
    return c.json({ success: false, error: 'キュー一覧の取得に失敗しました' }, 500);
  }
});

// ─── POST / — キュー作成 ───
deliveryQueueRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json<{
      name: string;
      message_content: string;
      message_type?: string;
      target_type: string;
      target_config?: string;
      batch_size?: number;
      throttle_ms?: number;
    }>();

    if (!body.name) return c.json({ success: false, error: 'name is required' }, 400);
    if (!body.message_content) return c.json({ success: false, error: 'message_content is required' }, 400);
    if (!body.target_type) return c.json({ success: false, error: 'target_type is required' }, 400);

    const validTargets = ['all', 'tag', 'segment'];
    if (!validTargets.includes(body.target_type)) {
      return c.json({ success: false, error: `target_type must be one of: ${validTargets.join(', ')}` }, 400);
    }

    const batchSize = Math.min(Math.max(body.batch_size || 50, 1), 200);
    const throttleMs = Math.min(Math.max(body.throttle_ms || 200, 50), 5000);

    // Resolve target users
    const users = await resolveUsers(c.env, body.target_type, body.target_config || null);

    if (users.length === 0) {
      return c.json({ success: false, error: '対象ユーザーが0件です' }, 400);
    }

    const queueId = crypto.randomUUID();

    // Create queue
    await c.env.DB.prepare(
      `INSERT INTO delivery_queues (id, name, message_content, message_type, target_type, target_config, total_count, batch_size, throttle_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      queueId,
      body.name,
      body.message_content,
      body.message_type || 'text',
      body.target_type,
      body.target_config || null,
      users.length,
      batchSize,
      throttleMs
    ).run();

    // Create queue items
    for (const user of users) {
      await c.env.DB.prepare(
        'INSERT INTO delivery_queue_items (id, queue_id, user_id, line_user_id) VALUES (?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), queueId, user.id, user.line_user_id).run();
    }

    const queue = await c.env.DB.prepare('SELECT * FROM delivery_queues WHERE id = ?').bind(queueId).first();
    return c.json({ success: true, data: queue }, 201);
  } catch (err) {
    console.error('Create queue error:', err);
    return c.json({ success: false, error: 'キューの作成に失敗しました' }, 500);
  }
});

// ─── GET /:id — キュー詳細 ───
deliveryQueueRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const queue = await c.env.DB.prepare('SELECT * FROM delivery_queues WHERE id = ?').bind(id).first();
    if (!queue) return c.json({ success: false, error: 'Not found' }, 404);

    // Item status summary
    const itemStats = await c.env.DB.prepare(
      `SELECT status, COUNT(*) as count FROM delivery_queue_items WHERE queue_id = ? GROUP BY status`
    ).bind(id).all();

    // Recent failures
    const failures = await c.env.DB.prepare(
      `SELECT qi.*, u.display_name
       FROM delivery_queue_items qi
       LEFT JOIN users u ON qi.user_id = u.id
       WHERE qi.queue_id = ? AND qi.status = 'failed'
       ORDER BY qi.sent_at DESC LIMIT 20`
    ).bind(id).all();

    return c.json({
      success: true,
      data: {
        ...queue,
        item_stats: itemStats.results || [],
        recent_failures: failures.results || [],
      },
    });
  } catch (err) {
    console.error('Get queue error:', err);
    return c.json({ success: false, error: 'キュー詳細の取得に失敗しました' }, 500);
  }
});

// ─── GET /:id/progress — 進捗取得 ───
deliveryQueueRoutes.get('/:id/progress', async (c) => {
  try {
    const id = c.req.param('id');
    const queue = await c.env.DB.prepare(
      'SELECT id, status, total_count, sent_count, failed_count, started_at, completed_at FROM delivery_queues WHERE id = ?'
    ).bind(id).first();
    if (!queue) return c.json({ success: false, error: 'Not found' }, 404);

    const q = queue as any;
    const processed = q.sent_count + q.failed_count;
    const progress = q.total_count > 0 ? Math.round((processed / q.total_count) * 1000) / 10 : 0;

    return c.json({
      success: true,
      data: {
        status: q.status,
        total: q.total_count,
        sent: q.sent_count,
        failed: q.failed_count,
        remaining: q.total_count - processed,
        progress,
        started_at: q.started_at,
        completed_at: q.completed_at,
      },
    });
  } catch (err) {
    console.error('Progress error:', err);
    return c.json({ success: false, error: '進捗の取得に失敗しました' }, 500);
  }
});

// ─── POST /:id/start — 配信開始 (バッチ処理) ───
deliveryQueueRoutes.post('/:id/start', async (c) => {
  try {
    const id = c.req.param('id');
    const queue = await c.env.DB.prepare('SELECT * FROM delivery_queues WHERE id = ?').bind(id).first() as any;
    if (!queue) return c.json({ success: false, error: 'Not found' }, 404);

    if (queue.status !== 'pending' && queue.status !== 'paused') {
      return c.json({ success: false, error: `現在の状態(${queue.status})では開始できません` }, 400);
    }

    // Mark as processing
    await c.env.DB.prepare(
      "UPDATE delivery_queues SET status = 'processing', started_at = COALESCE(started_at, datetime('now')) WHERE id = ?"
    ).bind(id).run();

    // Process in batches
    const batchSize = queue.batch_size || 50;
    const throttleMs = queue.throttle_ms || 200;
    let totalSent = queue.sent_count || 0;
    let totalFailed = queue.failed_count || 0;

    while (true) {
      // Check if cancelled/paused
      const current = await c.env.DB.prepare('SELECT status FROM delivery_queues WHERE id = ?').bind(id).first<{ status: string }>();
      if (!current || current.status === 'cancelled' || current.status === 'paused') break;

      // Get next batch
      const batch = await c.env.DB.prepare(
        `SELECT * FROM delivery_queue_items WHERE queue_id = ? AND status = 'pending' LIMIT ?`
      ).bind(id, batchSize).all();

      if (!batch.results || batch.results.length === 0) break;

      for (const item of batch.results as any[]) {
        // Re-check cancel status every item
        const check = await c.env.DB.prepare('SELECT status FROM delivery_queues WHERE id = ?').bind(id).first<{ status: string }>();
        if (!check || check.status === 'cancelled' || check.status === 'paused') break;

        try {
          // Push message via LINE API with rate limit handling
          const result = await sendWithRateLimit(
            c.env,
            item.line_user_id,
            [{ type: queue.message_type || 'text', text: queue.message_content }]
          );

          if (!result.success) {
            throw new Error(result.error || `LINE API ${result.statusCode}`);
          }

          // Mark item as sent
          await c.env.DB.prepare(
            "UPDATE delivery_queue_items SET status = 'sent', sent_at = datetime('now') WHERE id = ?"
          ).bind(item.id).run();

          // Record in delivery_logs + messages
          await c.env.DB.prepare(
            "INSERT INTO delivery_logs (id, user_id, status, sent_at) VALUES (?, ?, 'sent', datetime('now'))"
          ).bind(crypto.randomUUID(), item.user_id).run();
          await c.env.DB.prepare(
            "INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, 'outbound', 'text', ?)"
          ).bind(crypto.randomUUID(), item.user_id, queue.message_content).run();

          totalSent++;
        } catch (e) {
          await c.env.DB.prepare(
            "UPDATE delivery_queue_items SET status = 'failed', error_message = ?, sent_at = datetime('now') WHERE id = ?"
          ).bind(String(e), item.id).run();

          await c.env.DB.prepare(
            "INSERT INTO delivery_logs (id, user_id, status, error_message) VALUES (?, ?, 'failed', ?)"
          ).bind(crypto.randomUUID(), item.user_id, String(e)).run();

          totalFailed++;
        }

        // Throttle between messages
        if (throttleMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, throttleMs));
        }
      }

      // Update progress after each batch
      await c.env.DB.prepare(
        'UPDATE delivery_queues SET sent_count = ?, failed_count = ? WHERE id = ?'
      ).bind(totalSent, totalFailed, id).run();
    }

    // Final status update
    const finalCheck = await c.env.DB.prepare('SELECT status FROM delivery_queues WHERE id = ?').bind(id).first<{ status: string }>();
    if (finalCheck?.status === 'processing') {
      // Check if all items processed
      const remaining = await c.env.DB.prepare(
        "SELECT COUNT(*) as c FROM delivery_queue_items WHERE queue_id = ? AND status = 'pending'"
      ).bind(id).first<{ c: number }>();

      const newStatus = (remaining?.c || 0) === 0 ? 'completed' : 'paused';
      await c.env.DB.prepare(
        `UPDATE delivery_queues SET status = ?, sent_count = ?, failed_count = ?, completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE completed_at END WHERE id = ?`
      ).bind(newStatus, totalSent, totalFailed, newStatus, id).run();
    }

    const updated = await c.env.DB.prepare('SELECT * FROM delivery_queues WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: updated });
  } catch (err) {
    console.error('Start queue error:', err);
    return c.json({ success: false, error: '配信開始に失敗しました' }, 500);
  }
});

// ─── POST /:id/pause — 一時停止 ───
deliveryQueueRoutes.post('/:id/pause', async (c) => {
  try {
    const id = c.req.param('id');
    const queue = await c.env.DB.prepare('SELECT status FROM delivery_queues WHERE id = ?').bind(id).first<{ status: string }>();
    if (!queue) return c.json({ success: false, error: 'Not found' }, 404);
    if (queue.status !== 'processing') {
      return c.json({ success: false, error: '処理中のキューのみ一時停止できます' }, 400);
    }

    await c.env.DB.prepare("UPDATE delivery_queues SET status = 'paused' WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('Pause error:', err);
    return c.json({ success: false, error: '一時停止に失敗しました' }, 500);
  }
});

// ─── POST /:id/cancel — キャンセル ───
deliveryQueueRoutes.post('/:id/cancel', async (c) => {
  try {
    const id = c.req.param('id');
    const queue = await c.env.DB.prepare('SELECT status FROM delivery_queues WHERE id = ?').bind(id).first<{ status: string }>();
    if (!queue) return c.json({ success: false, error: 'Not found' }, 404);
    if (queue.status === 'completed' || queue.status === 'cancelled') {
      return c.json({ success: false, error: `${queue.status}のキューはキャンセルできません` }, 400);
    }

    await c.env.DB.prepare(
      "UPDATE delivery_queues SET status = 'cancelled', cancelled_at = datetime('now') WHERE id = ?"
    ).bind(id).run();

    // Cancel remaining items
    await c.env.DB.prepare(
      "UPDATE delivery_queue_items SET status = 'cancelled' WHERE queue_id = ? AND status = 'pending'"
    ).bind(id).run();

    return c.json({ success: true });
  } catch (err) {
    console.error('Cancel error:', err);
    return c.json({ success: false, error: 'キャンセルに失敗しました' }, 500);
  }
});

// ─── DELETE /:id — キュー削除 ───
deliveryQueueRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const queue = await c.env.DB.prepare('SELECT status FROM delivery_queues WHERE id = ?').bind(id).first<{ status: string }>();
    if (!queue) return c.json({ success: false, error: 'Not found' }, 404);
    if (queue.status === 'processing') {
      return c.json({ success: false, error: '処理中のキューは削除できません。先にキャンセルしてください' }, 400);
    }

    await c.env.DB.prepare('DELETE FROM delivery_queue_items WHERE queue_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM delivery_queues WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('Delete queue error:', err);
    return c.json({ success: false, error: '削除に失敗しました' }, 500);
  }
});

// ─── Helper: Resolve target users ───
async function resolveUsers(env: Env, targetType: string, targetConfig: string | null): Promise<{ id: string; line_user_id: string }[]> {
  if (targetType === 'all') {
    const rows = await env.DB.prepare(
      "SELECT id, line_user_id FROM users WHERE status = 'active' AND line_user_id IS NOT NULL LIMIT 5000"
    ).all();
    return (rows.results || []) as { id: string; line_user_id: string }[];
  }

  if (targetType === 'tag' && targetConfig) {
    const tagNames = targetConfig.split(',').map((t) => t.trim()).filter(Boolean);
    if (tagNames.length === 0) return [];
    const placeholders = tagNames.map(() => '?').join(',');
    const rows = await env.DB.prepare(
      `SELECT DISTINCT u.id, u.line_user_id FROM users u
       JOIN user_tags ut ON u.id = ut.user_id
       JOIN tags t ON ut.tag_id = t.id
       WHERE t.name IN (${placeholders}) AND u.status = 'active' AND u.line_user_id IS NOT NULL LIMIT 5000`
    ).bind(...tagNames).all();
    return (rows.results || []) as { id: string; line_user_id: string }[];
  }

  if (targetType === 'segment' && targetConfig) {
    const rows = await env.DB.prepare(
      "SELECT id, line_user_id FROM users WHERE status = 'active' AND line_user_id IS NOT NULL LIMIT 5000"
    ).all();
    return (rows.results || []) as { id: string; line_user_id: string }[];
  }

  return [];
}
