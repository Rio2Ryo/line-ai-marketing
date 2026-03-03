import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const calendarRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
calendarRoutes.use('*', authMiddleware);

// GET / — Calendar data: scheduled deliveries + past delivery logs merged by date
calendarRoutes.get('/', async (c) => {
  try {
    const month = c.req.query('month');
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return c.json({ success: false, error: 'month query required (YYYY-MM)' }, 400);
    }

    const [year, mon] = month.split('-').map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    const startDate = `${month}-01`;
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

    // Fetch both sources in parallel
    const [scheduled, deliveryLogs] = await Promise.all([
      // Scheduled deliveries
      c.env.DB.prepare(
        `SELECT id, title, scheduled_at, status, message_type, target_type, sent_count, failed_count
         FROM scheduled_deliveries
         WHERE date(scheduled_at) >= ? AND date(scheduled_at) <= ?
         ORDER BY scheduled_at ASC`
      ).bind(startDate, endDate).all(),

      // Delivery logs aggregated by date
      c.env.DB.prepare(
        `SELECT
           date(created_at) as date,
           COUNT(*) as total,
           SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
         FROM delivery_logs
         WHERE date(created_at) >= ? AND date(created_at) <= ?
         GROUP BY date(created_at)
         ORDER BY date ASC`
      ).bind(startDate, endDate).all(),
    ]);

    // Build calendar data grouped by date
    const calendar: Record<string, {
      scheduled: Array<{ id: string; title: string; scheduled_at: string; status: string; message_type: string; target_type: string; sent_count: number; failed_count: number }>;
      delivery_summary: { total: number; sent: number; failed: number; pending: number } | null;
    }> = {};

    // Add scheduled deliveries
    for (const row of (scheduled.results || []) as any[]) {
      const dateKey = row.scheduled_at.substring(0, 10);
      if (!calendar[dateKey]) calendar[dateKey] = { scheduled: [], delivery_summary: null };
      calendar[dateKey].scheduled.push(row);
    }

    // Add delivery log summaries
    for (const row of (deliveryLogs.results || []) as any[]) {
      if (!calendar[row.date]) calendar[row.date] = { scheduled: [], delivery_summary: null };
      calendar[row.date].delivery_summary = {
        total: row.total,
        sent: row.sent,
        failed: row.failed,
        pending: row.pending,
      };
    }

    // Monthly totals
    const totalScheduled = (scheduled.results || []).length;
    const totalDelivered = (deliveryLogs.results || []).reduce((s: number, r: any) => s + (r.sent || 0), 0);
    const totalFailed = (deliveryLogs.results || []).reduce((s: number, r: any) => s + (r.failed || 0), 0);

    return c.json({
      success: true,
      data: {
        month,
        calendar,
        summary: {
          total_scheduled: totalScheduled,
          total_delivered: totalDelivered,
          total_failed: totalFailed,
        },
      },
    });
  } catch (err) {
    console.error('Calendar fetch error:', err);
    return c.json({ success: false, error: 'Failed to fetch calendar data' }, 500);
  }
});
