import { Hono } from "hono";
import { Env } from "../types";
import { verifySignature, sendReplyMessage, getProfile, getUserProfile } from "../lib/line";
import { evaluateTriggers, executeScenario } from "../lib/scenario-engine";

function generateId(): string {
  return crypto.randomUUID();
}

export const webhookRoutes = new Hono<{ Bindings: Env }>();

webhookRoutes.post("/", async (c) => {
  const body = await c.req.text();
  const signature = c.req.header("x-line-signature");

  if (!signature) {
    return c.json({ success: false, error: "Missing signature" }, 400);
  }

  const isValid = await verifySignature(body, signature, c.env.LINE_CHANNEL_SECRET);
  if (!isValid) {
    return c.json({ success: false, error: "Invalid signature" }, 403);
  }

  const payload = JSON.parse(body);
  const events = payload.events || [];

  for (const event of events) {
    try {
      switch (event.type) {
        case "message":
          await handleMessageEvent(c.env, event);
          break;
        case "follow":
          await handleFollowEvent(c.env, event);
          break;
        case "unfollow":
          await handleUnfollowEvent(c.env, event);
          break;
        case "postback":
          await handlePostbackEvent(c.env, event);
          break;
        default:
          console.log("Unhandled event type:", event.type);
      }
    } catch (error) {
      console.error("Error handling event:", event.type, error);
    }
  }

  return c.json({ success: true });
});

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
  const textContent = msgType === "text" ? event.message.text : `[${msgType}]`;

  // Save inbound message
  await env.DB.prepare(
    "INSERT INTO messages (id, user_id, direction, message_type, content, raw_json) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(generateId(), userId, "inbound", msgType, textContent, JSON.stringify(event)).run();

  // Echo reply for text messages only (Phase 3: AI reply)
  if (msgType === "text") {
    const replyText = `受信: ${event.message.text}`;
    await sendReplyMessage(event.replyToken, [{ type: "text", text: replyText }], env.LINE_CHANNEL_ACCESS_TOKEN);

    await env.DB.prepare(
      "INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, ?, ?, ?)"
    ).bind(generateId(), userId, "outbound", "text", replyText).run();

    // Keyword-based scenario triggers
    const kwSids = await evaluateTriggers(env, "message_keyword", { text: textContent });
    for (const sid of kwSids) {
      await executeScenario(env, sid, userId);
    }
  }
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

  // Trigger follow-based scenarios
  const sids = await evaluateTriggers(env, "follow", {});
  for (const sid of sids) {
    await executeScenario(env, sid, finalUserId);
  }
}

async function handleUnfollowEvent(env: Env, event: any): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;
  await env.DB.prepare(
    "UPDATE users SET status = ?, updated_at = datetime(\"now\") WHERE line_user_id = ?"
  ).bind("unfollowed", lineUserId).run();
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
