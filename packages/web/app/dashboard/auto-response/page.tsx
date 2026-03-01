'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface Rule {
  id: string;
  name: string;
  trigger_type: 'keyword' | 'exact_match' | 'regex';
  trigger_pattern: string;
  response_type: 'text' | 'survey' | 'richmenu';
  response_content: string;
  priority: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface MatchResult {
  rule_id: string;
  name: string;
  response_type: string;
  response_content: string;
}

const TRIGGER_LABELS: Record<string, string> = { keyword: 'キーワード', exact_match: '完全一致', regex: '正規表現' };
const RESPONSE_LABELS: Record<string, string> = { text: 'テキスト', survey: 'アンケート', richmenu: 'リッチメニュー' };

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetchWithAuth(`${getApiUrl()}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts?.headers as Record<string, string>) } });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const json = await res.json();
  return (json as { data?: T }).data ?? (json as T);
}

export default function AutoResponsePage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formTriggerType, setFormTriggerType] = useState<Rule['trigger_type']>('keyword');
  const [formPattern, setFormPattern] = useState('');
  const [formResponseType, setFormResponseType] = useState<Rule['response_type']>('text');
  const [formContent, setFormContent] = useState('');
  const [formPriority, setFormPriority] = useState(0);
  const [formActive, setFormActive] = useState(true);

  // Test panel state
  const [testMsg, setTestMsg] = useState('');
  const [testMatches, setTestMatches] = useState<MatchResult[] | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    try { setLoading(true); setError(null); const d = await api<Rule[]>('/api/auto-response'); setRules(Array.isArray(d) ? d : []); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : '読み込みに失敗しました'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setFormName(''); setFormTriggerType('keyword'); setFormPattern(''); setFormResponseType('text'); setFormContent(''); setFormPriority(0); setFormActive(true); setEditingRule(null); };

  const openCreate = () => { resetForm(); setShowModal(true); };
  const openEdit = (r: Rule) => { setEditingRule(r); setFormName(r.name); setFormTriggerType(r.trigger_type); setFormPattern(r.trigger_pattern); setFormResponseType(r.response_type); setFormContent(r.response_content); setFormPriority(r.priority); setFormActive(r.is_active === 1); setShowModal(true); };

  const handleSave = async () => {
    if (!formName.trim() || !formPattern.trim() || !formContent.trim()) return;
    setSaving(true);
    try {
      const body = { name: formName, trigger_type: formTriggerType, trigger_pattern: formPattern, response_type: formResponseType, response_content: formContent, priority: formPriority, is_active: formActive ? 1 : 0 };
      if (editingRule) {
        await api(`/api/auto-response/${editingRule.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/api/auto-response', { method: 'POST', body: JSON.stringify(body) });
      }
      setShowModal(false); resetForm(); load();
    } catch { setError('保存に失敗しました'); } finally { setSaving(false); }
  };

  const handleToggle = async (r: Rule) => {
    try { await api(`/api/auto-response/${r.id}`, { method: 'PUT', body: JSON.stringify({ is_active: r.is_active ? 0 : 1 }) }); load(); }
    catch { setError('ステータスの変更に失敗しました'); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('このルールを削除しますか？')) return;
    try { await api(`/api/auto-response/${id}`, { method: 'DELETE' }); load(); }
    catch { setError('削除に失敗しました'); }
  };

  const handleTest = async () => {
    if (!testMsg.trim()) return;
    setTesting(true); setTestMatches(null);
    try { const d = await api<{ matches: MatchResult[] }>('/api/auto-response/test', { method: 'POST', body: JSON.stringify({ message: testMsg }) }); setTestMatches(d.matches); }
    catch { setError('テストに失敗しました'); } finally { setTesting(false); }
  };

  // Stats
  const totalRules = rules.length;
  const activeRules = rules.filter(r => r.is_active).length;
  const byTrigger = rules.reduce<Record<string, number>>((acc, r) => { acc[r.trigger_type] = (acc[r.trigger_type] || 0) + 1; return acc; }, {});

  if (loading && rules.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">自動応答ルール</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (<div key={i} className="animate-pulse bg-white rounded-2xl p-5 shadow-sm border border-gray-100"><div className="h-4 bg-gray-200 rounded w-1/2 mb-2" /><div className="h-6 bg-gray-200 rounded w-1/3" /></div>))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">自動応答ルール</h1>
        <button onClick={openCreate} className="px-4 py-2 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors">新規作成</button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4"><XIcon /></button>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="総ルール数" value={totalRules} />
        <StatCard label="有効ルール" value={activeRules} color="text-[#06C755]" />
        {Object.entries(byTrigger).map(([k, v]) => (<StatCard key={k} label={TRIGGER_LABELS[k] || k} value={v} />))}
      </div>

      {/* Test Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-sm font-bold text-gray-700 mb-3">メッセージテスト</h2>
        <div className="flex gap-3">
          <input type="text" value={testMsg} onChange={e => setTestMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleTest()} placeholder="テストメッセージを入力..." className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent" />
          <button onClick={handleTest} disabled={testing || !testMsg.trim()} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
            {testing ? 'テスト中...' : 'テスト実行'}
          </button>
        </div>
        {testMatches !== null && (
          <div className="mt-3">
            {testMatches.length === 0 ? (
              <p className="text-sm text-gray-500">マッチするルールがありません。</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">{testMatches.length}件のルールがマッチしました:</p>
                {testMatches.map(m => (
                  <div key={m.rule_id} className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                    <span className="text-sm font-bold text-green-800">{m.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">{RESPONSE_LABELS[m.response_type]}</span>
                    <span className="text-sm text-green-700 truncate flex-1">{m.response_content}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rule Table */}
      {rules.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-500">自動応答ルールがまだ作成されていません。新規作成ボタンからルールを追加しましょう。</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">ルール名</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">トリガー</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">パターン</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">応答タイプ</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">優先度</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">状態</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3"><TriggerBadge type={r.trigger_type} /></td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs max-w-[200px] truncate">{r.trigger_pattern}</td>
                    <td className="px-4 py-3"><ResponseBadge type={r.response_type} /></td>
                    <td className="px-4 py-3 text-center text-gray-700">{r.priority}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleToggle(r)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${r.is_active ? 'bg-[#06C755]' : 'bg-gray-300'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${r.is_active ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(r)} className="text-blue-600 hover:text-blue-800 font-medium mr-3">編集</button>
                      <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700 font-medium">削除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">{editingRule ? 'ルール編集' : 'ルール新規作成'}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ルール名 <span className="text-red-500">*</span></label>
                  <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent" placeholder="例: 営業時間の問い合わせ" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">トリガータイプ</label>
                    <select value={formTriggerType} onChange={e => setFormTriggerType(e.target.value as Rule['trigger_type'])} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent bg-white">
                      <option value="keyword">キーワード</option>
                      <option value="exact_match">完全一致</option>
                      <option value="regex">正規表現</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">応答タイプ</label>
                    <select value={formResponseType} onChange={e => setFormResponseType(e.target.value as Rule['response_type'])} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent bg-white">
                      <option value="text">テキスト</option>
                      <option value="survey">アンケート</option>
                      <option value="richmenu">リッチメニュー</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">トリガーパターン <span className="text-red-500">*</span></label>
                  <input type="text" value={formPattern} onChange={e => setFormPattern(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent" placeholder={formTriggerType === 'regex' ? '例: 営業時間|開店' : '例: 営業時間'} />
                  <p className="text-xs text-gray-400 mt-1">
                    {formTriggerType === 'keyword' && 'メッセージにこの文字列が含まれるとマッチします'}
                    {formTriggerType === 'exact_match' && 'メッセージがこの文字列と完全に一致するとマッチします'}
                    {formTriggerType === 'regex' && '正規表現パターンでマッチします'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formResponseType === 'text' ? '応答内容' : formResponseType === 'survey' ? 'アンケートID' : 'リッチメニューID'} <span className="text-red-500">*</span>
                  </label>
                  {formResponseType === 'text' ? (
                    <textarea rows={3} value={formContent} onChange={e => setFormContent(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent resize-y" placeholder="自動応答メッセージを入力..." />
                  ) : (
                    <input type="text" value={formContent} onChange={e => setFormContent(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent" placeholder={formResponseType === 'survey' ? 'アンケートIDを入力' : 'リッチメニューIDを入力'} />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">優先度</label>
                    <input type="number" value={formPriority} onChange={e => setFormPriority(parseInt(e.target.value) || 0)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent" />
                    <p className="text-xs text-gray-400 mt-1">数値が大きいほど優先されます</p>
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <button type="button" onClick={() => setFormActive(!formActive)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${formActive ? 'bg-[#06C755]' : 'bg-gray-300'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${formActive ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                      </button>
                      {formActive ? '有効' : '無効'}
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => { setShowModal(false); resetForm(); }} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium">キャンセル</button>
                <button onClick={handleSave} disabled={saving || !formName.trim() || !formPattern.trim() || !formContent.trim()} className="px-4 py-2 bg-[#06C755] text-white rounded-lg hover:bg-[#05b34c] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? '保存中...' : editingRule ? '更新' : '作成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function TriggerBadge({ type }: { type: string }) {
  const cls = type === 'keyword' ? 'bg-blue-100 text-blue-700' : type === 'exact_match' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700';
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{TRIGGER_LABELS[type] || type}</span>;
}

function ResponseBadge({ type }: { type: string }) {
  const cls = type === 'text' ? 'bg-gray-100 text-gray-700' : type === 'survey' ? 'bg-teal-100 text-teal-700' : 'bg-indigo-100 text-indigo-700';
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{RESPONSE_LABELS[type] || type}</span>;
}

function XIcon() {
  return (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
}
