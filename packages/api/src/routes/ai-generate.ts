import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const aiGenerateRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
aiGenerateRoutes.use('*', authMiddleware);

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

// POST /message — Generate LINE message text variations
aiGenerateRoutes.post('/message', async (c) => {
  try {
    const body = await c.req.json<{
      purpose: string;
      target_audience: string;
      tone?: string;
      count?: number;
    }>();

    if (!body.purpose) {
      return c.json({ success: false, error: '配信の目的は必須です' }, 400);
    }
    if (!body.target_audience) {
      return c.json({ success: false, error: 'ターゲット層は必須です' }, 400);
    }

    const count = Math.min(Math.max(body.count || 3, 1), 5);
    const tone = body.tone || 'casual';

    const systemPrompt = `あなたはLINE公式アカウントのマーケティング専門コピーライターです。
短く魅力的なLINEメッセージを日本語で生成してください。

ルール:
- 各メッセージは200文字以内
- ${tone}なトーンで書く
- CTA（行動喚起）を含める
- ${count}個のバリエーションを生成する

必ずJSON配列で文字列のみを返してください。他のテキストは含めないでください。
例: ["メッセージ1", "メッセージ2", "メッセージ3"]`;

    const userMessage = `目的: ${body.purpose}\nターゲット: ${body.target_audience}`;

    const result = await callClaude(c.env, systemPrompt, userMessage);
    try {
      const variations: string[] = parseJsonSafe(result);
      return c.json({ success: true, data: { variations } });
    } catch {
      return c.json({ success: true, data: { variations: [result.trim()] } });
    }
  } catch (err) {
    console.error('Message generation error:', err);
    return c.json({ success: false, error: 'メッセージ生成に失敗しました' }, 500);
  }
});

// POST /flex — Generate Flex Message JSON
aiGenerateRoutes.post('/flex', async (c) => {
  try {
    const body = await c.req.json<{
      purpose: string;
      content_type: 'product' | 'coupon' | 'event' | 'news';
      details: string;
    }>();

    if (!body.purpose) {
      return c.json({ success: false, error: '目的は必須です' }, 400);
    }
    if (!body.content_type) {
      return c.json({ success: false, error: 'コンテンツタイプは必須です' }, 400);
    }
    if (!body.details) {
      return c.json({ success: false, error: '詳細は必須です' }, 400);
    }

    const typeLabel: Record<string, string> = {
      product: '商品紹介',
      coupon: 'クーポン',
      event: 'イベント',
      news: 'お知らせ',
    };

    const systemPrompt = `あなたはLINE Flex Messageの専門家です。
LINE Messaging APIで使える正しいFlex Message JSONを生成してください。

ルール:
- LINE Flex Message仕様に完全準拠したtype:"bubble"のJSONを返す
- トップレベル構造: { "type": "bubble", "header": {...}, "body": {...}, "footer": {...} }
- headerにはtitleをtext componentで配置
- bodyにはdescription/price/detailsをvertical boxで配置
- footerにはCTAボタン(type:"button", action:{type:"uri"})を配置
- ${typeLabel[body.content_type] || body.content_type}に適したレイアウト
- カラーは#06C755（LINEグリーン）を基調に
- text componentのwrap属性はtrue推奨
- 必ず有効なJSON**のみ**を返してください（説明テキスト不要）`;

    const userMessage = `目的: ${body.purpose}\n種類: ${typeLabel[body.content_type]}\n詳細: ${body.details}`;

    const result = await callClaude(c.env, systemPrompt, userMessage, 3000);
    try {
      const flex_json = parseJsonSafe(result);
      return c.json({ success: true, data: { flex_json } });
    } catch {
      return c.json({ success: false, error: 'Flex JSONの解析に失敗しました' }, 500);
    }
  } catch (err) {
    console.error('Flex generation error:', err);
    return c.json({ success: false, error: 'Flex Message生成に失敗しました' }, 500);
  }
});

// POST /improve — Improve existing message
aiGenerateRoutes.post('/improve', async (c) => {
  try {
    const body = await c.req.json<{
      original_text: string;
      instruction?: string;
    }>();

    if (!body.original_text) {
      return c.json({ success: false, error: '元のメッセージは必須です' }, 400);
    }

    const instruction = body.instruction || '全体的に改善してください';

    const systemPrompt = `あなたはLINEメッセージの改善アドバイザーです。
既存のメッセージを改善し、改善案と具体的な提案を返してください。

必ず以下のJSON形式で返してください（他のテキストは含めないでください）:
{
  "improved": "改善されたメッセージ本文",
  "suggestions": ["提案1", "提案2", "提案3"]
}`;

    const userMessage = `元のメッセージ:\n${body.original_text}\n\n改善指示:\n${instruction}`;

    const result = await callClaude(c.env, systemPrompt, userMessage);
    try {
      const parsed = parseJsonSafe(result);
      return c.json({
        success: true,
        data: {
          improved: parsed.improved || result,
          suggestions: parsed.suggestions || [],
        },
      });
    } catch {
      return c.json({
        success: true,
        data: { improved: result.trim(), suggestions: [] },
      });
    }
  } catch (err) {
    console.error('Improve generation error:', err);
    return c.json({ success: false, error: '改善案の生成に失敗しました' }, 500);
  }
});
