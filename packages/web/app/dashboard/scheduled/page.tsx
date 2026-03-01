'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

const API = getApiUrl();

interface Delivery {
  id: string; title: string; message_type: string; message_content: string;
  target_type: 'all' | 'segment' | 'tag'; target_config: string | null;
  scheduled_at: string; status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  sent_count: number; failed_count: number; created_at: string; updated_at: string;
}
interface CalEntry { id: string; title: string; scheduled_at: string; status: string; }

const SL: Record<string, string> = { pending: '予約中', processing: '処理中', completed: '完了', failed: '失敗', cancelled: 'キャンセル' };
const SC: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-700', processing: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700', cancelled: 'bg-gray-100 text-gray-500' };
const TL: Record<string, string> = { all: '全員', segment: 'セグメント', tag: 'タグ' };
const WD = ['日', '月', '火', '水', '木', '金', '土'];

function localDt(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function monthKey(y: number, m: number) { return `${y}-${String(m+1).padStart(2, '0')}`; }

export default function ScheduledPage() {
  const [list, setList] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [pg, setPg] = useState(1);
  const [totalPg, setTotalPg] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [cY, setCY] = useState(new Date().getFullYear());
  const [cM, setCM] = useState(new Date().getMonth());
  const [cal, setCal] = useState<Record<string, CalEntry[]>>({});
  const [selDate, setSelDate] = useState<string | null>(null);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editTgt, setEditTgt] = useState<Delivery | null>(null);
  const [saving, setSaving] = useState(false);
  const [fTitle, setFTitle] = useState('');
  const [fContent, setFContent] = useState('');
  const [fTarget, setFTarget] = useState<'all' | 'segment' | 'tag'>('all');
  const [fConfig, setFConfig] = useState('');
  const [fAt, setFAt] = useState('');

  const load = useCallback(async (p: number) => {
    setLoading(true); setErr(null);
    try {
      const r = await fetchWithAuth(`${API}/api/scheduled?page=${p}&limit=20`);
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || 'データの取得に失敗しました');
      setList(j.data || []); setTotalPg(j.pagination?.totalPages || 1);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'データの取得に失敗しました'); }
    finally { setLoading(false); }
  }, []);

  const loadCal = useCallback(async (y: number, m: number) => {
    try {
      const r = await fetchWithAuth(`${API}/api/scheduled/calendar?month=${monthKey(y, m)}`);
      const j = await r.json();
      if (r.ok && j.success) setCal(j.data || {});
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(pg); }, [load, pg]);
  useEffect(() => { loadCal(cY, cM); }, [loadCal, cY, cM]);

  const reset = () => { setFTitle(''); setFContent(''); setFTarget('all'); setFConfig(''); setFAt(''); };
  const closeModal = () => { setModal(null); setEditTgt(null); reset(); };

  const buildBody = () => {
    const b: Record<string, unknown> = { title: fTitle, message_content: fContent, target_type: fTarget, scheduled_at: new Date(fAt).toISOString() };
    if (fTarget === 'tag' && fConfig.trim()) b.target_config = JSON.stringify({ tags: fConfig.split(',').map(t => t.trim()).filter(Boolean) });
    else if (fTarget === 'segment' && fConfig.trim()) b.target_config = fConfig;
    else b.target_config = '';
    return b;
  };

  const handleCreate = async () => {
    if (!fTitle.trim() || !fContent.trim() || !fAt) return;
    setSaving(true); setErr(null);
    try {
      const r = await fetchWithAuth(`${API}/api/scheduled`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildBody()) });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || '作成に失敗しました');
      closeModal(); setPg(1); load(1); loadCal(cY, cM);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : '作成に失敗しました'); }
    finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editTgt || !fTitle.trim() || !fContent.trim() || !fAt) return;
    setSaving(true); setErr(null);
    try {
      const r = await fetchWithAuth(`${API}/api/scheduled/${editTgt.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildBody()) });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || '更新に失敗しました');
      closeModal(); load(pg); loadCal(cY, cM);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : '更新に失敗しました'); }
    finally { setSaving(false); }
  };

  const handleDel = async (id: string) => {
    if (!window.confirm('この予約配信をキャンセルしますか？')) return;
    try {
      const r = await fetchWithAuth(`${API}/api/scheduled/${id}`, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || 'キャンセルに失敗しました');
      load(pg); loadCal(cY, cM);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'キャンセルに失敗しました'); }
  };

  const openEdit = (d: Delivery) => {
    setEditTgt(d); setFTitle(d.title); setFContent(d.message_content); setFTarget(d.target_type);
    if (d.target_config) {
      try { const c = JSON.parse(d.target_config); setFConfig(c.tags ? c.tags.join(', ') : d.target_config); }
      catch { setFConfig(d.target_config); }
    } else setFConfig('');
    setFAt(localDt(new Date(d.scheduled_at))); setModal('edit');
  };

  const prevM = () => { if (cM === 0) { setCY(y => y-1); setCM(11); } else setCM(m => m-1); setSelDate(null); };
  const nextM = () => { if (cM === 11) { setCY(y => y+1); setCM(0); } else setCM(m => m+1); setSelDate(null); };

  const fd = new Date(cY, cM, 1).getDay();
  const dim = new Date(cY, cM+1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < fd; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  const selEntries = selDate ? cal[selDate] || [] : [];
  const minDt = localDt(new Date());
  const inp = "w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent";

  const formJsx = (onSubmit: () => void, label: string) => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">タイトル <span className="text-red-500">*</span></label>
        <input type="text" value={fTitle} onChange={e => setFTitle(e.target.value)} className={inp} placeholder="例: 週末キャンペーン配信" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">メッセージ内容 <span className="text-red-500">*</span></label>
        <textarea rows={4} value={fContent} onChange={e => setFContent(e.target.value)} className={inp + " resize-y"} placeholder="配信するメッセージを入力してください" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">配信対象 <span className="text-red-500">*</span></label>
        <select value={fTarget} onChange={e => setFTarget(e.target.value as 'all'|'segment'|'tag')} className={inp + " bg-white"}>
          <option value="all">全員</option><option value="segment">セグメント</option><option value="tag">タグ</option>
        </select>
      </div>
      {fTarget === 'tag' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">タグ（カンマ区切り）</label>
          <input type="text" value={fConfig} onChange={e => setFConfig(e.target.value)} className={inp} placeholder="例: VIP, 新規顧客" />
        </div>
      )}
      {fTarget === 'segment' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">セグメント設定（JSON）</label>
          <input type="text" value={fConfig} onChange={e => setFConfig(e.target.value)} className={inp} placeholder='例: {"conditions":[...]}' />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">配信日時 <span className="text-red-500">*</span></label>
        <input type="datetime-local" value={fAt} onChange={e => setFAt(e.target.value)} min={minDt} className={inp} />
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={closeModal} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium">キャンセル</button>
        <button onClick={onSubmit} disabled={saving || !fTitle.trim() || !fContent.trim() || !fAt}
          className="px-4 py-2 bg-[#06C755] text-white rounded-lg hover:bg-[#05b34c] font-medium disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? '保存中...' : label}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">予約配信</h1>
        <button onClick={() => { reset(); setModal('create'); }} className="px-4 py-2 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors">新規作成</button>
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm">{err}</span>
          <button onClick={() => setErr(null)} className="text-red-400 hover:text-red-600 ml-4">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Calendar */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">カレンダー</h2>
          <div className="flex items-center gap-3">
            <button onClick={prevM} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-base font-medium text-gray-900 min-w-[120px] text-center">{cY}年{cM+1}月</span>
            <button onClick={nextM} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden">
          {WD.map((w, i) => (
            <div key={w} className={`py-2 text-center text-xs font-medium bg-gray-50 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>{w}</div>
          ))}
          {cells.map((day, idx) => {
            if (day === null) return <div key={`e-${idx}`} className="bg-white p-2 min-h-[72px]" />;
            const dk = `${cY}-${String(cM+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const ents = cal[dk] || [];
            const sel = selDate === dk;
            const dow = (fd + day - 1) % 7;
            const now = new Date();
            const today = cY === now.getFullYear() && cM === now.getMonth() && day === now.getDate();
            return (
              <div key={dk} onClick={() => setSelDate(sel ? null : dk)}
                className={`bg-white p-2 min-h-[72px] cursor-pointer hover:bg-gray-50 ${sel ? 'ring-2 ring-[#06C755] ring-inset' : ''}`}>
                <span className={`text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full ${today ? 'bg-[#06C755] text-white' : dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-700'}`}>{day}</span>
                {ents.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {ents.slice(0, 2).map(e => <div key={e.id} className="text-[10px] px-1 py-0.5 rounded bg-[#06C755]/10 text-[#06C755] truncate">{e.title}</div>)}
                    {ents.length > 2 && <div className="text-[10px] text-gray-400 px-1">+{ents.length - 2}件</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {selDate && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl">
            <h3 className="text-sm font-bold text-gray-900 mb-2">{selDate.replace(/-/g, '/')} の配信予定</h3>
            {selEntries.length === 0 ? <p className="text-sm text-gray-500">この日の予約配信はありません</p> : (
              <div className="space-y-2">
                {selEntries.map(e => (
                  <div key={e.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-200">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{e.title}</span>
                      <span className="text-xs text-gray-500 ml-2">{new Date(e.scheduled_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${SC[e.status] || 'bg-gray-100 text-gray-500'}`}>{SL[e.status] || e.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* List */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">配信一覧</h2>
        {loading ? (
          <div className="space-y-3">{[0,1,2].map(i => (
            <div key={i} className="animate-pulse flex gap-4 items-center">
              <div className="h-4 bg-gray-200 rounded w-1/4" /><div className="h-4 bg-gray-200 rounded w-1/6" />
              <div className="h-4 bg-gray-200 rounded w-1/6" /><div className="h-4 bg-gray-200 rounded w-16" />
            </div>
          ))}</div>
        ) : list.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500">予約配信はまだありません</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 text-left">
                  <th className="py-2 px-3 font-medium text-gray-500">タイトル</th>
                  <th className="py-2 px-3 font-medium text-gray-500">配信日時</th>
                  <th className="py-2 px-3 font-medium text-gray-500">対象</th>
                  <th className="py-2 px-3 font-medium text-gray-500">ステータス</th>
                  <th className="py-2 px-3 font-medium text-gray-500">送信数</th>
                  <th className="py-2 px-3 font-medium text-gray-500">操作</th>
                </tr></thead>
                <tbody>{list.map(d => (
                  <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-3">
                      <div className="font-medium text-gray-900 max-w-[200px] truncate">{d.title}</div>
                      <div className="text-xs text-gray-400 max-w-[200px] truncate mt-0.5">{d.message_content}</div>
                    </td>
                    <td className="py-3 px-3 text-gray-600 whitespace-nowrap">
                      {new Date(d.scheduled_at).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-3"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{TL[d.target_type] || d.target_type}</span></td>
                    <td className="py-3 px-3"><span className={`text-xs px-2 py-0.5 rounded-full ${SC[d.status] || 'bg-gray-100 text-gray-500'}`}>{SL[d.status] || d.status}</span></td>
                    <td className="py-3 px-3 text-gray-600">
                      {d.status === 'completed' || d.status === 'failed'
                        ? <span><span className="text-green-600">{d.sent_count}</span>{d.failed_count > 0 && <span className="text-red-500 ml-1">/ {d.failed_count}失敗</span>}</span>
                        : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        {d.status === 'pending' && (<>
                          <button onClick={() => openEdit(d)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">編集</button>
                          <button onClick={() => handleDel(d.id)} className="text-sm text-red-500 hover:text-red-700 font-medium">キャンセル</button>
                        </>)}
                        {d.status !== 'pending' && d.status !== 'processing' && (
                          <button onClick={() => handleDel(d.id)} className="text-sm text-gray-400 hover:text-gray-600 font-medium">削除</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {totalPg > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button onClick={() => setPg(p => Math.max(1, p-1))} disabled={pg <= 1} className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50">前へ</button>
                <span className="text-sm text-gray-500">{pg} / {totalPg}</span>
                <button onClick={() => setPg(p => Math.min(totalPg, p+1))} disabled={pg >= totalPg} className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50">次へ</button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Create Modal */}
      {modal === 'create' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">予約配信を作成</h2>
              {formJsx(handleCreate, '作成')}
            </div>
          </div>
        </div>
      )}
      {/* Edit Modal */}
      {modal === 'edit' && editTgt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">予約配信を編集</h2>
              {formJsx(handleEdit, '更新')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
