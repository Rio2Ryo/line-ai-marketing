import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const followSourceRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();

// ─── Public: Tracking redirect (認証不要) ───
followSourceRoutes.get('/track/:code', async (c) => {
  try {
    const code = c.req.param('code');
    const source = await c.env.DB.prepare(
      'SELECT id, source_code FROM follow_sources WHERE source_code = ? AND is_active = 1'
    ).bind(code).first();

    if (!source) return c.json({ success: false, error: 'Source not found' }, 404);

    // Record the visit (we'll associate the user on follow event via source_code cookie/param)
    // Store source_code in a temporary tracking table or use the LINE add-friend URL with source param
    // For LINE: redirect to LINE add-friend URL
    const lineAddUrl = `https://line.me/R/ti/p/@${c.env.LINE_BOT_BASIC_ID || 'linebot'}`;

    // Return tracking info (frontend will redirect)
    return c.json({
      success: true,
      data: {
        source_code: code,
        redirect_url: lineAddUrl,
      },
    });
  } catch (err) {
    console.error('Track error:', err);
    return c.json({ success: false, error: 'トラッキングに失敗しました' }, 500);
  }
});

// ─── Auth required routes ───
followSourceRoutes.use('/sources/*', authMiddleware);
followSourceRoutes.use('/analytics', authMiddleware);
followSourceRoutes.use('/analytics/*', authMiddleware);
followSourceRoutes.use('/daily', authMiddleware);

// ─── GET /sources — 経路一覧 ───
followSourceRoutes.get('/sources', async (c) => {
  try {
    const rows = await c.env.DB.prepare(
      `SELECT fs.*,
        (SELECT COUNT(*) FROM follow_events fe WHERE fe.source_id = fs.id) as follow_count,
        (SELECT MAX(fe.followed_at) FROM follow_events fe WHERE fe.source_id = fs.id) as last_follow_at
       FROM follow_sources fs
       ORDER BY fs.created_at DESC`
    ).all();

    // Also get "unknown source" count
    const unknownCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as c FROM follow_events WHERE source_id IS NULL'
    ).first<{ c: number }>();

    return c.json({
      success: true,
      data: rows.results || [],
      unknown_source_count: unknownCount?.c || 0,
    });
  } catch (err) {
    console.error('List sources error:', err);
    return c.json({ success: false, error: '経路一覧の取得に失敗しました' }, 500);
  }
});

// ─── POST /sources — 経路作成 ───
followSourceRoutes.post('/sources', async (c) => {
  try {
    const body = await c.req.json<{
      name: string;
      source_type?: string;
      description?: string;
    }>();

    if (!body.name) return c.json({ success: false, error: 'name is required' }, 400);

    const validTypes = ['qr', 'url', 'ad', 'sns', 'print', 'other'];
    const sourceType = validTypes.includes(body.source_type || '') ? body.source_type! : 'qr';

    // Generate unique source code
    const sourceCode = generateSourceCode();
    const id = crypto.randomUUID();

    await c.env.DB.prepare(
      'INSERT INTO follow_sources (id, name, source_type, source_code, description) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, body.name, sourceType, sourceCode, body.description || null).run();

    const source = await c.env.DB.prepare('SELECT * FROM follow_sources WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: source }, 201);
  } catch (err) {
    console.error('Create source error:', err);
    return c.json({ success: false, error: '経路の作成に失敗しました' }, 500);
  }
});

// ─── GET /sources/:id — 経路詳細 ───
followSourceRoutes.get('/sources/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const source = await c.env.DB.prepare('SELECT * FROM follow_sources WHERE id = ?').bind(id).first();
    if (!source) return c.json({ success: false, error: 'Not found' }, 404);

    // Recent follow events
    const events = await c.env.DB.prepare(
      `SELECT fe.*, u.display_name, u.picture_url
       FROM follow_events fe
       LEFT JOIN users u ON fe.user_id = u.id
       WHERE fe.source_id = ?
       ORDER BY fe.followed_at DESC LIMIT 50`
    ).bind(id).all();

    // Daily trend for this source (last 30 days)
    const daily = await c.env.DB.prepare(
      `SELECT date(followed_at) as date, COUNT(*) as count
       FROM follow_events
       WHERE source_id = ? AND followed_at >= datetime('now', '-30 days')
       GROUP BY date(followed_at)
       ORDER BY date ASC`
    ).bind(id).all();

    return c.json({
      success: true,
      data: {
        ...source,
        events: events.results || [],
        daily: daily.results || [],
      },
    });
  } catch (err) {
    console.error('Get source error:', err);
    return c.json({ success: false, error: '経路の取得に失敗しました' }, 500);
  }
});

// ─── PUT /sources/:id — 経路更新 ───
followSourceRoutes.put('/sources/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await c.env.DB.prepare('SELECT * FROM follow_sources WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ success: false, error: 'Not found' }, 404);

    const body = await c.req.json<{
      name?: string;
      source_type?: string;
      description?: string;
      is_active?: number;
    }>();

    const sets: string[] = [];
    const vals: any[] = [];
    if (body.name) { sets.push('name = ?'); vals.push(body.name); }
    if (body.source_type) { sets.push('source_type = ?'); vals.push(body.source_type); }
    if (body.description !== undefined) { sets.push('description = ?'); vals.push(body.description); }
    if (body.is_active !== undefined) { sets.push('is_active = ?'); vals.push(body.is_active); }
    if (!sets.length) return c.json({ success: false, error: 'No fields to update' }, 400);

    sets.push("updated_at = datetime('now')");
    await c.env.DB.prepare('UPDATE follow_sources SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals, id).run();

    const updated = await c.env.DB.prepare('SELECT * FROM follow_sources WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update source error:', err);
    return c.json({ success: false, error: '経路の更新に失敗しました' }, 500);
  }
});

// ─── DELETE /sources/:id — 経路削除 ───
followSourceRoutes.delete('/sources/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await c.env.DB.prepare('SELECT * FROM follow_sources WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ success: false, error: 'Not found' }, 404);

    // Nullify source_id in follow_events (keep events)
    await c.env.DB.prepare('UPDATE follow_events SET source_id = NULL WHERE source_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM follow_sources WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('Delete source error:', err);
    return c.json({ success: false, error: '経路の削除に失敗しました' }, 500);
  }
});

// ─── GET /analytics — 経路別分析 ───
followSourceRoutes.get('/analytics', async (c) => {
  try {
    const from = c.req.query('from');
    const to = c.req.query('to');
    const dateFrom = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const dateTo = to || new Date().toISOString().split('T')[0];

    // Total follows in period
    const totalFollows = await c.env.DB.prepare(
      `SELECT COUNT(*) as total, COUNT(DISTINCT user_id) as unique_users
       FROM follow_events WHERE followed_at >= ? AND followed_at < date(?, '+1 day')`
    ).bind(dateFrom, dateTo).first<{ total: number; unique_users: number }>();

    // By source
    const bySource = await c.env.DB.prepare(
      `SELECT
        fs.id, fs.name, fs.source_type, fs.source_code,
        COUNT(fe.id) as follow_count,
        COUNT(DISTINCT fe.user_id) as unique_users
       FROM follow_sources fs
       LEFT JOIN follow_events fe ON fs.id = fe.source_id
         AND fe.followed_at >= ? AND fe.followed_at < date(?, '+1 day')
       WHERE fs.is_active = 1
       GROUP BY fs.id
       ORDER BY follow_count DESC`
    ).bind(dateFrom, dateTo).all();

    // Unknown source
    const unknownFollows = await c.env.DB.prepare(
      `SELECT COUNT(*) as c FROM follow_events
       WHERE source_id IS NULL AND followed_at >= ? AND followed_at < date(?, '+1 day')`
    ).bind(dateFrom, dateTo).first<{ c: number }>();

    // By source type
    const byType = await c.env.DB.prepare(
      `SELECT
        fs.source_type,
        COUNT(fe.id) as follow_count
       FROM follow_events fe
       LEFT JOIN follow_sources fs ON fe.source_id = fs.id
       WHERE fe.followed_at >= ? AND fe.followed_at < date(?, '+1 day')
       AND fe.source_id IS NOT NULL
       GROUP BY fs.source_type
       ORDER BY follow_count DESC`
    ).bind(dateFrom, dateTo).all();

    // CV funnel per source (follow → message → conversion)
    const sourceFunnel = await c.env.DB.prepare(
      `SELECT
        fs.id, fs.name,
        COUNT(DISTINCT fe.user_id) as followers,
        (SELECT COUNT(DISTINCT m.user_id) FROM messages m
         WHERE m.direction = 'inbound' AND m.user_id IN (
           SELECT fe2.user_id FROM follow_events fe2 WHERE fe2.source_id = fs.id
         ) AND m.sent_at >= ? AND m.sent_at < date(?, '+1 day')
        ) as messaged_users,
        (SELECT COUNT(DISTINCT cv.user_id) FROM conversions cv
         WHERE cv.user_id IN (
           SELECT fe3.user_id FROM follow_events fe3 WHERE fe3.source_id = fs.id
         ) AND cv.converted_at >= ? AND cv.converted_at < date(?, '+1 day')
        ) as converted_users
       FROM follow_sources fs
       LEFT JOIN follow_events fe ON fs.id = fe.source_id
         AND fe.followed_at >= ? AND fe.followed_at < date(?, '+1 day')
       WHERE fs.is_active = 1
       GROUP BY fs.id
       HAVING followers > 0
       ORDER BY followers DESC`
    ).bind(dateFrom, dateTo, dateFrom, dateTo, dateFrom, dateTo).all();

    // Previous period for comparison
    const periodMs = new Date(dateTo).getTime() - new Date(dateFrom).getTime() + 86400000;
    const periodDays = Math.ceil(periodMs / 86400000);
    const prevFrom = new Date(new Date(dateFrom).getTime() - periodDays * 86400000).toISOString().split('T')[0];
    const prevTo = new Date(new Date(dateFrom).getTime() - 86400000).toISOString().split('T')[0];

    const prevFollows = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM follow_events
       WHERE followed_at >= ? AND followed_at < date(?, '+1 day')`
    ).bind(prevFrom, prevTo).first<{ total: number }>();

    return c.json({
      success: true,
      data: {
        summary: {
          total_follows: totalFollows?.total || 0,
          unique_users: totalFollows?.unique_users || 0,
          unknown_source: unknownFollows?.c || 0,
          previous_total: prevFollows?.total || 0,
          change: (totalFollows?.total || 0) - (prevFollows?.total || 0),
        },
        by_source: bySource.results || [],
        by_type: byType.results || [],
        funnel: sourceFunnel.results || [],
        period: { from: dateFrom, to: dateTo },
      },
    });
  } catch (err) {
    console.error('Analytics error:', err);
    return c.json({ success: false, error: '分析の取得に失敗しました' }, 500);
  }
});

// ─── GET /daily — 日別友だち追加推移 ───
followSourceRoutes.get('/daily', async (c) => {
  try {
    const from = c.req.query('from');
    const to = c.req.query('to');
    const sourceId = c.req.query('source_id');
    const dateFrom = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const dateTo = to || new Date().toISOString().split('T')[0];

    let query = `SELECT date(followed_at) as date, COUNT(*) as count, COUNT(DISTINCT user_id) as unique_users
       FROM follow_events
       WHERE followed_at >= ? AND followed_at < date(?, '+1 day')`;
    const binds: any[] = [dateFrom, dateTo];

    if (sourceId) {
      query += ' AND source_id = ?';
      binds.push(sourceId);
    }

    query += ' GROUP BY date(followed_at) ORDER BY date ASC';
    const rows = await c.env.DB.prepare(query).bind(...binds).all();

    return c.json({
      success: true,
      data: { daily: rows.results || [], period: { from: dateFrom, to: dateTo } },
    });
  } catch (err) {
    console.error('Daily error:', err);
    return c.json({ success: false, error: '日別推移の取得に失敗しました' }, 500);
  }
});

// ─── Helper ───
function generateSourceCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
