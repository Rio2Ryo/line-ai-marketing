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

app.get("/", (c) => c.json({
  status: "ok",
  service: "LINE AI Marketing API",
  version: "0.2.0",
  timestamp: new Date().toISOString(),
}));

app.get("/health", (c) => c.json({ status: "healthy" }));

app.route("/webhook", webhookRoutes);
app.route("/auth", authRoutes);
app.route("/api/customers", customerRoutes);
app.route("/api/tags", tagRoutes);
app.route("/api/scenarios", scenarioRoutes);
app.route("/api/stats", statsRoutes);

app.notFound((c) => c.json({ success: false, error: "Not Found" }, 404));
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ success: false, error: "Internal Server Error" }, 500);
});

export default { fetch: app.fetch, scheduled };
