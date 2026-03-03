'use client';

import { useState } from 'react';
import Sidebar from '@/components/sidebar';
import Header from '@/components/header';
import { usePathname } from 'next/navigation';

const pageTitles: Record<string, string> = {
  '/dashboard': 'ダッシュボード',
  '/dashboard/customers': '顧客管理',
  '/dashboard/scenarios': 'シナリオ',
  '/dashboard/segments': 'セグメント配信',
  '/dashboard/richmenu': 'リッチメニュー',
  '/dashboard/messages': 'メッセージ',
  '/dashboard/surveys': 'アンケート',
  '/dashboard/knowledge': 'ナレッジベース',
  '/dashboard/templates': 'テンプレートライブラリ',
  '/dashboard/ai-generate': 'AIコンテンツ生成',
  '/dashboard/ab-tests': 'A/Bテスト',
  '/dashboard/ai-classify': 'AI自動分類',
  '/dashboard/analytics': 'AI分析ダッシュボード',
  '/dashboard/scheduled': '予約配信',
  '/dashboard/auto-response': '自動応答ルール',
  '/dashboard/reports': '配信レポート',
  '/dashboard/calendar': '配信カレンダー',
  '/dashboard/settings': '設定',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const title = pageTitles[pathname] || 'ダッシュボード';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} onMenuToggle={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
