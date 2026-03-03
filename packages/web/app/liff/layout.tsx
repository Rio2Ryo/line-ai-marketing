'use client';

import { useState, useEffect } from 'react';
import { initLiff, getLiff } from '@/lib/liff';

export default function LiffLayout({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ displayName: string; pictureUrl?: string } | null>(null);

  useEffect(() => {
    initLiff()
      .then(async (liff) => {
        if (!liff) return; // Redirecting to login
        setInitialized(true);
        try {
          const p = await liff.getProfile();
          setProfile(p);
        } catch {}
      })
      .catch((e) => {
        setError(String(e));
        // In development without LIFF, still show the page
        setInitialized(true);
      });
  }, []);

  if (error && !initialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 text-sm mb-2">LIFF初期化エラー</p>
          <p className="text-xs text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#06C755]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* LIFF Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {profile?.pictureUrl && (
            <img src={profile.pictureUrl} alt="" className="w-8 h-8 rounded-full" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{profile?.displayName || 'マイページ'}</p>
          </div>
          <div className="w-6 h-6 rounded-full bg-[#06C755]" />
        </div>
      </header>

      {/* Navigation tabs */}
      <nav className="bg-white border-b border-gray-100 px-2 flex">
        {[
          { href: '/liff', label: 'ホーム', icon: '🏠' },
          { href: '/liff/surveys', label: 'アンケート', icon: '📋' },
          { href: '/liff/history', label: '履歴', icon: '💬' },
          { href: '/liff/profile', label: 'プロフィール', icon: '👤' },
        ].map(tab => (
          <a
            key={tab.href}
            href={tab.href}
            className="flex-1 py-2.5 text-center text-xs text-gray-600 hover:text-[#06C755] hover:bg-green-50 transition-colors"
          >
            <span className="block text-lg mb-0.5">{tab.icon}</span>
            {tab.label}
          </a>
        ))}
      </nav>

      {/* Page content */}
      <main className="p-4 max-w-lg mx-auto">
        {children}
      </main>
    </div>
  );
}
