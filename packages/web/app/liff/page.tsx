'use client';

import { useState, useEffect } from 'react';
import { liffFetch } from '@/lib/liff';

interface Profile {
  display_name: string;
  picture_url: string | null;
  status: string;
  created_at: string;
  tags: Array<{ name: string; color: string }>;
}

interface Survey {
  id: string;
  title: string;
  responded: boolean;
}

export default function LiffHomePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      liffFetch('/api/liff/profile').then(r => r.json()).catch(() => ({ data: null })),
      liffFetch('/api/liff/surveys').then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([profileJson, surveyJson]) => {
      if (profileJson.data) setProfile(profileJson.data);
      if (surveyJson.data) setSurveys(surveyJson.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-white rounded-xl p-4 h-20" />
        ))}
      </div>
    );
  }

  const pendingSurveys = surveys.filter(s => !s.responded);

  return (
    <div className="space-y-4">
      {/* Welcome card */}
      <div className="bg-gradient-to-r from-[#06C755] to-[#05a347] rounded-xl p-5 text-white">
        <p className="text-lg font-bold">{profile?.display_name || 'ゲスト'}さん</p>
        <p className="text-sm opacity-90 mt-1">ようこそマイページへ</p>
      </div>

      {/* Pending surveys */}
      {pendingSurveys.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">未回答のアンケート</h3>
          <div className="space-y-2">
            {pendingSurveys.slice(0, 3).map(s => (
              <a
                key={s.id}
                href={`/liff/surveys/${s.id}`}
                className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
              >
                <span className="text-sm text-gray-900">{s.title}</span>
                <span className="text-xs text-orange-600 font-medium">回答する →</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <a href="/liff/history" className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:shadow-sm transition-shadow">
          <span className="text-2xl block mb-1">💬</span>
          <span className="text-sm text-gray-700">メッセージ履歴</span>
        </a>
        <a href="/liff/profile" className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:shadow-sm transition-shadow">
          <span className="text-2xl block mb-1">👤</span>
          <span className="text-sm text-gray-700">プロフィール</span>
        </a>
        <a href="/liff/surveys" className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:shadow-sm transition-shadow">
          <span className="text-2xl block mb-1">📋</span>
          <span className="text-sm text-gray-700">アンケート</span>
          {pendingSurveys.length > 0 && (
            <span className="inline-block mt-1 bg-red-500 text-white text-xs rounded-full px-1.5">{pendingSurveys.length}</span>
          )}
        </a>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center opacity-60">
          <span className="text-2xl block mb-1">⚙️</span>
          <span className="text-sm text-gray-400">設定</span>
        </div>
      </div>

      {/* Tags */}
      {profile?.tags && profile.tags.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-2">マイタグ</h3>
          <div className="flex flex-wrap gap-2">
            {profile.tags.map((tag, i) => (
              <span key={i} className="inline-block px-2.5 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: tag.color }}>
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
