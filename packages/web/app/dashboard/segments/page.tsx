'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';

// ─── V2 Types ───

type ConditionType = 'tag' | 'attribute' | 'status' | 'last_message_days' | 'engagement_score' | 'conversion' | 'follow_source';
type Operator = 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'exists' | 'not_exists';

interface ConditionV2 {
  type: ConditionType;
  operator: Operator;
  field: string;
  value: string;
}

interface ConditionGroupV2 {
  logic: 'AND' | 'OR';
  negate?: boolean;
  items: (ConditionV2 | ConditionGroupV2)[];
}

function isGroup(item: ConditionV2 | ConditionGroupV2): item is ConditionGroupV2 {
  return 'logic' in item && 'items' in item;
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

// ─── Auth ───

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

// ─── Labels & Options ───

const TYPE_LABELS: Record<ConditionType, string> = {
  tag: 'タグ',
  attribute: '属性',
  status: 'ステータス',
  last_message_days: '最終メッセージ日数',
  engagement_score: 'エンゲージメントスコア',
  conversion: 'コンバージョン',
  follow_source: '友だち追加経路',
};

const OP_LABELS: Record<Operator, string> = {
  eq: '等しい', neq: '等しくない', contains: '含む',
  gt: 'より大きい', lt: 'より小さい', gte: '以上', lte: '以下',
  exists: '存在する', not_exists: '存在しない',
};

const OPS_BY_TYPE: Record<ConditionType, Operator[]> = {
  tag: ['eq', 'neq', 'contains', 'exists', 'not_exists'],
  attribute: ['eq', 'neq', 'contains', 'gt', 'lt', 'gte', 'lte', 'exists', 'not_exists'],
  status: ['eq', 'neq'],
  last_message_days: ['lt', 'gt', 'eq'],
  engagement_score: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'],
  conversion: ['exists', 'not_exists', 'gt', 'lt'],
  follow_source: ['eq', 'neq', 'contains'],
};

const FIELD_OPTIONS: Partial<Record<ConditionType, { label: string; value: string }[]>> = {
  engagement_score: [
    { label: 'スコア', value: 'score' },
    { label: 'ランク', value: 'rank' },
  ],
  conversion: [
    { label: 'ゴール名', value: 'goal' },
    { label: '件数', value: 'count' },
  ],
  follow_source: [
    { label: 'タイプ', value: 'type' },
    { label: '名前', value: 'name' },
  ],
};

const PLACEHOLDER: Record<ConditionType, string> = {
  tag: 'タグ名',
  attribute: '値',
  status: 'active / blocked',
  last_message_days: '日数',
  engagement_score: 'スコア値 or S/A/B/C/D',
  conversion: 'ゴール名 or 件数',
  follow_source: 'QR / URL / 広告 / SNS',
};

// ─── Helper ───

const emptyCondition = (): ConditionV2 => ({ type: 'tag', operator: 'eq', field: '', value: '' });
const emptyGroup = (): ConditionGroupV2 => ({ logic: 'AND', items: [emptyCondition()] });

// ─── Condition Row ───

function ConditionRow({
  condition, onChange, onRemove, canRemove,
}: {
  condition: ConditionV2;
  onChange: (c: ConditionV2) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const sel = 'px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const inp = sel + ' flex-1 min-w-[100px]';
  const fieldOpts = FIELD_OPTIONS[condition.type];
  const needsValue = !['exists', 'not_exists'].includes(condition.operator);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={condition.type}
        onChange={e => {
          const t = e.target.value as ConditionType;
          const ops = OPS_BY_TYPE[t];
          const fld = FIELD_OPTIONS[t]?.[0]?.value || '';
          onChange({ type: t, operator: ops[0], field: fld, value: '' });
        }}
        className={sel}
      >
        {(Object.keys(TYPE_LABELS) as ConditionType[]).map(t => (
          <option key={t} value={t}>{TYPE_LABELS[t]}</option>
        ))}
      </select>

      {fieldOpts && (
        <select
          value={condition.field}
          onChange={e => onChange({ ...condition, field: e.target.value })}
          className={sel}
        >
          {fieldOpts.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      )}

      {condition.type === 'attribute' && (
        <input
          type="text"
          value={condition.field}
          onChange={e => onChange({ ...condition, field: e.target.value })}
          placeholder="属性キー"
          className={sel + ' w-28'}
        />
      )}

      <select
        value={condition.operator}
        onChange={e => onChange({ ...condition, operator: e.target.value as Operator })}
        className={sel}
      >
        {OPS_BY_TYPE[condition.type].map(op => (
          <option key={op} value={op}>{OP_LABELS[op]}</option>
        ))}
      </select>

      {needsValue && (
        <input
          type="text"
          value={condition.value}
          onChange={e => onChange({ ...condition, value: e.target.value })}
          placeholder={PLACEHOLDER[condition.type]}
          className={inp}
        />
      )}

      {canRemove && (
        <button onClick={onRemove} className="p-2 text-gray-400 hover:text-red-500" title="削除">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Condition Group (recursive) ───

function ConditionGroupEditor({
  group, onChange, onRemove, depth,
}: {
  group: ConditionGroupV2;
  onChange: (g: ConditionGroupV2) => void;
  onRemove?: () => void;
  depth: number;
}) {
  const borderColors = ['border-blue-200', 'border-purple-200', 'border-green-200', 'border-orange-200'];
  const bgColors = ['bg-blue-50/50', 'bg-purple-50/50', 'bg-green-50/50', 'bg-orange-50/50'];
  const borderColor = borderColors[depth % borderColors.length];
  const bgColor = bgColors[depth % bgColors.length];

  const updateItem = (index: number, item: ConditionV2 | ConditionGroupV2) => {
    const newItems = [...group.items];
    newItems[index] = item;
    onChange({ ...group, items: newItems });
  };

  const removeItem = (index: number) => {
    const newItems = group.items.filter((_, i) => i !== index);
    if (newItems.length === 0) newItems.push(emptyCondition());
    onChange({ ...group, items: newItems });
  };

  const addCondition = () => {
    onChange({ ...group, items: [...group.items, emptyCondition()] });
  };

  const addSubGroup = () => {
    onChange({ ...group, items: [...group.items, emptyGroup()] });
  };

  return (
    <div className={`border-2 ${borderColor} ${bgColor} rounded-xl p-4 space-y-3`}>
      {/* Group header */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Logic toggle */}
        <div className="flex items-center bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => onChange({ ...group, logic: 'AND' })}
            className={`px-3 py-1.5 text-xs font-bold transition-colors ${
              group.logic === 'AND' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            AND
          </button>
          <button
            onClick={() => onChange({ ...group, logic: 'OR' })}
            className={`px-3 py-1.5 text-xs font-bold transition-colors ${
              group.logic === 'OR' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            OR
          </button>
        </div>

        <span className="text-xs text-gray-500">
          {group.logic === 'AND' ? 'すべての条件に一致' : 'いずれかの条件に一致'}
        </span>

        {/* Negate toggle */}
        <button
          onClick={() => onChange({ ...group, negate: !group.negate })}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
            group.negate
              ? 'bg-red-100 text-red-700 border-red-300'
              : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
          }`}
        >
          NOT
        </button>

        {group.negate && (
          <span className="text-xs text-red-600">条件を反転</span>
        )}

        {/* Remove group button */}
        {onRemove && (
          <button onClick={onRemove} className="ml-auto p-1.5 text-gray-400 hover:text-red-500" title="グループ削除">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Items */}
      <div className="space-y-2">
        {group.items.map((item, i) => (
          <div key={i}>
            {i > 0 && (
              <div className="flex items-center gap-2 py-1">
                <div className="flex-1 border-t border-gray-200" />
                <span className={`text-xs font-bold ${group.logic === 'AND' ? 'text-blue-500' : 'text-orange-500'}`}>
                  {group.logic}
                </span>
                <div className="flex-1 border-t border-gray-200" />
              </div>
            )}
            {isGroup(item) ? (
              <ConditionGroupEditor
                group={item}
                onChange={g => updateItem(i, g)}
                onRemove={() => removeItem(i)}
                depth={depth + 1}
              />
            ) : (
              <ConditionRow
                condition={item}
                onChange={c => updateItem(i, c)}
                onRemove={() => removeItem(i)}
                canRemove={group.items.length > 1}
              />
            )}
          </div>
        ))}
      </div>

      {/* Add buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={addCondition}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-600 hover:bg-white hover:border-gray-400 transition-colors"
        >
          + 条件追加
        </button>
        {depth < 3 && (
          <button
            onClick={addSubGroup}
            className="px-3 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs font-medium text-gray-500 hover:bg-white hover:border-gray-400 transition-colors"
          >
            + サブグループ
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───

export default function SegmentsPage() {
  const [rootGroup, setRootGroup] = useState<ConditionGroupV2>(emptyGroup());
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

  const handlePreview = async () => {
    setPreviewLoading(true); setPreviewError(null); setPreviewCount(null); setPreviewUsers([]);
    try {
      const res = await authFetch(`${API_BASE}/api/segments/preview`, {
        method: 'POST', body: JSON.stringify({ condition_group: rootGroup }),
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
        body: JSON.stringify({ condition_group: rootGroup, message: { type: 'text', text: messageText } }),
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

  const handleReset = () => {
    setRootGroup(emptyGroup());
    setPreviewCount(null);
    setPreviewUsers([]);
    setPreviewError(null);
    setSendResult(null);
    setSendError(null);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* 条件ビルダー V2 */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">セグメント条件</h2>
            <p className="text-xs text-gray-500 mt-1">AND/OR/NOT を組み合わせた高度な条件指定が可能です</p>
          </div>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            リセット
          </button>
        </div>

        <ConditionGroupEditor
          group={rootGroup}
          onChange={setRootGroup}
          depth={0}
        />

        <div className="flex gap-3 mt-4">
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
