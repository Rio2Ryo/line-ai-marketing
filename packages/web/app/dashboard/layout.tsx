'use client';

import Sidebar from '@/components/sidebar';
import Header from '@/components/header';
import { usePathname } from 'next/navigation';

const pageTitles: Record<string, string> = {
  '/dashboard': 'ダッシュボード',
  '/dashboard/customers': '顧客管理',
  '/dashboard/scenarios': 'シナリオ',
  '/dashboard/richmenu': 'リッチメニュー',
  '/dashboard/messages': 'メッセージ',
  '/dashboard/knowledge': 'ナレッジベース',
  '/dashboard/settings': '設定',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const title = pageTitles[pathname] || 'ダッシュボード';

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title={title} />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
