'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import RequireRole from '@/components/RequireRole';
import PortalSidebar from '@/components/PortalSidebar';
import NotificationBell from '@/components/NotificationBell';
import { useAuth, useApi } from '@/lib/auth-context';
import { currentSectionLabel } from '@/lib/portal-nav';
import type { ConversationReport, SalaryVerificationRequest } from '@/lib/types';

function buildGroups(openReportCount: number, pendingVerificationCount: number) {
  return [
    { label: 'Overview', items: [{ href: '/admin', label: 'Dashboard' }] },
    {
      label: 'Moderation',
      items: [
        { href: '/admin/moderation', label: 'Job Queue' },
        { href: '/admin/reports', label: 'Reports', badge: openReportCount },
        { href: '/admin/salary-verifications', label: 'Salary Verifications', badge: pendingVerificationCount },
      ],
    },
    {
      label: 'Directory',
      items: [
        { href: '/admin/users', label: 'Users & Companies' },
        { href: '/admin/categories', label: 'Categories' },
      ],
    },
    {
      label: 'Content',
      items: [{ href: '/admin/career-advice', label: 'Career Advice' }],
    },
    {
      label: 'Inbox',
      items: [{ href: '/admin/contact-messages', label: 'Contact Messages' }],
    },
  ];
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role="ADMIN">
      <Shell>{children}</Shell>
    </RequireRole>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const api = useApi();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openReportCount, setOpenReportCount] = useState(0);
  const [pendingVerificationCount, setPendingVerificationCount] = useState(0);

  useEffect(() => {
    api<ConversationReport[]>('/admin/reports?status=OPEN').then((r) => setOpenReportCount(r.length)).catch(() => undefined);
    api<SalaryVerificationRequest[]>('/admin/salary-verifications?status=PENDING').then((r) => setPendingVerificationCount(r.length)).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = buildGroups(openReportCount, pendingVerificationCount);
  const sectionLabel = currentSectionLabel(pathname, groups.flatMap((g) => g.items), 'Admin Console');
  return (
    <div className="min-h-screen bg-ground">
      <PortalSidebar
        variant="admin"
        groups={groups}
        footerLabel={user?.email || 'Admin'}
        footerSub="SUPER ADMIN"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="lg:ml-[260px] min-h-screen flex flex-col">
        <div className="h-16 bg-white border-b border-border flex items-center justify-between gap-3 px-4 lg:px-7 flex-none sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-ink flex-none" aria-label="Open menu">
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-lg font-semibold truncate">{sectionLabel}</span>
          </div>
          <NotificationBell />
        </div>
        <main key={pathname} className="flex-1 p-4 sm:p-7 animate-fadeIn">{children}</main>
      </div>
    </div>
  );
}
