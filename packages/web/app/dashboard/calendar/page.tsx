'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

/* ---------- Types ---------- */
interface ScheduledItem {
  id: string; title: string; scheduled_at: string; status: string;
  message_type: string; target_type: string; sent_count: number; failed_count: number;
}
interface DeliverySummary { total: number; sent: number; failed: number; pending: number }
interface DayData { scheduled: ScheduledItem[]; delivery_summary: DeliverySummary | null }
interface CalendarData {
  month: string;
  calendar: Record<string, DayData>;
  summary: { total_scheduled: number; total_delivered: number; total_failed: number };
}

type ViewMode = 'month' | 'week';

const WD = ['日', '月', '火', '水', '木', '金', '土'];
const SL: Record<string, string> = { pending: '予約中', processing: '処理中', completed: '完了', failed: '失敗', cancelled: 'キャンセル' };
const SC: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-700', processing: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700', cancelled: 'bg-gray-100 text-gray-500' };
const TL: Record<string, string> = { all: '全員', segment: 'セグメント', tag: 'タグ' };

function monthKey(y: number, m: number) { return `${y}-${String(m + 1).padStart(2, '0')}`; }
function dateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function CalendarPage() {
  const now = new Date();
  const [cY, setCY] = useState(now.getFullYear());
  const [cM, setCM] = useState(now.getMonth());
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selDate, setSelDate] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('month');
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d;
  });

  const loadCal = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${getApiUrl()}/api/calendar?month=${monthKey(y, m)}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error('Calendar fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCal(cY, cM); }, [loadCal, cY, cM]);

  // Also load adjacent month for week view that spans month boundary
  useEffect(() => {
    if (view === 'week') {
      const wsMonth = weekStart.getMonth();
      const wsYear = weekStart.getFullYear();
      if (wsMonth !== cM || wsYear !== cY) {
        setCY(wsYear);
        setCM(wsMonth);
      }
    }
  }, [view, weekStart, cM, cY]);

  const prevM = () => { if (cM === 0) { setCY(y => y - 1); setCM(11); } else setCM(m => m - 1); setSelDate(null); };
  const nextM = () => { if (cM === 11) { setCY(y => y + 1); setCM(0); } else setCM(m => m + 1); setSelDate(null); };
  const prevW = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); setSelDate(null); };
  const nextW = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); setSelDate(null); };
  const goToday = () => {
    const t = new Date();
    setCY(t.getFullYear()); setCM(t.getMonth());
    const ws = new Date(t); ws.setDate(ws.getDate() - ws.getDay()); setWeekStart(ws);
    setSelDate(null);
  };

  // Month view cells
  const fd = new Date(cY, cM, 1).getDay();
  const dim = new Date(cY, cM + 1, 0).getDate();
  const monthCells: (string | null)[] = [];
  for (let i = 0; i < fd; i++) monthCells.push(null);
  for (let d = 1; d <= dim; d++) monthCells.push(dateKey(cY, cM, d));

  // Week view cells
  const weekCells: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    weekCells.push(dateKey(d.getFullYear(), d.getMonth(), d.getDate()));
  }

  const calendar = data?.calendar || {};
  const selDayData = selDate ? calendar[selDate] : null;

  const todayStr = dateKey(now.getFullYear(), now.getMonth(), now.getDate());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">配信カレンダー</h1>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">今日</button>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'month' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            >月</button>
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'week' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            >週</button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{data.summary.total_scheduled}</div>
            <div className="text-xs text-gray-500 mt-1">予約配信</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <div className="text-2xl font-bold text-[#06C755]">{data.summary.total_delivered.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">送信成功</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{data.summary.total_failed.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">送信失敗</div>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={view === 'month' ? prevM : prevW} className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-lg font-semibold text-gray-900">
            {view === 'month'
              ? `${cY}年${cM + 1}月`
              : `${weekCells[0].replace(/-/g, '/')} 〜 ${weekCells[6].replace(/-/g, '/')}`
            }
          </span>
          <button onClick={view === 'month' ? nextM : nextW} className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden">
            {WD.map(w => <div key={w} className="py-2 text-center text-xs font-medium bg-gray-50 text-gray-500">{w}</div>)}
            {[...Array(35)].map((_, i) => <div key={i} className="bg-white p-2 min-h-[80px] animate-pulse"><div className="h-3 bg-gray-200 rounded w-6" /></div>)}
          </div>
        ) : view === 'month' ? (
          /* Month View */
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden">
            {WD.map((w, i) => (
              <div key={w} className={`py-2 text-center text-xs font-medium bg-gray-50 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>{w}</div>
            ))}
            {monthCells.map((dk, idx) => {
              if (!dk) return <div key={`e-${idx}`} className="bg-white p-2 min-h-[80px]" />;
              const dayData = calendar[dk];
              const sel = selDate === dk;
              const day = parseInt(dk.slice(8));
              const dow = (fd + day - 1) % 7;
              const isToday = dk === todayStr;
              const hasScheduled = dayData && dayData.scheduled.length > 0;
              const hasDelivery = dayData && dayData.delivery_summary;

              return (
                <div
                  key={dk}
                  onClick={() => setSelDate(sel ? null : dk)}
                  className={`bg-white p-1.5 min-h-[80px] cursor-pointer hover:bg-gray-50 transition-colors ${sel ? 'ring-2 ring-[#06C755] ring-inset' : ''}`}
                >
                  <span className={`text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full ${isToday ? 'bg-[#06C755] text-white' : dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-700'}`}>{day}</span>
                  <div className="mt-0.5 space-y-0.5">
                    {hasScheduled && dayData.scheduled.slice(0, 2).map(s => (
                      <div key={s.id} className="text-[10px] px-1 py-0.5 rounded bg-purple-50 text-purple-600 truncate" title={s.title}>
                        {s.title}
                      </div>
                    ))}
                    {hasScheduled && dayData.scheduled.length > 2 && (
                      <div className="text-[10px] text-gray-400 px-1">+{dayData.scheduled.length - 2}件</div>
                    )}
                    {hasDelivery && (
                      <div className="text-[10px] px-1 py-0.5 rounded bg-green-50 text-green-600 truncate">
                        配信 {dayData.delivery_summary!.sent}件
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Week View */
          <div>
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-t-xl overflow-hidden">
              {weekCells.map((dk, i) => {
                const day = parseInt(dk.slice(8));
                const mon = parseInt(dk.slice(5, 7));
                const isToday = dk === todayStr;
                return (
                  <div key={dk} className={`py-3 text-center bg-gray-50 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-700'}`}>
                    <div className="text-xs font-medium">{WD[i]}</div>
                    <div className={`text-lg font-bold mt-0.5 inline-flex items-center justify-center w-9 h-9 rounded-full ${isToday ? 'bg-[#06C755] text-white' : ''}`}>
                      {day}
                    </div>
                    <div className="text-[10px] text-gray-400">{mon}月</div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-b-xl overflow-hidden">
              {weekCells.map((dk) => {
                const dayData = calendar[dk];
                const sel = selDate === dk;
                return (
                  <div
                    key={dk}
                    onClick={() => setSelDate(sel ? null : dk)}
                    className={`bg-white p-2 min-h-[160px] cursor-pointer hover:bg-gray-50 transition-colors ${sel ? 'ring-2 ring-[#06C755] ring-inset' : ''}`}
                  >
                    {dayData ? (
                      <div className="space-y-1.5">
                        {dayData.scheduled.map(s => (
                          <div key={s.id} className="text-xs px-2 py-1.5 rounded-lg bg-purple-50 border border-purple-100">
                            <div className="font-medium text-purple-700 truncate">{s.title}</div>
                            <div className="text-purple-500 mt-0.5">
                              {new Date(s.scheduled_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${SC[s.status] || ''}`}>{SL[s.status] || s.status}</span>
                            </div>
                          </div>
                        ))}
                        {dayData.delivery_summary && (
                          <div className="text-xs px-2 py-1.5 rounded-lg bg-green-50 border border-green-100">
                            <div className="font-medium text-green-700">配信ログ</div>
                            <div className="text-green-600 mt-0.5">
                              <span className="text-green-600">{dayData.delivery_summary.sent}送信</span>
                              {dayData.delivery_summary.failed > 0 && <span className="text-red-500 ml-1">{dayData.delivery_summary.failed}失敗</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-300 text-center mt-8">なし</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 justify-center">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-purple-100 border border-purple-200 rounded" /><span className="text-xs text-gray-500">予約配信</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-100 border border-green-200 rounded" /><span className="text-xs text-gray-500">配信実績</span></div>
        </div>
      </div>

      {/* Selected date detail */}
      {selDate && selDayData && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {new Date(selDate + 'T00:00:00').toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
          </h2>

          {/* Scheduled deliveries */}
          {selDayData.scheduled.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-purple-700 mb-2">予約配信 ({selDayData.scheduled.length}件)</h3>
              <div className="space-y-2">
                {selDayData.scheduled.map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-purple-50 rounded-lg px-4 py-3">
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{s.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(s.scheduled_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                        <span className="ml-2">{TL[s.target_type] || s.target_type}</span>
                        {(s.status === 'completed' || s.status === 'failed') && (
                          <span className="ml-2">送信 {s.sent_count} / 失敗 {s.failed_count}</span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SC[s.status] || 'bg-gray-100 text-gray-500'}`}>
                      {SL[s.status] || s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delivery log summary */}
          {selDayData.delivery_summary && (
            <div>
              <h3 className="text-sm font-medium text-green-700 mb-2">配信実績</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-900">{selDayData.delivery_summary.total}</div>
                  <div className="text-xs text-gray-500">総数</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-green-600">{selDayData.delivery_summary.sent}</div>
                  <div className="text-xs text-green-600">成功</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-red-600">{selDayData.delivery_summary.failed}</div>
                  <div className="text-xs text-red-600">失敗</div>
                </div>
              </div>
            </div>
          )}

          {!selDayData.scheduled.length && !selDayData.delivery_summary && (
            <p className="text-sm text-gray-400 text-center py-4">この日のデータはありません</p>
          )}
        </div>
      )}
    </div>
  );
}
