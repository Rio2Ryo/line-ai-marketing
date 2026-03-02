import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const exportRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();
exportRoutes.use('*', authMiddleware);

function toCsv(rows: Record<string, any>[], columns: { key: string; label: string }[]): string {
  const header = columns.map(c => c.label).join(',');
  const lines = rows.map(row =>
    columns.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Escape quotes and wrap in quotes if contains comma/quote/newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }).join(',')
  );
  // BOM for Excel Japanese support
  return '\uFEFF' + header + '\n' + lines.join('\n');
}

function csvResponse(c: any, csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

// GET /customers — 顧客一覧CSV
exportRoutes.get('/customers', async (c) => {
  try {
    const rows = await c.env.DB.prepare(
      'SELECT u.id, u.line_user_id, u.display_name, u.status, u.created_at, GROUP_CONCAT(t.name) as tag_names FROM users u LEFT JOIN user_tags ut ON u.id = ut.user_id LEFT JOIN tags t ON ut.tag_id = t.id GROUP BY u.id ORDER BY u.created_at DESC'
    ).all();

    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'line_user_id', label: 'LINE ID' },
      { key: 'display_name', label: '表示名' },
      { key: 'status', label: 'ステータス' },
      { key: 'tag_names', label: 'タグ' },
      { key: 'created_at', label: '登録日' },
    ];

    const csv = toCsv((rows.results || []) as Record<string, any>[], columns);
    return csvResponse(c, csv, `customers_${dateStamp()}.csv`);
  } catch (e) {
    return c.json({ success: false, error: String(e) }, 500);
  }
});

// GET /surveys/:id/responses — アンケート回答CSV
exportRoutes.get('/surveys/:id/responses', async (c) => {
  try {
    const surveyId = c.req.param('id');

    // アンケートの存在確認
    const survey = await c.env.DB.prepare('SELECT * FROM surveys WHERE id = ?').bind(surveyId).first<{ id: string; title: string }>();
    if (!survey) return c.json({ success: false, error: 'Survey not found' }, 404);

    // 質問を取得
    const questions = await c.env.DB.prepare('SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY question_order ASC').bind(surveyId).all();
    const questionList = (questions.results || []) as any[];

    // 回答を取得
    const responses = await c.env.DB.prepare('SELECT * FROM survey_responses WHERE survey_id = ? ORDER BY submitted_at DESC').bind(surveyId).all();

    // 動的カラム構築
    const columns: { key: string; label: string }[] = [
      { key: 'id', label: '回答ID' },
      { key: 'user_id', label: 'ユーザーID' },
      { key: 'submitted_at', label: '回答日時' },
    ];
    for (const q of questionList) {
      columns.push({ key: `q_${q.id}`, label: q.question_text });
    }

    // 行データを構築
    const rows = ((responses.results || []) as any[]).map((r: any) => {
      const row: Record<string, any> = {
        id: r.id,
        user_id: r.user_id,
        submitted_at: r.submitted_at,
      };
      const answers = r.answers_json ? JSON.parse(r.answers_json) : {};
      for (const q of questionList) {
        const answer = answers[q.id];
        row[`q_${q.id}`] = Array.isArray(answer) ? answer.join('; ') : (answer || '');
      }
      return row;
    });

    const safeName = survey.title.replace(/[^a-zA-Z0-9\u3000-\u9FFF]/g, '_');
    const csv = toCsv(rows, columns);
    return csvResponse(c, csv, `survey_${safeName}_${dateStamp()}.csv`);
  } catch (e) {
    return c.json({ success: false, error: String(e) }, 500);
  }
});

// GET /delivery-logs — 配信ログCSV
exportRoutes.get('/delivery-logs', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '30');

    const rows = await c.env.DB.prepare(
      `SELECT dl.id, s.name as scenario_name, dl.user_id, dl.status, dl.scheduled_at, dl.sent_at, dl.error_message FROM delivery_logs dl LEFT JOIN scenarios s ON dl.scenario_id = s.id WHERE dl.created_at >= datetime('now', '-' || ? || ' days') ORDER BY dl.created_at DESC`
    ).bind(days).all();

    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'scenario_name', label: 'シナリオ' },
      { key: 'user_id', label: 'ユーザーID' },
      { key: 'status', label: 'ステータス' },
      { key: 'scheduled_at', label: '予定日時' },
      { key: 'sent_at', label: '送信日時' },
      { key: 'error_message', label: 'エラー' },
    ];

    const csv = toCsv((rows.results || []) as Record<string, any>[], columns);
    return csvResponse(c, csv, `delivery_logs_${dateStamp()}.csv`);
  } catch (e) {
    return c.json({ success: false, error: String(e) }, 500);
  }
});

// GET /ai-logs — AIチャットログCSV
exportRoutes.get('/ai-logs', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '30');

    const rows = await c.env.DB.prepare(
      `SELECT id, user_id, user_message, ai_reply, confidence, should_escalate, model, response_time_ms, created_at FROM ai_chat_logs WHERE created_at >= datetime('now', '-' || ? || ' days') ORDER BY created_at DESC`
    ).bind(days).all();

    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'user_id', label: 'ユーザーID' },
      { key: 'user_message', label: 'ユーザーメッセージ' },
      { key: 'ai_reply', label: 'AI応答' },
      { key: 'confidence', label: '信頼度' },
      { key: 'should_escalate', label: 'エスカレーション' },
      { key: 'model', label: 'モデル' },
      { key: 'response_time_ms', label: '応答時間(ms)' },
      { key: 'created_at', label: '日時' },
    ];

    const csv = toCsv((rows.results || []) as Record<string, any>[], columns);
    return csvResponse(c, csv, `ai_logs_${dateStamp()}.csv`);
  } catch (e) {
    return c.json({ success: false, error: String(e) }, 500);
  }
});
