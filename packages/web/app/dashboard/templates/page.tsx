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

const categoryIcons: Record<string, string> = {
  '飲食': '🍽️',
  'EC': '🛒',
  '美容': '💅',
  '汎用': '📋',
};

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
      // Increment usage count
      fetchWithAuth(getApiUrl() + `/api/templates/${template.id}/use`, { method: 'POST' });
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback
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
  };

  const openCreate = () => {
    setEditingTemplate(null);
    setForm({ name: '', category: '', content: '' });
    setShowCreate(true);
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
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          カスタムテンプレート作成
        </button>
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

      {/* Create / Edit modal */}
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
                placeholder="メッセージ本文を入力...&#10;{variable_name} の形式で変数を使えます"
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

              <div className="flex gap-2">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
