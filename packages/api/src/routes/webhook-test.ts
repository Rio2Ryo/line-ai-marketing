import { Hono } from "hono";
import { Env } from "../types";
import { authMiddleware, roleMiddleware } from "../middleware/auth";
import { evaluateTriggers, executeScenario } from "../lib/scenario-engine";
import { generateAiReply } from "../lib/ai-chat";
import { createNotification } from "./notifications";

type AuthVars = { userId: string; userRole: string };
export const webhookTestRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
webhookTestRoutes.use("*", authMiddleware);
webhookTestRoutes.use("*", roleMiddleware("admin"));

function generateId(): string {
  return crypto.randomUUID();
}

// POST /simulate — Simulate a webhook event (full pipeline, no LINE API calls)
webhookTestRoutes.post("/simulate", async (c) => {
  const body = await c.req.json<{
    event_type: "message" | "follow" | "unfollow" | "postback";
    line_user_id: string;
    message?: {
      type: string;
      text?: string;
      id?: string;
      fileName?: string;
      fileSize?: number;
      duration?: number;
      latitude?: number;
      longitude?: number;
      address?: string;
      title?: string;
      packageId?: string;
      stickerId?: string;
      contentProvider?: { type: string };
    };
    postback_data?: string;
  }>();

  const { event_type, line_user_id, message } = body;

  if (!event_type || !line_user_id) {
    return c.json({ success: false, error: "event_type and line_user_id required" }, 400);
  }

  const startMs = Date.now();
  const eventId = generateId();
  const results: any = { event_type, line_user_id, actions: [], pipeline: [] };

  // Log event as received
  logWebhookEvent(c.env.DB, eventId, event_type, line_user_id, message?.type || null, 'received');
  results.pipeline.push('received');

  // Find or create user (without calling LINE profile API)
  let user = await c.env.DB.prepare(
    "SELECT id, display_name, status FROM users WHERE line_user_id = ?"
  ).bind(line_user_id).first();
  let userId: string;

  if (!user) {
    userId = generateId();
    await c.env.DB.prepare(
      "INSERT INTO users (id, line_user_id, display_name, status, role) VALUES (?, ?, ?, 'active', 'viewer')"
    ).bind(userId, line_user_id, "SimUser " + line_user_id.slice(0, 8)).run();
    results.actions.push({ type: "user_created", user_id: userId });
  } else {
    userId = user.id as string;
    results.actions.push({ type: "user_found", user_id: userId, status: user.status });
  }
  results.user_id = userId;

  // Update stage to processing
  updateWebhookStage(c.env.DB, eventId, 'processing');
  results.pipeline.push('processing');

  try {
    // ═══ FOLLOW EVENT ═══
    if (event_type === "follow") {
      await c.env.DB.prepare(
        "UPDATE users SET status = 'active', updated_at = datetime('now') WHERE id = ?"
      ).bind(userId).run();
      results.actions.push({ type: "status_updated", status: "active" });

      await c.env.DB.prepare(
        "INSERT INTO follow_events (id, source_id, user_id, line_user_id) VALUES (?, NULL, ?, ?)"
      ).bind(generateId(), userId, line_user_id).run();
      results.actions.push({ type: "follow_event_recorded" });

      // Create notification (same as webhook.ts)
      await createNotification(c.env.DB, {
        type: 'new_follower',
        title: '新規友だち追加',
        body: `${(user as any)?.display_name || 'SimUser'}が友だち追加しました`,
        link: '/dashboard/customers',
        source_user_id: userId,
      });
      results.actions.push({ type: "notification_created", notification_type: "new_follower" });

      // Evaluate follow triggers + execute scenarios
      const scenarioIds = await evaluateTriggers(c.env, "follow", {});
      results.triggered_scenarios = scenarioIds;
      for (const sid of scenarioIds) {
        await executeScenario(c.env, sid, userId);
        results.actions.push({ type: "scenario_executed", scenario_id: sid });
      }
    }

    // ═══ UNFOLLOW EVENT ═══
    if (event_type === "unfollow") {
      await c.env.DB.prepare(
        "UPDATE users SET status = 'unfollowed', updated_at = datetime('now') WHERE line_user_id = ?"
      ).bind(line_user_id).run();
      results.actions.push({ type: "status_updated", status: "unfollowed" });
    }

    // ═══ MESSAGE EVENT ═══
    if (event_type === "message" && message) {
      const msgType = message.type || "text";
      let textContent: string;
      let contentJson: string | null = null;

      switch (msgType) {
        case "text":
          textContent = message.text || "";
          break;
        case "image":
          contentJson = JSON.stringify({ messageId: message.id || "sim", contentProvider: message.contentProvider?.type || "line" });
          textContent = "[画像]";
          break;
        case "video":
          contentJson = JSON.stringify({ messageId: message.id || "sim", duration: message.duration || null, contentProvider: message.contentProvider?.type || "line" });
          textContent = "[動画]";
          break;
        case "audio":
          contentJson = JSON.stringify({ messageId: message.id || "sim", duration: message.duration || null, contentProvider: message.contentProvider?.type || "line" });
          textContent = "[音声]";
          break;
        case "file":
          contentJson = JSON.stringify({ messageId: message.id || "sim", fileName: message.fileName || "unknown", fileSize: message.fileSize || 0 });
          textContent = "[ファイル: " + (message.fileName || "unknown") + "]";
          break;
        case "location":
          contentJson = JSON.stringify({ title: message.title || null, address: message.address || null, latitude: message.latitude, longitude: message.longitude });
          textContent = "[位置情報: " + (message.address || (message.latitude + "," + message.longitude)) + "]";
          break;
        case "sticker":
          contentJson = JSON.stringify({ packageId: message.packageId, stickerId: message.stickerId, stickerResourceType: "STATIC" });
          textContent = "[スタンプ]";
          break;
        default:
          textContent = "[" + msgType + "]";
      }

      // Save inbound message
      const msgId = generateId();
      const rawData = contentJson ? JSON.stringify({ _mediaMetadata: JSON.parse(contentJson), _simulated: true }) : JSON.stringify({ _simulated: true });
      await c.env.DB.prepare(
        "INSERT INTO messages (id, user_id, direction, message_type, content, raw_json) VALUES (?, ?, 'inbound', ?, ?, ?)"
      ).bind(msgId, userId, msgType, textContent, rawData).run();
      results.actions.push({ type: "message_saved", message_id: msgId, message_type: msgType, content: textContent });
      results.saved_message = { id: msgId, type: msgType, content: textContent };

      // Create notification for inbound message
      const senderName = (user as any)?.display_name || 'SimUser';
      await createNotification(c.env.DB, {
        type: 'message_received',
        title: 'メッセージ受信',
        body: `${senderName}: ${textContent.substring(0, 50)}`,
        link: '/dashboard/chat',
        source_user_id: userId,
      });
      results.actions.push({ type: "notification_created", notification_type: "message_received" });

      // ── Text message: full pipeline (auto-response → AI RAG → scenarios) ──
      if (msgType === "text" && textContent) {
        // 1. Auto-response rule matching
        const rules = await c.env.DB.prepare(
          "SELECT id, trigger_type, trigger_pattern, response_type, response_content FROM auto_response_rules WHERE is_active = 1 ORDER BY priority DESC"
        ).all();
        let matchedRule: any = null;
        for (const rule of (rules.results || []) as any[]) {
          let matched = false;
          switch (rule.trigger_type) {
            case "keyword": matched = textContent.includes(rule.trigger_pattern); break;
            case "exact_match": matched = textContent === rule.trigger_pattern; break;
            case "regex": try { matched = new RegExp(rule.trigger_pattern).test(textContent); } catch {} break;
          }
          if (matched) { matchedRule = rule; break; }
        }

        if (matchedRule) {
          // Rule matched → send rule response (simulated, no LINE API)
          results.auto_response = {
            matched: true,
            rule_id: matchedRule.id,
            response_type: matchedRule.response_type,
            response_content: matchedRule.response_content,
          };
          results.actions.push({ type: "auto_response_matched", rule_id: matchedRule.id });

          const replyMsgId = generateId();
          await c.env.DB.prepare(
            "INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, 'outbound', ?, ?)"
          ).bind(replyMsgId, userId, matchedRule.response_type, matchedRule.response_content).run();
          results.simulated_reply = matchedRule.response_content;
        } else {
          // 2. No rule match → AI response (Claude RAG) — REAL Claude API call
          results.auto_response = { matched: false };
          results.actions.push({ type: "no_auto_response_match" });

          const aiResult = await generateAiReply(c.env, userId, textContent);
          results.ai_response = {
            reply: aiResult.reply,
            confidence: aiResult.confidence,
            should_escalate: aiResult.shouldEscalate,
            knowledge_used: aiResult.knowledgeUsed,
            response_time_ms: aiResult.responseTimeMs,
          };
          results.actions.push({
            type: "ai_response_generated",
            confidence: aiResult.confidence,
            escalated: aiResult.shouldEscalate,
            knowledge_count: aiResult.knowledgeUsed.length,
          });

          // Save AI reply as outbound message (simulated, no LINE API)
          const aiReplyMsgId = generateId();
          await c.env.DB.prepare(
            "INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, 'outbound', 'text', ?)"
          ).bind(aiReplyMsgId, userId, aiResult.reply).run();
          results.simulated_reply = aiResult.reply;

          // Escalation notification (same as webhook.ts)
          if (aiResult.shouldEscalate) {
            await createNotification(c.env.DB, {
              type: 'escalation',
              title: 'エスカレーション発生',
              body: `AIが対応困難と判断しました (信頼度: ${Math.round((aiResult.confidence || 0) * 100)}%)`,
              link: '/dashboard/chat',
              source_user_id: userId,
            });
            results.actions.push({ type: "escalation_notified", confidence: aiResult.confidence });
          }
        }

        // 3. Keyword-based scenario triggers
        const kwSids = await evaluateTriggers(c.env, "message_keyword", { text: textContent });
        results.keyword_scenarios = kwSids;
        for (const sid of kwSids) {
          await executeScenario(c.env, sid, userId);
          results.actions.push({ type: "keyword_scenario_executed", scenario_id: sid });
        }
      }

      // Non-text responses (simulated)
      if (msgType === "location") {
        const addr = message.address || "不明な場所";
        results.simulated_reply = "位置情報を受信しました: " + addr;
        await c.env.DB.prepare(
          "INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, 'outbound', 'text', ?)"
        ).bind(generateId(), userId, results.simulated_reply).run();
      } else if (["image", "video", "audio", "file"].includes(msgType)) {
        const typeLabel = msgType === "image" ? "画像" : msgType === "video" ? "動画" : msgType === "audio" ? "音声" : "ファイル";
        results.simulated_reply = typeLabel + "を受信しました。確認いたします。";
        await c.env.DB.prepare(
          "INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, 'outbound', 'text', ?)"
        ).bind(generateId(), userId, results.simulated_reply).run();
      }
    }

    // ═══ POSTBACK EVENT ═══
    if (event_type === "postback") {
      const postbackData = body.postback_data || "";
      const msgId = generateId();
      await c.env.DB.prepare(
        "INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, 'inbound', 'postback', ?)"
      ).bind(msgId, userId, postbackData).run();
      results.actions.push({ type: "postback_saved", message_id: msgId, data: postbackData });
    }

    // Complete pipeline
    const elapsedMs = Date.now() - startMs;
    completeWebhookEvent(c.env.DB, eventId, 'completed', `sim:${event_type}`, elapsedMs);
    results.pipeline.push('completed');
    results.duration_ms = elapsedMs;

  } catch (error) {
    const elapsedMs = Date.now() - startMs;
    const errMsg = error instanceof Error ? error.message : String(error);
    completeWebhookEvent(c.env.DB, eventId, 'error', null, elapsedMs, errMsg);
    results.pipeline.push('error');
    results.error = errMsg;
    results.duration_ms = elapsedMs;
  }

  return c.json({ success: true, data: results });
});

// POST /cleanup — Clean up test data
webhookTestRoutes.post("/cleanup", async (c) => {
  const { line_user_id } = await c.req.json<{ line_user_id: string }>();
  if (!line_user_id) return c.json({ success: false, error: "line_user_id required" }, 400);

  const user = await c.env.DB.prepare("SELECT id FROM users WHERE line_user_id = ?").bind(line_user_id).first();
  if (user) {
    const userId = user.id as string;
    const tables = ['messages', 'follow_events', 'delivery_logs', 'user_tags', 'user_attributes', 'survey_responses', 'ai_chat_logs', 'ai_classifications', 'notifications', 'escalations'];
    for (const table of tables) {
      await c.env.DB.prepare(`DELETE FROM ${table} WHERE user_id = ?`).bind(userId).run();
    }
    await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
    return c.json({ success: true, data: { deleted_user_id: userId, cleaned_tables: tables } });
  }
  return c.json({ success: true, data: { deleted_user_id: null } });
});

// ── Webhook event logging (mirrors webhook.ts) ──
function logWebhookEvent(db: D1Database, id: string, eventType: string, sourceUserId: string | null, messageType: string | null, stage: string) {
  db.prepare(
    'INSERT INTO webhook_events (id, event_type, source_user_id, message_type, summary, stage, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, eventType, sourceUserId, messageType, 'simulated', stage, JSON.stringify({ simulated: true })).run().catch(() => {});
}

function updateWebhookStage(db: D1Database, id: string, stage: string) {
  db.prepare('UPDATE webhook_events SET stage = ? WHERE id = ?').bind(stage, id).run().catch(() => {});
}

function completeWebhookEvent(db: D1Database, id: string, stage: string, summary: string | null, processingMs: number, errorMessage?: string) {
  db.prepare(
    'UPDATE webhook_events SET stage = ?, summary = COALESCE(?, summary), processing_ms = ?, error_message = ? WHERE id = ?'
  ).bind(stage, summary, processingMs, errorMessage || null, id).run().catch(() => {});
}
