'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EditFormData {
  id?: string;
  title: string;
  content: string;
  category: string;
  is_active: boolean;
}

const emptyForm: EditFormData = {
  title: '',
  content: '',
  category: '',
  is_active: true,
};

export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<EditFormData>(emptyForm);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(
        getApiUrl() +
          '/api/knowledge?search=' +
          encodeURIComponent(search) +
          '&category=' +
          encodeURIComponent(categoryFilter)
      );
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch knowledge items:', err);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/knowledge/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : data.categories || []);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSave = async () => {
    if (!editItem.title.trim() || !editItem.content.trim()) return;
    setSaving(true);
    try {
      const isEdit = !!editItem.id;
      const url = isEdit
        ? getApiUrl() + '/api/knowledge/' + editItem.id
        : getApiUrl() + '/api/knowledge';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editItem.title,
          content: editItem.content,
          category: editItem.category,
          is_active: editItem.is_active,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setEditItem(emptyForm);
        fetchItems();
        fetchCategories();
      }
    } catch (err) {
      console.error('Failed to save knowledge item:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('このナレッジを削除しますか？')) return;
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/knowledge/' + id, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchItems();
        fetchCategories();
      }
    } catch (err) {
      console.error('Failed to delete knowledge item:', err);
    }
  };

  const openCreateModal = () => {
    setEditItem(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (item: KnowledgeItem) => {
    setEditItem({
      id: item.id,
      title: item.title,
      content: item.content,
      category: item.category,
      is_active: item.is_active,
    });
    setShowModal(true);
  };

  if (loading && items.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">ナレッジベース管理</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
            >
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-200 rounded w-full mb-2" />
              <div className="h-3 bg-gray-200 rounded w-5/6 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-2/3 mb-4" />
              <div className="flex gap-2">
                <div className="h-5 bg-gray-200 rounded-full w-16" />
                <div className="h-5 bg-gray-200 rounded-full w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">ナレッジベース管理</h1>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors"
        >
          新規追加
        </button>
      </div>

      {/* 検索・フィルタ */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="キーワード検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent bg-white"
        >
          <option value="">すべてのカテゴリ</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* カード一覧 */}
      {items.length === 0 ? (
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
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <p className="text-gray-500">
            ナレッジが登録されていません。FAQや商品情報を追加してAIの応答品質を向上させましょう。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-gray-900 line-clamp-1">
                  {item.title}
                </h3>
              </div>
              <p className="text-sm text-gray-500 line-clamp-3 mb-4">
                {item.content}
              </p>
              <div className="flex items-center gap-2 mb-4">
                {item.category && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {item.category}
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    item.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {item.is_active ? '有効' : '無効'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {new Date(item.updated_at).toLocaleDateString('ja-JP')}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(item)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-sm text-red-500 hover:text-red-700 font-medium"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 作成/編集モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                {editItem.id ? 'ナレッジ編集' : 'ナレッジ新規追加'}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    タイトル <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editItem.title}
                    onChange={(e) =>
                      setEditItem({ ...editItem, title: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent"
                    placeholder="例: 返品ポリシーについて"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    カテゴリ
                  </label>
                  <input
                    type="text"
                    value={editItem.category}
                    onChange={(e) =>
                      setEditItem({ ...editItem, category: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent"
                    placeholder="例: FAQ, 商品情報, ポリシー"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    コンテンツ <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={8}
                    value={editItem.content}
                    onChange={(e) =>
                      setEditItem({ ...editItem, content: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent resize-y"
                    placeholder="AIが参照するナレッジ内容を入力してください..."
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={editItem.is_active}
                    onChange={(e) =>
                      setEditItem({ ...editItem, is_active: e.target.checked })
                    }
                    className="w-4 h-4 text-[#06C755] border-gray-300 rounded focus:ring-[#06C755]"
                  />
                  <label
                    htmlFor="is_active"
                    className="text-sm font-medium text-gray-700"
                  >
                    有効にする
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditItem(emptyForm);
                  }}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !editItem.title.trim() || !editItem.content.trim()}
                  className="px-4 py-2 bg-[#06C755] text-white rounded-lg hover:bg-[#05b34c] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
