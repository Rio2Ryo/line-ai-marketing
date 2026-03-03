import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { sendPushMessage } from '../lib/line';

type AuthVars = { userId: string };
export const chatRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
chatRoutes.use('*', authMiddleware);

function generateId(): string {
  return crypto.randomUUID();
}

// GET /conversations — 会話一覧（最新メッセージ・未読数付き）
chatRoutes.get('/conversations', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
    const search = c.req.query('search') || '';
    const offset = (page - 1) * limit;

    let countSql = `
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      JOIN (SELECT user_id FROM messages GROUP BY user_id) m_agg ON u.id = m_agg.user_id
    `;
    let dataSql = `
      SELECT u.id, u.display_name, u.picture_url, u.status, u.line_user_id,
        m_last.content as last_message, m_last.direction as last_direction,
        m_last.message_type as last_type, m_last.sent_at as last_message_at,
        (SELECT COUNT(*) FROM messages m2 WHERE m2.user_id = u.id AND m2.direction = 'inbound' AND m2.sent_at > COALESCE(crs.last_read_at, '1970-01-01')) as unread_count
      FROM users u
      JOIN (SELECT user_id, MAX(sent_at) as max_sent FROM messages GROUP BY user_id) m_agg ON u.id = m_agg.user_id
      JOIN messages m_last ON m_last.user_id = u.id AND m_last.sent_at = m_agg.max_sent
      LEFT JOIN chat_read_status crs ON crs.user_id = u.id
    `;

    const binds: any[] = [];

    if (search) {
      const whereClause = ' WHERE u.display_name LIKE ?';
      countSql += whereClause;
      dataSql += whereClause;
      binds.push('%' + search + '%');
    }

    dataSql += ' ORDER BY m_agg.max_sent DESC LIMIT ? OFFSET ?';

    const countResult = await c.env.DB.prepare(countSql).bind(...binds).first<{ total: number }>();
    const total = countResult?.total || 0;

    const rows = await c.env.DB.prepare(dataSql).bind(...binds, limit, offset).all();
    const conversations = rows.results || [];

    return c.json({
      success: true,
      data: conversations,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('List conversations error:', err);
    return c.json({ success: false, error: '会話一覧の取得に失敗しました' }, 500);
  }
});

// GET /:userId/messages — メッセージ履歴取得
chatRoutes.get('/:userId/messages', async (c) => {
  try {
    const userId = c.req.param('userId');
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
    const before = c.req.query('before') || '';

    let sql = 'SELECT * FROM messages WHERE user_id = ?';
    const binds: any[] = [userId];

    if (before) {
      sql += ' AND sent_at < ?';
      binds.push(before);
    }

    sql += ' ORDER BY sent_at DESC LIMIT ?';
    binds.push(limit);

    const rows = await c.env.DB.prepare(sql).bind(...binds).all();
    const messages = rows.results || [];

    return c.json({
      success: true,
      data: messages,
      has_more: messages.length === limit,
    });
  } catch (err) {
    console.error('Get messages error:', err);
    return c.json({ success: false, error: 'メッセージ履歴の取得に失敗しました' }, 500);
  }
});

// POST /:userId/send — LINEユーザーにメッセージ送信
chatRoutes.post('/:userId/send', async (c) => {
  try {
    const userId = c.req.param('userId');
    const body = await c.req.json<{ content: string; message_type?: string }>();
    const content = body.content;
    const messageType = body.message_type || 'text';

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return c.json({ success: false, error: 'メッセージ内容は必須です' }, 400);
    }

    const user = await c.env.DB.prepare('SELECT line_user_id FROM users WHERE id = ?').bind(userId).first<{ line_user_id: string }>();
    if (!user) {
      return c.json({ success: false, error: 'ユーザーが見つかりません' }, 404);
    }

    try {
      await sendPushMessage(user.line_user_id, [{ type: 'text', text: content }], c.env.LINE_CHANNEL_ACCESS_TOKEN);
    } catch (pushErr) {
      console.error('LINE Push error:', pushErr);
      return c.json({ success: false, error: 'LINEメッセージの送信に失敗しました' }, 500);
    }

    const id = generateId();
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      "INSERT INTO messages (id, user_id, direction, message_type, content, sent_at) VALUES (?, ?, 'outbound', ?, ?, datetime('now'))"
    ).bind(id, userId, messageType, content).run();

    return c.json({
      success: true,
      data: { id, user_id: userId, direction: 'outbound', message_type: messageType, content, sent_at: now },
    });
  } catch (err) {
    console.error('Send message error:', err);
    return c.json({ success: false, error: 'メッセージ送信に失敗しました' }, 500);
  }
});

// POST /:userId/read — 既読マーク
chatRoutes.post('/:userId/read', async (c) => {
  try {
    const userId = c.req.param('userId');
    await c.env.DB.prepare(
      "INSERT OR REPLACE INTO chat_read_status (user_id, last_read_at) VALUES (?, datetime('now'))"
    ).bind(userId).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    return c.json({ success: false, error: '既読マークに失敗しました' }, 500);
  }
});
