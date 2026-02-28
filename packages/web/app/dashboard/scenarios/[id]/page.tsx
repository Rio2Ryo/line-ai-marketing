'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface Step {
  id: string;
  step_order: number;
  message_type: 'text' | 'image' | 'flex';
  message_content: string;
  delay_minutes: number;
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  is_active: boolean;
  steps: Step[];
}

export default function ScenarioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [newStep, setNewStep] = useState({
    message_type: 'text',
    message_content: '',
    delay_minutes: 0,
  });

  const fetchScenario = useCallback(async () => {
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/scenarios/' + id);
      if (res.ok) {
        const data = await res.json();
        setScenario(data);
      }
    } catch (err) {
      console.error('Failed to fetch scenario:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchScenario();
  }, [fetchScenario]);

  const handleDeleteStep = async (stepId: string) => {
    try {
      await fetchWithAuth(
        getApiUrl() + '/api/scenarios/' + id + '/steps/' + stepId,
        { method: 'DELETE' }
      );
      fetchScenario();
    } catch (err) {
      console.error('Failed to delete step:', err);
    }
  };

  const handleAddStep = async () => {
    if (!newStep.message_content) return;
    try {
      await fetchWithAuth(getApiUrl() + '/api/scenarios/' + id + '/steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStep),
      });
      setNewStep({ message_type: 'text', message_content: '', delay_minutes: 0 });
      fetchScenario();
    } catch (err) {
      console.error('Failed to add step:', err);
    }
  };

  const handleExecute = async () => {
    if (!window.confirm('このシナリオを全アクティブユーザーに対して実行しますか？'))
      return;
    try {
      await fetchWithAuth(getApiUrl() + '/api/scenarios/' + id + '/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: [] }),
      });
      alert('シナリオの実行を開始しました');
    } catch (err) {
      console.error('Failed to execute scenario:', err);
    }
  };

  const getTriggerBadge = (type: string) => {
    switch (type) {
      case 'follow':
        return 'bg-green-100 text-green-700';
      case 'message_keyword':
        return 'bg-blue-100 text-blue-700';
      case 'tag_added':
        return 'bg-purple-100 text-purple-700';
      case 'manual':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getMessageTypeBadge = (type: string) => {
    switch (type) {
      case 'text':
        return 'bg-blue-100 text-blue-700';
      case 'image':
        return 'bg-purple-100 text-purple-700';
      case 'flex':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6" />
          <div className="bg-white rounded-2xl p-6 space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-2/3" />
            <div className="h-4 bg-gray-200 rounded w-1/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="text-center py-12 text-gray-500">
        シナリオが見つかりません
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 戻るボタン */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
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
        戻る
      </button>

      {/* シナリオ情報 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {scenario.name}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {scenario.description}
            </p>
            <div className="flex items-center gap-3 mt-3">
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${getTriggerBadge(scenario.trigger_type)}`}
              >
                {scenario.trigger_type}
              </span>
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  scenario.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {scenario.is_active ? '稼働中' : '停止中'}
              </span>
            </div>
          </div>
          <button
            onClick={handleExecute}
            className="px-4 py-2 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors"
          >
            実行
          </button>
        </div>
      </div>

      {/* ステップタイムライン */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">ステップ</h2>

        {scenario.steps && scenario.steps.length > 0 ? (
          <div className="relative ml-4">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#06C755]" />
            <div className="space-y-6">
              {scenario.steps.map((step) => (
                <div key={step.id} className="relative pl-8">
                  <div className="absolute left-[-7px] top-1 w-4 h-4 bg-[#06C755] rounded-full" />
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-gray-700">
                          #{step.step_order}
                        </span>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getMessageTypeBadge(step.message_type)}`}
                        >
                          {step.message_type}
                        </span>
                        {step.delay_minutes > 0 && (
                          <span className="text-xs text-gray-400">
                            ⏱ {step.delay_minutes}分後
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {step.message_content}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteStep(step.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors ml-4 text-lg"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">ステップなし</p>
        )}
      </div>

      {/* ステップ追加フォーム */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          ステップ追加
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メッセージタイプ
            </label>
            <select
              value={newStep.message_type}
              onChange={(e) =>
                setNewStep({ ...newStep, message_type: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent"
            >
              <option value="text">text</option>
              <option value="image">image</option>
              <option value="flex">flex</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メッセージ内容
            </label>
            <textarea
              value={newStep.message_content}
              onChange={(e) =>
                setNewStep({ ...newStep, message_content: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent"
              rows={3}
              placeholder="メッセージ内容を入力..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              遅延（分）
            </label>
            <input
              type="number"
              value={newStep.delay_minutes}
              onChange={(e) =>
                setNewStep({
                  ...newStep,
                  delay_minutes: parseInt(e.target.value) || 0,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent"
              min={0}
            />
          </div>
          <button
            onClick={handleAddStep}
            disabled={!newStep.message_content}
            className="px-4 py-2 bg-[#06C755] text-white rounded-lg text-sm font-medium hover:bg-[#05b34c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            追加
          </button>
        </div>
      </div>
    </div>
  );
}
