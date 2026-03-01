import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const analyticsRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
analyticsRoutes.use('*', authMiddleware);

// GET /delivery-effectiveness — 配信効果分析
analyticsRoutes.get('/delivery-effectiveness', async (c) => {
  try {
    // Weekly sent/failed rates over last 30 days
    const weekly = await c.env.DB.prepare(`
      SELECT
        strftime('%Y-W%W', created_at) as week,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        CASE
          WHEN COUNT(*) > 0
          THEN ROUND(CAST(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1)
          ELSE 0
        END as rate
      FROM delivery_logs
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY strftime('%Y-W%W', created_at)
      ORDER BY week ASC
    `).all();

    // Scenario delivery success rates
    const byScenario = await c.env.DB.prepare(`
      SELECT
        dl.scenario_id,
        COALESCE(s.name, '手動配信') as name,
        SUM(CASE WHEN dl.status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN dl.status = 'failed' THEN 1 ELSE 0 END) as failed,
        CASE
          WHEN COUNT(*) > 0
          THEN ROUND(CAST(SUM(CASE WHEN dl.status = 'sent' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 1)
          ELSE 0
        END as rate
      FROM delivery_logs dl
      LEFT JOIN scenarios s ON dl.scenario_id = s.id
      WHERE dl.created_at >= datetime('now', '-30 days')
      GROUP BY dl.scenario_id
      ORDER BY sent DESC
    `).all();

    return c.json({
      success: true,
      data: {
        weekly: weekly.results || [],
        by_scenario: byScenario.results || [],
      },
    });
  } catch (err) {
    console.error('delivery-effectiveness error:', err);
    return c.json({ success: false, error: 'Failed to fetch delivery effectiveness' }, 500);
  }
});

// GET /user-activity — ユーザーエンゲージメント
analyticsRoutes.get('/user-activity', async (c) => {
  try {
    // Active users: messaged in last 7 days
    const active = await c.env.DB.prepare(`
      SELECT COUNT(DISTINCT user_id) as c FROM messages
      WHERE direction = 'inbound' AND sent_at >= datetime('now', '-7 days')
    `).first<{ c: number }>();

    // At-risk users: last message 14-30 days ago
    const atRisk = await c.env.DB.prepare(`
      SELECT COUNT(*) as c FROM (
        SELECT user_id, MAX(sent_at) as last_msg FROM messages
        WHERE direction = 'inbound'
        GROUP BY user_id
        HAVING last_msg < datetime('now', '-14 days') AND last_msg >= datetime('now', '-30 days')
      )
    `).first<{ c: number }>();

    // Dormant users: no message in 30+ days
    const dormant = await c.env.DB.prepare(`
      SELECT COUNT(*) as c FROM (
        SELECT user_id, MAX(sent_at) as last_msg FROM messages
        WHERE direction = 'inbound'
        GROUP BY user_id
        HAVING last_msg < datetime('now', '-30 days')
      )
    `).first<{ c: number }>();

    // Total users
    const total = await c.env.DB.prepare(`
      SELECT COUNT(*) as c FROM users WHERE status = 'active'
    `).first<{ c: number }>();

    // Activity trend: daily active users over last 30 days
    const trend = await c.env.DB.prepare(`
      SELECT
        date(sent_at) as date,
        COUNT(DISTINCT user_id) as active_users
      FROM messages
      WHERE direction = 'inbound' AND sent_at >= datetime('now', '-30 days')
      GROUP BY date(sent_at)
      ORDER BY date ASC
    `).all();

    return c.json({
      success: true,
      data: {
        active: active?.c || 0,
        at_risk: atRisk?.c || 0,
        dormant: dormant?.c || 0,
        total: total?.c || 0,
        activity_trend: trend.results || [],
      },
    });
  } catch (err) {
    console.error('user-activity error:', err);
    return c.json({ success: false, error: 'Failed to fetch user activity' }, 500);
  }
});

// GET /ai-performance — AIパフォーマンス
analyticsRoutes.get('/ai-performance', async (c) => {
  try {
    // Average confidence
    const avgConf = await c.env.DB.prepare(`
      SELECT AVG(confidence) as avg FROM ai_chat_logs
      WHERE created_at >= datetime('now', '-30 days')
    `).first<{ avg: number | null }>();

    // Escalation rate
    const totalChats = await c.env.DB.prepare(`
      SELECT COUNT(*) as c FROM ai_chat_logs
      WHERE created_at >= datetime('now', '-30 days')
    `).first<{ c: number }>();

    const escalated = await c.env.DB.prepare(`
      SELECT COUNT(*) as c FROM ai_chat_logs
      WHERE should_escalate = 1 AND created_at >= datetime('now', '-30 days')
    `).first<{ c: number }>();

    // Average response time
    const avgTime = await c.env.DB.prepare(`
      SELECT AVG(response_time_ms) as avg FROM ai_chat_logs
      WHERE response_time_ms IS NOT NULL AND created_at >= datetime('now', '-30 days')
    `).first<{ avg: number | null }>();

    // Top knowledge articles used
    const topKnowledge = await c.env.DB.prepare(`
      SELECT
        kb.id,
        kb.title,
        COUNT(*) as usage_count
      FROM ai_chat_logs acl
      JOIN knowledge_base kb ON (',' || acl.knowledge_ids || ',') LIKE ('%,' || kb.id || ',%')
      WHERE acl.knowledge_ids IS NOT NULL
        AND acl.knowledge_ids != ''
        AND acl.created_at >= datetime('now', '-30 days')
      GROUP BY kb.id, kb.title
      ORDER BY usage_count DESC
      LIMIT 10
    `).all();

    // Daily chat / escalation trend
    const daily = await c.env.DB.prepare(`
      SELECT
        date(created_at) as date,
        COUNT(*) as chats,
        SUM(CASE WHEN should_escalate = 1 THEN 1 ELSE 0 END) as escalations
      FROM ai_chat_logs
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).all();

    const total = totalChats?.c || 0;
    const escalationRate = total > 0
      ? Math.round(((escalated?.c || 0) / total) * 1000) / 10
      : 0;

    return c.json({
      success: true,
      data: {
        avg_confidence: Math.round((avgConf?.avg || 0) * 100) / 100,
        escalation_rate: escalationRate,
        avg_response_ms: Math.round(avgTime?.avg || 0),
        total_chats: total,
        top_knowledge: topKnowledge.results || [],
        daily: daily.results || [],
      },
    });
  } catch (err) {
    console.error('ai-performance error:', err);
    return c.json({ success: false, error: 'Failed to fetch AI performance' }, 500);
  }
});

// GET /churn-risk — 離脱リスクスコアリング
analyticsRoutes.get('/churn-risk', async (c) => {
  try {
    // Calculate churn risk per user:
    // - days_since_last: days since last inbound message
    // - msg_count_30d: message count in last 30 days
    // - msg_count_prev_30d: message count in 30-60 days ago (for trend)
    // Risk score = weighted combination (0-100, higher = more likely to churn)
    const users = await c.env.DB.prepare(`
      SELECT
        u.id,
        u.display_name,
        u.picture_url,
        COALESCE(
          CAST(julianday('now') - julianday(MAX(m.sent_at)) AS INTEGER),
          999
        ) as days_since_last,
        COUNT(CASE WHEN m.sent_at >= datetime('now', '-30 days') AND m.direction = 'inbound' THEN 1 END) as msg_count_30d,
        COUNT(CASE WHEN m.sent_at >= datetime('now', '-60 days') AND m.sent_at < datetime('now', '-30 days') AND m.direction = 'inbound' THEN 1 END) as msg_count_prev_30d,
        MAX(m.sent_at) as last_active
      FROM users u
      LEFT JOIN messages m ON u.id = m.user_id AND m.direction = 'inbound'
      WHERE u.status = 'active'
      GROUP BY u.id
      ORDER BY days_since_last DESC
    `).all<{
      id: string;
      display_name: string | null;
      picture_url: string | null;
      days_since_last: number;
      msg_count_30d: number;
      msg_count_prev_30d: number;
      last_active: string | null;
    }>();

    const allUsers = users.results || [];

    // Score calculation:
    // - Inactivity component (0-50): based on days since last message
    //   0-7 days = 0, 7-14 = 10, 14-30 = 25, 30-60 = 40, 60+ = 50
    // - Frequency decline component (0-30): if msg_count_30d < msg_count_prev_30d
    // - Low engagement component (0-20): if very few messages overall
    const scored = allUsers.map((u) => {
      let score = 0;

      // Inactivity component (0-50)
      const days = u.days_since_last;
      if (days >= 60) score += 50;
      else if (days >= 30) score += 40;
      else if (days >= 14) score += 25;
      else if (days >= 7) score += 10;

      // Frequency decline component (0-30)
      if (u.msg_count_prev_30d > 0 && u.msg_count_30d < u.msg_count_prev_30d) {
        const decline = 1 - u.msg_count_30d / u.msg_count_prev_30d;
        score += Math.round(decline * 30);
      } else if (u.msg_count_prev_30d > 0 && u.msg_count_30d === 0) {
        score += 30;
      }

      // Low engagement component (0-20)
      if (u.msg_count_30d === 0) score += 20;
      else if (u.msg_count_30d <= 2) score += 10;
      else if (u.msg_count_30d <= 5) score += 5;

      return {
        id: u.id,
        display_name: u.display_name,
        picture_url: u.picture_url,
        risk_score: Math.min(score, 100),
        last_active: u.last_active,
        message_count_30d: u.msg_count_30d,
      };
    });

    // Sort by risk score descending, take top 20
    scored.sort((a, b) => b.risk_score - a.risk_score);
    const top20 = scored.slice(0, 20);

    // Summary counts
    const highRisk = scored.filter((u) => u.risk_score >= 70).length;
    const mediumRisk = scored.filter((u) => u.risk_score >= 40 && u.risk_score < 70).length;
    const lowRisk = scored.filter((u) => u.risk_score < 40).length;

    return c.json({
      success: true,
      data: {
        users: top20,
        summary: {
          high_risk: highRisk,
          medium_risk: mediumRisk,
          low_risk: lowRisk,
        },
      },
    });
  } catch (err) {
    console.error('churn-risk error:', err);
    return c.json({ success: false, error: 'Failed to fetch churn risk' }, 500);
  }
});
