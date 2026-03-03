'use client';

import { useState, useEffect } from 'react';
import { liffFetch, closeLiff } from '@/lib/liff';

interface Profile {
  id: string;
  display_name: string;
  picture_url: string | null;
  status_message: string | null;
  status: string;
  created_at: string;
  tags: Array<{ name: string; color: string }>;
  attributes: Array<{ key: string; value: string }>;
}

export default function LiffProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    liffFetch('/api/liff/profile')
      .then(r => r.json())
      .then(json => {
        if (json.data) {
          setProfile(json.data);
          setEditName(json.data.display_name || '');
          setEditMessage(json.data.status_message || '');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await liffFetch('/api/liff/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: editName, status_message: editMessage }),
      });
      const json = await res.json();
      if (json.data) {
        setProfile({ ...profile!, ...json.data });
        setEditing(false);
      }
    } catch {}
    setSaving(false);
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="animate-pulse bg-white rounded-xl h-20" />)}</div>;
  }

  if (!profile) {
    return <div className="text-center py-8 text-gray-400 text-sm">プロフィールを取得できません</div>;
  }

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        {profile.picture_url ? (
          <img src={profile.picture_url} alt="" className="w-20 h-20 rounded-full mx-auto mb-3" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-200 mx-auto mb-3 flex items-center justify-center text-2xl text-gray-400">👤</div>
        )}

        {editing ? (
          <div className="space-y-3 text-left">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">表示名</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">ステータスメッセージ</label>
              <input
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#06C755]"
                placeholder="ステータスメッセージ"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">キャンセル</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-[#06C755] text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-gray-900">{profile.display_name}</h2>
            {profile.status_message && <p className="text-sm text-gray-500 mt-1">{profile.status_message}</p>}
            <button onClick={() => setEditing(true)} className="mt-3 px-4 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
              編集
            </button>
          </>
        )}
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs text-gray-500">ステータス</span>
          <span className={`text-xs font-medium ${profile.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}>
            {profile.status === 'active' ? 'アクティブ' : profile.status}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-xs text-gray-500">登録日</span>
          <span className="text-xs text-gray-700">{new Date(profile.created_at).toLocaleDateString('ja-JP')}</span>
        </div>
      </div>

      {/* Tags */}
      {profile.tags.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-bold text-gray-500 mb-2">タグ</h3>
          <div className="flex flex-wrap gap-2">
            {profile.tags.map((tag, i) => (
              <span key={i} className="inline-block px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: tag.color }}>
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Attributes */}
      {profile.attributes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {profile.attributes.map((attr, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-gray-500">{attr.key}</span>
              <span className="text-xs text-gray-700">{attr.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
