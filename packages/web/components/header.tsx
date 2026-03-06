"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { removeToken } from "@/lib/auth";
import { useTranslation, Locale } from '@/lib/i18n';
import { useRole } from '@/lib/role';
import { useAccount } from '@/lib/account';
import { useTheme } from '@/lib/theme';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://line-ai-marketing-api.common-gifted-tokyo.workers.dev';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  icon: string | null;
  link: string | null;
  is_read: number;
  source_display_name: string | null;
  source_picture_url: string | null;
  created_at: string;
}

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function typeIcon(type: string) {
  switch (type) {
    case 'new_follower':
      return { bg: 'bg-green-100', color: 'text-green-600', path: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' };
    case 'message_received':
      return { bg: 'bg-blue-100', color: 'text-blue-600', path: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' };
    case 'escalation':
      return { bg: 'bg-red-100', color: 'text-red-600', path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' };
    case 'delivery_complete':
      return { bg: 'bg-green-100', color: 'text-green-600', path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' };
    case 'delivery_failed':
      return { bg: 'bg-red-100', color: 'text-red-600', path: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' };
    default:
      return { bg: 'bg-gray-100', color: 'text-gray-600', path: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' };
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '今';
  if (mins < 60) return `${mins}分前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}時間前`;
  const days = Math.floor(hrs / 24);
  return `${days}日前`;
}

interface HeaderProps {
  title: string;
  onMenuToggle: () => void;
}

export default function Header({ title, onMenuToggle }: HeaderProps) {
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();
  const { role } = useRole();
  const { accounts, currentAccountId, currentAccount, switchAccount } = useAccount();
  const { isDark, setMode, mode } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastPollRef = useRef<string>(new Date().toISOString());

  // Poll for new notifications every 15 seconds
  const pollNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/unread-count`, {
        headers: authHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setUnreadCount(json.data?.count || 0);
      }
    } catch (e) { /* silent */ }
  }, []);

  useEffect(() => {
    pollNotifications();
    const interval = setInterval(pollNotifications, 15000);
    return () => clearInterval(interval);
  }, [pollNotifications]);

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false);
      }
    }
    if (showPanel) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPanel]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/notifications?limit=20`, {
        headers: authHeaders(),
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data || []);
      }
    } catch (e) { /* silent */ }
    setLoading(false);
  };

  const togglePanel = () => {
    if (!showPanel) fetchNotifications();
    setShowPanel(!showPanel);
  };

  const markRead = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: authHeaders(),
        credentials: 'include',
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) { /* silent */ }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: 'PUT',
        headers: authHeaders(),
        credentials: 'include',
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (e) { /* silent */ }
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.is_read) markRead(n.id);
    if (n.link) {
      router.push(n.link);
      setShowPanel(false);
    }
  };

  const handleLogout = () => {
    removeToken();
    router.push("/login");
  };

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-3">
        {/* Hamburger menu - mobile only */}
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      </div>
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={togglePanel}
            className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title={locale === 'ja' ? '通知' : 'Notifications'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Panel */}
          {showPanel && (
            <div className="absolute right-0 top-12 w-80 md:w-96 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">
                  {locale === 'ja' ? '通知' : 'Notifications'}
                </h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {locale === 'ja' ? 'すべて既読' : 'Mark all read'}
                    </button>
                  )}
                  <button
                    onClick={() => { router.push('/dashboard/notifications'); setShowPanel(false); }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    {locale === 'ja' ? 'すべて表示' : 'View all'}
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="p-6 text-center">
                    <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-400">
                    {locale === 'ja' ? '通知はありません' : 'No notifications'}
                  </div>
                ) : (
                  notifications.map(n => {
                    const ico = typeIcon(n.type);
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 flex gap-3 ${
                          !n.is_read ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full ${ico.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          <svg className={`w-4 h-4 ${ico.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ico.path} />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${!n.is_read ? 'text-gray-900' : 'text-gray-600'}`}>
                              {n.title}
                            </span>
                            {!n.is_read && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                            )}
                          </div>
                          {n.body && (
                            <p className="text-xs text-gray-500 truncate mt-0.5">{n.body}</p>
                          )}
                          <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Account Switcher */}
        {accounts.length > 1 && (
          <select
            value={currentAccountId}
            onChange={(e) => switchAccount(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 max-w-[140px] truncate"
            title={currentAccount?.name || ''}
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        )}

        {/* Dark mode toggle */}
        <button
          onClick={() => setMode(isDark ? 'light' : 'dark')}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          {isDark ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setLocale('ja')}
            className={`px-2 py-1 text-xs font-medium transition-colors ${
              locale === 'ja' ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900' : 'bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            JA
          </button>
          <button
            onClick={() => setLocale('en')}
            className={`px-2 py-1 text-xs font-medium transition-colors ${
              locale === 'en' ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900' : 'bg-white text-gray-500 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            EN
          </button>
        </div>
        {/* Role badge */}
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          role === 'admin' ? 'bg-purple-100 text-purple-800' :
          role === 'operator' ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-600'
        }`}>
          {role === 'admin' ? (locale === 'ja' ? '管理者' : 'Admin') :
           role === 'operator' ? (locale === 'ja' ? 'オペレーター' : 'Operator') :
           locale === 'ja' ? '閲覧者' : 'Viewer'}
        </span>
        <div className="w-8 h-8 bg-[#06C755]/10 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-[#06C755]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
          {t('header.logout')}
        </button>
      </div>
    </header>
  );
}
