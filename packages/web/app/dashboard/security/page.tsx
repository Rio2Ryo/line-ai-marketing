'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';

interface AuditLog {
  id: string;
  event_type: string;
  source_ip: string | null;
  endpoint: string;
  user_agent: string | null;
  details: string | null;
  severity: string;
  created_at: string;
}

interface IpRule {
  id: string;
  ip_pattern: string;
  rule_type: string;
  scope: string;
  description: string | null;
  is_active: number;
  created_at: string;
}

interface AuditStats {
  total: number;
  by_type: { event_type: string; count: number }[];
  by_severity: { severity: string; count: number }[];
  top_ips: { source_ip: string; count: number }[];
}

const API = process.env.NEXT_PUBLIC_API_URL || '';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  webhook_signature_ok: { label: 'Signature OK', color: 'bg-green-100 text-green-700' },
  webhook_signature_fail: { label: 'Signature Fail', color: 'bg-red-100 text-red-700' },
  webhook_missing_signature: { label: 'No Signature', color: 'bg-yellow-100 text-yellow-700' },
  ip_blocked: { label: 'IP Blocked', color: 'bg-red-100 text-red-700' },
  ip_allowed: { label: 'IP Allowed', color: 'bg-green-100 text-green-700' },
  auth_fail: { label: 'Auth Fail', color: 'bg-orange-100 text-orange-700' },
  auth_success: { label: 'Auth OK', color: 'bg-green-100 text-green-700' },
};

const SEVERITY_COLORS: Record<string, string> = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-yellow-100 text-yellow-700',
  critical: 'bg-red-100 text-red-700',
};

export default function SecurityPage() {
  const { locale } = useTranslation();
  const ja = locale === 'ja';
  const [tab, setTab] = useState<'logs' | 'rules'>('logs');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [rules, setRules] = useState<IpRule[]>([]);
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [hours, setHours] = useState(24);
  const [showAddRule, setShowAddRule] = useState(false);
  const [ruleForm, setRuleForm] = useState({ ip_pattern: '', rule_type: 'block', scope: 'webhook', description: '' });

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ hours: String(hours), limit: '200' });
      if (filterType) params.set('type', filterType);
      if (filterSeverity) params.set('severity', filterSeverity);
      const res = await fetch(`${API}/api/security/audit-logs?${params}`, { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json() as { data: AuditLog[] };
        setLogs(json.data || []);
      }
    } catch {}
  }, [hours, filterType, filterSeverity]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/security/audit-stats?hours=${hours}`, { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json() as { data: AuditStats };
        setStats(json.data || null);
      }
    } catch {}
  }, [hours]);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/security/ip-rules`, { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json() as { data: IpRule[] };
        setRules(json.data || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (tab === 'logs') { fetchLogs(); fetchStats(); }
    else fetchRules();
  }, [tab, fetchLogs, fetchStats, fetchRules]);

  const addRule = async () => {
    if (!ruleForm.ip_pattern.trim()) return;
    try {
      const res = await fetch(`${API}/api/security/ip-rules`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify(ruleForm),
      });
      if (res.ok) {
        setShowAddRule(false);
        setRuleForm({ ip_pattern: '', rule_type: 'block', scope: 'webhook', description: '' });
        fetchRules();
      }
    } catch {}
  };

  const toggleRule = async (id: string, active: boolean) => {
    try {
      await fetch(`${API}/api/security/ip-rules/${id}`, {
        method: 'PUT', headers: authHeaders(),
        body: JSON.stringify({ is_active: !active }),
      });
      fetchRules();
    } catch {}
  };

  const deleteRule = async (id: string) => {
    if (!confirm(ja ? 'このルールを削除しますか？' : 'Delete this rule?')) return;
    try {
      await fetch(`${API}/api/security/ip-rules/${id}`, { method: 'DELETE', headers: authHeaders() });
      fetchRules();
    } catch {}
  };

  const formatTime = (iso: string) => new Date(iso + 'Z').toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button onClick={() => setTab('logs')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'logs' ? 'border-[#06C755] text-[#06C755]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          {ja ? '監査ログ' : 'Audit Logs'}
        </button>
        <button onClick={() => setTab('rules')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'rules' ? 'border-[#06C755] text-[#06C755]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          {ja ? 'IPルール' : 'IP Rules'}
        </button>
      </div>

      {tab === 'logs' && (
        <>
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-500">{ja ? '総イベント' : 'Total Events'}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-500">{ja ? '署名成功' : 'Signature OK'}</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.by_type.find(t => t.event_type === 'webhook_signature_ok')?.count || 0}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-500">{ja ? '署名失敗' : 'Signature Fail'}</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.by_type.find(t => t.event_type === 'webhook_signature_fail')?.count || 0}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-500">{ja ? 'IPブロック' : 'IP Blocked'}</p>
                <p className="text-2xl font-bold text-orange-600">
                  {stats.by_type.find(t => t.event_type === 'ip_blocked')?.count || 0}
                </p>
              </div>
            </div>
          )}

          {/* Top IPs */}
          {stats && stats.top_ips.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">{ja ? 'アクセス元IP (Top 10)' : 'Top Source IPs'}</h3>
              <div className="flex flex-wrap gap-2">
                {stats.top_ips.slice(0, 10).map((ip) => (
                  <span key={ip.source_ip} className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                    {ip.source_ip} <span className="text-gray-500">({ip.count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
              <option value="">{ja ? '全タイプ' : 'All Types'}</option>
              <option value="webhook_signature_ok">Signature OK</option>
              <option value="webhook_signature_fail">Signature Fail</option>
              <option value="webhook_missing_signature">Missing Signature</option>
              <option value="ip_blocked">IP Blocked</option>
            </select>
            <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
              <option value="">{ja ? '全レベル' : 'All Severity'}</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <select value={hours} onChange={e => setHours(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm">
              <option value={1}>1h</option>
              <option value={6}>6h</option>
              <option value={24}>24h</option>
              <option value={72}>3d</option>
              <option value={168}>7d</option>
            </select>
          </div>

          {/* Log Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{ja ? '時刻' : 'Time'}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{ja ? 'イベント' : 'Event'}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{ja ? '重要度' : 'Severity'}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">IP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{ja ? '詳細' : 'Details'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">{ja ? 'ログなし' : 'No logs'}</td></tr>
                  ) : logs.map(log => {
                    const evt = EVENT_LABELS[log.event_type] || { label: log.event_type, color: 'bg-gray-100 text-gray-700' };
                    return (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{formatTime(log.created_at)}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${evt.color}`}>{evt.label}</span>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${SEVERITY_COLORS[log.severity] || 'bg-gray-100'}`}>{log.severity}</span>
                        </td>
                        <td className="px-4 py-2 text-xs font-mono text-gray-700">{log.source_ip || '-'}</td>
                        <td className="px-4 py-2 text-xs text-gray-500 max-w-xs truncate">
                          {log.details ? (() => { try { const d = JSON.parse(log.details); return Object.entries(d).map(([k,v]) => `${k}=${v}`).join(', '); } catch { return log.details; } })() : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'rules' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {ja ? 'Webhook/APIエンドポイントへのIPアクセスルールを管理します' : 'Manage IP access rules for webhook/API endpoints'}
            </p>
            <button onClick={() => setShowAddRule(true)} className="px-4 py-2 bg-[#06C755] text-white rounded-lg text-sm font-medium hover:bg-[#05b34d]">
              {ja ? '+ ルール追加' : '+ Add Rule'}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">IP Pattern</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{ja ? 'タイプ' : 'Type'}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{ja ? 'スコープ' : 'Scope'}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{ja ? '説明' : 'Description'}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{ja ? '状態' : 'Status'}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{ja ? '操作' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    {ja ? 'IPルールなし (全アクセス許可)' : 'No IP rules (all access allowed)'}
                  </td></tr>
                ) : rules.map(rule => (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">{rule.ip_pattern}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${rule.rule_type === 'allow' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {rule.rule_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{rule.scope}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{rule.description || '-'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleRule(rule.id, !!rule.is_active)} className={`px-2 py-0.5 rounded text-xs ${rule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {rule.is_active ? (ja ? '有効' : 'Active') : (ja ? '無効' : 'Inactive')}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => deleteRule(rule.id)} className="text-xs text-red-500 hover:text-red-700">
                        {ja ? '削除' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* LINE IP ranges info */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <h4 className="text-sm font-medium text-blue-800 mb-2">LINE Platform IP Ranges</h4>
            <p className="text-xs text-blue-600 mb-2">
              {ja ? 'LINE Webhookは以下のIPレンジから送信されます。allowルールに追加することを推奨します。' : 'LINE Webhooks are sent from these IP ranges. Consider adding them as allow rules.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {['147.92.128.0/17', '106.152.0.0/16', '203.104.128.0/17'].map(ip => (
                <code key={ip} className="px-2 py-1 bg-blue-100 rounded text-xs font-mono text-blue-800">{ip}</code>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Add Rule Modal */}
      {showAddRule && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddRule(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">{ja ? 'IPルール追加' : 'Add IP Rule'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">IP Pattern *</label>
                <input type="text" value={ruleForm.ip_pattern} onChange={e => setRuleForm(f => ({...f, ip_pattern: e.target.value}))}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-mono" placeholder="147.92.128.0/17" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">{ja ? 'タイプ' : 'Type'}</label>
                  <select value={ruleForm.rule_type} onChange={e => setRuleForm(f => ({...f, rule_type: e.target.value}))}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                    <option value="allow">Allow</option>
                    <option value="block">Block</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">{ja ? 'スコープ' : 'Scope'}</label>
                  <select value={ruleForm.scope} onChange={e => setRuleForm(f => ({...f, scope: e.target.value}))}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                    <option value="webhook">Webhook</option>
                    <option value="api">API</option>
                    <option value="all">All</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">{ja ? '説明' : 'Description'}</label>
                <input type="text" value={ruleForm.description} onChange={e => setRuleForm(f => ({...f, description: e.target.value}))}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder={ja ? 'LINE Platform IP' : 'LINE Platform IP'} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddRule(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{ja ? 'キャンセル' : 'Cancel'}</button>
              <button onClick={addRule} disabled={!ruleForm.ip_pattern.trim()} className="px-4 py-2 text-sm bg-[#06C755] text-white rounded-lg hover:bg-[#05b34d] disabled:opacity-50">{ja ? '追加' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
