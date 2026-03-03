import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

type Variables = {
  userId: string;
  userRole: string;
};

export const roleRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require auth + admin role
roleRoutes.use('*', authMiddleware);

// GET /api/roles - List all users with roles (admin only)
roleRoutes.get('/', roleMiddleware('admin'), async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, line_user_id, display_name, picture_url, role, status, created_at, updated_at
     FROM users ORDER BY created_at DESC`
  ).all();

  return c.json({ success: true, data: results });
});

// PUT /api/roles/:userId - Update user role (admin only)
roleRoutes.put('/:userId', roleMiddleware('admin'), async (c) => {
  const targetUserId = c.req.param('userId');
  const currentUserId = c.get('userId');
  const body = await c.req.json<{ role: string }>();

  const validRoles = ['admin', 'operator', 'viewer'];
  if (!body.role || !validRoles.includes(body.role)) {
    return c.json({ success: false, error: 'Invalid role. Must be: admin, operator, or viewer' }, 400);
  }

  // Prevent self-demotion (admin cannot remove own admin role)
  if (targetUserId === currentUserId && body.role !== 'admin') {
    return c.json({ success: false, error: 'Cannot change your own role' }, 400);
  }

  // Verify target user exists
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?')
    .bind(targetUserId)
    .first();

  if (!user) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  await c.env.DB.prepare('UPDATE users SET role = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .bind(body.role, targetUserId)
    .run();

  return c.json({ success: true, message: 'Role updated successfully' });
});

// GET /api/roles/me - Get current user role
roleRoutes.get('/me', async (c) => {
  const role = c.get('userRole');
  return c.json({ success: true, data: { role } });
});
