'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

const API = getApiUrl();

interface TaskResult {
  processed: number;
  sent: number;
  failed: number;
}

interface LastRun {
  timestamp: string;
  duration: number;
  results: {
    scenarioDeliveries?: TaskResult;
    scheduledDeliveries?: TaskResult;
    retries?: TaskResult;
    cacheCleanup?: { removedEntries: number };
  };
  errors?: string[];
  triggeredBy: string;
}

interface PendingCounts {
  scenarioDeliveries: number;
  scheduledDeliveries: number;
  retries: number;
  expiredCache: number;
  totalCache: number;
}

interface RunResult {
  timestamp: string;
  duration: string;
  results: Record<string, unknown>;
  errors?: string[];
}

const TASKS = [
  { id: 'scenario-deliveries', label: 'シナリオ配信', desc: 'スケジュール済みのシナリオステップ配信を処理', icon: '📨' },
  { id: 'scheduled-deliveries', label: '予約配信', desc: 'ペンディング中の予約配信ジョブを実行', icon: '📅' },
  { id: 'retries', label: 'リトライ', desc: '失敗した配信のリトライ（指数バックオフ）', icon: '🔄' },
  { id: 'cache-cleanup', label: 'キャッシュクリーンアップ', desc: '期限切れキャッシュエントリを削除', icon: '🧹' },
];

export default function CronTasksPage() {
  const [loading, setLoading] = useState(true);
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [pending, setPending] = useState<PendingCounts | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API}/api/cron-tasks/status`);
      const data = await res.json();
      if (data.success) {
        setLastRun(data.data.lastRun);
        setPending(data.data.pending);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const runAll = async () => {
    setRunning('all');
    setRunResult(null);
    setError('');
    try {
      const res = await fetchWithAuth(`${API}/api/cron-tasks/run`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setRunResult(data.data);
        await loadStatus();
      } else {
        setError(data.error || '実行に失敗しました');
      }
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setRunning(null);
    }
  };

  const runTask = async (taskId: string) => {
    setRunning(taskId);
    setRunResult(null);
    setError('');
    try {
      const res = await fetchWithAuth(`${API}/api/cron-tasks/run/${taskId}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setRunResult(data.data);
        await loadStatus();
      } else {
        setError(data.error || '実行に失敗しました');
      }
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setRunning(null);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('ja-JP', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch { return iso; }
  };

  const totalPending = pending
    ? pending.scenarioDeliveries + pending.scheduledDeliveries + pending.retries + pending.expiredCache
    : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">定期タスク管理</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-32 mb-3" />
              <div className="h-8 bg-gray-200 rounded mb-3" />
              <div className="h-4 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">定期タスク管理</h1>
          <p className="text-sm text-gray-500 mt-1">予約配信・リトライ・キャッシュ管理の手動実行と状態確認</p>
        </div>
        <button
          onClick={runAll}
          disabled={running !== null}
          className="px-5 py-2.5 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {running === 'all' ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              実行中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              全タスク実行
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
          <span className="text-sm text-red-600">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">待機中タスク</p>
          <p className={`text-2xl font-bold ${totalPending > 0 ? 'text-orange-600' : 'text-gray-900'}`}>{totalPending}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">シナリオ配信</p>
          <p className="text-2xl font-bold text-gray-900">{pending?.scenarioDeliveries ?? '-'}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">予約配信</p>
          <p className="text-2xl font-bold text-gray-900">{pending?.scheduledDeliveries ?? '-'}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">リトライ待ち</p>
          <p className="text-2xl font-bold text-gray-900">{pending?.retries ?? '-'}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">キャッシュ</p>
          <p className="text-sm font-medium text-gray-900">{pending?.expiredCache ?? 0}<span className="text-gray-400">/{pending?.totalCache ?? 0}</span></p>
          <p className="text-xs text-gray-400">期限切れ/合計</p>
        </div>
      </div>

      {/* Last Run */}
      {lastRun && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">前回の実行結果</h3>
          <div className="flex flex-wrap gap-4 text-sm mb-3">
            <span className="text-gray-500">実行日時: <span className="text-gray-900 font-medium">{formatDate(lastRun.timestamp)}</span></span>
            <span className="text-gray-500">処理時間: <span className="text-gray-900 font-medium">{lastRun.duration}ms</span></span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {lastRun.results.scenarioDeliveries && (
              <ResultCard label="シナリオ配信" result={lastRun.results.scenarioDeliveries} />
            )}
            {lastRun.results.scheduledDeliveries && (
              <ResultCard label="予約配信" result={lastRun.results.scheduledDeliveries} />
            )}
            {lastRun.results.retries && (
              <ResultCard label="リトライ" result={lastRun.results.retries} />
            )}
            {lastRun.results.cacheCleanup && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">キャッシュ</p>
                <p className="text-sm font-medium text-gray-900">{lastRun.results.cacheCleanup.removedEntries}件削除</p>
              </div>
            )}
          </div>
          {lastRun.errors && lastRun.errors.length > 0 && (
            <div className="mt-3 bg-red-50 rounded-lg p-3">
              <p className="text-xs text-red-600 font-medium mb-1">エラー:</p>
              {lastRun.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-500">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Run Result (current session) */}
      {runResult && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-sm font-semibold text-green-900">実行完了</h3>
            <span className="text-xs text-green-600 ml-auto">{runResult.duration}</span>
          </div>
          <pre className="text-xs text-green-800 bg-green-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(runResult.results, null, 2)}
          </pre>
          {runResult.errors && runResult.errors.length > 0 && (
            <div className="mt-2">
              {runResult.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Individual Task Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TASKS.map(task => (
          <div key={task.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{task.icon}</span>
                  <h4 className="font-medium text-gray-900">{task.label}</h4>
                </div>
                <p className="text-sm text-gray-500">{task.desc}</p>
              </div>
              <button
                onClick={() => runTask(task.id)}
                disabled={running !== null}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
              >
                {running === task.id ? (
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                )}
                実行
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* External Cron Setup Guide */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          外部Cronサービスで自動実行する方法
        </h3>
        <div className="text-sm text-gray-600 space-y-3">
          <p>
            Cloudflare Workers Free planのCron Trigger上限(5/5)に達しているため、
            外部のCronサービスを使ってHTTPリクエストで定期実行できます。
          </p>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">エンドポイント:</p>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-800 block break-all">
              POST https://line-ai-marketing-api.common-gifted-tokyo.workers.dev/api/cron-tasks/run
            </code>
            <p className="text-xs text-gray-500 mt-2 mb-1">必要なヘッダー:</p>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-800 block">
              Authorization: Bearer &lt;admin JWT token&gt;
            </code>
            <p className="text-xs text-gray-500 mt-2">推奨間隔: 5分ごと (*/5 * * * *)</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">無料のCronサービス:</p>
            <div className="flex flex-wrap gap-2">
              <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">
                cron-job.org
              </a>
              <a href="https://www.easycron.com" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">
                EasyCron
              </a>
              <a href="https://uptimerobot.com" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">
                UptimeRobot
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ label, result }: { label: string; result: TaskResult }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-900 font-medium">{result.processed}件処理</span>
        {result.sent > 0 && <span className="text-green-600">{result.sent}成功</span>}
        {result.failed > 0 && <span className="text-red-600">{result.failed}失敗</span>}
      </div>
    </div>
  );
}
