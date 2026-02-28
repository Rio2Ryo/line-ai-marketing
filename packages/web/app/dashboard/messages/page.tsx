'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface CustomerListItem {
  id: string;
  display_name: string;
  picture_url: string | null;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  message_type: string;
  sent_at: string;
}

interface CustomerDetail {
  id: string;
  display_name: string;
  picture_url: string | null;
  recent_messages: Message[];
}

export default function MessagesPage() {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetchWithAuth(
        getApiUrl() + '/api/customers?limit=100'
      );
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedCustomer(null);
      return;
    }
    const fetchDetail = async () => {
      setLoadingDetail(true);
      try {
        const res = await fetchWithAuth(
          getApiUrl() + '/api/customers/' + selectedId
        );
        if (res.ok) {
          const data = await res.json();
          setSelectedCustomer(data);
        }
      } catch (err) {
        console.error('Failed to fetch customer detail:', err);
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [selectedId]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* 左パネル: 顧客リスト */}
      <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">メッセージ</h2>
        </div>
        {loadingList ? (
          <div className="p-4 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">
            顧客がいません
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {customers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => setSelectedId(customer.id)}
                className={`flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                  selectedId === customer.id ? 'bg-[#06C755]/10' : ''
                }`}
              >
                {customer.picture_url ? (
                  <img
                    src={customer.picture_url}
                    alt={customer.display_name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#06C755]/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-[#06C755]">
                      {customer.display_name?.charAt(0) || '?'}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {customer.display_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    クリックして会話表示
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 右パネル: メッセージ表示 */}
      <div className="w-2/3 flex flex-col">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400">顧客を選択してください</p>
          </div>
        ) : loadingDetail ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-pulse space-y-3 w-full max-w-md">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`h-10 bg-gray-200 rounded-2xl ${i % 2 === 0 ? 'w-48' : 'w-56'}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : selectedCustomer ? (
          <>
            {/* ヘッダー */}
            <div className="p-4 border-b border-gray-100 flex items-center gap-3">
              {selectedCustomer.picture_url ? (
                <img
                  src={selectedCustomer.picture_url}
                  alt={selectedCustomer.display_name}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#06C755]/10 flex items-center justify-center">
                  <span className="text-xs font-medium text-[#06C755]">
                    {selectedCustomer.display_name?.charAt(0) || '?'}
                  </span>
                </div>
              )}
              <h3 className="font-semibold text-gray-900">
                {selectedCustomer.display_name}
              </h3>
            </div>

            {/* メッセージ一覧 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedCustomer.recent_messages &&
              selectedCustomer.recent_messages.length > 0 ? (
                selectedCustomer.recent_messages.map((msg) => (
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
                ))
              ) : (
                <div className="flex-1 flex items-center justify-center h-full">
                  <p className="text-gray-400 text-sm">メッセージなし</p>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
