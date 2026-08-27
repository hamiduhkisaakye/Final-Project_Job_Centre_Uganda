import Link from 'next/link';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import CompanyLogo from '@/components/CompanyLogo';
import { publicFetch } from '@/lib/api';
import type { Company } from '@/lib/types';

export default async function CompaniesDirectoryPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const q = typeof searchParams.q === 'string' ? searchParams.q : '';
  const companies = (await publicFetch<Company[]>(`/companies${q ? `?q=${encodeURIComponent(q)}` : ''}`)) || [];

  return (
    <>
      <PublicNavbar />

      <div className="bg-ground border-b border-border">
        <div className="max-w-[1320px] mx-auto px-6 py-10">
          <h1 className="text-3xl font-bold mb-2">Companies hiring on Job Centre Uganda</h1>
          <p className="text-muted mb-5">Browse verified employers with real, transparent salary ranges.</p>
          <form className="max-w-[420px]">
            <input
              className="input"
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search companies by name…"
            />
          </form>
        </div>
      </div>

      <div className="max-w-[1320px] mx-auto px-6 py-8">
        {companies.length === 0 ? (
          <p className="text-sm text-muted">No companies found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {companies.map((c) => (
              <Link
                key={c.id}
                href={`/companies/${c.slug}`}
                className="card p-5 flex flex-col gap-3 hover:shadow-2 hover:border-primary transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <CompanyLogo company={c} size={52} className="flex-none" />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-xs text-muted truncate">{c.industry || '—'}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{c.hqLocation || 'Uganda'}</span>
                  <span>{c._count?.jobs ?? 0} open role{(c._count?.jobs ?? 0) === 1 ? '' : 's'}</span>
                </div>
                {c.verificationStatus === 'VERIFIED' && (
                  <span className="badge badge-blue w-fit">🛡 Verified employer</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </>
  );
}
