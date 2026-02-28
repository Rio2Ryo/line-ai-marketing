import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './types';
import { webhookRoutes } from './routes/webhook';
import { authRoutes } from './routes/auth';

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:3000', 'https://line-ai-marketing.pages.dev'],
  credentials: true,
}));

app.get('/', (c) => c.json({ status: 'ok', service: 'LINE AI Marketing API' }));
app.route('/webhook', webhookRoutes);
app.route('/auth', authRoutes);

export default app;
