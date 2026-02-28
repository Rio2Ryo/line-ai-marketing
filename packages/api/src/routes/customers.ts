import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const customerRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
customerRoutes.use('*', authMiddleware);

// GET / — 顧客一覧(page,limit,search,status,tag_id)
customerRoutes.get('/', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const search = c.req.query('search') || '';
  const status = c.req.query('status') || '';
  const tagId = c.req.query('tag_id') || '';
  const offset = (page - 1) * limit;

  let baseFrom = 'FROM users u';
  const conditions: string[] = [];
  const binds: any[] = [];

  if (tagId) {
    baseFrom += ' JOIN user_tags ut ON u.id = ut.user_id';
    conditions.push('ut.tag_id = ?');
    binds.push(tagId);
  }
  if (search) { conditions.push("u.display_name LIKE ?"); binds.push('%' + search + '%'); }
  if (status) { conditions.push('u.status = ?'); binds.push(status); }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const countResult = await c.env.DB.prepare('SELECT COUNT(DISTINCT u.id) as total ' + baseFrom + where).bind(...binds).first<{ total: number }>();
  const total = countResult?.total || 0;
  const users = await c.env.DB.prepare('SELECT DISTINCT u.* ' + baseFrom + where + ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?').bind(...binds, limit, offset).all();

  const data = await Promise.all((users.results || []).map(async (u: any) => {
    const tags = await c.env.DB.prepare('SELECT t.* FROM tags t JOIN user_tags ut ON t.id = ut.tag_id WHERE ut.user_id = ?').bind(u.id).all();
    return { ...u, tags: tags.results || [] };
  }));

  return c.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

// GET /:id — 顧客詳細
customerRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!user) return c.json({ success: false, error: 'Not found' }, 404);
  const tags = await c.env.DB.prepare('SELECT t.* FROM tags t JOIN user_tags ut ON t.id = ut.tag_id WHERE ut.user_id = ?').bind(id).all();
  const messages = await c.env.DB.prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY sent_at DESC LIMIT 50').bind(id).all();
  const attributes = await c.env.DB.prepare('SELECT * FROM user_attributes WHERE user_id = ?').bind(id).all();
  return c.json({ success: true, data: { ...user, tags: tags.results || [], recent_messages: messages.results || [], attributes: attributes.results || [] } });
});

// PUT /:id
customerRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ display_name?: string; status?: string }>();
  const sets: string[] = []; const vals: any[] = [];
  if (body.display_name !== undefined) { sets.push('display_name = ?'); vals.push(body.display_name); }
  if (body.status !== undefined) { sets.push('status = ?'); vals.push(body.status); }
  if (!sets.length) return c.json({ success: false, error: 'No fields' }, 400);
  sets.push("updated_at = datetime('now')");
  await c.env.DB.prepare('UPDATE users SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals, id).run();
  const updated = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: updated });
});

// POST /:id/tags
customerRoutes.post('/:id/tags', async (c) => {
  const userId = c.req.param('id');
  const { tag_id } = await c.req.json<{ tag_id: string }>();
  try {
    await c.env.DB.prepare('INSERT INTO user_tags (user_id, tag_id) VALUES (?, ?)').bind(userId, tag_id).run();
  } catch {}
  return c.json({ success: true });
});

// DELETE /:id/tags/:tagId
customerRoutes.delete('/:id/tags/:tagId', async (c) => {
  await c.env.DB.prepare('DELETE FROM user_tags WHERE user_id = ? AND tag_id = ?').bind(c.req.param('id'), c.req.param('tagId')).run();
  return c.json({ success: true });
});

// POST /:id/attributes
customerRoutes.post('/:id/attributes', async (c) => {
  const userId = c.req.param('id');
  const { key, value } = await c.req.json<{ key: string; value: string }>();
  await c.env.DB.prepare('INSERT OR REPLACE INTO user_attributes (user_id, key, value) VALUES (?, ?, ?)').bind(userId, key, value).run();
  return c.json({ success: true });
});
