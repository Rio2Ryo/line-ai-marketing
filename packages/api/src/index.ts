import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { Env } from "./types";
import { webhookRoutes } from "./routes/webhook";
import { authRoutes } from "./routes/auth";
import { customerRoutes } from "./routes/customers";
import { tagRoutes } from "./routes/tags";
import { scenarioRoutes } from "./routes/scenarios";
import { statsRoutes } from "./routes/stats";
import { aiLogRoutes } from "./routes/ai-logs";
import { knowledgeRoutes } from "./routes/knowledge";
import { richmenuRoutes } from "./routes/richmenu";
import { surveyRoutes } from "./routes/surveys";
import { segmentRoutes } from "./routes/segments";
import { aiGenerateRoutes } from "./routes/ai-generate";
import { analyticsRoutes } from "./routes/analytics";
import { scheduledDeliveryRoutes } from "./routes/scheduled";
import { autoResponseRoutes } from "./routes/auto-response";
import { abTestRoutes } from "./routes/ab-tests";
import { exportRoutes } from "./routes/export";
import { settingsRoutes } from "./routes/settings";
import { aiClassifyRoutes } from "./routes/ai-classify";
import { templateRoutes } from "./routes/templates";
import { reportRoutes } from "./routes/reports";
import { notificationRoutes } from "./routes/notifications";
import { calendarRoutes } from "./routes/calendar";
import { conversionRoutes } from "./routes/conversions";
import { aiOptimizeRoutes } from "./routes/ai-optimize";
import { deliveryErrorRoutes } from "./routes/delivery-errors";
import { engagementScoreRoutes } from "./routes/engagement-scores";
import { deliveryQueueRoutes } from "./routes/delivery-queue";
import { followSourceRoutes } from "./routes/follow-sources";
import { chatRoutes } from "./routes/chat";
import { widgetRoutes } from "./routes/widgets";
import { roleRoutes } from "./routes/roles";
import { mediaRoutes } from "./routes/media";
import { importRoutes } from "./routes/import";
import { apiLoggerMiddleware } from "./middleware/api-logger";
import { apiMonitorRoutes } from "./routes/api-monitor";
import { liffRoutes } from "./routes/liff";
import { webhookTestRoutes } from "./routes/webhook-test";
import { lineStatsRoutes } from "./routes/line-stats";
import { rateLimitRoutes } from "./routes/rate-limit";
import { webhookStreamRoutes } from "./routes/webhook-stream";
import { accountRoutes } from "./routes/accounts";
import { securityRoutes } from "./routes/security";
import { cronTaskRoutes } from "./routes/cron-tasks";
import { richmenuRuleRoutes } from "./routes/richmenu-rules";
import { chatAnalyticsRoutes } from "./routes/chat-analytics";
import { scoreActionRoutes } from "./routes/score-actions";
import { scheduled } from "./scheduled";

const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());
app.use("*", cors({
  origin: (origin) => {
    const allowed = ["http://localhost:3000", "https://line-ai-marketing.pages.dev"];
    return allowed.includes(origin) ? origin : allowed[0];
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.use("*", apiLoggerMiddleware);

// Cache-Control middleware for read-heavy GET endpoints
const cacheablePatterns = [
  { pattern: /^\/api\/templates\/categories$/, maxAge: 300 },
  { pattern: /^\/api\/templates\/?$/, maxAge: 60 },
  { pattern: /^\/api\/stats/, maxAge: 30 },
  { pattern: /^\/api\/widgets\/data/, maxAge: 30 },
  { pattern: /^\/api\/line-stats/, maxAge: 120 },
  { pattern: /^\/api\/reports/, maxAge: 60 },
];

app.use("*", async (c, next) => {
  await next();
  if (c.req.method === "GET" && c.res.status === 200) {
    const path = new URL(c.req.url).pathname;
    for (const { pattern, maxAge } of cacheablePatterns) {
      if (pattern.test(path)) {
        c.res.headers.set("Cache-Control", `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`);
        break;
      }
    }
  }
});

app.get("/", (c) => c.json({
  status: "ok",
  service: "LINE AI Marketing API",
  version: "0.7.0",
  timestamp: new Date().toISOString(),
}));

app.get("/health", (c) => {
  c.header("Cache-Control", "no-cache");
  return c.json({ status: "healthy" });
});

app.route("/webhook", webhookRoutes);
app.route("/auth", authRoutes);
app.route("/api/customers", customerRoutes);
app.route("/api/tags", tagRoutes);
app.route("/api/scenarios", scenarioRoutes);
app.route("/api/stats", statsRoutes);
app.route("/api/ai", aiLogRoutes);
app.route("/api/knowledge", knowledgeRoutes);
app.route("/api/richmenu", richmenuRoutes);
app.route("/api/surveys", surveyRoutes);
app.route("/api/segments", segmentRoutes);
app.route("/api/ai/generate", aiGenerateRoutes);
app.route("/api/analytics", analyticsRoutes);
app.route("/api/scheduled", scheduledDeliveryRoutes);
app.route("/api/auto-response", autoResponseRoutes);
app.route("/api/ab-tests", abTestRoutes);
app.route("/api/export", exportRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/ai/classify", aiClassifyRoutes);
app.route("/api/templates", templateRoutes);
app.route("/api/reports", reportRoutes);
app.route("/api/notifications", notificationRoutes);
app.route("/api/calendar", calendarRoutes);
app.route("/api/conversions", conversionRoutes);
app.route("/api/ai-optimize", aiOptimizeRoutes);
app.route("/api/delivery-errors", deliveryErrorRoutes);
app.route("/api/engagement-scores", engagementScoreRoutes);
app.route("/api/delivery-queue", deliveryQueueRoutes);
app.route("/api/follow-sources", followSourceRoutes);
app.route("/api/chat", chatRoutes);
app.route("/api/widgets", widgetRoutes);
app.route("/api/roles", roleRoutes);
app.route("/api/media", mediaRoutes);
app.route("/api/import", importRoutes);
app.route("/api/api-monitor", apiMonitorRoutes);
app.route("/api/liff", liffRoutes);
app.route("/api/webhook-test", webhookTestRoutes);
app.route("/api/line-stats", lineStatsRoutes);
app.route("/api/rate-limit", rateLimitRoutes);
app.route("/api/webhook-stream", webhookStreamRoutes);
app.route("/api/accounts", accountRoutes);
app.route("/api/security", securityRoutes);
app.route("/api/cron-tasks", cronTaskRoutes);
app.route("/api/richmenu-rules", richmenuRuleRoutes);
app.route("/api/chat-analytics", chatAnalyticsRoutes);
app.route("/api/score-actions", scoreActionRoutes);

app.notFound((c) => c.json({ success: false, error: "Not Found" }, 404));
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ success: false, error: "Internal Server Error" }, 500);
});

export default { fetch: app.fetch, scheduled };
