'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  message_type: string;
  sent_at: string;
}

interface Customer {
  id: string;
  line_user_id: string;
  display_name: string;
  picture_url: string | null;
  status: 'active' | 'blocked' | 'unfollowed';
  tags: Tag[];
  attributes: { key: string; value: string }[];
  recent_messages: Message[];
  created_at: string;
}

export default function CustomerDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [newTagId, setNewTagId] = useState('');
  const [attrKey, setAttrKey] = useState('');
  const [attrValue, setAttrValue] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchCustomer = useCallback(async () => {
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/customers/' + id);
      if (res.ok) {
        const data = await res.json();
        setCustomer(data);
      }
    } catch (err) {
      console.error('Failed to fetch customer:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/tags');
      if (res.ok) {
        const data = await res.json();
        setAllTags(data.tags || data || []);
      }
    } catch (err) {
      console.error('Failed to fetch tags:', err);
    }
  }, []);

  useEffect(() => {
    fetchCustomer();
    fetchTags();
  }, [fetchCustomer, fetchTags]);

  const handleRemoveTag = async (tagId: string) => {
    try {
      await fetchWithAuth(
        getApiUrl() + '/api/customers/' + id + '/tags/' + tagId,
        { method: 'DELETE' }
      );
      fetchCustomer();
    } catch (err) {
      console.error('Failed to remove tag:', err);
    }
  };

  const handleAddTag = async () => {
    if (!newTagId) return;
    try {
      await fetchWithAuth(getApiUrl() + '/api/customers/' + id + '/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: newTagId }),
      });
      setNewTagId('');
      fetchCustomer();
    } catch (err) {
      console.error('Failed to add tag:', err);
    }
  };

  const handleAddAttribute = async () => {
    if (!attrKey || !attrValue) return;
    try {
      await fetchWithAuth(
        getApiUrl() + '/api/customers/' + id + '/attributes',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: attrKey, value: attrValue }),
        }
      );
      setAttrKey('');
      setAttrValue('');
      fetchCustomer();
    } catch (err) {
      console.error('Failed to add attribute:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'blocked':
        return 'bg-red-100 text-red-700';
      case 'unfollowed':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6" />
          <div className="bg-white rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-gray-200 rounded-full" />
              <div className="space-y-2">
                <div className="h-6 bg-gray-200 rounded w-40" />
                <div className="h-4 bg-gray-200 rounded w-60" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12 text-gray-500">
        顧客が見つかりません
      </div>
    );
  }

  const availableTags = allTags.filter(
    (t) => !customer.tags?.some((ct) => ct.id === t.id)
  );

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

      {/* プロフィールカード */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-6">
          {customer.picture_url ? (
            <img
              src={customer.picture_url}
              alt={customer.display_name}
              className="w-20 h-20 rounded-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#06C755]/10 flex items-center justify-center">
              <span className="text-2xl font-bold text-[#06C755]">
                {customer.display_name?.charAt(0) || '?'}
              </span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {customer.display_name}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {customer.line_user_id}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(customer.status)}`}
              >
                {customer.status}
              </span>
              <span className="text-sm text-gray-400">
                登録日: {formatDate(customer.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* タグセクション */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">タグ</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {customer.tags?.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
              style={{
                backgroundColor: tag.color + '20',
                color: tag.color,
              }}
            >
              {tag.name}
              <button
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-1 hover:opacity-70"
              >
                ×
              </button>
            </span>
          ))}
          {(!customer.tags || customer.tags.length === 0) && (
            <span className="text-sm text-gray-400">タグなし</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={newTagId}
            onChange={(e) => setNewTagId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent"
          >
            <option value="">タグを選択...</option>
            {availableTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddTag}
            disabled={!newTagId}
            className="px-4 py-2 bg-[#06C755] text-white rounded-lg text-sm font-medium hover:bg-[#05b34c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            追加
          </button>
        </div>
      </div>

      {/* 属性セクション */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">属性</h2>
        {customer.attributes && customer.attributes.length > 0 ? (
          <table className="w-full mb-4">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">
                  キー
                </th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">
                  値
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customer.attributes.map((attr, i) => (
                <tr key={i}>
                  <td className="py-2 px-3 text-sm font-medium text-gray-700">
                    {attr.key}
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-600">
                    {attr.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-400 mb-4">属性なし</p>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="キー"
            value={attrKey}
            onChange={(e) => setAttrKey(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent w-40"
          />
          <input
            type="text"
            placeholder="値"
            value={attrValue}
            onChange={(e) => setAttrValue(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent w-40"
          />
          <button
            onClick={handleAddAttribute}
            disabled={!attrKey || !attrValue}
            className="px-4 py-2 bg-[#06C755] text-white rounded-lg text-sm font-medium hover:bg-[#05b34c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            追加
          </button>
        </div>
      </div>

      {/* メッセージ履歴 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          メッセージ履歴
        </h2>
        {customer.recent_messages && customer.recent_messages.length > 0 ? (
          <div className="space-y-3">
            {customer.recent_messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    msg.direction === 'outbound'
                      ? 'ml-auto mr-0 bg-[#06C755] text-white'
                      : 'ml-0 mr-auto bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      msg.direction === 'outbound'
                        ? 'text-white/70'
                        : 'text-gray-400'
                    }`}
                  >
                    {formatDate(msg.sent_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">メッセージ履歴なし</p>
        )}
      </div>
    </div>
  );
}
