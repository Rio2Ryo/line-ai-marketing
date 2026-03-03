import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const widgetRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
widgetRoutes.use('*', authMiddleware);

function generateId(): string {
  return crypto.randomUUID();
}

const DEFAULT_WIDGETS = [
  { widget_type: 'total_customers', position: 0, size: 'small' },
  { widget_type: 'new_customers', position: 1, size: 'small' },
  { widget_type: 'messages_today', position: 2, size: 'small' },
  { widget_type: 'active_scenarios', position: 3, size: 'small' },
  { widget_type: 'delivery_rate', position: 4, size: 'small' },
  { widget_type: 'unread_chats', position: 5, size: 'small' },
  { widget_type: 'conversion_rate', position: 6, size: 'small' },
  { widget_type: 'avg_engagement', position: 7, size: 'small' },
  { widget_type: 'daily_messages', position: 8, size: 'medium' },
  { widget_type: 'delivery_status', position: 9, size: 'medium' },
  { widget_type: 'recent_activity', position: 10, size: 'medium' },
  { widget_type: 'top_tags', position: 11, size: 'medium' },
];

async function createDefaultWidgets(db: D1Database, ownerId: string) {
  const widgets = DEFAULT_WIDGETS.map((w) => ({
    id: generateId(),
    owner_id: ownerId,
    widget_type: w.widget_type,
    position: w.position,
    size: w.size,
    is_visible: 1,
    config: null,
  }));

  const stmts = widgets.map((w) =>
    db.prepare(
      'INSERT INTO dashboard_widgets (id, owner_id, widget_type, position, size, is_visible, config) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(w.id, w.owner_id, w.widget_type, w.position, w.size, w.is_visible, w.config)
  );
  await db.batch(stmts);

  return widgets;
}

// GET / — ウィジェットレイアウト取得
widgetRoutes.get('/', async (c) => {
  try {
    const userId = c.get('userId');
    const result = await c.env.DB.prepare(
      'SELECT * FROM dashboard_widgets WHERE owner_id = ? ORDER BY position ASC'
    ).bind(userId).all();

    let widgets = result.results || [];

    if (widgets.length === 0) {
      widgets = await createDefaultWidgets(c.env.DB, userId);
    }

    return c.json({ success: true, data: widgets });
  } catch (err) {
    console.error('Get widgets error:', err);
    return c.json({ success: false, error: 'ウィジェットの取得に失敗しました' }, 500);
  }
});

// PUT / — ウィジェットレイアウト一括更新
widgetRoutes.put('/', async (c) => {
  try {
    const userId = c.get('userId');
    const body = await c.req.json<{
      widgets: Array<{ id: string; position: number; size: string; is_visible: number }>;
    }>();

    if (!body.widgets || !Array.isArray(body.widgets)) {
      return c.json({ success: false, error: 'widgets array is required' }, 400);
    }

    const stmts = body.widgets.map((w) =>
      c.env.DB.prepare(
        "UPDATE dashboard_widgets SET position = ?, size = ?, is_visible = ?, updated_at = datetime('now') WHERE id = ? AND owner_id = ?"
      ).bind(w.position, w.size, w.is_visible, w.id, userId)
    );
    await c.env.DB.batch(stmts);

    return c.json({ success: true });
  } catch (err) {
    console.error('Update widgets error:', err);
    return c.json({ success: false, error: 'ウィジェットの更新に失敗しました' }, 500);
  }
});

// POST /reset — デフォルトレイアウトにリセット
widgetRoutes.post('/reset', async (c) => {
  try {
    const userId = c.get('userId');

    await c.env.DB.prepare('DELETE FROM dashboard_widgets WHERE owner_id = ?').bind(userId).run();
    const newWidgets = await createDefaultWidgets(c.env.DB, userId);

    return c.json({ success: true, data: newWidgets });
  } catch (err) {
    console.error('Reset widgets error:', err);
    return c.json({ success: false, error: 'ウィジェットのリセットに失敗しました' }, 500);
  }
});

// GET /data — 全ウィジェットデータ一括取得
widgetRoutes.get('/data', async (c) => {
  try {
    const [
      totalCustomers,
      newCustomers,
      messagesToday,
      deliveryTotal,
      deliverySent,
      activeScenarios,
      unreadChats,
      conversionGoals,
      conversionsCount,
      avgEngagement,
      dailyMessages,
      deliveryByStatus,
      recentMessages,
      topTags,
    ] = await Promise.all([
      // total_customers
      c.env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE status = 'active'").first<{ c: number }>(),
      // new_customers (this month)
      c.env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= datetime('now','start of month')").first<{ c: number }>(),
      // messages_today
      c.env.DB.prepare("SELECT COUNT(*) as c FROM messages WHERE sent_at >= date('now')").first<{ c: number }>(),
      // delivery_rate (total)
      c.env.DB.prepare("SELECT COUNT(*) as c FROM delivery_logs").first<{ c: number }>(),
      // delivery_rate (sent)
      c.env.DB.prepare("SELECT COUNT(*) as c FROM delivery_logs WHERE status = 'sent'").first<{ c: number }>(),
      // active_scenarios
      c.env.DB.prepare("SELECT COUNT(*) as c FROM scenarios WHERE is_active = 1").first<{ c: number }>(),
      // unread_chats: count conversations with unread messages
      c.env.DB.prepare(`
        SELECT COUNT(DISTINCT m.user_id) as c FROM messages m
        LEFT JOIN chat_read_status crs ON crs.user_id = m.user_id
        WHERE m.direction = 'inbound'
        AND m.sent_at > COALESCE(crs.last_read_at, '1970-01-01')
      `).first<{ c: number }>(),
      // conversion_goals count
      c.env.DB.prepare("SELECT COUNT(*) as c FROM conversion_goals WHERE is_active = 1").first<{ c: number }>(),
      // conversions count (this month)
      c.env.DB.prepare("SELECT COUNT(*) as c FROM conversions WHERE converted_at >= datetime('now','start of month')").first<{ c: number }>(),
      // avg_engagement
      c.env.DB.prepare("SELECT AVG(total_score) as avg, COUNT(*) as c FROM engagement_scores").first<{ avg: number | null; c: number }>(),
      // daily_messages (last 7 days)
      c.env.DB.prepare(`
        SELECT date(sent_at) as date,
          SUM(CASE WHEN direction='inbound' THEN 1 ELSE 0 END) as inbound,
          SUM(CASE WHEN direction='outbound' THEN 1 ELSE 0 END) as outbound
        FROM messages WHERE sent_at >= date('now','-7 days')
        GROUP BY date(sent_at) ORDER BY date ASC
      `).all(),
      // delivery_status
      c.env.DB.prepare("SELECT status, COUNT(*) as count FROM delivery_logs GROUP BY status").all(),
      // recent_activity (last 10 messages)
      c.env.DB.prepare(`
        SELECT m.id, m.direction, m.content, m.sent_at, u.display_name
        FROM messages m JOIN users u ON m.user_id = u.id
        ORDER BY m.sent_at DESC LIMIT 10
      `).all(),
      // top_tags
      c.env.DB.prepare(`
        SELECT t.name, t.color, COUNT(ut.user_id) as user_count
        FROM tags t LEFT JOIN user_tags ut ON t.id = ut.tag_id
        GROUP BY t.id ORDER BY user_count DESC LIMIT 10
      `).all(),
    ]);

    const deliveryTotalCount = deliveryTotal?.c || 0;
    const deliverySentCount = deliverySent?.c || 0;
    const deliveryRate = deliveryTotalCount > 0 ? Math.round((deliverySentCount / deliveryTotalCount) * 100) : 0;

    // Build delivery status summary
    const deliveryStatusMap: Record<string, number> = {};
    for (const row of (deliveryByStatus.results || []) as any[]) {
      deliveryStatusMap[row.status] = row.count;
    }

    return c.json({
      success: true,
      data: {
        total_customers: totalCustomers?.c || 0,
        new_customers: newCustomers?.c || 0,
        messages_today: messagesToday?.c || 0,
        delivery_rate: deliveryRate,
        active_scenarios: activeScenarios?.c || 0,
        unread_chats: unreadChats?.c || 0,
        conversion_rate: conversionGoals?.c && (conversionGoals.c > 0)
          ? Math.round(((conversionsCount?.c || 0) / conversionGoals.c) * 100)
          : 0,
        conversions_count: conversionsCount?.c || 0,
        avg_engagement: avgEngagement?.avg ? Math.round(avgEngagement.avg * 10) / 10 : 0,
        engagement_count: avgEngagement?.c || 0,
        daily_messages: dailyMessages.results || [],
        delivery_status: {
          sent: deliveryStatusMap['sent'] || 0,
          pending: deliveryStatusMap['pending'] || 0,
          failed: deliveryStatusMap['failed'] || 0,
        },
        recent_activity: recentMessages.results || [],
        top_tags: topTags.results || [],
      },
    });
  } catch (err) {
    console.error('Widget data error:', err);
    return c.json({ success: false, error: 'ウィジェットデータの取得に失敗しました' }, 500);
  }
});
