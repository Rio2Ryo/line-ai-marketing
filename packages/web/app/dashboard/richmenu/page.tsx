'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

// ─── Types ───

interface RichMenuSize { width: number; height: number; }
interface RichMenuBounds { x: number; y: number; width: number; height: number; }
interface RichMenuAction { type: 'message' | 'uri' | 'postback'; label: string; text?: string; uri?: string; data?: string; }
interface RichMenuArea { bounds: RichMenuBounds; action: RichMenuAction; }
interface RichMenu { richMenuId: string; name: string; chatBarText: string; size: RichMenuSize; areas: RichMenuArea[]; selected: boolean; }
type TemplateType = '2col' | '3col';
interface AreaFormData { type: 'message' | 'uri' | 'postback'; label: string; value: string; }

interface ConditionV2 {
  type: 'tag' | 'attribute' | 'status' | 'last_message_days' | 'engagement_score' | 'conversion' | 'follow_source';
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'exists' | 'not_exists';
  field: string;
  value: string;
}
interface ConditionGroupV2 { logic: 'AND' | 'OR'; negate?: boolean; items: (ConditionV2 | ConditionGroupV2)[]; }

interface RichMenuRule {
  id: string;
  name: string;
  rich_menu_id: string;
  priority: number;
  condition_group: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

type Tab = 'menus' | 'rules';

const CONDITION_TYPES = [
  { value: 'tag', label: 'タグ' },
  { value: 'attribute', label: '属性' },
  { value: 'status', label: 'ステータス' },
  { value: 'last_message_days', label: '最終メッセージ(日数)' },
  { value: 'engagement_score', label: 'エンゲージメントスコア' },
  { value: 'conversion', label: 'コンバージョン' },
  { value: 'follow_source', label: '友だち追加経路' },
];

const OPERATORS = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
  { value: 'contains', label: '含む' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'gte', label: '≧' },
  { value: 'lte', label: '≦' },
  { value: 'exists', label: '存在する' },
  { value: 'not_exists', label: '存在しない' },
];

export default function RichMenuPage() {
  const [tab, setTab] = useState<Tab>('menus');

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setTab('menus')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'menus'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          リッチメニュー管理
        </button>
        <button
          onClick={() => setTab('rules')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'rules'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          動的切替ルール
        </button>
      </div>

      {tab === 'menus' ? <MenusTab /> : <RulesTab />}
    </div>
  );
}

// ═══════════════════════════════════════════
// Menus Tab (existing functionality)
// ═══════════════════════════════════════════

function MenusTab() {
  const [menus, setMenus] = useState<RichMenu[]>([]);
  const [defaultMenuId, setDefaultMenuId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formChatBarText, setFormChatBarText] = useState('');
  const [template, setTemplate] = useState<TemplateType>('2col');
  const [areaForms, setAreaForms] = useState<AreaFormData[]>([
    { type: 'message', label: '', value: '' },
    { type: 'message', label: '', value: '' },
  ]);

  const fetchMenus = useCallback(async () => {
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/richmenu');
      if (res.ok) {
        const data = await res.json();
        setMenus(Array.isArray(data) ? data : data.richmenus || []);
      }
    } catch (err) { console.error('Failed to fetch rich menus:', err); }
  }, []);

  const fetchDefault = useCallback(async () => {
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/richmenu/default');
      if (res.ok) {
        const data = await res.json();
        setDefaultMenuId(data.richMenuId || '');
      }
    } catch (err) { console.error('Failed to fetch default rich menu:', err); }
  }, []);

  useEffect(() => {
    const load = async () => { setLoading(true); await Promise.all([fetchMenus(), fetchDefault()]); setLoading(false); };
    load();
  }, [fetchMenus, fetchDefault]);

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/richmenu/' + id + '/default', { method: 'POST' });
      if (res.ok) setDefaultMenuId(id);
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('このリッチメニューを削除しますか？')) return;
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/richmenu/' + id, { method: 'DELETE' });
      if (res.ok) {
        setMenus(prev => prev.filter(m => m.richMenuId !== id));
        if (defaultMenuId === id) setDefaultMenuId('');
      }
    } catch (err) { console.error(err); }
  };

  const resetForm = () => {
    setFormName('');
    setFormChatBarText('');
    setTemplate('2col');
    setAreaForms([{ type: 'message', label: '', value: '' }, { type: 'message', label: '', value: '' }]);
  };

  const handleTemplateChange = (t: TemplateType) => {
    setTemplate(t);
    const count = t === '2col' ? 2 : 3;
    const arr: AreaFormData[] = [];
    for (let i = 0; i < count; i++) arr.push(areaForms[i] || { type: 'message', label: '', value: '' });
    setAreaForms(arr);
  };

  const updateAreaForm = (i: number, field: keyof AreaFormData, val: string) => {
    setAreaForms(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: val }; return n; });
  };

  const buildAreas = (): RichMenuArea[] => {
    const count = template === '2col' ? 2 : 3;
    const w = Math.floor(2500 / count);
    return areaForms.slice(0, count).map((f, i) => {
      const action: RichMenuAction = { type: f.type, label: f.label };
      if (f.type === 'message') action.text = f.value;
      else if (f.type === 'uri') action.uri = f.value;
      else if (f.type === 'postback') action.data = f.value;
      return { bounds: { x: w * i, y: 0, width: w, height: 1686 }, action };
    });
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formChatBarText.trim()) return;
    setCreating(true);
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/richmenu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size: { width: 2500, height: 1686 }, selected: true, name: formName, chatBarText: formChatBarText, areas: buildAreas() }),
      });
      if (res.ok) { setShowCreateModal(false); resetForm(); fetchMenus(); }
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const getActionPlaceholder = (t: string) => t === 'message' ? '送信するテキスト' : t === 'uri' ? 'https://example.com' : 'action=buy&itemid=123';
  const getActionValueLabel = (t: string) => t === 'message' ? 'テキスト' : t === 'uri' ? 'URI' : 'データ';

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1].map(i => (
          <div key={i} className="animate-pulse bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
            <div className="flex gap-2"><div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24" /></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{menus.length}件のリッチメニュー</p>
        <button onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity">
          新規作成
        </button>
      </div>

      {menus.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2zm0 8a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">リッチメニューがありません。「新規作成」からリッチメニューを追加しましょう。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {menus.map(menu => (
            <div key={menu.richMenuId} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-gray-900 dark:text-gray-100">{menu.name}</h3>
                {defaultMenuId === menu.richMenuId && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">デフォルト</span>
                )}
              </div>
              <div className="space-y-1 mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400"><span className="text-gray-700 dark:text-gray-300 font-medium">メニューバー:</span> {menu.chatBarText}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400"><span className="text-gray-700 dark:text-gray-300 font-medium">サイズ:</span> {menu.size.width} x {menu.size.height}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400"><span className="text-gray-700 dark:text-gray-300 font-medium">エリア:</span> {menu.areas.length}エリア</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-1">{menu.richMenuId}</p>
              </div>
              <div className="flex items-center gap-2">
                {defaultMenuId !== menu.richMenuId && (
                  <button onClick={() => handleSetDefault(menu.richMenuId)}
                    className="text-sm px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium">
                    デフォルトに設定
                  </button>
                )}
                <button onClick={() => handleDelete(menu.richMenuId)}
                  className="text-sm text-red-500 hover:text-red-700 font-medium px-3 py-1.5">
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">リッチメニュー新規作成</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">メニュー名 <span className="text-red-500">*</span></label>
                  <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="例: メインメニュー" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">メニューバーテキスト <span className="text-red-500">*</span></label>
                  <input type="text" value={formChatBarText} onChange={e => setFormChatBarText(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="例: メニューを開く" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">テンプレート</label>
                  <div className="flex gap-2">
                    {(['2col', '3col'] as TemplateType[]).map(t => (
                      <button key={t} type="button" onClick={() => handleTemplateChange(t)}
                        className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-colors ${template === t ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                        <div className="flex gap-1 justify-center mb-1">
                          {Array.from({ length: t === '2col' ? 2 : 3 }).map((_, i) => (
                            <div key={i} className={`${t === '2col' ? 'w-8' : 'w-5'} h-6 rounded ${template === t ? 'bg-[var(--accent)]/30' : 'bg-gray-200 dark:bg-gray-600'}`} />
                          ))}
                        </div>
                        <span className="text-sm">{t === '2col' ? '2列' : '3列'}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">エリア設定</label>
                  <div className="space-y-4">
                    {areaForms.map((area, index) => (
                      <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 space-y-3">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">エリア {index + 1}</p>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">アクションタイプ</label>
                          <select value={area.type} onChange={e => updateAreaForm(index, 'type', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[var(--accent)] bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100">
                            <option value="message">メッセージ</option>
                            <option value="uri">URI</option>
                            <option value="postback">ポストバック</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">ラベル</label>
                          <input type="text" value={area.label} onChange={e => updateAreaForm(index, 'label', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[var(--accent)] bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                            placeholder="例: お問い合わせ" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{getActionValueLabel(area.type)}</label>
                          <input type="text" value={area.value} onChange={e => updateAreaForm(index, 'value', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[var(--accent)] bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                            placeholder={getActionPlaceholder(area.type)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium">
                  キャンセル
                </button>
                <button onClick={handleCreate} disabled={creating || !formName.trim() || !formChatBarText.trim()}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 font-medium disabled:opacity-50">
                  {creating ? '作成中...' : '作成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════
// Rules Tab
// ═══════════════════════════════════════════

function RulesTab() {
  const [rules, setRules] = useState<RichMenuRule[]>([]);
  const [menus, setMenus] = useState<RichMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<RichMenuRule | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formMenuId, setFormMenuId] = useState('');
  const [formPriority, setFormPriority] = useState(0);
  const [formConditions, setFormConditions] = useState<ConditionV2[]>([
    { type: 'tag', operator: 'eq', field: '', value: '' },
  ]);
  const [formLogic, setFormLogic] = useState<'AND' | 'OR'>('AND');
  const [saving, setSaving] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/richmenu-rules');
      if (res.ok) {
        const data = await res.json();
        setRules(data.data || []);
      }
    } catch (err) { console.error(err); }
  }, []);

  const fetchMenus = useCallback(async () => {
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/richmenu');
      if (res.ok) {
        const data = await res.json();
        setMenus(Array.isArray(data) ? data : data.richmenus || []);
      }
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    const load = async () => { setLoading(true); await Promise.all([fetchRules(), fetchMenus()]); setLoading(false); };
    load();
  }, [fetchRules, fetchMenus]);

  const buildConditionGroup = (): ConditionGroupV2 => ({
    logic: formLogic,
    items: formConditions.filter(c => c.value || c.operator === 'exists' || c.operator === 'not_exists'),
  });

  const handlePreview = async () => {
    setPreviewing(true);
    setPreviewCount(null);
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/richmenu-rules/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condition_group: buildConditionGroup() }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewCount(data.data?.count ?? 0);
      }
    } catch (err) { console.error(err); }
    finally { setPreviewing(false); }
  };

  const resetForm = () => {
    setFormName('');
    setFormMenuId('');
    setFormPriority(0);
    setFormConditions([{ type: 'tag', operator: 'eq', field: '', value: '' }]);
    setFormLogic('AND');
    setEditingRule(null);
    setPreviewCount(null);
  };

  const openCreate = () => { resetForm(); setShowModal(true); };

  const openEdit = (rule: RichMenuRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormMenuId(rule.rich_menu_id);
    setFormPriority(rule.priority);
    try {
      const cg: ConditionGroupV2 = JSON.parse(rule.condition_group);
      setFormLogic(cg.logic || 'AND');
      const conds = (cg.items || []).filter((i): i is ConditionV2 => 'type' in i);
      setFormConditions(conds.length > 0 ? conds : [{ type: 'tag', operator: 'eq', field: '', value: '' }]);
    } catch {
      setFormConditions([{ type: 'tag', operator: 'eq', field: '', value: '' }]);
      setFormLogic('AND');
    }
    setPreviewCount(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formMenuId.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: formName,
        rich_menu_id: formMenuId,
        priority: formPriority,
        condition_group: buildConditionGroup(),
      };
      const url = editingRule
        ? getApiUrl() + '/api/richmenu-rules/' + editingRule.id
        : getApiUrl() + '/api/richmenu-rules';
      const res = await fetchWithAuth(url, {
        method: editingRule ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) { setShowModal(false); resetForm(); fetchRules(); }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('このルールを削除しますか？')) return;
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/richmenu-rules/' + id, { method: 'DELETE' });
      if (res.ok) setRules(prev => prev.filter(r => r.id !== id));
    } catch (err) { console.error(err); }
  };

  const handleToggle = async (rule: RichMenuRule) => {
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/richmenu-rules/' + rule.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: rule.is_active ? 0 : 1 }),
      });
      if (res.ok) fetchRules();
    } catch (err) { console.error(err); }
  };

  const handleEvaluateAll = async () => {
    setEvaluating(true);
    setEvalResult(null);
    try {
      const res = await fetchWithAuth(getApiUrl() + '/api/richmenu-rules/evaluate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setEvalResult(data.data);
      }
    } catch (err) { console.error(err); }
    finally { setEvaluating(false); }
  };

  const addCondition = () => {
    setFormConditions(prev => [...prev, { type: 'tag', operator: 'eq', field: '', value: '' }]);
  };

  const removeCondition = (i: number) => {
    setFormConditions(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  };

  const updateCondition = (i: number, updates: Partial<ConditionV2>) => {
    setFormConditions(prev => { const n = [...prev]; n[i] = { ...n[i], ...updates }; return n; });
  };

  const getMenuName = (id: string) => menus.find(m => m.richMenuId === id)?.name || id.substring(0, 12) + '...';

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="animate-pulse bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            セグメント条件でユーザー毎にリッチメニューを自動切替。優先度の高いルールが優先適用されます。
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleEvaluateAll} disabled={evaluating || rules.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm">
            {evaluating ? '適用中...' : '全ルール適用'}
          </button>
          <button onClick={openCreate}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity text-sm">
            ルール追加
          </button>
        </div>
      </div>

      {/* Eval Result */}
      {evalResult && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">適用結果</h4>
          <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">合計 {evalResult.totalLinked} ユーザーにリッチメニューを適用</p>
          {evalResult.results?.map((r: any, i: number) => (
            <div key={i} className="text-xs text-blue-600 dark:text-blue-400">
              {r.rule_name}: マッチ {r.matched}人 / 適用 {r.linked}人 {r.failed > 0 && <span className="text-red-500">/ 失敗 {r.failed}人</span>}
            </div>
          ))}
          <button onClick={() => setEvalResult(null)} className="text-xs text-blue-500 hover:underline mt-2">閉じる</button>
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">動的切替ルールがありません。「ルール追加」から条件ベースのリッチメニュー切替を設定しましょう。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => {
            let condSummary = '';
            try {
              const cg: ConditionGroupV2 = JSON.parse(rule.condition_group);
              const items = (cg.items || []).filter((i): i is ConditionV2 => 'type' in i);
              condSummary = items.map(c => {
                const tl = CONDITION_TYPES.find(ct => ct.value === c.type)?.label || c.type;
                const ol = OPERATORS.find(o => o.value === c.operator)?.label || c.operator;
                return `${tl} ${ol} ${c.value || ''}`;
              }).join(` ${cg.logic} `);
            } catch { condSummary = '-'; }

            return (
              <div key={rule.id} className={`bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border transition-all ${rule.is_active ? 'border-gray-100 dark:border-gray-700' : 'border-gray-100 dark:border-gray-700 opacity-60'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 dark:text-gray-100">{rule.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        優先度: {rule.priority}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rule.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                        {rule.is_active ? '有効' : '無効'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      メニュー: <span className="font-medium text-gray-700 dark:text-gray-300">{getMenuName(rule.rich_menu_id)}</span>
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate">{condSummary}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleToggle(rule)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${rule.is_active ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200'}`}>
                      {rule.is_active ? '無効化' : '有効化'}
                    </button>
                    <button onClick={() => openEdit(rule)}
                      className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium">
                      編集
                    </button>
                    <button onClick={() => handleDelete(rule.id)}
                      className="text-xs px-3 py-1.5 text-red-500 hover:text-red-700 font-medium">
                      削除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rule Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                {editingRule ? 'ルール編集' : 'ルール新規作成'}
              </h2>

              <div className="space-y-5">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ルール名 <span className="text-red-500">*</span></label>
                  <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[var(--accent)] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="例: VIPユーザー用メニュー" />
                </div>

                {/* Rich Menu Select */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">適用リッチメニュー <span className="text-red-500">*</span></label>
                  {menus.length > 0 ? (
                    <select value={formMenuId} onChange={e => setFormMenuId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[var(--accent)] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                      <option value="">選択してください</option>
                      {menus.map(m => <option key={m.richMenuId} value={m.richMenuId}>{m.name}</option>)}
                    </select>
                  ) : (
                    <div>
                      <input type="text" value={formMenuId} onChange={e => setFormMenuId(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[var(--accent)] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        placeholder="Rich Menu ID を入力" />
                      <p className="text-xs text-gray-400 mt-1">リッチメニューが未作成の場合はIDを直接入力</p>
                    </div>
                  )}
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">優先度</label>
                  <input type="number" value={formPriority} onChange={e => setFormPriority(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[var(--accent)] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    min={0} max={100} />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">数値が大きいほど優先。同一ユーザーに複数ルールがマッチした場合、最高優先度のルールが適用されます。</p>
                </div>

                {/* Logic */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">条件の論理</label>
                  <div className="flex gap-2">
                    {(['AND', 'OR'] as const).map(l => (
                      <button key={l} type="button" onClick={() => setFormLogic(l)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${formLogic === l ? 'bg-[var(--accent)] text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                        {l === 'AND' ? 'すべて一致 (AND)' : 'いずれか一致 (OR)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conditions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">条件</label>
                  <div className="space-y-3">
                    {formConditions.map((cond, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                          <select value={cond.type} onChange={e => updateCondition(idx, { type: e.target.value as ConditionV2['type'] })}
                            className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                            {CONDITION_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                          </select>
                          <select value={cond.operator} onChange={e => updateCondition(idx, { operator: e.target.value as ConditionV2['operator'] })}
                            className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                            {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          {(cond.type === 'attribute' || cond.type === 'engagement_score' || cond.type === 'follow_source') && (
                            <input type="text" value={cond.field} onChange={e => updateCondition(idx, { field: e.target.value })}
                              className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              placeholder={cond.type === 'engagement_score' ? 'rank / score' : 'フィールド'} />
                          )}
                          <input type="text" value={cond.value} onChange={e => updateCondition(idx, { value: e.target.value })}
                            className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            placeholder="値" />
                        </div>
                        <button onClick={() => removeCondition(idx)} className="p-1 text-gray-400 hover:text-red-500 mt-1" title="削除">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={addCondition}
                    className="mt-2 text-sm text-[var(--accent)] hover:underline font-medium">
                    + 条件を追加
                  </button>
                </div>

                {/* Preview */}
                <div className="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <button onClick={handlePreview} disabled={previewing}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">
                    {previewing ? 'プレビュー中...' : 'マッチ数をプレビュー'}
                  </button>
                  {previewCount !== null && (
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {previewCount}人がマッチ
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium">
                  キャンセル
                </button>
                <button onClick={handleSave} disabled={saving || !formName.trim() || !formMenuId.trim()}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 font-medium disabled:opacity-50">
                  {saving ? '保存中...' : editingRule ? '更新' : '作成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
