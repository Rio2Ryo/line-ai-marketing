'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface HourlyData {
  hour: number;
  total: number;
  sent: number;
  failed: number;
  success_rate: number;
  responses: number;
  engagement_score: number;
}

interface WeeklyData {
  dow: number;
  dow_name: string;
  total: number;
  sent: number;
  success_rate: number;
  responses: number;
  engagement_score: number;
}

interface LengthBucket {
  label: string;
  count: number;
  replied: number;
  reply_rate: number;
}

interface Recommendation {
  timing_recommendation?: {
    best_hours: number[];
    best_days: string[];
    reasoning: string;
  };
  tone_recommendation?: {
    current_tone: string;
    suggested_tone: string;
    examples: string[];
    reasoning: string;
  };
  content_recommendations?: Array<{
    title: string;
    description: string;
    impact: string;
    category: string;
  }>;
  overall_score?: number;
  summary?: string;
}

const dowNames = ['日', '月', '火', '水', '木', '金', '土'];

const impactColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
};

const categoryLabels: Record<string, string> = {
  timing: '配信タイミング',
  content: 'コンテンツ',
  frequency: '配信頻度',
  targeting: 'ターゲティング',
};

const categoryIcons: Record<string, string> = {
  timing: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  content: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  frequency: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  targeting: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
};

export default function AiOptimizePage() {
  const [hourly, setHourly] = useState<HourlyData[]>([]);
  const [weekly, setWeekly] = useState<WeeklyData[]>([]);
  const [bestHour, setBestHour] = useState(12);
  const [bestDow, setBestDow] = useState('');
  const [lengthAnalysis, setLengthAnalysis] = useState<LengthBucket[]>([]);
  const [messageStats, setMessageStats] = useState({ total_analyzed: 0, reply_rate: 0, avg_length: 0 });
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recStats, setRecStats] = useState({ total_deliveries: 0, success_rate: 0, response_rate: 0, avg_message_length: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [target, setTarget] = useState('');
  const [days, setDays] = useState(30);

  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const [timingRes, patternRes] = await Promise.all([
        fetchWithAuth(`${getApiUrl()}/api/ai-optimize/timing?days=${days}`),
        fetchWithAuth(`${getApiUrl()}/api/ai-optimize/message-patterns?days=${days}`),
      ]);
      const [tData, pData] = await Promise.all([timingRes.json(), patternRes.json()]);

      if (tData.success) {
        setHourly(tData.data.hourly);
        setWeekly(tData.data.weekly);
        setBestHour(tData.data.best_hour);
        setBestDow(tData.data.best_dow_name);
      }
      if (pData.success) {
        setLengthAnalysis(pData.data.length_analysis);
        setMessageStats({ total_analyzed: pData.data.total_analyzed, reply_rate: pData.data.reply_rate, avg_length: pData.data.avg_length });
      }
    } catch {}
    setLoading(false);
  }, [days]);

  useEffect(() => { loadAnalysis(); }, [loadAnalysis]);

  const generateRecommendation = async () => {
    setGenerating(true);
    try {
      const res = await fetchWithAuth(`${getApiUrl()}/api/ai-optimize/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: purpose || undefined, target_audience: target || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setRecommendation(data.data.recommendation);
        setRecStats(data.data.stats);
      }
    } catch {}
    setGenerating(false);
  };

  const maxHourlyEngagement = hourly.length > 0 ? Math.max(...hourly.map(h => h.engagement_score), 1) : 1;
  const maxWeeklyEngagement = weekly.length > 0 ? Math.max(...weekly.map(w => w.engagement_score), 1) : 1;
  const maxBucketRate = lengthAnalysis.length > 0 ? Math.max(...lengthAnalysis.map(b => b.reply_rate), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
          {[7, 30, 60, 90].map(d => (
            <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${days === d ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {d}日
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-500">分析期間: 過去{days}日間</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      ) : (
        <>
          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="最適配信時間" value={`${bestHour}:00`} sub="エンゲージメント最高" color="violet" />
            <StatCard label="最適配信曜日" value={`${bestDow}曜日`} sub="反応率が最も高い" color="indigo" />
            <StatCard label="応答率" value={`${messageStats.reply_rate}%`} sub={`${messageStats.total_analyzed}件分析`} color="blue" />
            <StatCard label="平均文字数" value={`${messageStats.avg_length}字`} sub="送信メッセージ" color="cyan" />
          </div>

          {/* Hourly heatmap */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-1">時間帯別エンゲージメント</h3>
            <p className="text-xs text-gray-500 mb-4">送信メッセージに対するユーザー反応率 (過去{days}日)</p>
            {hourly.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">データなし</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-end gap-[3px] h-40">
                  {Array.from({ length: 24 }, (_, i) => {
                    const h = hourly.find(x => x.hour === i);
                    const score = h?.engagement_score || 0;
                    const isBest = i === bestHour;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${i}時: エンゲージ ${score}% / 送信${h?.sent || 0}件 / 反応${h?.responses || 0}件`}>
                        {score > 0 && <span className="text-[9px] text-gray-500">{score}%</span>}
                        <div
                          className={`w-full rounded-t min-h-[2px] transition-all ${isBest ? 'bg-violet-500' : 'bg-violet-300'}`}
                          style={{ height: `${maxHourlyEngagement > 0 ? (score / maxHourlyEngagement) * 120 : 0}px` }}
                        />
                        <span className={`text-[10px] ${isBest ? 'text-violet-600 font-bold' : 'text-gray-400'}`}>{i}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-violet-500 rounded" />
                    <span>最適時間帯</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-violet-300 rounded" />
                    <span>その他</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Day of week + Message length */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Day of week */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-1">曜日別エンゲージメント</h3>
              <p className="text-xs text-gray-500 mb-4">曜日ごとの反応率</p>
              {weekly.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">データなし</p>
              ) : (
                <div className="space-y-2">
                  {dowNames.map((name, i) => {
                    const w = weekly.find(x => x.dow === i);
                    const score = w?.engagement_score || 0;
                    const isBest = name === bestDow;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className={`w-6 text-sm font-medium text-center ${isBest ? 'text-violet-600' : 'text-gray-600'}`}>{name}</span>
                        <div className="flex-1 h-7 bg-gray-100 rounded-lg overflow-hidden relative">
                          <div
                            className={`h-full rounded-lg transition-all ${isBest ? 'bg-violet-500' : 'bg-violet-200'}`}
                            style={{ width: `${maxWeeklyEngagement > 0 ? (score / maxWeeklyEngagement) * 100 : 0}%` }}
                          />
                          <span className="absolute inset-y-0 right-2 flex items-center text-xs text-gray-600">{score}%</span>
                        </div>
                        <span className="w-12 text-right text-xs text-gray-500">{w?.sent || 0}件</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Message length analysis */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-1">メッセージ長別反応率</h3>
              <p className="text-xs text-gray-500 mb-4">文字数と返信率の相関</p>
              {lengthAnalysis.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">データなし</p>
              ) : (
                <div className="space-y-3">
                  {lengthAnalysis.map((b, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 font-medium">{b.label}</span>
                        <span className="text-gray-500">{b.count}件 / 返信率 {b.reply_rate}%</span>
                      </div>
                      <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-400 rounded-full transition-all"
                          style={{ width: `${maxBucketRate > 0 ? (b.reply_rate / maxBucketRate) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* AI Recommendation generator */}
          <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl border border-violet-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h3 className="font-semibold text-gray-900">AI最適化レコメンド</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">過去の配信データをAIが分析し、パフォーマンス改善のための具体的な提案を生成します。</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">配信目的 (任意)</label>
                <input value={purpose} onChange={e => setPurpose(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500" placeholder="例: 新商品の告知、リピーター獲得" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ターゲット層 (任意)</label>
                <input value={target} onChange={e => setTarget(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500" placeholder="例: 20代女性、飲食店来店客" />
              </div>
            </div>
            <button onClick={generateRecommendation} disabled={generating} className="px-5 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2">
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  AI分析中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  レコメンド生成
                </>
              )}
            </button>
          </div>

          {/* Recommendation results */}
          {recommendation && (
            <div className="space-y-4">
              {/* Score + summary */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start gap-6">
                  {recommendation.overall_score !== undefined && (
                    <div className="shrink-0 text-center">
                      <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white ${recommendation.overall_score >= 70 ? 'bg-green-500' : recommendation.overall_score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                        {recommendation.overall_score}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">総合スコア</div>
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">AI分析サマリー</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{recommendation.summary}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                      <MiniStat label="総配信" value={recStats.total_deliveries.toString()} />
                      <MiniStat label="成功率" value={`${recStats.success_rate}%`} />
                      <MiniStat label="応答率" value={`${recStats.response_rate}%`} />
                      <MiniStat label="平均文字数" value={`${recStats.avg_message_length}字`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Timing + Tone recommendations side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendation.timing_recommendation && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      配信タイミング提案
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">推奨時間帯</div>
                        <div className="flex flex-wrap gap-1">
                          {(recommendation.timing_recommendation.best_hours || []).map(h => (
                            <span key={h} className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded text-sm font-medium">{h}:00</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">推奨曜日</div>
                        <div className="flex flex-wrap gap-1">
                          {(recommendation.timing_recommendation.best_days || []).map(d => (
                            <span key={d} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-sm font-medium">{d}</span>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{recommendation.timing_recommendation.reasoning}</p>
                    </div>
                  </div>
                )}

                {recommendation.tone_recommendation && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      文面トーン提案
                    </h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">現在のトーン</div>
                          <div className="text-sm text-gray-700">{recommendation.tone_recommendation.current_tone}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">推奨トーン</div>
                          <div className="text-sm font-medium text-violet-700">{recommendation.tone_recommendation.suggested_tone}</div>
                        </div>
                      </div>
                      {(recommendation.tone_recommendation.examples || []).length > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">改善例</div>
                          {recommendation.tone_recommendation.examples.map((ex, i) => (
                            <div key={i} className="bg-gray-50 rounded-lg p-2 mb-1 text-sm text-gray-700">{ex}</div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-600 leading-relaxed">{recommendation.tone_recommendation.reasoning}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action items */}
              {(recommendation.content_recommendations || []).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h4 className="font-semibold text-gray-900 mb-4">改善アクション</h4>
                  <div className="space-y-3">
                    {recommendation.content_recommendations!.map((r, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={categoryIcons[r.category] || categoryIcons.content} />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">{r.title}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${impactColors[r.impact] || 'bg-gray-100 text-gray-700'}`}>
                              {r.impact === 'high' ? '高' : r.impact === 'medium' ? '中' : '低'}
                            </span>
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">{categoryLabels[r.category] || r.category}</span>
                          </div>
                          <p className="text-xs text-gray-600">{r.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colorMap: Record<string, string> = {
    violet: 'border-violet-200 bg-violet-50',
    indigo: 'border-indigo-200 bg-indigo-50',
    blue: 'border-blue-200 bg-blue-50',
    cyan: 'border-cyan-200 bg-cyan-50',
  };
  const textMap: Record<string, string> = {
    violet: 'text-violet-700',
    indigo: 'text-indigo-700',
    blue: 'text-blue-700',
    cyan: 'text-cyan-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || 'border-gray-200 bg-white'}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${textMap[color] || 'text-gray-900'}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2 text-center">
      <div className="text-lg font-bold text-gray-900">{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}
