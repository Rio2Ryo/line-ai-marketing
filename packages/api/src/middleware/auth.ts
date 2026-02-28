import { Context, Next } from 'hono';
import { Env } from '../types';
import { verifyJwt } from '../lib/jwt';

type Variables = {
  userId: string;
};

export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    return c.json({ success: false, error: 'Authorization header is required' }, 401);
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return c.json({ success: false, error: 'Invalid authorization format. Use: Bearer <token>' }, 401);
  }

  const token = parts[1];

  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }

  if (!payload.sub || typeof payload.sub !== 'string') {
    return c.json({ success: false, error: 'Invalid token payload' }, 401);
  }

  c.set('userId', payload.sub);
  await next();
}
