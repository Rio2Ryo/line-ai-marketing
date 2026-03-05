import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { sendTestNotification } from '../lib/notify';

type AuthVars = { userId: string };
export const notificationRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
notificationRoutes.use('*', authMiddleware);

// ─── Types ───

export type NotificationType =
  | 'new_follower'     // 新規友だち追加
  | 'message_received' // メッセージ受信
  | 'escalation'       // エスカレーション発生
  | 'delivery_complete' // 配信完了
  | 'delivery_failed'  // 配信失敗
  | 'system';          // システム通知

// ─── Helper: Insert notification (used from webhook) ───

export async function createNotification(
  db: D1Database,
  opts: {
    type: NotificationType;
    title: string;
    body?: string;
    icon?: string;
    link?: string;
    source_user_id?: string;
  }
): Promise<void> {
  await db.prepare(
    "INSERT INTO notifications (id, type, title, body, icon, link, source_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    crypto.randomUUID(),
    opts.type,
    opts.title,
    opts.body || null,
    opts.icon || null,
    opts.link || null,
    opts.source_user_id || null,
  ).run();
}

// ─── GET / — 通知一覧 ───

notificationRoutes.get('/', async (c) => {
  try {
    const page = Number(c.req.query('page') || '1');
    const limit = Math.min(Number(c.req.query('limit') || '30'), 100);
    const offset = (page - 1) * limit;
    const unreadOnly = c.req.query('unread') === '1';

    const whereClause = unreadOnly ? 'WHERE is_read = 0' : '';

    const countRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM notifications ${whereClause}`
    ).first<{ total: number }>();
    const total = countRow?.total || 0;

    const rows = await c.env.DB.prepare(
      `SELECT n.*, u.display_name as source_display_name, u.picture_url as source_picture_url
       FROM notifications n
       LEFT JOIN users u ON n.source_user_id = u.id
       ${whereClause}
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();

    return c.json({
      success: true,
      data: rows.results || [],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Notifications list error:', err);
    return c.json({ success: false, error: 'Failed to fetch notifications' }, 500);
  }
});

// ─── GET /unread-count — 未読件数 ───

notificationRoutes.get('/unread-count', async (c) => {
  try {
    const row = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE is_read = 0'
    ).first<{ count: number }>();
    return c.json({ success: true, data: { count: row?.count || 0 } });
  } catch (err) {
    console.error('Unread count error:', err);
    return c.json({ success: false, error: 'Failed to get unread count' }, 500);
  }
});

// ─── GET /poll — ポーリング (since timestamp) ───

notificationRoutes.get('/poll', async (c) => {
  try {
    const since = c.req.query('since') || new Date(Date.now() - 30000).toISOString();

    const rows = await c.env.DB.prepare(
      `SELECT n.*, u.display_name as source_display_name, u.picture_url as source_picture_url
       FROM notifications n
       LEFT JOIN users u ON n.source_user_id = u.id
       WHERE n.created_at > ?
       ORDER BY n.created_at DESC
       LIMIT 50`
    ).bind(since).all();

    const unreadRow = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE is_read = 0'
    ).first<{ count: number }>();

    return c.json({
      success: true,
      data: {
        notifications: rows.results || [],
        unread_count: unreadRow?.count || 0,
      },
    });
  } catch (err) {
    console.error('Poll error:', err);
    return c.json({ success: false, error: 'Failed to poll notifications' }, 500);
  }
});

// ─── PUT /:id/read — 既読 ───

notificationRoutes.put('/:id/read', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE id = ?'
    ).bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    return c.json({ success: false, error: 'Failed to mark as read' }, 500);
  }
});

// ─── PUT /read-all — 全既読 ───

notificationRoutes.put('/read-all', async (c) => {
  try {
    await c.env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE is_read = 0'
    ).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('Mark all read error:', err);
    return c.json({ success: false, error: 'Failed to mark all as read' }, 500);
  }
});

// ─── DELETE /:id — 削除 ───

notificationRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM notifications WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('Delete notification error:', err);
    return c.json({ success: false, error: 'Failed to delete notification' }, 500);
  }
});

// ─── POST /test — テスト通知送信 (既存) ───

notificationRoutes.post('/test', async (c) => {
  try {
    const { channel } = await c.req.json<{ channel: 'slack' | 'email' }>();
    if (channel !== 'slack' && channel !== 'email') {
      return c.json({ success: false, error: 'Invalid channel. Use "slack" or "email"' }, 400);
    }
    const ok = await sendTestNotification(c.env, channel);
    return c.json({ success: ok, message: ok ? 'テスト通知を送信しました' : '通知の送信に失敗しました。設定を確認してください' });
  } catch (err) {
    console.error('Test notification error:', err);
    return c.json({ success: false, error: 'Failed to send test notification' }, 500);
  }
});
