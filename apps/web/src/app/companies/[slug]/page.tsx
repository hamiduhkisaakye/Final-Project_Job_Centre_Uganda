import { notFound } from 'next/navigation';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import CompanyLogo from '@/components/CompanyLogo';
import CompanyFollowButton from '@/components/CompanyFollowButton';
import CompanyTabs from '@/components/CompanyTabs';
import { publicFetch } from '@/lib/api';
import type { Company, CompanyReview } from '@/lib/types';

export default async function CompanyProfilePage({ params }: { params: { slug: string } }) {
  const company = await publicFetch<Company>(`/companies/${params.slug}`);
  if (!company) notFound();

  const reviews = (await publicFetch<CompanyReview[]>(`/companies/${company.id}/reviews`)) || [];
  const jobs = company.jobs || [];
  const verifiedShare = jobs.length ? Math.round((jobs.filter((j) => j.salaryVerifiedAt).length / jobs.length) * 100) : 0;

  return (
    <>
      <PublicNavbar />

      <div className="h-[220px] bg-gradient-to-br from-primary to-primary-pressed relative">
        <div className="max-w-[1320px] mx-auto px-6 h-full relative">
          <div className="absolute left-6 bottom-[-56px]">
            <CompanyLogo company={company} size={110} className="border-4 border-white shadow-2 text-2xl" />
          </div>
        </div>
      </div>

      <div className="max-w-[1320px] mx-auto px-6 pt-16 pb-8">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold">{company.name}</h1>
              {company.verificationStatus === 'VERIFIED' && (
                <span className="badge badge-blue">🛡 VERIFIED EMPLOYER</span>
              )}
            </div>
            <div className="text-muted">
              {company.industry} · {company.sizeBand} employees · {company.hqLocation}
              {(company._count?.follows ?? 0) > 0 && ` · ${company._count!.follows!.toLocaleString()} followers`}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <CompanyFollowButton companyId={company.id} initialCount={company._count?.follows ?? 0} />
            {company.website && (
              <a href={company.website} target="_blank" rel="noreferrer" className="btn-secondary">
                Visit website →
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="flex-1 min-w-0 w-full">
            <CompanyTabs company={company} jobs={jobs} initialReviews={reviews} />
          </div>

          <div className="w-full md:w-[340px] flex-none flex flex-col gap-4">
            <div className="card p-5">
              <div className="text-[11px] font-bold tracking-wide text-primary mb-3">COMPANY FACTS</div>
              <div className="flex flex-col gap-2 text-sm">
                {company.foundedYear && (
                  <div className="flex justify-between"><span className="text-muted">Founded</span><span>{company.foundedYear}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted">Employees</span><span>{company.sizeBand || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted">Industry</span><span>{company.industry || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted">Locations</span><span>{company.hqLocation || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted">Open jobs</span><span>{jobs.length}</span></div>
              </div>
            </div>
            <div className="bg-ground rounded p-5">
              <div className="text-[11px] font-bold tracking-wide text-primary mb-2.5">SALARY TRANSPARENCY</div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-bold text-primary">{verifiedShare}%</span>
                <span className="text-sm">of jobs show a verified range</span>
              </div>
              <div className="h-2 rounded-full bg-border">
                <div className="h-2 rounded-full bg-accent" style={{ width: `${verifiedShare}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
