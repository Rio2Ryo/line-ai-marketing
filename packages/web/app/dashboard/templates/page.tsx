'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface Template {
  id: string;
  name: string;
  category: string;
  message_type: 'text' | 'flex';
  content: string;
  is_preset: number;
  usage_count: number;
  created_at: string;
}

interface AiTemplate {
  name: string;
  content: string;
}

interface AbVariation {
  name: string;
  content: string;
  change_description: string;
}

const categoryIcons: Record<string, string> = {
  '飲食': '🍽️',
  'EC': '🛒',
  '美容': '💅',
  '汎用': '📋',
  '不動産': '🏠',
  '教育': '📚',
  '医療': '🏥',
  'フィットネス': '💪',
};

const INDUSTRIES = [
  '飲食・レストラン',
  'EC・通販',
  '美容・サロン',
  '不動産',
  '教育・スクール',
  '医療・クリニック',
  'フィットネス・ジム',
  '小売・アパレル',
  'その他',
];

const PURPOSES = [
  '新規来店促進',
  'リピート促進',
  'セール・キャンペーン告知',
  '新商品・新メニュー案内',
  '予約リマインド',
  'クーポン配布',
  'イベント招待',
  '季節のご挨拶',
  'アンケート依頼',
  'お知らせ',
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [form, setForm] = useState({ name: '', category: '', content: '' });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // AI Generate state
  const [showAiGenerate, setShowAiGenerate] = useState(false);
  const [aiIndustry, setAiIndustry] = useState('');
  const [aiPurpose, setAiPurpose] = useState('');
  const [aiTone, setAiTone] = useState('casual');
  const [aiCategory, setAiCategory] = useState('汎用');
  const [aiCount, setAiCount] = useState(3);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResults, setAiResults] = useState<AiTemplate[]>([]);
  const [aiError, setAiError] = useState('');

  // AB Variation state
  const [abTemplateId, setAbTemplateId] = useState<string | null>(null);
  const [abGenerating, setAbGenerating] = useState(false);
  const [abVariations, setAbVariations] = useState<AbVariation[]>([]);
  const [abOriginal, setAbOriginal] = useState<{ name: string; content: string } | null>(null);
  const [abError, setAbError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.set('category', selectedCategory);
      if (search) params.set('search', search);
      const qs = params.toString() ? `?${params.toString()}` : '';

      const [listRes, catRes] = await Promise.all([
        fetchWithAuth(getApiUrl() + `/api/templates${qs}`),
        fetchWithAuth(getApiUrl() + '/api/templates/categories'),
      ]);

      if (listRes.ok) {
        const data = await listRes.json();
        setTemplates(data.data || []);
      }
      if (catRes.ok) {
        const data = await catRes.json();
        setCategories(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form.name || !form.category || !form.content) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowCreate(false);
        setForm({ name: '', category: '', content: '' });
        await fetchData();
      }
    } catch (err) {
      console.error('Create failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingTemplate) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth(getApiUrl() + `/api/templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setEditingTemplate(null);
        setForm({ name: '', category: '', content: '' });
        await fetchData();
      }
    } catch (err) {
      console.error('Update failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このテンプレートを削除しますか？')) return;
    try {
      const res = await fetchWithAuth(getApiUrl() + `/api/templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTemplates(prev => prev.filter(t => t.id !== id));
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleCopy = async (template: Template) => {
    try {
      await navigator.clipboard.writeText(template.content);
      setCopied(template.id);
      fetchWithAuth(getApiUrl() + `/api/templates/${template.id}/use`, { method: 'POST' });
      setTimeout(() => setCopied(null), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = template.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(template.id);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const openEdit = (t: Template) => {
    setEditingTemplate(t);
    setForm({ name: t.name, category: t.category, content: t.content });
    setShowCreate(false);
    setShowAiGenerate(false);
  };

  const openCreate = () => {
    setEditingTemplate(null);
    setForm({ name: '', category: '', content: '' });
    setShowCreate(true);
    setShowAiGenerate(false);
  };

  // AI Generate handlers
  const handleAiGenerate = async () => {
    if (!aiIndustry.trim() || !aiPurpose.trim()) return;
    setAiGenerating(true);
    setAiError('');
    setAiResults([]);
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/templates/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: aiIndustry,
          purpose: aiPurpose,
          tone: aiTone,
          category: aiCategory,
          count: aiCount,
        }),
      });
      const data = await res.json();
      if (data.success && data.data?.templates) {
        setAiResults(data.data.templates);
      } else {
        setAiError(data.error || 'AI生成に失敗しました');
      }
    } catch {
      setAiError('通信エラーが発生しました');
    } finally {
      setAiGenerating(false);
    }
  };

  const useAiResult = (tmpl: AiTemplate) => {
    setForm({ name: tmpl.name, category: aiCategory, content: tmpl.content });
    setShowCreate(true);
    setShowAiGenerate(false);
    setAiResults([]);
  };

  const saveAiResultDirect = async (tmpl: AiTemplate) => {
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tmpl.name, category: aiCategory, content: tmpl.content }),
      });
      if (res.ok) {
        await fetchData();
        setAiResults(prev => prev.filter(t => t.name !== tmpl.name));
      }
    } catch (err) {
      console.error('Save AI template failed:', err);
    }
  };

  // AB Variation handlers
  const handleAbGenerate = async (templateId: string) => {
    setAbTemplateId(templateId);
    setAbGenerating(true);
    setAbError('');
    setAbVariations([]);
    setAbOriginal(null);
    try {
      const res = await fetchWithAuth(getApiUrl() + `/api/templates/${templateId}/ab-variations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 3 }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAbOriginal(data.data.original);
        setAbVariations(data.data.variations);
      } else {
        setAbError(data.error || 'バリエーション生成に失敗しました');
      }
    } catch {
      setAbError('通信エラーが発生しました');
    } finally {
      setAbGenerating(false);
    }
  };

  const closeAbModal = () => {
    setAbTemplateId(null);
    setAbVariations([]);
    setAbOriginal(null);
    setAbError('');
  };

  const copyAbVariation = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* noop */ }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">テンプレートライブラリ</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-32 mb-3" />
              <div className="h-20 bg-gray-200 rounded mb-3" />
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
        <h1 className="text-2xl font-bold text-gray-900">テンプレートライブラリ</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowAiGenerate(!showAiGenerate); setShowCreate(false); setEditingTemplate(null); }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AIで自動生成
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            手動作成
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !selectedCategory ? 'bg-[#06C755] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            すべて
          </button>
          {categories.map(cat => (
            <button
              key={cat.category}
              onClick={() => setSelectedCategory(cat.category)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === cat.category ? 'bg-[#06C755] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {categoryIcons[cat.category] || '📄'} {cat.category} ({cat.count})
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="テンプレート検索..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755]/30 focus:border-[#06C755]"
        />
      </div>

      {/* AI Generate Panel */}
      {showAiGenerate && (
        <div className="bg-white rounded-2xl shadow-sm border border-purple-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">AIテンプレート生成</h3>
              <p className="text-sm text-gray-500">業種と目的を指定して、最適なメッセージテンプレートをAIが自動生成します</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">業種 <span className="text-red-500">*</span></label>
              <select
                value={aiIndustry}
                onChange={e => setAiIndustry(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
              >
                <option value="">選択してください</option>
                {INDUSTRIES.map(ind => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">目的 <span className="text-red-500">*</span></label>
              <select
                value={aiPurpose}
                onChange={e => setAiPurpose(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
              >
                <option value="">選択してください</option>
                {PURPOSES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">トーン</label>
              <select
                value={aiTone}
                onChange={e => setAiTone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
              >
                <option value="casual">カジュアル</option>
                <option value="formal">フォーマル</option>
                <option value="friendly">フレンドリー</option>
                <option value="urgent">緊急性・限定感</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
              <input
                type="text"
                value={aiCategory}
                onChange={e => setAiCategory(e.target.value)}
                placeholder="例: 飲食, EC, 美容"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">生成数: {aiCount}</label>
              <input
                type="range"
                min={1}
                max={5}
                value={aiCount}
                onChange={e => setAiCount(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600 mt-3"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleAiGenerate}
              disabled={aiGenerating || !aiIndustry || !aiPurpose}
              className="px-5 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {aiGenerating ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  生成中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AIで生成する
                </>
              )}
            </button>
            <button
              onClick={() => setShowAiGenerate(false)}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              閉じる
            </button>
          </div>

          {aiError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-600">{aiError}</p>
            </div>
          )}

          {/* AI Results */}
          {aiResults.length > 0 && (
            <div className="mt-6 space-y-3">
              <h4 className="text-sm font-bold text-gray-900">生成結果 ({aiResults.length}件)</h4>
              {aiResults.map((tmpl, idx) => (
                <div key={idx} className="border border-purple-100 rounded-xl p-4 bg-purple-50/30">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-0.5 rounded">#{idx + 1}</span>
                      <span className="ml-2 text-sm font-medium text-gray-900">{tmpl.name}</span>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => useAiResult(tmpl)}
                        className="px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors"
                      >
                        編集して使う
                      </button>
                      <button
                        onClick={() => saveAiResultDirect(tmpl)}
                        className="px-2.5 py-1 text-xs font-medium text-white bg-[#06C755] rounded-lg hover:bg-[#05b34c] transition-colors"
                      >
                        そのまま保存
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded-lg p-3 border border-gray-100">{tmpl.content}</p>
                  <p className="text-xs text-gray-400 mt-1.5">{tmpl.content.length}文字</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit panel */}
      {(showCreate || editingTemplate) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingTemplate ? 'テンプレート編集' : '新規テンプレート作成'}
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">テンプレート名</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="例: 新商品のお知らせ"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755]/30 focus:border-[#06C755]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  placeholder="例: 飲食, EC, 美容, 汎用"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755]/30 focus:border-[#06C755]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メッセージ内容</label>
              <textarea
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                rows={6}
                placeholder={'メッセージ本文を入力...\n{variable_name} の形式で変数を使えます'}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755]/30 focus:border-[#06C755] font-mono"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={editingTemplate ? handleUpdate : handleCreate}
                disabled={saving || !form.name || !form.category || !form.content}
                className="px-4 py-2 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '保存中...' : (editingTemplate ? '更新' : '作成')}
              </button>
              <button
                onClick={() => { setShowCreate(false); setEditingTemplate(null); }}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template grid */}
      {templates.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>テンプレートが見つかりません</p>
          <p className="text-sm mt-2">「AIで自動生成」から業種に最適なテンプレートを作成しましょう</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-gray-900 truncate">{t.name}</h4>
                    {t.is_preset ? (
                      <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded font-medium flex-shrink-0">プリセット</span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-gray-50 text-gray-500 text-xs rounded font-medium flex-shrink-0">カスタム</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {categoryIcons[t.category] || '📄'} {t.category} ・ 使用: {t.usage_count}回
                  </p>
                </div>
              </div>

              <div
                className="flex-1 bg-gray-50 rounded-lg p-3 mb-3 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setPreviewTemplate(previewTemplate?.id === t.id ? null : t)}
              >
                <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">{t.content}</p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => handleCopy(t)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    copied === t.id
                      ? 'bg-green-100 text-green-700'
                      : 'bg-[#06C755]/10 text-[#06C755] hover:bg-[#06C755]/20'
                  }`}
                >
                  {copied === t.id ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      コピー済み
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      コピー
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleAbGenerate(t.id)}
                  disabled={abGenerating && abTemplateId === t.id}
                  className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                  title="ABテストバリエーションをAIで生成"
                >
                  {abGenerating && abTemplateId === t.id ? (
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  AB提案
                </button>
                {!t.is_preset && (
                  <>
                    <button
                      onClick={() => openEdit(t)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 transition-colors"
                    >
                      削除
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewTemplate(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{previewTemplate.name}</h3>
                <p className="text-sm text-gray-500">{categoryIcons[previewTemplate.category] || '📄'} {previewTemplate.category}</p>
              </div>
              <button onClick={() => setPreviewTemplate(null)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="bg-[#7494C0] rounded-2xl p-4">
              <div className="bg-white rounded-2xl rounded-tl-sm p-4 max-w-[85%]">
                <p className="text-sm whitespace-pre-wrap">{previewTemplate.content}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => { handleCopy(previewTemplate); }}
                className="flex-1 px-4 py-2 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors"
              >
                コピーして使う
              </button>
              <button
                onClick={() => { handleAbGenerate(previewTemplate.id); setPreviewTemplate(null); }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                ABテスト提案
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AB Variation Modal */}
      {(abTemplateId && (abVariations.length > 0 || abGenerating || abError)) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeAbModal}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">ABテストバリエーション提案</h3>
                  <p className="text-sm text-gray-500">AIが異なる訴求軸のバリエーションを提案します</p>
                </div>
              </div>
              <button onClick={closeAbModal} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {abGenerating && (
              <div className="text-center py-12">
                <svg className="animate-spin h-8 w-8 text-purple-600 mx-auto mb-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-gray-500">AIがバリエーションを生成中...</p>
              </div>
            )}

            {abError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-600">{abError}</p>
              </div>
            )}

            {abOriginal && abVariations.length > 0 && (
              <div className="space-y-4">
                {/* Original */}
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded font-medium">元のテンプレート</span>
                    <span className="text-sm font-medium text-gray-900">{abOriginal.name}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{abOriginal.content}</p>
                </div>

                {/* Variations */}
                {abVariations.map((v, idx) => {
                  const colors = ['#06C755', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];
                  const color = colors[idx] || '#6B7280';
                  return (
                    <div key={idx} className="border rounded-xl p-4" style={{ borderColor: color + '40' }}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: color }}
                          >
                            {v.name}
                          </span>
                          <span className="text-sm font-medium text-gray-900">バリエーション {v.name}</span>
                        </div>
                        <button
                          onClick={() => copyAbVariation(v.content, `ab-${idx}`)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex-shrink-0 ${
                            copied === `ab-${idx}` ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {copied === `ab-${idx}` ? 'コピー済み' : 'コピー'}
                        </button>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded-lg p-3 border border-gray-100 mb-2">{v.content}</p>
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-xs text-gray-500">{v.change_description}</p>
                      </div>
                    </div>
                  );
                })}

                <p className="text-xs text-gray-400 text-center mt-3">
                  これらのバリエーションをA/Bテスト画面で使用し、どのメッセージが最も効果的かを検証できます
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
