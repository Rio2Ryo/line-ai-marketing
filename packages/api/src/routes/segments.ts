import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { sendPushMessage } from '../lib/line';

type AuthVars = { userId: string };
export const segmentRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
segmentRoutes.use('*', authMiddleware);

interface SegmentCondition {
  type: 'tag' | 'attribute' | 'status' | 'last_message_days';
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt';
  field: string;
  value: string;
}

function buildSegmentQuery(
  conditions: SegmentCondition[],
  selectFields: string
): { sql: string; bindings: unknown[] } {
  const joins: string[] = [];
  const wheres: string[] = [];
  const bindings: unknown[] = [];
  let tagJoinIdx = 0;
  let attrJoinIdx = 0;

  for (const cond of conditions) {
    switch (cond.type) {
      case 'tag': {
        const alias = `ut${tagJoinIdx++}`;
        const tagAlias = `t${tagJoinIdx}`;
        joins.push(
          `INNER JOIN user_tags ${alias} ON u.id = ${alias}.user_id`
        );
        joins.push(
          `INNER JOIN tags ${tagAlias} ON ${alias}.tag_id = ${tagAlias}.id`
        );
        if (cond.operator === 'eq') {
          wheres.push(`${tagAlias}.name = ?`);
          bindings.push(cond.value);
        } else if (cond.operator === 'neq') {
          wheres.push(`${tagAlias}.name != ?`);
          bindings.push(cond.value);
        } else if (cond.operator === 'contains') {
          wheres.push(`${tagAlias}.name LIKE ?`);
          bindings.push(`%${cond.value}%`);
        }
        break;
      }
      case 'attribute': {
        const alias = `ua${attrJoinIdx++}`;
        joins.push(
          `INNER JOIN user_attributes ${alias} ON u.id = ${alias}.user_id AND ${alias}.key = ?`
        );
        bindings.push(cond.field);
        if (cond.operator === 'eq') {
          wheres.push(`${alias}.value = ?`);
          bindings.push(cond.value);
        } else if (cond.operator === 'neq') {
          wheres.push(`${alias}.value != ?`);
          bindings.push(cond.value);
        } else if (cond.operator === 'contains') {
          wheres.push(`${alias}.value LIKE ?`);
          bindings.push(`%${cond.value}%`);
        } else if (cond.operator === 'gt') {
          wheres.push(`CAST(${alias}.value AS REAL) > ?`);
          bindings.push(Number(cond.value));
        } else if (cond.operator === 'lt') {
          wheres.push(`CAST(${alias}.value AS REAL) < ?`);
          bindings.push(Number(cond.value));
        }
        break;
      }
      case 'status': {
        if (cond.operator === 'eq') {
          wheres.push('u.status = ?');
          bindings.push(cond.value);
        } else if (cond.operator === 'neq') {
          wheres.push('u.status != ?');
          bindings.push(cond.value);
        }
        break;
      }
      case 'last_message_days': {
        const days = Number(cond.value);
        if (cond.operator === 'lt') {
          // Last message within N days
          wheres.push(
            `u.id IN (SELECT user_id FROM messages WHERE sent_at >= datetime('now', '-${days} days'))`
          );
        } else if (cond.operator === 'gt') {
          // Last message more than N days ago (or never)
          wheres.push(
            `u.id NOT IN (SELECT user_id FROM messages WHERE sent_at >= datetime('now', '-${days} days'))`
          );
        } else if (cond.operator === 'eq') {
          // Last message exactly N days ago (within that day)
          wheres.push(
            `u.id IN (SELECT user_id FROM messages GROUP BY user_id HAVING CAST(julianday('now') - julianday(MAX(sent_at)) AS INTEGER) = ?)`
          );
          bindings.push(days);
        }
        break;
      }
    }
  }

  const joinClause = joins.length > 0 ? joins.join(' ') : '';
  const whereClause = wheres.length > 0 ? 'WHERE ' + wheres.join(' AND ') : '';

  const sql = `SELECT DISTINCT ${selectFields} FROM users u ${joinClause} ${whereClause}`;
  return { sql, bindings };
}

// POST /preview — Preview matched users for given segment conditions
segmentRoutes.post('/preview', async (c) => {
  try {
    const body = await c.req.json<{ conditions: SegmentCondition[] }>();
    if (!body.conditions || !Array.isArray(body.conditions) || body.conditions.length === 0) {
      return c.json({ success: false, error: 'conditions is required and must be a non-empty array' }, 400);
    }

    const { sql, bindings } = buildSegmentQuery(
      body.conditions,
      'u.id, u.display_name, u.picture_url'
    );

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

// POST /send — Execute segment delivery
segmentRoutes.post('/send', async (c) => {
  try {
    const body = await c.req.json<{
      conditions: SegmentCondition[];
      message: { type: string; text: string };
    }>();

    if (!body.conditions || !Array.isArray(body.conditions) || body.conditions.length === 0) {
      return c.json({ success: false, error: 'conditions is required' }, 400);
    }
    if (!body.message || !body.message.text) {
      return c.json({ success: false, error: 'message.text is required' }, 400);
    }

    const { sql, bindings } = buildSegmentQuery(
      body.conditions,
      'u.id, u.line_user_id'
    );

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
          [{ type: body.message.type || 'text', text: body.message.text }],
          c.env.LINE_CHANNEL_ACCESS_TOKEN
        );

        // Record outbound message
        const msgId = crypto.randomUUID();
        await c.env.DB.prepare(
          'INSERT INTO messages (id, user_id, direction, message_type, content) VALUES (?, ?, ?, ?, ?)'
        )
          .bind(msgId, user.id, 'outbound', 'text', body.message.text)
          .run();

        // Record delivery log (scenario_id IS NULL for segment delivery)
        await c.env.DB.prepare(
          "INSERT INTO delivery_logs (id, scenario_id, scenario_step_id, user_id, status, sent_at) VALUES (?, NULL, NULL, ?, 'sent', datetime('now'))"
        )
          .bind(crypto.randomUUID(), user.id)
          .run();

        sent++;
      } catch (err) {
        console.error(`Failed to send to user ${user.id}:`, err);

        await c.env.DB.prepare(
          "INSERT INTO delivery_logs (id, scenario_id, scenario_step_id, user_id, status, error_message) VALUES (?, NULL, NULL, ?, 'failed', ?)"
        )
          .bind(crypto.randomUUID(), user.id, String(err))
          .run();

        failed++;
      }
    }

    return c.json({ success: true, data: { sent, failed } });
  } catch (err) {
    console.error('Segment send error:', err);
    return c.json({ success: false, error: 'Failed to send segment messages' }, 500);
  }
});

// GET /history — Delivery history for segment sends
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
    )
      .bind(limit, offset)
      .all();

    return c.json({
      success: true,
      data: rows.results || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Segment history error:', err);
    return c.json({ success: false, error: 'Failed to fetch delivery history' }, 500);
  }
});
