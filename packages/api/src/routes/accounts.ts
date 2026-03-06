import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

type Variables = { userId: string; userRole: string };

export const accountRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

accountRoutes.use('*', authMiddleware);

function generateId(): string {
  return crypto.randomUUID();
}

// GET /api/accounts - List all LINE accounts
accountRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const role = c.get('userRole');

  let accounts;
  if (role === 'admin') {
    // Admins see all accounts
    accounts = await c.env.DB.prepare(
      `SELECT la.*, (SELECT COUNT(*) FROM user_account_access WHERE account_id = la.id) as member_count
       FROM line_accounts la ORDER BY la.is_default DESC, la.created_at`
    ).all();
  } else {
    // Others see only accounts they have access to
    accounts = await c.env.DB.prepare(
      `SELECT la.*, uaa.role as user_role
       FROM line_accounts la
       JOIN user_account_access uaa ON uaa.account_id = la.id
       WHERE uaa.user_id = ? AND la.is_active = 1
       ORDER BY la.is_default DESC, la.created_at`
    ).bind(userId).all();
  }

  // Mask secrets in response
  const data = (accounts.results || []).map((a: any) => ({
    ...a,
    channel_secret: a.channel_secret ? '***' : null,
    channel_access_token: a.channel_access_token ? '***' : null,
  }));

  return c.json({ success: true, data });
});

// GET /api/accounts/:id - Get account detail
accountRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const role = c.get('userRole');

  const account = await c.env.DB.prepare(
    'SELECT * FROM line_accounts WHERE id = ?'
  ).bind(id).first();

  if (!account) return c.json({ success: false, error: 'Not found' }, 404);

  // Members list
  const members = await c.env.DB.prepare(
    `SELECT uaa.user_id, uaa.role, uaa.created_at, u.display_name, u.picture_url
     FROM user_account_access uaa
     LEFT JOIN users u ON u.id = uaa.user_id
     WHERE uaa.account_id = ?`
  ).bind(id).all();

  return c.json({
    success: true,
    data: {
      ...account,
      channel_secret: account.channel_secret ? '***' : null,
      channel_access_token: account.channel_access_token ? '***' : null,
      // Only show credentials existence, not values (admin can update)
      has_credentials: !!(account.channel_secret && account.channel_access_token),
      members: members.results || [],
    },
  });
});

// POST /api/accounts - Create new LINE account (admin only)
accountRoutes.post('/', roleMiddleware('admin'), async (c) => {
  const body = await c.req.json<{
    name: string;
    channel_id?: string;
    channel_secret?: string;
    channel_access_token?: string;
  }>();

  if (!body.name?.trim()) {
    return c.json({ success: false, error: 'Name is required' }, 400);
  }

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO line_accounts (id, name, channel_id, channel_secret, channel_access_token)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, body.name.trim(), body.channel_id || null, body.channel_secret || null, body.channel_access_token || null).run();

  // Auto-assign creating user as admin of this account
  const userId = c.get('userId');
  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO user_account_access (user_id, account_id, role) VALUES (?, ?, ?)'
  ).bind(userId, id, 'admin').run();

  return c.json({ success: true, data: { id } }, 201);
});

// PUT /api/accounts/:id - Update LINE account (admin only)
accountRoutes.put('/:id', roleMiddleware('admin'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{
    name?: string;
    channel_id?: string;
    channel_secret?: string;
    channel_access_token?: string;
    is_active?: boolean;
  }>();

  const existing = await c.env.DB.prepare('SELECT id FROM line_accounts WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ success: false, error: 'Not found' }, 404);

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name); }
  if (body.channel_id !== undefined) { updates.push('channel_id = ?'); values.push(body.channel_id); }
  if (body.channel_secret !== undefined) { updates.push('channel_secret = ?'); values.push(body.channel_secret); }
  if (body.channel_access_token !== undefined) { updates.push('channel_access_token = ?'); values.push(body.channel_access_token); }
  if (body.is_active !== undefined) { updates.push('is_active = ?'); values.push(body.is_active ? 1 : 0); }

  if (updates.length === 0) {
    return c.json({ success: false, error: 'No fields to update' }, 400);
  }

  updates.push("updated_at = datetime('now')");
  values.push(id);

  await c.env.DB.prepare(
    `UPDATE line_accounts SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  return c.json({ success: true, message: 'Account updated' });
});

// DELETE /api/accounts/:id - Delete LINE account (admin only)
accountRoutes.delete('/:id', roleMiddleware('admin'), async (c) => {
  const id = c.req.param('id');

  const account = await c.env.DB.prepare('SELECT is_default FROM line_accounts WHERE id = ?').bind(id).first();
  if (!account) return c.json({ success: false, error: 'Not found' }, 404);
  if (account.is_default) return c.json({ success: false, error: 'Cannot delete default account' }, 400);

  await c.env.DB.prepare('DELETE FROM user_account_access WHERE account_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM line_accounts WHERE id = ?').bind(id).run();

  return c.json({ success: true, message: 'Account deleted' });
});

// POST /api/accounts/:id/members - Add member to account (admin only)
accountRoutes.post('/:id/members', roleMiddleware('admin'), async (c) => {
  const accountId = c.req.param('id');
  const body = await c.req.json<{ user_id: string; role?: string }>();

  if (!body.user_id) return c.json({ success: false, error: 'user_id required' }, 400);

  const validRoles = ['admin', 'operator', 'viewer'];
  const role = body.role && validRoles.includes(body.role) ? body.role : 'viewer';

  await c.env.DB.prepare(
    'INSERT OR REPLACE INTO user_account_access (user_id, account_id, role) VALUES (?, ?, ?)'
  ).bind(body.user_id, accountId, role).run();

  return c.json({ success: true, message: 'Member added' });
});

// DELETE /api/accounts/:id/members/:userId - Remove member from account (admin only)
accountRoutes.delete('/:id/members/:userId', roleMiddleware('admin'), async (c) => {
  const accountId = c.req.param('id');
  const userId = c.req.param('userId');

  await c.env.DB.prepare(
    'DELETE FROM user_account_access WHERE user_id = ? AND account_id = ?'
  ).bind(userId, accountId).run();

  return c.json({ success: true, message: 'Member removed' });
});

// GET /api/accounts/current/resolve - Resolve current account credentials
// Used internally to get actual credentials for the selected account
accountRoutes.get('/current/resolve', async (c) => {
  const accountId = c.req.header('X-Account-Id') || 'default';

  const account = await c.env.DB.prepare(
    'SELECT id, name, channel_id, channel_secret, channel_access_token, is_active FROM line_accounts WHERE id = ? AND is_active = 1'
  ).bind(accountId).first();

  if (!account) {
    // Fall back to default account (uses env vars)
    return c.json({
      success: true,
      data: {
        id: 'default',
        name: 'Default Account',
        uses_env: true,
      },
    });
  }

  return c.json({
    success: true,
    data: {
      id: account.id,
      name: account.name,
      has_credentials: !!(account.channel_secret && account.channel_access_token),
      uses_env: account.id === 'default' || (!account.channel_secret && !account.channel_access_token),
    },
  });
});
