'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import RequireRole from '@/components/RequireRole';
import PortalSidebar from '@/components/PortalSidebar';
import CompanyLogo from '@/components/CompanyLogo';
import NotificationBell from '@/components/NotificationBell';
import { useAuth } from '@/lib/auth-context';
import { currentSectionLabel } from '@/lib/portal-nav';
import Link from 'next/link';

const GROUPS = [
  { label: 'Overview', items: [{ href: '/company', label: 'Dashboard' }] },
  {
    label: 'Hiring',
    items: [
      { href: '/company/manage-jobs', label: 'Manage Jobs' },
      { href: '/company/pipeline', label: 'Candidate Pipeline' },
      { href: '/company/assessments', label: 'Skills Assessments' },
    ],
  },
  {
    label: 'Communication',
    items: [{ href: '/company/messages', label: 'Messages' }],
  },
  {
    label: 'Company',
    items: [{ href: '/company/settings', label: 'Settings & Branding' }],
  },
];

// Pages reachable without a sidebar entry (e.g. the "+ Post a Job" header
// button) — kept separate from GROUPS so adding a title here doesn't also
// add an unrequested sidebar item.
const EXTRA_TITLES = [{ href: '/company/post-job', label: 'Post a Job' }];

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role="COMPANY">
      <Shell>{children}</Shell>
    </RequireRole>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sectionLabel = currentSectionLabel(pathname, [...GROUPS.flatMap((g) => g.items), ...EXTRA_TITLES], 'Company Portal');
  return (
    <div className="min-h-screen bg-ground">
      <PortalSidebar
        groups={GROUPS}
        footerLabel={user?.company?.name || 'Company'}
        footerSub={`${user?.company?.plan || 'FREE'} plan · ${user?.company?.credits ?? 0} credits`}
        footerAvatar={<CompanyLogo company={{ name: user?.company?.name || 'Company', logoUrl: user?.company?.logoUrl }} size={36} rounded="rounded-full" />}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="lg:ml-[260px] min-h-screen flex flex-col">
        <div className="h-16 bg-white border-b border-border flex items-center justify-between gap-3 px-4 lg:px-7 flex-none sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-ink flex-none" aria-label="Open menu">
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-lg font-semibold truncate hidden sm:block">{sectionLabel}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-none">
            <NotificationBell />
            <Link href="/company/post-job" className="btn-primary bg-accent text-ink hover:bg-accent-pressed h-10 px-3 sm:px-4 flex-none text-sm sm:text-base">
              <span className="sm:hidden">+ Post</span>
              <span className="hidden sm:inline">+ Post a Job</span>
            </Link>
          </div>
        </div>
        <main key={pathname} className="flex-1 p-4 sm:p-7 animate-fadeIn">{children}</main>
      </div>
    </div>
  );
}
