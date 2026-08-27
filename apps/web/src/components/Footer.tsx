import Link from 'next/link';
import Image from 'next/image';

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: 'Job seekers',
    links: [
      { label: 'Browse jobs', href: '/jobs' },
      { label: 'Companies', href: '/companies' },
      { label: 'Create an account', href: '/register' },
    ],
  },
  {
    heading: 'Employers',
    links: [
      { label: 'Post a job', href: '/register' },
      { label: 'Browse companies', href: '/companies' },
      { label: 'Sign in', href: '/login' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-ink text-white/70 mt-auto">
      <div className="max-w-[1320px] mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr] gap-10">
        <div>
          <Image src="/logo.png" alt="Job Centre Uganda" width={150} height={36} className="h-8 w-auto object-contain mb-3 brightness-0 invert" />
          <p className="text-sm leading-relaxed max-w-[320px]">
            Uganda&apos;s transparent hiring marketplace — verified employers, real
            salaries, and AI-assisted matching for job seekers across Kampala,
            Gulu, Mbarara and beyond.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <div className="text-[11px] font-bold tracking-widest text-white uppercase mb-3.5">{col.heading}</div>
            <div className="flex flex-col gap-2.5 text-sm">
              {col.links.map((link) => (
                <Link key={link.label} href={link.href} className="text-white/70 hover:text-white transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-[1320px] mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/50">
          <span>© {new Date().getFullYear()} Job Centre Uganda. All rights reserved.</span>
          <span>Kampala · Gulu · Mbarara</span>
        </div>
      </div>
    </footer>
  );
}
