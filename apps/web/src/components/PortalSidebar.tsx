'use client';

import Link from 'next/link';
import Image from 'next/image';
import { X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export interface SidebarGroup {
  label: string;
  items: { href: string; label: string; badge?: number }[];
}

// White background on purpose — the real logo (public/logo.png) is a blue
// wordmark, and the old bg-primary/bg-primary-pressed sidebar made it
// unreadable (blue on blue). White keeps it legible in both the default
// and admin variants; admin is distinguished by the small "ADMIN" tag
// instead of a different background color.
//
// Below the `lg` breakpoint this becomes an off-canvas drawer (translated
// out of view + a backdrop) driven by `open`/`onClose`, which the portal
// layout owns via its own hamburger button — at `lg` and up the drawer is
// forced open (`lg:translate-x-0`) and behaves like the old fixed sidebar.
export default function PortalSidebar({
  groups,
  variant = 'default',
  footerLabel,
  footerSub,
  footerAvatar,
  open,
  onClose,
}: {
  groups: SidebarGroup[];
  variant?: 'default' | 'admin';
  footerLabel: string;
  footerSub?: string;
  // Pass a <CompanyLogo>/<SeekerAvatar> for a real photo/logo in the
  // footer instead of plain initials. Omit for admin (no photo concept).
  footerAvatar?: React.ReactNode;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <>
      {open && <div className="fixed inset-0 bg-ink/40 z-30 lg:hidden" onClick={onClose} aria-hidden="true" />}

      <aside
        className={`fixed inset-y-0 left-0 w-[260px] bg-white border-r border-border flex flex-col z-40 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-[72px] flex items-center justify-between gap-2 px-5 border-b border-border flex-none">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/" className="flex items-center flex-none">
              <Image src="/logo.png" alt="Job Centre Uganda" width={140} height={34} className="h-7 w-auto object-contain" />
            </Link>
            {variant === 'admin' && (
              <span className="text-[10px] font-bold tracking-widest text-accent-pressed bg-accent/20 px-1.5 py-0.5 rounded flex-none">ADMIN</span>
            )}
          </div>
          <button onClick={onClose} className="lg:hidden text-muted hover:text-ink transition-colors flex-none" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pt-4 text-sm">
          {groups.map((group) => (
            <div key={group.label} className="mb-3.5">
              <div className="text-[10px] font-bold tracking-widest text-muted px-2.5 pb-2">
                {group.label}
              </div>
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-r mb-0.5 transition-colors ${
                      active
                        ? 'bg-ground border-l-[3px] border-accent font-semibold text-primary -ml-px pl-[9px]'
                        : 'text-ink/70 hover:bg-ground hover:text-ink'
                    }`}
                  >
                    <span className="flex-1">{item.label}</span>
                    {!!item.badge && (
                      <span className="bg-accent text-ink text-[11px] font-bold px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-border px-3 py-3.5 flex-none">
          <div className="flex items-center gap-2.5 mb-2">
            {footerAvatar ?? (
              <div className="w-9 h-9 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center flex-none">
                {footerLabel.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{footerLabel}</div>
              {footerSub && <div className="text-xs text-muted truncate">{footerSub}</div>}
            </div>
          </div>
          <button
            onClick={async () => {
              await logout();
              router.push('/login');
            }}
            className="text-xs text-muted hover:text-danger underline"
          >
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
