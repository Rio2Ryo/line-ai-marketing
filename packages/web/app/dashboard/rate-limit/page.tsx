'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

/* ─── Types ─── */

interface Stats {
  current_minute_count: number;
  total_24h: number;
  rate_limited_24h: number;
  last_rate_limit_at: string | null;
  avg_per_minute_1h: number;
}

interface HourlyEntry {
  hour: string;
  success: number;
  rate_limited: number;
  server_error: number;
  client_error: number;
  total: number;
}

interface LogEntry {
  id: string;
  event_type: string;
  status_code: number;
  metadata: string | null;
  created_at: string;
}

/* ─── Page ─── */

export default function RateLimitPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [hourly, setHourly] = useState<HourlyEntry[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  const base = getApiUrl() + '/api/rate-limit';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, h, l] = await Promise.all([
        fetchWithAuth(`${base}/stats`).then(r => r.ok ? r.json() : null),
        fetchWithAuth(`${base}/hourly`).then(r => r.ok ? r.json() : null),
        fetchWithAuth(`${base}/logs?limit=30${filter ? `&type=${filter}` : ''}`).then(r => r.ok ? r.json() : null),
      ]);
      if (s?.success) setStats(s.data);
      if (h?.success) setHourly(h.data);
      if (l?.success) setLogs(l.data);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [base, filter]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const handleCleanup = async () => {
    try {
      const res = await fetchWithAuth(`${base}/logs`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        load();
      }
    } catch {}
  };

  const LINE_LIMIT = 60000; // per minute

  const eventLabels: Record<string, { label: string; color: string; bg: string }> = {
    success: { label: '成功', color: 'text-green-700', bg: 'bg-green-100' },
    rate_limited: { label: 'レート制限', color: 'text-red-700', bg: 'bg-red-100' },
    server_error: { label: 'サーバーエラー', color: 'text-orange-700', bg: 'bg-orange-100' },
    client_error: { label: 'クライアントエラー', color: 'text-yellow-700', bg: 'bg-yellow-100' },
    batch_complete: { label: 'バッチ完了', color: 'text-blue-700', bg: 'bg-blue-100' },
  };

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">レート制限モニター</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">レート制限モニター</h1>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" title="更新">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button onClick={handleCleanup} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50" title="7日以前のログをクリーンアップ">
            クリーンアップ
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Current minute rate */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-sm text-gray-500">現在の送信数/分</p>
            <p className={`text-2xl font-bold mt-1 ${stats.current_minute_count > LINE_LIMIT * 0.8 ? 'text-red-600' : stats.current_minute_count > LINE_LIMIT * 0.5 ? 'text-yellow-600' : 'text-[#06C755]'}`}>
              {stats.current_minute_count.toLocaleString()}
            </p>
            <div className="mt-2 bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${stats.current_minute_count > LINE_LIMIT * 0.8 ? 'bg-red-500' : stats.current_minute_count > LINE_LIMIT * 0.5 ? 'bg-yellow-500' : 'bg-[#06C755]'}`}
                style={{ width: `${Math.min((stats.current_minute_count / LINE_LIMIT) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">上限: {LINE_LIMIT.toLocaleString()}/min</p>
          </div>

          {/* Avg per minute */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-sm text-gray-500">平均送信数/分</p>
            <p className="text-2xl font-bold mt-1 text-blue-600">{stats.avg_per_minute_1h}</p>
            <p className="text-xs text-gray-400 mt-1">過去1時間</p>
          </div>

          {/* Total 24h */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-sm text-gray-500">24時間合計</p>
            <p className="text-2xl font-bold mt-1 text-gray-800">{stats.total_24h.toLocaleString()}</p>
          </div>

          {/* Rate limited */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-sm text-gray-500">429エラー (24h)</p>
            <p className={`text-2xl font-bold mt-1 ${stats.rate_limited_24h > 0 ? 'text-red-600' : 'text-[#06C755]'}`}>
              {stats.rate_limited_24h}
            </p>
            {stats.rate_limited_24h === 0 && <p className="text-xs text-green-500 mt-1">正常</p>}
          </div>

          {/* Last rate limit */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-sm text-gray-500">最終レート制限</p>
            <p className="text-sm font-medium mt-1 text-gray-700">
              {stats.last_rate_limit_at
                ? new Date(stats.last_rate_limit_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'なし'
              }
            </p>
          </div>
        </div>
      )}

      {/* Hourly Chart */}
      {hourly.length > 0 && (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">時間別API呼び出し (24h)</h2>
          <div className="flex items-end gap-[2px]" style={{ height: 160 }}>
            {hourly.map((h) => {
              const maxVal = Math.max(...hourly.map(x => x.total), 1);
              const successH = (h.success / maxVal) * 130;
              const errorH = ((h.rate_limited + h.server_error + h.client_error) / maxVal) * 130;
              const hourLabel = h.hour.split(' ')[1]?.replace(':00', '') || '';
              return (
                <div key={h.hour} className="flex-1 flex flex-col items-center" style={{ minWidth: 0 }}>
                  <div className="w-full flex flex-col justify-end" style={{ height: 140 }}>
                    {errorH > 0 && (
                      <div className="w-full bg-red-400 rounded-t" style={{ height: Math.max(errorH, 1) }} title={`エラー: ${h.rate_limited + h.server_error + h.client_error}`} />
                    )}
                    <div className="w-full bg-[#06C755]" style={{ height: Math.max(successH, 1) }} title={`成功: ${h.success}`} />
                  </div>
                  {hourly.length <= 24 && <span className="text-[9px] text-gray-400 mt-1">{hourLabel}</span>}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-2 justify-center">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#06C755] rounded" /><span className="text-xs text-gray-500">成功</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-400 rounded" /><span className="text-xs text-gray-500">エラー</span></div>
          </div>
        </section>
      )}

      {/* Logs */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">最近のイベント</h2>
          <div className="flex gap-1">
            {[
              { value: '', label: 'すべて' },
              { value: 'success', label: '成功' },
              { value: 'rate_limited', label: '429' },
              { value: 'server_error', label: '5xx' },
              { value: 'client_error', label: '4xx' },
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-2 py-1 text-xs rounded-lg font-medium transition-colors ${
                  filter === f.value ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">イベント</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">ステータス</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">日時</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const ev = eventLabels[log.event_type] || { label: log.event_type, color: 'text-gray-600', bg: 'bg-gray-100' };
                  return (
                    <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ev.color} ${ev.bg}`}>
                          {ev.label}
                        </span>
                        {log.metadata && (
                          <span className="text-xs text-gray-400 ml-2">{log.metadata.substring(0, 50)}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-600 font-mono text-xs">{log.status_code}</td>
                      <td className="py-2 px-3 text-right text-gray-500 text-xs">
                        {new Date(log.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">イベントログなし</p>
        )}
      </section>

      {/* Info */}
      <section className="bg-blue-50 rounded-2xl p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">LINE Messaging APIレート制限</p>
        <ul className="list-disc ml-5 space-y-1 text-xs text-blue-600">
          <li>Push API: 最大60,000リクエスト/分 (有料プラン)</li>
          <li>429レスポンス検知時: 自動で指数バックオフリトライ (最大3回)</li>
          <li>Retry-Afterヘッダー対応: LINE APIが指定した待機時間を自動適用</li>
          <li>バッチ配信: メッセージ間にスロットリング (100ms) を自動挿入</li>
          <li>サーバーエラー (5xx): 自動リトライ (1s→2s→4s)</li>
        </ul>
      </section>
    </div>
  );
}
