import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const richmenuRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
richmenuRoutes.use('*', authMiddleware);

const LINE_API_BASE = 'https://api.line.me/v2/bot';
const LINE_DATA_API_BASE = 'https://api-data.line.me/v2/bot';

// GET / — リッチメニュー一覧取得
richmenuRoutes.get('/', async (c) => {
  try {
    const res = await fetch(`${LINE_API_BASE}/richmenu/list`, {
      headers: { Authorization: `Bearer ${c.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    });
    if (!res.ok) {
      const err = await res.json<{ message?: string }>();
      return c.json({ success: false, error: err.message || 'LINE API error', status: res.status }, res.status as any);
    }
    const data = await res.json();
    return c.json({ success: true, data });
  } catch (e) {
    console.error('Failed to list rich menus:', e);
    return c.json({ success: false, error: 'Failed to list rich menus' }, 500);
  }
});

// GET /alias — リッチメニューエイリアス一覧
richmenuRoutes.get('/alias', async (c) => {
  try {
    const res = await fetch(`${LINE_API_BASE}/richmenu/alias/list`, {
      headers: { Authorization: `Bearer ${c.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    });
    if (!res.ok) {
      const err = await res.json<{ message?: string }>();
      return c.json({ success: false, error: err.message || 'LINE API error', status: res.status }, res.status as any);
    }
    const data = await res.json();
    return c.json({ success: true, data });
  } catch (e) {
    console.error('Failed to list rich menu aliases:', e);
    return c.json({ success: false, error: 'Failed to list rich menu aliases' }, 500);
  }
});

// GET /default — デフォルトリッチメニュー取得
richmenuRoutes.get('/default', async (c) => {
  try {
    const res = await fetch(`${LINE_API_BASE}/user/all/richmenu`, {
      headers: { Authorization: `Bearer ${c.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    });
    if (!res.ok) {
      const err = await res.json<{ message?: string }>();
      return c.json({ success: false, error: err.message || 'LINE API error', status: res.status }, res.status as any);
    }
    const data = await res.json();
    return c.json({ success: true, data });
  } catch (e) {
    console.error('Failed to get default rich menu:', e);
    return c.json({ success: false, error: 'Failed to get default rich menu' }, 500);
  }
});

// POST / — リッチメニュー作成
richmenuRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const res = await fetch(`${LINE_API_BASE}/richmenu`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json<{ message?: string }>();
      return c.json({ success: false, error: err.message || 'LINE API error', status: res.status }, res.status as any);
    }
    const data = await res.json();
    return c.json({ success: true, data });
  } catch (e) {
    console.error('Failed to create rich menu:', e);
    return c.json({ success: false, error: 'Failed to create rich menu' }, 500);
  }
});

// POST /:richMenuId/image — リッチメニュー画像アップロード
richmenuRoutes.post('/:richMenuId/image', async (c) => {
  try {
    const richMenuId = c.req.param('richMenuId');
    const contentType = c.req.header('Content-Type') || 'image/png';
    const imageBody = await c.req.arrayBuffer();
    const res = await fetch(`${LINE_DATA_API_BASE}/richmenu/${richMenuId}/content`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': contentType,
      },
      body: imageBody,
    });
    if (!res.ok) {
      const err = await res.json<{ message?: string }>();
      return c.json({ success: false, error: err.message || 'LINE API error', status: res.status }, res.status as any);
    }
    const data = await res.json();
    return c.json({ success: true, data });
  } catch (e) {
    console.error('Failed to upload rich menu image:', e);
    return c.json({ success: false, error: 'Failed to upload rich menu image' }, 500);
  }
});

// POST /:richMenuId/default — デフォルトに設定
richmenuRoutes.post('/:richMenuId/default', async (c) => {
  try {
    const richMenuId = c.req.param('richMenuId');
    const res = await fetch(`${LINE_API_BASE}/user/all/richmenu/${richMenuId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    });
    if (!res.ok) {
      const err = await res.json<{ message?: string }>();
      return c.json({ success: false, error: err.message || 'LINE API error', status: res.status }, res.status as any);
    }
    const data = await res.json();
    return c.json({ success: true, data });
  } catch (e) {
    console.error('Failed to set default rich menu:', e);
    return c.json({ success: false, error: 'Failed to set default rich menu' }, 500);
  }
});

// DELETE /default — デフォルト解除
richmenuRoutes.delete('/default', async (c) => {
  try {
    const res = await fetch(`${LINE_API_BASE}/user/all/richmenu`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${c.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    });
    if (!res.ok) {
      const err = await res.json<{ message?: string }>();
      return c.json({ success: false, error: err.message || 'LINE API error', status: res.status }, res.status as any);
    }
    const data = await res.json();
    return c.json({ success: true, data });
  } catch (e) {
    console.error('Failed to delete default rich menu:', e);
    return c.json({ success: false, error: 'Failed to delete default rich menu' }, 500);
  }
});

// DELETE /:richMenuId — リッチメニュー削除
richmenuRoutes.delete('/:richMenuId', async (c) => {
  try {
    const richMenuId = c.req.param('richMenuId');
    const res = await fetch(`${LINE_API_BASE}/richmenu/${richMenuId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${c.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    });
    if (!res.ok) {
      const err = await res.json<{ message?: string }>();
      return c.json({ success: false, error: err.message || 'LINE API error', status: res.status }, res.status as any);
    }
    const data = await res.json();
    return c.json({ success: true, data });
  } catch (e) {
    console.error('Failed to delete rich menu:', e);
    return c.json({ success: false, error: 'Failed to delete rich menu' }, 500);
  }
});

// POST /:richMenuId/alias — エイリアス作成
richmenuRoutes.post('/:richMenuId/alias', async (c) => {
  try {
    const richMenuId = c.req.param('richMenuId');
    const body = await c.req.json<{ richMenuAliasId: string }>();
    if (!body.richMenuAliasId) {
      return c.json({ success: false, error: 'richMenuAliasId is required' }, 400);
    }
    const res = await fetch(`${LINE_API_BASE}/richmenu/alias`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        richMenuAliasId: body.richMenuAliasId,
        richMenuId,
      }),
    });
    if (!res.ok) {
      const err = await res.json<{ message?: string }>();
      return c.json({ success: false, error: err.message || 'LINE API error', status: res.status }, res.status as any);
    }
    const data = await res.json();
    return c.json({ success: true, data });
  } catch (e) {
    console.error('Failed to create rich menu alias:', e);
    return c.json({ success: false, error: 'Failed to create rich menu alias' }, 500);
  }
});
