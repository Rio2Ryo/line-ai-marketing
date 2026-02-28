'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

export default function SettingsPage() {
  const [aiAutoReply, setAiAutoReply] = useState(true);
  const [escalationNotify, setEscalationNotify] = useState(true);
  const [knowledgeCount, setKnowledgeCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKnowledgeCount = async () => {
      try {
        const res = await fetchWithAuth(getApiUrl() + '/api/knowledge');
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : data.items || [];
          setKnowledgeCount(items.length);
        }
      } catch (err) {
        console.error('Failed to fetch knowledge count:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchKnowledgeCount();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">設定</h1>

      {/* AI設定セクション */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          AI設定
        </h3>
        <div className="space-y-5">
          {/* AI自動応答トグル */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">AI自動応答</p>
              <p className="text-sm text-gray-500">
                LINE受信メッセージにAIが自動で応答します
              </p>
            </div>
            <button
              onClick={() => setAiAutoReply(!aiAutoReply)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                aiAutoReply ? 'bg-[#06C755]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  aiAutoReply ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 応答モデル */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">応答モデル</p>
              <p className="text-sm text-gray-500">
                AIの応答に使用されるモデル
              </p>
            </div>
            <span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1.5 rounded-lg">
              Claude 3.5 Haiku
            </span>
          </div>

          {/* エスカレーション通知トグル */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">エスカレーション通知</p>
              <p className="text-sm text-gray-500">
                AIが対応できない場合にオペレーターへ通知します
              </p>
            </div>
            <button
              onClick={() => setEscalationNotify(!escalationNotify)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                escalationNotify ? 'bg-[#06C755]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  escalationNotify ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* LINE連携設定セクション */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-[#06C755]"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.066-.022.137-.033.194-.033.195 0 .375.104.515.254l2.449 3.32V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
          </svg>
          LINE連携設定
        </h3>
        <div className="space-y-5">
          {/* Channel ID */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">LINE Channel ID</p>
              <p className="text-sm text-gray-500">
                LINE Developersで設定されたチャネルID
              </p>
            </div>
            <span className="text-sm font-mono text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
              ****1234
            </span>
          </div>

          {/* Webhook URL */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="font-medium text-gray-900">Webhook URL</p>
                <p className="text-sm text-gray-500">
                  LINE Developersに設定するWebhook URL
                </p>
              </div>
            </div>
            <div className="mt-2 bg-gray-50 rounded-lg px-4 py-2.5 text-sm font-mono text-gray-600 break-all">
              https://line-ai-marketing-api.workers.dev/webhook
            </div>
          </div>

          {/* 接続ステータス */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">接続ステータス</p>
              <p className="text-sm text-gray-500">
                LINE Messaging APIとの接続状態
              </p>
            </div>
            <span className="text-sm font-medium px-3 py-1 rounded-full bg-green-100 text-green-700">
              設定済み
            </span>
          </div>
        </div>
      </div>

      {/* ナレッジベース統計セクション */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          ナレッジベース
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">
              登録済みナレッジ:{' '}
              {loading ? (
                <span className="inline-block w-8 h-5 bg-gray-200 rounded animate-pulse align-middle" />
              ) : (
                <span className="text-[#06C755] font-bold">
                  {knowledgeCount ?? 0}件
                </span>
              )}
            </p>
            <p className="text-sm text-gray-500">
              FAQや商品情報を登録してAIの応答品質を向上させましょう
            </p>
          </div>
          <Link
            href="/dashboard/knowledge"
            className="px-4 py-2 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors text-sm"
          >
            ナレッジ管理へ
          </Link>
        </div>
      </div>
    </div>
  );
}
