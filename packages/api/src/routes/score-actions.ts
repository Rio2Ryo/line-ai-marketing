import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { createNotification } from './notifications';
import { executeScenario } from '../lib/scenario-engine';

type AuthVars = { userId: string };
export const scoreActionRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
scoreActionRoutes.use('*', authMiddleware);

// ─── Auto-migrate ───

async function ensureTables(db: D1Database) {
  await db.exec(`CREATE TABLE IF NOT EXISTS score_auto_actions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK(trigger_type IN ('rank_up','rank_down','rank_is','rank_entered','score_above','score_below')),
    trigger_config TEXT NOT NULL DEFAULT '{}',
    actions TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1,
    execution_count INTEGER NOT NULL DEFAULT 0,
    last_executed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  await db.exec(`CREATE TABLE IF NOT EXISTS score_action_logs (
    id TEXT PRIMARY KEY,
    action_id TEXT NOT NULL,
    action_name TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT,
    previous_rank TEXT,
    new_rank TEXT,
    previous_score INTEGER,
    new_score INTEGER,
    executed_actions TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
}

// ─── Trigger matching ───

const RANK_ORDER: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };

interface ScoreChange {
  userId: string;
  userName?: string;
  prevRank: string;
  newRank: string;
  prevScore: number;
  newScore: number;
}

function matchesTrigger(rule: any, change: ScoreChange): boolean {
  const config = JSON.parse(rule.trigger_config || '{}');
  const prevOrd = RANK_ORDER[change.prevRank] || 0;
  const newOrd = RANK_ORDER[change.newRank] || 0;

  switch (rule.trigger_type) {
    case 'rank_up':
      if (newOrd <= prevOrd) return false;
      if (config.from_rank && change.prevRank !== config.from_rank) return false;
      if (config.to_rank && change.newRank !== config.to_rank) return false;
      return true;
    case 'rank_down':
      if (newOrd >= prevOrd) return false;
      if (config.from_rank && change.prevRank !== config.from_rank) return false;
      if (config.to_rank && change.newRank !== config.to_rank) return false;
      return true;
    case 'rank_is':
      return change.newRank === config.rank;
    case 'rank_entered':
      return change.newRank === config.rank && change.prevRank !== config.rank;
    case 'score_above':
      return typeof config.threshold === 'number' && change.newScore >= config.threshold && change.prevScore < config.threshold;
    case 'score_below':
      return typeof config.threshold === 'number' && change.newScore <= config.threshold && change.prevScore > config.threshold;
    default:
      return false;
  }
}

// ─── Action execution ───

async function executeAction(db: D1Database, env: Env, action: any, userId: string, change: ScoreChange): Promise<void> {
  switch (action.type) {
    case 'tag_add':
      if (action.tag_id) {
        await db.prepare(
          "INSERT OR IGNORE INTO user_tags (user_id, tag_id, assigned_at) VALUES (?, ?, datetime('now'))"
        ).bind(userId, action.tag_id).run();
      }
      break;
    case 'tag_remove':
      if (action.tag_id) {
        await db.prepare('DELETE FROM user_tags WHERE user_id = ? AND tag_id = ?').bind(userId, action.tag_id).run();
      }
      break;
    case 'scenario_execute':
      if (action.scenario_id) {
        await executeScenario(env, action.scenario_id, userId);
      }
      break;
    case 'notification':
      await createNotification(db, {
        type: 'system',
        title: action.title || 'スコアアクション実行',
        body: (action.body || 'ユーザー{name}のランクが{prev}→{new}に変動しました')
          .replace('{name}', change.userName || userId)
          .replace('{prev}', change.prevRank)
          .replace('{new}', change.newRank)
          .replace('{score}', String(change.newScore)),
        link: '/dashboard/engagement-scores',
        source_user_id: userId,
      });
      break;
  }
}

// ─── Evaluate (called from engagement-scores /calculate) ───

export async function evaluateScoreActions(
  db: D1Database,
  env: Env,
  changes: ScoreChange[]
): Promise<{ triggered: number; executed: number }> {
  await ensureTables(db);

  const rules = await db.prepare(
    'SELECT * FROM score_auto_actions WHERE is_active = 1 ORDER BY created_at ASC'
  ).all();

  if (!rules.results?.length || !changes.length) return { triggered: 0, executed: 0 };

  let triggered = 0;
  let executed = 0;

  for (const change of changes) {
    for (const rule of rules.results as any[]) {
      if (!matchesTrigger(rule, change)) continue;
      triggered++;

      const actions = JSON.parse(rule.actions || '[]');
      const executedActions: any[] = [];

      for (const action of actions) {
        try {
          await executeAction(db, env, action, change.userId, change);
          executedActions.push({ ...action, status: 'success' });
          executed++;
        } catch (err) {
          executedActions.push({ ...action, status: 'failed', error: String(err) });
        }
      }

      const allOk = executedActions.every((a: any) => a.status === 'success');
      await db.prepare(
        `INSERT INTO score_action_logs (id, action_id, action_name, user_id, user_name, previous_rank, new_rank, previous_score, new_score, executed_actions, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(), rule.id, rule.name,
        change.userId, change.userName || null,
        change.prevRank, change.newRank, change.prevScore, change.newScore,
        JSON.stringify(executedActions),
        allOk ? 'success' : 'partial'
      ).run();

      await db.prepare(
        "UPDATE score_auto_actions SET execution_count = execution_count + 1, last_executed_at = datetime('now') WHERE id = ?"
      ).bind(rule.id).run();
    }
  }

  return { triggered, executed };
}

// ─── GET / — ルール一覧 ───

scoreActionRoutes.get('/', async (c) => {
  try {
    await ensureTables(c.env.DB);
    const rows = await c.env.DB.prepare(
      'SELECT * FROM score_auto_actions ORDER BY created_at DESC'
    ).all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (err) {
    console.error('List score actions error:', err);
    return c.json({ success: false, error: 'ルール一覧の取得に失敗しました' }, 500);
  }
});

// ─── POST / — ルール作成 ───

scoreActionRoutes.post('/', async (c) => {
  try {
    await ensureTables(c.env.DB);
    const body = await c.req.json<{
      name: string;
      description?: string;
      trigger_type: string;
      trigger_config: any;
      actions: any[];
    }>();

    if (!body.name || !body.trigger_type || !body.actions?.length) {
      return c.json({ success: false, error: '名前・トリガー・アクションは必須です' }, 400);
    }

    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO score_auto_actions (id, name, description, trigger_type, trigger_config, actions)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      id, body.name, body.description || null,
      body.trigger_type,
      JSON.stringify(body.trigger_config || {}),
      JSON.stringify(body.actions)
    ).run();

    const row = await c.env.DB.prepare('SELECT * FROM score_auto_actions WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: row });
  } catch (err) {
    console.error('Create score action error:', err);
    return c.json({ success: false, error: 'ルールの作成に失敗しました' }, 500);
  }
});

// ─── PUT /:id — ルール更新 ───

scoreActionRoutes.put('/:id', async (c) => {
  try {
    await ensureTables(c.env.DB);
    const id = c.req.param('id');
    const body = await c.req.json<{
      name?: string;
      description?: string;
      trigger_type?: string;
      trigger_config?: any;
      actions?: any[];
      is_active?: boolean;
    }>();

    const existing = await c.env.DB.prepare('SELECT * FROM score_auto_actions WHERE id = ?').bind(id).first();
    if (!existing) return c.json({ success: false, error: 'ルールが見つかりません' }, 404);

    await c.env.DB.prepare(
      `UPDATE score_auto_actions SET
        name = ?, description = ?, trigger_type = ?, trigger_config = ?, actions = ?,
        is_active = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(
      body.name ?? (existing as any).name,
      body.description !== undefined ? body.description : (existing as any).description,
      body.trigger_type ?? (existing as any).trigger_type,
      body.trigger_config ? JSON.stringify(body.trigger_config) : (existing as any).trigger_config,
      body.actions ? JSON.stringify(body.actions) : (existing as any).actions,
      body.is_active !== undefined ? (body.is_active ? 1 : 0) : (existing as any).is_active,
      id
    ).run();

    const row = await c.env.DB.prepare('SELECT * FROM score_auto_actions WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: row });
  } catch (err) {
    console.error('Update score action error:', err);
    return c.json({ success: false, error: 'ルールの更新に失敗しました' }, 500);
  }
});

// ─── DELETE /:id — ルール削除 ───

scoreActionRoutes.delete('/:id', async (c) => {
  try {
    await ensureTables(c.env.DB);
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM score_auto_actions WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error('Delete score action error:', err);
    return c.json({ success: false, error: 'ルールの削除に失敗しました' }, 500);
  }
});

// ─── PUT /:id/toggle — 有効/無効切替 ───

scoreActionRoutes.put('/:id/toggle', async (c) => {
  try {
    await ensureTables(c.env.DB);
    const id = c.req.param('id');
    const existing = await c.env.DB.prepare('SELECT is_active FROM score_auto_actions WHERE id = ?').bind(id).first<{ is_active: number }>();
    if (!existing) return c.json({ success: false, error: 'ルールが見つかりません' }, 404);

    const newState = existing.is_active ? 0 : 1;
    await c.env.DB.prepare(
      "UPDATE score_auto_actions SET is_active = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(newState, id).run();

    return c.json({ success: true, data: { is_active: newState } });
  } catch (err) {
    console.error('Toggle score action error:', err);
    return c.json({ success: false, error: '切替に失敗しました' }, 500);
  }
});

// ─── GET /logs — 実行ログ ───

scoreActionRoutes.get('/logs', async (c) => {
  try {
    await ensureTables(c.env.DB);
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = (page - 1) * limit;

    const countRow = await c.env.DB.prepare('SELECT COUNT(*) as total FROM score_action_logs').first<{ total: number }>();
    const total = countRow?.total || 0;

    const rows = await c.env.DB.prepare(
      `SELECT sal.*, u.display_name, u.picture_url
       FROM score_action_logs sal
       LEFT JOIN users u ON sal.user_id = u.id
       ORDER BY sal.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();

    return c.json({
      success: true,
      data: rows.results || [],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Score action logs error:', err);
    return c.json({ success: false, error: 'ログの取得に失敗しました' }, 500);
  }
});

// ─── GET /stats — ルール統計 ───

scoreActionRoutes.get('/stats', async (c) => {
  try {
    await ensureTables(c.env.DB);
    const totalRules = await c.env.DB.prepare('SELECT COUNT(*) as c FROM score_auto_actions').first<{ c: number }>();
    const activeRules = await c.env.DB.prepare('SELECT COUNT(*) as c FROM score_auto_actions WHERE is_active = 1').first<{ c: number }>();
    const totalExecutions = await c.env.DB.prepare('SELECT SUM(execution_count) as c FROM score_auto_actions').first<{ c: number }>();
    const recentLogs = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM score_action_logs WHERE created_at >= datetime('now', '-7 days')"
    ).first<{ c: number }>();

    return c.json({
      success: true,
      data: {
        total_rules: totalRules?.c || 0,
        active_rules: activeRules?.c || 0,
        total_executions: totalExecutions?.c || 0,
        recent_executions_7d: recentLogs?.c || 0,
      },
    });
  } catch (err) {
    console.error('Score action stats error:', err);
    return c.json({ success: false, error: '統計の取得に失敗しました' }, 500);
  }
});
