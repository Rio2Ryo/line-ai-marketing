import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const aiClassifyRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
aiClassifyRoutes.use('*', authMiddleware);

function generateId(): string {
  return crypto.randomUUID();
}

async function callClaude(env: Env, systemPrompt: string, userMessage: string, maxTokens = 2000): Promise<string> {
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

async function gatherUserContext(env: Env, userId: string): Promise<string> {
  // Fetch user info
  const user = await env.DB.prepare(
    "SELECT display_name, status, created_at FROM users WHERE id = ?"
  ).bind(userId).first<{ display_name: string | null; status: string; created_at: string }>();

  // Recent messages (last 20)
  const msgs = await env.DB.prepare(
    "SELECT direction, message_type, content, sent_at FROM messages WHERE user_id = ? ORDER BY sent_at DESC LIMIT 20"
  ).bind(userId).all<{ direction: string; message_type: string; content: string | null; sent_at: string }>();

  // Tags
  const tags = await env.DB.prepare(
    "SELECT t.name FROM user_tags ut JOIN tags t ON ut.tag_id = t.id WHERE ut.user_id = ?"
  ).bind(userId).all<{ name: string }>();

  // Attributes
  const attrs = await env.DB.prepare(
    "SELECT key, value FROM user_attributes WHERE user_id = ?"
  ).bind(userId).all<{ key: string; value: string | null }>();

  // AI chat logs summary
  const aiStats = await env.DB.prepare(
    "SELECT COUNT(*) as total, AVG(confidence) as avg_conf, SUM(CASE WHEN should_escalate = 1 THEN 1 ELSE 0 END) as escalations FROM ai_chat_logs WHERE user_id = ?"
  ).bind(userId).first<{ total: number; avg_conf: number | null; escalations: number }>();

  const lines: string[] = [];
  lines.push(`ユーザー: ${user?.display_name || '不明'}`);
  lines.push(`ステータス: ${user?.status || '不明'}`);
  lines.push(`登録日: ${user?.created_at || '不明'}`);
  lines.push(`現在のタグ: ${(tags.results || []).map(t => t.name).join(', ') || 'なし'}`);
  lines.push(`属性: ${(attrs.results || []).map(a => `${a.key}=${a.value}`).join(', ') || 'なし'}`);
  lines.push(`AI応答回数: ${aiStats?.total || 0}, 平均信頼度: ${aiStats?.avg_conf ? Math.round(aiStats.avg_conf * 100) : 0}%, エスカレーション: ${aiStats?.escalations || 0}`);

  lines.push(`\n最近のメッセージ (新しい順):`);
  for (const msg of (msgs.results || [])) {
    const dir = msg.direction === 'inbound' ? 'ユーザー' : 'BOT';
    const content = msg.content ? msg.content.substring(0, 100) : `[${msg.message_type}]`;
    lines.push(`  [${msg.sent_at}] ${dir}: ${content}`);
  }

  return lines.join('\n');
}

const SYSTEM_PROMPT = `あなたはLINEマーケティングのユーザー分析AIです。
ユーザーの行動データ（メッセージ履歴、属性、タグ、AI応答ログ）を分析し、最適なセグメント分類とタグ提案を行ってください。

分析基準:
- エンゲージメント度（メッセージ頻度、応答パターン）
- 興味関心（メッセージ内容のトピック分析）
- 購買意欲シグナル（商品・価格に関する質問）
- ライフサイクルステージ（新規、アクティブ、休眠リスク）

必ず以下のJSON形式で返してください:
{
  "segment": "セグメント名（例: 高エンゲージメント, 購買検討中, 新規ユーザー, 休眠リスク, 情報収集中）",
  "suggested_tags": ["タグ1", "タグ2", "タグ3"],
  "reasoning": "分類理由の簡潔な説明（1-2文）"
}`;

// POST /user/:id — Classify a single user
aiClassifyRoutes.post('/user/:id', async (c) => {
  const userId = c.req.param('id');
  try {
    const user = await c.env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(userId).first();
    if (!user) {
      return c.json({ success: false, error: 'ユーザーが見つかりません' }, 404);
    }

    const context = await gatherUserContext(c.env, userId);
    const result = await callClaude(c.env, SYSTEM_PROMPT, context, 1000);

    let parsed: { segment: string; suggested_tags: string[]; reasoning: string };
    try {
      parsed = parseJsonSafe(result);
    } catch {
      parsed = { segment: '未分類', suggested_tags: [], reasoning: result.trim().substring(0, 200) };
    }

    const id = generateId();
    await c.env.DB.prepare(
      "INSERT INTO ai_classifications (id, user_id, suggested_tags, reasoning, segment, status) VALUES (?, ?, ?, ?, ?, 'pending')"
    ).bind(id, userId, JSON.stringify(parsed.suggested_tags), parsed.reasoning, parsed.segment).run();

    return c.json({
      success: true,
      data: {
        id,
        user_id: userId,
        segment: parsed.segment,
        suggested_tags: parsed.suggested_tags,
        reasoning: parsed.reasoning,
        status: 'pending',
      },
    });
  } catch (err) {
    console.error('User classification error:', err);
    return c.json({ success: false, error: 'ユーザー分類に失敗しました' }, 500);
  }
});

// POST /batch — Classify multiple active users (limit 10 per batch)
aiClassifyRoutes.post('/batch', async (c) => {
  try {
    const users = await c.env.DB.prepare(
      `SELECT u.id FROM users u
       WHERE u.status = 'active'
       AND u.id NOT IN (
         SELECT ac.user_id FROM ai_classifications ac
         WHERE ac.created_at >= datetime('now', '-7 days')
       )
       LIMIT 10`
    ).all<{ id: string }>();

    const results: any[] = [];
    for (const user of (users.results || [])) {
      try {
        const context = await gatherUserContext(c.env, user.id);
        const result = await callClaude(c.env, SYSTEM_PROMPT, context, 1000);

        let parsed: { segment: string; suggested_tags: string[]; reasoning: string };
        try {
          parsed = parseJsonSafe(result);
        } catch {
          parsed = { segment: '未分類', suggested_tags: [], reasoning: result.trim().substring(0, 200) };
        }

        const id = generateId();
        await c.env.DB.prepare(
          "INSERT INTO ai_classifications (id, user_id, suggested_tags, reasoning, segment, status) VALUES (?, ?, ?, ?, ?, 'pending')"
        ).bind(id, user.id, JSON.stringify(parsed.suggested_tags), parsed.reasoning, parsed.segment).run();

        results.push({ id, user_id: user.id, segment: parsed.segment, suggested_tags: parsed.suggested_tags, reasoning: parsed.reasoning });
      } catch (err) {
        console.error('Batch classify error for user:', user.id, err);
        results.push({ user_id: user.id, error: 'classification failed' });
      }
    }

    return c.json({ success: true, data: { classified: results.length, results } });
  } catch (err) {
    console.error('Batch classification error:', err);
    return c.json({ success: false, error: 'バッチ分類に失敗しました' }, 500);
  }
});

// GET / — Get classification history
aiClassifyRoutes.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    const offset = (page - 1) * limit;

    const total = await c.env.DB.prepare("SELECT COUNT(*) as c FROM ai_classifications").first<{ c: number }>();

    const rows = await c.env.DB.prepare(
      `SELECT ac.id, ac.user_id, ac.suggested_tags, ac.reasoning, ac.segment, ac.status, ac.created_at,
              u.display_name, u.picture_url
       FROM ai_classifications ac
       JOIN users u ON ac.user_id = u.id
       ORDER BY ac.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();

    const items = (rows.results || []).map((r: any) => ({
      ...r,
      suggested_tags: JSON.parse(r.suggested_tags || '[]'),
    }));

    return c.json({
      success: true,
      data: items,
      pagination: { page, limit, total: total?.c || 0, totalPages: Math.ceil((total?.c || 0) / limit) },
    });
  } catch (err) {
    console.error('Get classifications error:', err);
    return c.json({ success: false, error: '分類履歴の取得に失敗しました' }, 500);
  }
});

// POST /:id/apply — Apply suggested tags to user
aiClassifyRoutes.post('/:id/apply', async (c) => {
  const classificationId = c.req.param('id');
  try {
    const row = await c.env.DB.prepare(
      "SELECT id, user_id, suggested_tags FROM ai_classifications WHERE id = ?"
    ).bind(classificationId).first<{ id: string; user_id: string; suggested_tags: string }>();

    if (!row) {
      return c.json({ success: false, error: '分類結果が見つかりません' }, 404);
    }

    const suggestedTags: string[] = JSON.parse(row.suggested_tags || '[]');
    let appliedCount = 0;

    for (const tagName of suggestedTags) {
      // Find or create tag
      let tag = await c.env.DB.prepare("SELECT id FROM tags WHERE name = ?").bind(tagName).first<{ id: string }>();
      if (!tag) {
        const tagId = generateId();
        const colors = ['#06C755', '#4A90D9', '#F5A623', '#D0021B', '#9B59B6', '#1ABC9C'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        await c.env.DB.prepare(
          "INSERT INTO tags (id, name, color, description) VALUES (?, ?, ?, ?)"
        ).bind(tagId, tagName, color, 'AI自動分類で作成').run();
        tag = { id: tagId };
      }

      // Check if already assigned
      const existing = await c.env.DB.prepare(
        "SELECT 1 FROM user_tags WHERE user_id = ? AND tag_id = ?"
      ).bind(row.user_id, tag.id).first();

      if (!existing) {
        await c.env.DB.prepare(
          "INSERT INTO user_tags (user_id, tag_id) VALUES (?, ?)"
        ).bind(row.user_id, tag.id).run();
        appliedCount++;
      }
    }

    // Update classification status
    await c.env.DB.prepare(
      "UPDATE ai_classifications SET status = 'applied' WHERE id = ?"
    ).bind(classificationId).run();

    return c.json({ success: true, data: { applied_tags: appliedCount, total_suggested: suggestedTags.length } });
  } catch (err) {
    console.error('Apply classification error:', err);
    return c.json({ success: false, error: 'タグ適用に失敗しました' }, 500);
  }
});

// POST /:id/dismiss — Dismiss classification
aiClassifyRoutes.post('/:id/dismiss', async (c) => {
  const classificationId = c.req.param('id');
  try {
    const result = await c.env.DB.prepare(
      "UPDATE ai_classifications SET status = 'dismissed' WHERE id = ? AND status = 'pending'"
    ).bind(classificationId).run();

    if (!result.meta.changes) {
      return c.json({ success: false, error: '分類結果が見つかりません' }, 404);
    }

    return c.json({ success: true, message: '分類結果を却下しました' });
  } catch (err) {
    console.error('Dismiss classification error:', err);
    return c.json({ success: false, error: '却下に失敗しました' }, 500);
  }
});

// GET /summary — Classification summary stats
aiClassifyRoutes.get('/summary', async (c) => {
  try {
    const stats = await c.env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'applied' THEN 1 ELSE 0 END) as applied,
        SUM(CASE WHEN status = 'dismissed' THEN 1 ELSE 0 END) as dismissed
      FROM ai_classifications
    `).first<{ total: number; pending: number; applied: number; dismissed: number }>();

    const segments = await c.env.DB.prepare(`
      SELECT segment, COUNT(*) as count
      FROM ai_classifications
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY segment
      ORDER BY count DESC
    `).all();

    return c.json({
      success: true,
      data: {
        total: stats?.total || 0,
        pending: stats?.pending || 0,
        applied: stats?.applied || 0,
        dismissed: stats?.dismissed || 0,
        segments: segments.results || [],
      },
    });
  } catch (err) {
    console.error('Classification summary error:', err);
    return c.json({ success: false, error: 'サマリー取得に失敗しました' }, 500);
  }
});
