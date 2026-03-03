'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

/* ---------- Types ---------- */
interface ReportData {
  period: { from: string; to: string; days: number };
  previous_period: { from: string; to: string };
  summary: {
    total: number;
    sent: number;
    failed: number;
    pending: number;
    success_rate: number;
    unique_users: number;
  };
  comparison: {
    total: number;
    sent: number;
    failed: number;
    success_rate: number;
    unique_users: number;
    total_change: number;
    sent_change: number;
    rate_change: number;
    users_change: number;
  };
  daily: { date: string; sent: number; failed: number; total: number }[];
  by_scenario: { scenario_id: string | null; scenario_name: string; total: number; sent: number; failed: number; success_rate: number }[];
  message_activity: { date: string; inbound: number; outbound: number }[];
}

/* ---------- Helpers ---------- */
function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
}

function ChangeIndicator({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-xs text-gray-400">±0{suffix}</span>;
  const isPositive = value > 0;
  return (
    <span className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
      {isPositive ? '↑' : '↓'} {Math.abs(value).toLocaleString()}{suffix}
    </span>
  );
}

/* ---------- Main Page ---------- */
export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${getApiUrl()}/api/reports/performance?from=${from}&to=${to}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error('Report fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const res = await fetchWithAuth(`${getApiUrl()}/api/reports/export/csv?from=${from}&to=${to}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `delivery_report_${from.replace(/-/g, '')}_${to.replace(/-/g, '')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => window.print();

  // Quick period presets
  const setPreset = (days: number) => {
    const t = new Date().toISOString().slice(0, 10);
    const f = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    setFrom(f);
    setTo(t);
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <h1 className="text-2xl font-bold text-gray-900">配信パフォーマンスレポート</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={exporting || loading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {exporting ? 'エクスポート中...' : 'CSV'}
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            印刷/PDF
          </button>
        </div>
      </div>

      {/* Date range selector */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 print:hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">期間:</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
            />
            <span className="text-gray-400">〜</span>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { label: '7日', days: 7 },
              { label: '30日', days: 30 },
              { label: '90日', days: 90 },
            ].map(p => (
              <button
                key={p.days}
                onClick={() => setPreset(p.days)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Print header (hidden on screen) */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold text-gray-900">配信パフォーマンスレポート</h1>
        <p className="text-sm text-gray-500">{formatDate(from)} 〜 {formatDate(to)} ({data?.period.days || 0}日間)</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="animate-pulse bg-gray-200 rounded h-5 w-24 mb-3" />
              <div className="animate-pulse bg-gray-200 rounded h-8 w-20" />
            </div>
          ))}
        </div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
            <SummaryCard
              label="総配信数"
              value={data.summary.total.toLocaleString()}
              change={data.comparison.total_change}
              icon={
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
            />
            <SummaryCard
              label="成功率"
              value={`${data.summary.success_rate}%`}
              change={data.comparison.rate_change}
              suffix="pt"
              icon={
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <SummaryCard
              label="送信成功"
              value={data.summary.sent.toLocaleString()}
              change={data.comparison.sent_change}
              icon={
                <svg className="w-5 h-5 text-[#06C755]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              }
            />
            <SummaryCard
              label="配信ユーザー数"
              value={data.summary.unique_users.toLocaleString()}
              change={data.comparison.users_change}
              icon={
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
          </div>

          {/* Comparison banner */}
          <div className="bg-blue-50 rounded-2xl p-4 print:bg-gray-50">
            <p className="text-sm text-blue-800 font-medium mb-1">前期比較</p>
            <p className="text-xs text-blue-600">
              比較期間: {formatDate(data.previous_period.from)} 〜 {formatDate(data.previous_period.to)}
              （前期: 総配信 {data.comparison.total.toLocaleString()}件, 成功率 {data.comparison.success_rate}%）
            </p>
          </div>

          {/* Daily delivery chart */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 print:shadow-none print:border">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">日別配信推移</h2>
            {data.daily.length > 0 ? (
              <DailyChart daily={data.daily} />
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">期間内の配信データなし</p>
            )}
          </section>

          {/* Message activity chart */}
          {data.message_activity.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 print:shadow-none print:border">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">メッセージ活動推移</h2>
              <MessageActivityChart data={data.message_activity} />
            </section>
          )}

          {/* Scenario breakdown */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 print:shadow-none print:border">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">シナリオ別配信実績</h2>
            {data.by_scenario.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-3 text-gray-500 font-medium">シナリオ</th>
                      <th className="text-right py-3 px-3 text-gray-500 font-medium">総数</th>
                      <th className="text-right py-3 px-3 text-gray-500 font-medium">成功</th>
                      <th className="text-right py-3 px-3 text-gray-500 font-medium">失敗</th>
                      <th className="text-right py-3 px-3 text-gray-500 font-medium">成功率</th>
                      <th className="text-right py-3 px-3 text-gray-500 font-medium">割合</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_scenario.map((s, i) => {
                      const pct = data.summary.total > 0 ? Math.round((s.total / data.summary.total) * 1000) / 10 : 0;
                      return (
                        <tr key={s.scenario_id ?? `manual-${i}`} className="border-b border-gray-50 hover:bg-gray-50 print:hover:bg-transparent">
                          <td className="py-3 px-3 text-gray-800 font-medium">{s.scenario_name}</td>
                          <td className="py-3 px-3 text-right text-gray-700">{s.total.toLocaleString()}</td>
                          <td className="py-3 px-3 text-right text-green-600">{s.sent.toLocaleString()}</td>
                          <td className="py-3 px-3 text-right text-red-600">{s.failed.toLocaleString()}</td>
                          <td className="py-3 px-3 text-right">
                            <span className={`font-medium ${s.success_rate >= 90 ? 'text-green-600' : s.success_rate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {s.success_rate}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-100 rounded-full h-2">
                                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                              <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 font-semibold">
                      <td className="py-3 px-3 text-gray-900">合計</td>
                      <td className="py-3 px-3 text-right text-gray-900">{data.summary.total.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-green-700">{data.summary.sent.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-red-700">{data.summary.failed.toLocaleString()}</td>
                      <td className="py-3 px-3 text-right text-gray-900">{data.summary.success_rate}%</td>
                      <td className="py-3 px-3 text-right text-gray-500">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">シナリオデータなし</p>
            )}
          </section>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">レポートデータの取得に失敗しました</p>
          <button onClick={fetchReport} className="mt-4 px-4 py-2 bg-[#06C755] text-white rounded-xl text-sm font-medium hover:bg-[#05b34b]">
            再読み込み
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Sub-components ---------- */

function SummaryCard({ label, value, change, suffix = '', icon }: {
  label: string; value: string; change: number; suffix?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 print:shadow-none print:border">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="mt-1">
        <ChangeIndicator value={change} suffix={suffix} />
        <span className="text-xs text-gray-400 ml-1">前期比</span>
      </div>
    </div>
  );
}

function DailyChart({ daily }: { daily: { date: string; sent: number; failed: number; total: number }[] }) {
  const maxVal = Math.max(...daily.map(d => d.total), 1);
  const barH = 160;

  return (
    <div>
      <div className="flex items-end gap-0.5 sm:gap-1" style={{ height: barH + 28 }}>
        {daily.map((d) => {
          const sentH = (d.sent / maxVal) * barH;
          const failH = (d.failed / maxVal) * barH;
          const dateLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
              <div className="w-full flex flex-col justify-end items-center" style={{ height: barH }}>
                <div
                  className="w-full rounded-t bg-red-400"
                  style={{ height: failH }}
                  title={`失敗: ${d.failed}`}
                />
                <div
                  className="w-full bg-[#06C755]"
                  style={{ height: sentH }}
                  title={`送信済: ${d.sent}`}
                />
              </div>
              {daily.length <= 31 && (
                <span className="text-[9px] text-gray-400 truncate w-full text-center">{dateLabel}</span>
              )}
            </div>
          );
        })}
      </div>
      {daily.length > 31 && (
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">{formatDate(daily[0].date)}</span>
          <span className="text-xs text-gray-400">{formatDate(daily[daily.length - 1].date)}</span>
        </div>
      )}
      <div className="flex items-center gap-4 mt-3 justify-center">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#06C755] rounded" /><span className="text-xs text-gray-500">送信成功</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-400 rounded" /><span className="text-xs text-gray-500">失敗</span></div>
      </div>
    </div>
  );
}

function MessageActivityChart({ data }: { data: { date: string; inbound: number; outbound: number }[] }) {
  const maxVal = Math.max(...data.map(d => Math.max(d.inbound, d.outbound)), 1);
  const h = 120;
  const last = data.slice(-30);
  if (last.length < 2) return <p className="text-sm text-gray-400 text-center py-8">データ不足</p>;

  const stepX = 100 / (last.length - 1);
  const inPoints = last.map((d, i) => `${i * stepX},${100 - (d.inbound / maxVal) * 80 - 10}`).join(' ');
  const outPoints = last.map((d, i) => `${i * stepX},${100 - (d.outbound / maxVal) * 80 - 10}`).join(' ');

  return (
    <div>
      <div style={{ height: h }}>
        <svg width="100%" height={h} viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-visible">
          <polyline points={outPoints} fill="none" stroke="#06C755" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <polyline points={inPoints} fill="none" stroke="#3B82F6" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {last.map((d, i) => (
            <g key={d.date}>
              <circle cx={i * stepX} cy={100 - (d.outbound / maxVal) * 80 - 10} r="1.5" fill="#06C755">
                <title>{new Date(d.date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}: 送信 {d.outbound}</title>
              </circle>
              <circle cx={i * stepX} cy={100 - (d.inbound / maxVal) * 80 - 10} r="1.5" fill="#3B82F6">
                <title>{new Date(d.date + 'T00:00:00').toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}: 受信 {d.inbound}</title>
              </circle>
            </g>
          ))}
        </svg>
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-400">{formatDate(last[0].date)}</span>
        <span className="text-xs text-gray-400">{formatDate(last[last.length - 1].date)}</span>
      </div>
      <div className="flex items-center gap-4 mt-2 justify-center">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#06C755] rounded" /><span className="text-xs text-gray-500">送信（outbound）</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-500 rounded" /><span className="text-xs text-gray-500">受信（inbound）</span></div>
      </div>
    </div>
  );
}
