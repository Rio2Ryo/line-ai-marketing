'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { useRole } from '@/lib/role';

interface Summary {
  period_days: number;
  total_requests: number;
  error_count: number;
  error_rate: string;
  avg_response_ms: number;
  max_response_ms: number;
  min_response_ms: number;
  status_distribution: Array<{ status_group: string; count: number }>;
}

interface EndpointStat {
  method: string;
  path: string;
  request_count: number;
  avg_response_ms: number;
  max_response_ms: number;
  error_count: number;
  error_rate: string;
}

interface DailyData {
  date: string;
  total: number;
  errors: number;
  avg_response_ms: number;
}

interface ErrorLog {
  id: string;
  method: string;
  path: string;
  status_code: number;
  response_time_ms: number;
  error_message: string | null;
  ip_address: string | null;
  created_at: string;
}

type Period = 7 | 30 | 90;

export default function ApiMonitorPage() {
  const { locale } = useTranslation();
  const { isAdmin, loading: roleLoading } = useRole();
  const ja = locale === 'ja';

  const [period, setPeriod] = useState<Period>(7);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointStat[]>([]);
  const [daily, setDaily] = useState<DailyData[]>([]);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'endpoints' | 'errors'>('overview');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, epRes, dailyRes, errRes] = await Promise.all([
        fetchWithAuth(`${getApiUrl()}/api/api-monitor/summary?days=${period}`),
        fetchWithAuth(`${getApiUrl()}/api/api-monitor/endpoints?days=${period}`),
        fetchWithAuth(`${getApiUrl()}/api/api-monitor/daily?days=${period}`),
        fetchWithAuth(`${getApiUrl()}/api/api-monitor/errors?limit=50`),
      ]);

      const [sumJson, epJson, dailyJson, errJson] = await Promise.all([
        sumRes.json(), epRes.json(), dailyRes.json(), errRes.json(),
      ]);

      if (sumJson.success) setSummary(sumJson.data);
      if (epJson.success) setEndpoints(epJson.data);
      if (dailyJson.success) setDaily(dailyJson.data);
      if (errJson.success) setErrors(errJson.data);
    } catch (e) {
      console.error('Failed to fetch API monitor data:', e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">{ja ? 'アクセス権限がありません' : 'Access Denied'}</h2>
          <p className="text-gray-500">{ja ? '管理者のみアクセスできます' : 'Admin access required'}</p>
        </div>
      </div>
    );
  }

  const maxDaily = Math.max(...daily.map(d => d.total), 1);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        {([7, 30, 90] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              period === p ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p}{ja ? '日' : 'd'}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {ja ? '更新' : 'Refresh'}
        </button>
      </div>

      {/* Summary KPI cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{ja ? '総リクエスト数' : 'Total Requests'}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.total_requests.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{ja ? '平均応答時間' : 'Avg Response'}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.avg_response_ms}<span className="text-sm font-normal text-gray-400">ms</span></p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{ja ? 'エラー率' : 'Error Rate'}</p>
            <p className={`text-2xl font-bold mt-1 ${parseFloat(summary.error_rate) > 5 ? 'text-red-600' : parseFloat(summary.error_rate) > 1 ? 'text-yellow-600' : 'text-green-600'}`}>
              {summary.error_rate}%
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{ja ? '最大応答時間' : 'Max Response'}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.max_response_ms}<span className="text-sm font-normal text-gray-400">ms</span></p>
          </div>
        </div>
      )}

      {/* Status distribution */}
      {summary && summary.status_distribution.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">{ja ? 'ステータス分布' : 'Status Distribution'}</h3>
          <div className="flex items-end gap-4 h-16">
            {summary.status_distribution.map(s => {
              const total = summary.total_requests || 1;
              const pct = (s.count / total) * 100;
              const color = s.status_group === '2xx' ? 'bg-green-500' : s.status_group === '3xx' ? 'bg-blue-500' : s.status_group === '4xx' ? 'bg-yellow-500' : 'bg-red-500';
              return (
                <div key={s.status_group} className="flex-1 text-center">
                  <div className="relative mx-auto w-full max-w-20">
                    <div className={`${color} rounded-t`} style={{ height: Math.max(4, pct * 0.6) }} />
                  </div>
                  <p className="text-xs font-bold text-gray-700 mt-1">{s.status_group}</p>
                  <p className="text-xs text-gray-400">{s.count}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['overview', 'endpoints', 'errors'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'overview' ? (ja ? '日別推移' : 'Daily Trend') :
             tab === 'endpoints' ? (ja ? 'エンドポイント別' : 'By Endpoint') :
             ja ? 'エラー詳細' : 'Error Details'}
          </button>
        ))}
      </div>

      {/* Overview tab - Daily chart */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-bold text-gray-700 mb-4">{ja ? '日別リクエスト数' : 'Daily Requests'}</h3>
          {daily.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{ja ? 'データなし' : 'No data'}</p>
          ) : (
            <div className="space-y-4">
              {/* Bar chart */}
              <div className="flex items-end gap-1 h-40">
                {daily.map(d => {
                  const h = (d.total / maxDaily) * 100;
                  const errH = (d.errors / maxDaily) * 100;
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      {/* Tooltip */}
                      <div className="hidden group-hover:block absolute -top-12 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                        {d.date}: {d.total}{ja ? '件' : ' req'} / {d.errors}{ja ? 'エラー' : ' err'} / {d.avg_response_ms}ms
                      </div>
                      <div className="w-full flex flex-col items-center">
                        {d.errors > 0 && (
                          <div className="w-full bg-red-400 rounded-t" style={{ height: `${Math.max(2, errH)}%` }} />
                        )}
                        <div className="w-full bg-blue-400 rounded-t" style={{ height: `${Math.max(2, h - errH)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* X-axis labels (show first, middle, last) */}
              <div className="flex justify-between text-xs text-gray-400">
                <span>{daily[0]?.date?.slice(5)}</span>
                {daily.length > 2 && <span>{daily[Math.floor(daily.length / 2)]?.date?.slice(5)}</span>}
                <span>{daily[daily.length - 1]?.date?.slice(5)}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded" />{ja ? 'リクエスト' : 'Requests'}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded" />{ja ? 'エラー' : 'Errors'}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Endpoints tab */}
      {activeTab === 'endpoints' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{ja ? 'エンドポイント' : 'Endpoint'}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">{ja ? 'リクエスト数' : 'Requests'}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">{ja ? '平均応答' : 'Avg ms'}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">{ja ? '最大応答' : 'Max ms'}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">{ja ? 'エラー' : 'Errors'}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">{ja ? 'エラー率' : 'Error %'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {endpoints.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">{ja ? 'データなし' : 'No data'}</td></tr>
                ) : endpoints.map((ep, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold mr-2 ${
                        ep.method === 'GET' ? 'bg-green-100 text-green-700' :
                        ep.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                        ep.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                        ep.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{ep.method}</span>
                      <span className="text-sm font-mono text-gray-700">{ep.path}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">{ep.request_count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{ep.avg_response_ms}ms</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{ep.max_response_ms}ms</td>
                    <td className="px-4 py-3 text-sm text-right">{ep.error_count > 0 ? <span className="text-red-600 font-medium">{ep.error_count}</span> : <span className="text-gray-400">0</span>}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`${parseFloat(ep.error_rate) > 5 ? 'text-red-600' : parseFloat(ep.error_rate) > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                        {ep.error_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Errors tab */}
      {activeTab === 'errors' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{ja ? '日時' : 'Time'}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{ja ? 'エンドポイント' : 'Endpoint'}</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">{ja ? 'ステータス' : 'Status'}</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">{ja ? '応答時間' : 'Time'}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{ja ? 'エラー' : 'Error'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {errors.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">{ja ? 'エラーなし' : 'No errors'}</td></tr>
                ) : errors.map(err => (
                  <tr key={err.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(err.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold mr-1 ${
                        err.method === 'GET' ? 'bg-green-100 text-green-700' :
                        err.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                        err.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>{err.method}</span>
                      <span className="text-xs font-mono text-gray-700">{err.path}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                        err.status_code >= 500 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>{err.status_code}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{err.response_time_ms}ms</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{err.error_message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
