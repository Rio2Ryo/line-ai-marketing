'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Widget {
  id: string;
  widget_type: string;
  position: number;
  size: 'small' | 'medium';
  is_visible: number;
}

interface DailyMessage {
  date: string;
  inbound: number;
  outbound: number;
}

interface RecentActivityItem {
  display_name: string;
  content: string;
  timestamp: string;
  direction: 'inbound' | 'outbound';
}

interface TagItem {
  tag_name: string;
  color: string;
  user_count: number;
}

interface WidgetDataPayload {
  total_customers: number;
  new_customers: number;
  messages_today: number;
  delivery_rate: number;
  active_scenarios: number;
  unread_chats: number;
  conversion_rate: number;
  conversions_count: number;
  avg_engagement: number;
  engagement_count: number;
  daily_messages: DailyMessage[];
  delivery_status: { sent: number; pending: number; failed: number };
  recent_activity: RecentActivityItem[];
  top_tags: TagItem[];
}

// ---------------------------------------------------------------------------
// Widget Metadata
// ---------------------------------------------------------------------------

const WIDGET_META: Record<
  string,
  { label: string; icon: React.ReactNode; description: string }
> = {
  total_customers: {
    label: '総顧客数',
    description: '友だち登録されている総顧客数',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  new_customers: {
    label: '今月新規',
    description: '今月追加された新規顧客数',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
  },
  messages_today: {
    label: '本日メッセージ',
    description: '本日送受信されたメッセージ数',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  delivery_rate: {
    label: '配信成功率',
    description: 'メッセージの配信成功率',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  active_scenarios: {
    label: '稼働シナリオ',
    description: '現在稼働中のシナリオ配信数',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  unread_chats: {
    label: '未読チャット',
    description: '未読のチャットメッセージ数',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  conversion_rate: {
    label: 'CV率',
    description: 'コンバージョン率',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  avg_engagement: {
    label: '平均スコア',
    description: '平均エンゲージメントスコア',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
  daily_messages: {
    label: '日別メッセージ',
    description: '直近7日間の送受信メッセージ推移',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  delivery_status: {
    label: '配信ステータス',
    description: '配信状況の内訳（送信済・保留・失敗）',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  recent_activity: {
    label: '最近のアクティビティ',
    description: '直近のメッセージ送受信履歴',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  top_tags: {
    label: 'よく使われるタグ',
    description: '顧客に多く付与されているタグ一覧',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
};

const SMALL_WIDGET_TYPES = [
  'total_customers',
  'new_customers',
  'messages_today',
  'delivery_rate',
  'active_scenarios',
  'unread_chats',
  'conversion_rate',
  'avg_engagement',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'たった今';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}日前`;
  return new Date(timestamp).toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  });
}

function getSmallWidgetValue(
  widgetType: string,
  data: WidgetDataPayload | null
): string {
  if (!data) return '—';
  switch (widgetType) {
    case 'total_customers':
      return (data.total_customers ?? 0).toLocaleString();
    case 'new_customers':
      return (data.new_customers ?? 0).toLocaleString();
    case 'messages_today':
      return (data.messages_today ?? 0).toLocaleString();
    case 'delivery_rate':
      return (data.delivery_rate ?? 0) + '%';
    case 'active_scenarios':
      return (data.active_scenarios ?? 0).toLocaleString();
    case 'unread_chats':
      return (data.unread_chats ?? 0).toLocaleString();
    case 'conversion_rate':
      return (data.conversion_rate ?? 0) + '%';
    case 'avg_engagement':
      return (data.avg_engagement ?? 0).toLocaleString();
    default:
      return '—';
  }
}

// Small‐widget accent colors per type
const WIDGET_COLORS: Record<string, { bg: string; text: string }> = {
  total_customers: { bg: 'bg-blue-50', text: 'text-blue-500' },
  new_customers: { bg: 'bg-emerald-50', text: 'text-emerald-500' },
  messages_today: { bg: 'bg-violet-50', text: 'text-violet-500' },
  delivery_rate: { bg: 'bg-green-50', text: 'text-green-500' },
  active_scenarios: { bg: 'bg-amber-50', text: 'text-amber-500' },
  unread_chats: { bg: 'bg-red-50', text: 'text-red-500' },
  conversion_rate: { bg: 'bg-indigo-50', text: 'text-indigo-500' },
  avg_engagement: { bg: 'bg-yellow-50', text: 'text-yellow-500' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [widgetData, setWidgetData] = useState<WidgetDataPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOverWidget, setDragOverWidget] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const fetchWidgets = useCallback(async () => {
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/widgets');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setWidgets(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch widgets:', err);
    }
  }, []);

  const fetchWidgetData = useCallback(async () => {
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/widgets/data');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setWidgetData(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch widget data:', err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchWidgets(), fetchWidgetData()]);
      setLoading(false);
    };
    init();
  }, [fetchWidgets, fetchWidgetData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      if (!editMode) {
        fetchWidgetData();
      }
    }, 30000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [editMode, fetchWidgetData]);

  // -----------------------------------------------------------------------
  // Layout save
  // -----------------------------------------------------------------------

  const saveLayout = useCallback(
    async (widgetsToSave: Widget[]) => {
      setSaving(true);
      try {
        await fetchWithAuth(getApiUrl() + '/api/widgets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            widgets: widgetsToSave.map((w) => ({
              id: w.id,
              position: w.position,
              size: w.size,
              is_visible: w.is_visible,
            })),
          }),
        });
      } catch (err) {
        console.error('Failed to save layout:', err);
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const handleToggleEditMode = useCallback(async () => {
    if (editMode) {
      // Exiting edit mode => save
      await saveLayout(widgets);
    }
    setEditMode((prev) => !prev);
  }, [editMode, widgets, saveLayout]);

  const handleReset = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/widgets/reset', {
        method: 'POST',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setWidgets(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to reset widgets:', err);
    } finally {
      setSaving(false);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Drag & Drop
  // -----------------------------------------------------------------------

  const handleDragStart = useCallback(
    (e: React.DragEvent, widgetId: string) => {
      setDraggedWidget(widgetId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', widgetId);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetId?: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (targetId) setDragOverWidget(targetId);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDragOverWidget(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetWidgetId: string) => {
      e.preventDefault();
      const sourceId = draggedWidget;
      if (!sourceId || sourceId === targetWidgetId) {
        setDraggedWidget(null);
        setDragOverWidget(null);
        return;
      }

      setWidgets((prev) => {
        const newWidgets = [...prev];
        const sourceIdx = newWidgets.findIndex((w) => w.id === sourceId);
        const targetIdx = newWidgets.findIndex(
          (w) => w.id === targetWidgetId
        );
        if (sourceIdx === -1 || targetIdx === -1) return prev;
        const [moved] = newWidgets.splice(sourceIdx, 1);
        newWidgets.splice(targetIdx, 0, moved);
        return newWidgets.map((w, i) => ({ ...w, position: i }));
      });

      setDraggedWidget(null);
      setDragOverWidget(null);
    },
    [draggedWidget]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedWidget(null);
    setDragOverWidget(null);
  }, []);

  // -----------------------------------------------------------------------
  // Widget actions (edit mode)
  // -----------------------------------------------------------------------

  const toggleWidgetVisibility = useCallback((widgetId: string) => {
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === widgetId
          ? { ...w, is_visible: w.is_visible === 1 ? 0 : 1 }
          : w
      )
    );
  }, []);

  const toggleWidgetSize = useCallback((widgetId: string) => {
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === widgetId
          ? { ...w, size: w.size === 'small' ? 'medium' : 'small' }
          : w
      )
    );
  }, []);

  // -----------------------------------------------------------------------
  // Widget content renderers
  // -----------------------------------------------------------------------

  const renderSmallWidget = (widget: Widget) => {
    const meta = WIDGET_META[widget.widget_type];
    const colors = WIDGET_COLORS[widget.widget_type] || {
      bg: 'bg-gray-50',
      text: 'text-gray-500',
    };
    const value = getSmallWidgetValue(widget.widget_type, widgetData);
    const isUnread =
      widget.widget_type === 'unread_chats' &&
      widgetData &&
      (widgetData.unread_chats ?? 0) > 0;

    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <span
            className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${colors.bg} ${colors.text}`}
          >
            {meta?.icon}
          </span>
          {isUnread && (
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">
              {widgetData!.unread_chats}件
            </span>
          )}
        </div>
        <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
        <p className="text-sm text-gray-500 mt-1">{meta?.label}</p>
      </div>
    );
  };

  const renderDailyMessages = () => {
    const dailyMessages = widgetData?.daily_messages?.slice(-7) || [];
    const maxCount = Math.max(
      ...dailyMessages.map((d) => Math.max(d.inbound, d.outbound)),
      1
    );

    return (
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          日別メッセージ（直近7日）
        </h3>
        {dailyMessages.length > 0 ? (
          <div
            className="flex items-end justify-around gap-4"
            style={{ height: 160 }}
          >
            {dailyMessages.map((day) => {
              const inH = (day.inbound / maxCount) * 120;
              const outH = (day.outbound / maxCount) * 120;
              const dateLabel = new Date(day.date).toLocaleDateString('ja-JP', {
                month: 'numeric',
                day: 'numeric',
              });
              return (
                <div
                  key={day.date}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className="flex items-end gap-1"
                    style={{ height: 120 }}
                  >
                    <div
                      className="w-6 bg-gray-300 rounded-t"
                      style={{ height: inH }}
                      title={'受信: ' + day.inbound}
                    />
                    <div
                      className="w-6 bg-[#06C755] rounded-t"
                      style={{ height: outH }}
                      title={'送信: ' + day.outbound}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{dateLabel}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">データなし</p>
        )}
        <div className="flex items-center gap-6 mt-4 justify-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-300 rounded" />
            <span className="text-xs text-gray-500">受信</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#06C755] rounded" />
            <span className="text-xs text-gray-500">送信</span>
          </div>
        </div>
      </div>
    );
  };

  const renderDeliveryStatus = () => {
    const ds = widgetData?.delivery_status;
    const sent = ds?.sent ?? 0;
    const pending = ds?.pending ?? 0;
    const failed = ds?.failed ?? 0;
    const total = sent + pending + failed;
    const sentPct = total > 0 ? (sent / total) * 100 : 0;
    const pendingPct = total > 0 ? (pending / total) * 100 : 0;
    const failedPct = total > 0 ? (failed / total) * 100 : 0;

    return (
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          配信ステータス
        </h3>
        {total > 0 ? (
          <>
            <div className="flex rounded-full overflow-hidden h-6">
              {sentPct > 0 && (
                <div
                  className="bg-[#06C755] flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: sentPct + '%' }}
                >
                  {sentPct > 10 ? Math.round(sentPct) + '%' : ''}
                </div>
              )}
              {pendingPct > 0 && (
                <div
                  className="bg-yellow-400 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: pendingPct + '%' }}
                >
                  {pendingPct > 10 ? Math.round(pendingPct) + '%' : ''}
                </div>
              )}
              {failedPct > 0 && (
                <div
                  className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: failedPct + '%' }}
                >
                  {failedPct > 10 ? Math.round(failedPct) + '%' : ''}
                </div>
              )}
            </div>
            <div className="flex items-center gap-6 mt-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#06C755] rounded" />
                <span className="text-sm text-gray-600">
                  送信済 ({sent.toLocaleString()})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-400 rounded" />
                <span className="text-sm text-gray-600">
                  保留中 ({pending.toLocaleString()})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded" />
                <span className="text-sm text-gray-600">
                  失敗 ({failed.toLocaleString()})
                </span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            配信データなし
          </p>
        )}
      </div>
    );
  };

  const renderRecentActivity = () => {
    const activity = widgetData?.recent_activity || [];

    return (
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          最近のアクティビティ
        </h3>
        {activity.length > 0 ? (
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {activity.slice(0, 10).map((item, idx) => {
              const initial = (item.display_name || '?').charAt(0);
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {item.display_name || '不明'}
                      </span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          item.direction === 'inbound'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {item.direction === 'inbound' ? '受信' : '送信'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {item.content || '—'}
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                    {formatRelativeTime(item.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">
            アクティビティなし
          </p>
        )}
      </div>
    );
  };

  const renderTopTags = () => {
    const tags = widgetData?.top_tags || [];
    const maxCount = Math.max(...tags.map((t) => t.user_count), 1);

    return (
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          よく使われるタグ
        </h3>
        {tags.length > 0 ? (
          <div className="space-y-3">
            {tags.map((tag, idx) => {
              const barWidth =
                maxCount > 0 ? (tag.user_count / maxCount) * 100 : 0;
              return (
                <div key={idx} className="flex items-center gap-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color || '#6B7280' }}
                  />
                  <span className="text-sm text-gray-700 w-24 truncate flex-shrink-0">
                    {tag.tag_name}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: barWidth + '%',
                        backgroundColor: tag.color || '#6B7280',
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right flex-shrink-0">
                    {tag.user_count}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">
            タグデータなし
          </p>
        )}
      </div>
    );
  };

  const renderWidgetContent = (widget: Widget) => {
    if (SMALL_WIDGET_TYPES.includes(widget.widget_type)) {
      return renderSmallWidget(widget);
    }
    switch (widget.widget_type) {
      case 'daily_messages':
        return renderDailyMessages();
      case 'delivery_status':
        return renderDeliveryStatus();
      case 'recent_activity':
        return renderRecentActivity();
      case 'top_tags':
        return renderTopTags();
      default:
        return (
          <div className="p-6 text-sm text-gray-400">
            不明なウィジェット: {widget.widget_type}
          </div>
        );
    }
  };

  // -----------------------------------------------------------------------
  // Grid class helpers
  // -----------------------------------------------------------------------

  const getWidgetColSpan = (widget: Widget): string => {
    if (widget.size === 'medium') return 'col-span-1 md:col-span-2';
    return 'col-span-1';
  };

  // -----------------------------------------------------------------------
  // Loading skeleton
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-64 bg-gray-100 rounded animate-pulse mt-2" />
          </div>
          <div className="h-9 w-28 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="w-16 h-5 bg-gray-200 rounded-full" />
              </div>
              <div className="h-8 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Sort widgets for display
  // -----------------------------------------------------------------------

  const sortedWidgets = [...widgets].sort((a, b) => a.position - b.position);
  const visibleWidgets = editMode
    ? sortedWidgets
    : sortedWidgets.filter((w) => w.is_visible === 1);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
          {editMode && (
            <p className="text-sm text-gray-500 mt-1">
              ウィジェットをドラッグ&ドロップで配置できます
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {editMode && (
            <button
              onClick={handleReset}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              リセット
            </button>
          )}
          <button
            onClick={handleToggleEditMode}
            disabled={saving}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
              editMode
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {saving && (
              <svg
                className="w-4 h-4 animate-spin"
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
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {editMode ? (
              <>
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                完了
              </>
            ) : (
              <>
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
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                編集モード
              </>
            )}
          </button>
        </div>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {visibleWidgets.map((widget) => {
          const isHidden = widget.is_visible === 0;
          const isDragged = draggedWidget === widget.id;
          const isDragOver = dragOverWidget === widget.id;
          const meta = WIDGET_META[widget.widget_type];

          return (
            <div
              key={widget.id}
              className={`${getWidgetColSpan(widget)} relative group transition-all ${
                isDragged ? 'opacity-40 scale-95' : ''
              } ${isDragOver ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`}
              draggable={editMode}
              onDragStart={
                editMode ? (e) => handleDragStart(e, widget.id) : undefined
              }
              onDragOver={
                editMode
                  ? (e) => handleDragOver(e, widget.id)
                  : undefined
              }
              onDragLeave={editMode ? handleDragLeave : undefined}
              onDrop={
                editMode ? (e) => handleDrop(e, widget.id) : undefined
              }
              onDragEnd={editMode ? handleDragEnd : undefined}
            >
              <div
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all ${
                  editMode
                    ? 'border-dashed border-gray-300 hover:border-gray-400'
                    : 'border-gray-100'
                } ${isHidden ? 'opacity-40' : ''}`}
              >
                {/* Edit mode controls */}
                {editMode && (
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-dashed border-gray-200">
                    {/* Drag handle */}
                    <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <circle cx="7" cy="4" r="1.5" />
                        <circle cx="13" cy="4" r="1.5" />
                        <circle cx="7" cy="10" r="1.5" />
                        <circle cx="13" cy="10" r="1.5" />
                        <circle cx="7" cy="16" r="1.5" />
                        <circle cx="13" cy="16" r="1.5" />
                      </svg>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Size toggle */}
                      <button
                        onClick={() => toggleWidgetSize(widget.id)}
                        className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                        title={
                          widget.size === 'small'
                            ? '大きくする'
                            : '小さくする'
                        }
                      >
                        {widget.size === 'small' ? (
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
                              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
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
                              d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M15 15h4.5m-4.5 0v4.5m0-4.5l5.5 5.5"
                            />
                          </svg>
                        )}
                      </button>

                      {/* Visibility toggle */}
                      <button
                        onClick={() => toggleWidgetVisibility(widget.id)}
                        className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                        title={isHidden ? '表示する' : '非表示にする'}
                      >
                        {isHidden ? (
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
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
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
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Widget content */}
                {isHidden && editMode ? (
                  <div className="p-6 flex flex-col items-center justify-center text-gray-400">
                    <svg
                      className="w-8 h-8 mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                      />
                    </svg>
                    <p className="text-sm font-medium">{meta?.label}</p>
                    <button
                      onClick={() => toggleWidgetVisibility(widget.id)}
                      className="mt-2 text-xs text-blue-500 hover:text-blue-700 font-medium"
                    >
                      表示する
                    </button>
                  </div>
                ) : (
                  renderWidgetContent(widget)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {visibleWidgets.length === 0 && !loading && (
        <div className="text-center py-16">
          <svg
            className="w-16 h-16 mx-auto text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-600 mb-1">
            ウィジェットがありません
          </h3>
          <p className="text-sm text-gray-400">
            編集モードからウィジェットを追加してください
          </p>
        </div>
      )}
    </div>
  );
}
