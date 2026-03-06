'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useAccount } from '@/lib/account';

interface Account {
  id: string;
  name: string;
  channel_id: string | null;
  is_default: number;
  is_active: number;
  has_credentials?: boolean;
  member_count?: number;
  members?: { user_id: string; role: string; display_name: string | null; picture_url: string | null }[];
  created_at: string;
  updated_at: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || '';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function AccountsPage() {
  const { t, locale } = useTranslation();
  const { refreshAccounts } = useAccount();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<Account | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({ name: '', channel_id: '', channel_secret: '', channel_access_token: '' });
  const [saving, setSaving] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/accounts`, { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json() as { data: Account[] };
        setAccounts(json.data || []);
      }
    } catch {}
  }, []);

  const fetchDetail = async (id: string) => {
    try {
      const res = await fetch(`${API}/api/accounts/${id}`, { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json() as { data: Account };
        setSelected(json.data);
      }
    } catch {}
  };

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/accounts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowCreate(false);
        setForm({ name: '', channel_id: '', channel_secret: '', channel_access_token: '' });
        fetchAccounts();
        refreshAccounts();
      }
    } catch {}
    setSaving(false);
  };

  const handleUpdate = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (form.name.trim()) body.name = form.name;
      if (form.channel_id) body.channel_id = form.channel_id;
      if (form.channel_secret) body.channel_secret = form.channel_secret;
      if (form.channel_access_token) body.channel_access_token = form.channel_access_token;

      const res = await fetch(`${API}/api/accounts/${selected.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowEdit(false);
        fetchAccounts();
        fetchDetail(selected.id);
        refreshAccounts();
      }
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(locale === 'ja' ? 'このアカウントを削除しますか？' : 'Delete this account?')) return;
    try {
      await fetch(`${API}/api/accounts/${id}`, { method: 'DELETE', headers: authHeaders() });
      setSelected(null);
      fetchAccounts();
      refreshAccounts();
    } catch {}
  };

  const ja = locale === 'ja';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{ja ? 'LINEアカウント管理' : 'LINE Account Management'}</h2>
          <p className="text-sm text-gray-500">{ja ? '複数のLINE公式アカウントを管理します' : 'Manage multiple LINE official accounts'}</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setForm({ name: '', channel_id: '', channel_secret: '', channel_access_token: '' }); }}
          className="px-4 py-2 bg-[#06C755] text-white rounded-lg text-sm font-medium hover:bg-[#05b34d] transition-colors"
        >
          {ja ? '+ アカウント追加' : '+ Add Account'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account List */}
        <div className="lg:col-span-1 space-y-3">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              onClick={() => fetchDetail(acc.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                selected?.id === acc.id ? 'border-[#06C755] bg-green-50' : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  acc.is_active ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <svg className={`w-5 h-5 ${acc.is_active ? 'text-green-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 5.82 2 10.5c0 2.95 1.95 5.55 4.87 7.03-.19.66-.68 2.46-.78 2.84-.13.5.18.49.38.36.16-.1 2.54-1.73 3.58-2.43.62.09 1.26.14 1.95.14 5.52 0 10-3.82 10-8.5S17.52 2 12 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{acc.name}</p>
                    {acc.is_default ? (
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded font-medium">
                        {ja ? 'デフォルト' : 'Default'}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500">
                    {acc.channel_id || (ja ? '未設定' : 'Not configured')}
                  </p>
                </div>
                <div className={`w-2 h-2 rounded-full ${acc.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
              </div>
            </div>
          ))}
          {accounts.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
              {ja ? 'アカウントがありません' : 'No accounts'}
            </div>
          )}
        </div>

        {/* Account Detail */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {selected ? (
            <div>
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">{selected.name}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowEdit(true);
                      setForm({
                        name: selected.name,
                        channel_id: selected.channel_id || '',
                        channel_secret: '',
                        channel_access_token: '',
                      });
                    }}
                    className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    {ja ? '編集' : 'Edit'}
                  </button>
                  {!selected.is_default && (
                    <button
                      onClick={() => handleDelete(selected.id)}
                      className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                    >
                      {ja ? '削除' : 'Delete'}
                    </button>
                  )}
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">ID</p>
                    <p className="text-sm font-mono text-gray-700">{selected.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Channel ID</p>
                    <p className="text-sm text-gray-700">{selected.channel_id || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{ja ? '認証情報' : 'Credentials'}</p>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      selected.has_credentials ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {selected.has_credentials ? (ja ? '設定済み' : 'Configured') : (ja ? '未設定' : 'Not set')}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{ja ? 'ステータス' : 'Status'}</p>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      selected.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {selected.is_active ? (ja ? '有効' : 'Active') : (ja ? '無効' : 'Inactive')}
                    </span>
                  </div>
                </div>

                {/* Members */}
                {selected.members && selected.members.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">{ja ? 'メンバー' : 'Members'} ({selected.members.length})</p>
                    <div className="space-y-2">
                      {selected.members.map((m) => (
                        <div key={m.user_id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                          {m.picture_url ? (
                            <img src={m.picture_url} className="w-8 h-8 rounded-full" alt="" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700 truncate">{m.display_name || m.user_id}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            m.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            m.role === 'operator' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {m.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-xs text-gray-400">
                  <div>{ja ? '作成日' : 'Created'}: {new Date(selected.created_at).toLocaleDateString('ja-JP')}</div>
                  <div>{ja ? '更新日' : 'Updated'}: {new Date(selected.updated_at).toLocaleDateString('ja-JP')}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-400 text-sm">
              {ja ? 'アカウントを選択してください' : 'Select an account to view details'}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">{ja ? '新規アカウント' : 'New Account'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">{ja ? 'アカウント名' : 'Account Name'} *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                  placeholder={ja ? '例: 店舗A公式アカウント' : 'e.g. Store A Official Account'}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Channel ID</label>
                <input
                  type="text"
                  value={form.channel_id}
                  onChange={e => setForm(f => ({ ...f, channel_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Channel Secret</label>
                <input
                  type="password"
                  value={form.channel_secret}
                  onChange={e => setForm(f => ({ ...f, channel_secret: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Channel Access Token</label>
                <input
                  type="password"
                  value={form.channel_access_token}
                  onChange={e => setForm(f => ({ ...f, channel_access_token: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                {ja ? 'キャンセル' : 'Cancel'}
              </button>
              <button onClick={handleCreate} disabled={saving || !form.name.trim()} className="px-4 py-2 text-sm bg-[#06C755] text-white rounded-lg hover:bg-[#05b34d] disabled:opacity-50">
                {saving ? (ja ? '作成中...' : 'Creating...') : (ja ? '作成' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEdit(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">{ja ? 'アカウント編集' : 'Edit Account'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">{ja ? 'アカウント名' : 'Account Name'}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Channel ID</label>
                <input
                  type="text"
                  value={form.channel_id}
                  onChange={e => setForm(f => ({ ...f, channel_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Channel Secret ({ja ? '変更時のみ入力' : 'Enter to change'})</label>
                <input
                  type="password"
                  value={form.channel_secret}
                  onChange={e => setForm(f => ({ ...f, channel_secret: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                  placeholder="***"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Channel Access Token ({ja ? '変更時のみ入力' : 'Enter to change'})</label>
                <input
                  type="password"
                  value={form.channel_access_token}
                  onChange={e => setForm(f => ({ ...f, channel_access_token: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                  placeholder="***"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowEdit(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                {ja ? 'キャンセル' : 'Cancel'}
              </button>
              <button onClick={handleUpdate} disabled={saving} className="px-4 py-2 text-sm bg-[#06C755] text-white rounded-lg hover:bg-[#05b34d] disabled:opacity-50">
                {saving ? (ja ? '保存中...' : 'Saving...') : (ja ? '保存' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
