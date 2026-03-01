'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

const API = getApiUrl();

// --- Types ---
interface Variation {
  id?: string;
  name: string;
  message_content: string;
  distribution_rate: number;
  sent_count?: number;
  open_rate?: number;
  click_rate?: number;
  conversion_rate?: number;
}

interface ABTest {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'running' | 'completed' | 'cancelled';
  variations: Variation[];
  total_sent?: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface GenerateForm {
  purpose: string;
  target: string;
}

// --- Status labels & colors ---
const STATUS_LABEL: Record<string, string> = {
  draft: '下書き',
  running: '配信中',
  completed: '完了',
  cancelled: 'キャンセル',
};

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  running: 'bg-green-100 text-green-700 animate-pulse',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-600',
};

const VARIATION_COLORS = ['#06C755', '#3B82F6', '#F59E0B', '#EF4444'];

function emptyVariation(name: string): Variation {
  return { name, message_content: '', distribution_rate: 50 };
}

// --- Component ---
export default function ABTestsPage() {
  // List state
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Detail state
  const [detailTest, setDetailTest] = useState<ABTest | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create/Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formVariations, setFormVariations] = useState<Variation[]>([
    emptyVariation('A'),
    emptyVariation('B'),
  ]);
  const [saving, setSaving] = useState(false);

  // AI Generate state
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState<GenerateForm>({ purpose: '', target: '' });
  const [generating, setGenerating] = useState(false);

  // --- Data fetching ---
  const loadList = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`${API}/api/ab-tests?page=${p}&limit=20`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'データの取得に失敗しました');
      setTests(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList(page);
  }, [loadList, page]);

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailTest(null);
    try {
      const res = await fetchWithAuth(`${API}/api/ab-tests/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '詳細の取得に失敗しました');
      setDetailTest(json.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '詳細の取得に失敗しました');
    } finally {
      setDetailLoading(false);
    }
  };

  // --- Handlers ---
  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setFormVariations([emptyVariation('A'), emptyVariation('B')]);
    setEditId(null);
    setShowGenerate(false);
    setGenForm({ purpose: '', target: '' });
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    if (formVariations.some(v => !v.message_content.trim())) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: formName,
        description: formDesc || null,
        variations: formVariations.map(v => ({
          name: v.name,
          message_content: v.message_content,
          distribution_rate: v.distribution_rate,
        })),
      };
      const url = editId ? `${API}/api/ab-tests/${editId}` : `${API}/api/ab-tests`;
      const method = editId ? 'PUT' : 'POST';
      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '保存に失敗しました');
      closeModal();
      loadList(page);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleStart = async (id: string) => {
    if (!window.confirm('このA/Bテストを開始しますか？')) return;
    try {
      const res = await fetchWithAuth(`${API}/api/ab-tests/${id}/start`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '開始に失敗しました');
      loadList(page);
      if (detailTest?.id === id) loadDetail(id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '開始に失敗しました');
    }
  };

  const handleComplete = async (id: string) => {
    if (!window.confirm('このA/Bテストを完了にしますか？')) return;
    try {
      const res = await fetchWithAuth(`${API}/api/ab-tests/${id}/complete`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '完了処理に失敗しました');
      loadList(page);
      if (detailTest?.id === id) loadDetail(id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '完了処理に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('このA/Bテストを削除しますか？')) return;
    try {
      const res = await fetchWithAuth(`${API}/api/ab-tests/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '削除に失敗しました');
      if (detailTest?.id === id) setDetailTest(null);
      loadList(page);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '削除に失敗しました');
    }
  };

  const handleGenerate = async () => {
    if (!genForm.purpose.trim() || !genForm.target.trim()) return;
    setGenerating(true);
    try {
      const res = await fetchWithAuth(`${API}/api/ab-tests/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: genForm.purpose, target: genForm.target }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'AI生成に失敗しました');
      const generated = json.data?.variations || [];
      if (generated.length > 0) {
        const names = ['A', 'B', 'C', 'D'];
        const rate = Math.floor(100 / generated.length);
        const newVars: Variation[] = generated.map((v: { name?: string; message_content?: string }, i: number) => ({
          name: v.name || names[i] || String.fromCharCode(65 + i),
          message_content: v.message_content || '',
          distribution_rate: i === generated.length - 1 ? 100 - rate * (generated.length - 1) : rate,
        }));
        setFormVariations(newVars);
      }
      setShowGenerate(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'AI生成に失敗しました');
    } finally {
      setGenerating(false);
    }
  };

  // --- Variation helpers ---
  const updateVariation = (i: number, patch: Partial<Variation>) => {
    setFormVariations(prev => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  };

  const addVariation = () => {
    if (formVariations.length >= 4) return;
    const names = ['A', 'B', 'C', 'D'];
    const name = names[formVariations.length] || String.fromCharCode(65 + formVariations.length);
    setFormVariations(prev => [...prev, emptyVariation(name)]);
  };

  const removeVariation = (i: number) => {
    if (formVariations.length <= 2) return;
    setFormVariations(prev => prev.filter((_, idx) => idx !== i));
  };

  const rateSum = formVariations.reduce((s, v) => s + v.distribution_rate, 0);

  // --- Detail helpers ---
  const getWinner = (test: ABTest): Variation | null => {
    if (test.status !== 'completed' || !test.variations?.length) return null;
    return test.variations.reduce((best, v) =>
      (v.conversion_rate || 0) > (best.conversion_rate || 0) ? v : best
    , test.variations[0]);
  };

  const getImprovement = (test: ABTest): number | null => {
    if (test.status !== 'completed' || !test.variations || test.variations.length < 2) return null;
    const sorted = [...test.variations].sort((a, b) => (b.conversion_rate || 0) - (a.conversion_rate || 0));
    const best = sorted[0].conversion_rate || 0;
    const worst = sorted[sorted.length - 1].conversion_rate || 0;
    if (worst === 0) return null;
    return Math.round(((best - worst) / worst) * 100);
  };

  // --- Skeleton ---
  if (loading && tests.length === 0 && !detailTest) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">A/Bテスト</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse flex gap-4 items-center">
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="h-4 bg-gray-200 rounded w-16" />
                <div className="h-4 bg-gray-200 rounded w-12" />
                <div className="h-4 bg-gray-200 rounded w-16" />
                <div className="h-4 bg-gray-200 rounded w-20" />
                <div className="h-4 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Detail View ---
  if (detailTest || detailLoading) {
    const winner = detailTest ? getWinner(detailTest) : null;
    const improvement = detailTest ? getImprovement(detailTest) : null;

    return (
      <div className="space-y-6">
        {/* Back + Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setDetailTest(null)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">A/Bテスト詳細</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4"><XIcon /></button>
          </div>
        )}

        {detailLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#06C755] mx-auto mb-4" />
            <p className="text-gray-500">読み込み中...</p>
          </div>
        ) : detailTest ? (
          <>
            {/* Test Info Header */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold text-gray-900">{detailTest.name}</h2>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLE[detailTest.status] || 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LABEL[detailTest.status] || detailTest.status}
                    </span>
                  </div>
                  {detailTest.description && (
                    <p className="text-sm text-gray-500 mb-3">{detailTest.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>作成日: {new Date(detailTest.created_at).toLocaleDateString('ja-JP')}</span>
                    {detailTest.started_at && (
                      <span>開始日: {new Date(detailTest.started_at).toLocaleDateString('ja-JP')}</span>
                    )}
                    {detailTest.completed_at && (
                      <span>完了日: {new Date(detailTest.completed_at).toLocaleDateString('ja-JP')}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {detailTest.status === 'draft' && (
                    <button onClick={() => handleStart(detailTest.id)} className="px-4 py-2 bg-[#06C755] text-white rounded-lg text-sm font-medium hover:bg-[#05b34c] transition-colors">
                      開始
                    </button>
                  )}
                  {detailTest.status === 'running' && (
                    <button onClick={() => handleComplete(detailTest.id)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                      完了
                    </button>
                  )}
                  {(detailTest.status === 'draft' || detailTest.status === 'cancelled') && (
                    <button onClick={() => handleDelete(detailTest.id)} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
                      削除
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Variation Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {detailTest.variations?.map((v, i) => {
                const isWinner = detailTest.status === 'completed' && winner?.name === v.name;
                return (
                  <div
                    key={v.id || i}
                    className={`bg-white rounded-2xl shadow-sm border p-6 relative ${isWinner ? 'border-[#06C755] ring-2 ring-[#06C755]/20' : 'border-gray-100'}`}
                  >
                    {/* Winner badge */}
                    {isWinner && (
                      <div className="absolute -top-3 -right-3 bg-[#06C755] text-white rounded-full w-10 h-10 flex items-center justify-center shadow-md">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                        </svg>
                      </div>
                    )}

                    {/* Variation header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: VARIATION_COLORS[i] || '#6B7280' }}
                      >
                        {v.name}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">バリエーション {v.name}</h3>
                        <span className="text-xs text-gray-400">配信率: {v.distribution_rate}%</span>
                      </div>
                    </div>

                    {/* Message preview */}
                    <div className="bg-gray-50 rounded-xl p-4 mb-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">{v.message_content}</p>
                    </div>

                    {/* Stats */}
                    <div className="space-y-3">
                      <StatBar label="配信数" value={v.sent_count ?? 0} max={detailTest.total_sent || 1} display={String(v.sent_count ?? 0)} color={VARIATION_COLORS[i] || '#6B7280'} />
                      <StatBar label="開封率" value={v.open_rate ?? 0} max={100} display={`${(v.open_rate ?? 0).toFixed(1)}%`} color={VARIATION_COLORS[i] || '#6B7280'} />
                      <StatBar label="クリック率" value={v.click_rate ?? 0} max={100} display={`${(v.click_rate ?? 0).toFixed(1)}%`} color={VARIATION_COLORS[i] || '#6B7280'} />
                      <StatBar label="コンバージョン率" value={v.conversion_rate ?? 0} max={100} display={`${(v.conversion_rate ?? 0).toFixed(1)}%`} color={VARIATION_COLORS[i] || '#6B7280'} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary Section */}
            {detailTest.status === 'completed' && detailTest.variations?.length >= 2 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">テスト結果サマリー</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">総配信数</p>
                    <p className="text-2xl font-bold text-gray-900">{(detailTest.total_sent ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">最優秀バリエーション</p>
                    <p className="text-2xl font-bold text-[#06C755]">{winner?.name || '-'}</p>
                    {winner && (
                      <p className="text-xs text-gray-500 mt-1">CVR {(winner.conversion_rate ?? 0).toFixed(1)}%</p>
                    )}
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <p className="text-sm text-gray-500 mb-1">改善率</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {improvement !== null ? `+${improvement}%` : '-'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">最優秀 vs 最低</p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <p className="text-gray-500">データの読み込みに失敗しました。</p>
          </div>
        )}
      </div>
    );
  }

  // --- Main List View ---
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">A/Bテスト</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors"
        >
          新規A/Bテスト
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4"><XIcon /></button>
        </div>
      )}

      {/* Empty state */}
      {!loading && tests.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <p className="text-gray-500 mb-4">A/Bテストがまだありません</p>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors"
          >
            最初のテストを作成
          </button>
        </div>
      ) : (
        /* Table */
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="py-2 px-3 font-medium text-gray-500">テスト名</th>
                  <th className="py-2 px-3 font-medium text-gray-500">ステータス</th>
                  <th className="py-2 px-3 font-medium text-gray-500">バリエーション数</th>
                  <th className="py-2 px-3 font-medium text-gray-500">配信数</th>
                  <th className="py-2 px-3 font-medium text-gray-500">開始日</th>
                  <th className="py-2 px-3 font-medium text-gray-500">アクション</th>
                </tr>
              </thead>
              <tbody>
                {tests.map(t => (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-3">
                      <div className="font-medium text-gray-900 max-w-[200px] truncate">{t.name}</div>
                      {t.description && (
                        <div className="text-xs text-gray-400 max-w-[200px] truncate mt-0.5">{t.description}</div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[t.status] || 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABEL[t.status] || t.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-600">{t.variations?.length || 0}</td>
                    <td className="py-3 px-3 text-gray-600">{(t.total_sent ?? 0).toLocaleString()}</td>
                    <td className="py-3 px-3 text-gray-600 whitespace-nowrap">
                      {t.started_at
                        ? new Date(t.started_at).toLocaleDateString('ja-JP')
                        : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => loadDetail(t.id)}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          詳細
                        </button>
                        {t.status === 'draft' && (
                          <button
                            onClick={() => handleStart(t.id)}
                            className="text-sm text-[#06C755] hover:text-[#05b34c] font-medium"
                          >
                            開始
                          </button>
                        )}
                        {t.status === 'running' && (
                          <button
                            onClick={() => handleComplete(t.id)}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            完了
                          </button>
                        )}
                        {(t.status === 'draft' || t.status === 'cancelled') && (
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="text-sm text-red-500 hover:text-red-700 font-medium"
                          >
                            削除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                前へ
              </button>
              <span className="text-sm text-gray-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                次へ
              </button>
            </div>
          )}
        </section>
      )}

      {/* === Create/Edit Modal === */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editId ? 'A/Bテストを編集' : '新規A/Bテスト'}
                </h2>
                <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-600"><XIcon /></button>
              </div>

              <div className="space-y-5">
                {/* Test name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    テスト名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent"
                    placeholder="例: 春キャンペーンメッセージテスト"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                  <textarea
                    rows={2}
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent resize-y"
                    placeholder="テストの目的や備考（任意）"
                  />
                </div>

                {/* AI Generate Button */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowGenerate(!showGenerate)}
                    className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI生成
                  </button>
                  <span className="text-xs text-gray-400">AIでバリエーションを自動生成</span>
                </div>

                {/* AI Generate Form */}
                {showGenerate && (
                  <div className="bg-purple-50 rounded-xl p-4 space-y-3 border border-purple-100">
                    <div>
                      <label className="block text-sm font-medium text-purple-700 mb-1">目的 <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={genForm.purpose}
                        onChange={e => setGenForm(prev => ({ ...prev, purpose: e.target.value }))}
                        className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent bg-white"
                        placeholder="例: セール告知、新商品案内"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-purple-700 mb-1">ターゲット <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={genForm.target}
                        onChange={e => setGenForm(prev => ({ ...prev, target: e.target.value }))}
                        className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent bg-white"
                        placeholder="例: 20代女性、既存顧客"
                      />
                    </div>
                    <button
                      onClick={handleGenerate}
                      disabled={generating || !genForm.purpose.trim() || !genForm.target.trim()}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {generating && (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      {generating ? '生成中...' : 'バリエーションを生成'}
                    </button>
                  </div>
                )}

                {/* Variations */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      バリエーション <span className="text-red-500">*</span>
                    </label>
                    {formVariations.length < 4 && (
                      <button
                        onClick={addVariation}
                        className="text-sm text-[#06C755] hover:text-[#05b34c] font-medium"
                      >
                        + バリエーション追加
                      </button>
                    )}
                  </div>

                  {/* Distribution rate bar */}
                  <div className="flex rounded-full overflow-hidden h-3 mb-4">
                    {formVariations.map((v, i) => (
                      <div
                        key={i}
                        style={{
                          width: `${v.distribution_rate}%`,
                          backgroundColor: VARIATION_COLORS[i] || '#6B7280',
                          transition: 'width 0.3s ease',
                        }}
                        title={`${v.name}: ${v.distribution_rate}%`}
                      />
                    ))}
                  </div>
                  {rateSum !== 100 && (
                    <p className="text-xs text-red-500 mb-3 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      配信率の合計が100%になるようにしてください（現在: {rateSum}%）
                    </p>
                  )}

                  <div className="space-y-4">
                    {formVariations.map((v, i) => (
                      <div key={i} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ backgroundColor: VARIATION_COLORS[i] || '#6B7280' }}
                            >
                              {v.name}
                            </div>
                            <span className="text-sm font-medium text-gray-700">バリエーション {v.name}</span>
                          </div>
                          {formVariations.length > 2 && (
                            <button
                              onClick={() => removeVariation(i)}
                              className="p-1 text-red-400 hover:text-red-600"
                              title="バリエーション削除"
                            >
                              <XIcon size={16} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-4 gap-3 mb-3">
                          <div className="col-span-1">
                            <label className="block text-xs text-gray-500 mb-1">名前</label>
                            <input
                              type="text"
                              value={v.name}
                              onChange={e => updateVariation(i, { name: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent"
                            />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-xs text-gray-500 mb-1">配信率 %</label>
                            <input
                              type="number"
                              min={1}
                              max={99}
                              value={v.distribution_rate}
                              onChange={e => updateVariation(i, { distribution_rate: Math.max(1, Math.min(99, Number(e.target.value) || 0)) })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">メッセージ内容 <span className="text-red-500">*</span></label>
                          <textarea
                            rows={3}
                            value={v.message_content}
                            onChange={e => updateVariation(i, { message_content: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent resize-y"
                            placeholder="配信するメッセージを入力してください"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal actions */}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={
                    saving ||
                    !formName.trim() ||
                    formVariations.some(v => !v.message_content.trim()) ||
                    rateSum !== 100
                  }
                  className="px-4 py-2 bg-[#06C755] text-white rounded-lg hover:bg-[#05b34c] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '保存中...' : editId ? '更新' : '作成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Utility Components ---

function XIcon({ size = 20 }: { size?: number }) {
  const cls = size <= 16 ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function StatBar({ label, value, max, display, color }: { label: string; value: number; max: number; display: string; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-900 font-medium">{display}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <div
          className="h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
