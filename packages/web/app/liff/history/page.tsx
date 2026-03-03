'use client';

import { useState, useEffect, useCallback } from 'react';
import { liffFetch } from '@/lib/liff';

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  content: string;
  sent_at: string;
}

export default function LiffHistoryPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await liffFetch('/api/liff/messages?limit=50');
      const json = await res.json();
      if (json.data) setMessages(json.data);
      if (json.pagination) setTotal(json.pagination.total);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <div key={i} className="animate-pulse bg-white rounded-lg h-14" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">メッセージ履歴</h2>
        <span className="text-xs text-gray-400">{total}件</span>
      </div>

      {messages.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">メッセージはありません</div>
      ) : (
        <div className="space-y-2">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                msg.direction === 'outbound'
                  ? 'bg-white border border-gray-200 rounded-tl-none'
                  : 'bg-[#06C755] text-white rounded-tr-none'
              }`}>
                <p className="text-sm whitespace-pre-wrap break-words">{msg.content || `[${msg.message_type}]`}</p>
                <p className={`text-[10px] mt-1 ${msg.direction === 'outbound' ? 'text-gray-400' : 'text-green-100'}`}>
                  {new Date(msg.sent_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
