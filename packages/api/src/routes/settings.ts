import { Hono } from "hono";
import { Env } from "../types";
import { authMiddleware } from "../middleware/auth";

export const settingsRoutes = new Hono<{ Bindings: Env }>();

settingsRoutes.use("*", authMiddleware as any);

// GET /api/settings - Get all settings
settingsRoutes.get("/", async (c) => {
  try {
    const rows = await c.env.DB.prepare("SELECT key, value FROM settings").all();
    const settings: Record<string, string> = {};
    for (const row of (rows.results || []) as { key: string; value: string }[]) {
      settings[row.key] = row.value;
    }
    return c.json({ success: true, data: settings });
  } catch (error) {
    console.error("Failed to get settings:", error);
    return c.json({ success: false, error: "Failed to get settings" }, 500);
  }
});

// PUT /api/settings - Update settings (accepts { key: value, ... })
settingsRoutes.put("/", async (c) => {
  try {
    const body = await c.req.json();
    const entries = Object.entries(body);
    if (entries.length === 0) {
      return c.json({ success: false, error: "No settings provided" }, 400);
    }

    const allowedKeys = ["ai_auto_reply", "escalation_notify", "notify_slack", "notify_email", "slack_webhook_url", "notify_email_address"];
    for (const [key, value] of entries) {
      if (!allowedKeys.includes(key)) {
        return c.json({ success: false, error: `Invalid setting key: ${key}` }, 400);
      }
      await c.env.DB.prepare(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
      ).bind(key, String(value)).run();
    }

    return c.json({ success: true, message: "Settings updated" });
  } catch (error) {
    console.error("Failed to update settings:", error);
    return c.json({ success: false, error: "Failed to update settings" }, 500);
  }
});
