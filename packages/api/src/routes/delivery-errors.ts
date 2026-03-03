import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const deliveryErrorRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
deliveryErrorRoutes.use('*', authMiddleware);

// GET / — 失敗配信一覧 (エラーダッシュボード)
deliveryErrorRoutes.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '30'), 100);
    const offset = (page - 1) * limit;
    const status = c.req.query('status') || 'failed'; // failed, retry_pending, all

    let where = "dl.status = 'failed'";
    if (status === 'retry_pending') {
      where = "dl.status = 'failed' AND dl.next_retry_at IS NOT NULL AND dl.retry_count < dl.max_retries";
    } else if (status === 'all') {
      where = "(dl.status = 'failed' OR (dl.status = 'pending' AND dl.next_retry_at IS NOT NULL))";
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM delivery_logs dl WHERE ${where}`
    ).first<{ total: number }>();

    const rows = await c.env.DB.prepare(
      `SELECT dl.*,
        COALESCE(u.display_name, u.line_user_id) as user_name,
        COALESCE(s.name, '手動配信') as scenario_name,
        ss.message_content as step_content
       FROM delivery_logs dl
       LEFT JOIN users u ON dl.user_id = u.id
       LEFT JOIN scenarios s ON dl.scenario_id = s.id
       LEFT JOIN scenario_steps ss ON dl.scenario_step_id = ss.id
       WHERE ${where}
       ORDER BY dl.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();

    return c.json({
      success: true,
      data: rows.results || [],
      pagination: { page, limit, total: countResult?.total || 0 },
    });
  } catch (err) {
    console.error('List delivery errors:', err);
    return c.json({ success: false, error: '失敗配信一覧の取得に失敗しました' }, 500);
  }
});

// GET /summary — エラーサマリー
deliveryErrorRoutes.get('/summary', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '30');

    const [totals, daily, byError] = await Promise.all([
      c.env.DB.prepare(`
        SELECT
          COUNT(*) as total_failed,
          SUM(CASE WHEN retry_count > 0 THEN 1 ELSE 0 END) as retried,
          SUM(CASE WHEN retry_count > 0 AND status = 'sent' THEN 1 ELSE 0 END) as retry_success,
          SUM(CASE WHEN next_retry_at IS NOT NULL AND retry_count < max_retries AND status = 'failed' THEN 1 ELSE 0 END) as pending_retry
        FROM delivery_logs
        WHERE status IN ('failed', 'sent') AND retry_count >= 0 AND created_at >= datetime('now', '-' || ? || ' days')
      `).bind(days).first<{ total_failed: number; retried: number; retry_success: number; pending_retry: number }>(),

      c.env.DB.prepare(`
        SELECT
          date(created_at) as date,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
          COUNT(*) as total
        FROM delivery_logs
        WHERE created_at >= datetime('now', '-' || ? || ' days')
        GROUP BY date(created_at)
        ORDER BY date ASC
      `).bind(days).all(),

      c.env.DB.prepare(`
        SELECT
          CASE
            WHEN error_message LIKE '%429%' OR error_message LIKE '%rate%' THEN 'レート制限'
            WHEN error_message LIKE '%400%' THEN '不正リクエスト'
            WHEN error_message LIKE '%401%' OR error_message LIKE '%403%' THEN '認証エラー'
            WHEN error_message LIKE '%404%' THEN 'ユーザー不明'
            WHEN error_message LIKE '%500%' OR error_message LIKE '%502%' OR error_message LIKE '%503%' THEN 'サーバーエラー'
            WHEN error_message LIKE '%timeout%' OR error_message LIKE '%Timeout%' THEN 'タイムアウト'
            ELSE 'その他'
          END as error_category,
          COUNT(*) as count
        FROM delivery_logs
        WHERE status = 'failed' AND error_message IS NOT NULL AND created_at >= datetime('now', '-' || ? || ' days')
        GROUP BY error_category
        ORDER BY count DESC
      `).bind(days).all(),
    ]);

    // Recent failures (last 10)
    const recent = await c.env.DB.prepare(`
      SELECT dl.id, dl.error_message, dl.retry_count, dl.created_at,
        COALESCE(u.display_name, '') as user_name,
        COALESCE(s.name, '手動配信') as scenario_name
      FROM delivery_logs dl
      LEFT JOIN users u ON dl.user_id = u.id
      LEFT JOIN scenarios s ON dl.scenario_id = s.id
      WHERE dl.status = 'failed' AND dl.created_at >= datetime('now', '-' || ? || ' days')
      ORDER BY dl.created_at DESC LIMIT 10
    `).bind(days).all();

    return c.json({
      success: true,
      data: {
        totals: {
          total_failed: totals?.total_failed || 0,
          retried: totals?.retried || 0,
          retry_success: totals?.retry_success || 0,
          pending_retry: totals?.pending_retry || 0,
          recovery_rate: (totals?.retried || 0) > 0
            ? Math.round(((totals?.retry_success || 0) / (totals?.retried || 0)) * 1000) / 10
            : 0,
        },
        daily: daily.results || [],
        by_error: byError.results || [],
        recent: recent.results || [],
        period_days: days,
      },
    });
  } catch (err) {
    console.error('Error summary:', err);
    return c.json({ success: false, error: 'エラーサマリーの取得に失敗しました' }, 500);
  }
});

// POST /:id/retry — 手動リトライ
deliveryErrorRoutes.post('/:id/retry', async (c) => {
  try {
    const id = c.req.param('id');
    const log = await c.env.DB.prepare(
      'SELECT * FROM delivery_logs WHERE id = ? AND status = ?'
    ).bind(id, 'failed').first<any>();

    if (!log) return c.json({ success: false, error: '対象の配信ログが見つかりません' }, 404);

    // Schedule retry immediately
    await c.env.DB.prepare(
      "UPDATE delivery_logs SET next_retry_at = datetime('now'), retry_count = retry_count WHERE id = ?"
    ).bind(id).run();

    // Attempt retry now
    const user = await c.env.DB.prepare('SELECT line_user_id FROM users WHERE id = ?').bind(log.user_id).first<{ line_user_id: string }>();
    if (!user) return c.json({ success: false, error: 'ユーザーが見つかりません' }, 404);

    // Get message content
    let content = '';
    if (log.scenario_step_id) {
      const step = await c.env.DB.prepare('SELECT message_content FROM scenario_steps WHERE id = ?').bind(log.scenario_step_id).first<{ message_content: string }>();
      content = step?.message_content || '';
    }

    if (!content) {
      return c.json({ success: false, error: 'メッセージ内容が見つかりません' }, 400);
    }

    try {
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + c.env.LINE_CHANNEL_ACCESS_TOKEN,
        },
        body: JSON.stringify({ to: user.line_user_id, messages: [{ type: 'text', text: content }] }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error('Push failed: ' + res.status + ' ' + err);
      }

      await c.env.DB.prepare(
        "UPDATE delivery_logs SET status = 'sent', sent_at = datetime('now'), retry_count = retry_count + 1, next_retry_at = NULL, error_message = NULL WHERE id = ?"
      ).bind(id).run();

      return c.json({ success: true, data: { status: 'sent' } });
    } catch (e) {
      const newRetryCount = (log.retry_count || 0) + 1;
      const backoffMinutes = Math.pow(2, newRetryCount) * 5; // 10, 20, 40 min...
      const nextRetryAt = newRetryCount < (log.max_retries || 3)
        ? new Date(Date.now() + backoffMinutes * 60000).toISOString()
        : null;

      await c.env.DB.prepare(
        "UPDATE delivery_logs SET retry_count = ?, error_message = ?, next_retry_at = ? WHERE id = ?"
      ).bind(newRetryCount, String(e), nextRetryAt, id).run();

      return c.json({ success: false, error: `リトライ失敗: ${String(e)}`, data: { retry_count: newRetryCount, next_retry_at: nextRetryAt } }, 502);
    }
  } catch (err) {
    console.error('Manual retry error:', err);
    return c.json({ success: false, error: 'リトライに失敗しました' }, 500);
  }
});

// POST /retry-all — 一括リトライ (リトライ待ちの全件)
deliveryErrorRoutes.post('/retry-all', async (c) => {
  try {
    // Mark all eligible failed deliveries for immediate retry
    const result = await c.env.DB.prepare(
      "UPDATE delivery_logs SET next_retry_at = datetime('now') WHERE status = 'failed' AND retry_count < max_retries AND (next_retry_at IS NULL OR next_retry_at > datetime('now'))"
    ).run();

    return c.json({ success: true, data: { scheduled: result.meta?.changes || 0 } });
  } catch (err) {
    console.error('Retry all error:', err);
    return c.json({ success: false, error: '一括リトライに失敗しました' }, 500);
  }
});
