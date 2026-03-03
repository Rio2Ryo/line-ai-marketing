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

interface JourneyEvent {
  type: string;
  event_at: string;
  data: Record<string, any>;
}

type TabKey = 'profile' | 'journey';

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
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [journey, setJourney] = useState<JourneyEvent[]>([]);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [journeyLoaded, setJourneyLoaded] = useState(false);

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

  const fetchJourney = useCallback(async () => {
    if (journeyLoaded) return;
    setJourneyLoading(true);
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/customers/' + id + '/journey');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setJourney(json.data.events || []);
      }
    } catch (err) {
      console.error('Failed to fetch journey:', err);
    } finally {
      setJourneyLoading(false);
      setJourneyLoaded(true);
    }
  }, [id, journeyLoaded]);

  useEffect(() => {
    fetchCustomer();
    fetchTags();
  }, [fetchCustomer, fetchTags]);

  useEffect(() => {
    if (activeTab === 'journey') fetchJourney();
  }, [activeTab, fetchJourney]);

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
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(customer.status)}`}>
                {customer.status}
              </span>
              <span className="text-sm text-gray-400">
                登録日: {formatDate(customer.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* タブ */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'profile'
              ? 'border-[#06C755] text-[#06C755]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          プロフィール
        </button>
        <button
          onClick={() => setActiveTab('journey')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'journey'
              ? 'border-[#06C755] text-[#06C755]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          ジャーニー
        </button>
      </div>

      {activeTab === 'profile' ? (
        <>
          {/* タグセクション */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">タグ</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {customer.tags?.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
                  style={{ backgroundColor: tag.color + '20', color: tag.color }}
                >
                  {tag.name}
                  <button onClick={() => handleRemoveTag(tag.id)} className="ml-1 hover:opacity-70">
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
                  <option key={tag.id} value={tag.id}>{tag.name}</option>
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
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">キー</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">値</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customer.attributes.map((attr, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3 text-sm font-medium text-gray-700">{attr.key}</td>
                      <td className="py-2 px-3 text-sm text-gray-600">{attr.value}</td>
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
            <h2 className="text-lg font-semibold text-gray-900 mb-4">メッセージ履歴</h2>
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
                      <p className={`text-xs mt-1 ${msg.direction === 'outbound' ? 'text-white/70' : 'text-gray-400'}`}>
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
        </>
      ) : (
        /* ジャーニータイムライン */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">ユーザージャーニー</h2>
          {journeyLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-48" />
                    <div className="h-3 bg-gray-200 rounded w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : journey.length > 0 ? (
            <JourneyTimeline events={journey} />
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">ジャーニーデータなし</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Journey Timeline ---------- */

const eventConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  follow: { label: 'フォロー', color: 'text-green-600', bg: 'bg-green-100', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  message_in: { label: '受信メッセージ', color: 'text-blue-600', bg: 'bg-blue-100', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  message_out: { label: '送信メッセージ', color: 'text-[#06C755]', bg: 'bg-green-50', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  delivery: { label: 'シナリオ配信', color: 'text-purple-600', bg: 'bg-purple-100', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  tag_assigned: { label: 'タグ付与', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z' },
  ai_chat: { label: 'AI応答', color: 'text-indigo-600', bg: 'bg-indigo-100', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
  survey_response: { label: 'アンケート回答', color: 'text-teal-600', bg: 'bg-teal-100', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  ai_classification: { label: 'AI分類', color: 'text-pink-600', bg: 'bg-pink-100', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
};

function JourneyTimeline({ events }: { events: JourneyEvent[] }) {
  // Group events by date
  const grouped: { date: string; events: JourneyEvent[] }[] = [];
  let currentDate = '';
  for (const ev of events) {
    const d = ev.event_at.slice(0, 10);
    if (d !== currentDate) {
      currentDate = d;
      grouped.push({ date: d, events: [] });
    }
    grouped[grouped.length - 1].events.push(ev);
  }

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <div key={group.date}>
          <div className="sticky top-0 bg-white z-10 pb-2">
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {new Date(group.date + 'T00:00:00').toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
            </span>
          </div>
          <div className="ml-5 border-l-2 border-gray-200 pl-6 space-y-4">
            {group.events.map((ev, i) => {
              const cfg = eventConfig[ev.type] || { label: ev.type, color: 'text-gray-600', bg: 'bg-gray-100', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' };
              const time = new Date(ev.event_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={`${ev.type}-${i}`} className="relative flex gap-3">
                  {/* Timeline dot */}
                  <div className={`absolute -left-[33px] w-4 h-4 rounded-full border-2 border-white ${cfg.bg}`} />
                  {/* Icon */}
                  <div className={`shrink-0 w-9 h-9 rounded-full ${cfg.bg} flex items-center justify-center`}>
                    <svg className={`w-4 h-4 ${cfg.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={cfg.icon} />
                    </svg>
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs text-gray-400">{time}</span>
                    </div>
                    <EventDetail type={ev.type} data={ev.data} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function EventDetail({ type, data }: { type: string; data: Record<string, any> }) {
  switch (type) {
    case 'follow':
      return <p className="text-sm text-gray-600 mt-0.5">LINE友だち追加</p>;
    case 'message_in':
      return <p className="text-sm text-gray-700 mt-0.5 bg-gray-50 rounded-lg px-3 py-1.5 inline-block max-w-full truncate">{data.content || '(メディア)'}</p>;
    case 'message_out':
      return <p className="text-sm text-gray-700 mt-0.5 bg-green-50 rounded-lg px-3 py-1.5 inline-block max-w-full truncate">{data.content || '(メディア)'}</p>;
    case 'delivery':
      return (
        <div className="mt-0.5">
          <p className="text-sm text-gray-700">{data.scenario_name}</p>
          <span className={`text-xs font-medium ${data.status === 'sent' ? 'text-green-600' : data.status === 'failed' ? 'text-red-600' : 'text-yellow-600'}`}>
            {data.status === 'sent' ? '送信成功' : data.status === 'failed' ? '送信失敗' : '保留中'}
          </span>
          {data.error_message && <p className="text-xs text-red-500 mt-0.5">{data.error_message}</p>}
        </div>
      );
    case 'tag_assigned':
      return (
        <span
          className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: (data.tag_color || '#06C755') + '20', color: data.tag_color || '#06C755' }}
        >
          {data.tag_name}
        </span>
      );
    case 'ai_chat':
      return (
        <div className="mt-0.5 space-y-1">
          <p className="text-sm text-gray-600 truncate">Q: {data.user_message}</p>
          <p className="text-sm text-gray-500 truncate">A: {data.ai_reply}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">確信度: {Math.round((data.confidence || 0) * 100)}%</span>
            {data.should_escalate === 1 && <span className="text-xs text-red-500 font-medium">エスカレーション</span>}
          </div>
        </div>
      );
    case 'survey_response':
      return <p className="text-sm text-gray-600 mt-0.5">{data.survey_title} に回答</p>;
    case 'ai_classification':
      return (
        <div className="mt-0.5">
          {data.segment && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full mr-1">{data.segment}</span>}
          <span className={`text-xs ${data.status === 'applied' ? 'text-green-600' : data.status === 'dismissed' ? 'text-gray-400' : 'text-yellow-600'}`}>
            {data.status === 'applied' ? '適用済み' : data.status === 'dismissed' ? '却下' : '保留中'}
          </span>
          {data.reasoning && <p className="text-xs text-gray-500 mt-0.5 truncate">{data.reasoning}</p>}
        </div>
      );
    default:
      return <p className="text-xs text-gray-400">{JSON.stringify(data)}</p>;
  }
}
