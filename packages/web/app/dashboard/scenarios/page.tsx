'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface Scenario {
  id: string;
  name: string;
  description: string;
  trigger_type: 'follow' | 'message_keyword' | 'tag_added' | 'manual';
  is_active: boolean;
  step_count: number;
}

export default function ScenariosPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newScenario, setNewScenario] = useState({
    name: '',
    description: '',
    trigger_type: 'follow',
  });

  const fetchScenarios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/scenarios');
      if (res.ok) {
        const data = await res.json();
        setScenarios(data.scenarios || data || []);
      }
    } catch (err) {
      console.error('Failed to fetch scenarios:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  const handleToggleActive = async (
    e: React.MouseEvent,
    scenario: Scenario
  ) => {
    e.stopPropagation();
    try {
      await fetchWithAuth(getApiUrl() + '/api/scenarios/' + scenario.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !scenario.is_active }),
      });
      fetchScenarios();
    } catch (err) {
      console.error('Failed to toggle scenario:', err);
    }
  };

  const handleCreate = async () => {
    if (!newScenario.name) return;
    try {
      await fetchWithAuth(getApiUrl() + '/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newScenario),
      });
      setShowModal(false);
      setNewScenario({ name: '', description: '', trigger_type: 'follow' });
      fetchScenarios();
    } catch (err) {
      console.error('Failed to create scenario:', err);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">シナリオ一覧</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors"
        >
          新規作成
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3"
            >
              <div className="h-5 bg-gray-200 rounded w-1/2" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-6 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
      ) : scenarios.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
          シナリオがありません
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              onClick={() =>
                router.push('/dashboard/scenarios/' + scenario.id)
              }
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-gray-900">{scenario.name}</h3>
                <div
                  onClick={(e) => handleToggleActive(e, scenario)}
                  className={`relative w-12 h-6 rounded-full cursor-pointer transition-colors ${
                    scenario.is_active ? 'bg-[#06C755]' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      scenario.is_active
                        ? 'translate-x-6'
                        : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>
              <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                {scenario.description}
              </p>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${getTriggerBadge(scenario.trigger_type)}`}
                >
                  {scenario.trigger_type}
                </span>
                <span className="text-sm text-gray-400">
                  {scenario.step_count} ステップ
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新規作成モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              新規シナリオ作成
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  名前
                </label>
                <input
                  type="text"
                  value={newScenario.name}
                  onChange={(e) =>
                    setNewScenario({ ...newScenario, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent"
                  placeholder="シナリオ名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明
                </label>
                <textarea
                  value={newScenario.description}
                  onChange={(e) =>
                    setNewScenario({
                      ...newScenario,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent"
                  rows={3}
                  placeholder="シナリオの説明"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  トリガータイプ
                </label>
                <select
                  value={newScenario.trigger_type}
                  onChange={(e) =>
                    setNewScenario({
                      ...newScenario,
                      trigger_type: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent"
                >
                  <option value="follow">follow</option>
                  <option value="message_keyword">message_keyword</option>
                  <option value="tag_added">tag_added</option>
                  <option value="manual">manual</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreate}
                disabled={!newScenario.name}
                className="px-4 py-2 bg-[#06C755] text-white rounded-lg text-sm font-medium hover:bg-[#05b34c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                作成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
