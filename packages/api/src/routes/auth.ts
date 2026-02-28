import { Hono } from 'hono';
import { Env } from '../types';
import { signJwt, verifyJwt } from '../lib/jwt';
import { authMiddleware } from '../middleware/auth';

function generateId(): string {
  return crypto.randomUUID();
}

function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

type AuthVariables = {
  userId: string;
};

export const authRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// LINE Login - redirect to authorization URL
authRoutes.get('/line', (c) => {
  const state = generateState();
  const redirectUri = `${new URL(c.req.url).origin}/auth/line/callback`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: c.env.LINE_LOGIN_CHANNEL_ID,
    redirect_uri: redirectUri,
    state: state,
    scope: 'profile openid',
  });

  const authorizationUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;

  return c.redirect(authorizationUrl);
});

// LINE Login - callback
authRoutes.get('/line/callback', async (c) => {
  const code = c.req.query('code');
  const error = c.req.query('error');

  if (error) {
    const errorDescription = c.req.query('error_description') || 'Unknown error';
    return c.redirect(`${c.env.FRONTEND_URL}/login?error=${encodeURIComponent(errorDescription)}`);
  }

  if (!code) {
    return c.redirect(`${c.env.FRONTEND_URL}/login?error=${encodeURIComponent('Authorization code is missing')}`);
  }

  const redirectUri = `${new URL(c.req.url).origin}/auth/line/callback`;

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: c.env.LINE_LOGIN_CHANNEL_ID,
        client_secret: c.env.LINE_LOGIN_CHANNEL_SECRET,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorBody);
      return c.redirect(`${c.env.FRONTEND_URL}/login?error=${encodeURIComponent('Failed to exchange authorization code')}`);
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      token_type: string;
      expires_in: number;
      id_token?: string;
    };

    // Get user profile
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      const errorBody = await profileResponse.text();
      console.error('Profile fetch failed:', profileResponse.status, errorBody);
      return c.redirect(`${c.env.FRONTEND_URL}/login?error=${encodeURIComponent('Failed to fetch user profile')}`);
    }

    const profile = (await profileResponse.json()) as {
      userId: string;
      displayName: string;
      pictureUrl?: string;
      statusMessage?: string;
    };

    // Upsert user in database
    const existingUser = await c.env.DB.prepare(
      'SELECT * FROM users WHERE line_user_id = ?'
    )
      .bind(profile.userId)
      .first();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id as string;
      await c.env.DB.prepare(
        `UPDATE users SET
          display_name = ?,
          picture_url = ?,
          status_message = ?,
          access_token = ?,
          refresh_token = ?,
          status = ?,
          updated_at = datetime('now')
        WHERE id = ?`
      )
        .bind(
          profile.displayName,
          profile.pictureUrl || null,
          profile.statusMessage || null,
          tokenData.access_token,
          tokenData.refresh_token || null,
          'active',
          userId
        )
        .run();
    } else {
      userId = generateId();
      await c.env.DB.prepare(
        `INSERT INTO users (id, line_user_id, display_name, picture_url, status_message, access_token, refresh_token, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
        .bind(
          userId,
          profile.userId,
          profile.displayName,
          profile.pictureUrl || null,
          profile.statusMessage || null,
          tokenData.access_token,
          tokenData.refresh_token || null,
          'active'
        )
        .run();
    }

    // Generate JWT
    const jwt = await signJwt(
      {
        sub: userId,
        lineUserId: profile.userId,
        displayName: profile.displayName,
      },
      c.env.JWT_SECRET
    );

    // Redirect to frontend with token
    return c.redirect(`${c.env.FRONTEND_URL}/auth/callback?token=${jwt}`);
  } catch (error) {
    console.error('Auth callback error:', error);
    return c.redirect(`${c.env.FRONTEND_URL}/login?error=${encodeURIComponent('Authentication failed')}`);
  }
});

// Get current user
authRoutes.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const user = await c.env.DB.prepare(
    'SELECT id, line_user_id, display_name, picture_url, status_message, status, created_at, updated_at FROM users WHERE id = ?'
  )
    .bind(userId)
    .first();

  if (!user) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  return c.json({ success: true, data: user });
});

// Logout (placeholder for future token invalidation)
authRoutes.post('/logout', authMiddleware, async (c) => {
  // In the future, this could invalidate the token by adding it to a blocklist
  // or clearing the user's refresh token
  return c.json({ success: true, message: 'Logged out successfully' });
});
