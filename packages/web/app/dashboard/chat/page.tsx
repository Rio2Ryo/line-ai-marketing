'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface Conversation {
  id: string;
  line_user_id: string;
  display_name: string;
  picture_url: string | null;
  status: 'active' | 'blocked' | 'unfollowed';
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  message_type: string;
  sent_at: string;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return '昨日';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch conversations list
  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (search) params.set('search', search);
      const res = await fetchWithAuth(
        getApiUrl() + '/api/chat/conversations?' + params.toString()
      );
      if (res.ok) {
        const json = await res.json();
        setConversations(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Fetch messages for selected user
  const fetchMessages = useCallback(async (userId: string, before?: string) => {
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (before) params.set('before', before);
      const res = await fetchWithAuth(
        getApiUrl() + '/api/chat/' + userId + '/messages?' + params.toString()
      );
      if (res.ok) {
        const json = await res.json();
        const fetched = (json.data || []) as Message[];
        if (before) {
          setMessages((prev) => [...fetched, ...prev]);
        } else {
          setMessages(fetched);
        }
        setHasMore(json.has_more || false);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, []);

  // Mark conversation as read
  const markAsRead = useCallback(async (userId: string) => {
    try {
      await fetchWithAuth(getApiUrl() + '/api/chat/' + userId + '/read', {
        method: 'POST',
      });
      // Update local unread count
      setConversations((prev) =>
        prev.map((c) =>
          c.id === userId ? { ...c, unread_count: 0 } : c
        )
      );
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, []);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!selectedUser || !newMessage.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetchWithAuth(
        getApiUrl() + '/api/chat/' + selectedUser.id + '/send',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newMessage.trim() }),
        }
      );
      if (res.ok) {
        setNewMessage('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        // Refresh messages after sending
        await fetchMessages(selectedUser.id);
        scrollToBottom();
        // Refresh conversation list to update last message
        fetchConversations();
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  }, [selectedUser, newMessage, sending, fetchMessages, fetchConversations]);

  // Select a conversation
  const handleSelectConversation = useCallback(
    async (conversation: Conversation) => {
      setSelectedUser(conversation);
      setMessages([]);
      setLoadingMessages(true);
      setMobileShowChat(true);
      try {
        await fetchMessages(conversation.id);
        await markAsRead(conversation.id);
      } finally {
        setLoadingMessages(false);
      }
      setTimeout(() => scrollToBottom(), 100);
    },
    [fetchMessages, markAsRead]
  );

  // Load more (older) messages
  const handleLoadMore = useCallback(async () => {
    if (!selectedUser || !hasMore || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;
    try {
      const oldestMessage = messages[0];
      await fetchMessages(selectedUser.id, oldestMessage.sent_at);
    } finally {
      setLoadingMore(false);
      // Maintain scroll position after loading older messages
      if (container) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight - prevScrollHeight;
        });
      }
    }
  }, [selectedUser, hasMore, loadingMore, messages, fetchMessages]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    const lineHeight = 24;
    const maxHeight = lineHeight * 4;
    textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
  };

  // Handle keyboard shortcuts in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Initial load of conversations
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Poll conversations every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Poll messages every 5 seconds when a conversation is selected
  useEffect(() => {
    if (!selectedUser) return;
    const interval = setInterval(() => {
      fetchMessages(selectedUser.id);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedUser, fetchMessages]);

  // Scroll to bottom when messages change (only if near bottom)
  useEffect(() => {
    if (messages.length === 0) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) {
      scrollToBottom();
    }
  }, [messages]);

  // Group messages by date
  const messagesByDate = messages.reduce<Record<string, Message[]>>(
    (groups, msg) => {
      const dateKey = formatDateGroup(msg.sent_at);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(msg);
      return groups;
    },
    {}
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return { className: 'bg-green-100 text-green-700', dot: 'bg-green-500' };
      case 'unfollowed':
        return { className: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' };
      case 'blocked':
        return { className: 'bg-red-100 text-red-700', dot: 'bg-red-500' };
      default:
        return { className: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' };
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Left Panel: Conversation List */}
      <div
        className={`w-full md:w-80 border-r border-gray-200 flex flex-col ${
          mobileShowChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="名前で検索..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLoading(true);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <svg
                className="w-16 h-16 text-gray-300 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="text-gray-400 text-sm">メッセージはまだありません</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => handleSelectConversation(conversation)}
                  className={`flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                    selectedUser?.id === conversation.id
                      ? 'bg-blue-50 border-l-4 border-blue-500'
                      : 'border-l-4 border-transparent'
                  }`}
                >
                  {/* Avatar */}
                  {conversation.picture_url ? (
                    <img
                      src={conversation.picture_url}
                      alt={conversation.display_name}
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-white">
                        {conversation.display_name?.charAt(0) || '?'}
                      </span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900 truncate text-sm">
                        {conversation.display_name}
                      </p>
                      {conversation.last_message_at && (
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                          {formatRelativeTime(conversation.last_message_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-sm text-gray-500 truncate">
                        {conversation.last_message || ''}
                      </p>
                      {conversation.unread_count > 0 && (
                        <span className="bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center flex-shrink-0 ml-2">
                          {conversation.unread_count > 99
                            ? '99+'
                            : conversation.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Chat Thread */}
      <div
        className={`flex-1 flex flex-col ${
          mobileShowChat ? 'flex' : 'hidden md:flex'
        }`}
      >
        {!selectedUser ? (
          /* Empty state: no conversation selected */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <svg
              className="w-20 h-20 text-gray-300 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="text-gray-400">左の一覧からチャットを選択してください</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-white">
              {/* Mobile back button */}
              <button
                onClick={() => {
                  setMobileShowChat(false);
                  setSelectedUser(null);
                }}
                className="md:hidden p-1 -ml-1 text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
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
              </button>

              {/* User avatar */}
              {selectedUser.picture_url ? (
                <img
                  src={selectedUser.picture_url}
                  alt={selectedUser.display_name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {selectedUser.display_name?.charAt(0) || '?'}
                  </span>
                </div>
              )}

              {/* User info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {selectedUser.display_name}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      getStatusBadge(selectedUser.status).className
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        getStatusBadge(selectedUser.status).dot
                      }`}
                    />
                    {selectedUser.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 truncate">
                  {selectedUser.line_user_id}
                </p>
              </div>
            </div>

            {/* Messages Area */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 bg-gray-50"
            >
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-pulse space-y-3 w-full max-w-md">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`flex ${
                          i % 2 === 0 ? 'justify-start' : 'justify-end'
                        }`}
                      >
                        <div
                          className={`h-10 bg-gray-200 rounded-2xl ${
                            i % 2 === 0 ? 'w-48' : 'w-56'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-400 text-sm">メッセージなし</p>
                </div>
              ) : (
                <>
                  {/* Load more button */}
                  {hasMore && (
                    <div className="flex justify-center mb-4">
                      <button
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="px-4 py-2 text-sm text-blue-600 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingMore ? (
                          <span className="flex items-center gap-2">
                            <svg
                              className="animate-spin w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                            読み込み中...
                          </span>
                        ) : (
                          '過去のメッセージを読み込む'
                        )}
                      </button>
                    </div>
                  )}

                  {/* Messages grouped by date */}
                  {Object.entries(messagesByDate).map(([dateLabel, msgs]) => (
                    <div key={dateLabel}>
                      {/* Date separator */}
                      <div className="flex items-center justify-center my-4">
                        <span className="px-3 py-1 bg-gray-200 text-gray-500 text-xs rounded-full">
                          {dateLabel}
                        </span>
                      </div>

                      {/* Messages for this date */}
                      {msgs.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex mb-3 ${
                            msg.direction === 'outbound'
                              ? 'justify-end'
                              : 'justify-start'
                          }`}
                        >
                          <div className="max-w-[70%]">
                            <div
                              className={`px-4 py-2 ${
                                msg.direction === 'outbound'
                                  ? 'bg-blue-500 text-white rounded-2xl rounded-br-sm'
                                  : 'bg-white border border-gray-200 text-gray-900 rounded-2xl rounded-bl-sm'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {msg.content}
                              </p>
                            </div>
                            <p
                              className={`text-xs text-gray-400 mt-1 ${
                                msg.direction === 'outbound'
                                  ? 'text-right'
                                  : 'text-left'
                              }`}
                            >
                              {new Date(msg.sent_at).toLocaleTimeString(
                                'ja-JP',
                                { hour: '2-digit', minute: '2-digit' }
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Send Form */}
            <div className="p-4 border-t border-gray-100 bg-white">
              <div className="flex items-end gap-3">
                <textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="メッセージを入力..."
                  rows={1}
                  className="flex-1 resize-none px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ maxHeight: 96 }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
                >
                  {sending ? (
                    <svg
                      className="animate-spin w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  )}
                  送信
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
