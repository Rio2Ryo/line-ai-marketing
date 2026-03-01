import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };

export const scheduledDeliveryRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
scheduledDeliveryRoutes.use('*', authMiddleware);

// GET /calendar — Calendar view: deliveries grouped by date for a given month
scheduledDeliveryRoutes.get('/calendar', async (c) => {
  try {
    const month = c.req.query('month');
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return c.json({ success: false, error: 'month query parameter is required in YYYY-MM format' }, 400);
    }

    const startDate = `${month}-01T00:00:00`;
    // Calculate end of month
    const [year, mon] = month.split('-').map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}T23:59:59`;

    const rows = await c.env.DB.prepare(
      `SELECT id, title, scheduled_at, status
       FROM scheduled_deliveries
       WHERE scheduled_at >= ? AND scheduled_at <= ?
       ORDER BY scheduled_at ASC`
    )
      .bind(startDate, endDate)
      .all();

    const deliveries = (rows.results || []) as Array<{
      id: string;
      title: string;
      scheduled_at: string;
      status: string;
    }>;

    // Group by date (YYYY-MM-DD)
    const grouped: Record<string, Array<{ id: string; title: string; scheduled_at: string; status: string }>> = {};
    for (const d of deliveries) {
      const dateKey = d.scheduled_at.substring(0, 10);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push({
        id: d.id,
        title: d.title,
        scheduled_at: d.scheduled_at,
        status: d.status,
      });
    }

    return c.json({ success: true, data: grouped });
  } catch (err) {
    console.error('Calendar fetch error:', err);
    return c.json({ success: false, error: 'Failed to fetch calendar data' }, 500);
  }
});

// GET / — List all scheduled deliveries (paginated, newest first)
scheduledDeliveryRoutes.get('/', async (c) => {
  try {
    const page = Number(c.req.query('page') || '1');
    const limit = Number(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;

    const countResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM scheduled_deliveries'
    ).first<{ total: number }>();
    const total = countResult?.total || 0;

    const rows = await c.env.DB.prepare(
      `SELECT * FROM scheduled_deliveries
       ORDER BY created_at DESC
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
    console.error('List scheduled deliveries error:', err);
    return c.json({ success: false, error: 'Failed to fetch scheduled deliveries' }, 500);
  }
});

// POST / — Create scheduled delivery
scheduledDeliveryRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json<{
      title: string;
      message_content: string;
      message_type?: string;
      target_type: string;
      target_config?: string;
      scheduled_at: string;
    }>();

    if (!body.title || !body.title.trim()) {
      return c.json({ success: false, error: 'title is required' }, 400);
    }
    if (!body.message_content || !body.message_content.trim()) {
      return c.json({ success: false, error: 'message_content is required' }, 400);
    }
    if (!body.target_type || !['all', 'segment', 'tag'].includes(body.target_type)) {
      return c.json({ success: false, error: 'target_type must be one of: all, segment, tag' }, 400);
    }
    if (!body.scheduled_at) {
      return c.json({ success: false, error: 'scheduled_at is required' }, 400);
    }

    // Validate scheduled_at is in the future
    const scheduledTime = new Date(body.scheduled_at);
    if (isNaN(scheduledTime.getTime())) {
      return c.json({ success: false, error: 'scheduled_at must be a valid datetime' }, 400);
    }
    if (scheduledTime <= new Date()) {
      return c.json({ success: false, error: 'scheduled_at must be in the future' }, 400);
    }

    const id = crypto.randomUUID();
    const messageType = body.message_type || 'text';
    const targetConfig = body.target_config || null;

    await c.env.DB.prepare(
      `INSERT INTO scheduled_deliveries (id, title, message_type, message_content, target_type, target_config, scheduled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, body.title.trim(), messageType, body.message_content.trim(), body.target_type, targetConfig, body.scheduled_at)
      .run();

    const created = await c.env.DB.prepare(
      'SELECT * FROM scheduled_deliveries WHERE id = ?'
    )
      .bind(id)
      .first();

    return c.json({ success: true, data: created }, 201);
  } catch (err) {
    console.error('Create scheduled delivery error:', err);
    return c.json({ success: false, error: 'Failed to create scheduled delivery' }, 500);
  }
});

// GET /:id — Get single delivery detail
scheduledDeliveryRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const delivery = await c.env.DB.prepare(
      'SELECT * FROM scheduled_deliveries WHERE id = ?'
    )
      .bind(id)
      .first();

    if (!delivery) {
      return c.json({ success: false, error: 'Scheduled delivery not found' }, 404);
    }

    return c.json({ success: true, data: delivery });
  } catch (err) {
    console.error('Get scheduled delivery error:', err);
    return c.json({ success: false, error: 'Failed to fetch scheduled delivery' }, 500);
  }
});

// PUT /:id — Update (only if status is 'pending')
scheduledDeliveryRoutes.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const existing = await c.env.DB.prepare(
      'SELECT * FROM scheduled_deliveries WHERE id = ?'
    )
      .bind(id)
      .first<{ status: string }>();

    if (!existing) {
      return c.json({ success: false, error: 'Scheduled delivery not found' }, 404);
    }

    if (existing.status !== 'pending') {
      return c.json({ success: false, error: 'Only pending deliveries can be updated' }, 400);
    }

    const body = await c.req.json<{
      title?: string;
      message_content?: string;
      message_type?: string;
      target_type?: string;
      target_config?: string;
      scheduled_at?: string;
    }>();

    // Validate target_type if provided
    if (body.target_type && !['all', 'segment', 'tag'].includes(body.target_type)) {
      return c.json({ success: false, error: 'target_type must be one of: all, segment, tag' }, 400);
    }

    // Validate scheduled_at if provided
    if (body.scheduled_at) {
      const scheduledTime = new Date(body.scheduled_at);
      if (isNaN(scheduledTime.getTime())) {
        return c.json({ success: false, error: 'scheduled_at must be a valid datetime' }, 400);
      }
      if (scheduledTime <= new Date()) {
        return c.json({ success: false, error: 'scheduled_at must be in the future' }, 400);
      }
    }

    const updates: string[] = [];
    const bindings: unknown[] = [];

    if (body.title !== undefined) {
      updates.push('title = ?');
      bindings.push(body.title.trim());
    }
    if (body.message_content !== undefined) {
      updates.push('message_content = ?');
      bindings.push(body.message_content.trim());
    }
    if (body.message_type !== undefined) {
      updates.push('message_type = ?');
      bindings.push(body.message_type);
    }
    if (body.target_type !== undefined) {
      updates.push('target_type = ?');
      bindings.push(body.target_type);
    }
    if (body.target_config !== undefined) {
      updates.push('target_config = ?');
      bindings.push(body.target_config);
    }
    if (body.scheduled_at !== undefined) {
      updates.push('scheduled_at = ?');
      bindings.push(body.scheduled_at);
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: 'No fields to update' }, 400);
    }

    updates.push("updated_at = datetime('now')");
    bindings.push(id);

    await c.env.DB.prepare(
      `UPDATE scheduled_deliveries SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...bindings)
      .run();

    const updated = await c.env.DB.prepare(
      'SELECT * FROM scheduled_deliveries WHERE id = ?'
    )
      .bind(id)
      .first();

    return c.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update scheduled delivery error:', err);
    return c.json({ success: false, error: 'Failed to update scheduled delivery' }, 500);
  }
});

// DELETE /:id — Cancel/delete (set status to 'cancelled' if pending, or delete)
scheduledDeliveryRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const existing = await c.env.DB.prepare(
      'SELECT * FROM scheduled_deliveries WHERE id = ?'
    )
      .bind(id)
      .first<{ status: string }>();

    if (!existing) {
      return c.json({ success: false, error: 'Scheduled delivery not found' }, 404);
    }

    if (existing.status === 'pending') {
      // Set status to cancelled
      await c.env.DB.prepare(
        "UPDATE scheduled_deliveries SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?"
      )
        .bind(id)
        .run();
    } else {
      // Delete the record
      await c.env.DB.prepare(
        'DELETE FROM scheduled_deliveries WHERE id = ?'
      )
        .bind(id)
        .run();
    }

    return c.json({ success: true });
  } catch (err) {
    console.error('Delete scheduled delivery error:', err);
    return c.json({ success: false, error: 'Failed to delete scheduled delivery' }, 500);
  }
});
