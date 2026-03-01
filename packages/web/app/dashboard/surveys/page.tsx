'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers: authHeaders(opts?.headers as Record<string, string>) });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  return (json as { data?: T }).data ?? (json as T);
}

// --- Types ---
interface Survey {
  id: string;
  title: string;
  description: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  response_count: number;
}

interface QuestionDraft {
  question_type: 'text' | 'single_choice' | 'multiple_choice' | 'rating';
  question_text: string;
  options: string[];
  is_required: number;
}

interface QuestionResult {
  question_id: string;
  question_text: string;
  question_type: string;
  total_answers: number;
  distribution?: Record<string, number>;
  average?: number;
  answers?: string[];
}

interface SurveyResults {
  survey: Survey;
  total_responses: number;
  questions: QuestionResult[];
}

const EMPTY_Q: QuestionDraft = { question_type: 'text', question_text: '', options: [''], is_required: 1 };

const TYPE_LABELS: Record<string, string> = {
  text: 'テキスト',
  single_choice: '単一選択',
  multiple_choice: '複数選択',
  rating: '評価',
};

// --- Component ---
export default function SurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([{ ...EMPTY_Q, options: [''] }]);

  // Results modal
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<SurveyResults | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api<Survey[]>('/api/surveys');
      setSurveys(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // --- Handlers ---
  const resetForm = () => { setTitle(''); setDesc(''); setQuestions([{ ...EMPTY_Q, options: [''] }]); };

  const handleCreate = async () => {
    if (!title.trim() || questions.some(q => !q.question_text.trim())) return;
    setSaving(true);
    try {
      const body = {
        title,
        description: desc || null,
        questions: questions.map(q => ({
          question_type: q.question_type,
          question_text: q.question_text,
          options_json: ['single_choice', 'multiple_choice'].includes(q.question_type)
            ? JSON.stringify(q.options.filter(o => o.trim())) : null,
          is_required: q.is_required,
        })),
      };
      await api('/api/surveys', { method: 'POST', body: JSON.stringify(body) });
      setShowCreate(false);
      resetForm();
      load();
    } catch { setError('アンケートの作成に失敗しました'); } finally { setSaving(false); }
  };

  const handleToggle = async (s: Survey) => {
    try {
      await api(`/api/surveys/${s.id}`, { method: 'PUT', body: JSON.stringify({ is_active: s.is_active ? 0 : 1 }) });
      load();
    } catch { setError('ステータスの変更に失敗しました'); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('このアンケートを削除しますか？回答データも全て削除されます。')) return;
    try {
      await api(`/api/surveys/${id}`, { method: 'DELETE' });
      load();
    } catch { setError('削除に失敗しました'); }
  };

  const handleViewResults = async (id: string) => {
    setShowResults(true);
    setResultsLoading(true);
    setResults(null);
    try {
      const data = await api<SurveyResults>(`/api/surveys/${id}/results`);
      setResults(data);
    } catch { setResults(null); } finally { setResultsLoading(false); }
  };

  // --- Question helpers ---
  const updateQ = (i: number, patch: Partial<QuestionDraft>) => {
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  };
  const removeQ = (i: number) => { if (questions.length > 1) setQuestions(prev => prev.filter((_, idx) => idx !== i)); };
  const moveQ = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    setQuestions(prev => { const a = [...prev]; [a[i], a[j]] = [a[j], a[i]]; return a; });
  };
  const updateOpt = (qi: number, oi: number, val: string) => {
    setQuestions(prev => prev.map((q, idx) => idx === qi ? { ...q, options: q.options.map((o, j) => j === oi ? val : o) } : q));
  };
  const addOpt = (qi: number) => { updateQ(qi, { options: [...questions[qi].options, ''] }); };
  const removeOpt = (qi: number, oi: number) => {
    const opts = questions[qi].options.filter((_, j) => j !== oi);
    updateQ(qi, { options: opts.length ? opts : [''] });
  };

  // --- Skeleton ---
  if (loading && surveys.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">アンケート管理</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-200 rounded w-full mb-2" />
              <div className="h-3 bg-gray-200 rounded w-5/6 mb-4" />
              <div className="flex gap-2"><div className="h-5 bg-gray-200 rounded-full w-16" /><div className="h-5 bg-gray-200 rounded-full w-12" /></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">アンケート管理</h1>
        <button onClick={() => { resetForm(); setShowCreate(true); }} className="px-4 py-2 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors">
          新規作成
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4">
            <XIcon />
          </button>
        </div>
      )}

      {/* Empty state */}
      {surveys.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-gray-500">アンケートがまだ作成されていません。新規作成ボタンからアンケートを追加しましょう。</p>
        </div>
      ) : (
        /* Card grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {surveys.map(s => (
            <div key={s.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-gray-900 line-clamp-1">{s.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ml-2 ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {s.is_active ? '公開中' : '非公開'}
                </span>
              </div>
              {s.description && <p className="text-sm text-gray-500 line-clamp-2 mb-3">{s.description}</p>}
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => handleViewResults(s.id)} className="text-sm text-[#06C755] hover:text-[#05b34c] font-medium">
                  回答 {s.response_count}件
                </button>
                <span className="text-xs text-gray-400">{new Date(s.created_at).toLocaleDateString('ja-JP')}</span>
              </div>
              <div className="flex items-center justify-between">
                <button onClick={() => handleToggle(s)} className={`text-sm font-medium ${s.is_active ? 'text-yellow-600 hover:text-yellow-700' : 'text-green-600 hover:text-green-700'}`}>
                  {s.is_active ? '非公開にする' : '公開する'}
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleViewResults(s.id)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">結果</button>
                  <button onClick={() => handleDelete(s.id)} className="text-sm text-red-500 hover:text-red-700 font-medium">削除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* === Create Modal === */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowCreate(false); resetForm(); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">アンケート新規作成</h2>
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">タイトル <span className="text-red-500">*</span></label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent" placeholder="例: 顧客満足度アンケート" />
                </div>
                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                  <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent resize-y" placeholder="アンケートの説明文（任意）" />
                </div>
                {/* Questions */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">質問 <span className="text-red-500">*</span></label>
                    <button onClick={() => setQuestions(p => [...p, { ...EMPTY_Q, options: [''] }])} className="text-sm text-[#06C755] hover:text-[#05b34c] font-medium">+ 質問を追加</button>
                  </div>
                  <div className="space-y-4">
                    {questions.map((q, qi) => (
                      <div key={qi} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-600">質問 {qi + 1}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => moveQ(qi, -1)} disabled={qi === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30" title="上へ移動">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                            </button>
                            <button onClick={() => moveQ(qi, 1)} disabled={qi === questions.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30" title="下へ移動">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {questions.length > 1 && (
                              <button onClick={() => removeQ(qi)} className="p-1 text-red-400 hover:text-red-600" title="削除"><XIcon size={16} /></button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">タイプ</label>
                            <select value={q.question_type} onChange={e => updateQ(qi, { question_type: e.target.value as QuestionDraft['question_type'] })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent bg-white">
                              <option value="text">テキスト</option>
                              <option value="single_choice">単一選択</option>
                              <option value="multiple_choice">複数選択</option>
                              <option value="rating">評価（1-5）</option>
                            </select>
                          </div>
                          <div className="flex items-end">
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={q.is_required === 1} onChange={e => updateQ(qi, { is_required: e.target.checked ? 1 : 0 })} className="w-4 h-4 text-[#06C755] border-gray-300 rounded focus:ring-[#06C755]" />
                              必須
                            </label>
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="block text-xs text-gray-500 mb-1">質問文</label>
                          <input type="text" value={q.question_text} onChange={e => updateQ(qi, { question_text: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent" placeholder="質問を入力してください" />
                        </div>
                        {['single_choice', 'multiple_choice'].includes(q.question_type) && (
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">選択肢</label>
                            <div className="space-y-2">
                              {q.options.map((opt, oi) => (
                                <div key={oi} className="flex items-center gap-2">
                                  <input type="text" value={opt} onChange={e => updateOpt(qi, oi, e.target.value)} className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent" placeholder={`選択肢 ${oi + 1}`} />
                                  {q.options.length > 1 && (
                                    <button onClick={() => removeOpt(qi, oi)} className="text-red-400 hover:text-red-600"><XIcon size={16} /></button>
                                  )}
                                </div>
                              ))}
                              <button onClick={() => addOpt(qi)} className="text-xs text-[#06C755] hover:text-[#05b34c] font-medium">+ 選択肢を追加</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => { setShowCreate(false); resetForm(); }} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium">キャンセル</button>
                <button onClick={handleCreate} disabled={saving || !title.trim() || questions.some(q => !q.question_text.trim())} className="px-4 py-2 bg-[#06C755] text-white rounded-lg hover:bg-[#05b34c] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? '作成中...' : '作成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === Results Modal === */}
      {showResults && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowResults(false); setResults(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              {resultsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#06C755] mx-auto mb-4" />
                  <p className="text-gray-500">集計データを読み込み中...</p>
                </div>
              ) : results ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{results.survey.title}</h2>
                      <p className="text-sm text-gray-500 mt-1">総回答数: {results.total_responses}件</p>
                    </div>
                    <button onClick={() => { setShowResults(false); setResults(null); }} className="p-2 text-gray-400 hover:text-gray-600"><XIcon /></button>
                  </div>
                  {results.total_responses === 0 ? (
                    <div className="text-center py-8"><p className="text-gray-500">まだ回答がありません。</p></div>
                  ) : (
                    <div className="space-y-6">
                      {results.questions.map((q, idx) => (
                        <div key={q.question_id} className="border border-gray-200 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{TYPE_LABELS[q.question_type] || q.question_type}</span>
                            <h3 className="font-medium text-gray-900">Q{idx + 1}. {q.question_text}</h3>
                          </div>

                          {/* Choice distribution bar chart */}
                          {['single_choice', 'multiple_choice'].includes(q.question_type) && q.distribution && (
                            <div className="space-y-2">
                              {Object.entries(q.distribution).map(([option, count]) => {
                                const pct = Math.round((count / (q.total_answers || 1)) * 100);
                                return (
                                  <div key={option}>
                                    <div className="flex items-center justify-between text-sm mb-1">
                                      <span className="text-gray-700">{option}</span>
                                      <span className="text-gray-500">{count}件 ({pct}%)</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-3">
                                      <div className="bg-[#06C755] h-3 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Rating average + distribution */}
                          {q.question_type === 'rating' && (
                            <div>
                              <div className="flex items-center gap-4 mb-3">
                                <div className="text-3xl font-bold text-[#06C755]">{q.average?.toFixed(1)}</div>
                                <div className="text-sm text-gray-500">/ 5.0 ({q.total_answers}件の回答)</div>
                              </div>
                              {q.distribution && (
                                <div className="space-y-1">
                                  {[5, 4, 3, 2, 1].map(r => {
                                    const c = q.distribution?.[String(r)] || 0;
                                    const pct = Math.round((c / (q.total_answers || 1)) * 100);
                                    return (
                                      <div key={r} className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 w-4 text-right">{r}</span>
                                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                                          <div className="bg-[#06C755] h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-xs text-gray-400 w-8">{c}件</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Text answers list */}
                          {q.question_type === 'text' && q.answers && (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {q.answers.length === 0 ? (
                                <p className="text-sm text-gray-400">回答なし</p>
                              ) : q.answers.map((a, ai) => (
                                <div key={ai} className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{a}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8"><p className="text-gray-500">データの読み込みに失敗しました。</p></div>
              )}
              <div className="flex justify-end mt-6">
                <button onClick={() => { setShowResults(false); setResults(null); }} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium">閉じる</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Utility Icon ---
function XIcon({ size = 20 }: { size?: number }) {
  const cls = size <= 16 ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
