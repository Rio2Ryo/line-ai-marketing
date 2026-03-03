'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface Source {
  id: string;
  name: string;
  source_type: string;
  source_code: string;
  description: string | null;
  is_active: number;
  created_at: string;
  follow_count: number;
  last_follow_at: string | null;
}

interface Analytics {
  summary: {
    total_follows: number;
    unique_users: number;
    unknown_source: number;
    previous_total: number;
    change: number;
  };
  by_source: { id: string; name: string; source_type: string; source_code: string; follow_count: number; unique_users: number }[];
  by_type: { source_type: string; follow_count: number }[];
  funnel: { id: string; name: string; followers: number; messaged_users: number; converted_users: number }[];
  period: { from: string; to: string };
}

interface DailyData {
  date: string;
  count: number;
  unique_users: number;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  qr: { label: 'QRコード', color: 'bg-blue-100 text-blue-700' },
  url: { label: 'URL', color: 'bg-green-100 text-green-700' },
  ad: { label: '広告', color: 'bg-purple-100 text-purple-700' },
  sns: { label: 'SNS', color: 'bg-pink-100 text-pink-700' },
  print: { label: '印刷物', color: 'bg-orange-100 text-orange-700' },
  other: { label: 'その他', color: 'bg-gray-100 text-gray-600' },
};

export default function FollowSourcesPage() {
  const [tab, setTab] = useState<'analytics' | 'sources'>('analytics');
  const [sources, setSources] = useState<Source[]>([]);
  const [unknownCount, setUnknownCount] = useState(0);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [daily, setDaily] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', source_type: 'qr', description: '' });
  const [creating, setCreating] = useState(false);
  const API = getApiUrl();

  const dateRange = useCallback(() => {
    const days = parseInt(period);
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    return { from, to };
  }, [period]);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API}/api/follow-sources/sources`);
      const json = await res.json();
      if (json.success) {
        setSources(json.data);
        setUnknownCount(json.unknown_source_count || 0);
      }
    } catch (err) {
      console.error('Failed to fetch sources:', err);
    }
  }, [API]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const { from, to } = dateRange();
      const res = await fetchWithAuth(`${API}/api/follow-sources/analytics?from=${from}&to=${to}`);
      const json = await res.json();
      if (json.success) setAnalytics(json.data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
  }, [API, dateRange]);

  const fetchDaily = useCallback(async () => {
    try {
      const { from, to } = dateRange();
      const res = await fetchWithAuth(`${API}/api/follow-sources/daily?from=${from}&to=${to}`);
      const json = await res.json();
      if (json.success) setDaily(json.data.daily || []);
    } catch (err) {
      console.error('Failed to fetch daily:', err);
    }
  }, [API, dateRange]);

  useEffect(() => {
    Promise.all([fetchSources(), fetchAnalytics(), fetchDaily()]).finally(() => setLoading(false));
  }, [fetchSources, fetchAnalytics, fetchDaily]);

  const handleCreate = async () => {
    if (!form.name) return;
    setCreating(true);
    try {
      const res = await fetchWithAuth(`${API}/api/follow-sources/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setForm({ name: '', source_type: 'qr', description: '' });
        setShowCreate(false);
        await fetchSources();
      }
    } catch (err) {
      console.error('Create error:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この経路を削除しますか？')) return;
    try {
      await fetchWithAuth(`${API}/api/follow-sources/sources/${id}`, { method: 'DELETE' });
      await fetchSources();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleToggle = async (id: string, currentActive: number) => {
    try {
      await fetchWithAuth(`${API}/api/follow-sources/sources/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: currentActive ? 0 : 1 }),
      });
      await fetchSources();
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  const copyTrackingUrl = (code: string) => {
    const url = `${API}/api/follow-sources/track/${code}`;
    navigator.clipboard.writeText(url).catch(() => {});
  };

  const maxDailyCount = daily.length > 0 ? Math.max(...daily.map((d) => d.count), 1) : 1;
  const maxFunnelFollowers = analytics?.funnel?.length
    ? Math.max(...analytics.funnel.map((f) => f.followers), 1)
    : 1;

  if (loading) return <div className="text-center py-12 text-gray-400">読み込み中...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">友だち追加経路分析</h2>
          <p className="text-sm text-gray-500 mt-1">QRコード別・URL別の友だち追加数トラッキングと経路別CVファネル</p>
        </div>
        <div className="flex gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="7">7日間</option>
            <option value="30">30日間</option>
            <option value="90">90日間</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">友だち追加数</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{analytics.summary.total_follows}</p>
            <p className={`text-xs mt-1 ${analytics.summary.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              前期比 {analytics.summary.change >= 0 ? '+' : ''}{analytics.summary.change}
            </p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">ユニークユーザー</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{analytics.summary.unique_users}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">経路数</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{sources.length}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">経路不明</p>
            <p className="text-2xl font-bold text-gray-400 mt-1">{analytics.summary.unknown_source}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          {[
            { key: 'analytics' as const, label: '分析' },
            { key: 'sources' as const, label: '経路管理' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Analytics Tab */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          {/* Daily Chart */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">日別友だち追加推移</h3>
            {daily.length === 0 ? (
              <p className="text-center text-gray-400 py-8">データがありません</p>
            ) : (
              <div className="flex items-end gap-1 h-40">
                {daily.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center group relative">
                    <div className="absolute -top-8 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                      {d.date}: {d.count}件
                    </div>
                    <div
                      className="w-full bg-indigo-400 rounded-t hover:bg-indigo-500 transition-colors min-h-[2px]"
                      style={{ height: `${(d.count / maxDailyCount) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
            )}
            {daily.length > 0 && (
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>{daily[0]?.date}</span>
                <span>{daily[daily.length - 1]?.date}</span>
              </div>
            )}
          </div>

          {/* Source Type Distribution */}
          {analytics && analytics.by_type.length > 0 && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">経路タイプ別</h3>
              <div className="space-y-3">
                {analytics.by_type.map((t) => {
                  const typeInfo = TYPE_LABELS[t.source_type] || TYPE_LABELS.other;
                  const maxCount = Math.max(...analytics.by_type.map((x) => x.follow_count), 1);
                  return (
                    <div key={t.source_type} className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeInfo.color} w-20 text-center`}>
                        {typeInfo.label}
                      </span>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-400 rounded-full transition-all"
                          style={{ width: `${(t.follow_count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-gray-700 w-10 text-right">{t.follow_count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Source Ranking */}
          {analytics && analytics.by_source.length > 0 && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">経路別ランキング</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">#</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">経路名</th>
                      <th className="text-center px-3 py-2 text-gray-500 font-medium">タイプ</th>
                      <th className="text-right px-3 py-2 text-gray-500 font-medium">追加数</th>
                      <th className="text-right px-3 py-2 text-gray-500 font-medium">UU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.by_source.map((s, i) => {
                      const typeInfo = TYPE_LABELS[s.source_type] || TYPE_LABELS.other;
                      return (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">{s.name}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs ${typeInfo.color}`}>{typeInfo.label}</span>
                          </td>
                          <td className="px-3 py-2 text-right font-bold">{s.follow_count}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{s.unique_users}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CV Funnel */}
          {analytics && analytics.funnel.length > 0 && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">経路別CVファネル</h3>
              <div className="space-y-4">
                {analytics.funnel.map((f) => {
                  const msgRate = f.followers > 0 ? Math.round((f.messaged_users / f.followers) * 100) : 0;
                  const cvRate = f.followers > 0 ? Math.round((f.converted_users / f.followers) * 100) : 0;
                  return (
                    <div key={f.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-gray-900">{f.name}</span>
                        <span className="text-sm text-gray-500">{f.followers}人</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>友だち追加</span>
                            <span>{f.followers}</span>
                          </div>
                          <div className="h-3 bg-indigo-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: '100%' }} />
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>メッセージ</span>
                            <span>{f.messaged_users} ({msgRate}%)</span>
                          </div>
                          <div className="h-3 bg-blue-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${msgRate}%` }} />
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>CV</span>
                            <span>{f.converted_users} ({cvRate}%)</span>
                          </div>
                          <div className="h-3 bg-green-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: `${cvRate}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sources Management Tab */}
      {tab === 'sources' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              {showCreate ? 'キャンセル' : '+ 新規経路'}
            </button>
          </div>

          {/* Create Form */}
          {showCreate && (
            <div className="bg-white rounded-xl border p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">新規経路作成</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">経路名</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="例: 店頭POP QR"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">タイプ</label>
                  <select
                    value={form.source_type}
                    onChange={(e) => setForm({ ...form, source_type: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    {Object.entries(TYPE_LABELS).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">説明 (任意)</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="例: 渋谷店入口のQRコード"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleCreate}
                  disabled={creating || !form.name}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {creating ? '作成中...' : '作成'}
                </button>
              </div>
            </div>
          )}

          {/* Source List */}
          {sources.length === 0 && !showCreate ? (
            <div className="text-center py-12 bg-white rounded-xl border">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <p className="text-gray-500">経路がありません</p>
              <p className="text-sm text-gray-400 mt-1">「新規経路」ボタンで追加してください</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map((s) => {
                const typeInfo = TYPE_LABELS[s.source_type] || TYPE_LABELS.other;
                const trackUrl = `${API}/api/follow-sources/track/${s.source_code}`;
                return (
                  <div key={s.id} className={`bg-white rounded-xl border p-4 ${!s.is_active ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{s.name}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
                          {!s.is_active && <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">無効</span>}
                        </div>
                        {s.description && <p className="text-xs text-gray-400">{s.description}</p>}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>コード: <code className="bg-gray-100 px-1 rounded">{s.source_code}</code></span>
                          <span>追加数: <strong className="text-gray-700">{s.follow_count}</strong></span>
                          {s.last_follow_at && <span>最終: {new Date(s.last_follow_at).toLocaleDateString('ja-JP')}</span>}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={trackUrl}
                            className="flex-1 bg-gray-50 border rounded px-2 py-1 text-xs text-gray-600"
                          />
                          <button
                            onClick={() => copyTrackingUrl(s.source_code)}
                            className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 hover:bg-gray-200"
                          >
                            コピー
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleToggle(s.id, s.is_active)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                            s.is_active
                              ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                        >
                          {s.is_active ? '無効化' : '有効化'}
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Unknown source info */}
              {unknownCount > 0 && (
                <div className="bg-gray-50 rounded-xl border border-dashed p-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-gray-600">
                      経路不明の友だち追加: <strong>{unknownCount}件</strong>
                    </span>
                    <span className="text-xs text-gray-400">(トラッキングURL経由でない直接追加)</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
