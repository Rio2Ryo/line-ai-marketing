'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';

interface WebhookEvent {
  id: string;
  event_type: string;
  source_type: string;
  source_user_id: string | null;
  internal_user_id: string | null;
  message_type: string | null;
  summary: string | null;
  stage: string;
  processing_ms: number | null;
  error_message: string | null;
  created_at: string;
  raw_json?: string;
  response_json?: string;
}

interface Stats {
  total: number;
  by_type: { event_type: string; count: number }[];
  by_stage: { stage: string; count: number }[];
  timing: { avg_ms: number; min_ms: number; max_ms: number };
  hourly: { hour: string; count: number }[];
}

const API = process.env.NEXT_PUBLIC_API_URL || '';

const EVENT_TYPE_COLORS: Record<string, string> = {
  message: 'bg-blue-100 text-blue-800',
  follow: 'bg-green-100 text-green-800',
  unfollow: 'bg-red-100 text-red-800',
  postback: 'bg-purple-100 text-purple-800',
};

const STAGE_COLORS: Record<string, string> = {
  received: 'bg-gray-200 text-gray-700',
  parsed: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  responded: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
};

const STAGE_ORDER = ['received', 'processing', 'completed'];

export default function WebhookStreamPage() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [filterStage, setFilterStage] = useState<string>('');
  const [debugMode, setDebugMode] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [statsHours, setStatsHours] = useState(24);
  const listRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const fetchEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (filterType) params.set('type', filterType);
      if (filterStage) params.set('stage', filterStage);
      const res = await fetch(`${API}/api/webhook-stream/events?${params}`);
      if (res.ok) {
        const json = await res.json() as { data: WebhookEvent[] };
        setEvents(json.data || []);
      }
    } catch {}
  }, [filterType, filterStage]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/webhook-stream/stats?hours=${statsHours}`);
      if (res.ok) {
        const json = await res.json() as { data: Stats };
        setStats(json.data || null);
      }
    } catch {}
  }, [statsHours]);

  const fetchEventDetail = async (id: string) => {
    try {
      const res = await fetch(`${API}/api/webhook-stream/events/${id}`);
      if (res.ok) {
        const json = await res.json() as { data: WebhookEvent };
        setSelectedEvent(json.data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchEvents();
    fetchStats();
  }, [fetchEvents, fetchStats]);

  useEffect(() => {
    if (isLive) {
      pollingRef.current = setInterval(() => {
        fetchEvents();
        fetchStats();
      }, 2000);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [isLive, fetchEvents, fetchStats]);

  const formatTime = (iso: string) => {
    const d = new Date(iso + 'Z');
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const maxHourly = stats?.hourly ? Math.max(...stats.hourly.map(h => h.count), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setIsLive(!isLive)}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
            isLive ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-white animate-pulse' : 'bg-gray-500'}`} />
          {isLive ? 'LIVE' : 'PAUSED'}
        </button>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Types</option>
          <option value="message">message</option>
          <option value="follow">follow</option>
          <option value="unfollow">unfollow</option>
          <option value="postback">postback</option>
        </select>

        <select
          value={filterStage}
          onChange={(e) => setFilterStage(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Stages</option>
          <option value="received">received</option>
          <option value="processing">processing</option>
          <option value="completed">completed</option>
          <option value="error">error</option>
        </select>

        <button
          onClick={() => setDebugMode(!debugMode)}
          className={`px-3 py-2 rounded-lg text-sm font-medium ${
            debugMode ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          Debug
        </button>

        <select
          value={statsHours}
          onChange={(e) => setStatsHours(Number(e.target.value))}
          className="px-3 py-2 border rounded-lg text-sm ml-auto"
        >
          <option value={1}>1h</option>
          <option value={6}>6h</option>
          <option value={24}>24h</option>
          <option value={72}>3d</option>
          <option value={168}>7d</option>
        </select>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-xs text-gray-500">Total Events</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-xs text-gray-500">Avg Processing</p>
            <p className="text-2xl font-bold text-gray-900">{stats.timing.avg_ms}ms</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-xs text-gray-500">Errors</p>
            <p className="text-2xl font-bold text-red-600">
              {stats.by_stage.find(s => s.stage === 'error')?.count || 0}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-xs text-gray-500">Event Types</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {stats.by_type.map(t => (
                <span key={t.event_type} className={`px-2 py-0.5 rounded text-xs font-medium ${EVENT_TYPE_COLORS[t.event_type] || 'bg-gray-100 text-gray-700'}`}>
                  {t.event_type}: {t.count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hourly Chart */}
      {stats && stats.hourly.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Event Volume</h3>
          <div className="flex items-end gap-1 h-24">
            {stats.hourly.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-blue-400 rounded-t min-h-[2px]"
                  style={{ height: `${(h.count / maxHourly) * 100}%` }}
                  title={`${h.hour}: ${h.count} events`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-gray-400">
              {stats.hourly[0]?.hour?.substring(11, 16) || ''}
            </span>
            <span className="text-[10px] text-gray-400">
              {stats.hourly[stats.hourly.length - 1]?.hour?.substring(11, 16) || ''}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Event Stream */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Event Stream</h3>
            <span className="text-xs text-gray-400">{events.length} events</span>
          </div>
          <div ref={listRef} className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {events.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No webhook events yet. Events will appear here in real-time.
              </div>
            ) : (
              events.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => fetchEventDetail(ev.id)}
                  className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedEvent?.id === ev.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${EVENT_TYPE_COLORS[ev.event_type] || 'bg-gray-100 text-gray-700'}`}>
                      {ev.event_type}
                    </span>
                    {ev.message_type && (
                      <span className="text-xs text-gray-500">{ev.message_type}</span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs ${STAGE_COLORS[ev.stage] || 'bg-gray-100'}`}>
                      {ev.stage}
                    </span>
                    {ev.processing_ms != null && (
                      <span className="text-xs text-gray-400">{ev.processing_ms}ms</span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">{formatTime(ev.created_at)}</span>
                  </div>
                  {ev.summary && (
                    <p className="text-sm text-gray-600 truncate">{ev.summary}</p>
                  )}
                  {ev.error_message && (
                    <p className="text-xs text-red-500 truncate mt-1">{ev.error_message}</p>
                  )}

                  {/* Pipeline Visualization */}
                  <div className="flex items-center gap-1 mt-2">
                    {STAGE_ORDER.map((stage, i) => {
                      const stageIdx = STAGE_ORDER.indexOf(ev.stage === 'error' ? 'completed' : ev.stage);
                      const isReached = i <= stageIdx;
                      const isError = ev.stage === 'error' && i === STAGE_ORDER.length - 1;
                      return (
                        <div key={stage} className="flex items-center gap-1">
                          <div className={`w-5 h-1.5 rounded-full ${
                            isError ? 'bg-red-400' : isReached ? 'bg-green-400' : 'bg-gray-200'
                          }`} />
                          {i < STAGE_ORDER.length - 1 && (
                            <svg className="w-2 h-2 text-gray-300" viewBox="0 0 8 8"><path d="M0 0 L8 4 L0 8 Z" fill="currentColor"/></svg>
                          )}
                        </div>
                      );
                    })}
                    <span className="text-[10px] text-gray-400 ml-1">
                      {STAGE_ORDER.map(s => s === ev.stage ? s.toUpperCase() : s).join(' > ')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">Event Detail</h3>
          </div>
          {selectedEvent ? (
            <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
              <div>
                <p className="text-xs text-gray-500 mb-1">ID</p>
                <p className="text-xs font-mono text-gray-700 break-all">{selectedEvent.id}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Type</p>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${EVENT_TYPE_COLORS[selectedEvent.event_type] || 'bg-gray-100'}`}>
                    {selectedEvent.event_type}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Stage</p>
                  <span className={`px-2 py-0.5 rounded text-xs ${STAGE_COLORS[selectedEvent.stage] || 'bg-gray-100'}`}>
                    {selectedEvent.stage}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Message Type</p>
                  <p className="text-sm text-gray-700">{selectedEvent.message_type || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Processing</p>
                  <p className="text-sm text-gray-700">{selectedEvent.processing_ms != null ? `${selectedEvent.processing_ms}ms` : '-'}</p>
                </div>
              </div>
              {selectedEvent.summary && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Summary</p>
                  <p className="text-sm text-gray-700">{selectedEvent.summary}</p>
                </div>
              )}
              {selectedEvent.source_user_id && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Source User ID</p>
                  <p className="text-xs font-mono text-gray-700 break-all">{selectedEvent.source_user_id}</p>
                </div>
              )}
              {selectedEvent.error_message && (
                <div>
                  <p className="text-xs text-red-500 mb-1">Error</p>
                  <p className="text-sm text-red-600 bg-red-50 rounded p-2">{selectedEvent.error_message}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 mb-1">Created</p>
                <p className="text-sm text-gray-700">{new Date(selectedEvent.created_at + 'Z').toLocaleString('ja-JP')}</p>
              </div>

              {/* Pipeline Detail */}
              <div>
                <p className="text-xs text-gray-500 mb-2">Processing Pipeline</p>
                <div className="space-y-2">
                  {STAGE_ORDER.map((stage, i) => {
                    const stageIdx = STAGE_ORDER.indexOf(selectedEvent.stage === 'error' ? 'completed' : selectedEvent.stage);
                    const isReached = i <= stageIdx;
                    const isError = selectedEvent.stage === 'error' && i === STAGE_ORDER.length - 1;
                    const isCurrent = stage === selectedEvent.stage || (isError && i === STAGE_ORDER.length - 1);
                    return (
                      <div key={stage} className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isError && isCurrent ? 'bg-red-500 text-white' :
                          isReached ? 'bg-green-500 text-white' :
                          'bg-gray-200 text-gray-500'
                        }`}>
                          {isError && isCurrent ? '!' : isReached ? '\u2713' : (i + 1)}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${isCurrent ? 'text-gray-900' : 'text-gray-500'}`}>
                            {stage.charAt(0).toUpperCase() + stage.slice(1)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Debug: Raw JSON */}
              {debugMode && selectedEvent.raw_json && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Raw JSON</p>
                  <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap">
                    {(() => {
                      try { return JSON.stringify(JSON.parse(selectedEvent.raw_json), null, 2); }
                      catch { return selectedEvent.raw_json; }
                    })()}
                  </pre>
                </div>
              )}
              {debugMode && selectedEvent.response_json && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Response JSON</p>
                  <pre className="text-xs bg-gray-900 text-blue-400 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap">
                    {(() => {
                      try { return JSON.stringify(JSON.parse(selectedEvent.response_json), null, 2); }
                      catch { return selectedEvent.response_json; }
                    })()}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400 text-sm">
              Click an event to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
