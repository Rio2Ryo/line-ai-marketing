import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const engagementScoreRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
engagementScoreRoutes.use('*', authMiddleware);

// ─── Scoring weights ───
const WEIGHTS = {
  message: 25,
  engagement: 25,
  conversion: 25,
  retention: 25,
};

function calcRank(score: number): string {
  if (score >= 80) return 'S';
  if (score >= 60) return 'A';
  if (score >= 40) return 'B';
  if (score >= 20) return 'C';
  return 'D';
}

// Normalize message count to 0-100
function normalizeMessageCount(count: number): number {
  if (count >= 16) return 100;
  if (count >= 6) return 70;
  if (count >= 1) return 40;
  return 0;
}

// Normalize engagement rate (0-1) to 0-100
function normalizeEngagement(rate: number): number {
  if (rate >= 0.5) return 100;
  if (rate >= 0.3) return 80;
  if (rate >= 0.15) return 60;
  if (rate >= 0.05) return 30;
  return 0;
}

// Normalize conversion count to 0-100
function normalizeConversions(count: number): number {
  if (count >= 6) return 100;
  if (count >= 2) return 80;
  if (count >= 1) return 50;
  return 0;
}

// Normalize days since last activity to 0-100
function normalizeRetention(daysSinceLast: number | null): number {
  if (daysSinceLast === null) return 0;
  if (daysSinceLast <= 1) return 100;
  if (daysSinceLast <= 3) return 85;
  if (daysSinceLast <= 7) return 70;
  if (daysSinceLast <= 14) return 50;
  if (daysSinceLast <= 30) return 25;
  return 0;
}

// ─── GET / — スコアランキング一覧 ───
engagementScoreRoutes.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '50');
    const rank = c.req.query('rank');
    const sort = c.req.query('sort') || 'total_score';
    const order = c.req.query('order') || 'desc';
    const offset = (page - 1) * limit;

    const validSorts = ['total_score', 'message_score', 'engagement_score', 'conversion_score', 'retention_score', 'calculated_at'];
    const sortCol = validSorts.includes(sort) ? sort : 'total_score';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    let where = '';
    const binds: any[] = [];
    if (rank) {
      where = 'WHERE es.rank = ?';
      binds.push(rank);
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM engagement_scores es ${where}`
    ).bind(...binds).first<{ total: number }>();

    const rows = await c.env.DB.prepare(
      `SELECT es.*, u.display_name, u.picture_url, u.status as user_status,
        (SELECT COUNT(*) FROM user_tags ut WHERE ut.user_id = es.user_id) as tag_count
       FROM engagement_scores es
       LEFT JOIN users u ON es.user_id = u.id
       ${where}
       ORDER BY es.${sortCol} ${sortOrder}
       LIMIT ? OFFSET ?`
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
    console.error('List scores error:', err);
    return c.json({ success: false, error: 'スコア一覧の取得に失敗しました' }, 500);
  }
});

// ─── GET /distribution — スコア分布 ───
engagementScoreRoutes.get('/distribution', async (c) => {
  try {
    // Rank distribution
    const rankDist = await c.env.DB.prepare(
      `SELECT rank, COUNT(*) as count, ROUND(AVG(total_score), 1) as avg_score
       FROM engagement_scores
       GROUP BY rank
       ORDER BY CASE rank WHEN 'S' THEN 1 WHEN 'A' THEN 2 WHEN 'B' THEN 3 WHEN 'C' THEN 4 WHEN 'D' THEN 5 END`
    ).all();

    // Score histogram (10-point buckets)
    const histogram = await c.env.DB.prepare(
      `SELECT
        CASE
          WHEN total_score >= 90 THEN '90-100'
          WHEN total_score >= 80 THEN '80-89'
          WHEN total_score >= 70 THEN '70-79'
          WHEN total_score >= 60 THEN '60-69'
          WHEN total_score >= 50 THEN '50-59'
          WHEN total_score >= 40 THEN '40-49'
          WHEN total_score >= 30 THEN '30-39'
          WHEN total_score >= 20 THEN '20-29'
          WHEN total_score >= 10 THEN '10-19'
          ELSE '0-9'
        END as bucket,
        COUNT(*) as count
       FROM engagement_scores
       GROUP BY bucket
       ORDER BY MIN(total_score) DESC`
    ).all();

    // Overall stats
    const stats = await c.env.DB.prepare(
      `SELECT
        COUNT(*) as total_users,
        ROUND(AVG(total_score), 1) as avg_score,
        MAX(total_score) as max_score,
        MIN(total_score) as min_score,
        ROUND(AVG(message_score), 1) as avg_message,
        ROUND(AVG(engagement_score), 1) as avg_engagement,
        ROUND(AVG(conversion_score), 1) as avg_conversion,
        ROUND(AVG(retention_score), 1) as avg_retention
       FROM engagement_scores`
    ).first();

    return c.json({
      success: true,
      data: {
        rank_distribution: rankDist.results || [],
        histogram: histogram.results || [],
        stats: stats || {},
      },
    });
  } catch (err) {
    console.error('Distribution error:', err);
    return c.json({ success: false, error: 'スコア分布の取得に失敗しました' }, 500);
  }
});

// ─── GET /user/:id — 個別ユーザースコア詳細 ───
engagementScoreRoutes.get('/user/:id', async (c) => {
  try {
    const userId = c.req.param('id');

    const score = await c.env.DB.prepare(
      `SELECT es.*, u.display_name, u.picture_url, u.status as user_status, u.created_at as user_since
       FROM engagement_scores es
       LEFT JOIN users u ON es.user_id = u.id
       WHERE es.user_id = ?`
    ).bind(userId).first();

    if (!score) return c.json({ success: false, error: 'スコアが見つかりません' }, 404);

    // Get ranking position
    const ranking = await c.env.DB.prepare(
      `SELECT COUNT(*) + 1 as position FROM engagement_scores WHERE total_score > ?`
    ).bind((score as any).total_score).first<{ position: number }>();

    const totalUsers = await c.env.DB.prepare(
      'SELECT COUNT(*) as c FROM engagement_scores'
    ).first<{ c: number }>();

    // Recent activity details
    const recentMessages = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND direction = 'inbound' AND sent_at >= datetime('now', '-30 days')`
    ).bind(userId).first<{ count: number }>();

    const recentDeliveries = await c.env.DB.prepare(
      `SELECT COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent
       FROM delivery_logs WHERE user_id = ? AND created_at >= datetime('now', '-30 days')`
    ).bind(userId).first<{ total: number; sent: number }>();

    const recentConversions = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM conversions WHERE user_id = ? AND converted_at >= datetime('now', '-30 days')`
    ).bind(userId).first<{ count: number }>();

    // Tags
    const tags = await c.env.DB.prepare(
      `SELECT t.name FROM tags t JOIN user_tags ut ON t.id = ut.tag_id WHERE ut.user_id = ?`
    ).bind(userId).all();

    return c.json({
      success: true,
      data: {
        ...score,
        ranking: {
          position: ranking?.position || 0,
          total: totalUsers?.c || 0,
          percentile: totalUsers?.c ? Math.round(((totalUsers.c - (ranking?.position || 0) + 1) / totalUsers.c) * 100) : 0,
        },
        activity: {
          messages_30d: recentMessages?.count || 0,
          deliveries_30d: recentDeliveries?.total || 0,
          deliveries_sent_30d: recentDeliveries?.sent || 0,
          conversions_30d: recentConversions?.count || 0,
        },
        tags: (tags.results || []).map((t: any) => t.name),
      },
    });
  } catch (err) {
    console.error('User score error:', err);
    return c.json({ success: false, error: 'ユーザースコアの取得に失敗しました' }, 500);
  }
});

// ─── POST /calculate — スコア計算 (バッチ) ───
engagementScoreRoutes.post('/calculate', async (c) => {
  try {
    const body = await c.req.json<{ user_ids?: string[] }>().catch(() => ({}));
    const targetUserIds = (body as any)?.user_ids;

    // Get target users
    let users: any[];
    if (targetUserIds && Array.isArray(targetUserIds) && targetUserIds.length > 0) {
      const placeholders = targetUserIds.map(() => '?').join(',');
      const result = await c.env.DB.prepare(
        `SELECT id FROM users WHERE id IN (${placeholders})`
      ).bind(...targetUserIds).all();
      users = result.results || [];
    } else {
      const result = await c.env.DB.prepare(
        "SELECT id FROM users WHERE status = 'active' LIMIT 500"
      ).all();
      users = result.results || [];
    }

    if (users.length === 0) {
      return c.json({ success: true, data: { calculated: 0 } });
    }

    const now = new Date();
    let calculated = 0;

    for (const user of users) {
      const userId = (user as any).id;

      // 1. Message frequency (inbound messages in last 30 days)
      const msgCount = await c.env.DB.prepare(
        `SELECT COUNT(*) as c FROM messages WHERE user_id = ? AND direction = 'inbound' AND sent_at >= datetime('now', '-30 days')`
      ).bind(userId).first<{ c: number }>();
      const msgRaw = normalizeMessageCount(msgCount?.c || 0);

      // 2. Engagement (response rate to deliveries)
      const deliveries = await c.env.DB.prepare(
        `SELECT COUNT(*) as total FROM delivery_logs WHERE user_id = ? AND status = 'sent' AND created_at >= datetime('now', '-30 days')`
      ).bind(userId).first<{ total: number }>();

      const responses = await c.env.DB.prepare(
        `SELECT COUNT(*) as c FROM messages WHERE user_id = ? AND direction = 'inbound' AND sent_at >= datetime('now', '-30 days')`
      ).bind(userId).first<{ c: number }>();

      const engRate = (deliveries?.total || 0) > 0 ? (responses?.c || 0) / deliveries.total : 0;
      const engRaw = normalizeEngagement(engRate);

      // 3. Conversion activity (last 30 days)
      const cvCount = await c.env.DB.prepare(
        `SELECT COUNT(*) as c FROM conversions WHERE user_id = ? AND converted_at >= datetime('now', '-30 days')`
      ).bind(userId).first<{ c: number }>();
      const cvRaw = normalizeConversions(cvCount?.c || 0);

      // 4. Retention (days since last activity)
      const lastActivity = await c.env.DB.prepare(
        `SELECT MAX(ts) as last_ts FROM (
          SELECT MAX(sent_at) as ts FROM messages WHERE user_id = ?
          UNION ALL
          SELECT MAX(converted_at) as ts FROM conversions WHERE user_id = ?
          UNION ALL
          SELECT MAX(created_at) as ts FROM ai_chat_logs WHERE user_id = ?
        )`
      ).bind(userId, userId, userId).first<{ last_ts: string | null }>();

      let daysSince: number | null = null;
      if (lastActivity?.last_ts) {
        daysSince = (now.getTime() - new Date(lastActivity.last_ts).getTime()) / 86400000;
      }
      const retRaw = normalizeRetention(daysSince);

      // Calculate weighted total
      const totalScore = Math.round(
        (msgRaw * WEIGHTS.message / 100) +
        (engRaw * WEIGHTS.engagement / 100) +
        (cvRaw * WEIGHTS.conversion / 100) +
        (retRaw * WEIGHTS.retention / 100)
      );
      const rank = calcRank(totalScore);

      // Upsert
      const existing = await c.env.DB.prepare(
        'SELECT id FROM engagement_scores WHERE user_id = ?'
      ).bind(userId).first();

      if (existing) {
        await c.env.DB.prepare(
          `UPDATE engagement_scores SET
            total_score = ?, rank = ?, message_score = ?, engagement_score = ?,
            conversion_score = ?, retention_score = ?, calculated_at = datetime('now')
           WHERE user_id = ?`
        ).bind(totalScore, rank, msgRaw, engRaw, cvRaw, retRaw, userId).run();
      } else {
        await c.env.DB.prepare(
          `INSERT INTO engagement_scores (id, user_id, total_score, rank, message_score, engagement_score, conversion_score, retention_score)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(crypto.randomUUID(), userId, totalScore, rank, msgRaw, engRaw, cvRaw, retRaw).run();
      }

      calculated++;
    }

    return c.json({ success: true, data: { calculated } });
  } catch (err) {
    console.error('Calculate scores error:', err);
    return c.json({ success: false, error: 'スコア計算に失敗しました' }, 500);
  }
});
