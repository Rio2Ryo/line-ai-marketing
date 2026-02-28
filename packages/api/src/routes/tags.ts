import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const tagRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
tagRoutes.use('*', authMiddleware);

tagRoutes.get('/', async (c) => {
  const tags = await c.env.DB.prepare('SELECT t.*, COUNT(ut.user_id) as user_count FROM tags t LEFT JOIN user_tags ut ON t.id = ut.tag_id GROUP BY t.id ORDER BY t.created_at DESC').all();
  return c.json({ success: true, data: tags.results || [] });
});

tagRoutes.post('/', async (c) => {
  const { name, color, description } = await c.req.json<{ name: string; color?: string; description?: string }>();
  if (!name) return c.json({ success: false, error: 'name required' }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO tags (id, name, color, description) VALUES (?, ?, ?, ?)').bind(id, name, color || '#06C755', description || null).run();
  const tag = await c.env.DB.prepare('SELECT * FROM tags WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: tag }, 201);
});

tagRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ name?: string; color?: string; description?: string }>();
  const sets: string[] = []; const vals: any[] = [];
  if (body.name) { sets.push('name = ?'); vals.push(body.name); }
  if (body.color) { sets.push('color = ?'); vals.push(body.color); }
  if (body.description !== undefined) { sets.push('description = ?'); vals.push(body.description); }
  if (!sets.length) return c.json({ success: false, error: 'No fields' }, 400);
  await c.env.DB.prepare('UPDATE tags SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals, id).run();
  const tag = await c.env.DB.prepare('SELECT * FROM tags WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: tag });
});

tagRoutes.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM tags WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
});
