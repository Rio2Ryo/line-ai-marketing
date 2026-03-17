import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { cached } from '../lib/cache';
import { callClaude } from '../lib/claude';

type AuthVars = { userId: string };
export const chatAnalyticsRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
chatAnalyticsRoutes.use('*', authMiddleware);

// ─── GET /overview — 会話品質サマリー ───

chatAnalyticsRoutes.get('/overview', async (c) => {
  try {
    const days = Number(c.req.query('days') || '30');
    const data = await cached(c.env.DB, `chat-analytics:overview:${days}`, 120, async () => {
      const [total, escalated, avgConf, avgTime, resolved, knowledgeHit] = await Promise.all([
        c.env.DB.prepare(
          `SELECT COUNT(*) as c FROM ai_chat_logs WHERE created_at >= datetime('now', '-${days} days')`
        ).first<{ c: number }>(),
        c.env.DB.prepare(
          `SELECT COUNT(*) as c FROM ai_chat_logs WHERE should_escalate = 1 AND created_at >= datetime('now', '-${days} days')`
        ).first<{ c: number }>(),
        c.env.DB.prepare(
          `SELECT AVG(confidence) as v FROM ai_chat_logs WHERE created_at >= datetime('now', '-${days} days')`
        ).first<{ v: number | null }>(),
        c.env.DB.prepare(
          `SELECT AVG(response_time_ms) as v FROM ai_chat_logs WHERE response_time_ms IS NOT NULL AND created_at >= datetime('now', '-${days} days')`
        ).first<{ v: number | null }>(),
        c.env.DB.prepare(
          `SELECT COUNT(*) as c FROM escalations WHERE status = 'resolved' AND created_at >= datetime('now', '-${days} days')`
        ).first<{ c: number }>(),
        c.env.DB.prepare(
          `SELECT COUNT(*) as c FROM ai_chat_logs WHERE knowledge_ids IS NOT NULL AND knowledge_ids != '[]' AND knowledge_ids != '' AND created_at >= datetime('now', '-${days} days')`
        ).first<{ c: number }>(),
      ]);

      const totalCount = total?.c || 0;
      const escalatedCount = escalated?.c || 0;
      const resolvedCount = resolved?.c || 0;
      const knowledgeHitCount = knowledgeHit?.c || 0;

      // Satisfaction score: composite (0-100)
      // - confidence weight 40%
      // - non-escalation rate weight 30%
      // - knowledge hit rate weight 20%
      // - resolution rate weight 10%
      const confScore = (avgConf?.v || 0) * 100;
      const nonEscRate = totalCount > 0 ? ((totalCount - escalatedCount) / totalCount) * 100 : 100;
      const kbHitRate = totalCount > 0 ? (knowledgeHitCount / totalCount) * 100 : 0;
      const resRate = escalatedCount > 0 ? (resolvedCount / escalatedCount) * 100 : 100;
      const satisfactionScore = Math.round(confScore * 0.4 + nonEscRate * 0.3 + kbHitRate * 0.2 + resRate * 0.1);

      return {
        total_conversations: totalCount,
        satisfaction_score: satisfactionScore,
        escalation_rate: totalCount > 0 ? Math.round((escalatedCount / totalCount) * 1000) / 10 : 0,
        avg_confidence: Math.round((avgConf?.v || 0) * 100) / 100,
        avg_response_ms: Math.round(avgTime?.v || 0),
        knowledge_hit_rate: totalCount > 0 ? Math.round((knowledgeHitCount / totalCount) * 1000) / 10 : 0,
        resolution_rate: escalatedCount > 0 ? Math.round((resolvedCount / escalatedCount) * 1000) / 10 : 0,
        escalated_count: escalatedCount,
        resolved_count: resolvedCount,
      };
    });
    return c.json({ success: true, data });
  } catch (e) {
    console.error('chat-analytics overview error:', e);
    return c.json({ success: false, error: 'Failed to fetch overview' }, 500);
  }
});

// ─── GET /satisfaction-trend — 日別満足度推移 ───

chatAnalyticsRoutes.get('/satisfaction-trend', async (c) => {
  try {
    const days = Number(c.req.query('days') || '30');
    const data = await cached(c.env.DB, `chat-analytics:satisfaction-trend:${days}`, 120, async () => {
      const rows = await c.env.DB.prepare(`
        SELECT
          date(created_at) as date,
          COUNT(*) as total,
          AVG(confidence) as avg_confidence,
          SUM(CASE WHEN should_escalate = 1 THEN 1 ELSE 0 END) as escalations,
          AVG(response_time_ms) as avg_response_ms,
          SUM(CASE WHEN knowledge_ids IS NOT NULL AND knowledge_ids != '[]' AND knowledge_ids != '' THEN 1 ELSE 0 END) as kb_hits
        FROM ai_chat_logs
        WHERE created_at >= datetime('now', '-${days} days')
        GROUP BY date(created_at)
        ORDER BY date ASC
      `).all();

      return (rows.results || []).map((r: any) => ({
        date: r.date,
        total: r.total,
        avg_confidence: Math.round((r.avg_confidence || 0) * 100) / 100,
        escalations: r.escalations,
        avg_response_ms: Math.round(r.avg_response_ms || 0),
        kb_hit_rate: r.total > 0 ? Math.round((r.kb_hits / r.total) * 100) : 0,
        satisfaction: Math.round(
          (r.avg_confidence || 0) * 40 +
          (r.total > 0 ? ((r.total - r.escalations) / r.total) : 1) * 30 +
          (r.total > 0 ? (r.kb_hits / r.total) : 0) * 20 +
          10
        ),
      }));
    });
    return c.json({ success: true, data });
  } catch (e) {
    console.error('satisfaction-trend error:', e);
    return c.json({ success: false, error: 'Failed to fetch satisfaction trend' }, 500);
  }
});

// ─── GET /faq — FAQ自動抽出 ───

chatAnalyticsRoutes.get('/faq', async (c) => {
  try {
    const days = Number(c.req.query('days') || '30');
    const limit = Number(c.req.query('limit') || '20');
    const data = await cached(c.env.DB, `chat-analytics:faq:${days}:${limit}`, 300, async () => {
      // Get all user messages with their AI replies and confidence
      const rows = await c.env.DB.prepare(`
        SELECT
          user_message,
          ai_reply,
          confidence,
          should_escalate,
          knowledge_ids
        FROM ai_chat_logs
        WHERE created_at >= datetime('now', '-${days} days')
        ORDER BY created_at DESC
        LIMIT 500
      `).all<{
        user_message: string;
        ai_reply: string;
        confidence: number;
        should_escalate: number;
        knowledge_ids: string | null;
      }>();

      const messages = rows.results || [];

      // Simple FAQ extraction: normalize messages and count frequency
      const normalized = new Map<string, {
        original: string;
        count: number;
        avg_confidence: number;
        escalation_count: number;
        sample_reply: string;
        has_knowledge: boolean;
      }>();

      for (const msg of messages) {
        // Normalize: lowercase, remove whitespace/punctuation
        const key = msg.user_message
          .toLowerCase()
          .replace(/[！？!?。、,.\s]+/g, '')
          .substring(0, 60);

        if (key.length < 3) continue;

        const existing = normalized.get(key);
        if (existing) {
          existing.count++;
          existing.avg_confidence = (existing.avg_confidence * (existing.count - 1) + msg.confidence) / existing.count;
          if (msg.should_escalate) existing.escalation_count++;
        } else {
          const kIds = msg.knowledge_ids ? msg.knowledge_ids : '';
          normalized.set(key, {
            original: msg.user_message,
            count: 1,
            avg_confidence: msg.confidence,
            escalation_count: msg.should_escalate ? 1 : 0,
            sample_reply: msg.ai_reply?.substring(0, 100) || '',
            has_knowledge: kIds !== '' && kIds !== '[]',
          });
        }
      }

      // Sort by frequency, take top N
      const sorted = [...normalized.values()]
        .filter(f => f.count >= 2)
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
        .map((f, i) => ({
          rank: i + 1,
          question: f.original,
          count: f.count,
          avg_confidence: Math.round(f.avg_confidence * 100) / 100,
          escalation_rate: f.count > 0 ? Math.round((f.escalation_count / f.count) * 100) : 0,
          sample_reply: f.sample_reply,
          has_knowledge: f.has_knowledge,
        }));

      return sorted;
    });
    return c.json({ success: true, data });
  } catch (e) {
    console.error('faq extraction error:', e);
    return c.json({ success: false, error: 'Failed to extract FAQs' }, 500);
  }
});

// ─── GET /knowledge-gaps — ナレッジベース改善提案 ───

chatAnalyticsRoutes.get('/knowledge-gaps', async (c) => {
  try {
    const days = Number(c.req.query('days') || '30');
    const data = await cached(c.env.DB, `chat-analytics:knowledge-gaps:${days}`, 300, async () => {
      // Find low-confidence conversations with no knowledge match
      const lowConf = await c.env.DB.prepare(`
        SELECT
          user_message,
          ai_reply,
          confidence,
          knowledge_ids,
          created_at
        FROM ai_chat_logs
        WHERE confidence < 0.5
          AND created_at >= datetime('now', '-${days} days')
        ORDER BY confidence ASC
        LIMIT 100
      `).all<{
        user_message: string;
        ai_reply: string;
        confidence: number;
        knowledge_ids: string | null;
        created_at: string;
      }>();

      const gaps = lowConf.results || [];

      // Group by topic keywords
      const topicMap = new Map<string, {
        topic: string;
        count: number;
        avg_confidence: number;
        sample_questions: string[];
        has_knowledge: boolean;
      }>();

      for (const g of gaps) {
        // Extract main keywords (first 2-3 meaningful words)
        const words = g.user_message
          .replace(/[！？!?。、,.]/g, '')
          .split(/\s+/)
          .filter(w => w.length >= 2)
          .slice(0, 3);
        const topic = words.join(' ') || g.user_message.substring(0, 20);
        const kIds = g.knowledge_ids || '';
        const hasKb = kIds !== '' && kIds !== '[]';

        const existing = topicMap.get(topic);
        if (existing) {
          existing.count++;
          existing.avg_confidence = (existing.avg_confidence * (existing.count - 1) + g.confidence) / existing.count;
          if (existing.sample_questions.length < 3) existing.sample_questions.push(g.user_message);
        } else {
          topicMap.set(topic, {
            topic,
            count: 1,
            avg_confidence: g.confidence,
            sample_questions: [g.user_message],
            has_knowledge: hasKb,
          });
        }
      }

      const sorted = [...topicMap.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 15)
        .map(t => ({
          ...t,
          avg_confidence: Math.round(t.avg_confidence * 100) / 100,
          suggestion: t.has_knowledge
            ? 'ナレッジベースの内容を見直してください。関連記事はあるが回答品質が低いです。'
            : 'このトピックのナレッジベース記事を新規追加してください。',
        }));

      // Knowledge base stats
      const kbTotal = await c.env.DB.prepare('SELECT COUNT(*) as c FROM knowledge_base WHERE is_active = 1').first<{ c: number }>();
      const kbUsed = await c.env.DB.prepare(`
        SELECT COUNT(DISTINCT kb.id) as c
        FROM knowledge_base kb
        JOIN ai_chat_logs acl ON acl.knowledge_ids LIKE '%' || kb.id || '%'
        WHERE acl.created_at >= datetime('now', '-${days} days')
          AND kb.is_active = 1
      `).first<{ c: number }>();

      return {
        gaps: sorted,
        knowledge_stats: {
          total_articles: kbTotal?.c || 0,
          used_articles: kbUsed?.c || 0,
          unused_articles: (kbTotal?.c || 0) - (kbUsed?.c || 0),
          coverage_rate: (kbTotal?.c || 0) > 0
            ? Math.round(((kbUsed?.c || 0) / (kbTotal?.c || 0)) * 100)
            : 0,
        },
      };
    });
    return c.json({ success: true, data });
  } catch (e) {
    console.error('knowledge-gaps error:', e);
    return c.json({ success: false, error: 'Failed to analyze knowledge gaps' }, 500);
  }
});

// ─── GET /quality — 会話品質スコア詳細 ───

chatAnalyticsRoutes.get('/quality', async (c) => {
  try {
    const days = Number(c.req.query('days') || '30');
    const data = await cached(c.env.DB, `chat-analytics:quality:${days}`, 120, async () => {
      const [confDist, timeDist, hourly, topUsers] = await Promise.all([
        // Confidence distribution
        c.env.DB.prepare(`
          SELECT
            CASE
              WHEN confidence >= 0.8 THEN 'high'
              WHEN confidence >= 0.5 THEN 'medium'
              ELSE 'low'
            END as level,
            COUNT(*) as count
          FROM ai_chat_logs
          WHERE created_at >= datetime('now', '-${days} days')
          GROUP BY level
        `).all(),
        // Response time distribution
        c.env.DB.prepare(`
          SELECT
            CASE
              WHEN response_time_ms < 1000 THEN 'fast'
              WHEN response_time_ms < 3000 THEN 'normal'
              WHEN response_time_ms < 5000 THEN 'slow'
              ELSE 'very_slow'
            END as speed,
            COUNT(*) as count
          FROM ai_chat_logs
          WHERE response_time_ms IS NOT NULL AND created_at >= datetime('now', '-${days} days')
          GROUP BY speed
        `).all(),
        // Hourly distribution
        c.env.DB.prepare(`
          SELECT
            CAST(strftime('%H', created_at) AS INTEGER) as hour,
            COUNT(*) as count,
            AVG(confidence) as avg_conf
          FROM ai_chat_logs
          WHERE created_at >= datetime('now', '-${days} days')
          GROUP BY hour
          ORDER BY hour
        `).all(),
        // Top users by conversation count
        c.env.DB.prepare(`
          SELECT
            u.id, u.display_name, u.picture_url,
            COUNT(*) as chat_count,
            AVG(acl.confidence) as avg_confidence,
            SUM(CASE WHEN acl.should_escalate = 1 THEN 1 ELSE 0 END) as escalations
          FROM ai_chat_logs acl
          JOIN users u ON acl.user_id = u.id
          WHERE acl.created_at >= datetime('now', '-${days} days')
          GROUP BY u.id
          ORDER BY chat_count DESC
          LIMIT 10
        `).all(),
      ]);

      return {
        confidence_distribution: (confDist.results || []).reduce((acc: any, r: any) => {
          acc[r.level] = r.count;
          return acc;
        }, { high: 0, medium: 0, low: 0 }),
        response_time_distribution: (timeDist.results || []).reduce((acc: any, r: any) => {
          acc[r.speed] = r.count;
          return acc;
        }, { fast: 0, normal: 0, slow: 0, very_slow: 0 }),
        hourly_distribution: (hourly.results || []).map((r: any) => ({
          hour: r.hour,
          count: r.count,
          avg_confidence: Math.round((r.avg_conf || 0) * 100) / 100,
        })),
        top_users: (topUsers.results || []).map((r: any) => ({
          id: r.id,
          display_name: r.display_name,
          picture_url: r.picture_url,
          chat_count: r.chat_count,
          avg_confidence: Math.round((r.avg_confidence || 0) * 100) / 100,
          escalations: r.escalations,
        })),
      };
    });
    return c.json({ success: true, data });
  } catch (e) {
    console.error('quality error:', e);
    return c.json({ success: false, error: 'Failed to fetch quality metrics' }, 500);
  }
});

// ─── POST /ai-suggest — AIによる改善提案 ───

chatAnalyticsRoutes.post('/ai-suggest', async (c) => {
  try {
    const days = Number(c.req.query('days') || '30');

    // Gather data for AI analysis
    const [stats, lowConf, topQuestions] = await Promise.all([
      c.env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          AVG(confidence) as avg_conf,
          SUM(CASE WHEN should_escalate = 1 THEN 1 ELSE 0 END) as escalated,
          AVG(response_time_ms) as avg_time
        FROM ai_chat_logs
        WHERE created_at >= datetime('now', '-${days} days')
      `).first<{ total: number; avg_conf: number; escalated: number; avg_time: number }>(),
      c.env.DB.prepare(`
        SELECT user_message, confidence
        FROM ai_chat_logs
        WHERE confidence < 0.4 AND created_at >= datetime('now', '-${days} days')
        ORDER BY confidence ASC
        LIMIT 10
      `).all(),
      c.env.DB.prepare(`
        SELECT user_message, COUNT(*) as cnt
        FROM ai_chat_logs
        WHERE created_at >= datetime('now', '-${days} days')
        GROUP BY user_message
        ORDER BY cnt DESC
        LIMIT 10
      `).all(),
    ]);

    const lowConfQuestions = (lowConf.results || []).map((r: any) => `- ${r.user_message} (信頼度: ${r.confidence})`).join('\n');
    const topQs = (topQuestions.results || []).map((r: any) => `- ${r.user_message} (${r.cnt}回)`).join('\n');
    const totalCount = stats?.total || 0;
    const escalatedCount = stats?.escalated || 0;
    const escRate = totalCount > 0 ? Math.round((escalatedCount / totalCount) * 100) : 0;

    const prompt = `以下のAIチャットボットの分析データに基づいて、改善提案を3〜5件、日本語で簡潔に提示してください。

## 統計 (過去${days}日)
- 総会話数: ${totalCount}
- 平均信頼度: ${Math.round((stats?.avg_conf || 0) * 100)}%
- エスカレーション率: ${escRate}%
- 平均応答時間: ${Math.round(stats?.avg_time || 0)}ms

## 低信頼度の質問 (対応困難)
${lowConfQuestions || 'なし'}

## 頻出質問
${topQs || 'なし'}

各提案は以下のJSON形式で返してください:
[{"title": "提案タイトル", "description": "詳細説明", "priority": "high|medium|low", "action": "具体的なアクション"}]`;

    const content = await callClaude(
      c.env,
      'あなたはAIチャットボットの品質改善コンサルタントです。データに基づいて具体的で実行可能な改善提案をしてください。',
      prompt,
      1500
    );

    // Parse JSON from response
    let suggestions: any[] = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) suggestions = JSON.parse(jsonMatch[0]);
    } catch {
      suggestions = [{ title: 'AI分析結果', description: content, priority: 'medium', action: '確認してください' }];
    }

    return c.json({ success: true, data: { suggestions, analyzed_at: new Date().toISOString() } });
  } catch (e) {
    console.error('ai-suggest error:', e);
    return c.json({ success: false, error: 'Failed to generate suggestions' }, 500);
  }
});
