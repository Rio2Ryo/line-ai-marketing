'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';

interface SegmentCondition {
  type: 'tag' | 'attribute' | 'status' | 'last_message_days';
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt';
  field: string;
  value: string;
}

interface PreviewUser {
  id: string;
  display_name: string | null;
  picture_url: string | null;
}

interface DeliveryLog {
  id: string;
  conditions: string;
  message_text: string;
  sent: number;
  failed: number;
  created_at: string;
}

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function authFetch(url: string, opts: RequestInit = {}) {
  return fetch(url, { ...opts, credentials: 'include', headers: { ...authHeaders(), ...(opts.headers as Record<string, string> || {}) } });
}

const TYPE_LABELS: Record<SegmentCondition['type'], string> = {
  tag: 'タグ', attribute: '属性', status: 'ステータス', last_message_days: '最終メッセージ日数',
};
const OP_LABELS: Record<SegmentCondition['operator'], string> = {
  eq: '等しい', neq: '等しくない', contains: '含む', gt: 'より大きい', lt: 'より小さい',
};
const OPS_BY_TYPE: Record<SegmentCondition['type'], SegmentCondition['operator'][]> = {
  tag: ['eq', 'neq', 'contains'], attribute: ['eq', 'neq', 'contains', 'gt', 'lt'],
  status: ['eq', 'neq'], last_message_days: ['lt', 'gt', 'eq'],
};

const empty = (): SegmentCondition => ({ type: 'tag', operator: 'eq', field: '', value: '' });

export default function SegmentsPage() {
  const [conditions, setConditions] = useState<SegmentCondition[]>([empty()]);
  const [previewUsers, setPreviewUsers] = useState<PreviewUser[]>([]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [history, setHistory] = useState<DeliveryLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(1);

  const fetchHistory = useCallback(async (page: number) => {
    setHistoryLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/api/segments/history?page=${page}&limit=10`);
      if (res.ok) {
        const json = await res.json();
        setHistory(json.data || []);
        setHistoryTotal(json.pagination?.totalPages || 1);
      }
    } catch (e) {
      console.error('配信履歴の取得に失敗しました', e);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(historyPage); }, [fetchHistory, historyPage]);

  const updateCondition = (i: number, key: keyof SegmentCondition, val: string) => {
    setConditions(prev => {
      const next = [...prev];
      if (key === 'type') {
        const t = val as SegmentCondition['type'];
        next[i] = { type: t, operator: OPS_BY_TYPE[t][0], field: '', value: '' };
      } else {
        next[i] = { ...next[i], [key]: val };
      }
      return next;
    });
  };

  const handlePreview = async () => {
    setPreviewLoading(true); setPreviewError(null); setPreviewCount(null); setPreviewUsers([]);
    try {
      const res = await authFetch(`${API_BASE}/api/segments/preview`, {
        method: 'POST', body: JSON.stringify({ conditions }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'プレビューに失敗しました');
      setPreviewCount(json.data.count);
      setPreviewUsers(json.data.users || []);
    } catch (e: unknown) {
      setPreviewError(e instanceof Error ? e.message : 'プレビューに失敗しました');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSend = async () => {
    if (!messageText.trim() || previewCount === null || previewCount === 0) {
      alert('先にプレビューで対象者を確認してください');
      return;
    }
    if (!window.confirm(`${previewCount}人にメッセージを配信します。よろしいですか？`)) return;
    setSending(true); setSendResult(null); setSendError(null);
    try {
      const res = await authFetch(`${API_BASE}/api/segments/send`, {
        method: 'POST',
        body: JSON.stringify({ conditions, message: { type: 'text', text: messageText } }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '配信に失敗しました');
      setSendResult(json.data);
      setHistoryPage(1);
      fetchHistory(1);
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : '配信に失敗しました');
    } finally {
      setSending(false);
    }
  };

  const sel = 'px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const inp = sel + ' flex-1 min-w-[120px]';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* 条件ビルダー */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">セグメント条件</h2>
        <div className="space-y-3">
          {conditions.map((c, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <select value={c.type} onChange={e => updateCondition(i, 'type', e.target.value)} className={sel}>
                {(Object.keys(TYPE_LABELS) as SegmentCondition['type'][]).map(t => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
              {c.type === 'attribute' && (
                <input type="text" value={c.field} onChange={e => updateCondition(i, 'field', e.target.value)}
                  placeholder="属性キー" className={sel + ' w-28'} />
              )}
              <select value={c.operator} onChange={e => updateCondition(i, 'operator', e.target.value)} className={sel}>
                {OPS_BY_TYPE[c.type].map(op => (
                  <option key={op} value={op}>{OP_LABELS[op]}</option>
                ))}
              </select>
              <input type="text" value={c.value} onChange={e => updateCondition(i, 'value', e.target.value)}
                placeholder={c.type === 'tag' ? 'タグ名' : c.type === 'status' ? 'active / blocked' : c.type === 'last_message_days' ? '日数' : '値'}
                className={inp} />
              {conditions.length > 1 && (
                <button onClick={() => setConditions(prev => prev.filter((_, j) => j !== i))}
                  className="p-2 text-gray-400 hover:text-red-500" title="削除">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={() => setConditions(p => [...p, empty()])}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            + 条件追加
          </button>
          <button onClick={handlePreview} disabled={previewLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {previewLoading ? '読み込み中...' : 'プレビュー'}
          </button>
        </div>

        {previewError && <p className="mt-3 text-sm text-red-600">{previewError}</p>}

        {previewCount !== null && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl">
            <p className="text-sm font-medium text-gray-900 mb-2">
              対象者: <span className="text-blue-600 font-bold text-lg">{previewCount}</span> 人
            </p>
            {previewUsers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {previewUsers.slice(0, 20).map(u => (
                  <div key={u.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-gray-200 text-sm">
                    {u.picture_url
                      ? <img src={u.picture_url} alt="" className="w-6 h-6 rounded-full" />
                      : <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-white">?</div>}
                    <span className="text-gray-700">{u.display_name || '不明'}</span>
                  </div>
                ))}
                {previewUsers.length > 20 && (
                  <span className="text-sm text-gray-400 self-center">...他 {previewUsers.length - 20} 人</span>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* メッセージ入力 */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">配信メッセージ</h2>
        <textarea value={messageText} onChange={e => setMessageText(e.target.value)} rows={4}
          placeholder="配信するメッセージを入力してください"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
        <div className="flex items-center gap-4 mt-4">
          <button onClick={handleSend}
            disabled={sending || !messageText.trim() || previewCount === null || previewCount === 0}
            className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {sending ? '配信中...' : '配信実行'}
          </button>
          {sendResult && (
            <p className="text-sm">
              <span className="text-green-600 font-medium">成功: {sendResult.sent}件</span>
              {sendResult.failed > 0 && <span className="text-red-500 font-medium ml-3">失敗: {sendResult.failed}件</span>}
            </p>
          )}
          {sendError && <p className="text-sm text-red-600">{sendError}</p>}
        </div>
      </section>

      {/* 配信履歴 */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">配信履歴</h2>
        {historyLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="animate-pulse flex gap-3">
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded w-1/6" />
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-500">配信履歴はありません</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="py-2 px-3 font-medium text-gray-500">配信日時</th>
                    <th className="py-2 px-3 font-medium text-gray-500">メッセージ</th>
                    <th className="py-2 px-3 font-medium text-gray-500">条件</th>
                    <th className="py-2 px-3 font-medium text-gray-500">成功</th>
                    <th className="py-2 px-3 font-medium text-gray-500">失敗</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-600 whitespace-nowrap">
                        {new Date(h.created_at).toLocaleString('ja-JP')}
                      </td>
                      <td className="py-2 px-3 text-gray-900 max-w-[200px] truncate">{h.message_text}</td>
                      <td className="py-2 px-3 text-gray-500 max-w-[160px] truncate text-xs">{h.conditions}</td>
                      <td className="py-2 px-3">
                        <span className="text-green-600 font-medium">{h.sent}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={h.failed > 0 ? 'text-red-500 font-medium' : 'text-gray-400'}>{h.failed}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {historyTotal > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage <= 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50">
                  前へ
                </button>
                <span className="text-sm text-gray-500">{historyPage} / {historyTotal}</span>
                <button onClick={() => setHistoryPage(p => Math.min(historyTotal, p + 1))} disabled={historyPage >= historyTotal}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50">
                  次へ
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
