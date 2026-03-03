'use client';

import { useState, useEffect } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { useRole } from '@/lib/role';

interface UserWithRole {
  id: string;
  line_user_id: string;
  display_name: string | null;
  picture_url: string | null;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800',
  operator: 'bg-blue-100 text-blue-800',
  viewer: 'bg-gray-100 text-gray-600',
};

const ROLE_LABELS_JA: Record<string, string> = {
  admin: '\u7ba1\u7406\u8005',
  operator: '\u30aa\u30da\u30ec\u30fc\u30bf\u30fc',
  viewer: '\u95b2\u89a7\u8005',
};

const ROLE_LABELS_EN: Record<string, string> = {
  admin: 'Admin',
  operator: 'Operator',
  viewer: 'Viewer',
};

export default function RolesPage() {
  const { t, locale } = useTranslation();
  const { isAdmin, loading: roleLoading } = useRole();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const roleLabels = locale === 'ja' ? ROLE_LABELS_JA : ROLE_LABELS_EN;

  useEffect(() => {
    if (!isAdmin && !roleLoading) return;
    fetchUsers();
  }, [isAdmin, roleLoading]);

  const fetchUsers = async () => {
    try {
      const res = await fetchWithAuth(`${getApiUrl()}/api/roles`);
      const json = await res.json();
      if (json.success) {
        setUsers(json.data);
      }
    } catch (e) {
      console.error('Failed to fetch users:', e);
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (userId: string, newRole: string) => {
    setUpdating(userId);
    setMessage(null);
    try {
      const res = await fetchWithAuth(`${getApiUrl()}/api/roles/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const json = await res.json();
      if (json.success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
        setMessage({ type: 'success', text: locale === 'ja' ? '\u30ed\u30fc\u30eb\u3092\u66f4\u65b0\u3057\u307e\u3057\u305f' : 'Role updated successfully' });
      } else {
        setMessage({ type: 'error', text: json.error || (locale === 'ja' ? '\u66f4\u65b0\u306b\u5931\u6557\u3057\u307e\u3057\u305f' : 'Failed to update') });
      }
    } catch (e) {
      setMessage({ type: 'error', text: locale === 'ja' ? '\u901a\u4fe1\u30a8\u30e9\u30fc' : 'Network error' });
    } finally {
      setUpdating(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-6xl mb-4">&#x1f512;</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {locale === 'ja' ? '\u30a2\u30af\u30bb\u30b9\u6a29\u9650\u304c\u3042\u308a\u307e\u305b\u3093' : 'Access Denied'}
          </h2>
          <p className="text-gray-500">
            {locale === 'ja' ? '\u3053\u306e\u30da\u30fc\u30b8\u306f\u7ba1\u7406\u8005\u306e\u307f\u30a2\u30af\u30bb\u30b9\u3067\u304d\u307e\u3059' : 'This page is restricted to administrators'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {locale === 'ja'
              ? '\u30e6\u30fc\u30b6\u30fc\u306e\u30a2\u30af\u30bb\u30b9\u6a29\u9650\u3092\u7ba1\u7406\u3057\u307e\u3059\u3002\u7ba1\u7406\u8005\u30fb\u30aa\u30da\u30ec\u30fc\u30bf\u30fc\u30fb\u95b2\u89a7\u8005\u306e3\u6bb5\u968e\u306e\u30ed\u30fc\u30eb\u3092\u8a2d\u5b9a\u3067\u304d\u307e\u3059\u3002'
              : 'Manage user access permissions. Set one of three roles: Admin, Operator, or Viewer.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {['admin', 'operator', 'viewer'].map(r => (
            <span key={r} className={`px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[r]}`}>
              {roleLabels[r]}
            </span>
          ))}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Role descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">{roleLabels.admin}</span>
          </div>
          <p className="text-sm text-purple-700">
            {locale === 'ja' ? '\u5168\u6a5f\u80fd\u3078\u306e\u30d5\u30eb\u30a2\u30af\u30bb\u30b9\u3002\u30e6\u30fc\u30b6\u30fc\u7ba1\u7406\u30fb\u8a2d\u5b9a\u5909\u66f4\u304c\u53ef\u80fd\u3002' : 'Full access to all features. Can manage users and settings.'}
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{roleLabels.operator}</span>
          </div>
          <p className="text-sm text-blue-700">
            {locale === 'ja' ? '\u9867\u5ba2\u7ba1\u7406\u30fb\u30c1\u30e3\u30c3\u30c8\u30fb\u914d\u4fe1\u306a\u3069\u306e\u65e5\u5e38\u696d\u52d9\u64cd\u4f5c\u304c\u53ef\u80fd\u3002\u8a2d\u5b9a\u5909\u66f4\u306f\u4e0d\u53ef\u3002' : 'Can manage customers, chat, delivery. Cannot change settings.'}
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{roleLabels.viewer}</span>
          </div>
          <p className="text-sm text-gray-600">
            {locale === 'ja' ? '\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9\u30fb\u5206\u6790\u30fb\u30ec\u30dd\u30fc\u30c8\u306e\u95b2\u89a7\u306e\u307f\u3002\u30c7\u30fc\u30bf\u5909\u66f4\u306f\u4e0d\u53ef\u3002' : 'View-only access to dashboards, analytics, and reports.'}
          </p>
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">{locale === 'ja' ? '\u30e6\u30fc\u30b6\u30fc' : 'User'}</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">LINE ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">{locale === 'ja' ? '\u30ed\u30fc\u30eb' : 'Role'}</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">{locale === 'ja' ? '\u30b9\u30c6\u30fc\u30bf\u30b9' : 'Status'}</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">{locale === 'ja' ? '\u767b\u9332\u65e5' : 'Created'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map(user => {
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.picture_url ? (
                          <img src={user.picture_url} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-sm font-medium">
                            {(user.display_name || '?')[0]}
                          </div>
                        )}
                        <span className="font-medium text-gray-900">{user.display_name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">{user.line_user_id?.substring(0, 12)}...</td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        onChange={(e) => updateRole(user.id, e.target.value)}
                        disabled={updating === user.id}
                        className={`text-sm rounded-lg border border-gray-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          updating === user.id ? 'opacity-50 cursor-wait' : 'cursor-pointer'
                        }`}
                      >
                        <option value="admin">{roleLabels.admin}</option>
                        <option value="operator">{roleLabels.operator}</option>
                        <option value="viewer">{roleLabels.viewer}</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {locale === 'ja' ? '\u30e6\u30fc\u30b6\u30fc\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093' : 'No users found'}
          </div>
        )}
      </div>
    </div>
  );
}
