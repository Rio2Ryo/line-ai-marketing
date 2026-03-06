'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface Overview {
  total_conversations: number;
  satisfaction_score: number;
  escalation_rate: number;
  avg_confidence: number;
  avg_response_ms: number;
  knowledge_hit_rate: number;
  resolution_rate: number;
  escalated_count: number;
  resolved_count: number;
}

interface TrendItem {
  date: string;
  total: number;
  avg_confidence: number;
  escalations: number;
  satisfaction: number;
}

interface FaqItem {
  rank: number;
  question: string;
  count: number;
  avg_confidence: number;
  escalation_rate: number;
  sample_reply: string;
  has_knowledge: boolean;
}

interface KnowledgeGap {
  topic: string;
  count: number;
  avg_confidence: number;
  sample_questions: string[];
  has_knowledge: boolean;
  suggestion: string;
}

interface Quality {
  confidence_distribution: { high: number; medium: number; low: number };
  response_time_distribution: { fast: number; normal: number; slow: number; very_slow: number };
  hourly_distribution: Array<{ hour: number; count: number; avg_confidence: number }>;
  top_users: Array<{ id: string; display_name: string; picture_url: string; chat_count: number; avg_confidence: number; escalations: number }>;
}

interface AiSuggestion {
  title: string;
  description: string;
  priority: string;
  action: string;
}

type Tab = 'overview' | 'faq' | 'gaps' | 'quality';

export default function ChatAnalyticsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [faq, setFaq] = useState<FaqItem[]>([]);
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [kbStats, setKbStats] = useState<any>(null);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const base = getApiUrl() + '/api/chat-analytics';
      const [ovRes, trRes] = await Promise.all([
        fetchWithAuth(`${base}/overview?days=${days}`),
        fetchWithAuth(`${base}/satisfaction-trend?days=${days}`),
      ]);
      if (ovRes.ok) { const d = await ovRes.json(); setOverview(d.data); }
      if (trRes.ok) { const d = await trRes.json(); setTrend(d.data || []); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [days]);

  const fetchFaq = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${getApiUrl()}/api/chat-analytics/faq?days=${days}`);
      if (res.ok) { const d = await res.json(); setFaq(d.data || []); }
    } catch (e) { console.error(e); }
  }, [days]);

  const fetchGaps = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${getApiUrl()}/api/chat-analytics/knowledge-gaps?days=${days}`);
      if (res.ok) { const d = await res.json(); setGaps(d.data?.gaps || []); setKbStats(d.data?.knowledge_stats || null); }
    } catch (e) { console.error(e); }
  }, [days]);

  const fetchQuality = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${getApiUrl()}/api/chat-analytics/quality?days=${days}`);
      if (res.ok) { const d = await res.json(); setQuality(d.data); }
    } catch (e) { console.error(e); }
  }, [days]);

  const fetchAiSuggestions = async () => {
    setAiLoading(true);
    try {
      const res = await fetchWithAuth(`${getApiUrl()}/api/chat-analytics/ai-suggest?days=${days}`, { method: 'POST' });
      if (res.ok) { const d = await res.json(); setSuggestions(d.data?.suggestions || []); }
    } catch (e) { console.error(e); }
    setAiLoading(false);
  };

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (tab === 'faq') fetchFaq();
    else if (tab === 'gaps') fetchGaps();
    else if (tab === 'quality') fetchQuality();
  }, [tab, fetchFaq, fetchGaps, fetchQuality]);

  const scoreColor = (score: number) => score >= 70 ? 'text-green-600 dark:text-green-400' : score >= 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';
  const scoreBg = (score: number) => score >= 70 ? 'bg-green-100 dark:bg-green-900/30' : score >= 40 ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-red-100 dark:bg-red-900/30';

  const maxTrend = Math.max(...trend.map(t => t.total), 1);
  const maxHourly = quality ? Math.max(...quality.hourly_distribution.map(h => h.count), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-700 flex-1">
          {([
            ['overview', '概要'],
            ['faq', 'FAQ抽出'],
            ['gaps', 'ナレッジ改善'],
            ['quality', '品質詳細'],
          ] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
              {label}
            </button>
          ))}
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
          <option value={7}>7日間</option>
          <option value={30}>30日間</option>
          <option value={90}>90日間</option>
        </select>
      </div>

      {tab === 'overview' && <OverviewTab overview={overview} trend={trend} loading={loading} maxTrend={maxTrend} scoreColor={scoreColor} scoreBg={scoreBg}
        suggestions={suggestions} aiLoading={aiLoading} onAiSuggest={fetchAiSuggestions} />}
      {tab === 'faq' && <FaqTab faq={faq} scoreColor={scoreColor} />}
      {tab === 'gaps' && <GapsTab gaps={gaps} kbStats={kbStats} />}
      {tab === 'quality' && <QualityTab quality={quality} maxHourly={maxHourly} />}
    </div>
  );
}

// ─── Overview Tab ───

function OverviewTab({ overview, trend, loading, maxTrend, scoreColor, scoreBg, suggestions, aiLoading, onAiSuggest }: {
  overview: Overview | null; trend: TrendItem[]; loading: boolean; maxTrend: number;
  scoreColor: (s: number) => string; scoreBg: (s: number) => string;
  suggestions: AiSuggestion[]; aiLoading: boolean; onAiSuggest: () => void;
}) {
  if (loading || !overview) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="animate-pulse bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-3" />
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  const kpis = [
    { label: '満足度スコア', value: `${overview.satisfaction_score}`, unit: '/100', color: scoreColor(overview.satisfaction_score), bg: scoreBg(overview.satisfaction_score) },
    { label: '総会話数', value: overview.total_conversations.toLocaleString(), unit: '件', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { label: '平均信頼度', value: `${Math.round(overview.avg_confidence * 100)}`, unit: '%', color: scoreColor(overview.avg_confidence * 100), bg: scoreBg(overview.avg_confidence * 100) },
    { label: 'エスカレーション率', value: `${overview.escalation_rate}`, unit: '%', color: overview.escalation_rate > 20 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400', bg: overview.escalation_rate > 20 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30' },
    { label: '平均応答時間', value: overview.avg_response_ms > 1000 ? `${(overview.avg_response_ms / 1000).toFixed(1)}` : `${overview.avg_response_ms}`, unit: overview.avg_response_ms > 1000 ? '秒' : 'ms', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    { label: 'KB ヒット率', value: `${overview.knowledge_hit_rate}`, unit: '%', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
    { label: '解決率', value: `${overview.resolution_rate}`, unit: '%', color: scoreColor(overview.resolution_rate), bg: scoreBg(overview.resolution_rate) },
    { label: 'エスカレ / 解決', value: `${overview.escalated_count} / ${overview.resolved_count}`, unit: '件', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700' },
  ];

  return (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{kpi.label}</p>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</span>
              <span className="text-sm text-gray-400">{kpi.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Satisfaction Trend Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
        <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4">満足度推移</h3>
        {trend.length > 0 ? (
          <div className="space-y-1">
            <div className="flex items-end gap-1 h-40">
              {trend.map((t, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${t.date}: ${t.total}会話, 満足度${t.satisfaction}`}>
                  <span className="text-[10px] text-gray-400">{t.satisfaction}</span>
                  <div className="w-full flex flex-col gap-0.5">
                    <div className="w-full rounded-t" style={{
                      height: `${Math.max((t.total / maxTrend) * 100, 4)}px`,
                      backgroundColor: t.satisfaction >= 70 ? '#22c55e' : t.satisfaction >= 40 ? '#eab308' : '#ef4444',
                      opacity: 0.7,
                    }} />
                    {t.escalations > 0 && (
                      <div className="w-full bg-red-400 rounded-b" style={{ height: `${Math.max((t.escalations / maxTrend) * 100, 2)}px` }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>{trend[0]?.date?.substring(5)}</span>
              <span>{trend[Math.floor(trend.length / 2)]?.date?.substring(5)}</span>
              <span>{trend[trend.length - 1]?.date?.substring(5)}</span>
            </div>
            <div className="flex gap-4 mt-2">
              <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-3 h-3 rounded bg-green-500 opacity-70" />高満足度</span>
              <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-3 h-3 rounded bg-yellow-500 opacity-70" />中</span>
              <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-3 h-3 rounded bg-red-400" />エスカレーション</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">データなし</p>
        )}
      </div>

      {/* AI Suggestions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 dark:text-gray-100">AI改善提案</h3>
          <button onClick={onAiSuggest} disabled={aiLoading}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {aiLoading ? '分析中...' : 'AIに分析を依頼'}
          </button>
        </div>
        {suggestions.length > 0 ? (
          <div className="space-y-3">
            {suggestions.map((s, i) => (
              <div key={i} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    s.priority === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                    s.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                    'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  }`}>{s.priority === 'high' ? '高' : s.priority === 'medium' ? '中' : '低'}</span>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">{s.title}</h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{s.description}</p>
                <p className="text-xs text-[var(--accent)]">{s.action}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">「AIに分析を依頼」ボタンでClaudeが会話データを分析し、改善提案を生成します</p>
        )}
      </div>
    </>
  );
}

// ─── FAQ Tab ───

function FaqTab({ faq, scoreColor }: { faq: FaqItem[]; scoreColor: (s: number) => string }) {
  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
        <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">よくある質問 (自動抽出)</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">ユーザーからの頻出質問を自動検出。信頼度が低い質問はナレッジベースの強化が必要です。</p>
        {faq.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 pr-4 font-medium">#</th>
                  <th className="pb-2 pr-4 font-medium">質問</th>
                  <th className="pb-2 pr-4 font-medium text-center">回数</th>
                  <th className="pb-2 pr-4 font-medium text-center">信頼度</th>
                  <th className="pb-2 pr-4 font-medium text-center">エスカレ率</th>
                  <th className="pb-2 font-medium text-center">KB</th>
                </tr>
              </thead>
              <tbody>
                {faq.map(f => (
                  <tr key={f.rank} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-3 pr-4 text-gray-400">{f.rank}</td>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs">{f.question}</p>
                      {f.sample_reply && <p className="text-xs text-gray-400 truncate max-w-xs mt-0.5">{f.sample_reply}</p>}
                    </td>
                    <td className="py-3 pr-4 text-center font-medium">{f.count}</td>
                    <td className={`py-3 pr-4 text-center font-medium ${scoreColor(f.avg_confidence * 100)}`}>
                      {Math.round(f.avg_confidence * 100)}%
                    </td>
                    <td className={`py-3 pr-4 text-center ${f.escalation_rate > 30 ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}>
                      {f.escalation_rate}%
                    </td>
                    <td className="py-3 text-center">
                      {f.has_knowledge ? (
                        <span className="text-green-500" title="KB記事あり">&#10003;</span>
                      ) : (
                        <span className="text-red-400" title="KB記事なし">&#10007;</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">FAQ データなし (会話データが蓄積されると自動抽出されます)</p>
        )}
      </div>
    </>
  );
}

// ─── Knowledge Gaps Tab ───

function GapsTab({ gaps, kbStats }: { gaps: KnowledgeGap[]; kbStats: any }) {
  return (
    <>
      {/* KB Stats */}
      {kbStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">登録記事数</p>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{kbStats.total_articles}</span>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">利用中記事</p>
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">{kbStats.used_articles}</span>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">未使用記事</p>
            <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{kbStats.unused_articles}</span>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">カバレッジ率</p>
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{kbStats.coverage_rate}%</span>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
        <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">ナレッジベース改善提案</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">AI応答の信頼度が低いトピックを検出。ナレッジベースに不足している情報を特定します。</p>
        {gaps.length > 0 ? (
          <div className="space-y-3">
            {gaps.map((g, i) => (
              <div key={i} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">{g.topic}</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium">
                        信頼度 {Math.round(g.avg_confidence * 100)}%
                      </span>
                      <span className="text-xs text-gray-400">{g.count}回</span>
                    </div>
                    <div className="mb-2">
                      {g.sample_questions.map((q, j) => (
                        <p key={j} className="text-xs text-gray-500 dark:text-gray-400">「{q}」</p>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      {g.has_knowledge ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">KB記事あり (内容改善必要)</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">KB記事なし (新規追加推奨)</span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-[var(--accent)] mt-2">{g.suggestion}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">ナレッジギャップなし (低信頼度の会話が検出されると表示されます)</p>
        )}
      </div>
    </>
  );
}

// ─── Quality Tab ───

function QualityTab({ quality, maxHourly }: { quality: Quality | null; maxHourly: number }) {
  if (!quality) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
            <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const confTotal = quality.confidence_distribution.high + quality.confidence_distribution.medium + quality.confidence_distribution.low;
  const timeTotal = quality.response_time_distribution.fast + quality.response_time_distribution.normal + quality.response_time_distribution.slow + quality.response_time_distribution.very_slow;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Confidence Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
        <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4">信頼度分布</h3>
        <div className="space-y-3">
          {[
            { label: '高 (≧80%)', count: quality.confidence_distribution.high, color: 'bg-green-500' },
            { label: '中 (50-79%)', count: quality.confidence_distribution.medium, color: 'bg-yellow-500' },
            { label: '低 (<50%)', count: quality.confidence_distribution.low, color: 'bg-red-500' },
          ].map(item => (
            <div key={item.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{item.count} ({confTotal > 0 ? Math.round((item.count / confTotal) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div className={`${item.color} rounded-full h-3 transition-all`} style={{ width: `${confTotal > 0 ? (item.count / confTotal) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Response Time Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
        <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4">応答速度分布</h3>
        <div className="space-y-3">
          {[
            { label: '高速 (<1秒)', count: quality.response_time_distribution.fast, color: 'bg-green-500' },
            { label: '通常 (1-3秒)', count: quality.response_time_distribution.normal, color: 'bg-blue-500' },
            { label: '遅い (3-5秒)', count: quality.response_time_distribution.slow, color: 'bg-yellow-500' },
            { label: '非常に遅い (>5秒)', count: quality.response_time_distribution.very_slow, color: 'bg-red-500' },
          ].map(item => (
            <div key={item.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{item.count} ({timeTotal > 0 ? Math.round((item.count / timeTotal) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div className={`${item.color} rounded-full h-3 transition-all`} style={{ width: `${timeTotal > 0 ? (item.count / timeTotal) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hourly Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
        <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4">時間帯別会話数</h3>
        <div className="flex items-end gap-0.5 h-32">
          {Array.from({ length: 24 }, (_, h) => {
            const item = quality.hourly_distribution.find(d => d.hour === h);
            const count = item?.count || 0;
            return (
              <div key={h} className="flex-1 flex flex-col items-center" title={`${h}時: ${count}件`}>
                <div className="w-full bg-[var(--accent)] rounded-t opacity-70" style={{ height: `${maxHourly > 0 ? Math.max((count / maxHourly) * 100, count > 0 ? 4 : 0) : 0}%` }} />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>0</span><span>6</span><span>12</span><span>18</span><span>23</span>
        </div>
      </div>

      {/* Top Users */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
        <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4">会話数トップユーザー</h3>
        {quality.top_users.length > 0 ? (
          <div className="space-y-2">
            {quality.top_users.map((u, i) => (
              <div key={u.id} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                {u.picture_url ? (
                  <img src={u.picture_url} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-400">?</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{u.display_name || 'Unknown'}</p>
                  <p className="text-xs text-gray-400">{u.chat_count}会話 / 信頼度{Math.round(u.avg_confidence * 100)}%</p>
                </div>
                {u.escalations > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    {u.escalations}エスカレ
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">データなし</p>
        )}
      </div>
    </div>
  );
}
