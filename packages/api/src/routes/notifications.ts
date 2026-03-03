import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { sendTestNotification } from '../lib/notify';

type AuthVars = { userId: string };
export const notificationRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
notificationRoutes.use('*', authMiddleware);

// POST /test — テスト通知送信
notificationRoutes.post('/test', async (c) => {
  try {
    const { channel } = await c.req.json<{ channel: 'slack' | 'email' }>();
    if (channel !== 'slack' && channel !== 'email') {
      return c.json({ success: false, error: 'Invalid channel. Use "slack" or "email"' }, 400);
    }
    const ok = await sendTestNotification(c.env, channel);
    return c.json({ success: ok, message: ok ? 'テスト通知を送信しました' : '通知の送信に失敗しました。設定を確認してください' });
  } catch (err) {
    console.error('Test notification error:', err);
    return c.json({ success: false, error: 'Failed to send test notification' }, 500);
  }
});
