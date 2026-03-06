import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { cached } from '../lib/cache';

type AuthVars = { userId: string };
export const reportRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
reportRoutes.use('*', authMiddleware);

function toCsv(rows: Record<string, any>[], columns: { key: string; label: string }[]): string {
  const header = columns.map(c => c.label).join(',');
  const lines = rows.map(row =>
    columns.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }).join(',')
  );
  return '\uFEFF' + header + '\n' + lines.join('\n');
}

// GET /performance — 配信パフォーマンスレポート
reportRoutes.get('/performance', async (c) => {
  try {
    const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date().toISOString().slice(0, 10);

    const data = await cached(c.env.DB, `reports:performance:${from}:${to}`, 300, async () => {
    // Calculate previous period (same length, immediately before)
    const fromDate = new Date(from + 'T00:00:00Z');
    const toDate = new Date(to + 'T23:59:59Z');
    const periodDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / 86400000);
    const prevFrom = new Date(fromDate.getTime() - periodDays * 86400000).toISOString().slice(0, 10);
    const prevTo = new Date(fromDate.getTime() - 86400000).toISOString().slice(0, 10);

    // Current period summary
    const current = await c.env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM delivery_logs
      WHERE date(created_at) >= ? AND date(created_at) <= ?
    `).bind(from, to).first<{ total: number; sent: number; failed: number; pending: number }>();

    // Previous period summary
    const previous = await c.env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM delivery_logs
      WHERE date(created_at) >= ? AND date(created_at) <= ?
    `).bind(prevFrom, prevTo).first<{ total: number; sent: number; failed: number }>();

    // Daily breakdown (current period)
    const daily = await c.env.DB.prepare(`
      SELECT
        date(created_at) as date,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        COUNT(*) as total
      FROM delivery_logs
      WHERE date(created_at) >= ? AND date(created_at) <= ?
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).bind(from, to).all();

    // Scenario breakdown (current period)
    const byScenario = await c.env.DB.prepare(`
      SELECT
        dl.scenario_id,
        COALESCE(s.name, '手動配信') as scenario_name,
        COUNT(*) as total,
        SUM(CASE WHEN dl.status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN dl.status = 'failed' THEN 1 ELSE 0 END) as failed,
        CASE
          WHEN COUNT(*) > 0
          THEN ROUND(CAST(SUM(CASE WHEN dl.status = 'sent' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1)
          ELSE 0
        END as success_rate
      FROM delivery_logs dl
      LEFT JOIN scenarios s ON dl.scenario_id = s.id
      WHERE date(dl.created_at) >= ? AND date(dl.created_at) <= ?
      GROUP BY dl.scenario_id
      ORDER BY total DESC
    `).bind(from, to).all();

    // Message activity (current period) — inbound/outbound counts
    const messageActivity = await c.env.DB.prepare(`
      SELECT
        date(sent_at) as date,
        SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound,
        SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound
      FROM messages
      WHERE date(sent_at) >= ? AND date(sent_at) <= ?
      GROUP BY date(sent_at)
      ORDER BY date ASC
    `).bind(from, to).all();

    // Unique users who received deliveries
    const uniqueUsers = await c.env.DB.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM delivery_logs
      WHERE date(created_at) >= ? AND date(created_at) <= ? AND status = 'sent'
    `).bind(from, to).first<{ count: number }>();

    const prevUniqueUsers = await c.env.DB.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM delivery_logs
      WHERE date(created_at) >= ? AND date(created_at) <= ? AND status = 'sent'
    `).bind(prevFrom, prevTo).first<{ count: number }>();

    const curTotal = current?.total || 0;
    const curSent = current?.sent || 0;
    const prevTotal = previous?.total || 0;
    const prevSent = previous?.sent || 0;
    const curRate = curTotal > 0 ? Math.round((curSent / curTotal) * 1000) / 10 : 0;
    const prevRate = prevTotal > 0 ? Math.round((prevSent / prevTotal) * 1000) / 10 : 0;

    return {
        period: { from, to, days: periodDays },
        previous_period: { from: prevFrom, to: prevTo },
        summary: {
          total: curTotal,
          sent: curSent,
          failed: current?.failed || 0,
          pending: current?.pending || 0,
          success_rate: curRate,
          unique_users: uniqueUsers?.count || 0,
        },
        comparison: {
          total: prevTotal,
          sent: prevSent,
          failed: previous?.failed || 0,
          success_rate: prevRate,
          unique_users: prevUniqueUsers?.count || 0,
          total_change: curTotal - prevTotal,
          sent_change: curSent - prevSent,
          rate_change: Math.round((curRate - prevRate) * 10) / 10,
          users_change: (uniqueUsers?.count || 0) - (prevUniqueUsers?.count || 0),
        },
        daily: daily.results || [],
        by_scenario: byScenario.results || [],
        message_activity: messageActivity.results || [],
      };
    });
    return c.json({ success: true, data });
  } catch (err) {
    console.error('report performance error:', err);
    return c.json({ success: false, error: 'Failed to generate report' }, 500);
  }
});

// GET /export/csv — レポートCSVエクスポート
reportRoutes.get('/export/csv', async (c) => {
  try {
    const from = c.req.query('from') || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date().toISOString().slice(0, 10);

    const rows = await c.env.DB.prepare(`
      SELECT
        dl.id,
        dl.user_id,
        COALESCE(u.display_name, '') as display_name,
        COALESCE(s.name, '手動配信') as scenario_name,
        dl.status,
        dl.scheduled_at,
        dl.sent_at,
        dl.error_message,
        dl.created_at
      FROM delivery_logs dl
      LEFT JOIN users u ON dl.user_id = u.id
      LEFT JOIN scenarios s ON dl.scenario_id = s.id
      WHERE date(dl.created_at) >= ? AND date(dl.created_at) <= ?
      ORDER BY dl.created_at DESC
    `).bind(from, to).all();

    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'user_id', label: 'ユーザーID' },
      { key: 'display_name', label: '表示名' },
      { key: 'scenario_name', label: 'シナリオ' },
      { key: 'status', label: 'ステータス' },
      { key: 'scheduled_at', label: '予定日時' },
      { key: 'sent_at', label: '送信日時' },
      { key: 'error_message', label: 'エラー' },
      { key: 'created_at', label: '作成日時' },
    ];

    const csv = toCsv((rows.results || []) as Record<string, any>[], columns);
    const dateStamp = `${from.replace(/-/g, '')}_${to.replace(/-/g, '')}`;
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="delivery_report_${dateStamp}.csv"`,
      },
    });
  } catch (err) {
    console.error('report csv export error:', err);
    return c.json({ success: false, error: 'Failed to export CSV' }, 500);
  }
});
