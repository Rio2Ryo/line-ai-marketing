import { Hono } from "hono";
import { Env } from "../types";
import { verifySignature, sendReplyMessage, getProfile, getUserProfile } from "../lib/line";
import { evaluateTriggers, executeScenario } from "../lib/scenario-engine";
import { generateAiReply } from "../lib/ai-chat";
import { createNotification } from "./notifications";
import { logSecurityEvent, checkIpRules } from "../lib/security";

function generateId(): string {
  return crypto.randomUUID();
}

export const webhookRoutes = new Hono<{ Bindings: Env }>();

webhookRoutes.post("/", async (c) => {
  const body = await c.req.text();
  const signature = c.req.header("x-line-signature");
  const sourceIp = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = c.req.header("user-agent") || null;

  // IP rule check
  const ipCheck = await checkIpRules(c.env.DB, sourceIp, 'webhook');
  if (!ipCheck.allowed) {
    logSecurityEvent(c.env.DB, 'ip_blocked', sourceIp, '/webhook', 'warning', {
      matched_rule: ipCheck.matchedRule?.ip_pattern,
    }, userAgent);
    return c.json({ success: false, error: "Forbidden" }, 403);
  }

  if (!signature) {
    logSecurityEvent(c.env.DB, 'webhook_missing_signature', sourceIp, '/webhook', 'warning', {
      content_length: body.length,
    }, userAgent);
    return c.json({ success: false, error: "Missing signature" }, 400);
  }

  // Try env secret first, then all active account secrets
  let isValid = await verifySignature(body, signature, c.env.LINE_CHANNEL_SECRET);

  if (!isValid) {
    // Try multi-tenant account secrets
    const accounts = await c.env.DB.prepare(
      'SELECT channel_secret FROM line_accounts WHERE is_active = 1 AND channel_secret IS NOT NULL'
    ).all();
    for (const acc of (accounts.results || []) as { channel_secret: string }[]) {
      if (acc.channel_secret && await verifySignature(body, signature, acc.channel_secret)) {
        isValid = true;
        break;
      }
    }
  }

  if (!isValid) {
    logSecurityEvent(c.env.DB, 'webhook_signature_fail', sourceIp, '/webhook', 'critical', {
      signature_prefix: signature.substring(0, 10) + '...',
      body_length: body.length,
    }, userAgent);
    return c.json({ success: false, error: "Invalid signature" }, 403);
  }

  // Log successful verification
  logSecurityEvent(c.env.DB, 'webhook_signature_ok', sourceIp, '/webhook', 'info', {
    events_count: JSON.parse(body).events?.length || 0,
  }, userAgent);

  const payload = JSON.parse(body);
  const events = payload.events || [];

  for (const event of events) {
    const eventId = generateId();
    const startMs = Date.now();
    const lineUserId = event.source?.userId || null;
    const msgType = event.type === 'message' ? (event.message?.type || null) : null;

    // Log event as received
    logWebhookEvent(c.env.DB, eventId, event.type, lineUserId, msgType, 'received', null, JSON.stringify(event));

    try {
      // Update stage to processing
      updateWebhookStage(c.env.DB, eventId, 'processing');

      let summary = '';
      switch (event.type) {
        case "message":
          await handleMessageEvent(c.env, event);
          summary = `${msgType}: ${event.message?.text?.substring(0, 50) || `[${msgType}]`}`;
          break;
        case "follow":
          await handleFollowEvent(c.env, event);
          summary = 'New follower';
          break;
        case "unfollow":
          await handleUnfollowEvent(c.env, event);
          summary = 'User unfollowed';
          break;
        case "postback":
          await handlePostbackEvent(c.env, event);
          summary = `Postback: ${event.postback?.data?.substring(0, 50) || ''}`;
          break;
        default:
          summary = `Unhandled: ${event.type}`;
          console.log("Unhandled event type:", event.type);
      }

      const elapsed = Date.now() - startMs;
      completeWebhookEvent(c.env.DB, eventId, 'completed', summary, elapsed);
    } catch (error) {
      const elapsed = Date.now() - startMs;
      const errMsg = error instanceof Error ? error.message : String(error);
      completeWebhookEvent(c.env.DB, eventId, 'error', null, elapsed, errMsg);
      console.error("Error handling event:", event.type, error);
    }
  }

  return c.json({ success: true });
});

// Fire-and-forget webhook event logging helpers
function logWebhookEvent(db: D1Database, id: string, eventType: string, sourceUserId: string | null, messageType: string | null, stage: string, summary: string | null, rawJson: string) {
  db.prepare(
    'INSERT INTO webhook_events (id, event_type, source_user_id, message_type, summary, stage, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, eventType, sourceUserId, messageType, summary, stage, rawJson).run().catch(() => {});
}

function updateWebhookStage(db: D1Database, id: string, stage: string) {
  db.prepare('UPDATE webhook_events SET stage = ? WHERE id = ?').bind(stage, id).run().catch(() => {});
}

function completeWebhookEvent(db: D1Database, id: string, stage: string, summary: string | null, processingMs: number, errorMessage?: string) {
  db.prepare(
    'UPDATE webhook_events SET stage = ?, summary = COALESCE(?, summary), processing_ms = ?, error_message = ? WHERE id = ?'
  ).bind(stage, summary, processingMs, errorMessage || null, id).run().catch(() => {});
}

async function findOrCreateUser(env: Env, lineUserId: string): Promise<string> {
  const existing = await env.DB.prepare("SELECT id FROM users WHERE line_user_id = ?").bind(lineUserId).first();
  if (existing) return existing.id as string;

  // Fetch profile from LINE Bot API for new users
  let displayName: string | null = null;
  let pictureUrl: string | null = null;
  try {
    const profile = await getUserProfile(lineUserId, env.LINE_CHANNEL_ACCESS_TOKEN);
    displayName = profile.displayName || null;
    pictureUrl = profile.pictureUrl || null;
  } catch (e) {
    console.error("Failed to get profile for new user:", e);
  }

  const userId = generateId();
  await env.DB.prepare(
    "INSERT INTO users (id, line_user_id, display_name, picture_url, status) VALUES (?, ?, ?, ?, ?)"
  ).bind(userId, lineUserId, displayName, pictureUrl, "active").run();
  return userId;
}

async function handleMessageEvent(env: Env, event: any): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;

  const userId = await findOrCreateUser(env, lineUserId);
  const msgType = event.message?.type || "unknown";

  // Build content based on message type
  let textContent: string;
  let contentJson: string | null = null;

  switch (msgType) {
    case "text":
      textContent = event.message.text;
      break;
    case "image":
      contentJson = JSON.stringify({
        messageId: event.message.id,
        contentProvider: event.message.contentProvider?.type || 'line',
        imageSet: event.message.imageSet || null,
      });
      textContent = '[画像]';
      break;
    case "video":
      contentJson = JSON.stringify({
        messageId: event.message.id,
        duration: event.message.duration || null,
        contentProvider: event.message.contentProvider?.type || 'line',
      });
      textContent = '[動画]';
      break;
    case "audio":
      contentJson = JSON.stringify({
        messageId: event.message.id,
        duration: event.message.duration || null,
        contentProvider: event.message.contentProvider?.type || 'line',
      });
      textContent = '[音声]';
      break;
    case "file":
      contentJson = JSON.stringify({
        messageId: event.message.id,
        fileName: event.message.fileName || 'unknown',
        fileSize: event.message.fileSize || 0,
      });
      textContent = `[ファイル: ${event.message.fileName || 'unknown'}]`;
      break;
    case "location":
      contentJson = JSON.stringify({
        title: event.message.title || null,
        address: event.message.address || null,
        latitude: event.message.latitude,
        longitude: event.message.longitude,
      });
      textContent = `[位置情報: ${event.message.address || `${event.message.latitude},${event.message.longitude}`}]`;
      break;
    case "sticker":
      contentJson = JSON.stringify({
        packageId: event.message.packageId,
        stickerId: event.message.stickerId,
        stickerResourceType: event.message.stickerResourceType || 'STATIC',
      });
      textContent = '[スタンプ]';
      break;
    default:
      textContent = `[${msgType}]`;
  }

  // Save inbound message (content = display text, raw_json = full event + contentJson metadata)
  const rawData = contentJson
    ? JSON.stringify({ ...event, _mediaMetadata: JSON.parse(contentJson) })
    : JSON.stringify(event);

  await env.DB.prepare(
    "INSERT INTO messages (id, user_id, direction, message_type, content, raw_json) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(generateId(), userId, "inbound", msgType, textContent, rawData).run();

  // Create notification for inbound message
  try {
    const senderName = await env.DB.prepare("SELECT display_name, picture_url FROM users WHERE id = ?").bind(userId).first<{ display_name: string | null; picture_url: string | null }>();
    await createNotification(env.DB, {
      type: 'message_received',
      title: 'メッセージ受信',
      body: `${senderName?.display_name || '不明'}:${textContent.substring(0, 50)}`,
      icon: senderName?.picture_url || undefined,
      link: '/dashboard/chat',
      source_user_id: userId,
    });
  } catch (e) { /* notification is non-critical */ }

  // テキストメッセージ処理
  if (msgType === "text") {
    // 1. 自動応答ルールマッチング（auto_response_rules）
    const ruleMatch = await matchAutoResponseRule(env, textContent);

    if (ruleMatch) {
      // ルールマッチ: ルール応答を優先
      const replyMessages = buildRuleReplyMessages(ruleMatch);
      await sendReplyMessage(event.replyToken, replyMessages, env.LINE_CHANNEL_ACCESS_TOKEN);

      await env.DB.prepare(
        "INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, ?, ?, ?)"
      ).bind(generateId(), userId, "outbound", ruleMatch.response_type, ruleMatch.response_content).run();
    } else {
      // 2. ルール未マッチ: AI応答（RAG）
      const aiResult = await generateAiReply(env, userId, textContent);
      await sendReplyMessage(event.replyToken, [{ type: "text", text: aiResult.reply }], env.LINE_CHANNEL_ACCESS_TOKEN);

      await env.DB.prepare(
        "INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, ?, ?, ?)"
      ).bind(generateId(), userId, "outbound", "text", aiResult.reply).run();

      if (aiResult.shouldEscalate) {
        console.log("Escalation suggested for user:", userId, "confidence:", aiResult.confidence);
        try {
          await createNotification(env.DB, {
            type: 'escalation',
            title: 'エスカレーション発生',
            body: `AIが対応困難と判断しました (信頼度: ${Math.round((aiResult.confidence || 0) * 100)}%)`,
            link: '/dashboard/chat',
            source_user_id: userId,
          });
        } catch (e) { /* non-critical */ }
      }
    }

    // 3. Keyword-based scenario triggers
    const kwSids = await evaluateTriggers(env, "message_keyword", { text: textContent });
    for (const sid of kwSids) {
      await executeScenario(env, sid, userId);
    }
  } else if (msgType === "location") {
    // 位置情報: 自動返答
    const addr = event.message.address || '不明な場所';
    await sendReplyMessage(event.replyToken, [{ type: "text", text: `位置情報を受信しました: ${addr}` }], env.LINE_CHANNEL_ACCESS_TOKEN);
    await env.DB.prepare(
      "INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, ?, ?, ?)"
    ).bind(generateId(), userId, "outbound", "text", `位置情報を受信しました: ${addr}`).run();
  } else if (msgType === "image" || msgType === "video" || msgType === "audio" || msgType === "file") {
    // メディア: 受信確認
    const typeLabel = msgType === "image" ? "画像" : msgType === "video" ? "動画" : msgType === "audio" ? "音声" : "ファイル";
    await sendReplyMessage(event.replyToken, [{ type: "text", text: `${typeLabel}を受信しました。確認いたします。` }], env.LINE_CHANNEL_ACCESS_TOKEN);
    await env.DB.prepare(
      "INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, ?, ?, ?)"
    ).bind(generateId(), userId, "outbound", "text", `${typeLabel}を受信しました。確認いたします。`).run();
  }
  // sticker: 既読のみ（返答なし）
}

async function handleFollowEvent(env: Env, event: any): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;

  // Get profile from LINE Bot API using shared helper
  let displayName: string | null = null;
  let pictureUrl: string | null = null;
  let statusMessage: string | null = null;
  try {
    const profile = await getUserProfile(lineUserId, env.LINE_CHANNEL_ACCESS_TOKEN);
    displayName = profile.displayName || null;
    pictureUrl = profile.pictureUrl || null;
    statusMessage = profile.statusMessage || null;
  } catch (e) {
    console.error("Failed to get profile:", e);
  }

  const existing = await env.DB.prepare("SELECT id FROM users WHERE line_user_id = ?").bind(lineUserId).first();
  let finalUserId: string;

  if (existing) {
    finalUserId = existing.id as string;
    await env.DB.prepare(
      "UPDATE users SET status = ?, display_name = COALESCE(?, display_name), picture_url = COALESCE(?, picture_url), status_message = COALESCE(?, status_message), updated_at = datetime(\"now\") WHERE line_user_id = ?"
    ).bind("active", displayName, pictureUrl, statusMessage, lineUserId).run();
  } else {
    finalUserId = generateId();
    await env.DB.prepare(
      "INSERT INTO users (id, line_user_id, display_name, picture_url, status_message, status) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(finalUserId, lineUserId, displayName, pictureUrl, statusMessage, "active").run();
  }

  // Record follow event for tracking
  await env.DB.prepare(
    "INSERT INTO follow_events (id, source_id, user_id, line_user_id) VALUES (?, NULL, ?, ?)"
  ).bind(generateId(), finalUserId, lineUserId).run();

  // Create notification
  await createNotification(env.DB, {
    type: 'new_follower',
    title: '新規友だち追加',
    body: `${displayName || '不明なユーザー'}が友だち追加しました`,
    icon: pictureUrl || undefined,
    link: `/dashboard/customers`,
    source_user_id: finalUserId,
  });

  // Trigger follow-based scenarios
  const sids = await evaluateTriggers(env, "follow", {});
  for (const sid of sids) {
    await executeScenario(env, sid, finalUserId);
  }

  // Check follow source and trigger follow_source scenarios
  try {
    const recentSource = await env.DB.prepare(
      `SELECT fs.source_code FROM follow_events fe
       JOIN follow_sources fs ON fe.source_id = fs.id
       WHERE fe.user_id = ? ORDER BY fe.created_at DESC LIMIT 1`
    ).bind(finalUserId).first<{ source_code: string }>();
    if (recentSource?.source_code) {
      const srcSids = await evaluateTriggers(env, "follow_source", { source_code: recentSource.source_code });
      for (const sid of srcSids) {
        await executeScenario(env, sid, finalUserId);
      }
    }
  } catch (e) { console.error('follow_source trigger error:', e); }
}

async function handleUnfollowEvent(env: Env, event: any): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;
  await env.DB.prepare(
    "UPDATE users SET status = ?, updated_at = datetime(\"now\") WHERE line_user_id = ?"
  ).bind("unfollowed", lineUserId).run();
}

interface AutoResponseRule {
  id: string;
  trigger_type: string;
  trigger_pattern: string;
  response_type: string;
  response_content: string;
}

async function matchAutoResponseRule(env: Env, text: string): Promise<AutoResponseRule | null> {
  const rows = await env.DB.prepare(
    "SELECT id, trigger_type, trigger_pattern, response_type, response_content FROM auto_response_rules WHERE is_active = 1 ORDER BY priority DESC"
  ).all();

  for (const rule of (rows.results || []) as AutoResponseRule[]) {
    let matched = false;
    switch (rule.trigger_type) {
      case "keyword":
        matched = text.includes(rule.trigger_pattern);
        break;
      case "exact_match":
        matched = text === rule.trigger_pattern;
        break;
      case "regex":
        try { matched = new RegExp(rule.trigger_pattern).test(text); } catch {}
        break;
    }
    if (matched) return rule;
  }
  return null;
}

function buildRuleReplyMessages(rule: AutoResponseRule): unknown[] {
  switch (rule.response_type) {
    case "text":
      return [{ type: "text", text: rule.response_content }];
    case "survey":
      return [{ type: "text", text: rule.response_content }];
    case "richmenu":
      return [{ type: "text", text: rule.response_content }];
    default:
      return [{ type: "text", text: rule.response_content }];
  }
}

async function handlePostbackEvent(env: Env, event: any): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;

  const userId = await findOrCreateUser(env, lineUserId);
  const postbackData = event.postback?.data || "";

  await env.DB.prepare(
    "INSERT INTO messages (id, user_id, direction, message_type, content, raw_json) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(generateId(), userId, "inbound", "postback", postbackData, JSON.stringify(event)).run();

  console.log("Postback received:", postbackData);
}
