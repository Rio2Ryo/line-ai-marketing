'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface Classification {
  id: string;
  user_id: string;
  display_name: string | null;
  picture_url: string | null;
  segment: string;
  suggested_tags: string[];
  reasoning: string;
  status: 'pending' | 'applied' | 'dismissed';
  created_at: string;
}

interface Summary {
  total: number;
  pending: number;
  applied: number;
  dismissed: number;
  segments: { segment: string; count: number }[];
}

const segmentColors: Record<string, string> = {
  '高エンゲージメント': 'bg-green-100 text-green-700',
  '購買検討中': 'bg-blue-100 text-blue-700',
  '新規ユーザー': 'bg-purple-100 text-purple-700',
  '休眠リスク': 'bg-red-100 text-red-700',
  '情報収集中': 'bg-yellow-100 text-yellow-700',
  '未分類': 'bg-gray-100 text-gray-700',
};

export default function AiClassifyPage() {
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [batchRunning, setBatchRunning] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      const [listRes, sumRes] = await Promise.all([
        fetchWithAuth(getApiUrl() + `/api/ai/classify?page=${page}&limit=20`),
        fetchWithAuth(getApiUrl() + '/api/ai/classify/summary'),
      ]);

      if (listRes.ok) {
        const listData = await listRes.json();
        setClassifications(listData.data || []);
        setTotalPages(listData.pagination?.totalPages || 1);
      }
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData.data || null);
      }
    } catch (err) {
      console.error('Failed to fetch classifications:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleBatchClassify = async () => {
    setBatchRunning(true);
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/ai/classify/batch', { method: 'POST' });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Batch classification failed:', err);
    } finally {
      setBatchRunning(false);
    }
  };

  const handleApply = async (id: string) => {
    try {
      const res = await fetchWithAuth(getApiUrl() + `/api/ai/classify/${id}/apply`, { method: 'POST' });
      if (res.ok) {
        setClassifications(prev => prev.map(c => c.id === id ? { ...c, status: 'applied' } : c));
        if (summary) setSummary({ ...summary, pending: summary.pending - 1, applied: summary.applied + 1 });
      }
    } catch (err) {
      console.error('Apply failed:', err);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const res = await fetchWithAuth(getApiUrl() + `/api/ai/classify/${id}/dismiss`, { method: 'POST' });
      if (res.ok) {
        setClassifications(prev => prev.map(c => c.id === id ? { ...c, status: 'dismissed' } : c));
        if (summary) setSummary({ ...summary, pending: summary.pending - 1, dismissed: summary.dismissed + 1 });
      }
    } catch (err) {
      console.error('Dismiss failed:', err);
    }
  };

  const getSegmentClass = (segment: string) => {
    return segmentColors[segment] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">AI自動分類</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">AI自動分類</h1>
        <button
          onClick={handleBatchClassify}
          disabled={batchRunning}
          className="px-4 py-2 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {batchRunning ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              分類中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              バッチ分類実行
            </>
          )}
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-sm text-gray-500">総分類数</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.total}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-sm text-gray-500">承認待ち</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{summary.pending}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-sm text-gray-500">適用済み</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{summary.applied}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-sm text-gray-500">却下</p>
            <p className="text-2xl font-bold text-gray-500 mt-1">{summary.dismissed}</p>
          </div>
        </div>
      )}

      {/* Segment distribution */}
      {summary && summary.segments.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">セグメント分布 (過去30日)</h3>
          <div className="flex flex-wrap gap-3">
            {summary.segments.map((seg) => (
              <div key={seg.segment} className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSegmentClass(seg.segment)}`}>
                  {seg.segment}
                </span>
                <span className="text-sm text-gray-500">{seg.count}件</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Classification list */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">分類結果</h3>
        </div>

        {classifications.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p>分類結果がありません</p>
            <p className="text-sm mt-1">「バッチ分類実行」でユーザーを自動分類できます</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {classifications.map((c) => (
              <div key={c.id} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {c.picture_url ? (
                        <img src={c.picture_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900">{c.display_name || '名前なし'}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSegmentClass(c.segment)}`}>
                          {c.segment}
                        </span>
                        {c.status === 'applied' && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">適用済み</span>
                        )}
                        {c.status === 'dismissed' && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">却下</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{c.reasoning}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {c.suggested_tags.map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 bg-[#06C755]/10 text-[#06C755] text-xs rounded-full font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">{new Date(c.created_at).toLocaleString('ja-JP')}</p>
                    </div>
                  </div>
                  {c.status === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleApply(c.id)}
                        className="px-3 py-1.5 bg-[#06C755] text-white text-sm rounded-lg hover:bg-[#05b34c] transition-colors"
                      >
                        適用
                      </button>
                      <button
                        onClick={() => handleDismiss(c.id)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        却下
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              前へ
            </button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              次へ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
