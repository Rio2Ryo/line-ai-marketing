'use client';

import { useState, useEffect } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

/* ---------- Types ---------- */
interface WeeklyDelivery { week: string; sent: number; failed: number; rate: number }
interface ScenarioDelivery { scenario_id: string | null; name: string; sent: number; failed: number; rate: number }
interface DeliveryData { weekly: WeeklyDelivery[]; by_scenario: ScenarioDelivery[] }

interface ActivityData { active: number; at_risk: number; dormant: number; total: number; activity_trend: { date: string; active_users: number }[] }

interface AiPerfData { avg_confidence: number; escalation_rate: number; avg_response_ms: number; total_chats: number; top_knowledge: { id: string; title: string; usage_count: number }[]; daily: { date: string; chats: number; escalations: number }[] }

interface ChurnUser { id: string; display_name: string | null; picture_url: string | null; risk_score: number; last_active: string | null; message_count_30d: number }
interface ChurnData { users: ChurnUser[]; summary: { high_risk: number; medium_risk: number; low_risk: number } }

/* ---------- Skeleton ---------- */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <Skeleton className="h-5 w-40 mb-4" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

/* ---------- Main Page ---------- */
export default function AnalyticsPage() {
  const [delivery, setDelivery] = useState<DeliveryData | null>(null);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [aiPerf, setAiPerf] = useState<AiPerfData | null>(null);
  const [churn, setChurn] = useState<ChurnData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = getApiUrl() + '/api/analytics';
    Promise.all([
      fetchWithAuth(`${base}/delivery-effectiveness`).then(r => r.ok ? r.json() : null),
      fetchWithAuth(`${base}/user-activity`).then(r => r.ok ? r.json() : null),
      fetchWithAuth(`${base}/ai-performance`).then(r => r.ok ? r.json() : null),
      fetchWithAuth(`${base}/churn-risk`).then(r => r.ok ? r.json() : null),
    ]).then(([d, a, ai, ch]) => {
      if (d?.success) setDelivery(d.data);
      if (a?.success) setActivity(a.data);
      if (ai?.success) setAiPerf(ai.data);
      if (ch?.success) setChurn(ch.data);
    }).catch(err => console.error('Analytics fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">AI Analytics Dashboard</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">AI Analytics Dashboard</h1>

      {/* --- Section 1: 配信効果分析 --- */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">配信効果分析</h2>

        {/* Weekly bar chart */}
        {delivery && delivery.weekly.length > 0 ? (
          <>
            <p className="text-sm text-gray-500 mb-3">週別配信成功率（過去30日）</p>
            <div className="flex items-end gap-3 mb-2" style={{ height: 160 }}>
              {delivery.weekly.map((w) => {
                const total = w.sent + w.failed;
                const maxH = 140;
                const sentH = total > 0 ? (w.sent / total) * maxH : 0;
                const failH = total > 0 ? (w.failed / total) * maxH : 0;
                return (
                  <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-medium text-gray-700">{w.rate}%</span>
                    <div className="w-full flex flex-col items-center" style={{ height: maxH }}>
                      <div className="w-full flex flex-col justify-end" style={{ height: maxH }}>
                        <div className="bg-red-400 rounded-t w-full" style={{ height: failH }} title={`失敗: ${w.failed}`} />
                        <div className="bg-[#06C755] w-full" style={{ height: sentH }} title={`送信済: ${w.sent}`} />
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 truncate max-w-full">{w.week}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-2 justify-center">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#06C755] rounded" /><span className="text-xs text-gray-500">送信済</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-400 rounded" /><span className="text-xs text-gray-500">失敗</span></div>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">配信データなし</p>
        )}

        {/* Scenario breakdown table */}
        {delivery && delivery.by_scenario.length > 0 && (
          <div className="mt-6">
            <p className="text-sm text-gray-500 mb-3">シナリオ別配信成功率</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">シナリオ</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">送信済</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">失敗</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">成功率</th>
                  </tr>
                </thead>
                <tbody>
                  {delivery.by_scenario.map((s, i) => (
                    <tr key={s.scenario_id ?? `manual-${i}`} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-800">{s.name}</td>
                      <td className="py-2 px-3 text-right text-gray-700">{s.sent.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-gray-700">{s.failed.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right">
                        <span className={`font-medium ${s.rate >= 90 ? 'text-green-600' : s.rate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {s.rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* --- Section 2: ユーザーエンゲージメント --- */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">ユーザーエンゲージメント</h2>

        {activity ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Donut-style breakdown */}
            <div>
              <div className="flex items-center justify-center mb-4">
                <DonutChart
                  active={activity.active}
                  atRisk={activity.at_risk}
                  dormant={activity.dormant}
                  total={activity.total}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-2xl font-bold text-[#06C755]">{activity.active}</div>
                  <div className="text-xs text-gray-500">アクティブ</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-500">{activity.at_risk}</div>
                  <div className="text-xs text-gray-500">注意</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-400">{activity.dormant}</div>
                  <div className="text-xs text-gray-500">休眠</div>
                </div>
              </div>
              <p className="text-center text-sm text-gray-400 mt-2">総ユーザー: {activity.total}</p>
            </div>

            {/* Activity trend mini chart */}
            <div>
              <p className="text-sm text-gray-500 mb-3">日別アクティブユーザー推移</p>
              {activity.activity_trend.length > 0 ? (
                <MiniLineChart data={activity.activity_trend.map(t => ({ label: t.date, value: t.active_users }))} color="#06C755" />
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">データなし</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">データなし</p>
        )}
      </section>

      {/* --- Section 3: AIパフォーマンス --- */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">AIパフォーマンス</h2>

        {aiPerf ? (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="平均確信度" value={`${Math.round(aiPerf.avg_confidence * 100)}%`} sub="confidence" color="text-[#06C755]" />
              <StatCard label="エスカレーション率" value={`${aiPerf.escalation_rate}%`} sub="escalation" color={aiPerf.escalation_rate > 20 ? 'text-red-500' : 'text-yellow-500'} />
              <StatCard label="平均応答時間" value={`${aiPerf.avg_response_ms}ms`} sub="response time" color="text-blue-500" />
              <StatCard label="総チャット数" value={aiPerf.total_chats.toLocaleString()} sub="30日間" color="text-gray-700" />
            </div>

            {/* Top knowledge articles */}
            {aiPerf.top_knowledge.length > 0 && (
              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-2">利用頻度上位ナレッジ</p>
                <div className="flex flex-wrap gap-2">
                  {aiPerf.top_knowledge.map((k) => (
                    <span key={k.id} className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs px-2.5 py-1 rounded-full">
                      {k.title} <span className="font-semibold">({k.usage_count})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Daily trend */}
            <div>
              <p className="text-sm text-gray-500 mb-3">日別チャット数 / エスカレーション推移</p>
              {aiPerf.daily.length > 0 ? (
                <DualBarChart data={aiPerf.daily} />
              ) : (
                <p className="text-sm text-gray-400 text-center py-8">データなし</p>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">データなし</p>
        )}
      </section>

      {/* --- Section 4: 離脱リスクスコアリング --- */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">離脱リスクスコアリング</h2>

        {churn ? (
          <>
            {/* Risk summary cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-red-600">{churn.summary.high_risk}</div>
                <div className="text-sm text-red-500 mt-1">高リスク</div>
                <div className="text-xs text-gray-400">スコア 70+</div>
              </div>
              <div className="bg-yellow-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600">{churn.summary.medium_risk}</div>
                <div className="text-sm text-yellow-500 mt-1">中リスク</div>
                <div className="text-xs text-gray-400">スコア 40-69</div>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{churn.summary.low_risk}</div>
                <div className="text-sm text-green-500 mt-1">低リスク</div>
                <div className="text-xs text-gray-400">スコア 0-39</div>
              </div>
            </div>

            {/* Top at-risk users table */}
            {churn.users.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">ユーザー</th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium">リスクスコア</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">最終アクティブ</th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium">30日間メッセージ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {churn.users.map((u) => (
                      <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            {u.picture_url ? (
                              <img src={u.picture_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">?</div>
                            )}
                            <span className="text-gray-800">{u.display_name || '名前なし'}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-2.5 max-w-[120px]">
                              <div
                                className={`h-2.5 rounded-full ${
                                  u.risk_score >= 70 ? 'bg-red-500' : u.risk_score >= 40 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${u.risk_score}%` }}
                              />
                            </div>
                            <span className={`text-xs font-semibold ${
                              u.risk_score >= 70 ? 'text-red-600' : u.risk_score >= 40 ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {u.risk_score}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-600">
                          {u.last_active ? new Date(u.last_active).toLocaleDateString('ja-JP') : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-600">{u.message_count_30d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">ユーザーデータなし</p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">データなし</p>
        )}
      </section>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-gray-700 mt-1">{label}</div>
      <div className="text-xs text-gray-400">{sub}</div>
    </div>
  );
}

function DonutChart({ active, atRisk, dormant, total }: { active: number; atRisk: number; dormant: number; total: number }) {
  const size = 140;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const sum = active + atRisk + dormant || 1;

  const activeArc = (active / sum) * circumference;
  const atRiskArc = (atRisk / sum) * circumference;
  const dormantArc = (dormant / sum) * circumference;

  const activeOffset = 0;
  const atRiskOffset = -(activeArc);
  const dormantOffset = -(activeArc + atRiskArc);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      {/* Dormant */}
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke="#9ca3af" strokeWidth={stroke}
        strokeDasharray={`${dormantArc} ${circumference - dormantArc}`}
        strokeDashoffset={dormantOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        strokeLinecap="round"
      />
      {/* At-risk */}
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke="#eab308" strokeWidth={stroke}
        strokeDasharray={`${atRiskArc} ${circumference - atRiskArc}`}
        strokeDashoffset={atRiskOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        strokeLinecap="round"
      />
      {/* Active */}
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke="#06C755" strokeWidth={stroke}
        strokeDasharray={`${activeArc} ${circumference - activeArc}`}
        strokeDashoffset={activeOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        strokeLinecap="round"
      />
      <text x={size / 2} y={size / 2 - 6} textAnchor="middle" className="fill-gray-800 text-2xl font-bold">{total}</text>
      <text x={size / 2} y={size / 2 + 14} textAnchor="middle" className="fill-gray-400 text-xs">ユーザー</text>
    </svg>
  );
}

function MiniLineChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const h = 100;
  const w = '100%';
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const last7 = data.slice(-14);
  if (last7.length < 2) return <p className="text-sm text-gray-400 text-center py-8">データ不足</p>;

  const stepX = 100 / (last7.length - 1);
  const points = last7.map((d, i) => `${i * stepX},${100 - (d.value / maxVal) * 80 - 10}`).join(' ');

  return (
    <div style={{ height: h }}>
      <svg width={w} height={h} viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {last7.map((d, i) => (
          <circle key={i} cx={i * stepX} cy={100 - (d.value / maxVal) * 80 - 10} r="1.5" fill={color}>
            <title>{new Date(d.label).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}: {d.value}</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-400">
          {new Date(last7[0].label).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
        </span>
        <span className="text-xs text-gray-400">
          {new Date(last7[last7.length - 1].label).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
        </span>
      </div>
    </div>
  );
}

function DualBarChart({ data }: { data: { date: string; chats: number; escalations: number }[] }) {
  const last14 = data.slice(-14);
  const maxVal = Math.max(...last14.map(d => d.chats), 1);
  const barH = 120;

  return (
    <div>
      <div className="flex items-end gap-1" style={{ height: barH + 24 }}>
        {last14.map((d) => {
          const chatH = (d.chats / maxVal) * barH;
          const escH = d.chats > 0 ? (d.escalations / d.chats) * chatH : 0;
          const dateLabel = new Date(d.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full flex flex-col justify-end items-center" style={{ height: barH }}>
                <div className="w-full relative rounded-t" style={{ height: chatH, backgroundColor: '#06C755' }} title={`チャット: ${d.chats}`}>
                  {escH > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-red-400 rounded-b" style={{ height: escH }} title={`エスカレーション: ${d.escalations}`} />
                  )}
                </div>
              </div>
              <span className="text-[10px] text-gray-400 truncate w-full text-center">{dateLabel}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-2 justify-center">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#06C755] rounded" /><span className="text-xs text-gray-500">チャット</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-400 rounded" /><span className="text-xs text-gray-500">エスカレーション</span></div>
      </div>
    </div>
  );
}
