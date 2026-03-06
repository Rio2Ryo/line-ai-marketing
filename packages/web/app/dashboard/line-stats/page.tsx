'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

/* ─── Types ─── */

interface Overview {
  total_friends: number;
  new_friends_this_month: number;
  new_friends_last_month: number;
  total_messages_30d: number;
  outbound_30d: number;
  inbound_30d: number;
  active_scenarios: number;
  delivery_sent: number;
  delivery_failed: number;
  delivery_rate: number;
  line_followers: number | null;
  line_target_reach: number | null;
}

interface FollowerDay { date: string; total: number; new_count: number }
interface LineFollowerDay { date: string; followers: number | null; targeted_reaches: number | null; blocks: number | null }
interface MessageDay { date: string; inbound: number; outbound: number }
interface DeliveryDay { date: string; sent: number; failed: number; pending: number }
interface LineMessageDay { date: string; success?: number; api_push?: number; api_broadcast?: number; api_multicast?: number }
interface HourlyData { hour: number; inbound: number; outbound: number }
interface WeeklyData { label: string; inbound: number; outbound: number }
interface ScoreDist { rank: string; count: number }

interface Engagement {
  response_rate: number;
  responders: number;
  total_recipients: number;
  active_users: number;
  avg_msgs_per_user: number;
  hourly: HourlyData[];
  weekly: WeeklyData[];
  score_distribution: ScoreDist[];
}

/* ─── Skeleton ─── */

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

/* ─── KPI Card ─── */

function KpiCard({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ─── Bar Chart ─── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BarChart({ data, maxH = 140, barClass = 'bg-[#06C755]', labelKey = 'date', valueKey = 'value' }: {
  data: any[];
  maxH?: number;
  barClass?: string;
  labelKey?: string;
  valueKey?: string;
}) {
  if (!data.length) return <p className="text-sm text-gray-400 text-center py-8">データなし</p>;
  const maxVal = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);
  return (
    <div className="flex items-end gap-[2px]" style={{ height: maxH + 24 }}>
      {data.map((d, i) => {
        const v = Number(d[valueKey]) || 0;
        const h = (v / maxVal) * maxH;
        const label = String(d[labelKey] || '');
        const shortLabel = label.length > 5 ? label.slice(5) : label;
        return (
          <div key={i} className="flex-1 flex flex-col items-center" style={{ minWidth: 0 }}>
            <div className="w-full flex justify-end flex-col items-center" style={{ height: maxH }}>
              <div className={`w-full rounded-t ${barClass}`} style={{ height: Math.max(h, 1) }} title={`${label}: ${v}`} />
            </div>
            {data.length <= 15 && <span className="text-[9px] text-gray-400 truncate w-full text-center mt-1">{shortLabel}</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Dual Bar Chart ─── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DualBarChart({ data, key1, key2, label1, label2, color1 = 'bg-[#06C755]', color2 = 'bg-blue-400' }: {
  data: any[];
  key1: string; key2: string;
  label1: string; label2: string;
  color1?: string; color2?: string;
}) {
  if (!data.length) return <p className="text-sm text-gray-400 text-center py-8">データなし</p>;
  const maxVal = Math.max(...data.map(d => Math.max(Number(d[key1]) || 0, Number(d[key2]) || 0)), 1);
  const barH = 120;
  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height: barH + 24 }}>
        {data.map((d, i) => {
          const v1 = Number(d[key1]) || 0;
          const v2 = Number(d[key2]) || 0;
          const h1 = (v1 / maxVal) * barH;
          const h2 = (v2 / maxVal) * barH;
          const label = String(d['date'] || d['label'] || d['hour'] || i);
          return (
            <div key={i} className="flex-1 flex flex-col items-center" style={{ minWidth: 0 }}>
              <div className="w-full flex gap-[1px] justify-center items-end" style={{ height: barH }}>
                <div className={`flex-1 ${color1} rounded-t`} style={{ height: Math.max(h1, 1) }} title={`${label1}: ${v1}`} />
                <div className={`flex-1 ${color2} rounded-t`} style={{ height: Math.max(h2, 1) }} title={`${label2}: ${v2}`} />
              </div>
              {data.length <= 15 && <span className="text-[9px] text-gray-400 truncate w-full text-center mt-1">{String(label).slice(-5)}</span>}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-2 justify-center">
        <div className="flex items-center gap-1.5"><div className={`w-3 h-3 ${color1} rounded`} /><span className="text-xs text-gray-500">{label1}</span></div>
        <div className="flex items-center gap-1.5"><div className={`w-3 h-3 ${color2} rounded`} /><span className="text-xs text-gray-500">{label2}</span></div>
      </div>
    </div>
  );
}

/* ─── Stacked Bar ─── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StackedBar({ data, keys, colors, labels }: {
  data: any[];
  keys: string[];
  colors: string[];
  labels: string[];
}) {
  if (!data.length) return <p className="text-sm text-gray-400 text-center py-8">データなし</p>;
  const maxVal = Math.max(...data.map(d => keys.reduce((s, k) => s + (Number(d[k]) || 0), 0)), 1);
  const barH = 120;
  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height: barH + 24 }}>
        {data.map((d, i) => {
          const total = keys.reduce((s, k) => s + (Number(d[k]) || 0), 0);
          return (
            <div key={i} className="flex-1 flex flex-col items-center" style={{ minWidth: 0 }}>
              <div className="w-full flex flex-col justify-end" style={{ height: barH }}>
                {keys.map((k, ki) => {
                  const v = Number(d[k]) || 0;
                  const h = total > 0 ? (v / maxVal) * barH : 0;
                  return <div key={k} className={`w-full ${colors[ki]} ${ki === 0 ? 'rounded-t' : ''}`} style={{ height: Math.max(h, 0) }} title={`${labels[ki]}: ${v}`} />;
                })}
              </div>
              {data.length <= 15 && <span className="text-[9px] text-gray-400 truncate w-full text-center mt-1">{String(d['date'] || '').slice(5)}</span>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-2 justify-center">
        {labels.map((l, i) => (
          <div key={i} className="flex items-center gap-1.5"><div className={`w-3 h-3 ${colors[i]} rounded`} /><span className="text-xs text-gray-500">{l}</span></div>
        ))}
      </div>
    </div>
  );
}

/* ─── Line Chart ─── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LineChart({ data, valueKey, color = '#06C755' }: { data: any[]; valueKey: string; color?: string }) {
  if (data.length < 2) return <p className="text-sm text-gray-400 text-center py-8">データ不足</p>;
  const h = 100;
  const maxVal = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);
  const stepX = 100 / (data.length - 1);
  const points = data.map((d, i) => `${i * stepX},${100 - ((Number(d[valueKey]) || 0) / maxVal) * 80 - 10}`).join(' ');

  return (
    <div style={{ height: h + 24 }}>
      <svg width="100%" height={h} viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => (
          <circle key={i} cx={i * stepX} cy={100 - ((Number(d[valueKey]) || 0) / maxVal) * 80 - 10} r="1.5" fill={color}>
            <title>{String(d['date'] || '')}: {Number(d[valueKey]) || 0}</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-400">{String(data[0]['date'] || '').slice(5)}</span>
        <span className="text-xs text-gray-400">{String(data[data.length - 1]['date'] || '').slice(5)}</span>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */

export default function LineStatsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [followers, setFollowers] = useState<{ line_api: LineFollowerDay[]; internal: FollowerDay[] } | null>(null);
  const [messages, setMessages] = useState<{ line_api: LineMessageDay[]; internal_messages: MessageDay[]; delivery_logs: DeliveryDay[] } | null>(null);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    const base = getApiUrl() + '/api/line-stats';
    try {
      const [ov, fo, ms, en] = await Promise.all([
        fetchWithAuth(`${base}/overview`).then(r => r.ok ? r.json() : null),
        fetchWithAuth(`${base}/followers?days=${days}`).then(r => r.ok ? r.json() : null),
        fetchWithAuth(`${base}/messages?days=${days}`).then(r => r.ok ? r.json() : null),
        fetchWithAuth(`${base}/engagement?days=${days}`).then(r => r.ok ? r.json() : null),
      ]);
      if (ov?.success) setOverview(ov.data);
      if (fo?.success) setFollowers(fo.data);
      if (ms?.success) setMessages(ms.data);
      if (en?.success) setEngagement(en.data);
    } catch (err) {
      console.error('LINE Stats load error:', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const friendGrowth = overview
    ? (overview.new_friends_last_month > 0
      ? Math.round(((overview.new_friends_this_month - overview.new_friends_last_month) / overview.new_friends_last_month) * 100)
      : overview.new_friends_this_month > 0 ? 100 : 0)
    : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">LINE統計ダッシュボード</h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">LINE統計ダッシュボード</h1>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                days === d ? 'bg-[#06C755] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d}日
            </button>
          ))}
          <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" title="更新">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="友だち数"
            value={(overview.line_followers ?? overview.total_friends).toLocaleString()}
            sub={overview.line_followers != null ? 'LINE API' : '内部DB'}
            icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            color="text-[#06C755]"
          />
          <KpiCard
            label="今月新規"
            value={overview.new_friends_this_month.toLocaleString()}
            sub={friendGrowth !== 0 ? `前月比 ${friendGrowth > 0 ? '+' : ''}${friendGrowth}%` : '前月と同じ'}
            icon="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
            color={friendGrowth >= 0 ? 'text-[#06C755]' : 'text-red-500'}
          />
          <KpiCard
            label="30日メッセージ"
            value={overview.total_messages_30d.toLocaleString()}
            sub={`送信 ${overview.outbound_30d} / 受信 ${overview.inbound_30d}`}
            icon="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            color="text-blue-600"
          />
          <KpiCard
            label="配信成功率"
            value={`${overview.delivery_rate}%`}
            sub={`成功 ${overview.delivery_sent} / 失敗 ${overview.delivery_failed}`}
            icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            color={overview.delivery_rate >= 95 ? 'text-[#06C755]' : overview.delivery_rate >= 80 ? 'text-yellow-500' : 'text-red-500'}
          />
          {overview.line_target_reach != null && (
            <KpiCard
              label="ターゲットリーチ"
              value={overview.line_target_reach.toLocaleString()}
              sub="配信可能ユーザー"
              icon="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              color="text-purple-600"
            />
          )}
          <KpiCard
            label="稼働シナリオ"
            value={String(overview.active_scenarios)}
            icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            color="text-gray-700"
          />
          {engagement && (
            <>
              <KpiCard
                label="反応率"
                value={`${engagement.response_rate}%`}
                sub={`反応 ${engagement.responders} / 対象 ${engagement.total_recipients}`}
                icon="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                color={engagement.response_rate >= 30 ? 'text-[#06C755]' : engagement.response_rate >= 15 ? 'text-yellow-500' : 'text-red-500'}
              />
              <KpiCard
                label="ユーザー平均"
                value={`${engagement.avg_msgs_per_user}`}
                sub={`メッセージ/人 (${engagement.active_users}人)`}
                icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                color="text-indigo-600"
              />
            </>
          )}
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Follower Trend */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">友だち数推移</h2>
          {followers && followers.internal.length > 0 ? (
            <LineChart data={followers.internal} valueKey="total" color="#06C755" />
          ) : followers && followers.line_api.length > 0 ? (
            <LineChart data={followers.line_api} valueKey="followers" color="#06C755" />
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">データなし</p>
          )}
          {followers && followers.internal.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-2">日別新規追加</p>
              <BarChart data={followers.internal} valueKey="new_count" barClass="bg-[#06C755]" />
            </div>
          )}
        </section>

        {/* Message Volume */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">メッセージ推移</h2>
          {messages && messages.internal_messages.length > 0 ? (
            <DualBarChart
              data={messages.internal_messages}
              key1="outbound" key2="inbound"
              label1="送信" label2="受信"
              color1="bg-[#06C755]" color2="bg-blue-400"
            />
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">データなし</p>
          )}
        </section>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivery Stats */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">配信ステータス推移</h2>
          {messages && messages.delivery_logs.length > 0 ? (
            <StackedBar
              data={messages.delivery_logs}
              keys={['sent', 'failed', 'pending']}
              colors={['bg-[#06C755]', 'bg-red-400', 'bg-yellow-300']}
              labels={['成功', '失敗', '保留']}
            />
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">データなし</p>
          )}
        </section>

        {/* LINE API Message Delivery */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">LINE配信数 (API)</h2>
          {messages && messages.line_api.length > 0 ? (
            <>
              <BarChart
                data={messages.line_api.map(d => ({ date: d.date, value: d.success || 0 }))}
                valueKey="value"
                barClass="bg-purple-500"
              />
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-purple-600">
                    {messages.line_api.reduce((s, d) => s + (d.api_push || 0), 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Push</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-purple-600">
                    {messages.line_api.reduce((s, d) => s + (d.api_broadcast || 0), 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Broadcast</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-purple-600">
                    {messages.line_api.reduce((s, d) => s + (d.api_multicast || 0), 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Multicast</p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">LINE APIデータなし</p>
              <p className="text-xs text-gray-300 mt-1">本番チャネル設定後に取得可能</p>
            </div>
          )}
        </section>
      </div>

      {/* Charts Row 3: Engagement */}
      {engagement && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hourly Distribution */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">時間帯別メッセージ分布</h2>
            <DualBarChart
              data={engagement.hourly.map(h => ({ ...h, label: `${h.hour}時` }))}
              key1="outbound" key2="inbound"
              label1="送信" label2="受信"
              color1="bg-[#06C755]" color2="bg-blue-400"
            />
          </section>

          {/* Day of Week */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">曜日別メッセージ分布</h2>
            <DualBarChart
              data={engagement.weekly}
              key1="outbound" key2="inbound"
              label1="送信" label2="受信"
              color1="bg-[#06C755]" color2="bg-blue-400"
            />
          </section>
        </div>
      )}

      {/* Engagement Score Distribution */}
      {engagement && engagement.score_distribution.length > 0 && (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">エンゲージメントランク分布</h2>
          <div className="flex items-end gap-4 justify-center" style={{ height: 160 }}>
            {engagement.score_distribution.map((s) => {
              const maxCount = Math.max(...engagement.score_distribution.map(x => x.count), 1);
              const h = (s.count / maxCount) * 130;
              const rankColors: Record<string, string> = { S: 'bg-purple-500', A: 'bg-[#06C755]', B: 'bg-blue-400', C: 'bg-yellow-400', D: 'bg-gray-300' };
              return (
                <div key={s.rank} className="flex flex-col items-center gap-1" style={{ width: 60 }}>
                  <span className="text-sm font-bold text-gray-700">{s.count}</span>
                  <div className={`w-full ${rankColors[s.rank] || 'bg-gray-300'} rounded-t`} style={{ height: Math.max(h, 4) }} />
                  <span className="text-sm font-semibold text-gray-600">{s.rank}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
