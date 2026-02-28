'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface KnowledgeDetail {
  id: string;
  title: string;
  content: string;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function KnowledgeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [item, setItem] = useState<KnowledgeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const res = await fetchWithAuth(getApiUrl() + '/api/knowledge/' + id);
        if (res.ok) {
          setItem(await res.json());
        } else {
          setError('ナレッジが見つかりませんでした。');
        }
      } catch (err) {
        console.error('Failed to fetch knowledge detail:', err);
        setError('データの取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchItem();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="flex gap-2 mb-6">
            <div className="h-6 bg-gray-200 rounded-full w-20" />
            <div className="h-6 bg-gray-200 rounded-full w-16" />
          </div>
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="h-4 bg-gray-200 rounded w-full mb-3" />
            <div className="h-4 bg-gray-200 rounded w-5/6 mb-3" />
            <div className="h-4 bg-gray-200 rounded w-4/6 mb-3" />
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
            <div className="h-4 bg-gray-200 rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <svg
            className="w-16 h-16 text-gray-300 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-gray-500">{error || 'ナレッジが見つかりませんでした。'}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span className="text-sm font-medium">戻る</span>
        </button>
        <button
          onClick={() => router.push('/dashboard/knowledge')}
          className="px-4 py-2 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors text-sm"
        >
          編集
        </button>
      </div>

      {/* メインコンテンツ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{item.title}</h1>

        <div className="flex items-center gap-3 mb-6">
          {item.category && (
            <span className="text-sm px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
              {item.category}
            </span>
          )}
          <span
            className={`text-sm px-3 py-1 rounded-full font-medium ${
              item.is_active
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {item.is_active ? '有効' : '無効'}
          </span>
        </div>

        {/* コンテンツ */}
        <div className="bg-gray-50 p-6 rounded-xl mb-6">
          <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">
            {item.content}
          </p>
        </div>

        {/* メタ情報 */}
        <div className="flex items-center gap-6 text-sm text-gray-400">
          <div className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              作成:{' '}
              {new Date(item.created_at).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>
              更新:{' '}
              {new Date(item.updated_at).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
