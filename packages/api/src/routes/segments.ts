import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { sendPushMessage } from '../lib/line';

type AuthVars = { userId: string };
export const segmentRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
segmentRoutes.use('*', authMiddleware);

// ─── V2 Types ───

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

// V1 backward compat
interface SegmentConditionV1 {
  type: 'tag' | 'attribute' | 'status' | 'last_message_days';
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt';
  field: string;
  value: string;
}

function isConditionGroup(item: ConditionV2 | ConditionGroupV2): item is ConditionGroupV2 {
  return 'logic' in item && 'items' in item;
}

// ─── V2 Query Builder ───

let joinCounter = 0;

function buildConditionSQL(
  cond: ConditionV2,
  bindings: unknown[]
): { where: string; joins: string[] } {
  const joins: string[] = [];

  switch (cond.type) {
    case 'tag': {
      const utAlias = `ut${joinCounter}`;
      const tAlias = `tg${joinCounter}`;
      joinCounter++;

      if (cond.operator === 'not_exists') {
        return {
          joins: [],
          where: `u.id NOT IN (SELECT ut_ne.user_id FROM user_tags ut_ne JOIN tags t_ne ON ut_ne.tag_id = t_ne.id WHERE t_ne.name = ?)`,
        };
      }

      joins.push(`INNER JOIN user_tags ${utAlias} ON u.id = ${utAlias}.user_id`);
      joins.push(`INNER JOIN tags ${tAlias} ON ${utAlias}.tag_id = ${tAlias}.id`);

      if (cond.operator === 'eq') {
        bindings.push(cond.value);
        return { joins, where: `${tAlias}.name = ?` };
      }
      if (cond.operator === 'neq') {
        bindings.push(cond.value);
        return { joins, where: `${tAlias}.name != ?` };
      }
      if (cond.operator === 'contains') {
        bindings.push(`%${cond.value}%`);
        return { joins, where: `${tAlias}.name LIKE ?` };
      }
      if (cond.operator === 'exists') {
        return { joins, where: '1=1' };
      }
      bindings.push(cond.value);
      return { joins, where: `${tAlias}.name = ?` };
    }

    case 'attribute': {
      const alias = `ua${joinCounter}`;
      joinCounter++;

      if (cond.operator === 'not_exists') {
        bindings.push(cond.field);
        return { joins: [], where: `u.id NOT IN (SELECT ua_ne.user_id FROM user_attributes ua_ne WHERE ua_ne.key = ?)` };
      }
      if (cond.operator === 'exists') {
        bindings.push(cond.field);
        return { joins: [], where: `u.id IN (SELECT ua_ex.user_id FROM user_attributes ua_ex WHERE ua_ex.key = ?)` };
      }

      joins.push(`INNER JOIN user_attributes ${alias} ON u.id = ${alias}.user_id AND ${alias}.key = ?`);
      bindings.push(cond.field);

      const opMap: Record<string, string> = {
        eq: `${alias}.value = ?`,
        neq: `${alias}.value != ?`,
        contains: `${alias}.value LIKE ?`,
        gt: `CAST(${alias}.value AS REAL) > ?`,
        lt: `CAST(${alias}.value AS REAL) < ?`,
        gte: `CAST(${alias}.value AS REAL) >= ?`,
        lte: `CAST(${alias}.value AS REAL) <= ?`,
      };

      if (cond.operator === 'contains') {
        bindings.push(`%${cond.value}%`);
      } else if (['gt', 'lt', 'gte', 'lte'].includes(cond.operator)) {
        bindings.push(Number(cond.value));
      } else {
        bindings.push(cond.value);
      }
      return { joins, where: opMap[cond.operator] || `${alias}.value = ?` };
    }

    case 'status': {
      if (cond.operator === 'eq') {
        bindings.push(cond.value);
        return { joins: [], where: 'u.status = ?' };
      }
      if (cond.operator === 'neq') {
        bindings.push(cond.value);
        return { joins: [], where: 'u.status != ?' };
      }
      bindings.push(cond.value);
      return { joins: [], where: 'u.status = ?' };
    }

    case 'last_message_days': {
      const days = Number(cond.value);
      if (cond.operator === 'lt') {
        return { joins: [], where: `u.id IN (SELECT user_id FROM messages WHERE sent_at >= datetime('now', '-${days} days'))` };
      }
      if (cond.operator === 'gt') {
        return { joins: [], where: `u.id NOT IN (SELECT user_id FROM messages WHERE sent_at >= datetime('now', '-${days} days'))` };
      }
      if (cond.operator === 'eq') {
        bindings.push(days);
        return { joins: [], where: `u.id IN (SELECT user_id FROM messages GROUP BY user_id HAVING CAST(julianday('now') - julianday(MAX(sent_at)) AS INTEGER) = ?)` };
      }
      return { joins: [], where: '1=1' };
    }

    case 'engagement_score': {
      const alias = `es${joinCounter}`;
      joinCounter++;

      if (cond.field === 'rank') {
        joins.push(`INNER JOIN engagement_scores ${alias} ON u.id = ${alias}.user_id`);
        if (cond.operator === 'eq') {
          bindings.push(cond.value);
          return { joins, where: `${alias}.rank = ?` };
        }
        if (cond.operator === 'neq') {
          bindings.push(cond.value);
          return { joins, where: `${alias}.rank != ?` };
        }
        bindings.push(cond.value);
        return { joins, where: `${alias}.rank = ?` };
      }

      // score field (numeric)
      joins.push(`INNER JOIN engagement_scores ${alias} ON u.id = ${alias}.user_id`);
      const scoreVal = Number(cond.value);
      bindings.push(scoreVal);
      const scoreOps: Record<string, string> = {
        eq: `${alias}.total_score = ?`,
        gt: `${alias}.total_score > ?`,
        lt: `${alias}.total_score < ?`,
        gte: `${alias}.total_score >= ?`,
        lte: `${alias}.total_score <= ?`,
      };
      return { joins, where: scoreOps[cond.operator] || `${alias}.total_score = ?` };
    }

    case 'conversion': {
      if (cond.operator === 'exists') {
        // Has any conversion for this goal
        bindings.push(cond.value);
        return { joins: [], where: `u.id IN (SELECT cv.user_id FROM conversions cv JOIN conversion_goals cg ON cv.goal_id = cg.id WHERE cg.name = ?)` };
      }
      if (cond.operator === 'not_exists') {
        bindings.push(cond.value);
        return { joins: [], where: `u.id NOT IN (SELECT cv.user_id FROM conversions cv JOIN conversion_goals cg ON cv.goal_id = cg.id WHERE cg.name = ?)` };
      }
      // count-based: gt/lt number of conversions for a goal
      if (cond.field === 'count') {
        const cnt = Number(cond.value);
        bindings.push(cnt);
        return { joins: [], where: `(SELECT COUNT(*) FROM conversions WHERE user_id = u.id) ${cond.operator === 'gt' ? '>' : '<'} ?` };
      }
      bindings.push(cond.value);
      return { joins: [], where: `u.id IN (SELECT cv.user_id FROM conversions cv JOIN conversion_goals cg ON cv.goal_id = cg.id WHERE cg.name = ?)` };
    }

    case 'follow_source': {
      if (cond.field === 'type') {
        bindings.push(cond.value);
        if (cond.operator === 'eq') {
          return { joins: [], where: `u.id IN (SELECT fe.user_id FROM follow_events fe JOIN follow_sources fs ON fe.source_id = fs.id WHERE fs.source_type = ?)` };
        }
        if (cond.operator === 'neq') {
          return { joins: [], where: `u.id NOT IN (SELECT fe.user_id FROM follow_events fe JOIN follow_sources fs ON fe.source_id = fs.id WHERE fs.source_type = ?)` };
        }
        return { joins: [], where: `u.id IN (SELECT fe.user_id FROM follow_events fe JOIN follow_sources fs ON fe.source_id = fs.id WHERE fs.source_type = ?)` };
      }
      // name match
      bindings.push(cond.value);
      if (cond.operator === 'eq') {
        return { joins: [], where: `u.id IN (SELECT fe.user_id FROM follow_events fe JOIN follow_sources fs ON fe.source_id = fs.id WHERE fs.name = ?)` };
      }
      if (cond.operator === 'contains') {
        bindings.pop();
        bindings.push(`%${cond.value}%`);
        return { joins: [], where: `u.id IN (SELECT fe.user_id FROM follow_events fe JOIN follow_sources fs ON fe.source_id = fs.id WHERE fs.name LIKE ?)` };
      }
      return { joins: [], where: `u.id IN (SELECT fe.user_id FROM follow_events fe JOIN follow_sources fs ON fe.source_id = fs.id WHERE fs.name = ?)` };
    }

    default:
      return { joins: [], where: '1=1' };
  }
}

function buildGroupSQL(
  group: ConditionGroupV2,
  bindings: unknown[]
): { where: string; joins: string[] } {
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
  if (group.negate) {
    where = `NOT (${where})`;
  }

  return { joins: allJoins, where };
}

function buildSegmentQueryV2(
  group: ConditionGroupV2,
  selectFields: string
): { sql: string; bindings: unknown[] } {
  joinCounter = 0;
  const bindings: unknown[] = [];
  const { joins, where } = buildGroupSQL(group, bindings);

  const joinClause = joins.length > 0 ? joins.join(' ') : '';
  const whereClause = where ? `WHERE ${where}` : '';

  const sql = `SELECT DISTINCT ${selectFields} FROM users u ${joinClause} ${whereClause}`;
  return { sql, bindings };
}

// ─── V1 backward compat ───

function convertV1ToV2(conditions: SegmentConditionV1[]): ConditionGroupV2 {
  return {
    logic: 'AND',
    items: conditions.map(c => ({
      type: c.type,
      operator: c.operator as ConditionV2['operator'],
      field: c.field,
      value: c.value,
    })),
  };
}

// ─── Endpoints ───

// POST /preview
segmentRoutes.post('/preview', async (c) => {
  try {
    const body = await c.req.json<{
      conditions?: SegmentConditionV1[];
      condition_group?: ConditionGroupV2;
    }>();

    let group: ConditionGroupV2;

    if (body.condition_group) {
      group = body.condition_group;
    } else if (body.conditions && Array.isArray(body.conditions) && body.conditions.length > 0) {
      group = convertV1ToV2(body.conditions);
    } else {
      return c.json({ success: false, error: 'conditions or condition_group required' }, 400);
    }

    const { sql, bindings } = buildSegmentQueryV2(group, 'u.id, u.display_name, u.picture_url');
    const result = await c.env.DB.prepare(sql).bind(...bindings).all();
    const users = result.results || [];

    return c.json({
      success: true,
      data: {
        count: users.length,
        users: users.map((u: Record<string, unknown>) => ({
          id: u.id,
          display_name: u.display_name,
          picture_url: u.picture_url,
        })),
      },
    });
  } catch (err) {
    console.error('Segment preview error:', err);
    return c.json({ success: false, error: 'Failed to preview segment' }, 500);
  }
});

// POST /send
segmentRoutes.post('/send', async (c) => {
  try {
    const body = await c.req.json<{
      conditions?: SegmentConditionV1[];
      condition_group?: ConditionGroupV2;
      message?: { type: string; text: string };
      messages?: unknown[];
    }>();

    let group: ConditionGroupV2;

    if (body.condition_group) {
      group = body.condition_group;
    } else if (body.conditions && Array.isArray(body.conditions) && body.conditions.length > 0) {
      group = convertV1ToV2(body.conditions);
    } else {
      return c.json({ success: false, error: 'conditions or condition_group required' }, 400);
    }

    // Support both V1 single message and V2 messages array
    let lineMessages: unknown[];
    let contentSummary: string;

    if (body.messages && Array.isArray(body.messages) && body.messages.length > 0) {
      lineMessages = body.messages.slice(0, 5); // LINE API max 5
      contentSummary = lineMessages.map((m: any) => {
        if (m.type === 'text') return m.text?.substring(0, 30) || '';
        return `[${m.type}]`;
      }).join(' / ');
    } else if (body.message && body.message.text) {
      lineMessages = [{ type: body.message.type || 'text', text: body.message.text }];
      contentSummary = body.message.text;
    } else {
      return c.json({ success: false, error: 'messages array or message.text is required' }, 400);
    }

    const { sql, bindings } = buildSegmentQueryV2(group, 'u.id, u.line_user_id');
    const result = await c.env.DB.prepare(sql).bind(...bindings).all();
    const users = (result.results || []) as Array<{ id: string; line_user_id: string }>;

    if (users.length === 0) {
      return c.json({ success: true, data: { sent: 0, failed: 0 } });
    }

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await sendPushMessage(
          user.line_user_id,
          lineMessages,
          c.env.LINE_CHANNEL_ACCESS_TOKEN
        );

        const firstType = (lineMessages[0] as any)?.type || 'text';
        await c.env.DB.prepare(
          'INSERT INTO messages (id, user_id, direction, message_type, content, raw_json) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(crypto.randomUUID(), user.id, 'outbound', firstType, contentSummary.substring(0, 200), JSON.stringify(lineMessages)).run();

        await c.env.DB.prepare(
          "INSERT INTO delivery_logs (id, scenario_id, scenario_step_id, user_id, status, sent_at) VALUES (?, NULL, NULL, ?, 'sent', datetime('now'))"
        ).bind(crypto.randomUUID(), user.id).run();

        sent++;
      } catch (err) {
        console.error(`Failed to send to user ${user.id}:`, err);
        await c.env.DB.prepare(
          "INSERT INTO delivery_logs (id, scenario_id, scenario_step_id, user_id, status, error_message) VALUES (?, NULL, NULL, ?, 'failed', ?)"
        ).bind(crypto.randomUUID(), user.id, String(err)).run();
        failed++;
      }
    }

    return c.json({ success: true, data: { sent, failed } });
  } catch (err) {
    console.error('Segment send error:', err);
    return c.json({ success: false, error: 'Failed to send segment messages' }, 500);
  }
});

// GET /history
segmentRoutes.get('/history', async (c) => {
  try {
    const page = Number(c.req.query('page') || '1');
    const limit = Number(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;

    const countResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM delivery_logs WHERE scenario_id IS NULL'
    ).first<{ total: number }>();
    const total = countResult?.total || 0;

    const rows = await c.env.DB.prepare(
      `SELECT dl.id, dl.user_id, dl.status, dl.sent_at, dl.error_message, dl.created_at,
              u.display_name, u.picture_url
       FROM delivery_logs dl
       LEFT JOIN users u ON dl.user_id = u.id
       WHERE dl.scenario_id IS NULL
       ORDER BY dl.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();

    return c.json({
      success: true,
      data: rows.results || [],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Segment history error:', err);
    return c.json({ success: false, error: 'Failed to fetch delivery history' }, 500);
  }
});
