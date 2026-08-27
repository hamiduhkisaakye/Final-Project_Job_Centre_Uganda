'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { seekerDisplayName } from '@/lib/format';
import SeekerAvatar from './SeekerAvatar';
import CompanyLogo from './CompanyLogo';
import type { User } from '@/lib/types';

export const PORTAL_MENUS: Record<User['role'], { home: string; label: string; items: { href: string; label: string }[] }> = {
  JOB_SEEKER: {
    home: '/dashboard',
    label: 'Dashboard',
    items: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/dashboard/saved-jobs', label: 'Saved Jobs' },
      { href: '/dashboard/applications', label: 'Applications' },
      { href: '/dashboard/messages', label: 'Messages' },
      { href: '/dashboard/profile', label: 'Resume & Profile' },
    ],
  },
  COMPANY: {
    home: '/company',
    label: 'Dashboard',
    items: [
      { href: '/company', label: 'Dashboard' },
      { href: '/company/manage-jobs', label: 'Manage Jobs' },
      { href: '/company/pipeline', label: 'Candidate Pipeline' },
      { href: '/company/messages', label: 'Messages' },
      { href: '/company/settings', label: 'Settings & Branding' },
    ],
  },
  ADMIN: {
    home: '/admin',
    label: 'Admin Console',
    items: [
      { href: '/admin', label: 'Dashboard' },
      { href: '/admin/moderation', label: 'Job Queue' },
      { href: '/admin/users', label: 'Users & Companies' },
    ],
  },
};

// Profile card that opens a portal quick-nav — click-to-toggle (not
// hover), since hover has no equivalent on touch devices and the previous
// group-hover version was effectively unusable on mobile/tablet. Closes on
// an outside click/tap or on selecting an item.
export default function UserMenu({ user }: { user: User }) {
  const router = useRouter();
  const { logout } = useAuth();
  const menu = PORTAL_MENUS[user.role];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, []);

  const avatar =
    user.role === 'JOB_SEEKER' ? (
      <SeekerAvatar seeker={user} size={32} />
    ) : user.role === 'COMPANY' ? (
      <CompanyLogo company={{ name: user.company?.name || 'Company', logoUrl: user.company?.logoUrl }} size={32} rounded="rounded-full" />
    ) : (
      <div className="w-8 h-8 rounded-full bg-primary text-white font-bold text-xs flex items-center justify-center flex-none">
        {user.email.slice(0, 2).toUpperCase()}
      </div>
    );

  const name = user.role === 'JOB_SEEKER' ? seekerDisplayName(user) : user.role === 'COMPANY' ? user.company?.name || 'Company' : user.email;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 pl-1.5 pr-3 h-10 rounded-full border border-border hover:bg-ground transition-colors"
      >
        {avatar}
        <span className="text-sm font-semibold max-w-[100px] sm:max-w-[140px] truncate">{name}</span>
      </button>

      <div
        className={`absolute right-0 top-full pt-2 z-40 origin-top-right transition-all duration-150 ease-out ${
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
        aria-hidden={!open}
      >
        <div className="w-56 bg-white border border-border rounded-card shadow-2 py-2">
          <div className="px-3.5 py-2 border-b border-ground mb-1">
            <div className="text-sm font-semibold truncate">{name}</div>
            <div className="text-xs text-muted truncate">{user.email}</div>
          </div>
          {menu.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2 text-sm text-ink/80 hover:bg-ground hover:text-primary transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <div className="border-t border-ground mt-1 pt-1">
            <button
              onClick={async () => {
                setOpen(false);
                await logout();
                router.push('/login');
              }}
              className="w-full text-left px-3.5 py-2 text-sm text-danger hover:bg-ground transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
