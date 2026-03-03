'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

interface Goal {
  id: string;
  name: string;
  description: string | null;
  goal_type: string;
  goal_config: string | null;
  scenario_id: string | null;
  is_active: number;
  conversion_count: number;
  unique_users: number;
  created_at: string;
}

interface FunnelStep {
  stage: string;
  total: number;
  unique_users: number;
  rate: number;
  step_rate: number;
}

interface ScenarioCV {
  scenario_id: string | null;
  scenario_name: string;
  delivery_count: number;
  delivered_users: number;
  sent_count: number;
  cv_count: number;
  cv_users: number;
  cv_value: number;
  cv_rate: number;
}

interface DailyCV {
  date: string;
  count: number;
  unique_users: number;
  total_value: number;
}

interface Summary {
  current: { total: number; unique_users: number; total_value: number; cv_rate: number };
  previous: { total: number; unique_users: number; total_value: number; cv_rate: number };
  change: { total: number; unique_users: number; total_value: number };
  by_goal: Array<{ id: string; name: string; goal_type: string; cv_count: number; cv_users: number; cv_value: number }>;
}

const goalTypeLabels: Record<string, string> = {
  url_visit: 'URL訪問',
  purchase: '購入',
  form_submit: 'フォーム送信',
  custom: 'カスタム',
};

const goalTypeColors: Record<string, string> = {
  url_visit: 'bg-blue-100 text-blue-700',
  purchase: 'bg-green-100 text-green-700',
  form_submit: 'bg-purple-100 text-purple-700',
  custom: 'bg-gray-100 text-gray-700',
};

const periodPresets = [
  { label: '7日', days: 7 },
  { label: '30日', days: 30 },
  { label: '90日', days: 90 },
];

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default function ConversionsPage() {
  const [tab, setTab] = useState<'dashboard' | 'goals'>('dashboard');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioCV[]>([]);
  const [daily, setDaily] = useState<DailyCV[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');

  // Period
  const [periodDays, setPeriodDays] = useState(30);
  const dateTo = formatDate(new Date());
  const dateFrom = formatDate(new Date(Date.now() - periodDays * 86400000));

  // Goal form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState('url_visit');
  const [formConfig, setFormConfig] = useState('');
  const [saving, setSaving] = useState(false);

  const loadGoals = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${getApiUrl()}/api/conversions/goals`);
      const data = await res.json();
      if (data.success) setGoals(data.data);
    } catch {}
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = `from=${dateFrom}&to=${dateTo}${selectedGoalId ? `&goal_id=${selectedGoalId}` : ''}`;
      const [summaryRes, funnelRes, scenarioRes, dailyRes] = await Promise.all([
        fetchWithAuth(`${getApiUrl()}/api/conversions/summary?from=${dateFrom}&to=${dateTo}`),
        fetchWithAuth(`${getApiUrl()}/api/conversions/funnel?${params}`),
        fetchWithAuth(`${getApiUrl()}/api/conversions/by-scenario?from=${dateFrom}&to=${dateTo}`),
        fetchWithAuth(`${getApiUrl()}/api/conversions/daily?${params}`),
      ]);
      const [sData, fData, scData, dData] = await Promise.all([
        summaryRes.json(), funnelRes.json(), scenarioRes.json(), dailyRes.json(),
      ]);
      if (sData.success) setSummary(sData.data);
      if (fData.success) setFunnel(fData.data.funnel);
      if (scData.success) setScenarios(scData.data.scenarios);
      if (dData.success) setDaily(dData.data.daily);
    } catch {}
    setLoading(false);
  }, [dateFrom, dateTo, selectedGoalId]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleCreateGoal = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      let goalConfig = null;
      if (formConfig.trim()) {
        try { goalConfig = JSON.parse(formConfig); } catch { goalConfig = { value: formConfig }; }
      }
      const res = await fetchWithAuth(`${getApiUrl()}/api/conversions/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, description: formDesc || undefined, goal_type: formType, goal_config: goalConfig }),
      });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        setFormName(''); setFormDesc(''); setFormType('url_visit'); setFormConfig('');
        loadGoals();
      }
    } catch {}
    setSaving(false);
  };

  const handleDeleteGoal = async (id: string) => {
    if (!confirm('この目標を削除しますか？関連するコンバージョンデータも削除されます。')) return;
    try {
      await fetchWithAuth(`${getApiUrl()}/api/conversions/goals/${id}`, { method: 'DELETE' });
      loadGoals();
      loadDashboard();
    } catch {}
  };

  const handleToggleGoal = async (goal: Goal) => {
    try {
      await fetchWithAuth(`${getApiUrl()}/api/conversions/goals/${goal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: goal.is_active ? 0 : 1 }),
      });
      loadGoals();
    } catch {}
  };

  const maxFunnelUsers = funnel.length > 0 ? Math.max(...funnel.map(f => f.unique_users), 1) : 1;
  const maxDailyCount = daily.length > 0 ? Math.max(...daily.map(d => d.count), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Tab switch */}
      <div className="flex gap-2">
        <button onClick={() => setTab('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'dashboard' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
          ダッシュボード
        </button>
        <button onClick={() => setTab('goals')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'goals' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
          目標管理
        </button>
      </div>

      {tab === 'goals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">コンバージョン目標</h2>
            <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
              + 目標追加
            </button>
          </div>

          {showForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h3 className="font-medium text-gray-900">新規目標</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">目標名 *</label>
                  <input value={formName} onChange={e => setFormName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="例: 商品購入" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">目標タイプ *</label>
                  <select value={formType} onChange={e => setFormType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="url_visit">URL訪問</option>
                    <option value="purchase">購入</option>
                    <option value="form_submit">フォーム送信</option>
                    <option value="custom">カスタム</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                <input value={formDesc} onChange={e => setFormDesc(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="目標の詳細説明" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">設定 (JSON or テキスト)</label>
                <input value={formConfig} onChange={e => setFormConfig(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder='例: {"url_pattern": "/purchase/complete"}' />
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateGoal} disabled={saving || !formName.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? '保存中...' : '作成'}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">キャンセル</button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {goals.length === 0 ? (
              <div className="p-8 text-center text-gray-500">目標がまだありません</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">目標名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">タイプ</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CV数</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ユニークユーザー</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">状態</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {goals.map(g => (
                    <tr key={g.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 text-sm">{g.name}</div>
                        {g.description && <div className="text-xs text-gray-500">{g.description}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${goalTypeColors[g.goal_type] || 'bg-gray-100 text-gray-700'}`}>
                          {goalTypeLabels[g.goal_type] || g.goal_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{g.conversion_count}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">{g.unique_users}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleToggleGoal(g)} className={`px-2 py-0.5 rounded text-xs font-medium ${g.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {g.is_active ? '有効' : '無効'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleDeleteGoal(g.id)} className="text-red-500 hover:text-red-700 text-xs">削除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'dashboard' && (
        <div className="space-y-6">
          {/* Period selector + Goal filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
              {periodPresets.map(p => (
                <button key={p.days} onClick={() => setPeriodDays(p.days)} className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${periodDays === p.days ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <select value={selectedGoalId} onChange={e => setSelectedGoalId(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">全目標</option>
              {goals.filter(g => g.is_active).map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <span className="text-xs text-gray-500">{dateFrom} ~ {dateTo}</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : (
            <>
              {/* Summary cards */}
              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SummaryCard label="コンバージョン数" value={summary.current.total} change={summary.change.total} />
                  <SummaryCard label="ユニークCV" value={summary.current.unique_users} change={summary.change.unique_users} />
                  <SummaryCard label="CV率" value={`${summary.current.cv_rate}%`} change={Math.round((summary.current.cv_rate - summary.previous.cv_rate) * 10) / 10} suffix="%" />
                  <SummaryCard label="CV金額" value={`¥${summary.current.total_value.toLocaleString()}`} change={summary.change.total_value} prefix="¥" />
                </div>
              )}

              {/* Funnel */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">コンバージョンファネル</h3>
                {funnel.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">データなし</p>
                ) : (
                  <div className="space-y-3">
                    {funnel.map((step, i) => (
                      <div key={step.stage} className="flex items-center gap-4">
                        <div className="w-28 text-sm font-medium text-gray-700 shrink-0">{step.stage}</div>
                        <div className="flex-1 relative">
                          <div className="h-10 bg-gray-100 rounded-lg overflow-hidden">
                            <div
                              className="h-full rounded-lg transition-all duration-500"
                              style={{
                                width: `${(step.unique_users / maxFunnelUsers) * 100}%`,
                                backgroundColor: ['#6366f1', '#8b5cf6', '#a78bfa', '#10b981'][i] || '#6366f1',
                              }}
                            />
                          </div>
                        </div>
                        <div className="w-24 text-right shrink-0">
                          <div className="text-sm font-bold text-gray-900">{step.unique_users}</div>
                          <div className="text-xs text-gray-500">{step.rate}%</div>
                        </div>
                        {i > 0 && (
                          <div className="w-16 text-right shrink-0">
                            <span className="text-xs text-gray-400">{step.step_rate}%</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Daily chart */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">日別コンバージョン推移</h3>
                {daily.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">データなし</p>
                ) : (
                  <div className="h-48 flex items-end gap-1">
                    {daily.map(d => (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.count}件`}>
                        <span className="text-[10px] text-gray-500">{d.count}</span>
                        <div
                          className="w-full bg-indigo-500 rounded-t min-h-[2px] transition-all"
                          style={{ height: `${(d.count / maxDailyCount) * 140}px` }}
                        />
                        <span className="text-[9px] text-gray-400 -rotate-45 origin-top-left whitespace-nowrap">{d.date.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* By-goal breakdown */}
              {summary && summary.by_goal.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">目標別コンバージョン</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {summary.by_goal.map(g => (
                      <div key={g.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${goalTypeColors[g.goal_type] || 'bg-gray-100 text-gray-700'}`}>
                            {goalTypeLabels[g.goal_type] || g.goal_type}
                          </span>
                          <span className="text-sm font-medium text-gray-900 truncate">{g.name}</span>
                        </div>
                        <div className="flex items-baseline gap-4">
                          <div>
                            <div className="text-2xl font-bold text-indigo-600">{g.cv_count}</div>
                            <div className="text-xs text-gray-500">CV数</div>
                          </div>
                          <div>
                            <div className="text-lg font-semibold text-gray-700">{g.cv_users}</div>
                            <div className="text-xs text-gray-500">ユーザー</div>
                          </div>
                          {g.cv_value > 0 && (
                            <div>
                              <div className="text-lg font-semibold text-green-600">¥{g.cv_value.toLocaleString()}</div>
                              <div className="text-xs text-gray-500">金額</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scenario CV table */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">シナリオ別コンバージョン率</h3>
                {scenarios.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">データなし</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">シナリオ</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">配信数</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">送信成功</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">CV数</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">CV率</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">CV金額</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {scenarios.map((s, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">{s.scenario_name}</td>
                            <td className="px-4 py-2 text-sm text-right text-gray-600">{s.delivery_count}</td>
                            <td className="px-4 py-2 text-sm text-right text-gray-600">{s.sent_count}</td>
                            <td className="px-4 py-2 text-sm text-right font-medium text-indigo-600">{s.cv_count}</td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(s.cv_rate, 100)}%` }} />
                                </div>
                                <span className="text-sm font-medium text-gray-900">{s.cv_rate}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-sm text-right text-green-600">¥{s.cv_value.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, change, prefix, suffix }: { label: string; value: string | number; change: number; prefix?: string; suffix?: string }) {
  const isPositive = change > 0;
  const isZero = change === 0;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className={`text-xs mt-1 ${isZero ? 'text-gray-400' : isPositive ? 'text-green-600' : 'text-red-500'}`}>
        {isZero ? '±0' : isPositive ? `+${prefix || ''}${change}${suffix || ''}` : `${prefix || ''}${change}${suffix || ''}`}
        <span className="text-gray-400 ml-1">前期比</span>
      </div>
    </div>
  );
}
