import { Hono } from "hono";
import { Env } from "../types";
import { authMiddleware } from "../middleware/auth";
import { roleMiddleware } from "../middleware/auth";
import { evaluateTriggers } from "../lib/scenario-engine";

type AuthVars = { userId: string; userRole: string };
export const webhookTestRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
webhookTestRoutes.use("*", authMiddleware);
webhookTestRoutes.use("*", roleMiddleware("admin"));

// POST /simulate — Simulate a webhook event without LINE API calls
webhookTestRoutes.post("/simulate", async (c) => {
  const { event_type, line_user_id, message } = await c.req.json<{
    event_type: "message" | "follow" | "unfollow" | "postback";
    line_user_id: string;
    message?: {
      type: string;
      text?: string;
      id?: string;
      // image/video/audio/file/location/sticker fields
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

  if (!event_type || !line_user_id) {
    return c.json({ success: false, error: "event_type and line_user_id required" }, 400);
  }

  const results: any = { event_type, line_user_id, actions: [] };

  // Find or create user (without calling LINE profile API)
  let user = await c.env.DB.prepare("SELECT id, status FROM users WHERE line_user_id = ?").bind(line_user_id).first();
  let userId: string;

  if (!user) {
    userId = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO users (id, line_user_id, display_name, status, role) VALUES (?, ?, ?, 'active', 'viewer')"
    ).bind(userId, line_user_id, "Test User " + line_user_id.slice(0, 8)).run();
    results.actions.push({ type: "user_created", user_id: userId });
  } else {
    userId = user.id as string;
    results.actions.push({ type: "user_found", user_id: userId, status: user.status });
  }
  results.user_id = userId;

  if (event_type === "follow") {
    // Update status to active
    await c.env.DB.prepare("UPDATE users SET status = 'active', updated_at = datetime('now') WHERE id = ?").bind(userId).run();
    results.actions.push({ type: "status_updated", status: "active" });

    // Record follow event
    await c.env.DB.prepare("INSERT INTO follow_events (id, source_id, user_id, line_user_id) VALUES (?, NULL, ?, ?)").bind(crypto.randomUUID(), userId, line_user_id).run();
    results.actions.push({ type: "follow_event_recorded" });

    // Evaluate follow triggers
    const scenarioIds = await evaluateTriggers(c.env, "follow", {});
    results.triggered_scenarios = scenarioIds;
    if (scenarioIds.length > 0) {
      results.actions.push({ type: "scenarios_triggered", count: scenarioIds.length, ids: scenarioIds });
    }
  }

  if (event_type === "unfollow") {
    await c.env.DB.prepare("UPDATE users SET status = 'unfollowed', updated_at = datetime('now') WHERE line_user_id = ?").bind(line_user_id).run();
    results.actions.push({ type: "status_updated", status: "unfollowed" });
  }

  if (event_type === "message" && message) {
    const msgType = message.type || "text";
    let textContent: string;
    let contentJson: string | null = null;

    // Build content based on message type (same logic as webhook.ts)
    switch (msgType) {
      case "text":
        textContent = message.text || "";
        break;
      case "image":
        contentJson = JSON.stringify({ messageId: message.id || "test", contentProvider: message.contentProvider?.type || "line" });
        textContent = "[画像]";
        break;
      case "video":
        contentJson = JSON.stringify({ messageId: message.id || "test", duration: message.duration || null, contentProvider: message.contentProvider?.type || "line" });
        textContent = "[動画]";
        break;
      case "audio":
        contentJson = JSON.stringify({ messageId: message.id || "test", duration: message.duration || null, contentProvider: message.contentProvider?.type || "line" });
        textContent = "[音声]";
        break;
      case "file":
        contentJson = JSON.stringify({ messageId: message.id || "test", fileName: message.fileName || "unknown", fileSize: message.fileSize || 0 });
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
    const msgId = crypto.randomUUID();
    const rawData = contentJson ? JSON.stringify({ _mediaMetadata: JSON.parse(contentJson) }) : null;
    await c.env.DB.prepare("INSERT INTO messages (id, user_id, direction, message_type, content, raw_json) VALUES (?, ?, 'inbound', ?, ?, ?)").bind(msgId, userId, msgType, textContent, rawData).run();
    results.actions.push({ type: "message_saved", message_id: msgId, message_type: msgType, content: textContent });
    results.saved_message = { id: msgId, type: msgType, content: textContent, raw_json: rawData };

    // Text message special processing
    if (msgType === "text" && textContent) {
      // Auto-response rule matching
      const rules = await c.env.DB.prepare("SELECT id, trigger_type, trigger_pattern, response_type, response_content FROM auto_response_rules WHERE is_active = 1 ORDER BY priority DESC").all();
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
        results.auto_response = { matched: true, rule_id: matchedRule.id, response_type: matchedRule.response_type, response_content: matchedRule.response_content };
        results.actions.push({ type: "auto_response_matched", rule_id: matchedRule.id });
        // Save simulated reply
        await c.env.DB.prepare("INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, 'outbound', ?, ?)").bind(crypto.randomUUID(), userId, matchedRule.response_type, matchedRule.response_content).run();
      } else {
        results.auto_response = { matched: false };
        results.actions.push({ type: "no_auto_response_match" });
      }

      // Keyword-based scenario triggers
      const kwSids = await evaluateTriggers(c.env, "message_keyword", { text: textContent });
      results.keyword_scenarios = kwSids;
      if (kwSids.length > 0) {
        results.actions.push({ type: "keyword_scenarios_triggered", count: kwSids.length, ids: kwSids });
      }
    }

    // Non-text responses (simulated - no LINE API call)
    if (msgType === "location") {
      const addr = message.address || "不明な場所";
      results.simulated_reply = "位置情報を受信しました: " + addr;
      await c.env.DB.prepare("INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, 'outbound', 'text', ?)").bind(crypto.randomUUID(), userId, results.simulated_reply).run();
    } else if (["image", "video", "audio", "file"].includes(msgType)) {
      const typeLabel = msgType === "image" ? "画像" : msgType === "video" ? "動画" : msgType === "audio" ? "音声" : "ファイル";
      results.simulated_reply = typeLabel + "を受信しました。確認いたします。";
      await c.env.DB.prepare("INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, 'outbound', 'text', ?)").bind(crypto.randomUUID(), userId, results.simulated_reply).run();
    }
  }

  if (body.event_type === "postback") {
    const postbackData = body.postback_data || "";
    const msgId = crypto.randomUUID();
    await c.env.DB.prepare("INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, 'inbound', 'postback', ?)").bind(msgId, userId, postbackData).run();
    results.actions.push({ type: "postback_saved", message_id: msgId, data: postbackData });
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
    await c.env.DB.prepare("DELETE FROM messages WHERE user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM follow_events WHERE user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM delivery_logs WHERE user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM user_tags WHERE user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM user_attributes WHERE user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM survey_responses WHERE user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
    return c.json({ success: true, data: { deleted_user_id: userId } });
  }
  return c.json({ success: true, data: { deleted_user_id: null } });
});
