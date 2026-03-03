import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const conversionRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
conversionRoutes.use('*', authMiddleware);

// ─── Goals CRUD ───

// GET /goals — コンバージョン目標一覧
conversionRoutes.get('/goals', async (c) => {
  try {
    const rows = await c.env.DB.prepare(
      `SELECT g.*,
        (SELECT COUNT(*) FROM conversions cv WHERE cv.goal_id = g.id) as conversion_count,
        (SELECT COUNT(DISTINCT cv.user_id) FROM conversions cv WHERE cv.goal_id = g.id) as unique_users
       FROM conversion_goals g
       ORDER BY g.created_at DESC`
    ).all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (err) {
    console.error('List goals error:', err);
    return c.json({ success: false, error: '目標一覧の取得に失敗しました' }, 500);
  }
});

// POST /goals — 目標作成
conversionRoutes.post('/goals', async (c) => {
  try {
    const body = await c.req.json<{
      name: string;
      description?: string;
      goal_type: string;
      goal_config?: Record<string, any>;
      scenario_id?: string;
    }>();

    if (!body.name) return c.json({ success: false, error: 'name is required' }, 400);
    if (!body.goal_type) return c.json({ success: false, error: 'goal_type is required' }, 400);

    const validTypes = ['url_visit', 'purchase', 'form_submit', 'custom'];
    if (!validTypes.includes(body.goal_type)) {
      return c.json({ success: false, error: `goal_type must be one of: ${validTypes.join(', ')}` }, 400);
    }

    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO conversion_goals (id, name, description, goal_type, goal_config, scenario_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      id,
      body.name,
      body.description || null,
      body.goal_type,
      body.goal_config ? JSON.stringify(body.goal_config) : null,
      body.scenario_id || null
    ).run();

    const goal = await c.env.DB.prepare('SELECT * FROM conversion_goals WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: goal }, 201);
  } catch (err) {
    console.error('Create goal error:', err);
    return c.json({ success: false, error: '目標の作成に失敗しました' }, 500);
  }
});

// GET /goals/:id — 目標詳細
conversionRoutes.get('/goals/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const goal = await c.env.DB.prepare('SELECT * FROM conversion_goals WHERE id = ?').bind(id).first();
    if (!goal) return c.json({ success: false, error: 'Not found' }, 404);

    // Recent conversions
    const conversions = await c.env.DB.prepare(
      `SELECT cv.*, u.display_name
       FROM conversions cv
       LEFT JOIN users u ON cv.user_id = u.id
       WHERE cv.goal_id = ?
       ORDER BY cv.converted_at DESC LIMIT 50`
    ).bind(id).all();

    return c.json({ success: true, data: { ...goal, conversions: conversions.results || [] } });
  } catch (err) {
    console.error('Get goal error:', err);
    return c.json({ success: false, error: '目標の取得に失敗しました' }, 500);
  }
});

// PUT /goals/:id — 目標更新
conversionRoutes.put('/goals/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await c.env.DB.prepare('SELECT * FROM conversion_goals WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ success: false, error: 'Not found' }, 404);

    const body = await c.req.json<{
      name?: string;
      description?: string;
      goal_type?: string;
      goal_config?: Record<string, any>;
      scenario_id?: string;
      is_active?: number;
    }>();

    const sets: string[] = [];
    const vals: any[] = [];

    if (body.name) { sets.push('name = ?'); vals.push(body.name); }
    if (body.description !== undefined) { sets.push('description = ?'); vals.push(body.description); }
    if (body.goal_type) { sets.push('goal_type = ?'); vals.push(body.goal_type); }
    if (body.goal_config !== undefined) { sets.push('goal_config = ?'); vals.push(JSON.stringify(body.goal_config)); }
    if (body.scenario_id !== undefined) { sets.push('scenario_id = ?'); vals.push(body.scenario_id || null); }
    if (body.is_active !== undefined) { sets.push('is_active = ?'); vals.push(body.is_active); }
    if (!sets.length) return c.json({ success: false, error: 'No fields to update' }, 400);

    sets.push("updated_at = datetime('now')");
    await c.env.DB.prepare('UPDATE conversion_goals SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals, id).run();

    const updated = await c.env.DB.prepare('SELECT * FROM conversion_goals WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update goal error:', err);
    return c.json({ success: false, error: '目標の更新に失敗しました' }, 500);
  }
});

// DELETE /goals/:id — 目標削除
conversionRoutes.delete('/goals/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await c.env.DB.prepare('SELECT * FROM conversion_goals WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ success: false, error: 'Not found' }, 404);

    await c.env.DB.prepare('DELETE FROM conversions WHERE goal_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM conversion_goals WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('Delete goal error:', err);
    return c.json({ success: false, error: '目標の削除に失敗しました' }, 500);
  }
});

// ─── Conversions ───

// POST /track — コンバージョン記録
conversionRoutes.post('/track', async (c) => {
  try {
    const body = await c.req.json<{
      goal_id: string;
      user_id: string;
      scenario_id?: string;
      delivery_log_id?: string;
      value?: number;
      metadata?: Record<string, any>;
    }>();

    if (!body.goal_id || !body.user_id) {
      return c.json({ success: false, error: 'goal_id and user_id are required' }, 400);
    }

    const goal = await c.env.DB.prepare('SELECT * FROM conversion_goals WHERE id = ? AND is_active = 1').bind(body.goal_id).first();
    if (!goal) return c.json({ success: false, error: 'Goal not found or inactive' }, 404);

    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO conversions (id, goal_id, user_id, scenario_id, delivery_log_id, value, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      id,
      body.goal_id,
      body.user_id,
      body.scenario_id || null,
      body.delivery_log_id || null,
      body.value || 0,
      body.metadata ? JSON.stringify(body.metadata) : null
    ).run();

    return c.json({ success: true, data: { id } }, 201);
  } catch (err) {
    console.error('Track conversion error:', err);
    return c.json({ success: false, error: 'コンバージョン記録に失敗しました' }, 500);
  }
});

// ─── Funnel Analysis ───

// GET /funnel — ファネル分析 (配信→開封→クリック→CV)
conversionRoutes.get('/funnel', async (c) => {
  try {
    const goalId = c.req.query('goal_id');
    const from = c.req.query('from');
    const to = c.req.query('to');

    // Default: last 30 days
    const dateFrom = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const dateTo = to || new Date().toISOString().split('T')[0];

    // Step 1: Total deliveries in period
    const deliveries = await c.env.DB.prepare(
      `SELECT COUNT(*) as total, COUNT(DISTINCT user_id) as unique_users
       FROM delivery_logs WHERE created_at >= ? AND created_at < date(?, '+1 day')`
    ).bind(dateFrom, dateTo).first<{ total: number; unique_users: number }>();

    // Step 2: Sent successfully
    const sent = await c.env.DB.prepare(
      `SELECT COUNT(*) as total, COUNT(DISTINCT user_id) as unique_users
       FROM delivery_logs WHERE status = 'sent' AND created_at >= ? AND created_at < date(?, '+1 day')`
    ).bind(dateFrom, dateTo).first<{ total: number; unique_users: number }>();

    // Step 3: Users who responded (inbound messages after delivery)
    const engaged = await c.env.DB.prepare(
      `SELECT COUNT(DISTINCT m.user_id) as unique_users
       FROM messages m
       WHERE m.direction = 'inbound' AND m.sent_at >= ? AND m.sent_at < date(?, '+1 day')
       AND m.user_id IN (SELECT DISTINCT user_id FROM delivery_logs WHERE status = 'sent' AND created_at >= ? AND created_at < date(?, '+1 day'))`
    ).bind(dateFrom, dateTo, dateFrom, dateTo).first<{ unique_users: number }>();

    // Step 4: Conversions
    let cvQuery = `SELECT COUNT(*) as total, COUNT(DISTINCT user_id) as unique_users, COALESCE(SUM(value), 0) as total_value
       FROM conversions WHERE converted_at >= ? AND converted_at < date(?, '+1 day')`;
    const cvBinds: any[] = [dateFrom, dateTo];
    if (goalId) {
      cvQuery += ' AND goal_id = ?';
      cvBinds.push(goalId);
    }
    const conversions = await c.env.DB.prepare(cvQuery).bind(...cvBinds).first<{ total: number; unique_users: number; total_value: number }>();

    const funnel = [
      { stage: '配信', total: deliveries?.total || 0, unique_users: deliveries?.unique_users || 0 },
      { stage: '送信成功', total: sent?.total || 0, unique_users: sent?.unique_users || 0 },
      { stage: 'エンゲージ', total: engaged?.unique_users || 0, unique_users: engaged?.unique_users || 0 },
      { stage: 'コンバージョン', total: conversions?.total || 0, unique_users: conversions?.unique_users || 0 },
    ];

    // Calculate rates
    const funnelWithRates = funnel.map((step, i) => ({
      ...step,
      rate: i === 0 ? 100 : (funnel[0].unique_users > 0 ? Math.round((step.unique_users / funnel[0].unique_users) * 1000) / 10 : 0),
      step_rate: i === 0 ? 100 : (funnel[i - 1].unique_users > 0 ? Math.round((step.unique_users / funnel[i - 1].unique_users) * 1000) / 10 : 0),
    }));

    return c.json({
      success: true,
      data: {
        funnel: funnelWithRates,
        total_value: conversions?.total_value || 0,
        period: { from: dateFrom, to: dateTo },
      },
    });
  } catch (err) {
    console.error('Funnel analysis error:', err);
    return c.json({ success: false, error: 'ファネル分析の取得に失敗しました' }, 500);
  }
});

// GET /by-scenario — シナリオ別CV率
conversionRoutes.get('/by-scenario', async (c) => {
  try {
    const from = c.req.query('from');
    const to = c.req.query('to');
    const dateFrom = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const dateTo = to || new Date().toISOString().split('T')[0];

    // Deliveries by scenario
    const deliveriesByScenario = await c.env.DB.prepare(
      `SELECT
        dl.scenario_id,
        COALESCE(s.name, '手動配信') as scenario_name,
        COUNT(*) as delivery_count,
        COUNT(DISTINCT dl.user_id) as delivered_users,
        SUM(CASE WHEN dl.status = 'sent' THEN 1 ELSE 0 END) as sent_count
       FROM delivery_logs dl
       LEFT JOIN scenarios s ON dl.scenario_id = s.id
       WHERE dl.created_at >= ? AND dl.created_at < date(?, '+1 day')
       GROUP BY dl.scenario_id
       ORDER BY delivery_count DESC`
    ).bind(dateFrom, dateTo).all();

    // Conversions by scenario
    const cvByScenario = await c.env.DB.prepare(
      `SELECT
        scenario_id,
        COUNT(*) as cv_count,
        COUNT(DISTINCT user_id) as cv_users,
        COALESCE(SUM(value), 0) as cv_value
       FROM conversions
       WHERE converted_at >= ? AND converted_at < date(?, '+1 day')
       GROUP BY scenario_id`
    ).bind(dateFrom, dateTo).all();

    const cvMap = new Map<string | null, { cv_count: number; cv_users: number; cv_value: number }>();
    for (const cv of (cvByScenario.results || []) as any[]) {
      cvMap.set(cv.scenario_id, { cv_count: cv.cv_count, cv_users: cv.cv_users, cv_value: cv.cv_value });
    }

    const scenarios = ((deliveriesByScenario.results || []) as any[]).map((d) => {
      const cv = cvMap.get(d.scenario_id) || { cv_count: 0, cv_users: 0, cv_value: 0 };
      return {
        scenario_id: d.scenario_id,
        scenario_name: d.scenario_name,
        delivery_count: d.delivery_count,
        delivered_users: d.delivered_users,
        sent_count: d.sent_count,
        cv_count: cv.cv_count,
        cv_users: cv.cv_users,
        cv_value: cv.cv_value,
        cv_rate: d.delivered_users > 0 ? Math.round((cv.cv_users / d.delivered_users) * 1000) / 10 : 0,
      };
    });

    return c.json({ success: true, data: { scenarios, period: { from: dateFrom, to: dateTo } } });
  } catch (err) {
    console.error('By-scenario error:', err);
    return c.json({ success: false, error: 'シナリオ別分析の取得に失敗しました' }, 500);
  }
});

// GET /daily — 日別コンバージョン推移
conversionRoutes.get('/daily', async (c) => {
  try {
    const goalId = c.req.query('goal_id');
    const from = c.req.query('from');
    const to = c.req.query('to');
    const dateFrom = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const dateTo = to || new Date().toISOString().split('T')[0];

    let query = `SELECT
      date(converted_at) as date,
      COUNT(*) as count,
      COUNT(DISTINCT user_id) as unique_users,
      COALESCE(SUM(value), 0) as total_value
    FROM conversions
    WHERE converted_at >= ? AND converted_at < date(?, '+1 day')`;
    const binds: any[] = [dateFrom, dateTo];

    if (goalId) {
      query += ' AND goal_id = ?';
      binds.push(goalId);
    }

    query += ' GROUP BY date(converted_at) ORDER BY date ASC';

    const rows = await c.env.DB.prepare(query).bind(...binds).all();
    return c.json({ success: true, data: { daily: rows.results || [], period: { from: dateFrom, to: dateTo } } });
  } catch (err) {
    console.error('Daily conversions error:', err);
    return c.json({ success: false, error: '日別推移の取得に失敗しました' }, 500);
  }
});

// GET /summary — コンバージョンサマリー
conversionRoutes.get('/summary', async (c) => {
  try {
    const from = c.req.query('from');
    const to = c.req.query('to');
    const dateFrom = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const dateTo = to || new Date().toISOString().split('T')[0];

    // Current period
    const current = await c.env.DB.prepare(
      `SELECT COUNT(*) as total, COUNT(DISTINCT user_id) as unique_users, COALESCE(SUM(value), 0) as total_value
       FROM conversions WHERE converted_at >= ? AND converted_at < date(?, '+1 day')`
    ).bind(dateFrom, dateTo).first<{ total: number; unique_users: number; total_value: number }>();

    // Previous period (same length)
    const periodMs = new Date(dateTo).getTime() - new Date(dateFrom).getTime() + 86400000;
    const periodDays = Math.ceil(periodMs / 86400000);
    const prevFrom = new Date(new Date(dateFrom).getTime() - periodDays * 86400000).toISOString().split('T')[0];
    const prevTo = new Date(new Date(dateFrom).getTime() - 86400000).toISOString().split('T')[0];

    const prev = await c.env.DB.prepare(
      `SELECT COUNT(*) as total, COUNT(DISTINCT user_id) as unique_users, COALESCE(SUM(value), 0) as total_value
       FROM conversions WHERE converted_at >= ? AND converted_at < date(?, '+1 day')`
    ).bind(prevFrom, prevTo).first<{ total: number; unique_users: number; total_value: number }>();

    // Deliveries for CV rate
    const deliveredUsers = await c.env.DB.prepare(
      `SELECT COUNT(DISTINCT user_id) as c FROM delivery_logs WHERE status = 'sent' AND created_at >= ? AND created_at < date(?, '+1 day')`
    ).bind(dateFrom, dateTo).first<{ c: number }>();

    const prevDeliveredUsers = await c.env.DB.prepare(
      `SELECT COUNT(DISTINCT user_id) as c FROM delivery_logs WHERE status = 'sent' AND created_at >= ? AND created_at < date(?, '+1 day')`
    ).bind(prevFrom, prevTo).first<{ c: number }>();

    // By goal
    const byGoal = await c.env.DB.prepare(
      `SELECT g.id, g.name, g.goal_type,
        COUNT(cv.id) as cv_count, COUNT(DISTINCT cv.user_id) as cv_users, COALESCE(SUM(cv.value), 0) as cv_value
       FROM conversion_goals g
       LEFT JOIN conversions cv ON g.id = cv.goal_id AND cv.converted_at >= ? AND cv.converted_at < date(?, '+1 day')
       WHERE g.is_active = 1
       GROUP BY g.id
       ORDER BY cv_count DESC`
    ).bind(dateFrom, dateTo).all();

    const currentTotal = current?.total || 0;
    const prevTotal = prev?.total || 0;
    const currentUsers = current?.unique_users || 0;
    const deliveredCount = deliveredUsers?.c || 0;
    const prevDeliveredCount = prevDeliveredUsers?.c || 0;
    const prevUsers = prev?.unique_users || 0;

    return c.json({
      success: true,
      data: {
        current: {
          total: currentTotal,
          unique_users: currentUsers,
          total_value: current?.total_value || 0,
          cv_rate: deliveredCount > 0 ? Math.round((currentUsers / deliveredCount) * 1000) / 10 : 0,
        },
        previous: {
          total: prevTotal,
          unique_users: prevUsers,
          total_value: prev?.total_value || 0,
          cv_rate: prevDeliveredCount > 0 ? Math.round((prevUsers / prevDeliveredCount) * 1000) / 10 : 0,
        },
        change: {
          total: currentTotal - prevTotal,
          unique_users: currentUsers - prevUsers,
          total_value: (current?.total_value || 0) - (prev?.total_value || 0),
        },
        by_goal: byGoal.results || [],
        period: { from: dateFrom, to: dateTo },
      },
    });
  } catch (err) {
    console.error('Summary error:', err);
    return c.json({ success: false, error: 'サマリーの取得に失敗しました' }, 500);
  }
});
