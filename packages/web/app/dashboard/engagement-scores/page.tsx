'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface ScoreEntry {
  id: string;
  user_id: string;
  total_score: number;
  rank: string;
  message_score: number;
  engagement_score: number;
  conversion_score: number;
  retention_score: number;
  calculated_at: string;
  display_name: string | null;
  picture_url: string | null;
  user_status: string | null;
  tag_count: number;
}

interface Distribution {
  rank_distribution: { rank: string; count: number; avg_score: number }[];
  histogram: { bucket: string; count: number }[];
  stats: {
    total_users: number;
    avg_score: number;
    max_score: number;
    min_score: number;
    avg_message: number;
    avg_engagement: number;
    avg_conversion: number;
    avg_retention: number;
  };
}

interface UserDetail {
  id: string;
  user_id: string;
  total_score: number;
  rank: string;
  message_score: number;
  engagement_score: number;
  conversion_score: number;
  retention_score: number;
  display_name: string;
  picture_url: string | null;
  user_since: string;
  ranking: { position: number; total: number; percentile: number };
  activity: {
    messages_30d: number;
    deliveries_30d: number;
    deliveries_sent_30d: number;
    conversions_30d: number;
  };
  tags: string[];
}

const RANK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  S: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300' },
  A: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300' },
  B: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  C: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300' },
  D: { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-300' },
};

const RANK_LABELS: Record<string, string> = {
  S: 'ロイヤル',
  A: 'アクティブ',
  B: '標準',
  C: '低活動',
  D: '休眠',
};

export default function EngagementScoresPage() {
  const [tab, setTab] = useState<'ranking' | 'distribution'>('ranking');
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [distribution, setDistribution] = useState<Distribution | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [rankFilter, setRankFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const API = getApiUrl();

  const fetchScores = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (rankFilter) params.set('rank', rankFilter);
      const res = await fetchWithAuth(`${API}/api/engagement-scores?${params}`);
      const json = await res.json();
      if (json.success) {
        setScores(json.data);
        setTotalPages(json.pagination.totalPages);
        setTotalCount(json.pagination.total);
      }
    } catch (err) {
      console.error('Failed to fetch scores:', err);
    } finally {
      setLoading(false);
    }
  }, [API, page, rankFilter]);

  const fetchDistribution = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API}/api/engagement-scores/distribution`);
      const json = await res.json();
      if (json.success) setDistribution(json.data);
    } catch (err) {
      console.error('Failed to fetch distribution:', err);
    }
  }, [API]);

  const fetchUserDetail = async (userId: string) => {
    try {
      const res = await fetchWithAuth(`${API}/api/engagement-scores/user/${userId}`);
      const json = await res.json();
      if (json.success) setSelectedUser(json.data);
    } catch (err) {
      console.error('Failed to fetch user detail:', err);
    }
  };

  const calculateScores = async () => {
    setCalculating(true);
    try {
      const res = await fetchWithAuth(`${API}/api/engagement-scores/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) {
        await fetchScores();
        await fetchDistribution();
      }
    } catch (err) {
      console.error('Failed to calculate scores:', err);
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  useEffect(() => {
    fetchDistribution();
  }, [fetchDistribution]);

  const maxHistCount = distribution?.histogram
    ? Math.max(...distribution.histogram.map((h) => h.count), 1)
    : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">ユーザー行動スコアリング</h2>
          <p className="text-sm text-gray-500 mt-1">
            エンゲージメント指標を重み付けスコア化し、ユーザーをランク分類します
          </p>
        </div>
        <button
          onClick={calculateScores}
          disabled={calculating}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
        >
          {calculating ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              計算中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              スコア再計算
            </>
          )}
        </button>
      </div>

      {/* Summary Cards */}
      {distribution?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">対象ユーザー</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{distribution.stats.total_users}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">平均スコア</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{distribution.stats.avg_score}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">最高スコア</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{distribution.stats.max_score}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">最低スコア</p>
            <p className="text-2xl font-bold text-gray-500 mt-1">{distribution.stats.min_score}</p>
          </div>
        </div>
      )}

      {/* Rank Summary Cards */}
      {distribution?.rank_distribution && distribution.rank_distribution.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {['S', 'A', 'B', 'C', 'D'].map((r) => {
            const rd = distribution.rank_distribution.find((d) => d.rank === r);
            const colors = RANK_COLORS[r];
            return (
              <button
                key={r}
                onClick={() => {
                  setRankFilter(rankFilter === r ? '' : r);
                  setPage(1);
                }}
                className={`rounded-xl border-2 p-3 text-center transition-all ${
                  rankFilter === r ? `${colors.border} ${colors.bg} ring-2 ring-offset-1` : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`text-2xl font-black ${colors.text}`}>{r}</div>
                <div className="text-xs text-gray-500 mt-1">{RANK_LABELS[r]}</div>
                <div className="text-lg font-bold text-gray-900">{rd?.count || 0}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          {[
            { key: 'ranking' as const, label: 'ランキング' },
            { key: 'distribution' as const, label: 'スコア分布' },
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

      {/* Ranking Tab */}
      {tab === 'ranking' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-gray-400">読み込み中...</div>
          ) : scores.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-gray-500">スコアデータがありません</p>
              <p className="text-sm text-gray-400 mt-1">「スコア再計算」ボタンで計算を実行してください</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left px-4 py-3 font-medium text-gray-500 w-12">#</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">ユーザー</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 w-16">ランク</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 w-20">総合</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 w-20 hidden md:table-cell">メッセージ</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 w-20 hidden md:table-cell">反応</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 w-20 hidden md:table-cell">CV</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 w-20 hidden md:table-cell">継続</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500 w-20 hidden lg:table-cell">タグ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scores.map((s, i) => {
                        const colors = RANK_COLORS[s.rank] || RANK_COLORS.D;
                        const position = (page - 1) * 30 + i + 1;
                        return (
                          <tr
                            key={s.id}
                            className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                            onClick={() => fetchUserDetail(s.user_id)}
                          >
                            <td className="px-4 py-3 text-gray-400 font-mono">{position}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {s.picture_url ? (
                                  <img src={s.picture_url} alt="" className="w-8 h-8 rounded-full" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
                                    {(s.display_name || '?')[0]}
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium text-gray-900">{s.display_name || '不明'}</p>
                                  <p className="text-xs text-gray-400 truncate max-w-[120px]">{s.user_id.slice(0, 12)}...</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-sm ${colors.bg} ${colors.text} border ${colors.border}`}>
                                {s.rank}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-bold text-gray-900">{s.total_score}</span>
                            </td>
                            <td className="px-4 py-3 text-center hidden md:table-cell">
                              <ScoreBar value={s.message_score} color="bg-blue-400" />
                            </td>
                            <td className="px-4 py-3 text-center hidden md:table-cell">
                              <ScoreBar value={s.engagement_score} color="bg-green-400" />
                            </td>
                            <td className="px-4 py-3 text-center hidden md:table-cell">
                              <ScoreBar value={s.conversion_score} color="bg-purple-400" />
                            </td>
                            <td className="px-4 py-3 text-center hidden md:table-cell">
                              <ScoreBar value={s.retention_score} color="bg-orange-400" />
                            </td>
                            <td className="px-4 py-3 text-center hidden lg:table-cell text-gray-500">{s.tag_count}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">{totalCount}件中 {(page - 1) * 30 + 1}-{Math.min(page * 30, totalCount)}件</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page <= 1}
                      className="px-3 py-1 border rounded text-sm disabled:opacity-30"
                    >
                      前へ
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-500">{page} / {totalPages}</span>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page >= totalPages}
                      className="px-3 py-1 border rounded text-sm disabled:opacity-30"
                    >
                      次へ
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Distribution Tab */}
      {tab === 'distribution' && distribution && (
        <div className="space-y-6">
          {/* Category Averages */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">カテゴリ別平均スコア</h3>
            <div className="space-y-3">
              {[
                { label: 'メッセージ頻度', value: distribution.stats.avg_message, color: 'bg-blue-500' },
                { label: '配信反応', value: distribution.stats.avg_engagement, color: 'bg-green-500' },
                { label: 'コンバージョン', value: distribution.stats.avg_conversion, color: 'bg-purple-500' },
                { label: '継続利用', value: distribution.stats.avg_retention, color: 'bg-orange-500' },
              ].map((cat) => (
                <div key={cat.label} className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 w-28 shrink-0">{cat.label}</span>
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${cat.color} rounded-full transition-all duration-500`}
                      style={{ width: `${cat.value || 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-700 w-12 text-right">{cat.value || 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Score Histogram */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">スコア分布ヒストグラム</h3>
            <div className="space-y-2">
              {distribution.histogram.map((h) => (
                <div key={h.bucket} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-16 text-right font-mono">{h.bucket}</span>
                  <div className="flex-1 h-7 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded transition-all duration-500"
                      style={{ width: `${(h.count / maxHistCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600 w-8 text-right">{h.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Weight explanation */}
          <div className="bg-white rounded-xl border p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">スコアリング基準</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div>
                    <span className="font-medium">メッセージ頻度 (25%)</span>
                    <p className="text-gray-500 text-xs">直近30日のメッセージ送信数</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                  <div>
                    <span className="font-medium">配信反応 (25%)</span>
                    <p className="text-gray-500 text-xs">配信に対するレスポンス率</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                  <div>
                    <span className="font-medium">コンバージョン (25%)</span>
                    <p className="text-gray-500 text-xs">直近30日のCV達成件数</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                  <div>
                    <span className="font-medium">継続利用 (25%)</span>
                    <p className="text-gray-500 text-xs">最終アクティビティからの経過日数</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-xs font-semibold text-gray-500 mb-2">ランク基準</h4>
              <div className="flex flex-wrap gap-3">
                {Object.entries(RANK_LABELS).map(([r, label]) => {
                  const colors = RANK_COLORS[r];
                  const ranges: Record<string, string> = { S: '80-100', A: '60-79', B: '40-59', C: '20-39', D: '0-19' };
                  return (
                    <div key={r} className={`flex items-center gap-2 px-3 py-1 rounded-lg border ${colors.bg} ${colors.border}`}>
                      <span className={`font-black ${colors.text}`}>{r}</span>
                      <span className="text-xs text-gray-600">{label} ({ranges[r]})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedUser.picture_url ? (
                  <img src={selectedUser.picture_url} alt="" className="w-12 h-12 rounded-full" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-400">
                    {(selectedUser.display_name || '?')[0]}
                  </div>
                )}
                <div>
                  <p className="font-bold text-gray-900">{selectedUser.display_name || '不明'}</p>
                  <p className="text-xs text-gray-400">登録: {selectedUser.user_since ? new Date(selectedUser.user_since).toLocaleDateString('ja-JP') : '-'}</p>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Score & Rank */}
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black border-2 ${RANK_COLORS[selectedUser.rank]?.bg} ${RANK_COLORS[selectedUser.rank]?.text} ${RANK_COLORS[selectedUser.rank]?.border}`}>
                    {selectedUser.rank}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{RANK_LABELS[selectedUser.rank]}</p>
                </div>
                <div className="flex-1">
                  <p className="text-4xl font-black text-gray-900">{selectedUser.total_score}<span className="text-base font-normal text-gray-400">/100</span></p>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedUser.ranking.position}位 / {selectedUser.ranking.total}人中
                    <span className="ml-2 text-indigo-600 font-medium">上位{100 - selectedUser.ranking.percentile}%</span>
                  </p>
                </div>
              </div>

              {/* Category scores */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700">カテゴリ別スコア</h4>
                {[
                  { label: 'メッセージ頻度', value: selectedUser.message_score, color: 'bg-blue-500' },
                  { label: '配信反応', value: selectedUser.engagement_score, color: 'bg-green-500' },
                  { label: 'コンバージョン', value: selectedUser.conversion_score, color: 'bg-purple-500' },
                  { label: '継続利用', value: selectedUser.retention_score, color: 'bg-orange-500' },
                ].map((cat) => (
                  <div key={cat.label} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-24 shrink-0">{cat.label}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${cat.color} rounded-full`} style={{ width: `${cat.value}%` }} />
                    </div>
                    <span className="text-sm font-bold text-gray-700 w-8 text-right">{cat.value}</span>
                  </div>
                ))}
              </div>

              {/* Activity Summary */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">直近30日のアクティビティ</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-blue-700">{selectedUser.activity.messages_30d}</p>
                    <p className="text-xs text-blue-600">メッセージ</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-green-700">{selectedUser.activity.deliveries_sent_30d}</p>
                    <p className="text-xs text-green-600">配信受信</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-purple-700">{selectedUser.activity.conversions_30d}</p>
                    <p className="text-xs text-purple-600">コンバージョン</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-gray-700">{selectedUser.tags.length}</p>
                    <p className="text-xs text-gray-600">タグ数</p>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {selectedUser.tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">タグ</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.tags.map((tag) => (
                      <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-6 text-right">{value}</span>
    </div>
  );
}
