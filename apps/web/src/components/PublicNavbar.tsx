'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import UserMenu, { PORTAL_MENUS } from './UserMenu';

const NAV_LINKS = [
  { href: '/jobs', label: 'Find Jobs' },
  { href: '/companies', label: 'Companies' },
  { href: '/blog', label: 'Blog' },
];

export default function PublicNavbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-border">
      <div className="max-w-[1320px] mx-auto h-[72px] px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-9">
          <Link href="/" className="flex items-center" onClick={() => setMobileOpen(false)}>
            <Image src="/logo.png" alt="Job Centre Uganda" width={160} height={40} priority className="h-8 w-auto object-contain" />
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-ink/80">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors ${active ? 'text-primary font-semibold border-b-2 border-accent pb-1.5' : 'hover:text-primary'}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <UserMenu user={user} />
          ) : (
            <>
              <Link href="/login" className="text-primary font-semibold text-sm px-2">Log in</Link>
              <Link href="/register" className="btn-primary h-10 px-5">Post a Job</Link>
            </>
          )}
        </div>

        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="md:hidden text-ink"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-white">
          <nav className="flex flex-col px-4 py-2">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`py-3 text-sm font-medium border-b border-ground ${active ? 'text-primary font-semibold' : 'text-ink/80'}`}
                >
                  {link.label}
                </Link>
              );
            })}

            {user ? (
              <>
                {PORTAL_MENUS[user.role].items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="py-3 text-sm text-ink/80 border-b border-ground"
                  >
                    {item.label}
                  </Link>
                ))}
                <button
                  onClick={async () => {
                    setMobileOpen(false);
                    await logout();
                    router.push('/login');
                  }}
                  className="text-left py-3 text-sm text-danger"
                >
                  Log out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2.5 py-3">
                <Link href="/login" onClick={() => setMobileOpen(false)} className="btn-secondary w-full">Log in</Link>
                <Link href="/register" onClick={() => setMobileOpen(false)} className="btn-primary w-full">Post a Job</Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
