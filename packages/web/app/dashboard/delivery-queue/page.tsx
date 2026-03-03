'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface Queue {
  id: string;
  name: string;
  message_content: string;
  message_type: string;
  target_type: string;
  target_config: string | null;
  status: string;
  total_count: number;
  sent_count: number;
  failed_count: number;
  batch_size: number;
  throttle_ms: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

interface QueueDetail extends Queue {
  item_stats: { status: string; count: number }[];
  recent_failures: { id: string; user_id: string; display_name: string; error_message: string }[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '待機中', color: 'bg-gray-100 text-gray-700' },
  processing: { label: '処理中', color: 'bg-blue-100 text-blue-700' },
  paused: { label: '一時停止', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: '完了', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'キャンセル', color: 'bg-red-100 text-red-700' },
};

const TARGET_LABELS: Record<string, string> = {
  all: '全ユーザー',
  tag: 'タグ指定',
  segment: 'セグメント',
};

export default function DeliveryQueuePage() {
  const [tab, setTab] = useState<'list' | 'create'>('list');
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedQueue, setSelectedQueue] = useState<QueueDetail | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const API = getApiUrl();

  // Create form state
  const [form, setForm] = useState({
    name: '',
    message_content: '',
    target_type: 'all',
    target_config: '',
    batch_size: 50,
    throttle_ms: 200,
  });
  const [creating, setCreating] = useState(false);

  const fetchQueues = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetchWithAuth(`${API}/api/delivery-queue?${params}`);
      const json = await res.json();
      if (json.success) {
        setQueues(json.data);
        setTotalPages(json.pagination.totalPages);
      }
    } catch (err) {
      console.error('Failed to fetch queues:', err);
    } finally {
      setLoading(false);
    }
  }, [API, page, statusFilter]);

  useEffect(() => {
    fetchQueues();
  }, [fetchQueues]);

  // Poll progress for processing queues
  useEffect(() => {
    const hasProcessing = queues.some((q) => q.status === 'processing');
    if (hasProcessing) {
      pollRef.current = setInterval(() => {
        fetchQueues();
      }, 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [queues, fetchQueues]);

  const fetchDetail = async (id: string) => {
    try {
      const res = await fetchWithAuth(`${API}/api/delivery-queue/${id}`);
      const json = await res.json();
      if (json.success) setSelectedQueue(json.data);
    } catch (err) {
      console.error('Failed to fetch detail:', err);
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.message_content) return;
    setCreating(true);
    try {
      const res = await fetchWithAuth(`${API}/api/delivery-queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setForm({ name: '', message_content: '', target_type: 'all', target_config: '', batch_size: 50, throttle_ms: 200 });
        setTab('list');
        await fetchQueues();
      } else {
        alert(json.error || '作成に失敗しました');
      }
    } catch (err) {
      console.error('Create error:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (id: string, action: 'start' | 'pause' | 'cancel') => {
    setProcessingId(id);
    try {
      const res = await fetchWithAuth(`${API}/api/delivery-queue/${id}/${action}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!json.success) alert(json.error || '操作に失敗しました');
      await fetchQueues();
      if (selectedQueue?.id === id) await fetchDetail(id);
    } catch (err) {
      console.error('Action error:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このキューを削除しますか？')) return;
    try {
      const res = await fetchWithAuth(`${API}/api/delivery-queue/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) alert(json.error || '削除に失敗しました');
      else {
        if (selectedQueue?.id === id) setSelectedQueue(null);
        await fetchQueues();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">配信キュー管理</h2>
          <p className="text-sm text-gray-500 mt-1">大量配信のバッチ分割・スロットリング・進捗管理</p>
        </div>
        <button
          onClick={() => setTab(tab === 'create' ? 'list' : 'create')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'create' ? 'bg-gray-200 text-gray-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {tab === 'create' ? '一覧に戻る' : '+ 新規キュー作成'}
        </button>
      </div>

      {/* Create form */}
      {tab === 'create' && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">新規配信キュー</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">キュー名</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="例: 春のキャンペーン配信"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">配信対象</label>
              <select
                value={form.target_type}
                onChange={(e) => setForm({ ...form, target_type: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">全ユーザー</option>
                <option value="tag">タグ指定</option>
              </select>
            </div>
          </div>
          {form.target_type === 'tag' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">タグ名 (カンマ区切り)</label>
              <input
                type="text"
                value={form.target_config}
                onChange={(e) => setForm({ ...form, target_config: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="例: VIP,購入済み"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メッセージ内容</label>
            <textarea
              value={form.message_content}
              onChange={(e) => setForm({ ...form, message_content: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm h-24 resize-none"
              placeholder="配信するメッセージを入力"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">バッチサイズ</label>
              <input
                type="number"
                value={form.batch_size}
                onChange={(e) => setForm({ ...form, batch_size: parseInt(e.target.value) || 50 })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                min={1}
                max={200}
              />
              <p className="text-xs text-gray-400 mt-1">1バッチあたりの送信数 (1-200)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">スロットリング (ms)</label>
              <input
                type="number"
                value={form.throttle_ms}
                onChange={(e) => setForm({ ...form, throttle_ms: parseInt(e.target.value) || 200 })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                min={50}
                max={5000}
                step={50}
              />
              <p className="text-xs text-gray-400 mt-1">メッセージ間の待機時間 (50-5000ms)</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setTab('list')}
              className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !form.name || !form.message_content}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {creating ? '作成中...' : 'キューを作成'}
            </button>
          </div>
        </div>
      )}

      {/* Queue List */}
      {tab === 'list' && (
        <div className="space-y-4">
          {/* Status filter */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: '', label: '全て' },
              { key: 'pending', label: '待機中' },
              { key: 'processing', label: '処理中' },
              { key: 'paused', label: '一時停止' },
              { key: 'completed', label: '完了' },
              { key: 'cancelled', label: 'キャンセル' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => { setStatusFilter(f.key); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === f.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400">読み込み中...</div>
          ) : queues.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-gray-500">配信キューがありません</p>
              <button
                onClick={() => setTab('create')}
                className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
              >
                新規作成
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {queues.map((q) => {
                const processed = q.sent_count + q.failed_count;
                const progress = q.total_count > 0 ? (processed / q.total_count) * 100 : 0;
                const statusInfo = STATUS_LABELS[q.status] || STATUS_LABELS.pending;

                return (
                  <div key={q.id} className="bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            onClick={() => fetchDetail(q.id)}
                            className="font-semibold text-gray-900 hover:text-indigo-600 truncate"
                          >
                            {q.name}
                          </button>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">{q.message_content}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>{TARGET_LABELS[q.target_type] || q.target_type}</span>
                          <span>対象: {q.total_count}件</span>
                          <span>バッチ: {q.batch_size}</span>
                          <span>{new Date(q.created_at).toLocaleString('ja-JP')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {(q.status === 'pending' || q.status === 'paused') && (
                          <button
                            onClick={() => handleAction(q.id, 'start')}
                            disabled={processingId === q.id}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                          >
                            {q.status === 'paused' ? '再開' : '開始'}
                          </button>
                        )}
                        {q.status === 'processing' && (
                          <button
                            onClick={() => handleAction(q.id, 'pause')}
                            disabled={processingId === q.id}
                            className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-xs font-medium hover:bg-yellow-600 disabled:opacity-50"
                          >
                            一時停止
                          </button>
                        )}
                        {q.status !== 'completed' && q.status !== 'cancelled' && (
                          <button
                            onClick={() => handleAction(q.id, 'cancel')}
                            disabled={processingId === q.id}
                            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50"
                          >
                            キャンセル
                          </button>
                        )}
                        {(q.status === 'completed' || q.status === 'cancelled') && (
                          <button
                            onClick={() => handleDelete(q.id)}
                            className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50"
                          >
                            削除
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>
                          {processed}/{q.total_count} 処理済み
                          {q.failed_count > 0 && (
                            <span className="text-red-500 ml-2">({q.failed_count} 失敗)</span>
                          )}
                        </span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full flex">
                          <div
                            className="bg-green-500 transition-all duration-300"
                            style={{ width: `${q.total_count > 0 ? (q.sent_count / q.total_count) * 100 : 0}%` }}
                          />
                          <div
                            className="bg-red-400 transition-all duration-300"
                            style={{ width: `${q.total_count > 0 ? (q.failed_count / q.total_count) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-30"
              >
                前へ
              </button>
              <span className="px-3 py-1 text-sm text-gray-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 border rounded text-sm disabled:opacity-30"
              >
                次へ
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedQueue && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedQueue(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{selectedQueue.name}</h3>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_LABELS[selectedQueue.status]?.color}`}>
                  {STATUS_LABELS[selectedQueue.status]?.label}
                </span>
              </div>
              <button onClick={() => setSelectedQueue(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Progress */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">進捗</span>
                  <span className="font-bold">
                    {selectedQueue.sent_count + selectedQueue.failed_count}/{selectedQueue.total_count}
                  </span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full flex">
                    <div
                      className="bg-green-500"
                      style={{ width: `${selectedQueue.total_count > 0 ? (selectedQueue.sent_count / selectedQueue.total_count) * 100 : 0}%` }}
                    />
                    <div
                      className="bg-red-400"
                      style={{ width: `${selectedQueue.total_count > 0 ? (selectedQueue.failed_count / selectedQueue.total_count) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-green-700">{selectedQueue.sent_count}</p>
                  <p className="text-xs text-green-600">送信成功</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-red-700">{selectedQueue.failed_count}</p>
                  <p className="text-xs text-red-600">失敗</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-gray-700">
                    {selectedQueue.total_count - selectedQueue.sent_count - selectedQueue.failed_count}
                  </p>
                  <p className="text-xs text-gray-600">残り</p>
                </div>
              </div>

              {/* Config */}
              <div className="text-sm space-y-2">
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">配信対象</span>
                  <span className="text-gray-900">{TARGET_LABELS[selectedQueue.target_type]}</span>
                </div>
                {selectedQueue.target_config && (
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-500">対象設定</span>
                    <span className="text-gray-900">{selectedQueue.target_config}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">バッチサイズ</span>
                  <span className="text-gray-900">{selectedQueue.batch_size}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">スロットリング</span>
                  <span className="text-gray-900">{selectedQueue.throttle_ms}ms</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">作成日時</span>
                  <span className="text-gray-900">{new Date(selectedQueue.created_at).toLocaleString('ja-JP')}</span>
                </div>
                {selectedQueue.started_at && (
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-500">開始日時</span>
                    <span className="text-gray-900">{new Date(selectedQueue.started_at).toLocaleString('ja-JP')}</span>
                  </div>
                )}
                {selectedQueue.completed_at && (
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-500">完了日時</span>
                    <span className="text-gray-900">{new Date(selectedQueue.completed_at).toLocaleString('ja-JP')}</span>
                  </div>
                )}
              </div>

              {/* Message preview */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">メッセージ内容</p>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                  {selectedQueue.message_content}
                </div>
              </div>

              {/* Recent failures */}
              {selectedQueue.recent_failures && selectedQueue.recent_failures.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">最近の失敗 ({selectedQueue.recent_failures.length}件)</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedQueue.recent_failures.map((f) => (
                      <div key={f.id} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2 text-xs">
                        <span className="text-gray-700">{f.display_name || f.user_id.slice(0, 12)}</span>
                        <span className="text-red-600 truncate ml-2 max-w-[200px]">{f.error_message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
