import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const aiOptimizeRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
aiOptimizeRoutes.use('*', authMiddleware);

async function callClaude(env: Env, systemPrompt: string, userMessage: string, maxTokens = 3000): Promise<string> {
  const isFoundry = !!env.ANTHROPIC_RESOURCE;
  const apiUrl = isFoundry
    ? `https://${env.ANTHROPIC_RESOURCE}.services.ai.azure.com/anthropic/v1/messages`
    : 'https://api.anthropic.com/v1/messages';
  const authHeader = isFoundry
    ? { 'Authorization': `Bearer ${env.ANTHROPIC_API_KEY}` }
    : { 'x-api-key': env.ANTHROPIC_API_KEY };
  const modelName = isFoundry ? 'claude-opus-4-6' : 'claude-haiku-4-5-20251001';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${response.status} ${err}`);
  }
  const data = (await response.json()) as any;
  return data.content?.[0]?.text || '';
}

function parseJsonSafe(text: string): any {
  let cleaned = text.trim();
  const m = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) cleaned = m[1].trim();
  return JSON.parse(cleaned);
}

// GET /timing — 時間帯別配信パフォーマンス分析
aiOptimizeRoutes.get('/timing', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '30');

    // Hourly delivery performance
    const hourly = await c.env.DB.prepare(`
      SELECT
        CAST(strftime('%H', created_at) AS INTEGER) as hour,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM delivery_logs
      WHERE created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY strftime('%H', created_at)
      ORDER BY hour ASC
    `).bind(days).all();

    // Day-of-week delivery performance
    const weekly = await c.env.DB.prepare(`
      SELECT
        CAST(strftime('%w', created_at) AS INTEGER) as dow,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM delivery_logs
      WHERE created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY strftime('%w', created_at)
      ORDER BY dow ASC
    `).bind(days).all();

    // Hourly user response rate (inbound messages as indicator of engagement)
    const hourlyResponse = await c.env.DB.prepare(`
      SELECT
        CAST(strftime('%H', sent_at) AS INTEGER) as hour,
        COUNT(*) as responses
      FROM messages
      WHERE direction = 'inbound' AND sent_at >= datetime('now', '-' || ? || ' days')
      GROUP BY strftime('%H', sent_at)
      ORDER BY hour ASC
    `).bind(days).all();

    // Day-of-week user response
    const weeklyResponse = await c.env.DB.prepare(`
      SELECT
        CAST(strftime('%w', sent_at) AS INTEGER) as dow,
        COUNT(*) as responses
      FROM messages
      WHERE direction = 'inbound' AND sent_at >= datetime('now', '-' || ? || ' days')
      GROUP BY strftime('%w', sent_at)
      ORDER BY dow ASC
    `).bind(days).all();

    // Build response maps for quick lookup
    const responseByHour = new Map<number, number>();
    for (const r of (hourlyResponse.results || []) as any[]) {
      responseByHour.set(r.hour, r.responses);
    }
    const responseByDow = new Map<number, number>();
    for (const r of (weeklyResponse.results || []) as any[]) {
      responseByDow.set(r.dow, r.responses);
    }

    // Calculate engagement scores
    const hourlyData = ((hourly.results || []) as any[]).map(h => ({
      hour: h.hour,
      total: h.total,
      sent: h.sent,
      failed: h.failed,
      success_rate: h.total > 0 ? Math.round((h.sent / h.total) * 1000) / 10 : 0,
      responses: responseByHour.get(h.hour) || 0,
      engagement_score: h.sent > 0 ? Math.round(((responseByHour.get(h.hour) || 0) / h.sent) * 1000) / 10 : 0,
    }));

    const dowNames = ['日', '月', '火', '水', '木', '金', '土'];
    const weeklyData = ((weekly.results || []) as any[]).map(w => ({
      dow: w.dow,
      dow_name: dowNames[w.dow] || '',
      total: w.total,
      sent: w.sent,
      failed: w.failed,
      success_rate: w.total > 0 ? Math.round((w.sent / w.total) * 1000) / 10 : 0,
      responses: responseByDow.get(w.dow) || 0,
      engagement_score: w.sent > 0 ? Math.round(((responseByDow.get(w.dow) || 0) / w.sent) * 1000) / 10 : 0,
    }));

    // Find best timing
    const bestHour = hourlyData.reduce((best, h) => h.engagement_score > best.engagement_score ? h : best, hourlyData[0] || { hour: 12, engagement_score: 0 });
    const bestDow = weeklyData.reduce((best, w) => w.engagement_score > best.engagement_score ? w : best, weeklyData[0] || { dow: 1, engagement_score: 0 });

    return c.json({
      success: true,
      data: {
        hourly: hourlyData,
        weekly: weeklyData,
        best_hour: bestHour?.hour ?? 12,
        best_dow: bestDow?.dow ?? 1,
        best_dow_name: dowNames[bestDow?.dow ?? 1] || '',
        period_days: days,
      },
    });
  } catch (err) {
    console.error('Timing analysis error:', err);
    return c.json({ success: false, error: '時間帯分析の取得に失敗しました' }, 500);
  }
});

// GET /message-patterns — メッセージパターン分析
aiOptimizeRoutes.get('/message-patterns', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '30');

    // Outbound message content samples with delivery success info
    const recentMessages = await c.env.DB.prepare(`
      SELECT
        m.content,
        LENGTH(m.content) as content_length,
        m.sent_at,
        (SELECT COUNT(*) FROM messages m2 WHERE m2.user_id = m.user_id AND m2.direction = 'inbound' AND m2.sent_at > m.sent_at AND m2.sent_at <= datetime(m.sent_at, '+24 hours')) as got_reply
      FROM messages m
      WHERE m.direction = 'outbound' AND m.content IS NOT NULL AND m.content != '' AND m.sent_at >= datetime('now', '-' || ? || ' days')
      ORDER BY m.sent_at DESC
      LIMIT 100
    `).bind(days).all();

    const msgs = (recentMessages.results || []) as any[];

    // Message length buckets
    const buckets = [
      { label: '短文 (~50字)', min: 0, max: 50, count: 0, replied: 0 },
      { label: '中文 (51-100字)', min: 51, max: 100, count: 0, replied: 0 },
      { label: '長文 (101-200字)', min: 101, max: 200, count: 0, replied: 0 },
      { label: '超長文 (200字~)', min: 201, max: 99999, count: 0, replied: 0 },
    ];

    for (const m of msgs) {
      const len = m.content_length || 0;
      for (const b of buckets) {
        if (len >= b.min && len <= b.max) {
          b.count++;
          if (m.got_reply > 0) b.replied++;
          break;
        }
      }
    }

    const lengthAnalysis = buckets.map(b => ({
      label: b.label,
      count: b.count,
      replied: b.replied,
      reply_rate: b.count > 0 ? Math.round((b.replied / b.count) * 1000) / 10 : 0,
    }));

    // Total stats
    const totalSent = msgs.length;
    const totalReplied = msgs.filter(m => m.got_reply > 0).length;
    const avgLength = totalSent > 0 ? Math.round(msgs.reduce((s, m) => s + (m.content_length || 0), 0) / totalSent) : 0;

    return c.json({
      success: true,
      data: {
        total_analyzed: totalSent,
        reply_rate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 1000) / 10 : 0,
        avg_length: avgLength,
        length_analysis: lengthAnalysis,
        period_days: days,
      },
    });
  } catch (err) {
    console.error('Message patterns error:', err);
    return c.json({ success: false, error: 'メッセージパターン分析に失敗しました' }, 500);
  }
});

// POST /recommend — AIによる最適化レコメンド生成
aiOptimizeRoutes.post('/recommend', async (c) => {
  try {
    const body = await c.req.json<{
      purpose?: string;
      target_audience?: string;
    }>();

    const days = 30;

    // Gather delivery stats
    const [deliveryStats, hourlyBest, messageStats, scenarioStats] = await Promise.all([
      c.env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM delivery_logs WHERE created_at >= datetime('now', '-30 days')
      `).first<{ total: number; sent: number; failed: number }>(),

      c.env.DB.prepare(`
        SELECT
          CAST(strftime('%H', created_at) AS INTEGER) as hour,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent
        FROM delivery_logs
        WHERE created_at >= datetime('now', '-30 days')
        GROUP BY strftime('%H', created_at)
        ORDER BY sent DESC
        LIMIT 5
      `).all(),

      c.env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound,
          SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound,
          AVG(LENGTH(content)) as avg_length
        FROM messages WHERE sent_at >= datetime('now', '-30 days')
      `).first<{ total: number; inbound: number; outbound: number; avg_length: number | null }>(),

      c.env.DB.prepare(`
        SELECT
          COALESCE(s.name, '手動配信') as name,
          COUNT(*) as deliveries,
          SUM(CASE WHEN dl.status = 'sent' THEN 1 ELSE 0 END) as sent
        FROM delivery_logs dl
        LEFT JOIN scenarios s ON dl.scenario_id = s.id
        WHERE dl.created_at >= datetime('now', '-30 days')
        GROUP BY dl.scenario_id
        ORDER BY deliveries DESC
        LIMIT 5
      `).all(),
    ]);

    // Recent outbound message samples for tone analysis
    const recentOutbound = await c.env.DB.prepare(`
      SELECT content FROM messages
      WHERE direction = 'outbound' AND content IS NOT NULL AND content != '' AND sent_at >= datetime('now', '-30 days')
      ORDER BY sent_at DESC LIMIT 10
    `).all();

    const sampleMessages = ((recentOutbound.results || []) as any[]).map(m => m.content).filter(Boolean).slice(0, 5);
    const topHours = ((hourlyBest.results || []) as any[]).map(h => `${h.hour}時 (${h.sent}件送信成功)`);
    const topScenarios = ((scenarioStats.results || []) as any[]).map((s: any) => `${s.name}: ${s.deliveries}配信/${s.sent}成功`);

    const total = deliveryStats?.total || 0;
    const sent = deliveryStats?.sent || 0;
    const successRate = total > 0 ? Math.round((sent / total) * 1000) / 10 : 0;
    const inbound = messageStats?.inbound || 0;
    const outbound = messageStats?.outbound || 0;
    const responseRate = outbound > 0 ? Math.round((inbound / outbound) * 1000) / 10 : 0;

    const systemPrompt = `あなたはLINE公式アカウントのマーケティング最適化AIアドバイザーです。
提供されたデータを分析し、配信パフォーマンスを向上させるための具体的な提案を日本語で生成してください。

以下のJSON形式で回答してください:
{
  "timing_recommendation": {
    "best_hours": [最適な配信時間帯(数値)のリスト],
    "best_days": ["最適な配信曜日のリスト"],
    "reasoning": "時間帯推奨の根拠"
  },
  "tone_recommendation": {
    "current_tone": "現在のメッセージトーンの分析",
    "suggested_tone": "推奨トーン",
    "examples": ["改善メッセージ例1", "改善メッセージ例2"],
    "reasoning": "トーン推奨の根拠"
  },
  "content_recommendations": [
    {"title": "提案タイトル", "description": "具体的な施策", "impact": "high/medium/low", "category": "timing/content/frequency/targeting"}
  ],
  "overall_score": 0-100の数値(現在のパフォーマンス総合スコア),
  "summary": "全体サマリー(2-3文)"
}`;

    const userMessage = `## 過去${days}日間のデータ

### 配信統計
- 総配信: ${total}件
- 送信成功: ${sent}件 (成功率: ${successRate}%)
- 失敗: ${deliveryStats?.failed || 0}件

### エンゲージメント
- 受信メッセージ: ${inbound}件 / 送信メッセージ: ${outbound}件
- 応答率: ${responseRate}%
- 平均メッセージ長: ${Math.round(messageStats?.avg_length || 0)}文字

### 配信成功数トップ時間帯
${topHours.join('\n') || 'データなし'}

### シナリオ別配信状況
${topScenarios.join('\n') || 'データなし'}

### 最近の送信メッセージサンプル
${sampleMessages.map((m, i) => `${i + 1}. ${m.slice(0, 100)}`).join('\n') || 'サンプルなし'}

${body.purpose ? `### 配信目的\n${body.purpose}` : ''}
${body.target_audience ? `### ターゲット層\n${body.target_audience}` : ''}`;

    const result = await callClaude(c.env, systemPrompt, userMessage);

    try {
      const recommendation = parseJsonSafe(result);
      return c.json({
        success: true,
        data: {
          recommendation,
          stats: {
            total_deliveries: total,
            success_rate: successRate,
            response_rate: responseRate,
            avg_message_length: Math.round(messageStats?.avg_length || 0),
          },
        },
      });
    } catch {
      return c.json({
        success: true,
        data: {
          recommendation: { summary: result.trim(), content_recommendations: [], overall_score: 50 },
          stats: {
            total_deliveries: total,
            success_rate: successRate,
            response_rate: responseRate,
            avg_message_length: Math.round(messageStats?.avg_length || 0),
          },
        },
      });
    }
  } catch (err) {
    console.error('AI recommendation error:', err);
    return c.json({ success: false, error: 'AI最適化レコメンドの生成に失敗しました' }, 500);
  }
});
