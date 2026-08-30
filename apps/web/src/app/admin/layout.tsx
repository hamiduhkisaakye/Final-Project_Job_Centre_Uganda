'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import RequireRole from '@/components/RequireRole';
import PortalSidebar from '@/components/PortalSidebar';
import NotificationBell from '@/components/NotificationBell';
import { useAuth } from '@/lib/auth-context';
import { currentSectionLabel } from '@/lib/portal-nav';

const GROUPS = [
  { label: 'Overview', items: [{ href: '/admin', label: 'Dashboard' }] },
  {
    label: 'Moderation',
    items: [{ href: '/admin/moderation', label: 'Job Queue' }],
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role="ADMIN">
      <Shell>{children}</Shell>
    </RequireRole>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sectionLabel = currentSectionLabel(pathname, GROUPS.flatMap((g) => g.items), 'Admin Console');
  return (
    <div className="min-h-screen bg-ground">
      <PortalSidebar
        variant="admin"
        groups={GROUPS}
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
