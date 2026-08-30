'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Search } from 'lucide-react';
import RequireRole from '@/components/RequireRole';
import PortalSidebar from '@/components/PortalSidebar';
import SeekerAvatar from '@/components/SeekerAvatar';
import NotificationBell from '@/components/NotificationBell';
import { useAuth, useApi } from '@/lib/auth-context';
import { seekerDisplayName } from '@/lib/format';
import { currentSectionLabel } from '@/lib/portal-nav';
import type { Interview, Job } from '@/lib/types';

function buildGroups(recCount: number, interviewCount: number) {
  return [
    {
      label: 'Find work',
      items: [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/dashboard/recommended', label: 'Recommended', badge: recCount },
        { href: '/dashboard/saved-jobs', label: 'Saved Jobs' },
      ],
    },
    {
      label: 'My applications',
      items: [
        { href: '/dashboard/applications', label: 'Applications' },
        { href: '/dashboard/interviews', label: 'Interviews', badge: interviewCount },
      ],
    },
    {
      label: 'Communication',
      items: [{ href: '/dashboard/messages', label: 'Messages' }],
    },
    {
      label: 'My profile',
      items: [{ href: '/dashboard/profile', label: 'Resume Builder' }],
    },
  ];
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role="JOB_SEEKER">
      <Shell>{children}</Shell>
    </RequireRole>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const api = useApi();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [q, setQ] = useState('');
  const [recCount, setRecCount] = useState(0);
  const [interviewCount, setInterviewCount] = useState(0);

  useEffect(() => {
    // Capped at 50 rather than a true unbounded total — matches
    // /me/recommendations' own pool size, close enough for a nav badge.
    api<{ job: Job; score: number }[]>('/me/recommendations?limit=50').then((r) => setRecCount(r.length)).catch(() => undefined);
    api<Interview[]>('/me/interviews')
      .then((list) => setInterviewCount(list.filter((i) => i.status === 'SCHEDULED' && new Date(i.scheduledAt) > new Date()).length))
      .catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/jobs?q=${encodeURIComponent(q.trim())}`);
  }

  const groups = buildGroups(recCount, interviewCount);
  const sectionLabel = currentSectionLabel(pathname, groups.flatMap((g) => g.items), 'Job Seeker Portal');

  return (
    <div className="min-h-screen bg-ground">
      <PortalSidebar
        groups={groups}
        footerLabel={seekerDisplayName(user)}
        footerSub={`Profile ${user?.seekerProfile?.profileStrength ?? 0}% complete`}
        footerAvatar={<SeekerAvatar seeker={user} size={36} />}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="lg:ml-[260px] min-h-screen flex flex-col">
        <div className="h-16 bg-white border-b border-border flex items-center justify-between gap-3 px-4 lg:px-7 flex-none sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-ink flex-none" aria-label="Open menu">
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-lg font-semibold truncate flex-none">{sectionLabel}</span>
            <form onSubmit={submitSearch} className="hidden sm:flex items-center gap-2 bg-ground rounded px-3 h-9 flex-1 max-w-[360px]">
              <Search className="w-4 h-4 text-muted flex-none" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search jobs, companies"
                className="bg-transparent text-sm outline-none flex-1 min-w-0"
              />
            </form>
          </div>
          <NotificationBell />
        </div>
        <main key={pathname} className="flex-1 p-4 sm:p-7 animate-fadeIn">{children}</main>
      </div>
    </div>
  );
}
