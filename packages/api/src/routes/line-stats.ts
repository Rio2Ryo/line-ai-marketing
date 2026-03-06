import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { cached } from '../lib/cache';

type AuthVars = { userId: string };
export const lineStatsRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
lineStatsRoutes.use('*', authMiddleware);

// ─── Helpers ───

async function lineApiGet(path: string, token: string): Promise<Response> {
  return fetch(`https://api.line.me/v2/bot${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Format YYYYMMDD
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ─── GET /overview — Combined LINE + internal stats ───

lineStatsRoutes.get('/overview', async (c) => {
  try {
    const data = await cached(c.env.DB, 'line-stats:overview', 300, async () => {
    const token = c.env.LINE_CHANNEL_ACCESS_TOKEN;

    // Internal stats from D1
    const [
      totalFriends,
      newThisMonth,
      newLastMonth,
      totalMessages30d,
      outbound30d,
      inbound30d,
      activeScenarios,
    ] = await Promise.all([
      c.env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE status = 'active'").first<{ c: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= datetime('now','start of month')").first<{ c: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= datetime('now','start of month','-1 month') AND created_at < datetime('now','start of month')").first<{ c: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as c FROM messages WHERE sent_at >= datetime('now','-30 days')").first<{ c: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as c FROM messages WHERE direction = 'outbound' AND sent_at >= datetime('now','-30 days')").first<{ c: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as c FROM messages WHERE direction = 'inbound' AND sent_at >= datetime('now','-30 days')").first<{ c: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as c FROM scenarios WHERE is_active = 1").first<{ c: number }>(),
    ]);

    // LINE API: follower count
    let lineFollowers: number | null = null;
    let lineTargetReach: number | null = null;
    try {
      const res = await lineApiGet('/insight/followers?date=' + fmtDate(daysAgo(1)), token);
      if (res.ok) {
        const data = await res.json() as { followers?: number; targetedReaches?: number; blocks?: number; status?: string };
        if (data.status === 'ready') {
          lineFollowers = data.followers ?? null;
          lineTargetReach = data.targetedReaches ?? null;
        }
      }
    } catch {}

    // Delivery stats
    const deliveryCounts = await c.env.DB.prepare(
      "SELECT status, COUNT(*) as count FROM delivery_logs WHERE created_at >= datetime('now','-30 days') GROUP BY status"
    ).all();
    const deliveryMap: Record<string, number> = {};
    for (const r of (deliveryCounts.results || []) as { status: string; count: number }[]) {
      deliveryMap[r.status] = r.count;
    }
    const totalDeliveries = (deliveryMap['sent'] || 0) + (deliveryMap['failed'] || 0);
    const deliveryRate = totalDeliveries > 0 ? Math.round(((deliveryMap['sent'] || 0) / totalDeliveries) * 1000) / 10 : 0;

    return {
        // Internal
        total_friends: totalFriends?.c || 0,
        new_friends_this_month: newThisMonth?.c || 0,
        new_friends_last_month: newLastMonth?.c || 0,
        total_messages_30d: totalMessages30d?.c || 0,
        outbound_30d: outbound30d?.c || 0,
        inbound_30d: inbound30d?.c || 0,
        active_scenarios: activeScenarios?.c || 0,
        delivery_sent: deliveryMap['sent'] || 0,
        delivery_failed: deliveryMap['failed'] || 0,
        delivery_rate: deliveryRate,
        // LINE API
        line_followers: lineFollowers,
        line_target_reach: lineTargetReach,
      };
    });
    return c.json({ success: true, data });
  } catch (err) {
    console.error('LINE stats overview error:', err);
    return c.json({ success: false, error: 'Failed to fetch overview stats' }, 500);
  }
});

// ─── GET /followers — Daily follower trend ───

lineStatsRoutes.get('/followers', async (c) => {
  try {
    const days = Math.min(Number(c.req.query('days') || '30'), 90);
    const data = await cached(c.env.DB, `line-stats:followers:${days}`, 300, async () => {
    const token = c.env.LINE_CHANNEL_ACCESS_TOKEN;

    // Try LINE API insight/followers for each day
    const lineData: { date: string; followers: number | null; targeted_reaches: number | null; blocks: number | null }[] = [];
    const promises: Promise<void>[] = [];

    for (let i = days; i >= 2; i--) {
      const d = daysAgo(i);
      const dateStr = fmtDate(d);
      const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      promises.push(
        lineApiGet(`/insight/followers?date=${dateStr}`, token)
          .then(async (res) => {
            if (res.ok) {
              const data = await res.json() as { followers?: number; targetedReaches?: number; blocks?: number; status?: string };
              if (data.status === 'ready') {
                lineData.push({
                  date: isoDate,
                  followers: data.followers ?? null,
                  targeted_reaches: data.targetedReaches ?? null,
                  blocks: data.blocks ?? null,
                });
              }
            }
          })
          .catch(() => {})
      );
    }

    await Promise.all(promises);
    lineData.sort((a, b) => a.date.localeCompare(b.date));

    // Fallback: internal user creation trend
    const internalTrend = await c.env.DB.prepare(
      `SELECT date(created_at) as date, COUNT(*) as count
       FROM users
       WHERE created_at >= datetime('now', '-${days} days')
       GROUP BY date(created_at)
       ORDER BY date ASC`
    ).all();

    // Cumulative friend count from internal DB
    const totalBefore = await c.env.DB.prepare(
      `SELECT COUNT(*) as c FROM users WHERE created_at < datetime('now', '-${days} days') AND status = 'active'`
    ).first<{ c: number }>();
    let cumulative = totalBefore?.c || 0;
    const internalCumulative: { date: string; total: number; new_count: number }[] = [];
    for (const r of (internalTrend.results || []) as { date: string; count: number }[]) {
      cumulative += r.count;
      internalCumulative.push({ date: r.date, total: cumulative, new_count: r.count });
    }

    return {
        line_api: lineData,
        internal: internalCumulative,
      };
    });
    return c.json({ success: true, data });
  } catch (err) {
    console.error('Followers trend error:', err);
    return c.json({ success: false, error: 'Failed to fetch follower trend' }, 500);
  }
});

// ─── GET /messages — Message delivery statistics ───

lineStatsRoutes.get('/messages', async (c) => {
  try {
    const days = Math.min(Number(c.req.query('days') || '30'), 90);
    const data = await cached(c.env.DB, `line-stats:messages:${days}`, 300, async () => {
    // LINE API: message delivery stats (past days)
    const token = c.env.LINE_CHANNEL_ACCESS_TOKEN;
    const lineMessageStats: { date: string; status: string; success?: number; api_broadcast?: number; api_push?: number; api_multicast?: number }[] = [];

    const promises: Promise<void>[] = [];
    for (let i = days; i >= 2; i--) {
      const d = daysAgo(i);
      const dateStr = fmtDate(d);
      const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      promises.push(
        lineApiGet(`/insight/message/delivery?date=${dateStr}`, token)
          .then(async (res) => {
            if (res.ok) {
              const data = await res.json() as {
                status?: string;
                success?: number;
                apiBroadcast?: number;
                apiPush?: number;
                apiMulticast?: number;
              };
              if (data.status === 'ready') {
                lineMessageStats.push({
                  date: isoDate,
                  status: 'ready',
                  success: data.success,
                  api_broadcast: data.apiBroadcast,
                  api_push: data.apiPush,
                  api_multicast: data.apiMulticast,
                });
              }
            }
          })
          .catch(() => {})
      );
    }

    await Promise.all(promises);
    lineMessageStats.sort((a, b) => a.date.localeCompare(b.date));

    // Internal message stats
    const internalDaily = await c.env.DB.prepare(
      `SELECT date(sent_at) as date, direction, COUNT(*) as count
       FROM messages
       WHERE sent_at >= datetime('now', '-${days} days')
       GROUP BY date(sent_at), direction
       ORDER BY date ASC`
    ).all();

    // Group by date
    const internalMap: Record<string, { inbound: number; outbound: number }> = {};
    for (const r of (internalDaily.results || []) as { date: string; direction: string; count: number }[]) {
      if (!internalMap[r.date]) internalMap[r.date] = { inbound: 0, outbound: 0 };
      if (r.direction === 'inbound') internalMap[r.date].inbound = r.count;
      else internalMap[r.date].outbound = r.count;
    }

    const internalSeries = Object.entries(internalMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));

    // Delivery success/fail breakdown
    const deliveryDaily = await c.env.DB.prepare(
      `SELECT date(created_at) as date, status, COUNT(*) as count
       FROM delivery_logs
       WHERE created_at >= datetime('now', '-${days} days')
       GROUP BY date(created_at), status
       ORDER BY date ASC`
    ).all();

    const deliveryMap: Record<string, { sent: number; failed: number; pending: number }> = {};
    for (const r of (deliveryDaily.results || []) as { date: string; status: string; count: number }[]) {
      if (!deliveryMap[r.date]) deliveryMap[r.date] = { sent: 0, failed: 0, pending: 0 };
      if (r.status === 'sent') deliveryMap[r.date].sent = r.count;
      else if (r.status === 'failed') deliveryMap[r.date].failed = r.count;
      else if (r.status === 'pending') deliveryMap[r.date].pending = r.count;
    }

    const deliverySeries = Object.entries(deliveryMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));

    return {
        line_api: lineMessageStats,
        internal_messages: internalSeries,
        delivery_logs: deliverySeries,
      };
    });
    return c.json({ success: true, data });
  } catch (err) {
    console.error('Message stats error:', err);
    return c.json({ success: false, error: 'Failed to fetch message stats' }, 500);
  }
});

// ─── GET /engagement — Engagement & interaction summary ───

lineStatsRoutes.get('/engagement', async (c) => {
  try {
    const days = Math.min(Number(c.req.query('days') || '30'), 90);
    const data = await cached(c.env.DB, `line-stats:engagement:${days}`, 300, async () => {

    // Response rate: users who sent inbound after receiving outbound
    const responders = await c.env.DB.prepare(
      `SELECT COUNT(DISTINCT m1.user_id) as c
       FROM messages m1
       WHERE m1.direction = 'inbound' AND m1.sent_at >= datetime('now', '-${days} days')
       AND m1.user_id IN (
         SELECT DISTINCT user_id FROM messages WHERE direction = 'outbound' AND sent_at >= datetime('now', '-${days} days')
       )`
    ).first<{ c: number }>();

    const totalRecipients = await c.env.DB.prepare(
      `SELECT COUNT(DISTINCT user_id) as c FROM messages WHERE direction = 'outbound' AND sent_at >= datetime('now', '-${days} days')`
    ).first<{ c: number }>();

    const responseRate = (totalRecipients?.c || 0) > 0
      ? Math.round(((responders?.c || 0) / (totalRecipients?.c || 1)) * 1000) / 10
      : 0;

    // Average messages per active user
    const activeUsers = await c.env.DB.prepare(
      `SELECT COUNT(DISTINCT user_id) as c FROM messages WHERE sent_at >= datetime('now', '-${days} days')`
    ).first<{ c: number }>();

    const totalMsgs = await c.env.DB.prepare(
      `SELECT COUNT(*) as c FROM messages WHERE sent_at >= datetime('now', '-${days} days')`
    ).first<{ c: number }>();

    const avgMsgsPerUser = (activeUsers?.c || 0) > 0
      ? Math.round(((totalMsgs?.c || 0) / (activeUsers?.c || 1)) * 10) / 10
      : 0;

    // Hourly distribution (for timing optimization)
    const hourly = await c.env.DB.prepare(
      `SELECT CAST(strftime('%H', sent_at) AS INTEGER) as hour, direction, COUNT(*) as count
       FROM messages
       WHERE sent_at >= datetime('now', '-${days} days')
       GROUP BY hour, direction
       ORDER BY hour ASC`
    ).all();

    const hourlyMap: Record<number, { inbound: number; outbound: number }> = {};
    for (let h = 0; h < 24; h++) hourlyMap[h] = { inbound: 0, outbound: 0 };
    for (const r of (hourly.results || []) as { hour: number; direction: string; count: number }[]) {
      if (!hourlyMap[r.hour]) hourlyMap[r.hour] = { inbound: 0, outbound: 0 };
      if (r.direction === 'inbound') hourlyMap[r.hour].inbound = r.count;
      else hourlyMap[r.hour].outbound = r.count;
    }

    const hourlySeries = Object.entries(hourlyMap)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([hour, counts]) => ({ hour: Number(hour), ...counts }));

    // Day-of-week distribution
    const weekly = await c.env.DB.prepare(
      `SELECT CAST(strftime('%w', sent_at) AS INTEGER) as dow, direction, COUNT(*) as count
       FROM messages
       WHERE sent_at >= datetime('now', '-${days} days')
       GROUP BY dow, direction
       ORDER BY dow ASC`
    ).all();

    const dowLabels = ['日', '月', '火', '水', '木', '金', '土'];
    const weeklyMap: Record<number, { label: string; inbound: number; outbound: number }> = {};
    for (let d = 0; d < 7; d++) weeklyMap[d] = { label: dowLabels[d], inbound: 0, outbound: 0 };
    for (const r of (weekly.results || []) as { dow: number; direction: string; count: number }[]) {
      if (weeklyMap[r.dow]) {
        if (r.direction === 'inbound') weeklyMap[r.dow].inbound = r.count;
        else weeklyMap[r.dow].outbound = r.count;
      }
    }

    const weeklySeries = Object.values(weeklyMap);

    // Engagement scores distribution
    const scoreDist = await c.env.DB.prepare(
      `SELECT rank, COUNT(*) as count FROM engagement_scores GROUP BY rank ORDER BY rank`
    ).all();

    return {
        response_rate: responseRate,
        responders: responders?.c || 0,
        total_recipients: totalRecipients?.c || 0,
        active_users: activeUsers?.c || 0,
        avg_msgs_per_user: avgMsgsPerUser,
        hourly: hourlySeries,
        weekly: weeklySeries,
        score_distribution: scoreDist.results || [],
      };
    });
    return c.json({ success: true, data });
  } catch (err) {
    console.error('Engagement stats error:', err);
    return c.json({ success: false, error: 'Failed to fetch engagement stats' }, 500);
  }
});
