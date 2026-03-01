import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

type AuthVars = { userId: string };
export const surveyRoutes = new Hono<{ Bindings: Env; Variables: AuthVars }>();

// 認証が必要なルートと不要なルートを分ける
// POST /:id/respond は認証なしでもアクセス可能（Webhookから呼べるように）

// ---- 認証不要エンドポイント ----

// POST /:id/respond — 回答送信（認証なし: Webhookからも呼べる）
surveyRoutes.post('/:id/respond', async (c) => {
  const surveyId = c.req.param('id');
  const body = await c.req.json<{ user_id: string; answers: Record<string, string | string[]> }>();

  if (!body.user_id || !body.answers) {
    return c.json({ success: false, error: 'user_id and answers are required' }, 400);
  }

  // アンケートの存在確認
  const survey = await c.env.DB.prepare('SELECT * FROM surveys WHERE id = ? AND is_active = 1').bind(surveyId).first();
  if (!survey) {
    return c.json({ success: false, error: 'Survey not found or inactive' }, 404);
  }

  // 質問を取得して必須チェック
  const questions = await c.env.DB.prepare('SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY question_order ASC').bind(surveyId).all();
  for (const q of (questions.results || []) as any[]) {
    if (q.is_required && (!body.answers[q.id] || (Array.isArray(body.answers[q.id]) && (body.answers[q.id] as string[]).length === 0))) {
      return c.json({ success: false, error: `Question "${q.question_text}" is required` }, 400);
    }
  }

  // 重複回答チェック
  const existing = await c.env.DB.prepare('SELECT id FROM survey_responses WHERE survey_id = ? AND user_id = ?').bind(surveyId, body.user_id).first();
  if (existing) {
    return c.json({ success: false, error: 'User has already responded to this survey' }, 409);
  }

  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO survey_responses (id, survey_id, user_id, answers_json) VALUES (?, ?, ?, ?)')
    .bind(id, surveyId, body.user_id, JSON.stringify(body.answers)).run();

  return c.json({ success: true, data: { id, survey_id: surveyId, user_id: body.user_id } }, 201);
});

// ---- 認証必要エンドポイント ----
surveyRoutes.use('*', authMiddleware);

// GET / — アンケート一覧（回答数COUNT付き）
surveyRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT s.*, COUNT(sr.id) as response_count FROM surveys s LEFT JOIN survey_responses sr ON s.id = sr.survey_id GROUP BY s.id ORDER BY s.created_at DESC'
  ).all();
  return c.json({ success: true, data: rows.results || [] });
});

// GET /:id — アンケート詳細（survey + questions + 回答数）
surveyRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const survey = await c.env.DB.prepare('SELECT * FROM surveys WHERE id = ?').bind(id).first();
  if (!survey) return c.json({ success: false, error: 'Not found' }, 404);

  const questions = await c.env.DB.prepare('SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY question_order ASC').bind(id).all();
  const countRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM survey_responses WHERE survey_id = ?').bind(id).first<{ count: number }>();

  return c.json({
    success: true,
    data: {
      ...survey,
      questions: questions.results || [],
      response_count: countRow?.count || 0,
    },
  });
});

// POST / — アンケート作成（survey + questions一括）
surveyRoutes.post('/', async (c) => {
  const body = await c.req.json<{
    title: string;
    description?: string;
    questions: Array<{
      question_type: 'text' | 'single_choice' | 'multiple_choice' | 'rating';
      question_text: string;
      options_json?: string;
      is_required?: number;
    }>;
  }>();

  if (!body.title) return c.json({ success: false, error: 'title is required' }, 400);
  if (!body.questions || body.questions.length === 0) return c.json({ success: false, error: 'At least one question is required' }, 400);

  const surveyId = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO surveys (id, title, description, is_active) VALUES (?, ?, ?, 1)')
    .bind(surveyId, body.title, body.description || null).run();

  for (let i = 0; i < body.questions.length; i++) {
    const q = body.questions[i];
    const qId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO survey_questions (id, survey_id, question_order, question_type, question_text, options_json, is_required) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(qId, surveyId, i + 1, q.question_type, q.question_text, q.options_json || null, q.is_required !== undefined ? q.is_required : 1).run();
  }

  const created = await c.env.DB.prepare('SELECT * FROM surveys WHERE id = ?').bind(surveyId).first();
  const questions = await c.env.DB.prepare('SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY question_order ASC').bind(surveyId).all();

  return c.json({ success: true, data: { ...created, questions: questions.results || [] } }, 201);
});

// PUT /:id — アンケート更新（title, description, is_active）
surveyRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ title?: string; description?: string; is_active?: number }>();
  const sets: string[] = [];
  const vals: any[] = [];

  if (body.title) { sets.push('title = ?'); vals.push(body.title); }
  if (body.description !== undefined) { sets.push('description = ?'); vals.push(body.description); }
  if (body.is_active !== undefined) { sets.push('is_active = ?'); vals.push(body.is_active); }
  if (!sets.length) return c.json({ success: false, error: 'No fields to update' }, 400);

  sets.push("updated_at = datetime('now')");
  await c.env.DB.prepare('UPDATE surveys SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals, id).run();

  const updated = await c.env.DB.prepare('SELECT * FROM surveys WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: updated });
});

// DELETE /:id — アンケート削除
surveyRoutes.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM surveys WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
});

// GET /:id/results — 回答集計
surveyRoutes.get('/:id/results', async (c) => {
  const surveyId = c.req.param('id');

  const survey = await c.env.DB.prepare('SELECT * FROM surveys WHERE id = ?').bind(surveyId).first();
  if (!survey) return c.json({ success: false, error: 'Not found' }, 404);

  const questions = await c.env.DB.prepare('SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY question_order ASC').bind(surveyId).all();
  const responses = await c.env.DB.prepare('SELECT * FROM survey_responses WHERE survey_id = ?').bind(surveyId).all();

  const questionResults: any[] = [];

  for (const q of (questions.results || []) as any[]) {
    const result: any = {
      question_id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      total_answers: 0,
    };

    if (q.question_type === 'single_choice' || q.question_type === 'multiple_choice') {
      // 選択肢ごとのカウント
      const distribution: Record<string, number> = {};
      const options = q.options_json ? JSON.parse(q.options_json) : [];
      for (const opt of options) {
        distribution[opt] = 0;
      }

      for (const resp of (responses.results || []) as any[]) {
        const answers = JSON.parse(resp.answers_json);
        const answer = answers[q.id];
        if (!answer) continue;
        result.total_answers++;

        if (Array.isArray(answer)) {
          for (const a of answer) {
            distribution[a] = (distribution[a] || 0) + 1;
          }
        } else {
          distribution[answer] = (distribution[answer] || 0) + 1;
        }
      }

      result.distribution = distribution;
    } else if (q.question_type === 'rating') {
      // 平均スコア
      let sum = 0;
      let count = 0;
      const distribution: Record<string, number> = {};

      for (const resp of (responses.results || []) as any[]) {
        const answers = JSON.parse(resp.answers_json);
        const answer = answers[q.id];
        if (!answer) continue;
        const val = parseInt(answer, 10);
        if (!isNaN(val)) {
          sum += val;
          count++;
          distribution[answer] = (distribution[answer] || 0) + 1;
        }
      }

      result.total_answers = count;
      result.average = count > 0 ? Math.round((sum / count) * 100) / 100 : 0;
      result.distribution = distribution;
    } else {
      // テキスト回答一覧
      const textAnswers: string[] = [];
      for (const resp of (responses.results || []) as any[]) {
        const answers = JSON.parse(resp.answers_json);
        const answer = answers[q.id];
        if (answer) {
          textAnswers.push(answer as string);
          result.total_answers++;
        }
      }
      result.answers = textAnswers;
    }

    questionResults.push(result);
  }

  return c.json({
    success: true,
    data: {
      survey,
      total_responses: (responses.results || []).length,
      questions: questionResults,
    },
  });
});
