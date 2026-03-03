'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface ErrorLog {
  id: string;
  user_id: string;
  user_name: string;
  scenario_name: string;
  step_content: string | null;
  status: string;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  created_at: string;
}

interface ErrorCategory {
  error_category: string;
  count: number;
}

interface DailyData {
  date: string;
  failed: number;
  sent: number;
  total: number;
}

interface RecentError {
  id: string;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  user_name: string;
  scenario_name: string;
}

interface Summary {
  totals: {
    total_failed: number;
    retried: number;
    retry_success: number;
    pending_retry: number;
    recovery_rate: number;
  };
  daily: DailyData[];
  by_error: ErrorCategory[];
  recent: RecentError[];
}

const errorCategoryColors: Record<string, string> = {
  'レート制限': 'bg-yellow-100 text-yellow-700',
  '不正リクエスト': 'bg-red-100 text-red-700',
  '認証エラー': 'bg-orange-100 text-orange-700',
  'ユーザー不明': 'bg-purple-100 text-purple-700',
  'サーバーエラー': 'bg-red-100 text-red-700',
  'タイムアウト': 'bg-blue-100 text-blue-700',
  'その他': 'bg-gray-100 text-gray-700',
};

export default function DeliveryErrorsPage() {
  const [tab, setTab] = useState<'dashboard' | 'list'>('dashboard');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 30, total: 0 });
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [statusFilter, setStatusFilter] = useState('failed');
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [retryingAll, setRetryingAll] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${getApiUrl()}/api/delivery-errors/summary?days=${days}`);
      const data = await res.json();
      if (data.success) setSummary(data.data);
    } catch {}
  }, [days]);

  const loadErrors = useCallback(async (page = 1) => {
    try {
      const res = await fetchWithAuth(`${getApiUrl()}/api/delivery-errors?page=${page}&status=${statusFilter}`);
      const data = await res.json();
      if (data.success) {
        setErrors(data.data);
        setPagination(data.pagination);
      }
    } catch {}
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSummary(), loadErrors()]).then(() => setLoading(false));
  }, [loadSummary, loadErrors]);

  const handleRetry = async (id: string) => {
    setRetrying(prev => new Set(prev).add(id));
    try {
      const res = await fetchWithAuth(`${getApiUrl()}/api/delivery-errors/${id}/retry`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        loadErrors(pagination.page);
        loadSummary();
      }
    } catch {}
    setRetrying(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const handleRetryAll = async () => {
    if (!confirm('リトライ可能な全ての失敗配信を再送しますか？')) return;
    setRetryingAll(true);
    try {
      const res = await fetchWithAuth(`${getApiUrl()}/api/delivery-errors/retry-all`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        loadErrors(pagination.page);
        loadSummary();
      }
    } catch {}
    setRetryingAll(false);
  };

  const maxDaily = summary?.daily ? Math.max(...summary.daily.map(d => d.total), 1) : 1;
  const totalErrors = summary?.by_error.reduce((s, e) => s + e.count, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Tab switch */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          <button onClick={() => setTab('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'dashboard' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
            エラーダッシュボード
          </button>
          <button onClick={() => setTab('list')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'list' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
            失敗配信一覧
          </button>
        </div>
        <button onClick={handleRetryAll} disabled={retryingAll} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
          {retryingAll ? (
            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> 処理中...</>
          ) : (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> 一括リトライ</>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
        </div>
      ) : (
        <>
          {tab === 'dashboard' && summary && (
            <div className="space-y-6">
              {/* Period selector */}
              <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1 w-fit">
                {[7, 30, 60].map(d => (
                  <button key={d} onClick={() => setDays(d)} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${days === d ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    {d}日
                  </button>
                ))}
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard label="失敗件数" value={summary.totals.total_failed} color="red" />
                <StatCard label="リトライ済" value={summary.totals.retried} color="orange" />
                <StatCard label="リトライ成功" value={summary.totals.retry_success} color="green" />
                <StatCard label="リトライ待ち" value={summary.totals.pending_retry} color="yellow" />
                <StatCard label="復旧率" value={`${summary.totals.recovery_rate}%`} color="blue" />
              </div>

              {/* Daily chart */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">日別配信状況</h3>
                {summary.daily.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">データなし</p>
                ) : (
                  <div className="h-44 flex items-end gap-[2px]">
                    {summary.daily.map(d => {
                      const sentH = d.total > 0 ? (d.sent / maxDaily) * 140 : 0;
                      const failH = d.total > 0 ? (d.failed / maxDaily) * 140 : 0;
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: 成功${d.sent} / 失敗${d.failed}`}>
                          {d.failed > 0 && <span className="text-[9px] text-red-500">{d.failed}</span>}
                          <div className="w-full flex flex-col-reverse">
                            <div className="w-full bg-green-400 rounded-b min-h-[1px]" style={{ height: `${sentH}px` }} />
                            {d.failed > 0 && <div className="w-full bg-red-400 rounded-t" style={{ height: `${failH}px` }} />}
                          </div>
                          <span className="text-[9px] text-gray-400 -rotate-45 origin-top-left whitespace-nowrap">{d.date.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-500 mt-3">
                  <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-400 rounded" /> 成功</div>
                  <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-400 rounded" /> 失敗</div>
                </div>
              </div>

              {/* Error categories + Recent errors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Error categories */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">エラー種別</h3>
                  {summary.by_error.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">エラーなし</p>
                  ) : (
                    <div className="space-y-3">
                      {summary.by_error.map((e, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${errorCategoryColors[e.error_category] || 'bg-gray-100 text-gray-700'}`}>
                            {e.error_category}
                          </span>
                          <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-red-400 rounded-full" style={{ width: `${(e.count / totalErrors) * 100}%` }} />
                          </div>
                          <span className="text-sm font-medium text-gray-700 w-10 text-right">{e.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent errors */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">最近の失敗</h3>
                  {summary.recent.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">失敗なし</p>
                  ) : (
                    <div className="space-y-2">
                      {summary.recent.map(r => (
                        <div key={r.id} className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-100">
                          <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-medium text-gray-900 truncate">{r.user_name || 'Unknown'}</span>
                              <span className="text-gray-400">{r.scenario_name}</span>
                            </div>
                            <p className="text-[11px] text-red-600 truncate">{r.error_message || 'Unknown error'}</p>
                            <div className="flex items-center gap-2 text-[10px] text-gray-400">
                              <span>{new Date(r.created_at).toLocaleString('ja-JP')}</span>
                              {r.retry_count > 0 && <span className="text-orange-500">リトライ {r.retry_count}回</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'list' && (
            <div className="space-y-4">
              {/* Status filter */}
              <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1 w-fit">
                {[
                  { val: 'failed', label: '失敗' },
                  { val: 'retry_pending', label: 'リトライ待ち' },
                  { val: 'all', label: '全件' },
                ].map(f => (
                  <button key={f.val} onClick={() => setStatusFilter(f.val)} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${statusFilter === f.val ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {errors.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">該当する配信エラーはありません</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ユーザー</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">シナリオ</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">エラー</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">リトライ</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">日時</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {errors.map(e => (
                          <tr key={e.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{e.user_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{e.scenario_name}</td>
                            <td className="px-4 py-3">
                              <p className="text-xs text-red-600 max-w-xs truncate">{e.error_message || '-'}</p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${e.retry_count >= e.max_retries ? 'bg-red-100 text-red-700' : e.retry_count > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                                {e.retry_count}/{e.max_retries}
                              </span>
                              {e.next_retry_at && e.retry_count < e.max_retries && (
                                <div className="text-[10px] text-gray-400 mt-0.5">
                                  次回: {new Date(e.next_retry_at).toLocaleTimeString('ja-JP')}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">{new Date(e.created_at).toLocaleString('ja-JP')}</td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleRetry(e.id)}
                                disabled={retrying.has(e.id) || e.status === 'sent'}
                                className="px-3 py-1 bg-orange-500 text-white rounded text-xs font-medium hover:bg-orange-600 disabled:opacity-50"
                              >
                                {retrying.has(e.id) ? '...' : 'リトライ'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {pagination.total > pagination.limit && (
                  <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-xs text-gray-500">全{pagination.total}件中 {(pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}件</span>
                    <div className="flex gap-1">
                      <button onClick={() => loadErrors(pagination.page - 1)} disabled={pagination.page <= 1} className="px-3 py-1 bg-gray-100 rounded text-xs disabled:opacity-50">&lt;</button>
                      <button onClick={() => loadErrors(pagination.page + 1)} disabled={pagination.page * pagination.limit >= pagination.total} className="px-3 py-1 bg-gray-100 rounded text-xs disabled:opacity-50">&gt;</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    red: 'border-red-200 bg-red-50 text-red-700',
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
    green: 'border-green-200 bg-green-50 text-green-700',
    yellow: 'border-yellow-200 bg-yellow-50 text-yellow-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || 'border-gray-200 bg-white text-gray-900'}`}>
      <div className="text-xs opacity-75 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
