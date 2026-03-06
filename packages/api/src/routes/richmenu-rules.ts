import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

type AuthVars = { userId: string; role: string };
export const richmenuRuleRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
richmenuRuleRoutes.use('*', authMiddleware);

const LINE_API_BASE = 'https://api.line.me/v2/bot';

// ─── Condition types (same as segments V2) ───

interface ConditionV2 {
  type: 'tag' | 'attribute' | 'status' | 'last_message_days' | 'engagement_score' | 'conversion' | 'follow_source';
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'exists' | 'not_exists';
  field: string;
  value: string;
}

interface ConditionGroupV2 {
  logic: 'AND' | 'OR';
  negate?: boolean;
  items: (ConditionV2 | ConditionGroupV2)[];
}

function isConditionGroup(item: ConditionV2 | ConditionGroupV2): item is ConditionGroupV2 {
  return 'logic' in item && 'items' in item;
}

// ─── Query Builder (same logic as segments) ───

let joinCounter = 0;

function buildConditionSQL(cond: ConditionV2, bindings: unknown[]): { where: string; joins: string[] } {
  const joins: string[] = [];
  switch (cond.type) {
    case 'tag': {
      const utAlias = `ut${joinCounter}`;
      const tAlias = `tg${joinCounter}`;
      joinCounter++;
      if (cond.operator === 'not_exists') {
        return { joins: [], where: `u.id NOT IN (SELECT ut_ne.user_id FROM user_tags ut_ne JOIN tags t_ne ON ut_ne.tag_id = t_ne.id WHERE t_ne.name = ?)` };
      }
      joins.push(`INNER JOIN user_tags ${utAlias} ON u.id = ${utAlias}.user_id`);
      joins.push(`INNER JOIN tags ${tAlias} ON ${utAlias}.tag_id = ${tAlias}.id`);
      if (cond.operator === 'eq') { bindings.push(cond.value); return { joins, where: `${tAlias}.name = ?` }; }
      if (cond.operator === 'neq') { bindings.push(cond.value); return { joins, where: `${tAlias}.name != ?` }; }
      if (cond.operator === 'contains') { bindings.push(`%${cond.value}%`); return { joins, where: `${tAlias}.name LIKE ?` }; }
      if (cond.operator === 'exists') { return { joins, where: '1=1' }; }
      bindings.push(cond.value);
      return { joins, where: `${tAlias}.name = ?` };
    }
    case 'attribute': {
      const alias = `ua${joinCounter}`;
      joinCounter++;
      if (cond.operator === 'not_exists') { bindings.push(cond.field); return { joins: [], where: `u.id NOT IN (SELECT ua_ne.user_id FROM user_attributes ua_ne WHERE ua_ne.key = ?)` }; }
      if (cond.operator === 'exists') { bindings.push(cond.field); return { joins: [], where: `u.id IN (SELECT ua_ex.user_id FROM user_attributes ua_ex WHERE ua_ex.key = ?)` }; }
      joins.push(`INNER JOIN user_attributes ${alias} ON u.id = ${alias}.user_id AND ${alias}.key = ?`);
      bindings.push(cond.field);
      const opMap: Record<string, string> = {
        eq: `${alias}.value = ?`, neq: `${alias}.value != ?`, contains: `${alias}.value LIKE ?`,
        gt: `CAST(${alias}.value AS REAL) > ?`, lt: `CAST(${alias}.value AS REAL) < ?`,
        gte: `CAST(${alias}.value AS REAL) >= ?`, lte: `CAST(${alias}.value AS REAL) <= ?`,
      };
      if (cond.operator === 'contains') { bindings.push(`%${cond.value}%`); }
      else if (['gt', 'lt', 'gte', 'lte'].includes(cond.operator)) { bindings.push(Number(cond.value)); }
      else { bindings.push(cond.value); }
      return { joins, where: opMap[cond.operator] || `${alias}.value = ?` };
    }
    case 'status': {
      bindings.push(cond.value);
      if (cond.operator === 'neq') return { joins: [], where: 'u.status != ?' };
      return { joins: [], where: 'u.status = ?' };
    }
    case 'last_message_days': {
      const days = Number(cond.value);
      if (cond.operator === 'lt') return { joins: [], where: `u.id IN (SELECT user_id FROM messages WHERE sent_at >= datetime('now', '-${days} days'))` };
      if (cond.operator === 'gt') return { joins: [], where: `u.id NOT IN (SELECT user_id FROM messages WHERE sent_at >= datetime('now', '-${days} days'))` };
      return { joins: [], where: '1=1' };
    }
    case 'engagement_score': {
      const alias = `es${joinCounter}`;
      joinCounter++;
      joins.push(`INNER JOIN engagement_scores ${alias} ON u.id = ${alias}.user_id`);
      if (cond.field === 'rank') {
        bindings.push(cond.value);
        if (cond.operator === 'neq') return { joins, where: `${alias}.rank != ?` };
        return { joins, where: `${alias}.rank = ?` };
      }
      const scoreVal = Number(cond.value);
      bindings.push(scoreVal);
      const scoreOps: Record<string, string> = {
        eq: `${alias}.total_score = ?`, gt: `${alias}.total_score > ?`, lt: `${alias}.total_score < ?`,
        gte: `${alias}.total_score >= ?`, lte: `${alias}.total_score <= ?`,
      };
      return { joins, where: scoreOps[cond.operator] || `${alias}.total_score = ?` };
    }
    case 'conversion': {
      if (cond.operator === 'exists') { bindings.push(cond.value); return { joins: [], where: `u.id IN (SELECT cv.user_id FROM conversions cv JOIN conversion_goals cg ON cv.goal_id = cg.id WHERE cg.name = ?)` }; }
      if (cond.operator === 'not_exists') { bindings.push(cond.value); return { joins: [], where: `u.id NOT IN (SELECT cv.user_id FROM conversions cv JOIN conversion_goals cg ON cv.goal_id = cg.id WHERE cg.name = ?)` }; }
      bindings.push(cond.value);
      return { joins: [], where: `u.id IN (SELECT cv.user_id FROM conversions cv JOIN conversion_goals cg ON cv.goal_id = cg.id WHERE cg.name = ?)` };
    }
    case 'follow_source': {
      bindings.push(cond.value);
      if (cond.field === 'type') {
        if (cond.operator === 'neq') return { joins: [], where: `u.id NOT IN (SELECT fe.user_id FROM follow_events fe JOIN follow_sources fs ON fe.source_id = fs.id WHERE fs.source_type = ?)` };
        return { joins: [], where: `u.id IN (SELECT fe.user_id FROM follow_events fe JOIN follow_sources fs ON fe.source_id = fs.id WHERE fs.source_type = ?)` };
      }
      if (cond.operator === 'contains') { bindings.pop(); bindings.push(`%${cond.value}%`); return { joins: [], where: `u.id IN (SELECT fe.user_id FROM follow_events fe JOIN follow_sources fs ON fe.source_id = fs.id WHERE fs.name LIKE ?)` }; }
      return { joins: [], where: `u.id IN (SELECT fe.user_id FROM follow_events fe JOIN follow_sources fs ON fe.source_id = fs.id WHERE fs.name = ?)` };
    }
    default:
      return { joins: [], where: '1=1' };
  }
}

function buildGroupSQL(group: ConditionGroupV2, bindings: unknown[]): { where: string; joins: string[] } {
  const allJoins: string[] = [];
  const whereParts: string[] = [];
  for (const item of group.items) {
    if (isConditionGroup(item)) {
      const sub = buildGroupSQL(item, bindings);
      allJoins.push(...sub.joins);
      if (sub.where) whereParts.push(`(${sub.where})`);
    } else {
      const sub = buildConditionSQL(item, bindings);
      allJoins.push(...sub.joins);
      if (sub.where) whereParts.push(sub.where);
    }
  }
  const connector = group.logic === 'OR' ? ' OR ' : ' AND ';
  let where = whereParts.length > 0 ? whereParts.join(connector) : '1=1';
  if (group.negate) where = `NOT (${where})`;
  return { joins: allJoins, where };
}

function buildSegmentQuery(group: ConditionGroupV2, selectFields: string): { sql: string; bindings: unknown[] } {
  joinCounter = 0;
  const bindings: unknown[] = [];
  const { joins, where } = buildGroupSQL(group, bindings);
  const joinClause = joins.length > 0 ? joins.join(' ') : '';
  const whereClause = where ? `WHERE ${where}` : '';
  return { sql: `SELECT DISTINCT ${selectFields} FROM users u ${joinClause} ${whereClause}`, bindings };
}

// ─── Ensure table exists ───

async function ensureTable(db: D1Database) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS richmenu_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      rich_menu_id TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      condition_group TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

// ─── LINE API helpers ───

async function linkRichMenuToUser(userId: string, richMenuId: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${LINE_API_BASE}/user/${userId}/richmenu/${richMenuId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch { return false; }
}

async function bulkLinkRichMenu(userIds: string[], richMenuId: string, token: string): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  // LINE API bulk link: max 500 users per request
  for (let i = 0; i < userIds.length; i += 500) {
    const batch = userIds.slice(i, i + 500);
    try {
      const res = await fetch(`${LINE_API_BASE}/richmenu/bulk/link`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ richMenuId, userIds: batch }),
      });
      if (res.ok) { success += batch.length; }
      else { failed += batch.length; }
    } catch { failed += batch.length; }
  }
  return { success, failed };
}

// ─── GET / — List rules ───

richmenuRuleRoutes.get('/', async (c) => {
  try {
    await ensureTable(c.env.DB);
    const rows = await c.env.DB.prepare(
      'SELECT * FROM richmenu_rules ORDER BY priority DESC, created_at ASC'
    ).all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e) {
    console.error('Failed to list richmenu rules:', e);
    return c.json({ success: false, error: 'Failed to list rules' }, 500);
  }
});

// ─── POST / — Create rule ───

richmenuRuleRoutes.post('/', roleMiddleware('admin', 'operator'), async (c) => {
  try {
    await ensureTable(c.env.DB);
    const body = await c.req.json<{
      name: string;
      rich_menu_id: string;
      priority?: number;
      condition_group: ConditionGroupV2;
    }>();

    if (!body.name || !body.rich_menu_id || !body.condition_group) {
      return c.json({ success: false, error: 'name, rich_menu_id, condition_group required' }, 400);
    }

    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO richmenu_rules (id, name, rich_menu_id, priority, condition_group)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, body.name, body.rich_menu_id, body.priority || 0, JSON.stringify(body.condition_group)).run();

    return c.json({ success: true, data: { id } });
  } catch (e) {
    console.error('Failed to create richmenu rule:', e);
    return c.json({ success: false, error: 'Failed to create rule' }, 500);
  }
});

// ─── PUT /:id — Update rule ───

richmenuRuleRoutes.put('/:id', roleMiddleware('admin', 'operator'), async (c) => {
  try {
    await ensureTable(c.env.DB);
    const id = c.req.param('id');
    const body = await c.req.json<{
      name?: string;
      rich_menu_id?: string;
      priority?: number;
      condition_group?: ConditionGroupV2;
      is_active?: number;
    }>();

    const existing = await c.env.DB.prepare('SELECT id FROM richmenu_rules WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ success: false, error: 'Rule not found' }, 404);

    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name); }
    if (body.rich_menu_id !== undefined) { updates.push('rich_menu_id = ?'); values.push(body.rich_menu_id); }
    if (body.priority !== undefined) { updates.push('priority = ?'); values.push(body.priority); }
    if (body.condition_group !== undefined) { updates.push('condition_group = ?'); values.push(JSON.stringify(body.condition_group)); }
    if (body.is_active !== undefined) { updates.push('is_active = ?'); values.push(body.is_active); }

    if (updates.length === 0) return c.json({ success: false, error: 'No fields to update' }, 400);

    updates.push("updated_at = datetime('now')");
    values.push(id);

    await c.env.DB.prepare(
      `UPDATE richmenu_rules SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    return c.json({ success: true });
  } catch (e) {
    console.error('Failed to update richmenu rule:', e);
    return c.json({ success: false, error: 'Failed to update rule' }, 500);
  }
});

// ─── DELETE /:id — Delete rule ───

richmenuRuleRoutes.delete('/:id', roleMiddleware('admin', 'operator'), async (c) => {
  try {
    await ensureTable(c.env.DB);
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM richmenu_rules WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (e) {
    console.error('Failed to delete richmenu rule:', e);
    return c.json({ success: false, error: 'Failed to delete rule' }, 500);
  }
});

// ─── POST /preview — Preview matching users for a condition group ───

richmenuRuleRoutes.post('/preview', async (c) => {
  try {
    const body = await c.req.json<{ condition_group: ConditionGroupV2 }>();
    if (!body.condition_group) return c.json({ success: false, error: 'condition_group required' }, 400);

    const { sql, bindings } = buildSegmentQuery(body.condition_group, 'u.id, u.display_name, u.picture_url, u.line_user_id');
    const result = await c.env.DB.prepare(sql).bind(...bindings).all();
    const users = result.results || [];

    return c.json({ success: true, data: { count: users.length, users: users.slice(0, 50) } });
  } catch (e) {
    console.error('Failed to preview richmenu rule:', e);
    return c.json({ success: false, error: 'Failed to preview' }, 500);
  }
});

// ─── POST /evaluate — Evaluate all rules and apply rich menus ───

richmenuRuleRoutes.post('/evaluate', roleMiddleware('admin'), async (c) => {
  try {
    await ensureTable(c.env.DB);
    const rules = await c.env.DB.prepare(
      'SELECT * FROM richmenu_rules WHERE is_active = 1 ORDER BY priority DESC, created_at ASC'
    ).all();

    const activeRules = (rules.results || []) as Array<{
      id: string; name: string; rich_menu_id: string; priority: number; condition_group: string;
    }>;

    if (activeRules.length === 0) {
      return c.json({ success: true, data: { message: 'No active rules', applied: 0 } });
    }

    // Track which users have been assigned (highest priority wins)
    const assignedUsers = new Set<string>();
    const results: Array<{ rule_id: string; rule_name: string; rich_menu_id: string; matched: number; linked: number; failed: number }> = [];

    for (const rule of activeRules) {
      const condGroup: ConditionGroupV2 = JSON.parse(rule.condition_group);
      const { sql, bindings } = buildSegmentQuery(condGroup, 'u.id, u.line_user_id');
      const matchResult = await c.env.DB.prepare(sql).bind(...bindings).all();
      const matchedUsers = (matchResult.results || []) as Array<{ id: string; line_user_id: string }>;

      // Filter out already-assigned users
      const unassigned = matchedUsers.filter(u => !assignedUsers.has(u.id) && u.line_user_id);

      if (unassigned.length > 0) {
        const lineUserIds = unassigned.map(u => u.line_user_id);
        const { success, failed } = await bulkLinkRichMenu(lineUserIds, rule.rich_menu_id, c.env.LINE_CHANNEL_ACCESS_TOKEN);

        unassigned.forEach(u => assignedUsers.add(u.id));

        results.push({
          rule_id: rule.id,
          rule_name: rule.name,
          rich_menu_id: rule.rich_menu_id,
          matched: matchedUsers.length,
          linked: success,
          failed,
        });
      } else {
        results.push({
          rule_id: rule.id,
          rule_name: rule.name,
          rich_menu_id: rule.rich_menu_id,
          matched: matchedUsers.length,
          linked: 0,
          failed: 0,
        });
      }
    }

    const totalLinked = results.reduce((sum, r) => sum + r.linked, 0);

    // Store last evaluation result
    try {
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO kv_cache (key, value, expires_at) VALUES (?, ?, datetime('now', '+30 days'))`
      ).bind('richmenu_eval_last', JSON.stringify({ timestamp: new Date().toISOString(), results, totalLinked })).run();
    } catch { /* ignore cache write error */ }

    return c.json({ success: true, data: { totalLinked, results } });
  } catch (e) {
    console.error('Failed to evaluate richmenu rules:', e);
    return c.json({ success: false, error: 'Failed to evaluate rules' }, 500);
  }
});

// ─── POST /evaluate/:userId — Evaluate rules for a single user ───

richmenuRuleRoutes.post('/evaluate/:userId', roleMiddleware('admin', 'operator'), async (c) => {
  try {
    await ensureTable(c.env.DB);
    const userId = c.req.param('userId');

    const user = await c.env.DB.prepare('SELECT id, line_user_id FROM users WHERE id = ?').bind(userId).first<{ id: string; line_user_id: string }>();
    if (!user || !user.line_user_id) return c.json({ success: false, error: 'User not found or no LINE ID' }, 404);

    const rules = await c.env.DB.prepare(
      'SELECT * FROM richmenu_rules WHERE is_active = 1 ORDER BY priority DESC, created_at ASC'
    ).all();

    const activeRules = (rules.results || []) as Array<{
      id: string; name: string; rich_menu_id: string; condition_group: string;
    }>;

    for (const rule of activeRules) {
      const condGroup: ConditionGroupV2 = JSON.parse(rule.condition_group);
      const { sql, bindings } = buildSegmentQuery(condGroup, 'u.id');
      const fullSql = sql + ` AND u.id = ?`;
      bindings.push(userId);

      const match = await c.env.DB.prepare(fullSql).bind(...bindings).first();
      if (match) {
        const linked = await linkRichMenuToUser(user.line_user_id, rule.rich_menu_id, c.env.LINE_CHANNEL_ACCESS_TOKEN);
        return c.json({
          success: true,
          data: { matched_rule: rule.name, rich_menu_id: rule.rich_menu_id, linked },
        });
      }
    }

    return c.json({ success: true, data: { matched_rule: null, message: 'No rule matched' } });
  } catch (e) {
    console.error('Failed to evaluate richmenu for user:', e);
    return c.json({ success: false, error: 'Failed to evaluate' }, 500);
  }
});

// ─── GET /status — Last evaluation status ───

richmenuRuleRoutes.get('/status', async (c) => {
  try {
    await ensureTable(c.env.DB);
    const ruleCount = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM richmenu_rules').first<{ cnt: number }>();
    const activeCount = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM richmenu_rules WHERE is_active = 1').first<{ cnt: number }>();

    let lastEval = null;
    try {
      const cache = await c.env.DB.prepare("SELECT value FROM kv_cache WHERE key = 'richmenu_eval_last' AND expires_at > datetime('now')").first<{ value: string }>();
      if (cache) lastEval = JSON.parse(cache.value);
    } catch { /* ignore */ }

    return c.json({
      success: true,
      data: {
        total_rules: ruleCount?.cnt || 0,
        active_rules: activeCount?.cnt || 0,
        last_evaluation: lastEval,
      },
    });
  } catch (e) {
    console.error('Failed to get richmenu rules status:', e);
    return c.json({ success: false, error: 'Failed to get status' }, 500);
  }
});
