import { Env } from '../types';
import { notifyEscalation } from './notify';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AiChatResult {
  reply: string;
  shouldEscalate: boolean;
  confidence: number;
  knowledgeUsed: string[];
  responseTimeMs: number;
}

// RAG: ナレッジベースから関連コンテンツを検索（テキストマッチ）
async function searchKnowledge(env: Env, query: string, limit: number = 5): Promise<Array<{ id: string; title: string; content: string; category: string | null }>> {
  // D1 SQLite LIKE has strict pattern complexity limits with CJK text.
  // Strategy: use a single short search term from the query for title match,
  // then fetch all active articles and do JS-side filtering for content match.
  const allArticles = await env.DB.prepare(
    "SELECT id, title, content, category FROM knowledge_base WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 50"
  ).all();
  const articles = (allArticles.results || []) as Array<{ id: string; title: string; content: string; category: string | null }>;
  if (articles.length === 0) return [];

  // JS-side relevance scoring
  const keywords = query.split(/[\s、。！？?!]+/).filter(k => k.length >= 2).slice(0, 5);
  if (keywords.length === 0) return articles.slice(0, limit);

  const scored = articles.map(a => {
    let score = 0;
    for (const kw of keywords) {
      if (a.title.includes(kw)) score += 3;
      if (a.content.includes(kw)) score += 1;
    }
    return { ...a, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.filter(a => a.score > 0).slice(0, limit);
}

// 会話履歴を取得（直近N件）
async function getConversationHistory(env: Env, userId: string, limit: number = 10): Promise<ChatMessage[]> {
  const rows = await env.DB.prepare(
    "SELECT direction, content FROM messages WHERE user_id = ? AND message_type = 'text' AND content IS NOT NULL ORDER BY sent_at DESC LIMIT ?"
  ).bind(userId, limit).all();

  return ((rows.results || []) as any[]).reverse().map((r: any) => ({
    role: r.direction === 'inbound' ? 'user' as const : 'assistant' as const,
    content: r.content,
  }));
}

// Claude APIを呼び出してAI応答を生成 + DBログ記録 + エスカレーション自動作成
export async function generateAiReply(env: Env, userId: string, userMessage: string): Promise<AiChatResult> {
  const startTime = Date.now();

  // 1. ナレッジベース検索（RAG）
  const knowledge = await searchKnowledge(env, userMessage);
  const knowledgeContext = knowledge.length > 0
    ? knowledge.map(k => `【${k.title}】\n${k.content}`).join('\n\n---\n\n')
    : '';

  // 2. 会話履歴取得
  const history = await getConversationHistory(env, userId);

  // 3. システムプロンプト構築
  const systemPrompt = `あなたはLINE公式アカウントのAIアシスタントです。
以下のルールに従って応答してください:
- 丁寧で親しみやすい日本語で応答する
- 簡潔に回答する（LINE メッセージなので200文字以内が理想）
- ナレッジベースの情報を優先して回答する
- ナレッジベースに該当する情報がない場合は正直に「担当者に確認いたします」と回答する
- 絵文字は控えめに使う
- 個人情報や機密情報を聞き出そうとしない

${knowledgeContext ? `## ナレッジベース（参考情報）\n${knowledgeContext}` : '## ナレッジベース\n登録された情報がありません。担当者への確認を案内してください。'}`;

  // 4. Claude API呼び出し
  const messages = [
    ...history.slice(-8).map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ];

  let replyText: string;
  let shouldEscalate: boolean;
  let confidence: number;

  try {
    // Azure AI Foundry endpoint (ANTHROPIC_RESOURCE設定時) or direct Anthropic API
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
        max_tokens: 500,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Claude API error:', response.status, err);
      replyText = '申し訳ございません。現在システムに問題が発生しています。しばらくしてからお試しください。';
      shouldEscalate = true;
      confidence = 0;
    } else {
      const data = await response.json() as any;
      replyText = data.content?.[0]?.text || '申し訳ございません。応答を生成できませんでした。';

      // エスカレーション判定
      const escalateKeywords = ['担当者に確認', '担当者にお繋ぎ', 'オペレーター', '確認いたします', 'わかりかねます'];
      shouldEscalate = escalateKeywords.some(kw => replyText.includes(kw));
      confidence = knowledge.length > 0 ? (shouldEscalate ? 0.3 : 0.8) : 0.2;
    }
  } catch (e) {
    console.error('AI chat error:', e);
    replyText = '申し訳ございません。現在応答を生成できません。担当者におつなぎいたします。';
    shouldEscalate = true;
    confidence = 0;
  }

  const responseTime = Date.now() - startTime;

  // AIチャットログ記録
  const logId = crypto.randomUUID();
  try {
    await env.DB.prepare(
      "INSERT INTO ai_chat_logs (id, user_id, user_message, ai_reply, confidence, should_escalate, knowledge_ids, response_time_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      logId,
      userId,
      userMessage,
      replyText,
      confidence,
      shouldEscalate ? 1 : 0,
      JSON.stringify(knowledge.map(k => k.id)),
      responseTime
    ).run();

    // エスカレーション自動作成 + マルチチャネル通知
    if (shouldEscalate) {
      await env.DB.prepare(
        "INSERT INTO escalations (id, user_id, ai_chat_log_id, status, priority) VALUES (?, ?, ?, 'open', ?)"
      ).bind(
        crypto.randomUUID(),
        userId,
        logId,
        confidence < 0.2 ? 'high' : 'normal'
      ).run();

      // 非同期で通知送信（レスポンスをブロックしない）
      notifyEscalation(env, userId, userMessage, replyText, confidence).catch(e =>
        console.error('Escalation notification failed:', e)
      );
    }
  } catch (e) {
    console.error('Failed to log AI chat:', e);
  }

  return {
    reply: replyText,
    shouldEscalate,
    confidence,
    knowledgeUsed: knowledge.map(k => k.id),
    responseTimeMs: responseTime,
  };
}
