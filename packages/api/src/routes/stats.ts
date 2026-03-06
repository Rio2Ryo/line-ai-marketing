import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { cached } from '../lib/cache';

type AuthVars = { userId: string };
export const statsRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
statsRoutes.use('*', authMiddleware);

statsRoutes.get('/overview', async (c) => {
  const data = await cached(c.env.DB, 'stats:overview', 60, async () => {
    const [totalFriends, msgsMonth, outbound, inbound, activeScen, newMonth, lastMonth, daily] = await Promise.all([
      c.env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE status = 'active'").first<{ c: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as c FROM messages WHERE sent_at >= datetime('now','-30 days')").first<{ c: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as c FROM messages WHERE direction = 'outbound' AND sent_at >= datetime('now','-30 days')").first<{ c: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as c FROM messages WHERE direction = 'inbound' AND sent_at >= datetime('now','-30 days')").first<{ c: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as c FROM scenarios WHERE is_active = 1").first<{ c: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= datetime('now','start of month')").first<{ c: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= datetime('now','start of month','-1 month') AND created_at < datetime('now','start of month')").first<{ c: number }>(),
      c.env.DB.prepare("SELECT date(sent_at) as date, direction, COUNT(*) as count FROM messages WHERE sent_at >= datetime('now','-30 days') GROUP BY date(sent_at), direction ORDER BY date ASC").all(),
    ]);
    return {
      total_friends: totalFriends?.c || 0,
      messages_this_month: msgsMonth?.c || 0,
      outbound_this_month: outbound?.c || 0,
      inbound_this_month: inbound?.c || 0,
      active_scenarios: activeScen?.c || 0,
      new_friends_this_month: newMonth?.c || 0,
      friends_last_month: lastMonth?.c || 0,
      daily_messages: daily.results || [],
    };
  });
  return c.json({ success: true, data });
});

statsRoutes.get('/delivery', async (c) => {
  const data = await cached(c.env.DB, 'stats:delivery', 60, async () => {
    const [counts, daily] = await Promise.all([
      c.env.DB.prepare("SELECT status, COUNT(*) as count FROM delivery_logs GROUP BY status").all(),
      c.env.DB.prepare("SELECT date(created_at) as date, status, COUNT(*) as count FROM delivery_logs WHERE created_at >= datetime('now','-30 days') GROUP BY date(created_at), status ORDER BY date ASC").all(),
    ]);
    return { summary: counts.results || [], daily: daily.results || [] };
  });
  return c.json({ success: true, data });
});
