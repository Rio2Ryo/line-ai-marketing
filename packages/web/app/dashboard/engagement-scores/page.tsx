'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

// ─── Types ───

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

interface AutoActionRule {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: string;
  actions: string;
  is_active: number;
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ActionLog {
  id: string;
  action_id: string;
  action_name: string;
  user_id: string;
  user_name: string | null;
  display_name: string | null;
  picture_url: string | null;
  previous_rank: string;
  new_rank: string;
  previous_score: number;
  new_score: number;
  executed_actions: string;
  status: string;
  created_at: string;
}

interface TagItem {
  id: string;
  name: string;
  color: string;
}

interface ScenarioItem {
  id: string;
  name: string;
}

const RANK_COLORS: Record<string, { bg: string; text: string; border: string; darkBg: string; darkText: string }> = {
  S: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300', darkBg: 'dark:bg-yellow-900/30', darkText: 'dark:text-yellow-300' },
  A: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300', darkBg: 'dark:bg-purple-900/30', darkText: 'dark:text-purple-300' },
  B: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300', darkBg: 'dark:bg-blue-900/30', darkText: 'dark:text-blue-300' },
  C: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300', darkBg: 'dark:bg-green-900/30', darkText: 'dark:text-green-300' },
  D: { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-300', darkBg: 'dark:bg-gray-800', darkText: 'dark:text-gray-400' },
};

const RANK_LABELS: Record<string, string> = {
  S: 'ロイヤル',
  A: 'アクティブ',
  B: '標準',
  C: '低活動',
  D: '休眠',
};

const TRIGGER_LABELS: Record<string, string> = {
  rank_up: 'ランクUP',
  rank_down: 'ランクDOWN',
  rank_is: 'ランク一致',
  rank_entered: 'ランク移行',
  score_above: 'スコア以上',
  score_below: 'スコア以下',
};

const ACTION_LABELS: Record<string, string> = {
  tag_add: 'タグ付与',
  tag_remove: 'タグ除去',
  scenario_execute: 'シナリオ発火',
  notification: '通知送信',
};

export default function EngagementScoresPage() {
  const [tab, setTab] = useState<'ranking' | 'distribution' | 'actions'>('ranking');
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
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">ユーザー行動スコアリング</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
          {[
            { label: '対象ユーザー', value: distribution.stats.total_users, color: 'text-gray-900 dark:text-white' },
            { label: '平均スコア', value: distribution.stats.avg_score, color: 'text-indigo-600 dark:text-indigo-400' },
            { label: '最高スコア', value: distribution.stats.max_score, color: 'text-yellow-600 dark:text-yellow-400' },
            { label: '最低スコア', value: distribution.stats.min_score, color: 'text-gray-500 dark:text-gray-400' },
          ].map((c) => (
            <div key={c.label} className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
            </div>
          ))}
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
                onClick={() => { setRankFilter(rankFilter === r ? '' : r); setPage(1); }}
                className={`rounded-xl border-2 p-3 text-center transition-all ${
                  rankFilter === r ? `${colors.border} ${colors.bg} ${colors.darkBg} ring-2 ring-offset-1` : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className={`text-2xl font-black ${colors.text} ${colors.darkText}`}>{r}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{RANK_LABELS[r]}</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{rd?.count || 0}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b dark:border-gray-700">
        <div className="flex gap-4">
          {[
            { key: 'ranking' as const, label: 'ランキング' },
            { key: 'distribution' as const, label: 'スコア分布' },
            { key: 'actions' as const, label: '自動アクション' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ranking Tab */}
      {tab === 'ranking' && (
        <RankingTab
          scores={scores}
          loading={loading}
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          setPage={setPage}
          fetchUserDetail={fetchUserDetail}
        />
      )}

      {/* Distribution Tab */}
      {tab === 'distribution' && distribution && (
        <DistributionTab distribution={distribution} maxHistCount={maxHistCount} />
      )}

      {/* Auto Actions Tab */}
      {tab === 'actions' && <ActionsTab api={API} />}

      {/* User Detail Modal */}
      {selectedUser && (
        <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
}

// ─── Ranking Tab ───

function RankingTab({
  scores, loading, page, totalPages, totalCount, setPage, fetchUserDetail,
}: {
  scores: ScoreEntry[];
  loading: boolean;
  page: number;
  totalPages: number;
  totalCount: number;
  setPage: (p: number) => void;
  fetchUserDetail: (id: string) => void;
}) {
  if (loading) return <div className="text-center py-12 text-gray-400">読み込み中...</div>;
  if (scores.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-gray-500">スコアデータがありません</p>
        <p className="text-sm text-gray-400 mt-1">「スコア再計算」ボタンで計算を実行してください</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-12">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">ユーザー</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-16">ランク</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-20">総合</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-20 hidden md:table-cell">メッセージ</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-20 hidden md:table-cell">反応</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-20 hidden md:table-cell">CV</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-20 hidden md:table-cell">継続</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-gray-400 w-20 hidden lg:table-cell">タグ</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s, i) => {
                const colors = RANK_COLORS[s.rank] || RANK_COLORS.D;
                const position = (page - 1) * 30 + i + 1;
                return (
                  <tr
                    key={s.id}
                    className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 dark:border-gray-700 cursor-pointer"
                    onClick={() => fetchUserDetail(s.user_id)}
                  >
                    <td className="px-4 py-3 text-gray-400 font-mono">{position}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {s.picture_url ? (
                          <img src={s.picture_url} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-xs">
                            {(s.display_name || '?')[0]}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{s.display_name || '不明'}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[120px]">{s.user_id.slice(0, 12)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-sm ${colors.bg} ${colors.text} ${colors.darkBg} ${colors.darkText} border ${colors.border}`}>
                        {s.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-gray-900 dark:text-white">{s.total_score}</span>
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
                    <td className="px-4 py-3 text-center hidden lg:table-cell text-gray-500 dark:text-gray-400">{s.tag_count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">{totalCount}件中 {(page - 1) * 30 + 1}-{Math.min(page * 30, totalCount)}件</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1 border dark:border-gray-600 rounded text-sm disabled:opacity-30 dark:text-gray-300">前へ</button>
            <span className="px-3 py-1 text-sm text-gray-500 dark:text-gray-400">{page} / {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="px-3 py-1 border dark:border-gray-600 rounded text-sm disabled:opacity-30 dark:text-gray-300">次へ</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Distribution Tab ───

function DistributionTab({ distribution, maxHistCount }: { distribution: Distribution; maxHistCount: number }) {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">カテゴリ別平均スコア</h3>
        <div className="space-y-3">
          {[
            { label: 'メッセージ頻度', value: distribution.stats.avg_message, color: 'bg-blue-500' },
            { label: '配信反応', value: distribution.stats.avg_engagement, color: 'bg-green-500' },
            { label: 'コンバージョン', value: distribution.stats.avg_conversion, color: 'bg-purple-500' },
            { label: '継続利用', value: distribution.stats.avg_retention, color: 'bg-orange-500' },
          ].map((cat) => (
            <div key={cat.label} className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-300 w-28 shrink-0">{cat.label}</span>
              <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className={`h-full ${cat.color} rounded-full transition-all duration-500`} style={{ width: `${cat.value || 0}%` }} />
              </div>
              <span className="text-sm font-bold text-gray-700 dark:text-gray-200 w-12 text-right">{cat.value || 0}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">スコア分布ヒストグラム</h3>
        <div className="space-y-2">
          {distribution.histogram.map((h) => (
            <div key={h.bucket} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-right font-mono">{h.bucket}</span>
              <div className="flex-1 h-7 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                <div className="h-full bg-indigo-400 rounded transition-all duration-500" style={{ width: `${(h.count / maxHistCount) * 100}%` }} />
              </div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300 w-8 text-right">{h.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">スコアリング基準</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
              <div>
                <span className="font-medium dark:text-gray-200">メッセージ頻度 (25%)</span>
                <p className="text-gray-500 dark:text-gray-400 text-xs">直近30日のメッセージ送信数</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
              <div>
                <span className="font-medium dark:text-gray-200">配信反応 (25%)</span>
                <p className="text-gray-500 dark:text-gray-400 text-xs">配信に対するレスポンス率</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />
              <div>
                <span className="font-medium dark:text-gray-200">コンバージョン (25%)</span>
                <p className="text-gray-500 dark:text-gray-400 text-xs">直近30日のCV達成件数</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0" />
              <div>
                <span className="font-medium dark:text-gray-200">継続利用 (25%)</span>
                <p className="text-gray-500 dark:text-gray-400 text-xs">最終アクティビティからの経過日数</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t dark:border-gray-700">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">ランク基準</h4>
          <div className="flex flex-wrap gap-3">
            {Object.entries(RANK_LABELS).map(([r, label]) => {
              const colors = RANK_COLORS[r];
              const ranges: Record<string, string> = { S: '80-100', A: '60-79', B: '40-59', C: '20-39', D: '0-19' };
              return (
                <div key={r} className={`flex items-center gap-2 px-3 py-1 rounded-lg border ${colors.bg} ${colors.border} ${colors.darkBg}`}>
                  <span className={`font-black ${colors.text} ${colors.darkText}`}>{r}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-300">{label} ({ranges[r]})</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Actions Tab ───

function ActionsTab({ api }: { api: string }) {
  const [rules, setRules] = useState<AutoActionRule[]>([]);
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [subTab, setSubTab] = useState<'rules' | 'logs'>('rules');
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoActionRule | null>(null);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${api}/api/score-actions`);
      const json = await res.json();
      if (json.success) setRules(json.data);
    } catch {}
  }, [api]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${api}/api/score-actions/logs?page=${logsPage}&limit=30`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
        setLogsTotalPages(json.pagination.totalPages);
      }
    } catch {}
  }, [api, logsPage]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${api}/api/score-actions/stats`);
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch {}
  }, [api]);

  const fetchTagsAndScenarios = useCallback(async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        fetchWithAuth(`${api}/api/tags`),
        fetchWithAuth(`${api}/api/scenarios`),
      ]);
      const tJson = await tRes.json();
      const sJson = await sRes.json();
      if (tJson.success) setTags(tJson.data);
      if (sJson.success) setScenarios(sJson.data || []);
    } catch {}
  }, [api]);

  useEffect(() => { fetchRules(); fetchStats(); fetchTagsAndScenarios(); }, [fetchRules, fetchStats, fetchTagsAndScenarios]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const toggleRule = async (id: string) => {
    try {
      await fetchWithAuth(`${api}/api/score-actions/${id}/toggle`, { method: 'PUT' });
      fetchRules();
    } catch {}
  };

  const deleteRule = async (id: string) => {
    if (!confirm('このルールを削除しますか？')) return;
    try {
      await fetchWithAuth(`${api}/api/score-actions/${id}`, { method: 'DELETE' });
      fetchRules();
      fetchStats();
    } catch {}
  };

  const openEdit = (rule: AutoActionRule) => {
    setEditingRule(rule);
    setShowModal(true);
  };

  const openCreate = () => {
    setEditingRule(null);
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">ルール数</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.total_rules}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">有効ルール</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.active_rules}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">累計実行</p>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{stats.total_executions}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">直近7日</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{stats.recent_executions_7d}</p>
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setSubTab('rules')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              subTab === 'rules' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400'
            }`}
          >
            ルール管理
          </button>
          <button
            onClick={() => setSubTab('logs')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              subTab === 'logs' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400'
            }`}
          >
            実行ログ
          </button>
        </div>
        {subTab === 'rules' && (
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            ルール作成
          </button>
        )}
      </div>

      {/* Rules list */}
      {subTab === 'rules' && (
        <div className="space-y-3">
          {rules.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700">
              <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">自動アクションルールがありません</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">ランク変動時に自動でタグ付与やシナリオ発火を行うルールを作成できます</p>
            </div>
          ) : (
            rules.map((rule) => {
              const triggerConfig = JSON.parse(rule.trigger_config || '{}');
              const actions = JSON.parse(rule.actions || '[]');
              return (
                <div key={rule.id} className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 dark:text-white truncate">{rule.name}</h4>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          rule.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {rule.is_active ? '有効' : '無効'}
                        </span>
                      </div>
                      {rule.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{rule.description}</p>}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                          {TRIGGER_LABELS[rule.trigger_type] || rule.trigger_type}
                          {triggerConfig.from_rank && ` (${triggerConfig.from_rank}→`}
                          {triggerConfig.to_rank && `${triggerConfig.from_rank ? '' : '→'}${triggerConfig.to_rank})`}
                          {triggerConfig.rank && ` = ${triggerConfig.rank}`}
                          {triggerConfig.threshold !== undefined && ` ${triggerConfig.threshold}点`}
                        </span>
                        {actions.map((a: any, i: number) => (
                          <span key={i} className="px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">
                            {ACTION_LABELS[a.type] || a.type}
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
                        <span>実行: {rule.execution_count}回</span>
                        {rule.last_executed_at && <span>最終: {new Date(rule.last_executed_at).toLocaleString('ja-JP')}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => toggleRule(rule.id)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" title={rule.is_active ? '無効化' : '有効化'}>
                        {rule.is_active ? (
                          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M17 7H7a5 5 0 000 10h10a5 5 0 000-10zm0 8a3 3 0 110-6 3 3 0 010 6z" /></svg>
                        ) : (
                          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M17 7H7a5 5 0 000 10h10a5 5 0 000-10zM7 15a3 3 0 110-6 3 3 0 010 6z" /></svg>
                        )}
                      </button>
                      <button onClick={() => openEdit(rule)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => deleteRule(rule.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Logs list */}
      {subTab === 'logs' && (
        <div className="space-y-4">
          {logs.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400">実行ログがありません</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">日時</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">ルール</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">ユーザー</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-gray-400">ランク変動</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-gray-400">スコア</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">アクション</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500 dark:text-gray-400">結果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const executedActions = JSON.parse(log.executed_actions || '[]');
                      return (
                        <tr key={log.id} className="border-b last:border-0 dark:border-gray-700">
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('ja-JP')}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{log.action_name}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {log.picture_url ? (
                                <img src={log.picture_url} alt="" className="w-6 h-6 rounded-full" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-xs">
                                  {(log.display_name || log.user_name || '?')[0]}
                                </div>
                              )}
                              <span className="text-gray-700 dark:text-gray-300 text-sm">{log.display_name || log.user_name || log.user_id.slice(0, 10)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <RankBadge rank={log.previous_rank} />
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                              <RankBadge rank={log.new_rank} />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                            {log.previous_score} → {log.new_score}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {executedActions.map((a: any, i: number) => (
                                <span key={i} className={`px-1.5 py-0.5 rounded text-xs ${
                                  a.status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                                }`}>
                                  {ACTION_LABELS[a.type] || a.type}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              log.status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                            }`}>
                              {log.status === 'success' ? '成功' : '一部失敗'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {logsTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setLogsPage(Math.max(1, logsPage - 1))} disabled={logsPage <= 1} className="px-3 py-1 border dark:border-gray-600 rounded text-sm disabled:opacity-30 dark:text-gray-300">前へ</button>
              <span className="text-sm text-gray-500 dark:text-gray-400">{logsPage} / {logsTotalPages}</span>
              <button onClick={() => setLogsPage(Math.min(logsTotalPages, logsPage + 1))} disabled={logsPage >= logsTotalPages} className="px-3 py-1 border dark:border-gray-600 rounded text-sm disabled:opacity-30 dark:text-gray-300">次へ</button>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <RuleModal
          api={api}
          editingRule={editingRule}
          tags={tags}
          scenarios={scenarios}
          onClose={() => { setShowModal(false); setEditingRule(null); }}
          onSaved={() => { setShowModal(false); setEditingRule(null); fetchRules(); fetchStats(); }}
        />
      )}
    </div>
  );
}

// ─── Rule Modal ───

function RuleModal({
  api, editingRule, tags, scenarios, onClose, onSaved,
}: {
  api: string;
  editingRule: AutoActionRule | null;
  tags: TagItem[];
  scenarios: ScenarioItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const existingConfig = editingRule ? JSON.parse(editingRule.trigger_config || '{}') : {};
  const existingActions = editingRule ? JSON.parse(editingRule.actions || '[]') : [];

  const [name, setName] = useState(editingRule?.name || '');
  const [description, setDescription] = useState(editingRule?.description || '');
  const [triggerType, setTriggerType] = useState(editingRule?.trigger_type || 'rank_up');
  const [fromRank, setFromRank] = useState(existingConfig.from_rank || '');
  const [toRank, setToRank] = useState(existingConfig.to_rank || '');
  const [targetRank, setTargetRank] = useState(existingConfig.rank || 'D');
  const [threshold, setThreshold] = useState(existingConfig.threshold || 50);
  const [actions, setActions] = useState<any[]>(existingActions.length ? existingActions : [{ type: 'tag_add', tag_id: '', scenario_id: '', title: '', body: '' }]);
  const [saving, setSaving] = useState(false);

  const buildTriggerConfig = () => {
    switch (triggerType) {
      case 'rank_up':
      case 'rank_down':
        return { ...(fromRank ? { from_rank: fromRank } : {}), ...(toRank ? { to_rank: toRank } : {}) };
      case 'rank_is':
      case 'rank_entered':
        return { rank: targetRank };
      case 'score_above':
      case 'score_below':
        return { threshold: Number(threshold) };
      default:
        return {};
    }
  };

  const addAction = () => {
    setActions([...actions, { type: 'tag_add', tag_id: '', scenario_id: '', title: '', body: '' }]);
  };

  const removeAction = (idx: number) => {
    setActions(actions.filter((_, i) => i !== idx));
  };

  const updateAction = (idx: number, field: string, value: string) => {
    setActions(actions.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const handleSave = async () => {
    if (!name.trim()) return alert('ルール名を入力してください');
    if (actions.length === 0) return alert('アクションを1つ以上追加してください');

    setSaving(true);
    try {
      const payload = {
        name,
        description: description || undefined,
        trigger_type: triggerType,
        trigger_config: buildTriggerConfig(),
        actions: actions.map(a => {
          const clean: any = { type: a.type };
          if (a.type === 'tag_add' || a.type === 'tag_remove') clean.tag_id = a.tag_id;
          if (a.type === 'scenario_execute') clean.scenario_id = a.scenario_id;
          if (a.type === 'notification') { clean.title = a.title; clean.body = a.body; }
          return clean;
        }),
      };

      const url = editingRule ? `${api}/api/score-actions/${editingRule.id}` : `${api}/api/score-actions`;
      const method = editingRule ? 'PUT' : 'POST';

      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) onSaved();
      else alert(json.error || '保存に失敗しました');
    } catch {
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {editingRule ? 'ルール編集' : 'ルール作成'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ルール名 *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
              placeholder="例: 休眠ユーザー自動タグ付与"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">説明</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
              placeholder="ルールの説明（任意）"
            />
          </div>

          {/* Trigger Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">トリガー条件 *</label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value)}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
            >
              <option value="rank_up">ランクUP（ランクが上昇した時）</option>
              <option value="rank_down">ランクDOWN（ランクが下降した時）</option>
              <option value="rank_is">ランク一致（現在のランクが指定値の時）</option>
              <option value="rank_entered">ランク移行（指定ランクに新たに入った時）</option>
              <option value="score_above">スコア以上（閾値を超えた時）</option>
              <option value="score_below">スコア以下（閾値を下回った時）</option>
            </select>
          </div>

          {/* Trigger Config */}
          {(triggerType === 'rank_up' || triggerType === 'rank_down') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">変動元ランク（任意）</label>
                <select value={fromRank} onChange={(e) => setFromRank(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white">
                  <option value="">指定なし</option>
                  {['S','A','B','C','D'].map(r => <option key={r} value={r}>{r} ({RANK_LABELS[r]})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">変動先ランク（任意）</label>
                <select value={toRank} onChange={(e) => setToRank(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white">
                  <option value="">指定なし</option>
                  {['S','A','B','C','D'].map(r => <option key={r} value={r}>{r} ({RANK_LABELS[r]})</option>)}
                </select>
              </div>
            </div>
          )}

          {(triggerType === 'rank_is' || triggerType === 'rank_entered') && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">対象ランク</label>
              <select value={targetRank} onChange={(e) => setTargetRank(e.target.value)} className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white">
                {['S','A','B','C','D'].map(r => <option key={r} value={r}>{r} ({RANK_LABELS[r]})</option>)}
              </select>
            </div>
          )}

          {(triggerType === 'score_above' || triggerType === 'score_below') && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">スコア閾値</label>
              <input
                type="number"
                min={0}
                max={100}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
              />
            </div>
          )}

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">実行アクション *</label>
              <button onClick={addAction} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">+ 追加</button>
            </div>
            <div className="space-y-3">
              {actions.map((action, idx) => (
                <div key={idx} className="border dark:border-gray-600 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={action.type}
                      onChange={(e) => updateAction(idx, 'type', e.target.value)}
                      className="flex-1 px-3 py-1.5 border dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-white"
                    >
                      <option value="tag_add">タグ付与</option>
                      <option value="tag_remove">タグ除去</option>
                      <option value="scenario_execute">シナリオ発火</option>
                      <option value="notification">通知送信</option>
                    </select>
                    {actions.length > 1 && (
                      <button onClick={() => removeAction(idx)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded">
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>

                  {(action.type === 'tag_add' || action.type === 'tag_remove') && (
                    <select
                      value={action.tag_id || ''}
                      onChange={(e) => updateAction(idx, 'tag_id', e.target.value)}
                      className="w-full px-3 py-1.5 border dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">タグを選択...</option>
                      {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  )}

                  {action.type === 'scenario_execute' && (
                    <select
                      value={action.scenario_id || ''}
                      onChange={(e) => updateAction(idx, 'scenario_id', e.target.value)}
                      className="w-full px-3 py-1.5 border dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-white"
                    >
                      <option value="">シナリオを選択...</option>
                      {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}

                  {action.type === 'notification' && (
                    <div className="space-y-2">
                      <input
                        value={action.title || ''}
                        onChange={(e) => updateAction(idx, 'title', e.target.value)}
                        className="w-full px-3 py-1.5 border dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-white"
                        placeholder="通知タイトル"
                      />
                      <input
                        value={action.body || ''}
                        onChange={(e) => updateAction(idx, 'body', e.target.value)}
                        className="w-full px-3 py-1.5 border dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-white"
                        placeholder="通知本文（{name} {prev} {new} {score} が使えます）"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t dark:border-gray-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">キャンセル</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? '保存中...' : editingRule ? '更新' : '作成'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Components ───

function RankBadge({ rank }: { rank: string }) {
  const colors = RANK_COLORS[rank] || RANK_COLORS.D;
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-black ${colors.bg} ${colors.text} ${colors.darkBg} ${colors.darkText}`}>
      {rank}
    </span>
  );
}

function UserDetailModal({ user, onClose }: { user: UserDetail; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user.picture_url ? (
              <img src={user.picture_url} alt="" className="w-12 h-12 rounded-full" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                {(user.display_name || '?')[0]}
              </div>
            )}
            <div>
              <p className="font-bold text-gray-900 dark:text-white">{user.display_name || '不明'}</p>
              <p className="text-xs text-gray-400">登録: {user.user_since ? new Date(user.user_since).toLocaleDateString('ja-JP') : '-'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black border-2 ${RANK_COLORS[user.rank]?.bg} ${RANK_COLORS[user.rank]?.text} ${RANK_COLORS[user.rank]?.border} ${RANK_COLORS[user.rank]?.darkBg} ${RANK_COLORS[user.rank]?.darkText}`}>
                {user.rank}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{RANK_LABELS[user.rank]}</p>
            </div>
            <div className="flex-1">
              <p className="text-4xl font-black text-gray-900 dark:text-white">{user.total_score}<span className="text-base font-normal text-gray-400">/100</span></p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {user.ranking.position}位 / {user.ranking.total}人中
                <span className="ml-2 text-indigo-600 dark:text-indigo-400 font-medium">上位{100 - user.ranking.percentile}%</span>
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">カテゴリ別スコア</h4>
            {[
              { label: 'メッセージ頻度', value: user.message_score, color: 'bg-blue-500' },
              { label: '配信反応', value: user.engagement_score, color: 'bg-green-500' },
              { label: 'コンバージョン', value: user.conversion_score, color: 'bg-purple-500' },
              { label: '継続利用', value: user.retention_score, color: 'bg-orange-500' },
            ].map((cat) => (
              <div key={cat.label} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-gray-300 w-24 shrink-0">{cat.label}</span>
                <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full ${cat.color} rounded-full`} style={{ width: `${cat.value}%` }} />
                </div>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-200 w-8 text-right">{cat.value}</span>
              </div>
            ))}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">直近30日のアクティビティ</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{user.activity.messages_30d}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">メッセージ</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-green-700 dark:text-green-300">{user.activity.deliveries_sent_30d}</p>
                <p className="text-xs text-green-600 dark:text-green-400">配信受信</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{user.activity.conversions_30d}</p>
                <p className="text-xs text-purple-600 dark:text-purple-400">コンバージョン</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-gray-700 dark:text-gray-200">{user.tags.length}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">タグ数</p>
              </div>
            </div>
          </div>

          {user.tags.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">タグ</h4>
              <div className="flex flex-wrap gap-2">
                {user.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded text-xs">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 w-6 text-right">{value}</span>
    </div>
  );
}
