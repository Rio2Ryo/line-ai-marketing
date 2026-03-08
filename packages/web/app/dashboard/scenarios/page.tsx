'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface Scenario {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: string | null;
  is_active: boolean;
  step_count: number;
}

interface TagItem { id: string; name: string; }
interface GoalItem { id: string; name: string; }
interface SourceItem { id: string; name: string; source_code: string; }

const TRIGGER_TYPES = [
  { value: 'follow', label: '友だち追加', color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
  { value: 'message_keyword', label: 'キーワード', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  { value: 'tag_added', label: 'タグ付与', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' },
  { value: 'rank_change', label: 'ランク変動', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' },
  { value: 'conversion', label: 'CV達成', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300' },
  { value: 'follow_source', label: '経路別追加', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
  { value: 'manual', label: '手動実行', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
];

const RANK_OPTIONS = ['S', 'A', 'B', 'C', 'D'];

export default function ScenariosPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const API = getApiUrl();

  const fetchScenarios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(API + '/api/scenarios');
      if (res.ok) {
        const data = await res.json();
        setScenarios(data.data || data.scenarios || data || []);
      }
    } catch (err) {
      console.error('Failed to fetch scenarios:', err);
    } finally {
      setLoading(false);
    }
  }, [API]);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  const handleToggleActive = async (e: React.MouseEvent, scenario: Scenario) => {
    e.stopPropagation();
    try {
      await fetchWithAuth(API + '/api/scenarios/' + scenario.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !scenario.is_active }),
      });
      fetchScenarios();
    } catch (err) {
      console.error('Failed to toggle scenario:', err);
    }
  };

  const getTriggerType = (type: string) => TRIGGER_TYPES.find(t => t.value === type) || TRIGGER_TYPES[TRIGGER_TYPES.length - 1];

  const getTriggerDesc = (scenario: Scenario) => {
    const config = scenario.trigger_config ? JSON.parse(scenario.trigger_config) : {};
    switch (scenario.trigger_type) {
      case 'message_keyword': return config.keywords?.length ? `キーワード: ${config.keywords.join(', ')}` : '';
      case 'rank_change': {
        const parts = [];
        if (config.direction === 'up') parts.push('UP');
        if (config.direction === 'down') parts.push('DOWN');
        if (config.target_rank) parts.push(`→ ${config.target_rank}`);
        return parts.join(' ') || '全変動';
      }
      case 'tag_added': return config.tag_ids?.length ? `${config.tag_ids.length}件のタグ` : '全タグ';
      case 'conversion': return config.goal_ids?.length ? `${config.goal_ids.length}件の目標` : '全CV';
      case 'follow_source': return config.source_codes?.length ? `${config.source_codes.length}件の経路` : '全経路';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">シナリオ一覧</h1>
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
            <div key={i} className="animate-pulse bg-white dark:bg-gray-900 rounded-2xl shadow-sm border dark:border-gray-700 p-6 space-y-3">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20" />
            </div>
          ))}
        </div>
      ) : scenarios.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border dark:border-gray-700 p-12 text-center text-gray-500 dark:text-gray-400">
          シナリオがありません
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {scenarios.map((scenario) => {
            const tt = getTriggerType(scenario.trigger_type);
            const desc = getTriggerDesc(scenario);
            return (
              <div
                key={scenario.id}
                onClick={() => router.push('/dashboard/scenarios/' + scenario.id)}
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border dark:border-gray-700 p-6 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-gray-900 dark:text-white">{scenario.name}</h3>
                  <div
                    onClick={(e) => handleToggleActive(e, scenario)}
                    className={`relative w-12 h-6 rounded-full cursor-pointer transition-colors ${
                      scenario.is_active ? 'bg-[#06C755]' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      scenario.is_active ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                  {scenario.description}
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${tt.color}`}>
                    {tt.label}
                  </span>
                  {desc && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">{desc}</span>
                  )}
                  <span className="text-sm text-gray-400 dark:text-gray-500">
                    {scenario.step_count} ステップ
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <CreateScenarioModal
          api={API}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchScenarios(); }}
        />
      )}
    </div>
  );
}

// ─── Create Modal with trigger config ───

function CreateScenarioModal({ api, onClose, onCreated }: { api: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('follow');
  const [keywords, setKeywords] = useState('');
  const [direction, setDirection] = useState('any');
  const [targetRank, setTargetRank] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  const [selectedSourceCodes, setSelectedSourceCodes] = useState<string[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [tRes, gRes, sRes] = await Promise.all([
          fetchWithAuth(`${api}/api/tags`),
          fetchWithAuth(`${api}/api/conversions/goals`),
          fetchWithAuth(`${api}/api/follow-sources/sources`),
        ]);
        const tJson = await tRes.json();
        const gJson = await gRes.json();
        const sJson = await sRes.json();
        if (tJson.success) setTags(tJson.data || []);
        if (gJson.success) setGoals(gJson.data || []);
        if (sJson.success) setSources(sJson.data || []);
      } catch {}
    };
    fetchOptions();
  }, [api]);

  const buildTriggerConfig = () => {
    switch (triggerType) {
      case 'message_keyword':
        return JSON.stringify({ keywords: keywords.split(',').map(k => k.trim()).filter(Boolean) });
      case 'tag_added':
        return JSON.stringify({ tag_ids: selectedTagIds });
      case 'rank_change':
        return JSON.stringify({
          ...(direction !== 'any' ? { direction } : {}),
          ...(targetRank ? { target_rank: targetRank } : {}),
        });
      case 'conversion':
        return JSON.stringify({ goal_ids: selectedGoalIds });
      case 'follow_source':
        return JSON.stringify({ source_codes: selectedSourceCodes });
      default:
        return null;
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetchWithAuth(`${api}/api/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          trigger_type: triggerType,
          trigger_config: buildTriggerConfig(),
        }),
      });
      onCreated();
    } catch (err) {
      console.error('Failed to create scenario:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleInArray = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">新規シナリオ作成</h2>
        </div>

        <div className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">名前 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#06C755]"
              placeholder="シナリオ名"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">説明</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#06C755]"
              rows={2}
              placeholder="シナリオの説明"
            />
          </div>

          {/* Trigger Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">トリガータイプ *</label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value)}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#06C755]"
            >
              {TRIGGER_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Trigger Config: message_keyword */}
          {triggerType === 'message_keyword' && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">キーワード（カンマ区切り）</label>
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
                placeholder="例: 予約, 料金, 問い合わせ"
              />
            </div>
          )}

          {/* Trigger Config: tag_added */}
          {triggerType === 'tag_added' && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">対象タグ（未選択=全タグ）</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleInArray(selectedTagIds, tag.id, setSelectedTagIds)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      selectedTagIds.includes(tag.id)
                        ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-600'
                        : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
                {tags.length === 0 && <span className="text-xs text-gray-400">タグがありません</span>}
              </div>
            </div>
          )}

          {/* Trigger Config: rank_change */}
          {triggerType === 'rank_change' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">変動方向</label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
                >
                  <option value="any">全変動</option>
                  <option value="up">ランクUPのみ</option>
                  <option value="down">ランクDOWNのみ</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">変動先ランク（任意）</label>
                <select
                  value={targetRank}
                  onChange={(e) => setTargetRank(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-800 dark:text-white"
                >
                  <option value="">指定なし</option>
                  {RANK_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Trigger Config: conversion */}
          {triggerType === 'conversion' && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">対象CV目標（未選択=全目標）</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {goals.map(goal => (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => toggleInArray(selectedGoalIds, goal.id, setSelectedGoalIds)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      selectedGoalIds.includes(goal.id)
                        ? 'bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-900/50 dark:text-pink-300 dark:border-pink-600'
                        : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600'
                    }`}
                  >
                    {goal.name}
                  </button>
                ))}
                {goals.length === 0 && <span className="text-xs text-gray-400">CV目標がありません</span>}
              </div>
            </div>
          )}

          {/* Trigger Config: follow_source */}
          {triggerType === 'follow_source' && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">対象経路（未選択=全経路）</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {sources.map(src => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => toggleInArray(selectedSourceCodes, src.source_code, setSelectedSourceCodes)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      selectedSourceCodes.includes(src.source_code)
                        ? 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-600'
                        : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600'
                    }`}
                  >
                    {src.name}
                  </button>
                ))}
                {sources.length === 0 && <span className="text-xs text-gray-400">経路がありません</span>}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            キャンセル
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className="px-4 py-2 bg-[#06C755] text-white rounded-lg text-sm font-medium hover:bg-[#05b34c] disabled:opacity-50 transition-colors"
          >
            {saving ? '作成中...' : '作成'}
          </button>
        </div>
      </div>
    </div>
  );
}
