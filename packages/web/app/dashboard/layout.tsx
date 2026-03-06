'use client';

import { useState } from 'react';
import Sidebar from '@/components/sidebar';
import Header from '@/components/header';
import { usePathname } from 'next/navigation';
import { useTranslation, I18nProvider } from '@/lib/i18n';
import { RoleProvider } from '@/lib/role';

const pageKeys: Record<string, string> = {
  '/dashboard': 'page.dashboard',
  '/dashboard/customers': 'page.customers',
  '/dashboard/chat': 'page.chat',
  '/dashboard/scenarios': 'page.scenarios',
  '/dashboard/segments': 'page.segments',
  '/dashboard/richmenu': 'page.richmenu',
  '/dashboard/messages': 'page.messages',
  '/dashboard/surveys': 'page.surveys',
  '/dashboard/knowledge': 'page.knowledge',
  '/dashboard/templates': 'page.templates',
  '/dashboard/ai-generate': 'page.aiGenerate',
  '/dashboard/ab-tests': 'page.abTests',
  '/dashboard/ai-classify': 'page.aiClassify',
  '/dashboard/analytics': 'page.analytics',
  '/dashboard/scheduled': 'page.scheduled',
  '/dashboard/auto-response': 'page.autoResponse',
  '/dashboard/reports': 'page.reports',
  '/dashboard/calendar': 'page.calendar',
  '/dashboard/follow-sources': 'page.followSources',
  '/dashboard/engagement-scores': 'page.engagementScores',
  '/dashboard/conversions': 'page.conversions',
  '/dashboard/ai-optimize': 'page.aiOptimize',
  '/dashboard/delivery-queue': 'page.deliveryQueue',
  '/dashboard/delivery-errors': 'page.deliveryErrors',
  '/dashboard/import': 'page.import',
  '/dashboard/roles': 'page.roles',
  '/dashboard/api-monitor': 'page.apiMonitor',
  '/dashboard/notifications': 'page.notifications',
  '/dashboard/line-stats': 'page.lineStats',
  '/dashboard/rate-limit': 'page.rateLimit',
  '/dashboard/settings': 'page.settings',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <I18nProvider>
      <RoleProvider>
        <DashboardLayoutInner>{children}</DashboardLayoutInner>
      </RoleProvider>
    </I18nProvider>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const titleKey = pageKeys[pathname] || 'page.dashboard';
  const title = t(titleKey);
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
