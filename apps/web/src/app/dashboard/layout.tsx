'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import RequireRole from '@/components/RequireRole';
import PortalSidebar from '@/components/PortalSidebar';
import SeekerAvatar from '@/components/SeekerAvatar';
import NotificationBell from '@/components/NotificationBell';
import { useAuth } from '@/lib/auth-context';
import { seekerDisplayName } from '@/lib/format';

const GROUPS = [
  {
    label: 'Find work',
    items: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/dashboard/saved-jobs', label: 'Saved Jobs' },
    ],
  },
  {
    label: 'My applications',
    items: [{ href: '/dashboard/applications', label: 'Applications' }],
  },
  {
    label: 'Communication',
    items: [{ href: '/dashboard/messages', label: 'Messages' }],
  },
  {
    label: 'My profile',
    items: [{ href: '/dashboard/profile', label: 'Resume & Profile' }],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role="JOB_SEEKER">
      <Shell>{children}</Shell>
    </RequireRole>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="min-h-screen bg-ground">
      <PortalSidebar
        groups={GROUPS}
        footerLabel={seekerDisplayName(user)}
        footerSub={`Profile ${user?.seekerProfile?.profileStrength ?? 0}% complete`}
        footerAvatar={<SeekerAvatar seeker={user} size={36} />}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="lg:ml-[260px] min-h-screen flex flex-col">
        <div className="h-16 bg-white border-b border-border flex items-center justify-between gap-3 px-4 lg:px-7 flex-none sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-ink flex-none" aria-label="Open menu">
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-lg font-semibold truncate">Job Seeker Portal</span>
          </div>
          <NotificationBell />
        </div>
        <main key={pathname} className="flex-1 p-4 sm:p-7 animate-fadeIn">{children}</main>
      </div>
    </div>
  );
}
