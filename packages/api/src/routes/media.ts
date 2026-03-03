import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { getMessageContent } from '../lib/line';

type Variables = {
  userId: string;
  userRole: string;
};

export const mediaRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

mediaRoutes.use('*', authMiddleware);

// GET /api/media/:messageId - Proxy LINE content API
mediaRoutes.get('/:messageId', async (c) => {
  const messageId = c.req.param('messageId');

  try {
    const { contentType, body } = await getMessageContent(messageId, c.env.LINE_CHANNEL_ACCESS_TOKEN);

    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    console.error('Media proxy error:', e);
    return c.json({ success: false, error: 'Failed to fetch media content' }, 404);
  }
});
