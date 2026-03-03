import { Context, Next } from 'hono';
import { Env } from '../types';

type LiffVariables = {
  liffUserId: string;
  liffLineUserId: string;
};

export async function liffAuthMiddleware(
  c: Context<{ Bindings: Env; Variables: LiffVariables }>,
  next: Next
): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'LIFF access token required' }, 401);
  }

  const accessToken = authHeader.split(' ')[1];

  try {
    // Verify LIFF access token via LINE API
    const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify?access_token=' + encodeURIComponent(accessToken));
    if (!verifyRes.ok) {
      return c.json({ success: false, error: 'Invalid LIFF access token' }, 401);
    }

    const verifyData = await verifyRes.json() as { client_id: string; expires_in: number; scope: string };
    if (verifyData.expires_in <= 0) {
      return c.json({ success: false, error: 'LIFF access token expired' }, 401);
    }

    // Get user profile from LINE
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileRes.ok) {
      return c.json({ success: false, error: 'Failed to get LINE profile' }, 401);
    }

    const profile = await profileRes.json() as { userId: string; displayName: string; pictureUrl?: string };

    // Find or create user in DB
    let user = await c.env.DB.prepare('SELECT id FROM users WHERE line_user_id = ?').bind(profile.userId).first();
    if (!user) {
      const newId = crypto.randomUUID();
      await c.env.DB.prepare(
        "INSERT INTO users (id, line_user_id, display_name, picture_url, status, role, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', 'viewer', datetime('now'), datetime('now'))"
      ).bind(newId, profile.userId, profile.displayName, profile.pictureUrl || null).run();
      user = { id: newId };
    }

    c.set('liffUserId', user.id as string);
    c.set('liffLineUserId', profile.userId);
    await next();
  } catch (e) {
    console.error('LIFF auth error:', e);
    return c.json({ success: false, error: 'Authentication failed' }, 401);
  }
}
