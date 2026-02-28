import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const knowledgeRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
knowledgeRoutes.use('*', authMiddleware);

// GET / — ナレッジ一覧（カテゴリフィルタ+検索）
knowledgeRoutes.get('/', async (c) => {
  const category = c.req.query('category') || '';
  const search = c.req.query('search') || '';
  let query = 'SELECT * FROM knowledge_base WHERE 1=1';
  const binds: any[] = [];
  if (category) { query += ' AND category = ?'; binds.push(category); }
  if (search) { query += ' AND (title LIKE ? OR content LIKE ?)'; binds.push('%' + search + '%', '%' + search + '%'); }
  query += ' ORDER BY updated_at DESC';
  const rows = await c.env.DB.prepare(query).bind(...binds).all();
  return c.json({ success: true, data: rows.results || [] });
});

// GET /categories — カテゴリ一覧
knowledgeRoutes.get('/categories', async (c) => {
  const rows = await c.env.DB.prepare("SELECT DISTINCT category, COUNT(*) as count FROM knowledge_base WHERE category IS NOT NULL GROUP BY category ORDER BY count DESC").all();
  return c.json({ success: true, data: rows.results || [] });
});

// GET /:id — 詳細
knowledgeRoutes.get('/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM knowledge_base WHERE id = ?').bind(c.req.param('id')).first();
  if (!row) return c.json({ success: false, error: 'Not found' }, 404);
  return c.json({ success: true, data: row });
});

// POST / — 作成
knowledgeRoutes.post('/', async (c) => {
  const body = await c.req.json<{ title: string; content: string; category?: string }>();
  if (!body.title || !body.content) return c.json({ success: false, error: 'title and content required' }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO knowledge_base (id, title, content, category, is_active) VALUES (?, ?, ?, ?, 1)')
    .bind(id, body.title, body.content, body.category || null).run();
  const created = await c.env.DB.prepare('SELECT * FROM knowledge_base WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: created }, 201);
});

// PUT /:id — 更新
knowledgeRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ title?: string; content?: string; category?: string; is_active?: number }>();
  const sets: string[] = []; const vals: any[] = [];
  if (body.title) { sets.push('title = ?'); vals.push(body.title); }
  if (body.content) { sets.push('content = ?'); vals.push(body.content); }
  if (body.category !== undefined) { sets.push('category = ?'); vals.push(body.category); }
  if (body.is_active !== undefined) { sets.push('is_active = ?'); vals.push(body.is_active); }
  if (!sets.length) return c.json({ success: false, error: 'No fields' }, 400);
  sets.push("updated_at = datetime('now')");
  await c.env.DB.prepare('UPDATE knowledge_base SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals, id).run();
  const updated = await c.env.DB.prepare('SELECT * FROM knowledge_base WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: updated });
});

// DELETE /:id
knowledgeRoutes.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM knowledge_base WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
});
